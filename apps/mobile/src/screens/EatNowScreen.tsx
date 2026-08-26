import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT, FoodIdeaView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Tag } from '../components/Tag';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'EatNow'>;

type Step = 'disclaimer' | 'search' | 'loading' | 'results';

const BUDGET_LABEL: Record<FoodIdeaView['budgetTier'], string> = {
  low: '£',
  medium: '££',
  high: '£££',
};

function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

// Deep-linked from the unified "What should I eat?" Home flow limits to 3
// recommendations (its whole premise is a short list, not a browse); typing
// a search directly on this screen keeps the wider limit.
const UNIFIED_FLOW_RESULT_LIMIT = 3;

export function EatNowScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;
  const params = route.params;

  const [step, setStep] = useState<Step>(needsGuestDisclaimer ? 'disclaimer' : 'search');
  const [query, setQuery] = useState(params?.initialQuery ?? '');
  const [results, setResults] = useState<FoodIdeaView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const runSearch = async (searchQuery: string, maxPricePence?: number, limit = 5, explicitToken?: string) => {
    setError(null);
    setStep('loading');
    try {
      const token = explicitToken ?? (user ? await tokenStore.getAccessToken() : await guestSession.ensureSession());
      let found;
      try {
        found = await api.searchEatNow({ query: searchQuery, maxPricePence }, token ?? '');
      } catch (e) {
        // A cached guest token the server no longer accepts (24h TTL lapsed,
        // or the API restarted with a rotated secret) surfaces as a 401 —
        // there's no way to detect that in advance, so recover by minting a
        // fresh guest session and retrying once before giving up.
        if (!user && !explicitToken && e instanceof ApiError && e.status === 401) {
          found = await api.searchEatNow({ query: searchQuery, maxPricePence }, await guestSession.recoverSession());
        } else {
          throw e;
        }
      }
      setResults(found.slice(0, limit));
      setStep('results');
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Eat Now isn't ready yet — there's no food data source connected. Check back soon.");
      } else {
        setError('Something went wrong searching for food. Please try again.');
      }
      setStep('search');
    }
  };

  // Deep-linked from the unified Home decision flow with a pre-built query —
  // run it immediately rather than making the user retype what they already
  // told Home. Skipped while the guest disclaimer still needs acknowledging;
  // acknowledgeDisclaimer below re-triggers this once it's out of the way.
  useEffect(() => {
    if (params?.initialQuery && step === 'search') {
      runSearch(params.initialQuery, params.initialMaxPricePence, UNIFIED_FLOW_RESULT_LIMIT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledgeDisclaimer = async () => {
    setAcknowledging(true);
    try {
      const token = await guestSession.acknowledgeDisclaimer();
      if (params?.initialQuery) {
        await runSearch(params.initialQuery, params.initialMaxPricePence, UNIFIED_FLOW_RESULT_LIMIT, token);
      } else {
        setStep('search');
      }
    } finally {
      setAcknowledging(false);
    }
  };

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    await runSearch(trimmed);
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

  if (step === 'results') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ {params?.whyLabel ? 'Home' : 'Try another search'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>A few ideas</Text>
        {params?.whyLabel ? (
          <Text style={styles.whyText}>Because you're after: {params.whyLabel}</Text>
        ) : null}
        <Text style={styles.disclaimerNote}>
          Example suggestions from a small curated list — cuisine and price band are real; distance,
          delivery time and exact price are illustrative estimates, not live data from any restaurant.
        </Text>

        {results.length === 0 ? (
          <View>
            <Text style={styles.emptyText}>
              I couldn't find a good match with all those preferences. Try removing one, or search for
              something else.
            </Text>
            <Button label="Try again" variant="secondary" onPress={() => setStep('search')} style={styles.actionSpacing} />
          </View>
        ) : (
          results.map((idea) => (
            <Card key={idea.id} style={styles.resultCard}>
              <Text style={styles.resultTitle}>{idea.title}</Text>
              <Text style={styles.resultBody}>{idea.description}</Text>
              <Text style={styles.estimateText}>
                ~{idea.distanceMiles} mi · {idea.deliveryMinutesMin}–{idea.deliveryMinutesMax} min ·{' '}
                {formatPence(idea.pricePenceMin)}–{formatPence(idea.pricePenceMax)}
              </Text>
              <View style={styles.tagRow}>
                <Tag label={idea.cuisine} />
                <Tag label={BUDGET_LABEL[idea.budgetTier]} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    );
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
  whyText: { ...typography.body, color: colors.primary, marginBottom: spacing.sm, fontWeight: '600' },
  disclaimerNote: { ...typography.caption, color: colors.textFaint, marginBottom: spacing.lg, lineHeight: 18 },
  emptyText: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
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
  resultCard: { marginBottom: spacing.md },
  resultTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  resultBody: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
  estimateText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  disclaimerBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  disclaimerText: { fontSize: 14, lineHeight: 21, color: colors.text },
});
