import React, { useState } from 'react';
import { GoalScreen } from '../screens/GoalScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';

type Step = 'goal' | 'preferences';

/**
 * Post-disclaimer, pre-Home sequence. Both steps are optional/skippable
 * (docs/FOODPADI_ONBOARDING_SPEC.md) — this only controls their order, not
 * whether either is required. Same state-driven-switch pattern as AuthFlow;
 * see that file's comment for why this isn't a full navigation stack.
 */
export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('goal');

  if (step === 'preferences') {
    return <PreferencesScreen onDone={onComplete} />;
  }

  return <GoalScreen onNext={() => setStep('preferences')} />;
}
