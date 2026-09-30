import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

interface Item { id: number; at: string; operation: string; target: string; sourceId: number | null; sourceName: string | null; via: string; status: string; durationMs: number | null; }

const OPERATIONS = ['auth.login', 'source.create', 'source.update', 'source.delete', 'key.create', 'key.update', 'key.delete', 'key.ttl', 'key.rename', 'config.set', 'exec', 'bulk.delete', 'bulk.expire', 'export'];

export function ActivityPage() {
  const { t, locale } = useI18n();
  const { data: sources } = useSources();
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const qs = new URLSearchParams({ page: String(page), size: '25' });
  if (operation !== 'all') qs.set('operation', operation);
  if (sourceFilter !== 'all') qs.set('sourceId', sourceFilter);
  if (status !== 'all') qs.set('status', status);
  if (search.trim()) qs.set('search', search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ['activity', qs.toString()],
    queryFn: () => api.get<{ items: Item[]; page: number; size: number; total: number }>(`/activity?${qs}`),
    refetchInterval: 10000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div>
      <PageHeader title={t('act.title')} desc={t('act.subtitle')} />
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
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('act.col.when')}</TableHead><TableHead>{t('act.col.operation')}</TableHead><TableHead>{t('act.col.target')}</TableHead>
              <TableHead>{t('act.col.source')}</TableHead><TableHead>{t('act.col.via')}</TableHead><TableHead>{t('act.col.status')}</TableHead><TableHead className="text-end">{t('act.col.duration')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t('act.empty')}</TableCell></TableRow>}
            {data?.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatTime(item.at, locale)}</TableCell>
                <TableCell><Badge variant={item.operation.startsWith('key.delete') || item.operation === 'bulk.delete' || item.operation === 'source.delete' ? 'destructive' : item.operation === 'auth.login' ? 'outline' : 'secondary'}>{t(`act.op.${item.operation}` as never)}</Badge></TableCell>
                <TableCell className="max-w-72 truncate font-mono text-xs">{item.target}</TableCell>
                <TableCell className="text-sm">{item.sourceName ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.via}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'ok' ? 'success' : item.status === 'failed' ? 'destructive' : 'warning'}>{t(`act.status.${item.status}` as never)}</Badge>
                </TableCell>
                <TableCell className="text-end font-tabular text-muted-foreground">{item.durationMs !== null ? formatMs(item.durationMs, locale) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{data ? t('act.pager', { from: (data.page - 1) * data.size + 1, to: Math.min(data.page * data.size, data.total), total: formatNumber(data.total, locale) }) : ''}</span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
          <span className="flex h-8 items-center px-2 font-tabular">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
        </div>
      </div>
    </div>
  );
}
