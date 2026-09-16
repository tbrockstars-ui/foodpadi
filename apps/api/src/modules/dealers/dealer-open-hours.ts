// Very small, conservative "is this dealer open right now" check. Only returns
// a boolean when the day's value is cleanly a "HH:MM-HH:MM" (or comma-separated
// ranges) — anything else (free text like "By appointment", "Closed", a range
// spanning midnight, an unparseable string) returns null = unknown, and the
// ranking model treats unknown as neutral (dealer brief §27, same posture as
// local-food-search's raw opening_hours passthrough — we never *assert* an
// open/closed status we're not sure of).

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function isDealerOpenNow(
  openingHours: unknown,
  now: Date = new Date(),
): boolean | null {
  if (!openingHours || typeof openingHours !== 'object' || Array.isArray(openingHours)) return null;
  const map = openingHours as Record<string, unknown>;
  const dayKey = DAY_KEYS[now.getDay()];
  const raw = map[dayKey];
  if (typeof raw !== 'string') return null;

  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/(closed|shut)/.test(value)) return false;

  const ranges = value.split(',').map((r) => r.trim());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let sawValidRange = false;

  for (const r of ranges) {
    const m = /^(\d{1,2}):(\d{2})\s*[-–to]+\s*(\d{1,2}):(\d{2})$/.exec(r.replace(/\s+/g, ' '));
    if (!m) continue;
    sawValidRange = true;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (end <= start) return null; // spans midnight / malformed — don't guess
    if (nowMin >= start && nowMin < end) return true;
  }

  return sawValidRange ? false : null;
}
