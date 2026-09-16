import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DealerRatingsResponse } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { Card } from './Card';
import { StarRating } from './StarRating';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/types';

type MineState = 'loading' | 'signed-out' | { rating: number; comment: string | null };

/**
 * Post-visit customer ratings (user instruction 2026-09-11) — same contract
 * as the web DealerRatings component. Read is public; rating requires a real
 * FoodPadi account (prompted inline, not a hard block). No reviewer identity
 * is ever shown — every entry but the caller's own reads "FoodPadi customer".
 */
export function DealerRatingsSection({ slug }: { slug: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [data, setData] = useState<DealerRatingsResponse | null>(null);
  const [mine, setMine] = useState<MineState>('loading');
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.getDealerRatings(slug, 1).then((res) => !cancelled && setData(res));
    api
      .getMyDealerRating(slug)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setMine(res);
          setDraftRating(res.rating);
          setDraftComment(res.comment ?? '');
        } else {
          setMine({ rating: 0, comment: null });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) setMine('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const submit = async () => {
    if (draftRating < 1) {
      setError('Choose a star rating.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.submitDealerRating(slug, {
        rating: draftRating,
        comment: draftComment.trim() || undefined,
      });
      setData(updated);
      setMine({ rating: draftRating, comment: draftComment.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your rating.');
    } finally {
      setBusy(false);
    }
  };

  const removeMine = async () => {
    setBusy(true);
    try {
      const updated = await api.removeMyDealerRating(slug);
      setData(updated);
    } finally {
      setMine({ rating: 0, comment: null });
      setDraftRating(0);
      setDraftComment('');
      setBusy(false);
    }
  };

  if (!data) return null;
  const mineObj = typeof mine === 'object' ? mine : null;

  return (
    <Card style={styles.card}>
      <Text style={styles.h2}>Ratings from customers</Text>

      {data.average != null ? (
        <StarRating average={data.average} count={data.count} size={16} />
      ) : (
        <Text style={styles.noRatings}>No ratings yet — be the first to rate your visit.</Text>
      )}

      {mine === 'signed-out' ? (
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
          <Text style={styles.signIn}>Sign in from Profile to rate your experience with this business.</Text>
        </TouchableOpacity>
      ) : mine === 'loading' ? null : (
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {mineObj!.rating > 0 ? 'Your rating' : 'Bought food here? Rate your experience'}
          </Text>
          <View style={styles.starPicker}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setDraftRating(n)} accessibilityLabel={`${n} stars`}>
                <Text style={[styles.starBtn, n <= draftRating ? styles.starBtnOn : null]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Optional — what did you think?"
            placeholderTextColor={colors.textFaint}
            value={draftComment}
            onChangeText={setDraftComment}
            maxLength={600}
            multiline
          />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={busy}>
              <Text style={styles.submitBtnText}>
                {busy ? 'Saving…' : mineObj!.rating > 0 ? 'Update rating' : 'Submit rating'}
              </Text>
            </TouchableOpacity>
            {mineObj && mineObj.rating > 0 ? (
              <TouchableOpacity onPress={removeMine} disabled={busy}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}

      {data.ratings.map((r) => (
        <View key={r.id} style={[styles.item, r.isMine ? styles.itemMine : null]}>
          <View style={styles.itemHead}>
            <StarRating average={r.rating} count={1} showCount={false} size={13} />
            <Text style={styles.itemAuthor}>{r.isMine ? 'You' : 'FoodPadi customer'}</Text>
          </View>
          {r.comment ? <Text style={styles.itemComment}>{r.comment}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { marginTop: spacing.lg },
    h2: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
    noRatings: { ...typography.caption, color: c.textFaint },
    signIn: { ...typography.caption, color: c.primary, marginTop: spacing.sm },
    form: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
    },
    formTitle: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
    starPicker: { flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
    starBtn: { fontSize: 28, color: c.border },
    starBtnOn: { color: '#f5a623' },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      minHeight: 56,
      color: c.text,
      backgroundColor: c.surface,
      textAlignVertical: 'top',
      marginBottom: spacing.sm,
    },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    submitBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
    },
    submitBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 13 },
    removeText: { color: c.danger, fontSize: 13, textDecorationLine: 'underline' },
    error: { color: c.danger, fontSize: 12, marginTop: spacing.xs },
    item: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
    },
    itemMine: { borderColor: c.primary },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    itemAuthor: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    itemComment: { fontSize: 13, color: c.text },
  });
}
