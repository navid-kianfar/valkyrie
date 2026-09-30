import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, ArrowRight, Pencil, Save, Server } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useSource, useSourceStats } from '@/hooks/use-sources';
import { api } from '@/lib/api';
import { formatBytes, formatMs, formatNumber } from '@/lib/format';
import { PageHeader, StatCard } from '@/components/kit-extra';
import { AreaChart, Bars } from '@/components/charts';
import { EngineChip, StatusDot } from '@/components/brand';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export function SourceDetailPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { data: source } = useSource(id);
  const { data: stats } = useSourceStats(id);
  const [flushOpen, setFlushOpen] = useState(false);
  const [flushWord, setFlushWord] = useState('');
  const [flushUnderstand, setFlushUnderstand] = useState(false);
  const dbs = stats?.keyspace ?? [];

  if (!source || !stats) return <DetailSkeleton />;

  const memPercent = stats.maxMemory > 0 ? Math.round((stats.usedMemory / stats.maxMemory) * 100) : 0;
  const topNs = [...dbs].sort((a, b) => b.keys - a.keys).slice(0, 4);

  async function flushDb() {
    const word = flushTarget();
    await api.post(`/sources/${id}/exec`, { command: `SELECT ${word.replace('db', '')}` });
    await api.post(`/sources/${id}/exec`, { command: 'FLUSHDB' }).catch((e) => { toast.error(String(e.message ?? e)); return null; });
    toast.success(t('server.flush.done'));
    setFlushOpen(false);
  }
  function flushTarget() { return 'db0'; }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <EngineChip source={source} lg />
          <div>
            <h1 className="flex items-center gap-3 font-mono text-2xl font-bold tracking-tight">
              {source.name} <StatusDot status={stats.status} pulse />
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>{stats.engine ?? ''} {stats.version ?? ''}</span>·<span>{source.host}:{source.port}</span>·<span>{t('server.role')} {stats.role ?? '—'}</span>·<span>{t('server.uptime', { d: stats.uptimeDays })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link to={`/sources/${id}/cli`}><Activity className="size-4" />{t('dash.menuConsole')}</Link></Button>
          <Button asChild variant="outline"><Link to={`/sources/${id}/edit`}><Pencil className="size-4" />{t('server.editConnection')}</Link></Button>
          <Button variant="outline" onClick={() => setFlushOpen(true)}>{t('server.flushMenu')}</Button>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="mb-5 flex w-full flex-wrap gap-0 bg-transparent p-0">
          {[['overview', t('server.tabOverview')], ['databases', t('server.tabDatabases')], ['slowlog', t('server.tabSlowlog')], ['clients', t('server.tabClients')], ['config', t('server.tabConfig')]].map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 pt-1 shadow-none data-[state=active]:rounded-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(215px,1fr))]">
            <StatCard label={t('server.overview.memory')} value={<>{formatBytes(stats.usedMemory, locale)}{stats.maxMemory > 0 && <span className="text-sm font-medium text-muted-foreground"> / {formatBytes(stats.maxMemory, locale)}</span>}</>} meter={memPercent} sub={stats.maxMemory > 0 ? t('server.overview.maxMemory', { max: formatBytes(stats.maxMemory, locale) }) : t('server.overview.unlimited')} />
            <StatCard label={t('server.overview.clients')} value={formatNumber(stats.connectedClients, locale)} sub={t('server.overview.blocked', { n: stats.blockedClients, max: 10000 })} />
            <StatCard label={t('server.overview.ops')} value={formatNumber(stats.opsPerSec, locale)} sub={`${t('server.overview.peak', { mem: formatNumber(Math.max(...(stats.history?.map((h) => h.opsPerSec) || [0])), locale) })}`} />
            <StatCard label={t('server.overview.hitRate')} value={`${formatNumber(stats.hitRate, locale, 1)}%`} meter={stats.hitRate} meterTone="ok" />
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between p-5 pb-3">
                <div><div className="text-[15px] font-semibold">{t('server.chart.memory')}</div><div className="text-[13px] text-muted-foreground">{t('server.chart.memoryDesc')}</div></div>
              </div>
              <div className="px-3 pb-3"><AreaChart points={(stats.history || []).map((h) => h.usedMemory)} height={170} /></div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border bg-card shadow-sm"><div className="p-5 pb-3 text-[15px] font-semibold">{t('server.chart.ops')}</div><div className="px-3 pb-3"><Bars points={(stats.history || []).map((h) => h.opsPerSec)} height={110} /></div></div>
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-2 text-[15px] font-semibold">{t('server.replication')}</div>
                <div className="flex flex-col">
                  {[['Role', stats.role ?? '—'], [t('server.replication.replicas'), '—'], [t('server.overview.frag', { ratio: '' }), formatNumber(stats.memFragmentation, locale, 2)]].map(([k, v], i) => (
                    <div key={i} className="flex justify-between border-b border-dashed py-2 text-[13px] last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between p-5 pb-3">
              <div><div className="text-[15px] font-semibold">{t('server.keyspace')}</div><div className="text-[13px] text-muted-foreground">{t('server.keyspaceDesc', { n: topNs.length, total: dbs.length })}</div></div>
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader><TableRow><TableHead>{t('server.keyspace.db')}</TableHead><TableHead className="text-end">{t('common.keys')}</TableHead><TableHead className="text-end">{t('server.keyspace.withTtl')}</TableHead><TableHead className="text-end">{t('server.keyspace.avgTtl')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {topNs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('server.slowlog.empty')}</TableCell></TableRow>}
                  {topNs.map((k) => (
                    <TableRow key={k.db}>
                      <TableCell className="font-mono font-semibold">db{k.db}</TableCell>
                      <TableCell className="text-end font-tabular">{formatNumber(k.keys, locale)}</TableCell>
                      <TableCell className="text-end font-tabular">{formatNumber(k.expires, locale)}</TableCell>
                      <TableCell className="text-end font-tabular">{k.avgTtl > 0 ? formatMs(k.avgTtl / 1000, locale) : t('server.keyspace.none')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="databases">
          <p className="mb-3 text-sm text-muted-foreground">{t('server.databasesHint')}</p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(215px,1fr))]">
            {dbs.map((db) => (
              <Link key={db.db} to={`/sources/${id}/keys?db=${db.db}`} className={cn('group relative rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-px hover:shadow-md', db.keys === 0 && 'opacity-60')}>
                <ArrowRight className="absolute end-3 top-3.5 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
                <div className="font-mono text-[13px] font-bold">db{db.db}</div>
                <div className="mt-1.5 text-xl font-extrabold font-tabular">{formatNumber(db.keys, locale)}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{t('dash.expires', { n: formatNumber(db.expires, locale) })}</div>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="slowlog"><SlowLogPanel sourceId={id} /></TabsContent>
        <TabsContent value="clients"><ClientsPanel sourceId={id} /></TabsContent>
        <TabsContent value="config"><ConfigPanel sourceId={id} /></TabsContent>
      </Tabs>

      <AlertDialog open={flushOpen} onOpenChange={setFlushOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('server.flush.title', { db: 'db0', source: source.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('server.flush.desc', { keys: formatNumber(dbs[0]?.keys ?? 0, locale) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('server.flush.typeWord', { word: 'db0' })}</label>
            <Input value={flushWord} onChange={(e) => setFlushWord(e.target.value)} placeholder="db0" className="font-mono" />
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox checked={flushUnderstand} onCheckedChange={(v) => setFlushUnderstand(v === true)} />
              {t('server.flush.understand')}
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
              disabled={flushWord !== 'db0' || !flushUnderstand}
              onClick={flushDb}
            >{t('server.flush.execute', { db: 'db0' })}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <span className="hidden"><Server className="size-4" /></span>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4"><Skeleton className="size-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3.5 w-80" /></div></div>
      <Skeleton className="mb-5 h-9 w-96" />
      <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(215px,1fr))]">
        {[1, 2, 3, 4].map((i) => <div key={i} className="space-y-2 rounded-xl border bg-card p-4"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-7 w-2/5" /><Skeleton className="h-1.5 w-full rounded-full" /><Skeleton className="h-3 w-2/3" /></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3 rounded-xl border bg-card p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-44 w-full" /></div>
        <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="space-y-3 rounded-xl border bg-card p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-24 w-full" /></div>)}</div>
      </div>
    </div>
  );
}

function SlowLogPanel({ sourceId }: { sourceId: number }) {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<{ id: number; at: string; durationMs: number; args: string[]; client: string }[] | null>(null);
  useMemo(() => {
    api.get<{ id: number; at: string; durationMs: number; args: string[]; client: string }[]>(`/sources/${sourceId}/slowlog?count=25`).then(setEntries).catch(() => setEntries([]));
  }, [sourceId]);
  if (entries === null) return <Skeleton className="h-48 w-full rounded-xl" />;
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader><TableRow><TableHead>{t('server.slowlog.when')}</TableHead><TableHead>{t('server.slowlog.command')}</TableHead><TableHead className="text-end">{t('server.slowlog.duration')}</TableHead><TableHead className="text-end">{t('server.slowlog.client')}</TableHead></TableRow></TableHeader>
        <TableBody>
          {entries.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('server.slowlog.empty')}</TableCell></TableRow>}
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</TableCell>
              <TableCell className="font-mono text-xs">{e.args.join(' ').slice(0, 80)}</TableCell>
              <TableCell className={cn('text-end font-tabular', e.durationMs > 100 && 'font-bold text-destructive')}>{formatMs(e.durationMs, locale)}</TableCell>
              <TableCell className="text-end font-mono text-xs">{e.client}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientsPanel({ sourceId }: { sourceId: number }) {
  const { t, locale } = useI18n();
  const [clients, setClients] = useState<Record<string, string>[] | null>(null);
  const qc = useQueryClientSafe();
  useMemo(() => {
    api.get<Record<string, string>[]>(`/sources/${sourceId}/clients`).then(setClients).catch(() => setClients([]));
  }, [sourceId]);
  if (clients === null) return <Skeleton className="h-48 w-full rounded-xl" />;
  async function kill(id: string) {
    await api.post(`/sources/${sourceId}/exec`, { command: `CLIENT KILL ID ${id}` });
    toast.success(t('server.clients.killed'));
    qc.invalidateQueries();
  }
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader><TableRow><TableHead>{t('server.clients.id')}</TableHead><TableHead>{t('server.clients.address')}</TableHead><TableHead>{t('common.name')}</TableHead><TableHead className="text-end">{t('server.clients.age')}</TableHead><TableHead className="text-end">{t('server.clients.idle')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.id}</TableCell>
              <TableCell className="font-mono text-xs">{c.addr}</TableCell>
              <TableCell>{c.name || '—'}</TableCell>
              <TableCell className="text-end font-tabular">{Number(c.age)}s</TableCell>
              <TableCell className="text-end font-tabular">{Number(c.idle)}s</TableCell>
              <TableCell>{Number(c.db) >= 0 ? <Badge className="font-mono">db{c.db}</Badge> : <Badge variant="outline">{c.flags}</Badge>}</TableCell>
              <TableCell className="text-end"><Button variant="ghost" size="sm" onClick={() => kill(c.id)}>{t('server.clients.kill')}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
function useQueryClientSafe() { return useQueryClient(); }

function ConfigPanel({ sourceId }: { sourceId: number }) {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<{ key: string; value: string }[] | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  useMemo(() => {
    api.get<{ key: string; value: string }[]>(`/sources/${sourceId}/config`).then(setEntries).catch(() => setEntries([]));
  }, [sourceId]);
  const filtered = (entries || []).filter((e) => ['maxmemory', 'maxmemory-policy', 'appendonly', 'save', 'slowlog', 'timeout', 'databases', 'maxclients', 'tcp-keepalive'].some((f) => e.key.startsWith(f)));
  if (entries === null) return <Skeleton className="h-64 w-full rounded-xl" />;
  return (
    <div>
      <div className="mb-4 rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>{t('server.config.parameter')}</TableHead><TableHead>{t('server.config.value')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const changed = dirty[e.key] !== undefined && dirty[e.key] !== e.value;
              return (
                <TableRow key={e.key}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {e.key}
                    {changed && <span title={t('server.config.modified')} className="ms-2 inline-block size-1.5 rounded-full bg-warning" />}
                  </TableCell>
                  <TableCell>
                    <Input className="h-8 w-56 font-mono text-xs" value={dirty[e.key] ?? e.value} onChange={(ev) => setDirty((d) => ({ ...d, [e.key]: ev.target.value }))} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {Object.keys(dirty).filter((k) => entries.find((e) => e.key === k)?.value !== dirty[k]).length > 0 && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-md">
          <b className="text-sm">{t('server.config.unsaved', { n: Object.keys(dirty).filter((k) => entries.find((e) => e.key === k)?.value !== dirty[k]).length })}</b>
          <span className="text-xs text-muted-foreground">{t('server.config.rewriteNote')}</span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setDirty({})}>{t('server.config.discard')}</Button>
          <Button size="sm" onClick={async () => {
            const applied = Object.fromEntries(Object.entries(dirty).filter(([k, v]) => entries.find((e) => e.key === k)?.value !== v));
            await api.patch(`/sources/${sourceId}/config`, { entries: applied });
            toast.success(t('server.config.applied'));
            setDirty({});
          }}>{t('server.config.apply')}</Button>
        </div>
      )}
      <span className="hidden">{t('common.loading')} {formatNumber(0, locale)}</span>
    </div>
  );
}
