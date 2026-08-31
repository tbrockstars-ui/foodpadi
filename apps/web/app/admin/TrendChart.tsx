import styles from './admin.module.css';

interface Series {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  days: string[];
  series: Series[];
  width?: number;
  height?: number;
}

/** A dependency-free SVG line chart for the overview dashboard's 14-day
 * signup trend — small enough not to warrant pulling in a charting library. */
export function TrendChart({ days, series, width = 720, height = 200 }: Props) {
  const padding = { top: 12, right: 12, bottom: 24, left: 28 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const stepX = days.length > 1 ? innerWidth / (days.length - 1) : 0;

  const pointsFor = (values: number[]) =>
    values.map((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + innerHeight - (v / max) * innerHeight;
      return `${x},${y}`;
    });

  const gridLines = [0, 0.5, 1].map((frac) => padding.top + innerHeight * frac);
  const labelEvery = Math.ceil(days.length / 6);

  return (
    <svg
      className={styles.trendChart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sign-ups over the last 14 days"
    >
      {gridLines.map((y) => (
        <line key={y} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeWidth={1} />
      ))}

      {days.map((day, i) =>
        i % labelEvery === 0 ? (
          <text
            key={day}
            x={padding.left + i * stepX}
            y={height - 6}
            fontSize={10}
            fill="var(--text-faint)"
            textAnchor="middle"
          >
            {day.slice(5)}
          </text>
        ) : null,
      )}

      {series.map((s) => (
        <polyline
          key={s.label}
          points={pointsFor(s.values).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {series.map((s) =>
        s.values.map((v, i) => (
          <circle
            key={`${s.label}-${i}`}
            cx={padding.left + i * stepX}
            cy={padding.top + innerHeight - (v / max) * innerHeight}
            r={2.5}
            fill={s.color}
          />
        )),
      )}
    </svg>
  );
}
