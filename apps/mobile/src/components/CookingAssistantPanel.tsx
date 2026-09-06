import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { CheckCookingStepResponse, RecipeView, ScanImageMediaType } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { spacing, radius, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const MEDIA_TYPE_BY_EXTENSION: Record<string, ScanImageMediaType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function guessMediaType(asset: ImagePicker.ImagePickerAsset): ScanImageMediaType {
  if (asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/png' || asset.mimeType === 'image/webp') {
    return asset.mimeType;
  }
  const extension = asset.uri.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_TYPE_BY_EXTENSION[extension] ?? 'image/jpeg';
}

interface Props {
  recipe: RecipeView;
  stepIndex: number;
}

/**
 * The "Kitchen Copilot" extras inside a guided-cooking step: a photo-based
 * "Is this ready?" vision check and a typed "Ask FoodPadi" question. Web
 * counterpart also has hands-free voice control via the Web Speech API —
 * there's no equivalent built into React Native, and adding one would mean a
 * new native dependency this environment can't build/test on a device, so
 * that's deliberately left out here (typed Q&A covers the same use case).
 * Only rendered for a signed-in cook (see CookingSessionScreen.tsx) — both
 * endpoints are member-only, same posture as Scan.
 */
export function CookingAssistantPanel({ recipe, stepIndex }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const stepText = recipe.steps[stepIndex];

  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckCookingStepResponse | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Reset the per-step result so a stale answer from the previous step never
  // lingers on the new one.
  useEffect(() => {
    setCheckResult(null);
    setCheckError(null);
    setAnswer(null);
    setAskError(null);
  }, [stepIndex]);

  const checkStep = async () => {
    if (Platform.OS === 'web') return; // camera launcher isn't available on Expo web
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access so FoodPadi can take a look.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return;

    setCheckError(null);
    setCheckResult(null);
    setChecking(true);
    try {
      const asset = result.assets[0];
      const response = await api.checkCookingStep({
        imageBase64: asset.base64!,
        mediaType: guessMediaType(asset),
        recipeTitle: recipe.title,
        stepText,
      });
      setCheckResult(response);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setCheckError('Sign in again to keep using FoodPadi’s cooking assistant.');
      } else if (e instanceof ApiError && e.status === 503) {
        setCheckError("FoodPadi can't check photos right now. Check back soon.");
      } else {
        setCheckError("Couldn't check that photo. Please try again.");
      }
    } finally {
      setChecking(false);
    }
  };

  const askQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setAskError(null);
    setAnswer(null);
    setAsking(true);
    try {
      const response = await api.askCookingQuestion({
        recipeTitle: recipe.title,
        ingredients: recipe.ingredients.map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' ')),
        steps: recipe.steps,
        currentStepIndex: stepIndex,
        question: trimmed,
      });
      setAnswer(response.answer);
      setQuestion('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAskError('Sign in again to keep using FoodPadi’s cooking assistant.');
      } else if (e instanceof ApiError && e.status === 503) {
        setAskError("FoodPadi can't answer questions right now. Check back soon.");
      } else {
        setAskError("FoodPadi couldn't answer that just now.");
      }
    } finally {
      setAsking(false);
    }
  };

  if (!expanded) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity style={styles.photoButton} onPress={() => setExpanded(true)}>
          <Text style={styles.photoButtonText}>Need a hand with this step?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.photoButton} onPress={() => setExpanded(false)}>
        <Text style={styles.photoButtonText}>Hide assistant</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.photoButton} onPress={checkStep} disabled={checking}>
        <Text style={styles.photoButtonText}>{checking ? 'Checking…' : '📷 Is this ready?'}</Text>
      </TouchableOpacity>
      {checkError ? <Text style={styles.errorText}>{checkError}</Text> : null}
      {checkResult ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>{checkResult.observation}</Text>
          <Text style={styles.resultText}>{checkResult.suggestion}</Text>
          <Text style={styles.safetyText}>{checkResult.safetyNote}</Text>
        </View>
      ) : null}

      <View style={styles.askRow}>
        <TextInput
          style={styles.askInput}
          placeholder="Ask FoodPadi about this step…"
          placeholderTextColor={colors.textFaint}
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={askQuestion}
          editable={!asking}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.askButton} onPress={askQuestion} disabled={asking || !question.trim()}>
          <Text style={styles.askButtonText}>{asking ? '…' : 'Ask'}</Text>
        </TouchableOpacity>
      </View>
      {askError ? <Text style={styles.errorText}>{askError}</Text> : null}
      {answer ? <Text style={styles.answerText}>{answer}</Text> : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
    photoButton: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    photoButtonText: { fontSize: 15, fontWeight: '600', color: c.text },
    resultCard: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    resultText: { ...typography.body, color: c.text, marginBottom: spacing.xs },
    safetyText: { ...typography.caption, color: c.textFaint, marginTop: spacing.xs, lineHeight: 18 },
    askRow: { flexDirection: 'row', gap: spacing.sm },
    askInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.text,
    },
    askButton: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    askButtonText: { color: c.text, fontWeight: '600' },
    errorText: { color: c.danger, marginTop: spacing.sm, fontSize: 13 },
    answerText: {
      ...typography.body,
      color: c.text,
      backgroundColor: c.primarySoft,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginTop: spacing.md,
      lineHeight: 20,
    },
  });
}
