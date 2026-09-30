import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Plus, Server } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', className)} />;
}

/** Standalone key-browser / console routes need a source before they can talk to Redis. */
export function NoSourcesNotice() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><Server className="size-6" /></div>
      <h2 className="text-lg font-bold tracking-tight">{t('common.registerSource')}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{t('common.registerSourceHint')}</p>
      <Button asChild className="mt-5"><Link to="/sources/new"><Plus className="size-4" />{t('dash.addServer')}</Link></Button>
    </div>
  );
}

/**
 * Source-scoped pages carry the same trail as the concept:
 * Dashboard › <source> › <page>.
 */
function Crumb({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="text-muted-foreground hover:text-primary">{children}</Link>;
}

export function Breadcrumbs({ sourceId, sourceName, current }: { sourceId?: number; sourceName?: string; current: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <Crumb to="/">{t('nav.dashboard')}</Crumb>
      <ChevronRight className="size-3" />
      {sourceId !== undefined && sourceName ? (
        <>
          <Crumb to={`/sources/${sourceId}`}>{sourceName}</Crumb>
          <ChevronRight className="size-3" />
        </>
      ) : null}
      <span className="text-muted-foreground">{current}</span>
    </nav>
  );
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
