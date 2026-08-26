import { lookup } from 'dns/promises';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RawRecipeCandidate } from '../ai/claude.service';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { ImportRecipeDto } from './dto/import-recipe.dto';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 3_000_000;
const UNREACHABLE_MESSAGE = "Couldn't reach that link. Check the URL and try again.";

const UNIT_WORDS = [
  'cups?', 'tbsp', 'tablespoons?', 'tsp', 'teaspoons?', 'grams?', 'g', 'kg', 'kilograms?',
  'ml', 'millilitres?', 'l', 'litres?', 'oz', 'ounces?', 'lb', 'pounds?', 'cloves?',
  'slices?', 'pinch(?:es)?', 'cans?', 'tins?', 'sprigs?', 'bunche?s?',
];
const INGREDIENT_RE = new RegExp(
  // \b after the unit group stops single-letter units (g, l) from matching
  // the leading letter of an unrelated word ("large", "lemon") — without it,
  // "2 large eggs" mis-parses as quantity "2", unit "l", name "arge eggs".
  `^([\\d.\\/\\s]+)?\\s*(${UNIT_WORDS.join('|')})?\\b\\.?\\s*(?:of\\s+)?(.+)$`,
  'i',
);

function isPrivateAddress(ip: string): boolean {
  if (ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // IPv6 loopback / unique local
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function parseIsoDurationMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
  if (!match) return undefined;
  const total = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return total > 0 ? total : undefined;
}

function parseServings(value: unknown): number | undefined {
  if (typeof value === 'number') return Math.round(value);
  if (Array.isArray(value)) return parseServings(value[0]);
  if (typeof value === 'string') {
    const match = /\d+/.exec(value);
    return match ? Number(match[0]) : undefined;
  }
  return undefined;
}

function parseIngredientLine(line: string): { name: string; quantity: string | null; unit: string | null } {
  const trimmed = line.trim();
  const match = INGREDIENT_RE.exec(trimmed);
  if (!match) return { name: trimmed, quantity: null, unit: null };
  const [, quantity, unit, rest] = match;
  return { name: (rest || trimmed).trim(), quantity: quantity?.trim() || null, unit: unit?.trim() || null };
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  const steps: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      steps.push(item.trim());
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record.text === 'string') {
        steps.push(record.text.trim());
      } else if (Array.isArray(record.itemListElement)) {
        steps.push(...flattenInstructions(record.itemListElement));
      }
    }
  }
  return steps.filter(Boolean);
}

function findRecipeNode(json: unknown): Record<string, unknown> | null {
  if (Array.isArray(json)) {
    for (const entry of json) {
      const found = findRecipeNode(entry);
      if (found) return found;
    }
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const record = json as Record<string, unknown>;
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
    return record;
  }
  if (Array.isArray(record['@graph'])) {
    return findRecipeNode(record['@graph']);
  }
  return null;
}

/**
 * Imports a recipe from any page that embeds schema.org/Recipe JSON-LD
 * (the vast majority of recipe blogs do, for Google's rich-results feature)
 * — deterministic parsing, no LLM call, so it works today even without an
 * ANTHROPIC_API_KEY. Inspired by Samsung Food's "save from any website"
 * recipe box feature.
 */
@Injectable()
export class RecipeImportService {
  private readonly logger = new Logger(RecipeImportService.name);

  async importFromUrl(dto: ImportRecipeDto): Promise<RecipeView> {
    const html = await this.fetchHtml(dto.url);
    const recipeNode = this.extractRecipeNode(html);
    if (!recipeNode) {
      throw new BadRequestException("Couldn't find a recipe on that page. Try a different link.");
    }

    const candidate: RawRecipeCandidate = {
      title: typeof recipeNode.name === 'string' ? recipeNode.name : undefined,
      cookTimeMinutes:
        parseIsoDurationMinutes(recipeNode.totalTime) ?? parseIsoDurationMinutes(recipeNode.cookTime),
      servings: parseServings(recipeNode.recipeYield),
      cuisine: typeof recipeNode.recipeCuisine === 'string' ? recipeNode.recipeCuisine : undefined,
      ingredients: (Array.isArray(recipeNode.recipeIngredient) ? recipeNode.recipeIngredient : [])
        .filter((i): i is string => typeof i === 'string')
        .map(parseIngredientLine),
      steps: flattenInstructions(recipeNode.recipeInstructions),
    };

    const validated = sanitizeRecipeCandidate(candidate);
    if (!validated) {
      throw new BadRequestException(
        "Found a recipe on that page, but couldn't read it reliably (missing time, servings, or steps). Try a different link.",
      );
    }
    return validated;
  }

  private async fetchHtml(url: string): Promise<string> {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
      throw new BadRequestException(UNREACHABLE_MESSAGE);
    }

    // Best-effort SSRF guard: reject links that resolve to a private/loopback
    // address. This doesn't close a DNS-rebinding gap between this check and
    // the fetch below — an acceptable gap for an MVP, not a full defence.
    try {
      const { address } = await lookup(parsed.hostname);
      if (isPrivateAddress(address)) {
        throw new BadRequestException(UNREACHABLE_MESSAGE);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(UNREACHABLE_MESSAGE);
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoodPadiBot/1.0)' },
      });
      clearTimeout(timeout);
    } catch {
      throw new BadRequestException(UNREACHABLE_MESSAGE);
    }
    if (!response.ok) {
      throw new BadRequestException(UNREACHABLE_MESSAGE);
    }

    const body = await response.text();
    return body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS) : body;
  }

  private extractRecipeNode(html: string): Record<string, unknown> | null {
    const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = scriptRe.exec(html))) {
      try {
        const json = JSON.parse(match[1].trim());
        const node = findRecipeNode(json);
        if (node) return node;
      } catch {
        this.logger.debug('Skipped a malformed JSON-LD block while importing a recipe.');
      }
    }
    return null;
  }
}
