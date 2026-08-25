import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/colors';

const PRIMARY_ACTIONS = [
  { key: 'eat-now', label: 'EAT NOW', subtitle: 'Find something to eat' },
  { key: 'cook-today', label: 'COOK TODAY', subtitle: 'Choose something to cook' },
  { key: 'plan-ahead', label: 'PLAN AHEAD', subtitle: 'Plan your meals' },
  { key: 'scan', label: 'SCAN', subtitle: 'Food, ingredients or receipt' },
] as const;

export function HomeScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What do you need today?</Text>

      <View style={styles.grid}>
        {PRIMARY_ACTIONS.map((action) => (
          <TouchableOpacity key={action.key} style={styles.actionCard} accessibilityRole="button">
            <Text style={styles.actionLabel}>{action.label}</Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.companionCard}>
        <Text style={styles.companionHeading}>Your companion</Text>
        <Text style={styles.companionBody}>
          Nothing planned yet — Eat Now, Cook Today, and Plan Ahead arrive in the next build phase.
        </Text>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  heading: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  actionCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.primary },
  actionSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  companionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
  },
  companionHeading: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  companionBody: { fontSize: 15, color: colors.text, lineHeight: 21 },
  logout: { marginTop: 'auto', alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
