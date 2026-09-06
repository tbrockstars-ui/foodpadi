import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SavedRecipeView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FadeInView } from '../components/motion/FadeInView';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'SavedRecipes'>;

/**
 * Cook Today's save button (and recipe-import) have written to
 * `GET /cook-today/recipes` since Phase 2, but nothing ever read it back —
 * this is that missing viewer.
 */
export function SavedRecipesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [recipes, setRecipes] = useState<SavedRecipeView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setRecipes(await api.listSavedRecipes());
      setLoadFailed(false);
    } catch {
      // Don't strand the screen on the spinner if the request fails.
      setLoadFailed(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const removeRecipe = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteSavedRecipe(id);
      setRecipes((current) => current?.filter((r) => r.id !== id) ?? null);
      if (expandedId === id) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (recipes === null) {
    if (loadFailed) {
      return (
        <Screen>
          <ScreenHeader title="Saved recipes" onBack={() => navigation.goBack()} />
          <EmptyState
            title="Couldn't load your saved recipes"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => {
              setLoadFailed(false);
              void load();
            }}
          />
        </Screen>
      );
    }
    return <LoadingState message="Loading your saved recipes…" />;
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Saved recipes" onBack={() => navigation.goBack()} />

      {recipes.length === 0 ? (
        <Text style={styles.emptyText}>
          Nothing saved yet — save a recipe from Cook Today or Import a recipe to see it here.
        </Text>
      ) : (
        recipes.map((recipe, index) => {
          const expanded = expandedId === recipe.id;
          return (
            <FadeInView key={recipe.id} delay={index * 40}>
            <Card style={styles.recipeCard}>
              <TouchableOpacity onPress={() => setExpandedId(expanded ? null : recipe.id)}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <View style={styles.tagRow}>
                  <Tag label={`${recipe.cookTimeMinutes} min`} />
                  <Tag label={`${recipe.servings} servings`} />
                  {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                </View>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.detail}>
                  <Text style={styles.sectionHeading}>Ingredients</Text>
                  {recipe.ingredients.map((ingredient, i) => (
                    <Text key={i} style={styles.ingredientLine}>
                      {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                      {ingredient.unit ? `${ingredient.unit} ` : ''}
                      {ingredient.name}
                    </Text>
                  ))}

                  <Text style={styles.sectionHeading}>Steps</Text>
                  {recipe.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.stepNumber}>{i + 1}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}

                  <Button
                    label="Start Cooking"
                    onPress={() => navigation.navigate('CookingSession', { recipe, savedRecipeId: recipe.id })}
                    style={{ marginTop: spacing.md }}
                  />
                  <Button
                    label={deletingId === recipe.id ? 'Removing…' : 'Remove from saved'}
                    variant="danger"
                    onPress={() => removeRecipe(recipe.id)}
                    loading={deletingId === recipe.id}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              ) : null}
            </Card>
            </FadeInView>
          );
        })
      )}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  emptyText: { ...typography.body, color: c.textMuted },
  recipeCard: { marginBottom: spacing.md },
  recipeTitle: { ...typography.title, color: c.text, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detail: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
  sectionHeading: { ...typography.overline, color: c.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  ingredientLine: { ...typography.body, color: c.text, marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepNumber: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primarySoft,
    color: c.primary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: { ...typography.body, color: c.text, flex: 1, lineHeight: 20 },
  });
}
