import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { RecipeIngredientView, ScannedItemView } from '@foodpadi/shared';
import { normalizeIngredientName } from '@foodpadi/shared';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from './Button';
import { Chip } from './Chip';
import { Section } from './Section';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Stage = 'idle' | 'scanning' | 'reviewScan' | 'reconciled';

interface NeedEntry {
  name: string;
  note: string | null;
}

function parseLeadingInt(quantity: string | null): number | null {
  if (!quantity) return null;
  const match = quantity.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function findHaveMatch(haveItems: ScannedItemView[], ingredientName: string): ScannedItemView | undefined {
  const ing = normalizeIngredientName(ingredientName);
  return haveItems.find((item) => {
    const name = normalizeIngredientName(item.name);
    return name.length > 1 && (ing.includes(name) || name.includes(ing));
  });
}

function reconcile(
  recipeIngredients: RecipeIngredientView[],
  haveItems: ScannedItemView[],
): { have: RecipeIngredientView[]; need: NeedEntry[] } {
  const have: RecipeIngredientView[] = [];
  const need: NeedEntry[] = [];
  for (const ingredient of recipeIngredients) {
    const match = findHaveMatch(haveItems, ingredient.name);
    if (!match) {
      need.push({ name: ingredient.name, note: [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || null });
      continue;
    }
    const recipeQty = parseLeadingInt(ingredient.quantity);
    const haveQty = parseLeadingInt(match.quantity);
    if (recipeQty !== null && haveQty !== null && recipeQty > haveQty) {
      need.push({ name: ingredient.name, note: `${recipeQty - haveQty} more` });
      continue;
    }
    have.push(ingredient);
  }
  return { have, need };
}

interface Props {
  recipeIngredients: RecipeIngredientView[];
  /** Navigates to the existing ShoppingList screen — only offered as an
   * optional "view it" link once a standalone list has been created, never
   * automatic (see addToShoppingList below). */
  onNavigateToShoppingList: (listId: string) => void;
  /** Reports readiness up to CookTodayScreen, which gates Start Cooking on
   * it for a signed-in user — true only once every "need to buy" item has
   * been ticked off (or there was nothing to buy). Guests never render this
   * component, so their Start Cooking stays ungated. */
  onReadyChange: (ready: boolean) => void;
}

/**
 * Optional fridge check on Cook Today's recipe-detail screen — "Want to
 * check what you already have?" Web counterpart: apps/web/app/cook-today/
 * FridgeCheck.tsx. Reuses the same api.scanPhoto()/api.addPantryItems() the
 * dedicated Scan screen uses (a self-contained inline flow here, same as
 * web, rather than navigating away to that screen and back), and the same
 * shared ingredient matcher, so "have" detection matches Home's pantry-match
 * scoring exactly.
 */
export function FridgeCheck({ recipeIngredients, onNavigateToShoppingList, onReadyChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItemView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [have, setHave] = useState<RecipeIngredientView[]>([]);
  const [need, setNeed] = useState<NeedEntry[]>([]);
  // Items the user has ticked off the "need to buy" list — either because
  // they bought them, or because they realised they already had them.
  // Ticking everything off is what unlocks Start Cooking (see the effect
  // below) — the persisted shopping list created by "Add to Shopping List"
  // is a separate, optional convenience and doesn't itself gate anything.
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [addingToList, setAddingToList] = useState(false);
  const [listAdded, setListAdded] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // Distinguishes "scanned but nothing in the photo matched this recipe"
  // from "never scanned at all" — same `reconciled` stage, different empty
  // copy in the "You already have" section below.
  const [skipped, setSkipped] = useState(false);
  // Fires cook_today_shopping_completed once per reconciliation, the moment
  // the last "need to buy" item is ticked off — not on every render where
  // it's already true, and not at all when there was nothing to tick off in
  // the first place (trivially "ready", not a real completion event).
  const shoppingCompletedFired = useRef(false);

  // Start Cooking unlocks once every "need to buy" item is ticked off (an
  // empty need list — everything matched, or the recipe needs nothing —
  // counts as ready immediately). Before Scan/Skip has even run, there's
  // nothing to be ready about, so it stays false.
  useEffect(() => {
    const ready = stage === 'reconciled' && need.every((item) => purchased.has(item.name));
    onReadyChange(ready);
    if (ready && need.length > 0 && !shoppingCompletedFired.current) {
      shoppingCompletedFired.current = true;
      // Only rendered for a signed-in user (see CookTodayScreen's `user ?`
      // gate) — a plain access-token lookup is enough, no guest fallback
      // needed here, unlike CookTodayScreen's own trackEvent helper.
      tokenStore
        .getAccessToken()
        .then((token) => (token ? api.trackEvent({ eventType: 'cook_today_shopping_completed', metadata: { itemCount: need.length } }, token) : undefined))
        .catch(() => undefined);
    }
  }, [stage, need, purchased, onReadyChange]);

  const analyzePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      setError('Could not read that photo. Please try again.');
      return;
    }
    setError(null);
    setStage('scanning');
    try {
      const mediaType = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
      const result = await api.scanPhoto({ imageBase64: asset.base64, mediaType });
      if (result.items.length === 0) {
        setError("We couldn't spot anything in that photo — try a clearer, well-lit shot.");
        setStage('idle');
        return;
      }
      setScannedItems(result.items);
      setSelected(new Set(result.items.map((i) => i.name)));
      setStage('reviewScan');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? "Scan isn't ready yet — the photo analyser isn't configured. Check back soon."
          : 'Something went wrong analysing that photo. Please try again.',
      );
      setStage('idle');
    }
  };

  const takePhoto = async () => {
    // Same precedent as ScanScreen.tsx: the camera launcher isn't available
    // on web, so this quietly does nothing there — "Choose a photo" still
    // works (a plain file input under the hood).
    if (Platform.OS === 'web') return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to scan your fridge, or choose a photo instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) await analyzePhoto(result.assets[0]);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to scan your fridge.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) await analyzePhoto(result.assets[0]);
  };

  const toggleSelected = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirmScan = () => {
    const confirmed = scannedItems.filter((i) => selected.has(i.name));
    // Best-effort, same precedent as web: a failed pantry save shouldn't
    // block reconciliation, which only needs the confirmed list in memory.
    api
      .addPantryItems({
        items: confirmed.map((item) => ({ name: item.name, quantity: item.quantity ?? undefined, unit: item.unit ?? undefined })),
      })
      .catch(() => undefined);
    const { have: haveList, need: needList } = reconcile(recipeIngredients, confirmed);
    setHave(haveList);
    setNeed(needList);
    setSkipped(false);
    setPurchased(new Set());
    setListAdded(false);
    setListId(null);
    shoppingCompletedFired.current = false;
    setStage('reconciled');
  };

  // Skipping is still a deliberate choice, not silence — it reveals the same
  // HAVE/NEED breakdown (nothing scanned, so everything is NEED) and the
  // Shopping List action, matching the "disable the shopping list until scan
  // is clicked or skipped" rule: that action only exists once the user has
  // gone through one of these two paths, never before.
  const skipScan = () => {
    const { have: haveList, need: needList } = reconcile(recipeIngredients, []);
    setHave(haveList);
    setNeed(needList);
    setSkipped(true);
    setPurchased(new Set());
    setListAdded(false);
    setListId(null);
    shoppingCompletedFired.current = false;
    setStage('reconciled');
  };

  const togglePurchased = (name: string) => {
    setPurchased((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Persists the missing items to the real shopping-list feature — a
  // convenience for a grocery run, not the thing that gates Start Cooking
  // (ticking items off below is). Doesn't navigate away automatically, so
  // the user can go straight on to tick off items and start cooking without
  // losing their place — "View shopping list" is an explicit opt-in link.
  const addToShoppingList = async () => {
    if (need.length === 0) return;
    setAddingToList(true);
    setListError(null);
    try {
      const list = await api.createStandaloneShoppingList({ items: need.map((n) => ({ ingredientName: n.name })) });
      setListId(list.id);
      setListAdded(true);
    } catch {
      setListError("Couldn't create a shopping list right now. Please try again.");
    } finally {
      setAddingToList(false);
    }
  };

  if (stage === 'reconciled') {
    return (
      <>
        <Section title="You already have">
          {have.length === 0 ? (
            <Text style={styles.emptyText}>
              {skipped
                ? 'You skipped the fridge check, so everything below is listed as needed.'
                : 'Nothing matched from your fridge for this recipe.'}
            </Text>
          ) : (
            <View style={styles.chipWrap}>
              {have.map((i) => (
                <Chip key={i.name} label={`✓ ${i.name}`} selected onPress={() => undefined} />
              ))}
            </View>
          )}
        </Section>
        <Section title="You need to buy">
          {need.length === 0 ? (
            <Text style={styles.emptyText}>You're all set — nothing else to buy.</Text>
          ) : (
            <>
              <Text style={styles.emptyText}>Tick each item off once you have it, to unlock Start Cooking.</Text>
              <View style={styles.chipWrap}>
                {need.map((n) => {
                  const checked = purchased.has(n.name);
                  const label = n.note ? `${n.name} — ${n.note}` : n.name;
                  return (
                    <Chip
                      key={n.name}
                      label={checked ? `✓ ${label}` : `○ ${label}`}
                      selected={checked}
                      onPress={() => togglePurchased(n.name)}
                    />
                  );
                })}
              </View>
              <Button
                label={listAdded ? '✓ Added to Shopping List' : addingToList ? 'Adding…' : 'Add to Shopping List'}
                variant="secondary"
                onPress={addToShoppingList}
                loading={addingToList}
                disabled={listAdded}
                style={styles.actionSpacing}
              />
              {listAdded && listId ? (
                <Button
                  label="View shopping list"
                  variant="tertiary"
                  onPress={() => onNavigateToShoppingList(listId)}
                  style={styles.actionSpacing}
                />
              ) : null}
              {listError ? <Text style={styles.errorText}>{listError}</Text> : null}
              {need.length > purchased.size ? (
                <Text style={styles.emptyText}>
                  {need.length - purchased.size} item{need.length - purchased.size === 1 ? '' : 's'} left to tick off
                  before you can start cooking.
                </Text>
              ) : null}
            </>
          )}
        </Section>
      </>
    );
  }

  if (stage === 'reviewScan') {
    return (
      <Section title="Found in your photo">
        <View style={styles.chipWrap}>
          {scannedItems.map((item) => (
            <Chip key={item.name} label={item.name} selected={selected.has(item.name)} onPress={() => toggleSelected(item.name)} />
          ))}
        </View>
        <Button label="Confirm" onPress={confirmScan} disabled={selected.size === 0} style={styles.actionSpacing} />
      </Section>
    );
  }

  const scanning = stage === 'scanning';

  return (
    <Section title="Want to check what you already have?">
      <Text style={styles.emptyText}>Scan your fridge, or skip to see your full shopping list.</Text>
      <View style={styles.actionRow}>
        {Platform.OS !== 'web' ? (
          <Button
            label={scanning ? 'Scanning…' : 'Take a photo'}
            onPress={takePhoto}
            loading={scanning}
            disabled={scanning}
            style={styles.actionButton}
          />
        ) : null}
        <Button
          label={scanning ? 'Scanning…' : 'Choose a photo'}
          variant="secondary"
          onPress={choosePhoto}
          loading={scanning}
          disabled={scanning}
          style={styles.actionButton}
        />
      </View>
      <Button label="Skip" variant="tertiary" onPress={skipScan} disabled={scanning} style={styles.actionSpacing} />
      {error ? (
        <Text style={styles.errorText}>{error} You can still continue without scanning — everything you need is listed above.</Text>
      ) : null}
    </Section>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionRow: { flexDirection: 'row', gap: spacing.sm },
    actionButton: { flex: 1 },
    emptyText: { ...typography.body, color: c.textMuted },
    errorText: { color: c.danger, marginTop: spacing.md, fontSize: 13, lineHeight: 18 },
    actionSpacing: { marginTop: spacing.md },
  });
}
