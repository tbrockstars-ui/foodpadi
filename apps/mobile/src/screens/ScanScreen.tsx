import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanImageMediaType, ScannedItemView } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Scan'>;

type Step = 'intro' | 'loading' | 'review' | 'saving' | 'done';

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

export function ScanScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [items, setItems] = useState<ScannedItemView[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const analyze = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      setError('Could not read that photo. Please try again.');
      return;
    }
    setError(null);
    setStep('loading');
    try {
      const found = await api.scanPhoto({ imageBase64: asset.base64, mediaType: guessMediaType(asset) });
      setItems(found);
      setExcluded(new Set());
      setStep(found.length === 0 ? 'intro' : 'review');
      if (found.length === 0) {
        setError("Couldn't identify any food in that photo. Try a clearer, closer shot.");
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
      await analyze(result.assets[0]);
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
      await analyze(result.assets[0]);
    }
  };

  const toggleExcluded = (index: number) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const confirmAdd = async () => {
    const confirmed = items
      .filter((_, index) => !excluded.has(index))
      .map((item) => ({ name: item.name, quantity: item.quantity ?? undefined, unit: item.unit ?? undefined }));
    if (confirmed.length === 0) return;
    setStep('saving');
    try {
      const result = await api.addPantryItems({ items: confirmed });
      setAddedCount(result.added);
      setStep('done');
    } catch {
      setError('Something went wrong saving those items. Please try again.');
      setStep('review');
    }
  };

  const startOver = () => {
    setItems([]);
    setExcluded(new Set());
    setError(null);
    setStep('intro');
  };

  if (step === 'loading') {
    return <LoadingState message="Looking at your photo…" />;
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
        <Button label="Scan another photo" onPress={startOver} style={styles.actionSpacing} />
        <Button label="Back to Home" variant="secondary" onPress={() => navigation.goBack()} style={styles.actionSpacing} />
      </View>
    );
  }

  if (step === 'review') {
    const confirmedCount = items.length - excluded.size;
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <TouchableOpacity onPress={startOver} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Scan a different photo</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Is this right?</Text>
        <Text style={styles.subtitle}>Untick anything that's wrong before adding it to your pantry.</Text>

        {items.map((item, index) => {
          const isExcluded = excluded.has(index);
          return (
            <Card key={index} onPress={() => toggleExcluded(index)} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={[styles.checkbox, !isExcluded && styles.checkboxChecked]}>
                  {!isExcluded ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.itemText, isExcluded && styles.itemTextExcluded]}>
                  {[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}
                </Text>
              </View>
            </Card>
          );
        })}

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
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Home</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Scan your food</Text>
      <Text style={styles.subtitle}>
        Take or choose a photo of your fridge, cupboard, or shopping — we'll suggest what to add to your
        pantry. You'll review the list before anything is saved.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {Platform.OS !== 'web' ? (
        <Button label="Take a photo" onPress={takePhoto} style={styles.actionSpacing} />
      ) : null}
      <Button label="Choose a photo" variant="secondary" onPress={choosePhoto} style={styles.actionSpacing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  errorText: { color: colors.danger, marginBottom: spacing.lg, fontSize: 14 },
  actionSpacing: { marginTop: spacing.lg },
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
  itemText: { ...typography.body, color: colors.text, flex: 1 },
  itemTextExcluded: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
