import { ADS_ENABLED, type AdPlacement } from '../lib/ads';
import styles from './AdSlot.module.css';

interface Props {
  placement: AdPlacement;
}

/**
 * A reserved position for a future guest ad (guest-mode brief §14). Renders
 * nothing until ADS_ENABLED is on; when it is, a labelled placeholder — never
 * a real or fake ad network. Callers only mount this for guests and only in
 * the approved positions (below Decide results, foot of Eat Now results).
 */
export function AdSlot({ placement }: Props) {
  if (!ADS_ENABLED) return null;
  return (
    <div className={styles.slot} aria-label="Advertisement placeholder">
      Ad placeholder · {placement}
    </div>
  );
}
