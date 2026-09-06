import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { AISLE_ORDER, categorizeIngredient, ShoppingListView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/Section';
import { useReduceMotion } from '../components/motion/useReduceMotion';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'ShoppingList'>;

/** A checkbox whose tick pops in with a small scale (declutter pass §19). */
function CheckBox({ checked, color }: { checked: boolean; color: ThemeColors }) {
  const styles = makeStyles(color);
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(checked ? 1 : 0);
      return;
    }
    Animated.timing(scale, {
      toValue: checked ? 1 : 0,
      duration: checked ? 160 : 100,
      useNativeDriver: true,
    }).start();
  }, [checked, reduceMotion, scale]);

  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Feather name="check" size={13} color={color.primaryText} />
      </Animated.View>
    </View>
  );
}

export function ShoppingListScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { listId } = route.params;
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [newItem, setNewItem] = useState('');

  const load = async () => {
    setList(await api.getShoppingList(listId));
    setLoading(false);
  };

  const rebuildFromPlan = () => {
    if (!list?.mealPlanId) return;
    Alert.alert(
      'Rebuild from plan?',
      'This replaces the auto-added items with a fresh list from your current plan. Items you added by hand are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rebuild',
          style: 'destructive',
          onPress: async () => {
            setRebuilding(true);
            try {
              const rebuilt = await api.generateShoppingList(list.mealPlanId as string, true);
              setList(rebuilt);
            } finally {
              setRebuilding(false);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    load();
  }, [listId]);

  const toggle = async (itemId: string, checked: boolean) => {
    if (!list) return;
    setList({ ...list, items: list.items.map((i) => (i.id === itemId ? { ...i, checked } : i)) });
    await api.updateShoppingListItem(listId, itemId, { checked });
  };

  const addItem = async () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setNewItem('');
    await api.addShoppingListItem(listId, { ingredientName: trimmed });
    load();
  };

  const removeItem = async (itemId: string) => {
    if (!list) return;
    setList({ ...list, items: list.items.filter((i) => i.id !== itemId) });
    await api.removeShoppingListItem(listId, itemId);
  };

  if (loading || !list) {
    return <LoadingState message="Loading your shopping list…" />;
  }

  const remaining = list.items.filter((i) => !i.checked).length;
  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    items: list.items.filter((item) => categorizeIngredient(item.ingredientName) === aisle),
  })).filter((group) => group.items.length > 0);

  return (
    <Screen scroll>
      <ScreenHeader
        title="Shopping list"
        subtitle={remaining === 0 ? 'All done!' : `${remaining} item${remaining === 1 ? '' : 's'} left`}
        onBack={() => navigation.goBack()}
      />

      {list.mealPlanId ? (
        <Button
          label={rebuilding ? 'Rebuilding…' : 'Rebuild from plan'}
          variant="tertiary"
          onPress={rebuildFromPlan}
          loading={rebuilding}
          style={styles.rebuild}
        />
      ) : null}

      {list.items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Add an item below to get started." />
      ) : (
        groups.map((group) => (
          <View key={group.aisle} style={styles.group}>
            <SectionHeader title={group.aisle} />
            <Card style={styles.card}>
              {group.items.map((item, i) => (
                <View key={item.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => toggle(item.id, !item.checked)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                  >
                    <CheckBox checked={item.checked} color={colors} />
                    <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                      {[item.quantity, item.ingredientName].filter(Boolean).join(' ')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(item.id)} accessibilityLabel="Remove item" hitSlop={8}>
                    <Feather name="x" size={15} color={colors.textFaint} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add an item"
          placeholderTextColor={colors.textFaint}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addItem}
          returnKeyType="done"
          autoComplete="off"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    rebuild: { alignSelf: 'flex-start', marginBottom: spacing.md },
    card: { marginBottom: spacing.lg, paddingVertical: spacing.xs },
    group: { marginBottom: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    checkRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    itemText: { ...typography.body, color: c.text, flex: 1 },
    itemTextChecked: { color: c.textFaint, textDecorationLine: 'line-through' },
    addRow: { flexDirection: 'row', gap: spacing.sm },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.text,
    },
    addButton: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    addButtonText: { color: c.text, fontWeight: '600' },
  });
}
