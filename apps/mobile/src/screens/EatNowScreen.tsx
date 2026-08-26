import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'EatNow'>;

type Step = 'disclaimer' | 'search' | 'loading';

export function EatNowScreen({ navigation }: Props) {
  const { user } = useAuth();
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;

  const [step, setStep] = useState<Step>(needsGuestDisclaimer ? 'disclaimer' : 'search');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const acknowledgeDisclaimer = async () => {
    setAcknowledging(true);
    try {
      await guestSession.acknowledgeDisclaimer();
      setStep('search');
    } finally {
      setAcknowledging(false);
    }
  };

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setError(null);
    setStep('loading');
    try {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      await api.searchEatNow({ query: trimmed }, token ?? '');
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Eat Now isn't ready yet — there's no food data source connected. Check back soon.");
      } else {
        setError('Something went wrong searching for food. Please try again.');
      }
    } finally {
      setStep('search');
    }
  };

  if (step === 'disclaimer') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Before you start</Text>
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button label="I understand" onPress={acknowledgeDisclaimer} loading={acknowledging} style={styles.actionSpacing} />
      </View>
    );
  }

  if (step === 'loading') {
    return <LoadingState message="Looking for something to eat…" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Home</Text>
      </TouchableOpacity>
      <Text style={styles.title}>What are you after?</Text>
      <Text style={styles.subtitle}>Tell us what you fancy — a dish, a cuisine, anything.</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="e.g. something spicy and quick"
        placeholderTextColor={colors.textFaint}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={search}
        returnKeyType="search"
        autoComplete="off"
        autoCorrect={false}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button label="Find food" onPress={search} disabled={!query.trim()} style={styles.actionSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  searchInput: {
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
  disclaimerBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  disclaimerText: { fontSize: 14, lineHeight: 21, color: colors.text },
});
