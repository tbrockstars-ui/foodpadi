import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { usePressScale } from './motion/usePressScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface RowProps {
  /** Feather icon name shown at the leading edge. */
  icon?: FeatherName;
  label: string;
  /** Small supporting line under the label. */
  detail?: string;
  onPress?: () => void;
  /** Right-aligned value text (e.g. "Free", a count). */
  value?: string;
  /** Right-aligned pill (e.g. plan badge). Takes precedence over `value`. */
  badge?: string;
  /** Hide the trailing chevron (non-navigational rows). */
  hideChevron?: boolean;
  /** Tint the label + icon as a destructive action. */
  destructive?: boolean;
  /** Last row in its group — drops the hairline divider. Set automatically by RowGroup. */
  last?: boolean;
  /** Show a lock glyph instead of a chevron (guest / gated rows). */
  locked?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * One navigational row — leading icon, label (+ optional detail), optional
 * trailing value/badge, trailing chevron — grouped inside <RowGroup>. This
 * is the reference "Manage settings" pattern: clean rows, hairline
 * dividers, the palette showing only on the primary CTA elsewhere on the
 * screen, not on every row. Promotes the private `Row` that
 * `SettingsScreen` had into something Profile and Settings both share.
 */
export function ListRow({
  icon,
  label,
  detail,
  onPress,
  value,
  badge,
  hideChevron,
  destructive,
  last,
  locked,
}: RowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const press = usePressScale(0.99);
  const labelColor = destructive ? colors.danger : colors.text;
  const iconColor = destructive ? colors.danger : colors.textMuted;

  return (
    <AnimatedTouchable
      style={[styles.row, !last && styles.rowDivider, press.style]}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.left}>
        {icon ? <Feather name={icon} size={19} color={iconColor} style={styles.icon} /> : null}
        <View style={styles.labelWrap}>
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : value ? (
          <Text style={styles.value}>{value}</Text>
        ) : null}
        {locked ? (
          <Feather name="lock" size={15} color={colors.textFaint} />
        ) : !hideChevron ? (
          <Feather name="chevron-right" size={20} color={colors.textFaint} />
        ) : null}
      </View>
    </AnimatedTouchable>
  );
}

/**
 * The bordered, rounded container that holds a run of <ListRow>s. Injects
 * `last` on the final row so callers don't have to track it by hand.
 */
export function RowGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <View style={styles.group}>
      {rows.map((child, i) =>
        React.cloneElement(child as React.ReactElement<RowProps>, {
          last: i === rows.length - 1,
          key: (child as React.ReactElement).key ?? i,
        }),
      )}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    group: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      backgroundColor: c.surface,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: c.border },
    left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
    icon: { width: 22, textAlign: 'center' },
    labelWrap: { flexShrink: 1 },
    label: { ...typography.subtitle, fontWeight: '600', color: c.text },
    detail: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    value: { ...typography.caption, color: c.textMuted },
    badge: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: c.primary },
  });
}
