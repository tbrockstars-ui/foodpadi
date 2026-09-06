import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/colors';
import { HomeScreen } from '../screens/HomeScreen';
import { CookTodayScreen } from '../screens/CookTodayScreen';
import { PlanAheadScreen } from '../screens/PlanAheadScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Filled on the active tab, outline otherwise — the "active = filled + bold"
// treatment from the reference settings screen. One icon family, sized to
// match, so the bar reads as one system.
const ICONS: Record<keyof MainTabParamList, { active: IconName; inactive: IconName }> = {
  Home: { active: 'home-variant', inactive: 'home-variant-outline' },
  Cook: { active: 'pot-steam', inactive: 'pot-steam-outline' },
  Plan: { active: 'calendar-blank', inactive: 'calendar-blank-outline' },
  Profile: { active: 'account', inactive: 'account-outline' },
};

const TAB_LABEL: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Cook: 'Cook',
  Plan: 'Plan',
  Profile: 'Profile',
};

/**
 * The four primary destinations. Home stays the intent-first entry point
 * (Decide is its hero); Cook and Plan are the same shortcuts that used to
 * sit in a text row on Home. Secondary destinations (Shopping List, Saved,
 * Invite, Settings, Subscription, Scan, …) are reached contextually and
 * push over this bar as root-stack screens.
 */
export function MainTabs({ onRequestLogin }: { onRequestLogin: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...typography.label, letterSpacing: 0.2, marginTop: 2 },
        tabBarLabel: TAB_LABEL[route.name],
        tabBarIcon: ({ focused, color, size }) => (
          <MaterialCommunityIcons
            name={focused ? ICONS[route.name].active : ICONS[route.name].inactive}
            size={size ?? 24}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home">
        {(props) => <HomeScreen {...props} onRequestLogin={onRequestLogin} />}
      </Tab.Screen>
      <Tab.Screen name="Cook">
        {(props) => <CookTodayScreen {...props} onRequestLogin={onRequestLogin} />}
      </Tab.Screen>
      <Tab.Screen name="Plan">
        {(props) => <PlanAheadScreen {...props} onRequestLogin={onRequestLogin} />}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} onRequestLogin={onRequestLogin} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
