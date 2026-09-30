import { useMemo } from 'react';
import { useId } from 'react';

export function AreaChart({ points, height = 140, color = 'hsl(var(--primary))' }: { points: number[]; height?: number; color?: string }) {
  const gid = useId().replace(/:/g, '');
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);
    const coords = points.map((p, i) => [i * step, 100 - ((p - min) / range) * 92 - 4] as const);
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    return { line, area: `${line} L100,100 L0,100 Z` };
  }, [points]);

  if (!path) return <div style={{ height }} />;
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
  const max = Math.max(...points, 1);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: '100%' }}>
      {points.map((p, i) => {
        const w = 70 / Math.max(points.length, 1);
        const x = i * (100 / Math.max(points.length, 1)) + w * 0.2;
        const h = (p / max) * 92 + 2;
        return <rect key={i} x={x} y={100 - h} width={w * 0.62} height={h} rx="1" fill={color} opacity="0.85" />;
      })}
    </svg>
  );
}

export function Sparkline({ points, width = 92, height = 26, color = 'hsl(var(--primary))' }: { points: number[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 3 - ((p - min) / range) * (height - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <path d={d} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
