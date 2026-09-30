import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Badge } from '@/components/ui/badge';

export function Meter({ percent, tone }: { percent: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const auto = percent > 85 ? 'bg-destructive' : percent > 65 ? 'bg-warning' : 'bg-primary';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-all', tone ? { ok: 'bg-success', warn: 'bg-warning', danger: 'bg-destructive' }[tone] : auto)} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = status === 'ok' ? 'status.ok' : status === 'warn' ? 'status.warn' : status === 'err' ? 'status.err' : 'status.off';
  const variant = status === 'ok' ? 'success' : status === 'warn' ? 'warning' : status === 'err' ? 'destructive' : 'outline';
  return (
    <Badge variant={variant} className="gap-1.5 px-2.5">
      <span className={cn('inline-block size-1.5 rounded-full', status === 'ok' ? 'bg-success' : status === 'warn' ? 'bg-warning' : status === 'err' ? 'bg-destructive' : 'bg-muted-foreground')} />
      {t(key)}
    </Badge>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">{children}</kbd>;
}
