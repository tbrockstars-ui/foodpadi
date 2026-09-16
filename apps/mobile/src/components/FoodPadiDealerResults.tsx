import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DealerCardView, DealerSearchResponse } from '@foodpadi/shared';
import { api } from '../api/client';
import { Card } from './Card';
import { VerifiedBadge } from './VerifiedBadge';
import { StarRating } from './StarRating';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/types';

/**
 * The "FoodPadi Dealers" block inside mobile local discovery — rendered ABOVE
 * the OpenStreetMap results in LocalFoodSearch (Network-first ordering, dealer
 * brief §22/§46 + user instruction 2026-09-09). Same GET /dealers/search the
 * web calls (brief §21/§64). Renders nothing when no subscribed dealer matches,
 * so the existing discovery is untouched (brief §60/§82).
 */
export function FoodPadiDealerResults({
  query,
  latitude,
  longitude,
  locationText,
  getToken,
}: {
  query: string;
  latitude?: number;
  longitude?: number;
  locationText?: string;
  getToken: () => Promise<string>;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [data, setData] = useState<DealerSearchResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getToken()
      .then((token) =>
        api.dealerSearch(
          { q: query.trim() || undefined, latitude, longitude, locality: locationText?.trim() || undefined },
          token,
        ),
      )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [query, latitude, longitude, locationText, getToken]);

  if (!data) return null;
  const cards = [...data.featured, ...data.results];
  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>FoodPadi Dealers</Text>
      <Text style={styles.sub}>Businesses in the FoodPadi Food Dealer Network near you.</Text>
      {cards.map((c) => (
        <DealerCard
          key={c.id}
          card={c}
          styles={styles}
          onView={() => {
            void api.trackDealerEvent(c.slug, 'profile_view');
            navigation.navigate('DealerProfile', { slug: c.slug });
          }}
        />
      ))}
    </View>
  );
}

function DealerCard({
  card,
  styles,
  onView,
}: {
  card: DealerCardView;
  styles: ReturnType<typeof makeStyles>;
  onView: () => void;
}) {
  const distance =
    card.distanceMiles != null
      ? `${card.distanceMiles < 0.1 ? 'under 0.1' : card.distanceMiles.toFixed(1)} mi`
      : card.primaryLocality;
  return (
    <Card style={styles.card}>
      {card.isSponsored ? (
        <View style={styles.badges}>
          <Text style={styles.sponsored}>SPONSORED</Text>
        </View>
      ) : null}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{card.name}</Text>
        {card.isVerified ? <VerifiedBadge /> : null}
      </View>
      <Text style={styles.meta}>
        {[card.categories.slice(0, 2).join(' · '), distance].filter(Boolean).join(' — ')}
      </Text>
      {card.ratingAverage != null ? (
        <StarRating average={card.ratingAverage} count={card.ratingCount} size={12} />
      ) : null}
      {card.matchedTerms.length > 0 ? (
        <Text style={styles.matched}>{card.matchedTerms.join(' · ')}</Text>
      ) : null}
      <TouchableOpacity style={styles.viewBtn} onPress={onView}>
        <Text style={styles.viewBtnText}>View dealer →</Text>
      </TouchableOpacity>
    </Card>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: spacing.lg },
    heading: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
    sub: { ...typography.caption, color: c.textMuted, marginBottom: spacing.sm },
    card: { marginTop: spacing.sm },
    badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.xs },
    sponsored: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: c.primary,
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingVertical: 2,
      paddingHorizontal: 8,
      overflow: 'hidden',
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { fontSize: 15, fontWeight: '700', color: c.text },
    meta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    matched: { ...typography.caption, color: c.textFaint, marginTop: 4 },
    viewBtn: { marginTop: spacing.sm },
    viewBtnText: { color: c.primary, fontWeight: '700', fontSize: 13 },
  });
}
