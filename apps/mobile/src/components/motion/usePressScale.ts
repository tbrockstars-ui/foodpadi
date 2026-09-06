import { useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * Subtle press feedback for cards and buttons — a gentle scale to 0.97 on
 * press-in, back to 1 on release (visual-redesign brief §19: selection
 * feedback should feel premium, ~120-150ms, never bouncy). Uses the native
 * driver so it stays smooth on the JS thread, and is a no-op when the OS
 * "reduce motion" setting is on.
 *
 *   const press = usePressScale();
 *   <AnimatedTouchable onPressIn={press.onPressIn} onPressOut={press.onPressOut}
 *     style={[styles.card, press.style]} />
 */
export function usePressScale(activeScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const animateTo = (toValue: number, duration: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue, duration, useNativeDriver: true }).start();
  };

  return {
    onPressIn: () => animateTo(activeScale, 120),
    onPressOut: () => animateTo(1, 150),
    style: { transform: [{ scale }] },
  };
}
