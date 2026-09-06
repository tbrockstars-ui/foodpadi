import { RawCookingStepCheck } from '../ai/claude.service';

export interface CookingStepCheckView {
  observation: string;
  suggestion: string;
  safetyNote: string;
}

// Layer 3 for the vision-check output — same non-negotiable pattern as
// scan-validation.ts: nothing the model returns reaches the client unless it
// passes these deterministic checks. ClaudeService.checkCookingStep already
// throws if any field isn't a string, so this only has to trim/guard against
// an empty safetyNote slipping through — that field is safety-critical, so a
// blank one is replaced with a generic fallback rather than shown as blank.
const FALLBACK_SAFETY_NOTE =
  'Appearance alone can be misleading — always confirm meat, poultry, fish, seafood and eggs are properly cooked through (use a food thermometer where possible), and use a timer as a backup.';

export function sanitizeCookingStepCheck(raw: RawCookingStepCheck): CookingStepCheckView {
  const observation = typeof raw.observation === 'string' ? raw.observation.trim() : '';
  const suggestion = typeof raw.suggestion === 'string' ? raw.suggestion.trim() : '';
  const safetyNote = typeof raw.safetyNote === 'string' ? raw.safetyNote.trim() : '';

  return {
    observation: observation || "Couldn't make out much from that photo — try a clearer, well-lit shot.",
    suggestion: suggestion || 'Use the recipe steps and a timer as your main guide.',
    safetyNote: safetyNote || FALLBACK_SAFETY_NOTE,
  };
}
