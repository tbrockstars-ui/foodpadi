import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "reduce motion" accessibility setting. Every animation added
 * in the declutter pass (press-scale, fade-in, layout expand/collapse) checks
 * this and falls back to an instant, non-animated result when it's on — so
 * the redesign never trades accessibility for polish (visual-redesign brief
 * §19/§22).
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}
