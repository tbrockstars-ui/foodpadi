import React, { useRef, useState } from 'react';
import { Animated, Linking, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { FoodImageView } from '@foodpadi/shared';
import { radius, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const PROVIDER_LABEL: Record<FoodImageView['provider'], string> = {
  pexels: 'Pexels',
  unsplash: 'Unsplash',
};

interface Props {
  /** Resolved server-side. null/undefined => compact icon fallback, no network request. */
  image?: FoodImageView | null;
  /** Dish name — accessibility label for the photo. */
  alt: string;
  style?: StyleProp<ViewStyle>;
  /** Small overlay label in the image's corner — e.g. "Vegan". Shown whenever
   * passed, on the real photo or the icon fallback alike (the fact is still
   * true either way). Omit when it doesn't apply. */
  badge?: string;
}

/**
 * The representative food photo on a recommendation card — a small, supporting
 * visual for the "what should I eat" decision (visual-redesign brief §17: the
 * image supports the decision, it never overpowers it). Compact fixed-height
 * frame, skeleton while loading, fades in on load. If there's no image, or the
 * URL fails, it falls back to a small food icon on a branded tint — never a
 * broken image or a big empty box. Attribution sits subtly beneath, per the
 * Pexels/Unsplash API terms. Web counterpart: apps/web/components/FoodImage.tsx.
 */
export function FoodImage({ image, alt, style, badge }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const opacity = useRef(new Animated.Value(0)).current;

  const handleLoad = () => {
    setStatus('loaded');
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  if (!image || status === 'error') {
    return (
      <View style={style}>
        <View style={[styles.frame, styles.frameFallback]}>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={styles.fallbackIcon} accessibilityLabel={alt || 'food'}>
            🍽️
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <View style={styles.frame}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {status === 'loading' ? <View style={[StyleSheet.absoluteFill, styles.skeleton]} /> : null}
        <Animated.Image
          source={{ uri: image.url }}
          accessibilityLabel={alt}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity }]}
          onLoad={handleLoad}
          onError={() => setStatus('error')}
        />
      </View>

      {status === 'loaded' ? (
        <Text style={styles.credit}>
          Photo: {image.photographer} /{' '}
          <Text style={styles.creditLink} onPress={() => Linking.openURL(image.sourceUrl)}>
            {PROVIDER_LABEL[image.provider]}
          </Text>
          {image.isRepresentative ? ' · representative image' : ''}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    frame: {
      width: '100%',
      height: 124,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surfaceSunken,
    },
    frameFallback: {
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    fallbackIcon: {
      fontSize: 24,
      opacity: 0.55,
    },
    // Small dietary-fact overlay ("Vegan" etc.) — zIndex so it sits above
    // the photo/skeleton regardless of sibling order.
    badge: {
      position: 'absolute',
      top: 8,
      left: 8,
      zIndex: 2,
      backgroundColor: c.success,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    badgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    skeleton: {
      backgroundColor: c.surfaceSunken,
    },
    credit: { marginTop: 6, marginHorizontal: 2, fontSize: 10, lineHeight: 13, color: c.textFaint },
    creditLink: { textDecorationLine: 'underline', color: c.textFaint },
  });
}
