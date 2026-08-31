import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeView } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'ImportRecipe'>;

type Step = 'input' | 'loading' | 'preview';

export function ImportRecipeScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [recipe, setRecipe] = useState<RecipeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const preview = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setStep('loading');
    try {
      const result = await api.importRecipe({ url: trimmed });
      setRecipe(result);
      setSaved(false);
      setStep('preview');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong importing that recipe.');
      setStep('input');
    }
  };

  const save = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      await api.saveRecipe(recipe);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'loading') {
    return <LoadingState message="Reading that page…" />;
  }

  if (step === 'preview' && recipe) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BackLink label="Try another link" onPress={() => setStep('input')} />
        <Text style={styles.title}>{recipe.title}</Text>
        <View style={styles.tagRow}>
          <Tag label={`${recipe.cookTimeMinutes} min`} />
          <Tag label={`${recipe.servings} servings`} />
          {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
        </View>

        <Text style={styles.sectionHeading}>Ingredients</Text>
        <Card style={styles.section}>
          {recipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredientLine}>
              {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
            </Text>
          ))}
        </Card>

        <Text style={styles.sectionHeading}>Steps</Text>
        <Card style={styles.section}>
          {recipe.steps.map((stepText, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{stepText}</Text>
            </View>
          ))}
        </Card>

        <Button
          label={saved ? 'Saved to your recipes' : 'Save this recipe'}
          onPress={save}
          disabled={saved}
          loading={saving}
          style={styles.actionSpacing}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Back" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Import a recipe</Text>
      <Text style={styles.subtitle}>Paste a link to a recipe page and we'll pull it in.</Text>

      <TextInput
        style={styles.urlInput}
        placeholder="https://example.com/a-recipe"
        placeholderTextColor={colors.textFaint}
        value={url}
        onChangeText={setUrl}
        onSubmitEditing={preview}
        returnKeyType="go"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        keyboardType="url"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button label="Find the recipe" onPress={preview} disabled={!url.trim()} style={styles.actionSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  urlInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  errorText: { color: colors.danger, marginTop: spacing.lg, fontSize: 14 },
  actionSpacing: { marginTop: spacing.xl },
  sectionHeading: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  section: { marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  ingredientLine: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md },
  stepNumber: {
    ...typography.label,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: { ...typography.body, color: colors.text, flex: 1 },
});
