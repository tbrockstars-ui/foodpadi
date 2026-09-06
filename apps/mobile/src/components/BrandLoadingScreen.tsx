import React from 'react';
import { ActivityIndicator, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const LOGO = require('../../assets/splash-icon.png');
const LEAF = require('../../assets/leaves.png');

// A JS render of the native splash (apps/mobile/assets/splash.png): the
// FoodPadi mark on a #14171A field, big and centred, with small leaves
// scattered around it. Fractions below are lifted straight from the splash
// compositor (logo 760px, leaves ~0.343 on a 1242-wide canvas) so the two
// screens match — and this one shows in Expo Go, where the native splash
// config is ignored.
const BG = '#14171A';
const LOGO_FRAC = 760 / 1242;

// { sizeFrac, xFrac, yFrac } are fractions of screen width; xFrac/yFrac are
// offsets from centre. rotate + flip give each leaf its own angle.
const LEAVES: { s: number; x: number; y: number; r: string; o: number; flip?: boolean }[] = [
  { s: 0.086, x: -0.29, y: -0.378, r: '25deg', o: 0.95 },
  { s: 0.056, x: 0.113, y: -0.419, r: '-35deg', o: 0.8, flip: true },
  { s: 0.076, x: 0.314, y: -0.201, r: '200deg', o: 0.95, flip: true },
  { s: 0.05, x: -0.346, y: 0.024, r: '120deg', o: 0.78 },
  { s: 0.083, x: 0.266, y: 0.346, r: '165deg', o: 0.95 },
  { s: 0.066, x: -0.242, y: 0.378, r: '60deg', o: 0.88, flip: true },
  { s: 0.04, x: -0.056, y: 0.499, r: '-15deg', o: 0.65 },
  { s: 0.04, x: 0.024, y: -0.499, r: '95deg', o: 0.65, flip: true },
];

export function BrandLoadingScreen() {
  const { width } = useWindowDimensions();
  const logo = Math.round(width * LOGO_FRAC);

  return (
    <View style={styles.root}>
      {LEAVES.map((l, i) => {
        const size = Math.round(width * l.s);
        return (
          <Image
            key={i}
            source={LEAF}
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              opacity: l.o,
              transform: [
                { translateX: Math.round(width * l.x) },
                { translateY: Math.round(width * l.y) },
                { rotate: l.r },
                ...(l.flip ? [{ scaleX: -1 }] : []),
              ],
            }}
          />
        );
      })}
      <Image source={LOGO} resizeMode="contain" style={{ width: logo, height: logo }} />
      <ActivityIndicator color="#5BBD8F" size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  spinner: { position: 'absolute', bottom: '12%' },
});
