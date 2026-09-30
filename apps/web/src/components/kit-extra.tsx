import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', className)} />;
}

export function PageHeader({ title, desc, actions }: { title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, icon, value, sub, meter, meterTone }: {
  label: React.ReactNode; icon?: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode;
  meter?: number; meterTone?: 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="relative rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-medium text-muted-foreground">{label}</div>
        {icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">{icon}</div>}
      </div>
      <div className="mt-1.5 text-[27px] font-extrabold leading-tight tracking-tight font-tabular">{value}</div>
      {meter !== undefined && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', meterTone === 'danger' ? 'bg-destructive' : meterTone === 'warn' ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(100, meter)}%` }} /></div>}
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
