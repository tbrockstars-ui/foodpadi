import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AuthFlow } from './AuthFlow';
import { DisclaimerScreen } from '../screens/DisclaimerScreen';
import { OnboardingFlow } from './OnboardingFlow';
import { HomeScreen } from '../screens/HomeScreen';
import { colors } from '../theme/colors';

/**
 * A simple state-driven switch rather than a stack navigator with named
 * routes — onboarding here is a strict linear sequence (disclaimer must be
 * acknowledged before a goal can be set, per the API's own enforcement in
 * UsersService.completeOnboarding), so there's nothing to "navigate back" to
 * mid-onboarding. Post-onboarding screens (Eat Now/Cook Today/Plan Ahead/
 * Scan) get a real @react-navigation stack when those phases land.
 */
export function RootNavigator() {
  const { user, isLoading, refreshUser } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return <AuthFlow />;
  }

  if (!user.disclaimerAcknowledgedAt) {
    return <DisclaimerScreen onAcknowledged={refreshUser} />;
  }

  if (!user.onboardingCompletedAt) {
    return <OnboardingFlow onComplete={refreshUser} />;
  }

  return <HomeScreen />;
}
