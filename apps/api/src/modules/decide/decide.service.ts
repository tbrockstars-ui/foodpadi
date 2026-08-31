import { Injectable } from '@nestjs/common';
import type { DecideResponse, DecisionOptionView } from '@foodpadi/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { CookTodayService } from '../cook-today/cook-today.service';
import { EatNowService } from '../eat-now/eat-now.service';
import { FoodImageService } from '../food-image/food-image.service';
import { DecideDto } from './dto/decide.dto';

// Worked example from the architecture brief: 2 cook options + 1 get option.
// Not a hard rule — filled from whichever pool has more if one comes up short.
const TARGET_COOK_COUNT = 2;
const TARGET_TOTAL = 3;

function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

/**
 * The unified decision engine's orchestration layer: given one free-text
 * description of what the user has/wants plus soft constraints, this is
 * "FoodPadi decides" (see the decision-engine architecture memory) — it
 * calls Cook Today's real recipe generation and Eat Now's real catalog
 * search in parallel and blends the results into a small set of explained
 * options, mixing "cook it" and "get it" candidates rather than making the
 * user pick a mode first. Introduces no new AI/recommendation logic of its
 * own — it's a thin blend over the two engines that already exist.
 */
@Injectable()
export class DecideService {
  constructor(
    private readonly cookToday: CookTodayService,
    private readonly eatNow: EatNowService,
    private readonly analytics: AnalyticsService,
    private readonly foodImage: FoodImageService,
  ) {}

  async decide(dto: DecideDto, actor: RequestActor): Promise<DecideResponse> {
    const [recipes, foodIdeas] = await Promise.all([
      this.cookToday
        .generate({ ingredients: [dto.description], timeConstraintMinutes: dto.timeMinutes }, actor)
        .catch(() => []),
      // resolveImages: false — images are attached below over just the final
      // blended set (~3), not every one of Eat Now's up-to-12 matches.
      this.eatNow
        .search({ query: dto.description, maxPricePence: dto.budgetPence }, actor, { resolveImages: false })
        .catch(() => []),
    ]);

    const cookOptions: DecisionOptionView[] = recipes.map((recipe, i) => ({
      id: `cook-${i}`,
      type: 'cook',
      title: recipe.title,
      reason: `Ready in ${recipe.cookTimeMinutes} min`,
      recipe,
    }));

    const getOptions: DecisionOptionView[] = foodIdeas.map((idea, i) => ({
      id: `get-${i}`,
      type: 'get',
      title: idea.title,
      reason: `~${idea.distanceMiles} mi · ${formatPence(idea.pricePenceMin)}-${formatPence(idea.pricePenceMax)}`,
      foodIdea: idea,
    }));

    // Blend toward 2 cook + 1 get, but never show fewer than 3 just because
    // one pool is thin — top up from whichever pool has more left.
    const cookCount = Math.min(TARGET_COOK_COUNT, cookOptions.length);
    const getCount = Math.min(TARGET_TOTAL - cookCount, getOptions.length);
    let options = [...cookOptions.slice(0, cookCount), ...getOptions.slice(0, getCount)];
    if (options.length < TARGET_TOTAL) {
      const remaining = TARGET_TOTAL - options.length;
      options = [...options, ...cookOptions.slice(cookCount, cookCount + remaining)];
    }
    if (options.length < TARGET_TOTAL) {
      const remaining = TARGET_TOTAL - options.length;
      options = [...options, ...getOptions.slice(getCount, getCount + remaining)];
    }

    // Attach a representative photo to each shown option so "what should I
    // eat" is a visual decision, not a wall of text (visual-redesign brief).
    // Runs only over the final ~3, is cached, and never blocks the answer —
    // an image that can't be found just stays null and the card shows a
    // placeholder.
    const images = await this.foodImage.resolveMany(
      options.map((o) => ({ name: o.title, cuisine: o.recipe?.cuisine ?? o.foodIdea?.cuisine ?? undefined })),
    );
    const optionsWithImages = options.map((o) => ({ ...o, image: images.get(o.title) ?? null }));

    await this.analytics.track('decide_options_generated', actorToAnalyticsFields(actor), {
      optionCount: optionsWithImages.length,
      cookCount: optionsWithImages.filter((o) => o.type === 'cook').length,
      getCount: optionsWithImages.filter((o) => o.type === 'get').length,
      withImage: optionsWithImages.filter((o) => o.image).length,
    });

    return { options: optionsWithImages };
  }
}
