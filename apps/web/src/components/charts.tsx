import { useId, useMemo } from 'react';

/** A flat or single-point series still needs a visible line, so pad the drawn range. */
function range(points: number[]) {
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const pad = (hi - lo) * 0.25 || Math.max(hi * 0.05, 1);
  return { lo: Math.max(0, lo - pad), hi: hi + pad };
}

function normalize(points: number[]): number[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0], points[0]];
  return points;
}

export function AreaChart({ points, height = 140, color = 'hsl(var(--primary))' }: { points: number[]; height?: number; color?: string }) {
  const gid = useId().replace(/:/g, '');
  const path = useMemo(() => {
    const data = normalize(points);
    if (data.length < 2) return null;
    const { lo, hi } = range(data);
    const span = hi - lo || 1;
    const step = 100 / (data.length - 1);
    const coords = data.map((p, i) => [i * step, 100 - ((p - lo) / span) * 92 - 4] as const);
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    return { line, area: `${line} L100,100 L0,100 Z` };
  }, [points]);

  if (!path) return <div style={{ height }} className="grid place-items-center text-xs text-muted-foreground" />;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: '100%' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Bars({ points, height = 110, color = 'hsl(var(--primary))' }: { points: number[]; height?: number; color?: string }) {
  const max = Math.max(...points, 0);
  if (points.length === 0) return <div style={{ height }} />;
  const slot = 100 / points.length;
  const barWidth = Math.min(slot * 0.62, 6);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: '100%' }}>
      <line x1="0" y1="99.6" x2="100" y2="99.6" stroke="hsl(var(--border))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => {
        const h = max > 0 ? (p / max) * 92 : 0;
        return (
          <rect
            key={i}
            x={i * slot + (slot - barWidth) / 2}
            y={100 - Math.max(h, p > 0 ? 2 : 0)}
            width={barWidth}
            height={Math.max(h, p > 0 ? 2 : 0)}
            rx="1"
            fill={color}
            opacity="0.85"
          />
        );
      })}
    </svg>
  );
}

export function Sparkline({ points, width = 92, height = 26, color = 'hsl(var(--primary))', className }: { points: number[]; width?: number; height?: number; color?: string; className?: string }) {
  if (points.length < 2) return null;
  const { lo, hi } = range(points);
  const span = hi - lo || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 3 - ((p - lo) / span) * (height - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className={className}>
      <path d={d} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
