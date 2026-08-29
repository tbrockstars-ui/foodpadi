import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SavedRecipeView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'SavedRecipes'>;

/**
 * Cook Today's save button (and recipe-import) have written to
 * `GET /cook-today/recipes` since Phase 2, but nothing ever read it back —
 * this is that missing viewer.
 */
export function SavedRecipesScreen({ navigation }: Props) {
  const [recipes, setRecipes] = useState<SavedRecipeView[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const list = await api.listSavedRecipes();
    setRecipes(list);
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
    return <LoadingState message="Loading your saved recipes…" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Saved recipes</Text>

      {recipes.length === 0 ? (
        <Text style={styles.emptyText}>
          Nothing saved yet — save a recipe from Cook Today or Import a recipe to see it here.
        </Text>
      ) : (
        recipes.map((recipe) => {
          const expanded = expandedId === recipe.id;
          return (
            <Card key={recipe.id} style={styles.recipeCard}>
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
                    label={deletingId === recipe.id ? 'Removing…' : 'Remove from saved'}
                    variant="danger"
                    onPress={() => removeRecipe(recipe.id)}
                    loading={deletingId === recipe.id}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.lg },
  emptyText: { ...typography.body, color: colors.textMuted },
  recipeCard: { marginBottom: spacing.md },
  recipeTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detail: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  sectionHeading: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  ingredientLine: { ...typography.body, color: colors.text, marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepNumber: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 20 },
});
