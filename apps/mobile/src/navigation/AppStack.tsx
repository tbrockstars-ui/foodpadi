import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { MainTabs } from './MainTabs';
import { EatNowScreen } from '../screens/EatNowScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { InviteScreen } from '../screens/InviteScreen';
import { EditGoalsScreen } from '../screens/EditGoalsScreen';
import { CuisinesScreen } from '../screens/CuisinesScreen';
import { ImportRecipeScreen } from '../screens/ImportRecipeScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SavedRecipesScreen } from '../screens/SavedRecipesScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { CookingSessionScreen } from '../screens/CookingSessionScreen';
import { SavedPlansScreen } from '../screens/SavedPlansScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import type { AppStackParamList } from './types';

// Re-exported so the many `import type { AppStackParamList } from
// '../navigation/AppStack'` call sites keep working after the param lists
// moved to ./types.
export type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * The root navigation stack. `Main` is the 4-tab bottom navigator; every
 * other screen is a leaf that pushes over the tab bar. Available to both
 * signed-in users and guests; each screen decides for itself what a guest
 * can/can't do.
 */
export function AppStack({ onRequestLogin }: { onRequestLogin: () => void }) {
  const { scheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Themes the navigator's own chrome (card background between screens, etc.)
  // so a dark-mode user doesn't get white flashes on transitions.
  const navTheme =
    scheme === 'dark'
      ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } }
      : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <NavigationContainer theme={navTheme}>
      {/* Leaf screens get `paddingBottom: insets.bottom` so their pinned
          action rows clear the Android gesture bar (Expo SDK 54 is
          edge-to-edge with no opt-out). `Main` overrides this to nothing —
          the tab navigator manages its own bottom inset, and an extra pad
          there would leave a dead strip under the tab bar. */}
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background, paddingBottom: insets.bottom },
        }}
      >
        <Stack.Screen
          name="Main"
          options={{ contentStyle: { backgroundColor: colors.background } }}
        >
          {() => <MainTabs onRequestLogin={onRequestLogin} />}
        </Stack.Screen>
        <Stack.Screen name="EatNow" component={EatNowScreen} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
        <Stack.Screen name="Cuisines" component={CuisinesScreen} />
        <Stack.Screen name="Invite" component={InviteScreen} />
        <Stack.Screen name="EditGoals" component={EditGoalsScreen} />
        <Stack.Screen name="ImportRecipe" component={ImportRecipeScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="SavedRecipes" component={SavedRecipesScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="CookingSession" component={CookingSessionScreen} />
        <Stack.Screen name="SavedPlans" component={SavedPlansScreen} />
        <Stack.Screen name="Settings">
          {(props) => <SettingsScreen {...props} onRequestLogin={onRequestLogin} />}
        </Stack.Screen>
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
