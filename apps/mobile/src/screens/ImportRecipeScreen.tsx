import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeView } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { Tag } from '../components/Tag';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'ImportRecipe'>;

type Step = 'input' | 'loading' | 'preview';

export function ImportRecipeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
      <Screen scroll>
        <ScreenHeader title={recipe.title} onBack={() => setStep('input')} backLabel="Try another link" />
        <View style={styles.tagRow}>
          <Tag label={`${recipe.cookTimeMinutes} min`} />
          <Tag label={`${recipe.servings} servings`} />
          {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
        </View>

        <Section title="Ingredients">
          <Card>
            {recipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredientLine}>
                {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
              </Text>
            ))}
          </Card>
        </Section>

        <Section title="Steps">
          {recipe.steps.map((stepText, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{stepText}</Text>
            </View>
          ))}
        </Section>

        <Button
          label={saved ? 'Saved to your recipes' : 'Save this recipe'}
          onPress={save}
          disabled={saved}
          loading={saving}
          style={styles.actionSpacing}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Import a recipe"
        subtitle="Paste a link to a recipe page and we'll pull it in."
        onBack={() => navigation.goBack()}
      />

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
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  urlInput: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: c.text,
  },
  errorText: { color: c.danger, marginTop: spacing.lg, fontSize: 14 },
  actionSpacing: { marginTop: spacing.xl },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  ingredientLine: { ...typography.body, color: c.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md },
  stepNumber: {
    ...typography.label,
    color: c.primary,
    backgroundColor: c.primarySoft,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: { ...typography.body, color: c.text, flex: 1 },
  });
}
