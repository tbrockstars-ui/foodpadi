import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { AvoidedIngredientItem, FoodPreferenceItem } from '@foodpadi/shared';
import { api } from '../api/client';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackScreenProps } from '../navigation/types';

/**
 * The cuisines + foods-to-avoid editors, lifted verbatim out of the old
 * one-long-scroll ProfileScreen (declutter pass §12: Profile becomes clean
 * grouped rows; the editors get their own focused screen). Same API calls,
 * same behaviour — avoided ingredients are still enforced everywhere by the
 * server, this is only where you manage the list.
 */
export function CuisinesScreen({ navigation }: AppStackScreenProps<'Cuisines'>) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [preferences, setPreferences] = useState<FoodPreferenceItem[]>([]);
  const [avoided, setAvoided] = useState<AvoidedIngredientItem[]>([]);
  const [newCuisine, setNewCuisine] = useState('');
  const [newAvoided, setNewAvoided] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [prefs, avoidedItems] = await Promise.all([
      api.listPreferences(),
      api.listAvoidedIngredients(),
    ]);
    setPreferences(prefs);
    setAvoided(avoidedItems);
    setLoading(false);
  };

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

  if (loading) {
    return <LoadingState message="Loading your preferences…" />;
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Cuisines & avoided foods"
        subtitle="FoodPadi leans towards what you like and keeps what you avoid out of every suggestion."
        onBack={() => navigation.goBack()}
        backLabel="Profile"
      />

      <Section title="Favourite cuisines">
        <View style={styles.tagList}>
          {preferences.length === 0 ? (
            <Text style={styles.emptyText}>Nothing added yet.</Text>
          ) : (
            preferences.map((pref) => (
              <View key={pref.id} style={styles.tag}>
                <Text style={styles.tagText}>{pref.cuisine ?? pref.likedMeal ?? 'Preference'}</Text>
                <TouchableOpacity onPress={() => removePreference(pref.id)} accessibilityLabel="Remove" hitSlop={6}>
                  <Feather name="x" size={13} color={colors.primary} />
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
      </Section>

      <Section title="Foods I choose to avoid">
        <View style={styles.tagList}>
          {avoided.length === 0 ? (
            <Text style={styles.emptyText}>Nothing added yet.</Text>
          ) : (
            avoided.map((item) => (
              <View key={item.id} style={styles.tag}>
                <Text style={styles.tagText}>{item.ingredientName}</Text>
                <TouchableOpacity onPress={() => removeAvoided(item.id)} accessibilityLabel="Remove" hitSlop={6}>
                  <Feather name="x" size={13} color={colors.primary} />
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
      </Section>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    emptyText: { ...typography.caption, color: c.textFaint },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    tagText: { color: c.primary, fontSize: 13, fontWeight: '600' },
    addRow: { flexDirection: 'row', gap: spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
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
  });
}
