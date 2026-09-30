import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSources } from '@/hooks/use-sources';
import { formatMs, formatNumber, formatTime } from '@/lib/format';
import { PageHeader } from '@/components/kit-extra';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, ChevronRight, Download, Key, Layers, Lock, Plus, SlidersHorizontal, Terminal, Trash2, X } from '@/components/icons';

interface Item { id: number; at: string; operation: string; target: string; sourceId: number | null; sourceName: string | null; via: string; status: string; durationMs: number | null; detail: string | null; }

const OPERATIONS = ['auth.login', 'source.create', 'source.update', 'source.delete', 'key.create', 'key.update', 'key.delete', 'key.ttl', 'key.rename', 'config.set', 'exec', 'bulk.delete', 'bulk.expire', 'export'];

/** Operation → badge tone + icon, mirroring the concept's log rows. */
const OP_STYLE: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Key }> = {
  'auth.login': { variant: 'outline', icon: Lock },
  'source.create': { variant: 'default', icon: Layers },
  'source.update': { variant: 'secondary', icon: SlidersHorizontal },
  'source.delete': { variant: 'destructive', icon: Trash2 },
  'key.create': { variant: 'default', icon: Plus },
  'key.update': { variant: 'secondary', icon: Key },
  'key.delete': { variant: 'destructive', icon: Trash2 },
  'key.ttl': { variant: 'secondary', icon: Activity },
  'key.rename': { variant: 'secondary', icon: Key },
  'config.set': { variant: 'secondary', icon: SlidersHorizontal },
  exec: { variant: 'secondary', icon: Terminal },
  'bulk.delete': { variant: 'destructive', icon: Trash2 },
  'bulk.expire': { variant: 'destructive', icon: Trash2 },
  export: { variant: 'secondary', icon: Download },
};

const RANGES = [
  { id: 'all', hours: 0 },
  { id: '1h', hours: 1 },
  { id: '24h', hours: 24 },
  { id: '7d', hours: 24 * 7 },
] as const;

