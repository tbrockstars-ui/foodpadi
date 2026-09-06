import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT, FoodIdeaView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { AdSlot } from '../components/AdSlot';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FoodImage } from '../components/FoodImage';
import { LoadingState } from '../components/LoadingState';
import { LocalFoodSearch } from '../components/LocalFoodSearch';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { FadeInView } from '../components/motion/FadeInView';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
        } else if (!user && !explicitToken && e instanceof ApiError && e.status === 403) {
          // Guest token isn't disclaimer-acknowledged — acknowledge and retry
          // once with the rotated token.
          found = await api.searchEatNow(
            { query: searchQuery, maxPricePence },
            await guestSession.acknowledgeDisclaimer(),
          );
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

  const getToken = async () => (user ? ((await tokenStore.getAccessToken()) ?? '') : guestSession.ensureSession());

  if (step === 'disclaimer') {
    return (
      <Screen>
        <ScreenHeader title="Before you start" />
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button
          label="I understand"
          onPress={acknowledgeDisclaimer}
          loading={acknowledging}
          style={styles.actionSpacing}
        />
      </Screen>
    );
  }

  if (step === 'loading') {
    return <LoadingState message="Looking for something to eat…" />;
  }

  if (step === 'results') {
    return (
      <Screen scroll>
        <ScreenHeader
          title="A few ideas"
          subtitle={params?.whyLabel ? `Because you're after: ${params.whyLabel}` : undefined}
          onBack={() => (params?.whyLabel ? navigation.goBack() : setStep('search'))}
          backLabel={params?.whyLabel ? 'Home' : 'New search'}
        />
        <Text style={styles.disclaimerNote}>
          Example suggestions from a small curated list — cuisine and price band are real; distance,
          delivery time and exact price are illustrative estimates, not live data from any restaurant.
        </Text>

        {results.length === 0 ? (
          <View>
            <Text style={styles.emptyText}>
              I couldn&apos;t find a good match with all those preferences. Try removing one, or search
              for something else.
            </Text>
            <Button label="Try again" variant="secondary" onPress={() => setStep('search')} style={styles.actionSpacing} />
          </View>
        ) : (
          results.map((idea, index) => (
            <FadeInView key={idea.id} delay={index * 40}>
              <Card style={styles.resultCard}>
                <FoodImage
                  image={idea.image}
                  alt={idea.title}
                  style={styles.resultImage}
                  badge={idea.tags.includes('vegan') ? 'Vegan' : undefined}
                />
                <Text style={styles.resultTitle}>{idea.title}</Text>
                <Text style={styles.resultBody}>{idea.description}</Text>
                <Text style={styles.estimateText}>
                  ~{idea.distanceMiles} mi · {idea.deliveryMinutesMin}–{idea.deliveryMinutesMax} min ·{' '}
                  {formatPence(idea.pricePenceMin)}–{formatPence(idea.pricePenceMax)}
                </Text>
                <Text style={styles.illustrativeTag}>Example only — not a specific place</Text>
                <View style={styles.tagRow}>
                  <Tag label={idea.cuisine} />
                  <Tag label={BUDGET_LABEL[idea.budgetTier]} />
                </View>
              </Card>
            </FadeInView>
          ))
        )}

        {!user ? (
          <>
            <Text style={styles.guestNudge}>FoodPadi gets better when it knows you.</Text>
            <AdSlot placement="eat_now_results" />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="What are you after?"
        subtitle="Tell us what you fancy — a dish, a cuisine, anything."
        onBack={() => navigation.goBack()}
        backLabel="Home"
      />

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

      <LocalFoodSearch query={query} getToken={getToken} />
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    disclaimerNote: { ...typography.caption, color: c.textFaint, marginBottom: spacing.lg, lineHeight: 18 },
    guestNudge: { ...typography.caption, color: c.textFaint, textAlign: 'center', marginTop: spacing.lg },
    emptyText: { ...typography.body, color: c.textMuted, marginBottom: spacing.md },
    searchInput: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.text,
    },
    errorText: { color: c.danger, marginTop: spacing.lg, fontSize: 14 },
    actionSpacing: { marginTop: spacing.xl },
    resultCard: { marginBottom: spacing.md },
    resultImage: { marginBottom: spacing.md },
    resultTitle: { ...typography.title, color: c.text, marginBottom: spacing.xs },
    resultBody: { ...typography.body, color: c.textMuted, marginBottom: spacing.sm },
    estimateText: { ...typography.caption, color: c.textMuted, marginBottom: spacing.sm },
    // Sits right on the illustrative card, not just the disclaimer text
    // above the list — see the matching comment in web's eat-now.module.css.
    illustrativeTag: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '600',
      color: c.textFaint,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.border,
      borderRadius: radius.pill,
      paddingVertical: 2,
      paddingHorizontal: 10,
      marginBottom: spacing.sm,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    disclaimerBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    disclaimerText: { fontSize: 14, lineHeight: 21, color: c.text },
  });
}
