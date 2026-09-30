import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Clock, Grid2X2, HardDrive, Key, List, MoreHorizontal, Pencil, Plus, Server, Terminal, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { engineOf, useSources } from '@/hooks/use-sources';
import { api } from '@/lib/api';
import { formatBytes, formatNumber } from '@/lib/format';
import { PageHeader, StatCard } from '@/components/kit-extra';
import { Meter } from '@/components/kit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EngineChip, StatusDot } from '@/components/brand';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: sources, isLoading } = useSources();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  if (isLoading || !sources) return <DashboardSkeleton />;

  if (sources.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary"><Server className="size-7" /></div>
        <h1 className="text-2xl font-bold tracking-tight">{t('welcome.title')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('welcome.subtitle')}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link to="/sources/new"><Plus className="size-4" />{t('dash.addServer')}</Link></Button>
          <Button variant="outline" onClick={() => navigate('/welcome')}><Grid2X2 className="size-4" />{t('welcome.scanTitle')}</Button>
        </div>
      </div>
    );
  }

  const ok = sources.filter((s) => s.stats.status === 'ok').length;
  const err = sources.length - ok;
  const totalKeys = sources.reduce((sum, s) => sum + s.stats.totalKeys, 0);
  const usedMemory = sources.reduce((sum, s) => sum + s.stats.usedMemory, 0);
  const maxMemory = sources.reduce((sum, s) => sum + s.stats.maxMemory, 0);
  const ops = sources.reduce((sum, s) => sum + s.stats.opsPerSec, 0);
  const hitRates = sources.filter((s) => s.stats.status === 'ok' && (s.stats.hitRate || 0) > 0);
  const hitRate = hitRates.length ? Math.round((hitRates.reduce((sum, s) => sum + s.stats.hitRate, 0) / hitRates.length) * 10) / 10 : 0;

  async function removeSource() {
    if (removeTarget === null) return;
    await api.del(`/sources/${removeTarget}`);
    void qc.invalidateQueries({ queryKey: ['sources'] });
    toast.success(t('dash.removed'));
    setRemoveTarget(null);
  }

  async function testConnection(id: number) {
    const res = await api.post<{ ok: boolean; error?: string }>(`/sources/${id}/test`);
    if (res.ok) toast.success(t('dash.healthOk'));
    else toast.error(t('dash.stillDown'), { description: res.error });
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dash.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dash.onlineOf', { online: ok, offline: err })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-secondary p-0.5">
            <button className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', view === 'grid' && 'bg-card shadow-sm')} onClick={() => setView('grid')}><Grid2X2 className="size-3.5" />{t('dash.grid')}</button>
            <button className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', view === 'list' && 'bg-card shadow-sm')} onClick={() => setView('list')}><List className="size-3.5" />{t('dash.list')}</button>
          </div>
          <Button asChild><Link to="/sources/new"><Plus className="size-4" />{t('dash.addServer')}</Link></Button>
        </div>
      </header>

      <div className="mb-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <StatCard label={t('dash.statSources')} icon={<Server className="size-4" />} value={formatNumber(sources.length, locale)} sub={<span className="inline-flex items-center gap-1.5"><StatusDot status="ok" />{t('dash.onlineOf', { online: ok, offline: err })}</span>} />
        <StatCard label={t('dash.statKeys')} icon={<Key className="size-4" />} value={formatNumber(totalKeys, locale)} />
        <StatCard label={t('dash.statMemory')} icon={<HardDrive className="size-4" />} value={<> {formatBytes(usedMemory, locale)}{maxMemory > 0 && <span className="text-sm font-medium text-muted-foreground"> / {formatBytes(maxMemory, locale)}</span>}</>} meter={maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0} />
        <StatCard label={t('dash.statOps')} icon={<Activity className="size-4" />} value={formatNumber(ops, locale)} />
        <StatCard label={t('dash.statHitRate')} icon={<Activity className="size-4" />} value={`${formatNumber(hitRate, locale, 1)}%`} meter={hitRate} meterTone="ok" />
      </div>

      <div className={cn('grid gap-4', view === 'grid' ? '[grid-template-columns:repeat(auto-fill,minmax(335px,1fr))]' : 'grid-cols-1 gap-2.5')}>
        {sources.map((s) => (
          <SourceCard key={s.id} source={s} view={view} onRemove={() => setRemoveTarget(s.id)} onTest={() => testConnection(s.id)} />
        ))}
      </div>

      <AlertDialog open={removeTarget !== null} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dash.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dash.removeDesc', { name: sources.find((s) => s.id === removeTarget)?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox defaultChecked />{t('dash.removeAlso')}
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={removeSource}>{t('dash.removeConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SourceCard({ source: s, view, onRemove, onTest }: {
  source: NonNullable<ReturnType<typeof useSources>['data']>[number];
  view: 'grid' | 'list';
  onRemove: () => void;
  onTest: () => void;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const stats = s.stats;
  const memPercent = stats.maxMemory > 0 ? Math.round((stats.usedMemory / stats.maxMemory) * 100) : 0;
  const memTone = stats.maxMemory > 0 && memPercent > 85 ? 'danger' : stats.maxMemory > 0 && memPercent > 65 ? 'warn' : 'ok';
  const uptimeH = Math.floor((stats.uptimeDays || 0));

  const badges = (
    <div className="flex flex-wrap gap-1.5">
      <Badge>{stats.version ?? ''}</Badge>
      <Badge variant="outline">{t(`dash.mode.${s.mode}` as never)}</Badge>
      {s.group !== 'Default' && <Badge variant="secondary">{s.group}</Badge>}
    </div>
  );
  const metrics = (
    <div className="grid grid-cols-3 gap-2">
      {[[formatNumber(stats.totalKeys, locale), t('common.keys')], [formatNumber(stats.connectedClients, locale), t('dash.clients')], [`${formatNumber(stats.opsPerSec, locale)}/s`, t('dash.ops')]].map(([v, l], i) => (
        <div key={i}><b className="block text-sm font-bold font-tabular">{v}</b><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</span></div>
      ))}
    </div>
  );

  if (view === 'list') {
    return (
      <Card className="flex flex-row items-center gap-4 p-4 hover:shadow-md">
        <EngineChip source={s} lg />
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-sm font-bold"><Link to={`/sources/${s.id}`} className="hover:text-primary">{s.name}</Link><StatusDot status={stats.status} pulse /></div>
          <div className="font-mono text-xs text-muted-foreground">{s.host}:{s.port}</div>
        </div>
        <div className="hidden md:block">{badges}</div>
        <div className="hidden lg:grid grid-cols-3 gap-5">{metrics}</div>
        <div className="ms-auto flex items-center gap-1.5">
          <StatusDot status={stats.status} />
          <Button asChild variant="ghost" size="icon"><Link to={`/sources/${s.id}/keys`}><Key className="size-4" /></Link></Button>
          <Button asChild variant="ghost" size="icon"><Link to={`/sources/${s.id}/cli`}><Terminal className="size-4" /></Link></Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <EngineChip source={s} lg />
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight"><Link to={`/sources/${s.id}`} className="hover:text-primary truncate">{s.name}</Link><StatusDot status={stats.status} pulse /></div>
            <div className="font-mono text-xs text-muted-foreground">{s.host}:{s.port}</div>
          </div>
        </div>
        {badges}
        {stats.status !== 'err' ? (
          <>
            <div className="grid grid-cols-3 gap-2 border-t border-dashed pt-3.5">{metrics}</div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{t('dash.memory')}</span>
                <span className="font-tabular"><b className="text-foreground">{formatBytes(stats.usedMemory, locale)}</b>{stats.maxMemory > 0 && ` / ${formatBytes(stats.maxMemory, locale)}`}</span>
              </div>
              <Meter percent={memPercent} tone={memTone} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2 border-t border-dashed pt-3.5">
            {['—', '—', '—'].map((v, i) => <div key={i}><b className="block text-sm font-bold">{v}</b><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{[t('common.keys'), t('dash.clients'), t('dash.ops')][i]}</span></div>)}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t">
        {stats.status !== 'err' ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />{t('server.uptime', { d: uptimeH })}</span>
        ) : (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={onTest}>{t('dash.retryNow')}</button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate(`/sources/${s.id}/keys`)}><Key />{t('dash.menuBrowse')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/sources/${s.id}/cli`)}><Terminal />{t('dash.menuConsole')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onTest}><Activity />{t('dash.menuTest')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(`/sources/${s.id}/edit`)}><Pencil />{t('dash.menuEdit')}</DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onRemove}><Trash2 />{t('dash.menuRemove')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

function DashboardSkeleton() {
  const { t } = useI18n();
  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-7 w-36" /><Skeleton className="h-4 w-64" /></div>
        <div className="flex gap-2"><Skeleton className="h-9 w-24 rounded-md" /><Skeleton className="h-9 w-28 rounded-md" /></div>
      </header>
      <div className="mb-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4"><div className="flex justify-between"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="size-9 rounded-lg" /></div><Skeleton className="mt-2 h-7 w-2/5" /><Skeleton className="mt-3 h-3 w-3/4" /></Card>
        ))}
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(335px,1fr))]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3.5">
              <div className="flex items-start gap-3"><Skeleton className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-2/5" /></div></div>
              <div className="flex gap-1.5"><Skeleton className="h-5 w-20 rounded-md" /><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div>
              <div className="grid grid-cols-3 gap-2 border-t border-dashed pt-3.5"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-14" /></div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </CardContent>
            <CardFooter className="border-t"><Skeleton className="h-3 w-1/3" /><Skeleton className="ms-auto h-6 w-20" /></CardFooter>
          </Card>
        ))}
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