export function ActivityPage() {
  const { t, locale } = useI18n();
  const { data: sources } = useSources();
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const qs = new URLSearchParams({ page: String(page), size: '25' });
  if (operation !== 'all') qs.set('operation', operation);
  if (sourceFilter !== 'all') qs.set('sourceId', sourceFilter);
  if (status !== 'all') qs.set('status', status);
  if (search.trim()) qs.set('search', search.trim());
  const rangeHours = RANGES.find((r) => r.id === range)?.hours ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ['activity', qs.toString(), range],
    queryFn: () => {
      /* the cutoff is evaluated per fetch, so the window keeps sliding */
      const params = new URLSearchParams(qs);
      if (rangeHours > 0) params.set('since', String(Date.now() - rangeHours * 3600_000));
      return api.get<{ items: Item[]; page: number; size: number; total: number }>(`/activity?${params}`);
    },
    refetchInterval: 10000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const filtersActive = operation !== 'all' || sourceFilter !== 'all' || status !== 'all' || range !== 'all' || search.trim() !== '';

  function clearFilters() {
    setOperation('all'); setSourceFilter('all'); setStatus('all'); setRange('all'); setSearch(''); setPage(1);
  }

  /** Walks every page of the current filter set and downloads it as CSV. */
  async function exportCsv() {
    setExporting(true);
    try {
      const all: Item[] = [];
      let p = 1;
      for (;;) {
        const params = new URLSearchParams(qs);
        params.set('page', String(p));
        params.set('size', '200');
        if (rangeHours > 0) params.set('since', String(Date.now() - rangeHours * 3600_000));
        const chunk = await api.get<{ items: Item[]; total: number }>(`/activity?${params}`);
        all.push(...chunk.items);
        if (all.length >= chunk.total || chunk.items.length === 0 || p > 100) break;
        p += 1;
      }
      const header = ['when', 'operation', 'target', 'source', 'via', 'status', 'durationMs', 'detail'];
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = all.map((i) => [i.at, i.operation, i.target, i.sourceName ?? '', i.via, i.status, i.durationMs ?? '', i.detail ?? ''].map(escape).join(','));
      const blob = new Blob([`${header.join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valkyrie-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  /** Compact pager: first, last and a window around the current page. */
  const pageItems = (() => {
    const items: (number | '…')[] = [];
    const push = (n: number) => { if (!items.includes(n)) items.push(n); };
    push(1);
    for (let n = page - 1; n <= page + 1; n++) if (n > 1 && n < totalPages) push(n);
    if (totalPages > 1) push(totalPages);
    const withGaps: (number | '…')[] = [];
    items.sort((a, b) => (a as number) - (b as number));
    items.forEach((n, i) => {
      if (i > 0 && (n as number) - (items[i - 1] as number) > 1) withGaps.push('…');
      withGaps.push(n);
    });
    return withGaps;
  })();

  return (
    <div>
      <PageHeader
        title={t('act.title')}
        desc={t('act.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={clearFilters} disabled={!filtersActive}><X className="size-4" />{t('act.clearFilters')}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" />{t('act.exportCsv')}</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border bg-card p-3.5 shadow-sm">
        <Input className="w-64" placeholder={t('act.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={operation} onValueChange={(v) => { setOperation(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('act.allOperations')}</SelectItem>
            {OPERATIONS.map((op) => <SelectItem key={op} value={op}>{t(`act.op.${op}` as never)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('act.allSources')}</SelectItem>
            {sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('act.anyStatus')}</SelectItem>
            <SelectItem value="ok">{t('act.status.ok')}</SelectItem>
            <SelectItem value="failed">{t('act.status.failed')}</SelectItem>
            <SelectItem value="blocked">{t('act.status.blocked')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => { setRange(v as typeof range); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.id} value={r.id}>{t(`act.range.${r.id}` as never)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('act.col.when')}</TableHead><TableHead>{t('act.col.operation')}</TableHead><TableHead>{t('act.col.target')}</TableHead>
              <TableHead>{t('act.col.source')}</TableHead><TableHead>{t('act.col.via')}</TableHead><TableHead>{t('act.col.status')}</TableHead>
              <TableHead className="text-end">{t('act.col.duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t('act.empty')}</TableCell></TableRow>}
            {data?.items.map((item) => {
              const style = OP_STYLE[item.operation];
              const OpIcon = style?.icon ?? Activity;
              const slow = item.status === 'ok' && (item.durationMs ?? 0) >= 1000;
              return (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatTime(item.at, locale)}</TableCell>
                  <TableCell>
                    <Badge variant={style?.variant ?? 'secondary'} className="whitespace-nowrap"><OpIcon className="size-3" />{t(`act.op.${item.operation}` as never)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-72 truncate font-mono text-xs" title={item.target}>{item.target}</TableCell>
                  <TableCell className="text-sm">{item.sourceName ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.via}</TableCell>
                  <TableCell>
                    {item.status === 'blocked'
                      ? <Badge variant="destructive" title={item.detail ?? undefined}><AlertTriangle className="size-3" />{t('act.status.blockedByGuard')}</Badge>
                      : item.status === 'failed'
                        ? <Badge variant="destructive"><AlertTriangle className="size-3" />{t('act.status.failed')}</Badge>
                        : slow
                          ? <Badge variant="warning">{t('act.status.slow', { s: ((item.durationMs ?? 0) / 1000).toFixed(1) })}</Badge>
                          : <Badge variant="success">{t('act.status.ok')}</Badge>}
                  </TableCell>
                  <TableCell className="text-end font-tabular text-muted-foreground">{item.durationMs !== null ? formatMs(item.durationMs, locale) : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{data ? t('act.entriesOf', { n: data.items.length, total: formatNumber(data.total, locale) }) : ''}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('act.prev')}><ChevronRight className="size-4 rotate-180" /></Button>
          {pageItems.map((n, i) => n === '…'
            ? <span key={`gap-${i}`} className="px-1.5 text-muted-foreground">…</span>
            : (
              <Button
                key={n}
                size="sm"
                variant={n === page ? 'default' : 'ghost'}
                className="min-w-8 font-tabular"
                onClick={() => setPage(n)}
              >{n}</Button>
            ))}
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label={t('act.next')}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
