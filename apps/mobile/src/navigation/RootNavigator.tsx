import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { AuthFlow } from './AuthFlow';
import { DisclaimerScreen } from '../screens/DisclaimerScreen';
import { OnboardingFlow } from './OnboardingFlow';
import { AppStack } from './AppStack';
import { colors } from '../theme/colors';

/**
 * A simple state-driven switch rather than a stack navigator with named
 * routes for the pre-Home flows — onboarding here is a strict linear
 * sequence (disclaimer must be acknowledged before a goal can be set, per
 * the API's own enforcement in UsersService.completeOnboarding), so there's
 * nothing to "navigate back" to mid-onboarding. Post-onboarding/guest
 * screens (Home, Cook Today, ...) get a real @react-navigation stack — see
 * AppStack — now that a first real feature (Cook Today) exists.
 *
 * Guests (docs/FOODPADI_ONBOARDING_SPEC.md): Eat Now/Cook Today don't need
 * an account, so a returning guest session skips straight to AppStack
 * instead of the auth wall. Tapping "Log in" from within AppStack sets
 * wantsToLogIn, which — because it's evaluated before the guest-session
 * check below — takes over the screen without discarding the guest session;
 * "Continue as guest" on the resulting AuthScreen clears it again.
 */
export function RootNavigator() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const { isLoading: guestLoading, hasGuestSession, ensureSession } = useGuestSession();
  const [wantsToLogIn, setWantsToLogIn] = useState(false);

  if (authLoading || guestLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    if (hasGuestSession && !wantsToLogIn) {
      return <AppStack onRequestLogin={() => setWantsToLogIn(true)} />;
    }
    return (
      <AuthFlow
        onContinueAsGuest={async () => {
          await ensureSession();
          setWantsToLogIn(false);
        }}
      />
    );
  }

  if (!user.disclaimerAcknowledgedAt) {
    return <DisclaimerScreen onAcknowledged={refreshUser} />;
  }

  if (!user.onboardingCompletedAt) {
    return <OnboardingFlow onComplete={refreshUser} />;
  }

  return <AppStack onRequestLogin={() => {}} />;
}
