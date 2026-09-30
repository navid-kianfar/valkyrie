import { cn } from '@/lib/utils';
import { engineOf, type SourceWithStats } from '@/hooks/use-sources';

export function BrandChip({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-foreground shadow-sm"
      style={{ width: size, height: size, borderRadius: Math.round(size / 4.4) }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
        <path d="m8.5 9 3.5 7 3.5-7" />
      </svg>
    </span>
  );
}

export function EngineChip({ source, lg = false }: { source: SourceWithStats; lg?: boolean }) {
  const engine = engineOf(source);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-mono font-extrabold text-white',
        lg ? 'h-10 w-10 rounded-xl text-lg' : 'h-5 w-5 text-[10px]',
        engine === 'V' ? 'bg-emerald-600' : 'bg-red-600',
      )}
    >
      {engine}
    </span>
  );
}

export function StatusDot({ status, pulse }: { status: string; pulse?: boolean }) {
  const cls =
    status === 'ok' ? 'bg-success' : status === 'warn' ? 'bg-warning' : status === 'err' ? 'bg-destructive' : 'bg-muted-foreground';
  return (
    <span className="relative inline-flex">
      <span className={cn('inline-block size-2 rounded-full', cls)} />
      {pulse && status === 'ok' && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', cls)} />}
    </span>
  );
}

