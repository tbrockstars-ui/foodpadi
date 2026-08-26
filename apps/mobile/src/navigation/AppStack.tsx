import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { EatNowScreen } from '../screens/EatNowScreen';
import { CookTodayScreen } from '../screens/CookTodayScreen';
import { PlanAheadScreen } from '../screens/PlanAheadScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditGoalsScreen } from '../screens/EditGoalsScreen';
import { ImportRecipeScreen } from '../screens/ImportRecipeScreen';

export type AppStackParamList = {
  Home: undefined;
  EatNow: { initialQuery?: string; initialMaxPricePence?: number; whyLabel?: string } | undefined;
  CookToday: undefined;
  PlanAhead: undefined;
  ShoppingList: { listId: string };
  Profile: undefined;
  EditGoals: undefined;
  ImportRecipe: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * The real navigation stack for post-onboarding/guest screens — RootNavigator
 * previously noted this would arrive once a first real feature landed (Cook
 * Today, Phase 2). Available to both signed-in users and guests; each screen
 * decides for itself what a guest can/can't do.
 */
export function AppStack({ onRequestLogin }: { onRequestLogin: () => void }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
