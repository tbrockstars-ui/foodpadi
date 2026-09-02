import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AvoidedIngredientItem, DISCLAIMER_TEXT, FoodGoalItem, FoodPreferenceItem, UserSummary } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DisclaimerBanner } from '../components/DisclaimerBanner';
import { LoadingState } from '../components/LoadingState';
import { GOAL_LABELS } from '../constants/goalLabels';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [preferences, setPreferences] = useState<FoodPreferenceItem[]>([]);
  const [goals, setGoals] = useState<FoodGoalItem[]>([]);
  const [avoided, setAvoided] = useState<AvoidedIngredientItem[]>([]);
  const [newCuisine, setNewCuisine] = useState('');
  const [newAvoided, setNewAvoided] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [exportedData, setExportedData] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Settings' "Foods to avoid" shortcut lands here with scrollTo: 'avoided'
  // — scroll to that Card once content has laid out, rather than dropping
  // the user at the top of a long profile scroll view. avoidedSectionY is
  // filled in by the heading's onLayout below; pendingScroll covers the
  // (common) case where that layout hasn't happened yet when this runs.
  const scrollRef = useRef<ScrollView>(null);
  const avoidedSectionY = useRef(0);
  const pendingScroll = useRef(false);

  // useFocusEffect rather than a mount-only effect: native-stack can reuse
  // an already-mounted Profile instance instead of pushing a fresh one when
  // Settings navigates here a second time, so a plain mount effect would
  // silently miss that case.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.scrollTo !== 'avoided') return;
      if (avoidedSectionY.current > 0) {
        scrollRef.current?.scrollTo({ y: avoidedSectionY.current - spacing.lg, animated: true });
      } else {
        pendingScroll.current = true;
      }
    }, [route.params?.scrollTo]),
  );

  const load = async () => {
    const [me, prefs, avoidedItems, goalsResponse] = await Promise.all([
      api.me(),
      api.listPreferences(),
      api.listAvoidedIngredients(),
      api.getGoals(),
    ]);
    setProfile(me);
    setPreferences(prefs);
    setAvoided(avoidedItems);
    setGoals(goalsResponse.goals);
    setLoading(false);
  };

  // useFocusEffect (not a mount-only useEffect) because native-stack keeps
  // Profile mounted underneath EditGoals — coming back via goBack() needs to
  // re-fetch, not just the very first visit.
  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const addCuisine = async () => {
    const trimmed = newCuisine.trim();
    if (!trimmed) return;
    await api.addPreference({ cuisine: trimmed });
    setNewCuisine('');
    load();
  };

  const removePreference = async (id: string) => {
    await api.deletePreference(id);
    setPreferences((current) => current.filter((p) => p.id !== id));
  };

  const addAvoided = async () => {
    const trimmed = newAvoided.trim();
    if (!trimmed) return;
    await api.addAvoidedIngredient(trimmed);
    setNewAvoided('');
    load();
  };

  const removeAvoided = async (id: string) => {
    await api.deleteAvoidedIngredient(id);
    setAvoided((current) => current.filter((a) => a.id !== id));
  };

  const exportMyData = async () => {
    const data = await api.exportData();
    setExportedData(JSON.stringify(data, null, 2));
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !profile) {
    return <LoadingState message="Loading your profile…" />;
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Home" onPress={() => navigation.goBack()} />

      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{profile.email}</Text>

      <Text style={styles.sectionHeading}>Recipes & plans</Text>
      <Card style={styles.section}>
        <Button label="View saved recipes" variant="secondary" onPress={() => navigation.navigate('SavedRecipes')} />
        <Button
          label="View saved plans"
          variant="secondary"
          onPress={() => navigation.navigate('SavedPlans')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Text style={styles.sectionHeading}>Invite a friend</Text>
      <Card style={styles.section}>
        <Text style={styles.emptyText}>
          Know someone who never knows what to eat? Send them FoodPadi and track who joins.
        </Text>
        <Button
          label="Invite friends"
          variant="secondary"
          onPress={() => navigation.navigate('Invite')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Text style={styles.sectionHeading}>Food & lifestyle goals</Text>
      <Card style={styles.section}>
        {goals.length === 0 ? (
          <Text style={styles.emptyText}>No goals set yet.</Text>
        ) : (
          <View style={styles.tagList}>
            {goals.map((goal) => (
              <View key={goal.goalType} style={styles.removableTag}>
                <Text style={styles.removableTagText}>
                  {GOAL_LABELS[goal.goalType]}
                  {goal.isPrimary && goals.length > 1 ? ' ★' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Button label="Edit goals" variant="secondary" onPress={() => navigation.navigate('EditGoals')} />
      </Card>

      <Text style={styles.sectionHeading}>Favourite cuisines</Text>
      <Card style={styles.section}>
        <View style={styles.tagList}>
          {preferences.length === 0 ? (
            <Text style={styles.emptyText}>Nothing added yet.</Text>
          ) : (
            preferences.map((pref) => (
              <View key={pref.id} style={styles.removableTag}>
                <Text style={styles.removableTagText}>{pref.cuisine ?? pref.likedMeal ?? 'Preference'}</Text>
                <TouchableOpacity onPress={() => removePreference(pref.id)} accessibilityLabel="Remove">
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a cuisine you love"
            placeholderTextColor={colors.textFaint}
            value={newCuisine}
            onChangeText={setNewCuisine}
            onSubmitEditing={addCuisine}
            returnKeyType="done"
            autoComplete="off"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={addCuisine}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Text
        style={styles.sectionHeading}
        onLayout={(e) => {
          avoidedSectionY.current = e.nativeEvent.layout.y;
          if (pendingScroll.current) {
            pendingScroll.current = false;
            scrollRef.current?.scrollTo({ y: avoidedSectionY.current - spacing.lg, animated: true });
          }
        }}
      >
        Foods I choose to avoid
      </Text>
      <Card style={styles.section}>
        <View style={styles.tagList}>
          {avoided.length === 0 ? (
            <Text style={styles.emptyText}>Nothing added yet.</Text>
          ) : (
            avoided.map((item) => (
              <View key={item.id} style={styles.removableTag}>
                <Text style={styles.removableTagText}>{item.ingredientName}</Text>
                <TouchableOpacity onPress={() => removeAvoided(item.id)} accessibilityLabel="Remove">
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a food to avoid"
            placeholderTextColor={colors.textFaint}
            value={newAvoided}
            onChangeText={setNewAvoided}
            onSubmitEditing={addAvoided}
            returnKeyType="done"
            autoComplete="off"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={addAvoided}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Text style={styles.sectionHeading}>Privacy</Text>
      <Card style={styles.section}>
        <Button label="Export my data" variant="secondary" onPress={exportMyData} />
        {exportedData ? (
          <ScrollView style={styles.exportBox} nestedScrollEnabled>
            <Text style={styles.exportText}>{exportedData}</Text>
          </ScrollView>
        ) : null}

        <View style={{ height: spacing.md }} />

        {!confirmingDelete ? (
          <Button label="Delete my account" variant="danger" onPress={() => setConfirmingDelete(true)} />
        ) : (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              This permanently deletes your account and everything FoodPadi has stored about you.
              This can't be undone.
            </Text>
            <View style={styles.confirmRow}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setConfirmingDelete(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Delete permanently"
                variant="danger"
                onPress={deleteAccount}
                loading={deleting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </Card>

      <Text style={styles.sectionHeading}>Food & safety information</Text>
      <Card style={styles.section}>
        {showDisclaimer ? (
          <Text style={styles.disclaimerFull}>{DISCLAIMER_TEXT}</Text>
        ) : (
          <DisclaimerBanner onReadMore={() => setShowDisclaimer(true)} />
        )}
      </Card>

      <Button label="Log out" variant="secondary" onPress={logout} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
  title: { ...typography.display, color: c.text },
  email: { ...typography.body, color: c.textMuted, marginBottom: spacing.xl },
  sectionHeading: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm, marginTop: spacing.lg },
  section: { marginBottom: spacing.sm },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  emptyText: { ...typography.caption, color: c.textFaint },
  removableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  removableTagText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  removeIcon: { color: c.primary, fontSize: 13, marginLeft: 4 },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.text,
  },
  addButton: {
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: c.text, fontWeight: '600' },
  exportBox: {
    maxHeight: 220,
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  exportText: { fontSize: 11, color: c.textMuted, fontFamily: 'monospace' },
  confirmBox: { backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: spacing.md },
  confirmText: { ...typography.caption, color: c.danger, marginBottom: spacing.md, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  disclaimerFull: { fontSize: 13, lineHeight: 20, color: c.text },
  });
}
