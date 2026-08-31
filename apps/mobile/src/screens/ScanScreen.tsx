import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DemoScenarioKey, FoodContentIngredientView, ScanImageMediaType, ScannedItemView } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { colors, radius, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Scan'>;

// Two distinct things Scan can do (picked on the intro screen):
//  - 'pantry': what's already existed — a fridge/cupboard/shopping photo ->
//    multiple candidate grocery items -> reviewed -> saved to your pantry.
//  - 'dish': new — a photo of one prepared dish -> its likely ingredient
//    composition, read-only, nothing saved. Lets a customer see roughly
//    what's combined in a dish before eating it.
type Mode = 'pantry' | 'dish';
type Step = 'intro' | 'loading' | 'review' | 'saving' | 'done' | 'dish-result';

const SAMPLE_KITCHENS: { key: DemoScenarioKey; label: string }[] = [
  { key: 'fridge', label: 'Sample fridge' },
  { key: 'cupboard', label: 'Sample cupboard' },
  { key: 'mixed', label: 'Sample mixed kitchen' },
  { key: 'shopping', label: 'Sample shopping bag' },
];

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

// Review-list rows are plain objects, not ScannedItemView directly, so an
// item can be edited (name/quantity) without losing its place — and a
// manually-added row has no server-suggested origin at all.
interface ReviewRow {
  id: number;
  name: string;
  quantity: string | null;
  unit: string | null;
  included: boolean;
}

let nextRowId = 0;
function toRows(items: ScannedItemView[]): ReviewRow[] {
  return items.map((item) => ({ id: nextRowId++, ...item, included: true }));
}

export function ScanScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('pantry');
  const [step, setStep] = useState<Step>('intro');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [confirmedNames, setConfirmedNames] = useState<string[]>([]);
  const [dishName, setDishName] = useState('');
  const [dishIngredients, setDishIngredients] = useState<FoodContentIngredientView[]>([]);

  const handleResult = (result: { items: ScannedItemView[]; demo: boolean }) => {
    if (result.items.length === 0) {
      setError("We couldn't identify any food from this photo. Try another photo.");
      setStep('intro');
      return;
    }
    setError(null);
    setRows(toRows(result.items));
    setIsDemoResult(result.demo);
    setStep('review');
  };

  const handleDishResult = (result: { dishName: string; ingredients: FoodContentIngredientView[]; demo: boolean }) => {
    if (!result.dishName && result.ingredients.length === 0) {
      setError("We couldn't identify a dish in that photo. Try another photo.");
      setStep('intro');
      return;
    }
    setError(null);
    setDishName(result.dishName || "This dish");
    setDishIngredients(result.ingredients);
    setIsDemoResult(result.demo);
    setStep('dish-result');
  };

  const analyzePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      setError('Could not read that photo. Please try again.');
      return;
    }
    setError(null);
    setStep('loading');
    try {
      if (mode === 'dish') {
        const token = (await tokenStore.getAccessToken()) ?? '';
        const result = await api.scanFoodContent(
          { imageBase64: asset.base64, mediaType: guessMediaType(asset) },
          token,
        );
        handleDishResult(result);
      } else {
        const result = await api.scanPhoto({ imageBase64: asset.base64, mediaType: guessMediaType(asset) });
        handleResult(result);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Scan isn't ready yet — the photo analyser isn't configured. Check back soon.");
      } else {
        setError('Something went wrong analysing that photo. Please try again.');
      }
      setStep('intro');
    }
  };

  const useSampleKitchen = async (demoScenario: DemoScenarioKey) => {
    setError(null);
    setStep('loading');
    try {
      const result = await api.scanPhoto({ demoScenario });
      handleResult(result);
    } catch {
      setError('Something went wrong loading that sample. Please try again.');
      setStep('intro');
    }
  };

  const takePhoto = async () => {
    // expo-image-picker's camera launcher isn't available on web — the
    // library picker below still works there (a plain file input), so this
    // just quietly does nothing rather than showing a broken button on web.
    if (Platform.OS === 'web') return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to scan food, or choose a photo instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      await analyzePhoto(result.assets[0]);
    }
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to scan food.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      await analyzePhoto(result.assets[0]);
    }
  };

  const toggleIncluded = (id: number) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, included: !row.included } : row)));
  };

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const editRowName = (id: number, name: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, name } : row)));
  };

  const addManualItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    setRows((current) => [...current, { id: nextRowId++, name: trimmed, quantity: null, unit: null, included: true }]);
    setNewItemName('');
  };

  const confirmAdd = async () => {
    const confirmed = rows.filter((row) => row.included && row.name.trim());
    if (confirmed.length === 0) return;
    setStep('saving');
    try {
      const result = await api.addPantryItems({
        items: confirmed.map((row) => ({
          name: row.name.trim(),
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
        })),
      });
      setAddedCount(result.added);
      setConfirmedNames(confirmed.map((row) => row.name.trim()));
      setStep('done');
    } catch {
      setError('Something went wrong saving those items. Please try again.');
      setStep('review');
    }
  };

  const startOver = () => {
    setRows([]);
    setDishName('');
    setDishIngredients([]);
    setError(null);
    setIsDemoResult(false);
    setStep('intro');
  };

  if (step === 'loading') {
    return <LoadingState message={mode === 'dish' ? 'Looking at your dish…' : 'Looking at your photo…'} />;
  }

  if (step === 'saving') {
    return <LoadingState message="Adding to your pantry…" />;
  }

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Added to your pantry</Text>
        <Text style={styles.subtitle}>
          {addedCount} item{addedCount === 1 ? '' : 's'} added.
        </Text>
        <Button
          label="Cook with what's in your pantry"
          onPress={() => navigation.navigate('CookToday', { initialIngredients: confirmedNames })}
          style={styles.actionSpacing}
        />
        <Button label="Scan another photo" variant="secondary" onPress={startOver} style={styles.actionSpacing} />
        <Button label="Back to Home" variant="secondary" onPress={() => navigation.goBack()} style={styles.actionSpacing} />
      </View>
    );
  }

  if (step === 'dish-result') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BackLink label="Scan a different photo" onPress={startOver} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>{dishName}</Text>
          {isDemoResult ? <Tag label="Demo mode" tone="neutral" /> : null}
        </View>
        <Text style={styles.subtitle}>Here's the likely combination of what's in this dish.</Text>
        <Text style={styles.dishDisclaimer}>
          Estimated from how the dish typically looks and is made — not a verified ingredient list. If you
          have an allergy or a medical condition, check with whoever made or sold the food before eating.
        </Text>

        {dishIngredients.length === 0 ? (
          <Text style={styles.subtitle}>No specific ingredients identified.</Text>
        ) : (
          dishIngredients.map((ingredient, i) => (
            <Card key={i} style={styles.itemCard}>
              <Text style={styles.ingredientName}>{ingredient.name}</Text>
              {ingredient.note ? <Text style={styles.ingredientNote}>{ingredient.note}</Text> : null}
            </Card>
          ))
        )}

        <Button
          label="Find recipes with these ingredients"
          onPress={() =>
            navigation.navigate('CookToday', { initialIngredients: dishIngredients.map((i) => i.name) })
          }
          style={styles.actionSpacing}
        />
        <Button label="Scan another dish" variant="secondary" onPress={startOver} style={styles.actionSpacing} />
        <Button
          label="Back to Home"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.actionSpacing}
        />
      </ScrollView>
    );
  }

  if (step === 'review') {
    const confirmedCount = rows.filter((row) => row.included).length;
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BackLink label="Scan a different photo" onPress={startOver} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>We found these foods</Text>
          {isDemoResult ? <Tag label="Demo mode" tone="neutral" /> : null}
        </View>
        <Text style={styles.subtitle}>Review the suggestions before adding them to your pantry.</Text>

        {rows.map((row) => (
          <Card key={row.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <TouchableOpacity
                onPress={() => toggleIncluded(row.id)}
                style={[styles.checkbox, row.included && styles.checkboxChecked]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.included }}
              >
                {row.included ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
              <TextInput
                style={[styles.itemInput, !row.included && styles.itemInputExcluded]}
                value={[row.quantity, row.unit, row.name].filter(Boolean).join(' ')}
                onChangeText={(text) => editRowName(row.id, text)}
                editable={row.included}
              />
              <TouchableOpacity onPress={() => removeRow(row.id)} accessibilityLabel="Remove item">
                <Text style={styles.removeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add another item"
            placeholderTextColor={colors.textFaint}
            value={newItemName}
            onChangeText={setNewItemName}
            onSubmitEditing={addManualItem}
            returnKeyType="done"
            autoComplete="off"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={addManualItem}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <Button
          label={`Add ${confirmedCount} item${confirmedCount === 1 ? '' : 's'} to pantry`}
          onPress={confirmAdd}
          disabled={confirmedCount === 0}
          style={styles.actionSpacing}
        />
      </ScrollView>
    );
  }

  // step === 'intro'
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Home" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Scan your food</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'pantry' && styles.modeTabSelected]}
          onPress={() => {
            setMode('pantry');
            setError(null);
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.modeTabText, mode === 'pantry' && styles.modeTabTextSelected]}>My kitchen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'dish' && styles.modeTabSelected]}
          onPress={() => {
            setMode('dish');
            setError(null);
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.modeTabText, mode === 'dish' && styles.modeTabTextSelected]}>A dish</Text>
        </TouchableOpacity>
      </View>

      {mode === 'pantry' ? (
        <Text style={styles.subtitle}>
          Take or choose a photo of your fridge, cupboard, or shopping — we'll suggest what to add to your
          pantry. You'll review the list before anything is saved.
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          Take or choose a photo of a prepared dish — we'll identify it and list its likely ingredients, so
          you can see the possible combination of what's in it.
        </Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {Platform.OS !== 'web' ? (
        <Button label="Take a photo" onPress={takePhoto} style={styles.actionSpacing} />
      ) : null}
      <Button label="Choose a photo" variant="secondary" onPress={choosePhoto} style={styles.actionSpacing} />

      {mode === 'pantry' ? (
        <>
          <Text style={styles.sampleHeading}>Don't have a photo?</Text>
          <View style={styles.sampleWrap}>
            {SAMPLE_KITCHENS.map((sample) => (
              <TouchableOpacity key={sample.key} onPress={() => useSampleKitchen(sample.key)} style={styles.sampleChip}>
                <Text style={styles.sampleChipText}>{sample.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.display, color: colors.text },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 10,
  },
  modeTabSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeTabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  modeTabTextSelected: { color: colors.primary },
  dishDisclaimer: { ...typography.caption, color: colors.textFaint, marginBottom: spacing.lg, lineHeight: 18 },
  ingredientName: { fontSize: 16, fontWeight: '600', color: colors.text },
  ingredientNote: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  errorText: { color: colors.danger, marginBottom: spacing.lg, fontSize: 14 },
  actionSpacing: { marginTop: spacing.lg },
  sampleHeading: { ...typography.label, color: colors.textFaint, marginTop: spacing.xl, marginBottom: spacing.sm },
  sampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sampleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  sampleChipText: { fontSize: 13, color: colors.textMuted },
  itemCard: { marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.primaryText, fontSize: 13, fontWeight: '700' },
  itemInput: { ...typography.body, color: colors.text, flex: 1, padding: 0 },
  itemInputExcluded: { color: colors.textFaint, textDecorationLine: 'line-through' },
  removeIcon: { color: colors.textFaint, fontSize: 14, paddingHorizontal: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: colors.text, fontWeight: '600' },
});
