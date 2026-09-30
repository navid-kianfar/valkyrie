import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Clock, Download, Info, Play, ShieldCheck, Trash2, TriangleAlert } from '@/components/icons';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSources } from '@/hooks/use-sources';
import { formatBytes, formatDuration, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/kit-extra';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { BulkJobDto } from '@valkyrie/shared';

type Op = 'delete' | 'expire' | 'export' | 'flush';
interface PreviewResult { matched: number; truncated: boolean; sample: { name: string; type: string; ttl: number; memory: number | null }[]; }

export function BulkPage() {
  const { t, locale } = useI18n();
  const { data: sources } = useSources();
  const [op, setOp] = useState<Op>('delete');
  const [sourceId, setSourceId] = useState<string>('');
  const [db, setDb] = useState('0');
  const [pattern, setPattern] = useState('session:*');
  const [type, setType] = useState('any');
  const [onlyTtl, setOnlyTtl] = useState(false);
  const [ttl, setTtl] = useState('3600');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportLimit, setExportLimit] = useState('10000');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [job, setJob] = useState<BulkJobDto | null>(null);
  const [flushDb, setFlushDb] = useState('0');
  const [flushWord, setFlushWord] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sources && sources.length > 0 && !sourceId) setSourceId(String(sources[0].id));
  }, [sources, sourceId]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const source = sources?.find((s) => String(s.id) === sourceId);

  async function dryRun() {
    if (!sourceId) return;
    try {
      const res = await api.post<PreviewResult>(`/sources/${sourceId}/keys/preview`, { db: Number(db), match: pattern, type: type === 'any' ? undefined : type, limit: 2000 });
      setPreview(res);
      setUnderstood(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  function trackJob(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const j = await api.get<BulkJobDto>(`/jobs/${id}`);
      setJob(j);
      if (j.status !== 'running') {
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success(t('bulk.lastRun', { status: t(`bulk.status.${j.status}` as never), n: j.processed, ms: (j.finishedAt ?? 0) - j.startedAt }));
      }
    }, 500);
  }

  async function run() {
    if (!sourceId) return;
    try {
      const started = op === 'delete'
        ? await api.post<BulkJobDto>(`/sources/${sourceId}/bulk/delete`, { db: Number(db), pattern, type: type === 'any' ? undefined : type, onlyTtl })
        : await api.post<BulkJobDto>(`/sources/${sourceId}/bulk/expire`, { db: Number(db), pattern, type: type === 'any' ? undefined : type, ttl: Number(ttl) });
      setJob(started);
      trackJob(started.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function cancelJob() {
    if (!job) return;
    await api.post(`/jobs/${job.id}/cancel`);
    const j = await api.get<BulkJobDto>(`/jobs/${job.id}`);
    setJob(j);
  }

  async function runExport() {
    if (!sourceId) return;
    try {
      const token = localStorage.getItem('valkyrie.token') ?? '';
      const res = await fetch(`/api/sources/${sourceId}/export?db=${db}&match=${encodeURIComponent(pattern)}&format=${exportFormat}&limit=${exportLimit}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.text();
        let message = `Export failed (${res.status})`;
        try { message = (JSON.parse(body) as { message?: string }).message ?? message; } catch { /* keep default */ }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `valkyrie-export-db${db}.${exportFormat}`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function flush() {
    if (!sourceId) return;
    try {
      await api.post(`/sources/${sourceId}/exec`, { db: Number(flushDb.replace('db', '')), command: 'FLUSHDB' });
      toast.success(t('bulk.flush.done'));
      setFlushWord('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const ops: { id: Op; icon: typeof Trash2; title: string; desc: string; danger?: boolean }[] = [
    { id: 'delete', icon: Trash2, title: t('bulk.opDelete'), desc: t('bulk.opDeleteDesc') },
    { id: 'expire', icon: Clock, title: t('bulk.opTtl'), desc: t('bulk.opTtlDesc') },
    { id: 'export', icon: Download, title: t('bulk.opExport'), desc: t('bulk.opExportDesc') },
    { id: 'flush', icon: TriangleAlert, title: t('bulk.opFlush'), desc: t('bulk.opFlushDesc'), danger: true },
  ];

  return (
    <div>
      <PageHeader
        title={t('bulk.title')}
        desc={t('bulk.subtitle')}
        actions={<Badge variant="default" className="px-3 py-1.5"><ShieldCheck className="size-4" />{t('bulk.guarded')}</Badge>}
      />
      <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(215px,1fr))]">
        {ops.map((o) => (
          <button key={o.id} className={cn('relative rounded-xl border bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-px hover:shadow-md', op === o.id && 'border-primary shadow-[0_0_0_3px] shadow-ring/20', o.danger && 'border-destructive/40')} onClick={() => { setOp(o.id); setJob(null); setPreview(null); setUnderstood(false); }}>
            {op === o.id && (
              <span className="absolute end-3.5 top-3.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>
            )}
            <span className={cn('mb-6 flex size-9 items-center justify-center rounded-lg', o.danger ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground', op === o.id && !o.danger && 'bg-accent text-primary')}><o.icon className="size-4" /></span>
            <b className="block text-sm">{o.title}</b>
            <span className="text-xs text-muted-foreground">{o.desc}</span>
          </button>
        ))}
      </div>

      {op === 'flush' ? (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>{t('bulk.opFlush')}</CardTitle><CardDescription>{t('bulk.opFlushDesc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5">{t('bulk.form.source')}</Label>
                <Select value={sourceId} onValueChange={setSourceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div>
                <Label className="mb-1.5">{t('bulk.flush.db')}</Label>
                <Select value={flushDb} onValueChange={setFlushDb}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 16 }, (_, i) => <SelectItem key={i} value={`db${i}`}>db{i}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5">{t('bulk.flush.type', { word: flushDb })}</Label>
              <Input value={flushWord} onChange={(e) => setFlushWord(e.target.value)} className="font-mono" placeholder={flushDb} />
            </div>
            <Button variant="destructive" disabled={flushWord !== flushDb} onClick={flush}>{t('bulk.flush.execute', { db: flushDb })}</Button>
          </CardContent>
        </Card>
      ) : op === 'export' ? (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>{t('bulk.export.title')}</CardTitle><CardDescription>{t('bulk.export.desc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label className="mb-1.5">{t('bulk.form.source')}</Label><Select value={sourceId} onValueChange={setSourceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1.5">{t('bulk.form.database')}</Label><Select value={db} onValueChange={setDb}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 16 }, (_, i) => <SelectItem key={i} value={String(i)}>db{i}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1.5">{t('bulk.export.format')}</Label><Select value={exportFormat} onValueChange={setExportFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['json', 'csv', 'resp'].map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1.5">{t('bulk.export.limit')}</Label><Input type="number" value={exportLimit} onChange={(e) => setExportLimit(e.target.value)} className="font-mono" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5">{t('bulk.form.pattern')}</Label><Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono" /></div>
            </div>
            <Button onClick={runExport} disabled={!sourceId}>{t('bulk.export.download')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid items-start gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader className="gap-1.5 space-y-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{op === 'delete' ? t('bulk.form.title') : t('bulk.form.ttlTitle')}</CardTitle>
                  {source && <Badge variant="outline" className="whitespace-nowrap font-mono">{source.name} · db{db}</Badge>}
                </div>
                <CardDescription>{op === 'delete' ? t('bulk.form.stepDelete') : t('bulk.form.stepTtl')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label className="mb-1.5">{t('bulk.form.source')}</Label><Select value={sourceId} onValueChange={setSourceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="mb-1.5">{t('bulk.form.database')}</Label><Select value={db} onValueChange={setDb}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 16 }, (_, i) => <SelectItem key={i} value={String(i)}>db{i}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="mb-1.5">{t('bulk.form.pattern')}</Label><Input className="font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} /></div>
                  <div><Label className="mb-1.5">{t('bulk.form.type')}</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">{t('common.any')}</SelectItem>{['string', 'hash', 'list', 'set', 'zset', 'stream'].map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}</SelectContent></Select></div>
                  {op === 'expire' && <div><Label className="mb-1.5">{t('bulk.form.ttlValue')}</Label><Input type="number" className="font-mono" value={ttl} onChange={(e) => setTtl(e.target.value)} /></div>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {op === 'delete' ? (
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox checked={onlyTtl} onCheckedChange={(v) => setOnlyTtl(v === true)} />{t('bulk.form.onlyTtl')}
                    </label>
                  ) : <span />}
                  <Button variant="outline" onClick={dryRun} disabled={!sourceId}><Play className="size-3.5" />{t('bulk.form.dryRun')}</Button>
                </div>
                {preview && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-accent px-3.5 py-2.5 text-[13px]">
                    <Info className="size-4 shrink-0 text-primary" />
                    <b>{t('bulk.dry.summary', { n: formatNumber(preview.matched, locale), size: formatBytes(preview.sample.reduce((sum, k) => sum + (k.memory ?? 0), 0), locale) })}</b>
                    <span className="text-muted-foreground">{t('bulk.dry.seeAll')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-1.5 space-y-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{preview ? t('bulk.previewTitle', { n: preview.sample.length, total: formatNumber(preview.matched, locale) }) : t('bulk.preview')}</CardTitle>
                  {preview && <Badge variant="default" className="whitespace-nowrap">{t('bulk.dryTag')}</Badge>}
                </div>
                <CardDescription>{preview ? t('bulk.previewWhen') : t('bulk.previewNone')}</CardDescription>
              </CardHeader>
              <CardContent>
                {preview ? (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader><TableRow><TableHead>{t('bulk.col.key')}</TableHead><TableHead>{t('common.type')}</TableHead><TableHead>{t('bulk.col.ttl')}</TableHead><TableHead className="text-end">{t('bulk.col.size')}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {preview.sample.map((k) => (
                          <TableRow key={k.name}>
                            <TableCell className="font-mono text-xs">{k.name}</TableCell>
                            <TableCell><Badge variant="secondary" className="font-mono">{k.type}</Badge></TableCell>
                            <TableCell className="font-tabular text-muted-foreground">{k.ttl > 0 ? formatDuration(k.ttl, locale) : t('common.noTtl')}</TableCell>
                            <TableCell className="text-end font-tabular text-muted-foreground">{k.memory !== null ? formatBytes(k.memory, locale) : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="grid h-48 place-items-center text-sm text-muted-foreground">{t('bulk.previewNone')}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {(op === 'delete' || op === 'expire') && (
            <Card className="max-w-3xl">
              <CardHeader><CardTitle>{t('bulk.execute')}</CardTitle><CardDescription>{t('bulk.executeDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox checked={understood} onCheckedChange={(v) => setUnderstood(v === true)} />
                    <span>{op === 'delete' ? t('bulk.understand', { n: formatNumber(preview?.matched ?? 0, locale), source: source?.name ?? '', db }) : t('bulk.understandTtl', { source: source?.name ?? '', db })}</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {op === 'delete' ? (
                    <Button variant="destructive" disabled={!understood || !preview} onClick={run}>{t('bulk.run')}</Button>
                  ) : (
                    <Button variant="destructive" disabled={!understood} onClick={run}>{t('bulk.runTtl')}</Button>
                  )}
                  {job?.status === 'running' && <Button variant="outline" onClick={cancelJob}>{t('bulk.stop')}</Button>}
                  <span className="flex-1" />
                  <span className="text-xs text-muted-foreground">{t('bulk.executeDesc')}</span>
                </div>
                {job && (
                  <div className="space-y-2 border-t border-dashed pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span><b>{t('bulk.progressTitle')} · {t(`bulk.status.${job.status}` as never)}</b></span>
                      <span className="font-mono text-muted-foreground">{t('bulk.progress', { processed: formatNumber(job.processed, locale), matched: formatNumber(job.matched, locale), percent: Math.round((job.processed / Math.max(job.matched, 1)) * 100) })}</span>
                    </div>
                    <Progress value={Math.round((job.processed / Math.max(job.matched, 1)) * 100)} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('bulk.errors', { n: job.errors })}</span>
                      <span>{job.finishedAt ? t('bulk.lastRun', { status: t(`bulk.status.${job.status}` as never), n: formatNumber(job.processed, locale), ms: job.finishedAt - job.startedAt }) : ''}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

    </div>
  );
}
