import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

interface Props {
  children: React.ReactNode;
  /** Stagger offset in ms — pass `index * 40` inside a mapped list. */
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A one-shot entrance: fade from 0 → 1 with a small upward drift, ~220ms
 * (visual-redesign brief §19 — 200-300ms, subtle, no bounce). Used to bring
 * in results lists, plan-day cards and profile sections a touch more softly
 * than a hard pop. Renders its children instantly (no wrapper animation)
 * when the OS "reduce motion" setting is on.
 */
export function FadeInView({ children, delay = 0, duration = 220, style }: Props) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
