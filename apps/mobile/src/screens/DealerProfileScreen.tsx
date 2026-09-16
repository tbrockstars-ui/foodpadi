import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEALER_TYPE_LABELS, type DealerProfileView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { StarRating } from '../components/StarRating';
import { DealerRatingsSection } from '../components/DealerRatingsSection';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DealerProfile'>;

/**
 * Customer-facing FoodPadi Food Dealer profile (dealer brief §27). The "View
 * dealer" destination from local discovery. Only shows contact channels the
 * dealer actually supplied — nothing is fabricated. Contact taps record an
 * aggregate, no-PII event.
 */
export function DealerProfileScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [dealer, setDealer] = useState<DealerProfileView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getDealer(slug)
      .then((d) => !cancelled && setDealer(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const open = (url: string, type: string) => {
    void api.trackDealerEvent(slug, type);
    void Linking.openURL(url);
  };

  if (failed) {
    return (
      <Screen>
        <ScreenHeader title="Dealer" onBack={() => navigation.goBack()} />
        <EmptyState title="No longer listed" body="This dealer isn't listed on FoodPadi right now." />
      </Screen>
    );
  }
  if (!dealer) {
    return (
      <Screen>
        <ScreenHeader title="Dealer" onBack={() => navigation.goBack()} />
        <LoadingState />
      </Screen>
    );
  }

  const c = dealer.contact;

  return (
    <Screen scroll>
      <ScreenHeader
        title={dealer.name}
        onBack={() => navigation.goBack()}
        trailing={dealer.isVerified ? <VerifiedBadge size={18} /> : undefined}
      />

      <Text style={styles.meta}>
        {[DEALER_TYPE_LABELS[dealer.dealerType], ...dealer.categories].filter(Boolean).join(' • ')}
      </Text>
      {dealer.primaryLocality ? <Text style={styles.meta}>📍 {dealer.primaryLocality}</Text> : null}
      {dealer.ratingAverage != null ? (
        <View style={{ marginTop: 2 }}>
          <StarRating average={dealer.ratingAverage} count={dealer.ratingCount} size={15} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {c.phone ? (
          <TouchableOpacity style={styles.action} onPress={() => open(`tel:${c.phone}`, 'phone_click')}>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        {c.websiteUrl ? (
          <TouchableOpacity style={styles.action} onPress={() => open(c.websiteUrl!, 'website_click')}>
            <Text style={styles.actionText}>Website</Text>
          </TouchableOpacity>
        ) : null}
        {c.orderUrl ? (
          <TouchableOpacity style={styles.action} onPress={() => open(c.orderUrl!, 'order_click')}>
            <Text style={styles.actionText}>Order</Text>
          </TouchableOpacity>
        ) : null}
        {c.whatsappUrl ? (
          <TouchableOpacity style={styles.action} onPress={() => open(c.whatsappUrl!, 'order_click')}>
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
        {dealer.primaryLocality ? (
          <TouchableOpacity
            style={styles.action}
            onPress={() =>
              open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dealer.primaryLocality!)}`,
                'direction_click',
              )
            }
          >
            <Text style={styles.actionText}>Directions</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {dealer.products.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.h2}>Popular products</Text>
          {dealer.products.map((p) => (
            <View key={p.name} style={styles.productRow}>
              <Text style={styles.productName}>{p.name}</Text>
              {p.priceText ? <Text style={styles.price}>{p.priceText}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}

      {dealer.description ? (
        <Card style={styles.card}>
          <Text style={styles.h2}>About</Text>
          <Text style={styles.body}>{dealer.description}</Text>
        </Card>
      ) : null}

      {dealer.openingHours ? (
        <Card style={styles.card}>
          <Text style={styles.h2}>Opening hours</Text>
          {Object.entries(dealer.openingHours).map(([day, v]) => (
            <View key={day} style={styles.productRow}>
              <Text style={styles.day}>{day}</Text>
              <Text style={styles.body}>{v}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {dealer.serviceAreas.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.h2}>Also serves</Text>
          <Text style={styles.body}>{dealer.serviceAreas.join(', ')}</Text>
        </Card>
      ) : null}

      <DealerRatingsSection slug={slug} />
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    meta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    action: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
    },
    actionText: { color: c.primary, fontWeight: '700', fontSize: 13 },
    card: { marginTop: spacing.lg },
    h2: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
    body: { ...typography.body, color: c.text },
    productRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: spacing.md,
    },
    productName: { ...typography.body, color: c.text },
    price: { ...typography.caption, color: c.textMuted },
    day: { ...typography.body, color: c.textMuted, width: 44, textTransform: 'capitalize' },
  });
}
