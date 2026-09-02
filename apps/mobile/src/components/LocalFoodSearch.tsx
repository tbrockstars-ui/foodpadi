import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import type { FoodProviderResult, LocalFoodSearchResponse } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { Button } from './Button';
import { Card } from './Card';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

export type LocalFoodSearchStage =
  | 'idle'
  | 'asking-permission'
  | 'manual-location'
  | 'searching'
  | 'results'
  | 'no-results'
  | 'error';
type Stage = LocalFoodSearchStage;

/**
 * Real, location-aware "find this food near me" — a supporting capability of
 * Eat Now, not a restaurant browser (docs/IMPLEMENTATION_PLAN.md). Web
 * counterpart: apps/web/app/eat-now/LocalFoodSearch.tsx.
 */
export function LocalFoodSearch({
  query,
  getToken,
  autoStart = false,
  onStageChange,
}: {
  query: string;
  getToken: () => Promise<string>;
  /** Skip the "press this button to search" step and go straight to asking
   * for location — used when embedding this inside a DecideFlow "Get it"
   * option, where expanding the option already represents the user's intent
   * to search. Web counterpart: eat-now/LocalFoodSearch.tsx's same prop. */
  autoStart?: boolean;
  /** Lets a parent (e.g. DecideFlow) know when a search is actively in
   * progress, so it can e.g. hide its own "Hide" toggle mid-search rather
   * than let it interrupt something already underway. */
  onStageChange?: (stage: Stage) => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [stage, setStage] = useState<Stage>('idle');
  const [manualLocation, setManualLocation] = useState('');
  const [results, setResults] = useState<FoodProviderResult[]>([]);
  const [source, setSource] = useState<LocalFoodSearchResponse['source']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onStageChange?.(stage);
    // onStageChange is expected to be a stable callback (or the caller
    // should memoize it) — re-running only on stage change is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const runSearch = async (body: { latitude?: number; longitude?: number; locationText?: string }) => {
    setStage('searching');
    setErrorMessage(null);
    try {
      const token = await getToken();
      const data: LocalFoodSearchResponse = await api.localFoodSearch({ query: query.trim(), ...body }, token);
      setResults(data.results);
      setSource(data.source);
      setStage(data.results.length > 0 ? 'results' : 'no-results');
    } catch (e) {
      // The API's own messages are already user-facing and specific
      // ("couldn't reach the data source", "couldn't find that location", …)
      // — surface them, and only fall back to a generic line otherwise.
      setErrorMessage(
        e instanceof ApiError && e.message
          ? e.message
          : "We couldn't find nearby food right now. Please try again.",
      );
      setStage('error');
    }
  };

  const findNearby = async () => {
    if (!query.trim()) return;
    setStage('asking-permission');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setStage('manual-location');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      await runSearch({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      // Location services disabled, or the lookup itself failed — never
      // block the user, offer the manual fallback instead.
      setStage('manual-location');
    }
  };

  const searchManualLocation = () => {
    const trimmed = manualLocation.trim();
    if (!trimmed) return;
    runSearch({ locationText: trimmed });
  };

  // Same rationale as the web counterpart: skip the "press this button"
  // step entirely when the caller already represents a user action that
  // means "search now" (expanding a DecideFlow "Get it" option).
  useEffect(() => {
    if (autoStart) findNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, autoStart && styles.containerEmbedded]}>
      {!autoStart ? (
        <>
          <Text style={styles.heading}>Find it near you</Text>
          <Text style={styles.subtitle}>
            FoodPadi uses your location to find nearby places that actually offer what you&apos;re
            after — real businesses, not a browse list.
          </Text>
        </>
      ) : null}

      {!autoStart && (stage === 'idle' || stage === 'asking-permission') ? (
        <Button
          label="📍 Find it nearby"
          variant="secondary"
          onPress={findNearby}
          disabled={!query.trim()}
          loading={stage === 'asking-permission'}
        />
      ) : null}

      {autoStart && stage === 'asking-permission' ? <Text style={styles.boxText}>Getting your location…</Text> : null}

      {stage === 'manual-location' ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>
            FoodPadi needs a location to find food nearby. Enter a postcode, town, or area instead.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. SW1A 1AA or Leicester"
            placeholderTextColor={colors.textFaint}
            value={manualLocation}
            onChangeText={setManualLocation}
            onSubmitEditing={searchManualLocation}
            returnKeyType="search"
            autoComplete="off"
            autoCorrect={false}
          />
          <Button label="Search" variant="secondary" onPress={searchManualLocation} disabled={!manualLocation.trim()} />
        </View>
      ) : null}

      {stage === 'searching' ? <Text style={styles.boxText}>Looking nearby…</Text> : null}

      {stage === 'error' ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>{errorMessage}</Text>
          <View style={styles.buttonRow}>
            <Button label="Try again" variant="secondary" onPress={findNearby} style={{ flex: 1 }} />
            <Button
              label="Enter postcode"
              variant="secondary"
              onPress={() => setStage('manual-location')}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {stage === 'no-results' ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>We couldn&apos;t find a strong match nearby.</Text>
          <Button label="Try a different location" variant="secondary" onPress={() => setStage('manual-location')} />
        </View>
      ) : null}

      {stage === 'results' ? (
        <>
          {source === 'openstreetmap' ? (
            <Text style={styles.attribution}>Results from OpenStreetMap · © OpenStreetMap contributors</Text>
          ) : null}
          {results.map((provider) => (
            <Card key={provider.id} style={styles.providerCard}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={[styles.matchBadge, provider.matchType === 'EXACT_MATCH' ? styles.matchExact : styles.matchClose]}>
                {provider.matchType === 'EXACT_MATCH' ? `✓ ${provider.matchedFood}` : `~ ${provider.matchedFood}`}
                {provider.matchType === 'CLOSE_MATCH' ? ' · Close match' : ''}
              </Text>
              {provider.distanceText ? <Text style={styles.providerMeta}>{provider.distanceText}</Text> : null}
              {provider.address ? <Text style={styles.providerMeta}>{provider.address}</Text> : null}
              {provider.phone ? <Text style={styles.providerMeta}>{provider.phone}</Text> : null}

              <View style={styles.buttonRow}>
                {provider.bookingUrl ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(provider.bookingUrl!)}>
                    <Text style={styles.actionChipText}>Book now</Text>
                  </TouchableOpacity>
                ) : null}
                {provider.orderUrl ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(provider.orderUrl!)}>
                    <Text style={styles.actionChipText}>Order online</Text>
                  </TouchableOpacity>
                ) : null}
                {provider.phone ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(`tel:${provider.phone}`)}>
                    <Text style={styles.actionChipText}>Call now</Text>
                  </TouchableOpacity>
                ) : null}
                {provider.websiteUrl ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(provider.websiteUrl!)}>
                    <Text style={styles.actionChipText}>Website</Text>
                  </TouchableOpacity>
                ) : null}
                {provider.mapsUrl ? (
                  <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(provider.mapsUrl!)}>
                    <Text style={styles.actionChipText}>Maps</Text>
                  </TouchableOpacity>
                ) : null}
                {/* Honest search links, not verified data — visually distinct
                    (dashed border, muted text) so they're never mistaken for
                    a real phone/website/order link found for this business.
                    Always offered, since OSM's tag coverage varies a lot. */}
                <TouchableOpacity
                  style={styles.searchChip}
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/search?q=${encodeURIComponent(`${provider.name} ${provider.address ?? ''}`.trim())}`,
                    )
                  }
                >
                  <Text style={styles.searchChipText}>🔍 Search the web</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchChip}
                  onPress={() =>
                    Linking.openURL(`https://www.ubereats.com/search?q=${encodeURIComponent(provider.name)}`)
                  }
                >
                  <Text style={styles.searchChipText}>🔍 Search Uber Eats</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: c.border },
  // Embedded inside a DecideFlow option card, which already has its own
  // border/padding — the extra top rule + spacing here would double up.
  containerEmbedded: { marginTop: spacing.md, paddingTop: 0, borderTopWidth: 0 },
  heading: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: c.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  box: { backgroundColor: c.surfaceSunken, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  boxText: { ...typography.caption, color: c.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: c.text,
    marginBottom: spacing.md,
  },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  attribution: { ...typography.caption, color: c.textFaint, marginTop: spacing.md, marginBottom: spacing.sm },
  providerCard: { marginTop: spacing.md },
  providerName: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  matchBadge: { fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  matchExact: { color: c.success },
  matchClose: { color: c.secondary },
  providerMeta: { ...typography.caption, color: c.textMuted, marginBottom: spacing.xs },
  actionChip: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  actionChipText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  searchChip: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    backgroundColor: 'transparent',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  searchChipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  });
}
