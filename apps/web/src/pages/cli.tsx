import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, ShieldCheck, Trash2, Download } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSource } from '@/hooks/use-sources';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Line { kind: 'cmd' | 'res' | 'err' | 'info'; text: string; }

export function CliPage() {
  const { t } = useI18n();
  const params = useParams();
  const sourceId = params.id ? Number(params.id) : null;
  const { data: source } = useSource(sourceId);
  const [db, setDb] = useState('0');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('valkyrie.cliHistory') || '[]'));
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => { outRef.current?.scrollTo(0, outRef.current.scrollHeight); }, [lines]);

  async function run() {
    if (!sourceId || !command.trim() || busy) return;
    const cmd = command.trim();
    setLines((l) => [...l, { kind: 'cmd', text: cmd }]);
    setCommand('');
    setBusy(true);
    try {
      const res = await api.post<{ result: unknown; durationMs: number }>(`/sources/${sourceId}/exec`, { db: Number(db), command: cmd });
      const text = typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, res.result !== null && typeof res.result === 'object' ? 1 : 0);
      setLines((l) => [...l, { kind: 'res', text }]);
      setHistory((h) => { const next = [cmd, ...h].slice(0, 50); localStorage.setItem('valkyrie.cliHistory', JSON.stringify(next)); return next; });
    } catch (e) {
      setLines((l) => [...l, { kind: 'err', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  }

  if (!sourceId || !source) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-[60vh] rounded-xl" /></div>;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">{t('cli.title')}</h1>
          <Badge variant="success"><span className="inline-block size-1.5 rounded-full bg-success" />{t('cli.connected')}</Badge>
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
            <span className="flex items-center gap-1.5 text-xs"><b>{source.name}</b><span className="font-mono text-muted-foreground">{source.host}:{source.port}</span></span>
            <span className="flex-1" />
            <Select value={db} onValueChange={setDb}>
              <SelectTrigger sizeVariant="sm" className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: source.row.visibleDbs }, (_, i) => <SelectItem key={i} value={String(i)}>db{i}</SelectItem>)}</SelectContent>
            </Select>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={source.guardDangerous} disabled data-testid="guard" />{t('cli.guards')}</label>
          </div>
          <div ref={outRef} className="flex-1 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">
            {lines.length === 0 && <p className="text-muted-foreground">{t('cli.empty')}</p>}
            {lines.map((l, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-all', l.kind === 'cmd' && 'font-semibold text-primary before:me-1.5 before:content-["❯"] before:text-muted-foreground', l.kind === 'err' && 'font-semibold text-destructive')}>{l.kind === 'cmd' ? l.text : l.text}</div>
            ))}
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
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-[13px] text-foreground">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-warning" />{t('cli.guards')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('cli.guardNote')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
