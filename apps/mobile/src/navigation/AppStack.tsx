import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { EatNowScreen } from '../screens/EatNowScreen';
import { CookTodayScreen } from '../screens/CookTodayScreen';
import { PlanAheadScreen } from '../screens/PlanAheadScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditGoalsScreen } from '../screens/EditGoalsScreen';
import { ImportRecipeScreen } from '../screens/ImportRecipeScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SavedRecipesScreen } from '../screens/SavedRecipesScreen';
import { SavedPlansScreen } from '../screens/SavedPlansScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type AppStackParamList = {
  Home: undefined;
  EatNow: { initialQuery?: string; initialMaxPricePence?: number; whyLabel?: string } | undefined;
  CookToday: { initialIngredients?: string[] } | undefined;
  PlanAhead: undefined;
  ShoppingList: { listId: string };
  Profile: undefined;
  EditGoals: undefined;
  ImportRecipe: undefined;
  Scan: undefined;
  SavedRecipes: undefined;
  SavedPlans: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * The real navigation stack for post-onboarding/guest screens — RootNavigator
 * previously noted this would arrive once a first real feature landed (Cook
 * Today, Phase 2). Available to both signed-in users and guests; each screen
 * decides for itself what a guest can/can't do.
 */
export function AppStack({ onRequestLogin }: { onRequestLogin: () => void }) {
  const { scheme, colors } = useTheme();
  // Themes the navigator's own chrome (card background between screens, etc.)
  // so a dark-mode user doesn't get white flashes on transitions.
  const navTheme =
    scheme === 'dark'
      ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } }
      : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="Home">
          {(props) => <HomeScreen {...props} onRequestLogin={onRequestLogin} />}
        </Stack.Screen>
        <Stack.Screen name="EatNow" component={EatNowScreen} />
        <Stack.Screen name="CookToday">
          {(props) => <CookTodayScreen {...props} onRequestLogin={onRequestLogin} />}
        </Stack.Screen>
        <Stack.Screen name="PlanAhead" component={PlanAheadScreen} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditGoals" component={EditGoalsScreen} />
        <Stack.Screen name="ImportRecipe" component={ImportRecipeScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="SavedRecipes" component={SavedRecipesScreen} />
        <Stack.Screen name="SavedPlans" component={SavedPlansScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
