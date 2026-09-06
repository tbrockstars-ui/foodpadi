import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
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

type Props = NativeStackScreenProps<AppStackParamList, 'Favorites'>;

/**
 * "Favourites" — one place for the recipes the user has hearted OR rated
 * 5 stars after cooking (the Favorites engine: GET /cook-today/recipes/
 * favorites, CookTodayService.listFavorites). Web counterpart: the
 * /favorites route. Read-and-manage only — the heart itself gets set from
 * Cook Today / a cooking session / Home ideas, not created here.
 */
export function FavoritesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [recipes, setRecipes] = useState<SavedRecipeView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setRecipes(await api.listFavoriteRecipes());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  // Un-heart. A recipe kept in Favorites purely by a 5-star cook rating (no
  // explicit heart) will still come back on the next load — that's correct;
  // this only clears the explicit heart.
  const unfavorite = async (id: string) => {
    setBusyId(id);
    try {
      await api.toggleRecipeFavorite(id, false);
      setRecipes((current) => current?.filter((r) => r.id !== id) ?? null);
      if (expandedId === id) setExpandedId(null);
    } catch {
      // Leave the row in place if it didn't take — a stale reload will correct it.
    } finally {
      setBusyId(null);
    }
  };

  if (recipes === null) {
    if (loadFailed) {
      return (
        <Screen>
          <ScreenHeader title="Favourites" onBack={() => navigation.goBack()} />
          <EmptyState
            title="Couldn't load your favourites"
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
    return <LoadingState message="Loading your favourites…" />;
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Favourites"
        subtitle="Recipes you've hearted, or rated 5 stars after cooking."
        onBack={() => navigation.goBack()}
      />

      {recipes.length === 0 ? (
        <Text style={styles.emptyText}>
          Nothing here yet — tap the heart on a recipe, or rate one 5 stars after you&apos;ve cooked
          it, and it&apos;ll show up here.
        </Text>
      ) : (
        recipes.map((recipe, index) => {
          const expanded = expandedId === recipe.id;
          return (
            <FadeInView key={recipe.id} delay={index * 40}>
              <Card style={styles.recipeCard}>
                <View style={styles.cardHeaderRow}>
                  <TouchableOpacity
                    style={styles.titleTap}
                    onPress={() => setExpandedId(expanded ? null : recipe.id)}
                  >
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <View style={styles.tagRow}>
                      <Tag label={`${recipe.cookTimeMinutes} min`} />
                      <Tag label={`${recipe.servings} servings`} />
                      {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => unfavorite(recipe.id)}
                    disabled={busyId === recipe.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${recipe.title} from favourites`}
                    hitSlop={8}
                    style={styles.heartBtn}
                  >
                    <Feather
                      name="heart"
                      size={20}
                      color={colors.danger}
                      style={{ opacity: busyId === recipe.id ? 0.4 : 1 }}
                    />
                  </TouchableOpacity>
                </View>

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
                      onPress={() =>
                        navigation.navigate('CookingSession', { recipe, savedRecipeId: recipe.id })
                      }
                      style={{ marginTop: spacing.md }}
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
    cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    titleTap: { flex: 1 },
    heartBtn: { paddingTop: spacing.xs, paddingLeft: spacing.xs },
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
