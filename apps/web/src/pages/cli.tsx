import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Download, Play, Plus, Search, Trash2, X } from '@/components/icons';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSource, useSources } from '@/hooks/use-sources';
import { Breadcrumbs, NoSourcesNotice } from '@/components/kit-extra';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Line { kind: 'cmd' | 'res' | 'err'; text: string; }

export function CliPage() {
  const { t } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const routeId = params.id ? Number(params.id) : null;
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const sourceId = routeId ?? sources?.[0]?.id ?? null;
  const { data: source } = useSource(sourceId);
  const [db, setDb] = useState('0');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('valkyrie.cliHistory') || '[]'));
  const outRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [snippets, setSnippets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('valkyrie.snippets');
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* fall through to the seeds */ }
    return ['MEMORY USAGE {key}', 'SCAN 0 MATCH session:* COUNT 500', 'INFO', 'TTL {key}'];
  });
  const [snippetFilter, setSnippetFilter] = useState('');
  const [guardBusy, setGuardBusy] = useState(false);
  const sessionCommands = useMemo(() => lines.filter((l) => l.kind === 'cmd').length, [lines]);

  useEffect(() => { outRef.current?.scrollTo(0, outRef.current.scrollHeight); }, [lines]);

  function persistSnippets(next: string[]) {
    setSnippets(next);
    localStorage.setItem('valkyrie.snippets', JSON.stringify(next));
  }

  /** The guards switch writes straight through to the source's guardDangerous flag. */
  async function toggleGuard(on: boolean) {
    if (!sourceId) return;
    setGuardBusy(true);
    try {
      await api.patch(`/sources/${sourceId}`, { guardDangerous: on });
      toast.success(on ? t('cli.guards') : t('cli.guardsOff'));
      void qc.invalidateQueries({ queryKey: ['source', sourceId] });
      void qc.invalidateQueries({ queryKey: ['sources'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardBusy(false);
    }
  }
  /* the transcript belongs to one endpoint + database */
  useEffect(() => { setLines([]); setDb('0'); }, [sourceId]);

  async function run() {
    if (!sourceId || !command.trim() || busy) return;
    const cmd = command.trim();
    setLines((l) => [...l, { kind: 'cmd', text: cmd }]);
    setCommand('');
    setBusy(true);
    try {
      const res = await api.post<{ result: unknown; durationMs: number }>(`/sources/${sourceId}/exec`, { db: Number(db), command: cmd });
      const text = typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, res.result !== null && typeof res.result === 'object' ? 1 : 0);
      setLines((l) => [...l, { kind: 'res', text: `${text}  ·  ${res.durationMs} ms` }]);
      setHistory((h) => { const next = [cmd, ...h.filter((x) => x !== cmd)].slice(0, 50); localStorage.setItem('valkyrie.cliHistory', JSON.stringify(next)); return next; });
    } catch (e) {
      setLines((l) => [...l, { kind: 'err', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  }

  if (sourcesLoading || (sourceId !== null && !source)) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-[60vh] rounded-xl" /></div>;
  if (sourceId === null || !source) return <NoSourcesNotice />;

  return (
    <div>
      <Breadcrumbs sourceId={sourceId} sourceName={source.name} current={t('cli.title')} />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">{t('cli.title')}</h1>
          <Badge variant={source.stats.status === 'ok' ? 'success' : 'destructive'}>
            <span className={cn('inline-block size-1.5 rounded-full', source.stats.status === 'ok' ? 'bg-success' : 'bg-destructive')} />
            {source.stats.status === 'ok' ? t('cli.connected') : t('status.err')}
          </Badge>
          <Badge variant="outline">{source.readOnly ? t('cli.readOnly') : t('cli.readWrite')}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(lines.map((l) => (l.kind === 'cmd' ? `> ${l.text}` : l.text)).join('\n')); toast.success(t('cli.exported')); }}>
            <Download className="size-3.5" />{t('cli.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLines([])}><Trash2 className="size-3.5" />{t('cli.clear')}</Button>
        </div>
      </header>

      <div className="grid gap-3.5 xl:grid-cols-[1fr_290px]">
        <section className="flex h-[calc(100vh-210px)] min-h-96 flex-col rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-3.5 py-2.5">
            <Select value={String(sourceId)} onValueChange={(v) => navigate(`/sources/${v}/cli`)}>
              <SelectTrigger sizeVariant="sm" className="w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="font-mono text-xs text-muted-foreground">{source.host}:{source.port}</span>
            <span className="flex-1" />
            <Select value={db} onValueChange={setDb}>
              <SelectTrigger sizeVariant="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: source.row.visibleDbs }, (_, i) => <SelectItem key={i} value={String(i)}>db{i}</SelectItem>)}</SelectContent>
            </Select>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={source.guardDangerous} disabled={guardBusy} onCheckedChange={toggleGuard} aria-label={t('cli.guards')} />
              {source.guardDangerous ? t('cli.guards') : t('cli.guardsOff')}
            </label>
          </div>
          <div ref={outRef} className="flex-1 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">
            {lines.length === 0 && <p className="text-muted-foreground">{t('cli.empty')}</p>}
            {lines.map((l, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-all', l.kind === 'cmd' && "font-semibold text-primary before:me-1.5 before:content-['❯'] before:text-muted-foreground", l.kind === 'err' && 'font-semibold text-destructive')}>{l.text}</div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-t px-3.5 pt-2.5">
            {['GET', 'HGETALL', 'SCAN', 'TTL', 'SET', 'INFO'].map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-md border bg-secondary/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                onClick={() => setCommand(c === 'SET' ? `${c} ` : `${c} `)}
              >{c}</button>
            ))}
            <span className="ms-auto text-[11px] text-muted-foreground">
              {t('cli.sessionHint', { n: sessionCommands })}
            </span>
          </div>
          <div className="flex items-center gap-2.5 border-t px-3.5 py-2.5">
            <span className="whitespace-nowrap font-mono text-xs text-success">{source.host}:<span className="text-primary">db{db}</span>&gt;</span>
            <Input
              className="flex-1 border-0 bg-transparent font-mono text-[13px] shadow-none focus-visible:ring-0"
              placeholder={t('cli.placeholder')}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') void run(); }}
            />
            <Button size="sm" onClick={run} disabled={busy || !command.trim()}><Play className="size-3.5" />{t('cli.run')}</Button>
          </div>
        </section>

        <aside className="flex flex-col gap-3.5">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between"><div className="text-sm font-semibold">{t('cli.history')}</div>{history.length > 0 && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setHistory([]); localStorage.removeItem('valkyrie.cliHistory'); }}>{t('cli.historyClear')}</button>}</div>
            <div className="flex flex-col gap-0.5">
              {history.length === 0 && <span className="py-2 text-xs text-muted-foreground">{t('cli.empty')}</span>}
              {history.map((h, i) => (
                <button key={i} className="truncate rounded-md px-1.5 py-1.5 text-start font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setCommand(h)}>{h}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">{t('cli.snippets')}</div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 ps-7 text-xs" value={snippetFilter} onChange={(e) => setSnippetFilter(e.target.value)} placeholder={t('cli.snippetsFilter')} />
            </div>
            <div className="flex flex-col gap-0.5">
              {snippets.filter((sn) => sn.toLowerCase().includes(snippetFilter.toLowerCase())).length === 0 && (
                <span className="py-2 text-xs text-muted-foreground">{t('act.empty')}</span>
              )}
              {snippets.filter((sn) => sn.toLowerCase().includes(snippetFilter.toLowerCase())).map((sn) => (
                <div key={sn} className="group flex items-center gap-1">
                  <button className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-start font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setCommand(sn)}>{sn}</button>
                  <button className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label={t('common.delete')} onClick={() => persistSnippets(snippets.filter((x) => x !== sn))}>
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={!command.trim() || snippets.includes(command.trim())}
              onClick={() => persistSnippets([command.trim(), ...snippets].slice(0, 24))}
            >
              <Plus className="size-3.5" />{t('cli.snippetSave')}
            </Button>
          </div>

          <div className={cn('rounded-xl border p-3.5 text-[13px] text-foreground', source.guardDangerous ? 'border-warning/30 bg-warning/10' : 'border-border bg-card')}>
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className={cn('size-4', source.guardDangerous ? 'text-warning' : 'text-muted-foreground')} />
              {source.guardDangerous ? t('cli.guardsActive') : t('cli.guardsOff')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{source.guardDangerous ? t('cli.guardNote') : t('cli.guardOffNote')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
