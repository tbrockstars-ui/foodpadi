import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AISLE_ORDER, categorizeIngredient, ShoppingListView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { colors, radius, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'ShoppingList'>;

export function ShoppingListScreen({ route, navigation }: Props) {
  const { listId } = route.params;
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  const load = async () => {
    setList(await api.getShoppingList(listId));
    setLoading(false);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹ Home</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Shopping list</Text>
      <Text style={styles.subtitle}>
        {remaining === 0 ? 'All done!' : `${remaining} item${remaining === 1 ? '' : 's'} left`}
      </Text>

      {list.items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Add an item below to get started." />
      ) : (
        groups.map((group) => (
          <View key={group.aisle} style={styles.group}>
            <Text style={styles.groupHeading}>{group.aisle}</Text>
            <Card style={styles.card}>
              {group.items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => toggle(item.id, !item.checked)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                  >
                    <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                      {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                      {[item.quantity, item.ingredientName].filter(Boolean).join(' ')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(item.id)} accessibilityLabel="Remove item">
                    <Text style={styles.removeIcon}>✕</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 56 },
  backLink: { marginBottom: spacing.md },
  backLinkText: { color: colors.textMuted, fontSize: 14 },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  group: { marginBottom: spacing.sm },
  groupHeading: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.primaryText, fontSize: 13, fontWeight: '700' },
  itemText: { ...typography.body, color: colors.text, flex: 1 },
  itemTextChecked: { color: colors.textFaint, textDecorationLine: 'line-through' },
  removeIcon: { color: colors.textFaint, fontSize: 14, paddingHorizontal: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: { color: colors.text, fontWeight: '600' },
});
