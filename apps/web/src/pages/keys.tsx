import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Folder, Lock, MoreHorizontal, Pencil, Plus, Search, Terminal, Trash2 } from '@/components/icons';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSource, useSources } from '@/hooks/use-sources';
import { usePreferences } from '@/providers/preferences';
import { formatBytes, formatNumber } from '@/lib/format';
import { Breadcrumbs, NoSourcesNotice } from '@/components/kit-extra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface KeySummary { name: string; type: string; ttl: number; memory: number | null; }
interface KeyDetail { name: string; type: string; ttl: number; memory: number | null; value: unknown; length?: number; }

const TYPE_COLORS: Record<string, string> = {
  string: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
  hash: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  list: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
  set: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  zset: 'text-pink-600 dark:text-pink-400 bg-pink-500/10',
  stream: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10',
};

function typeIcon(type: string) {
  switch (type) {
    case 'string': return <span className="font-mono text-[11px] font-bold">{'{}'}</span>;
    case 'hash': return <span className="font-mono text-[11px] font-bold">#</span>;
    case 'list': return <span className="font-mono text-[11px] font-bold">≡</span>;
    case 'set': return <span className="font-mono text-[11px] font-bold">∪</span>;
    case 'zset': return <span className="font-mono text-[11px] font-bold">↗</span>;
    case 'stream': return <span className="font-mono text-[11px] font-bold">~</span>;
    default: return <span className="font-mono text-[11px] font-bold">?</span>;
  }
}

export function KeysPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = params.id ? Number(params.id) : null;
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const sourceId = routeId ?? sources?.[0]?.id ?? null;
  const { data: source } = useSource(sourceId);
  const [db, setDb] = useState(Number(searchParams.get('db') ?? 0));
  const [match, setMatch] = useState(searchParams.get('match') ?? '*');
  const [debouncedMatch, setDebouncedMatch] = useState(match);
  const [type, setType] = useState<string>('any');
  const [cursorStack, setCursorStack] = useState<number[]>([0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedMatch(match), 250);
    return () => clearTimeout(id);
  }, [match]);

  /* a new source, database or filter always restarts the keyspace walk */
  useEffect(() => {
    setCursorStack([0]);
    setSelected(null);
  }, [sourceId, db, debouncedMatch, type]);

  const { local } = usePreferences();
  const pageSize = local.pageSize;
  const scanCount = local.scanCount;

  const cursor = cursorStack[cursorStack.length - 1];
  const scanQuery = useQuery({
    queryKey: ['keys', sourceId, db, debouncedMatch, type, cursor],
    queryFn: () => api.get<{ cursor: number; keys: KeySummary[] }>(`/sources/${sourceId}/keys?db=${db}&cursor=${cursor}&match=${encodeURIComponent(debouncedMatch)}${type !== 'any' ? `&type=${type}` : ''}&count=${scanCount}`),
    enabled: sourceId !== null,
  });

  const detailQuery = useQuery({
    queryKey: ['key', sourceId, db, selected],
    queryFn: () => api.get<KeyDetail>(`/sources/${sourceId}/key?db=${db}&name=${encodeURIComponent(selected as string)}`),
    enabled: sourceId !== null && selected !== null,
  });

  const namespaces = useMemo(() => {
    const map = new Map<string, number>();
    for (const k of scanQuery.data?.keys || []) {
      const idx = k.name.indexOf(':');
      if (idx > 0) {
        const ns = k.name.slice(0, idx + 1);
        map.set(ns, (map.get(ns) || 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [scanQuery.data]);

  const keys = scanQuery.data?.keys ?? [];
  const visible = keys.slice(0, pageSize);

  async function deleteKey(name: string) {
    try {
      await api.del(`/sources/${sourceId}/key?db=${db}&name=${encodeURIComponent(name)}`);
      toast.success(t('keys.deleted'));
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ['keys'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (sourcesLoading || (sourceId !== null && !source)) return <KeysSkeleton />;
  if (sourceId === null || !source) return <NoSourcesNotice />;

  return (
    <div>
      <Breadcrumbs sourceId={sourceId} sourceName={source.name} current={t('keys.title')} />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">{t('keys.title')}</h1>
          <Select value={String(sourceId)} onValueChange={(v) => navigate(`/sources/${v}/keys`)}>
            <SelectTrigger className="w-44" sizeVariant="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{sources?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(db)} onValueChange={(v) => { setDb(Number(v)); setCursorStack([0]); setSelected(null); }}>
            <SelectTrigger className="w-52" sizeVariant="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: source.row.visibleDbs }, (_, i) => <SelectItem key={i} value={String(i)}>db{i}</SelectItem>)}</SelectContent>
          </Select>
          <Badge variant="outline" className="font-mono">{t('keys.scanCursor', { cursor: cursor })}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link to={`/sources/${sourceId}/cli`}><Terminal className="size-4" />{t('keys.console')}</Link></Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="size-4" />{t('keys.addKey')}</Button>
        </div>
      </header>

      <div className="grid gap-3.5 xl:grid-cols-[240px_minmax(320px,1fr)_minmax(360px,420px)]">
        <aside className="flex max-h-[calc(100vh-190px)] flex-col rounded-xl border bg-card">
          <div className="border-b p-3.5">
            <div className="relative"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 ps-8 text-xs" placeholder={t('keys.namespaceFilter')} readOnly /></div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <button className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]', match === '*' ? 'bg-accent font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')} onClick={() => setMatch('*')}>
              <Folder className="size-3.5" />{t('keys.allKeys')}<span className="ms-auto text-[11px] text-muted-foreground">{formatNumber(keys.length, locale)}</span>
            </button>
            <div className="ms-5 flex flex-col gap-0.5 border-s ps-2">
              {namespaces.map(([ns, count]) => (
                <button key={ns} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]', match === `${ns}*` ? 'bg-accent font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')} onClick={() => setMatch(`${ns}*`)}>
                  <span className="truncate font-mono">{ns}</span><span className="ms-auto text-[11px] text-muted-foreground">{formatNumber(count, locale)}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex max-h-[calc(100vh-190px)] flex-col rounded-xl border bg-card">
          <div className="space-y-2.5 border-b p-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 ps-8 font-mono text-xs" value={match} onChange={(e) => setMatch(e.target.value)} placeholder="*" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {type !== 'any' && <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs shadow-sm">{t('keys.filterType', { type })}<button onClick={() => setType('any')}>×</button></span>}
              <Select value={type} onValueChange={setType}>
                <SelectTrigger sizeVariant="sm" className="w-auto"><SelectValue placeholder={t('keys.typeFilter', { type: '' })} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('common.any')}</SelectItem>
                  {['string', 'hash', 'list', 'set', 'zset', 'stream'].map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-1.5">
            {scanQuery.isLoading && <div className="space-y-1.5 p-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>}
            {scanQuery.data && keys.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{t('act.empty')}</p>}
            {visible.map((k) => (
              <button key={k.name} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start', selected === k.name ? 'border border-primary/25 bg-accent' : 'border border-transparent hover:bg-secondary')} onClick={() => setSelected(k.name)}>
                <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg', TYPE_COLORS[k.type] || 'bg-muted text-muted-foreground')}>{typeIcon(k.type)}</span>
                <span className="truncate font-mono text-xs">{k.name}</span>
                <span className="ms-auto flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-tabular">{k.ttl > 0 ? `${t('common.ttl')} ${formatNumber(k.ttl, locale)}s` : k.ttl === -1 ? t('common.noTtl') : t('common.expired')}</span>
                  <span className="font-tabular">{k.memory !== null ? formatBytes(k.memory, locale) : ''}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
            <span>{t('keys.showing', { shown: formatNumber(visible.length, locale), total: formatNumber(keys.length, locale) })}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={cursorStack.length <= 1} onClick={() => setCursorStack((st) => st.slice(0, -1))}>‹</Button>
              <Button variant="outline" size="sm" disabled={cursor === 0} onClick={() => setCursorStack((st) => [...st, scanQuery.data?.cursor ?? 0])}>›</Button>
            </div>
          </div>
        </section>

        <aside className="flex max-h-[calc(100vh-190px)] flex-col rounded-xl border bg-card">
          {selected === null || detailQuery.data === undefined ? (
            <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">{t('keys.noSelection')}</div>
          ) : (
            <KeyDetailView sourceId={sourceId} db={db} detail={detailQuery.data} onChanged={() => { void qc.invalidateQueries({ queryKey: ['keys'] }); void qc.invalidateQueries({ queryKey: ['key'] }); }} onDelete={() => deleteKey(detailQuery.data.name)} />
          )}
        </aside>
      </div>

      <AddKeyDialog open={addOpen} setOpen={setAddOpen} sourceId={sourceId} db={db} onCreated={() => { void qc.invalidateQueries({ queryKey: ['keys'] }); }} />
    </div>
  );
}

function KeyDetailView({ sourceId, db, detail, onChanged, onDelete }: {
  sourceId: number; db: number; detail: KeyDetail; onChanged: () => void; onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<'table' | 'json'>('table');
  const [editValue, setEditValue] = useState<string | null>(null);
  const [ttl, setTtl] = useState(String(detail.ttl > 0 ? detail.ttl : 3600));
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTo, setRenameTo] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const { local } = usePreferences();
  const previewLimit = local.valuePreviewKb * 1024;
  const isString = detail.type === 'string';
  const entries: [string, string][] = useMemo(() => {
    const v = detail.value;
    if (isString) return [['value', String(v)]];
    if (detail.type === 'hash' && typeof v === 'object' && v !== null) return Object.entries(v as Record<string, string>);
    if (detail.type === 'list' || detail.type === 'set') return (v as unknown[]).map((x, i) => [String(i), String(x)]);
    if (detail.type === 'zset') return (v as { member: string; score: number }[]).map((e) => [e.member, String(e.score)]);
    if (detail.type === 'stream') return (v as { id: string; fields: Record<string, string> }[]).map((e) => [e.id, JSON.stringify(e.fields)]);
    return [];
  }, [detail, isString]);

  /** Opens the inline editor: raw text for strings, JSON for every other type. */
  function startEditing(_field: string, _value: string) {
    setEditValue(isString ? String(detail.value) : JSON.stringify(detail.value, null, 2));
    setEditing(true);
  }

  async function saveValue() {
    if (editValue === null) return;
    let parsed: unknown = editValue;
    if (!isString) {
      try { parsed = JSON.parse(editValue); } catch { /* keep raw */ }
    }
    setBusy(true);
    try {
      await api.put(`/sources/${sourceId}/key?name=${encodeURIComponent(detail.name)}`, { db, type: detail.type, value: parsed });
      toast.success(t('keys.saved'));
      setEditValue(null);
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyTtl() {
    setBusy(true);
    try {
      await api.post(`/sources/${sourceId}/key/ttl`, { db, name: detail.name, ttl: Number(ttl) });
      toast.success(t('keys.saved'));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    setBusy(true);
    try {
      await api.post(`/sources/${sourceId}/key/rename`, { db, from: detail.name, to: renameTo });
      toast.success(t('keys.renamed'));
      setRenameOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail.value, null, 2));
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('common.copyFailed'));
    }
  }

  return (
    <>
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', TYPE_COLORS[detail.type] || 'bg-muted text-muted-foreground')}>{typeIcon(detail.type)}</span>
            <span className="truncate font-mono text-[13px] font-bold">{detail.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={copyValue}><Copy />{t('keys.menuCopy')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setRenameTo(detail.name); setRenameOpen(true); }}><Pencil />{t('keys.menuRename')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}><Trash2 />{t('keys.menuDelete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge className={TYPE_COLORS[detail.type]}>{detail.type}</Badge>
          <Badge variant="outline" className="font-tabular">{detail.memory !== null ? formatBytes(detail.memory, locale) : '—'}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Label className="text-xs">{t('common.ttl')}</Label>
          <Input className="h-8 w-28 font-mono text-xs" value={ttl} onChange={(e) => setTtl(e.target.value)} />
          <Button size="sm" variant="outline" onClick={applyTtl}>{t('keys.ttl.set')}</Button>
          <span className="text-xs text-muted-foreground">{detail.ttl > 0 ? formatNumber(detail.ttl, locale) + 's' : detail.ttl === -1 ? t('common.noTtl') : t('common.expired')}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-5 border-b px-4">
          <button className={cn('-mb-px border-b-2 py-2.5 text-sm font-semibold', view === 'table' ? 'border-primary' : 'border-transparent text-muted-foreground')} onClick={() => setView('table')}>{t('keys.tabValue')}</button>
          <button className={cn('-mb-px border-b-2 py-2.5 text-sm font-semibold', view === 'json' ? 'border-primary' : 'border-transparent text-muted-foreground')} onClick={() => setView('json')}>{t('keys.tabMeta')}</button>
        </div>

        <div className="flex-1 overflow-auto p-2.5">
          {view === 'table' ? (
            entries.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t('act.empty')}</p> : (
              <div className="flex flex-col">
                {entries.map(([k, v], i) => (
                  <div key={i} className="group grid grid-cols-[minmax(70px,32%)_1fr_auto] items-start gap-3 border-b border-dashed px-2 py-2 text-xs hover:bg-secondary/60">
                    <span className="break-all font-mono font-semibold text-muted-foreground">{k}</span>
                    <span className="break-all font-mono">
                      {v.length > previewLimit ? `${v.slice(0, previewLimit)}…` : v}
                      {v.length > previewLimit && (
                        <span className="ms-2 whitespace-nowrap text-[10px] text-muted-foreground">
                          {t('keys.truncated', { kb: local.valuePreviewKb, total: formatBytes(v.length, locale) })}
                        </span>
                      )}
                    </span>
                    {i === 0 && (
                      <button
                        type="button"
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                        aria-label={t('keys.tabValue')}
                        onClick={() => startEditing(k, v)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-1.5 p-1 text-xs">
              <div className="flex justify-between border-b border-dashed py-1.5"><span className="text-muted-foreground">{t('keys.encoding')}</span><span className="font-mono font-semibold">{detail.type}</span></div>
              <div className="flex justify-between border-b border-dashed py-1.5"><span className="text-muted-foreground">{t('keys.memoryUsage')}</span><span className="font-mono font-semibold">{detail.memory !== null ? formatBytes(detail.memory, locale) : '—'}</span></div>
              <div className="flex justify-between border-b border-dashed py-1.5"><span className="text-muted-foreground">{t('keys.length')}</span><span className="font-mono font-semibold">{formatNumber(detail.length ?? 0, locale)}</span></div>
              <div className="flex justify-between border-b border-dashed py-1.5"><span className="text-muted-foreground">{t('common.ttl')}</span><span className="font-mono font-semibold">{detail.ttl > 0 ? `${formatNumber(detail.ttl, locale)}s` : detail.ttl === -1 ? t('common.noTtl') : t('common.expired')}</span></div>
            </div>
          )}
        </div>

        {/* Editor sits inside the pane so the footer stays the last row, as in the concept. */}
        {editing && (
          <div className="border-t bg-secondary/40 p-3">
            {isString ? (
              <Textarea rows={4} value={editValue ?? ''} onChange={(e) => setEditValue(e.target.value)} className="bg-card text-xs" />
            ) : (
              <Textarea rows={5} value={editValue ?? ''} onChange={(e) => setEditValue(e.target.value)} className="bg-card text-xs" />
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {isString ? t('keys.editStringHint') : t('keys.editJsonHint')}
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditValue(null); }}>{t('common.close')}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t p-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" />{t('keys.saveNote')}</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" disabled={editValue === null} onClick={() => { setEditValue(null); setEditing(false); }}>{t('keys.revert')}</Button>
          <Button size="sm" disabled={editValue === null || busy} onClick={saveValue}>{t('common.save')}</Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keys.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('keys.deleteDesc', { type: detail.type, length: detail.length ?? entries.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-secondary/50 px-3.5 py-2.5 font-mono text-xs break-all">{detail.name}</div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={busy} onClick={(e) => { e.preventDefault(); void confirmDelete(); }}>
              {t('keys.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('keys.renameTitle')}</DialogTitle></DialogHeader>
          <div><Label className="mb-1.5">{t('keys.renameNew')}</Label><Input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="font-mono" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRenameOpen(false)}>{t('common.cancel')}</Button><Button onClick={rename} disabled={!renameTo.trim() || renameTo === detail.name}>{t('common.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function AddKeyDialog({ open, setOpen, sourceId, db, onCreated }: { open: boolean; setOpen: (v: boolean) => void; sourceId: number; db: number; onCreated: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState('string');
  const [fields, setFields] = useState<{ k: string; v: string }[]>([{ k: '', v: '' }]);
  const { local } = usePreferences();
  const [ttl, setTtl] = useState(local.defaultTtl);
  const [useTtl, setUseTtl] = useState(local.defaultTtl > 0);

  async function create() {
    let value: unknown;
    if (type === 'string') value = fields[0]?.v ?? '';
    else if (type === 'hash') value = Object.fromEntries(fields.map((f) => [f.k, f.v]));
    else if (type === 'list' || type === 'set') value = fields.map((f) => f.v);
    else if (type === 'zset') value = fields.map((f) => [f.v, Number(f.k) || 0]);
    else value = fields[0] ? { [fields[0].k]: fields[0].v } : {};
    try {
      await api.post(`/sources/${sourceId}/key`, { db, name, type, ttl: useTtl ? ttl : 0, value });
      toast.success(t('keys.addCreated'));
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('keys.addTitle')}</DialogTitle><DialogDescription>{t('keys.addTarget', { source: '', db })}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {['string', 'hash', 'list', 'set', 'zset'].map((ty) => (
              <button key={ty} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold', type === ty ? 'border-primary bg-accent text-primary' : 'bg-secondary/50')} onClick={() => setType(ty)}>{ty}</button>
            ))}
          </div>
          <div><Label className="mb-1.5">{t('keys.addName')}</Label><Input className="font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="user:1042:profile" /></div>
          <div>
            <Label className="mb-1.5">{t('keys.addFields')}</Label>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="max-w-44 font-mono text-xs" value={f.k} placeholder={type === 'list' || type === 'set' || type === 'zset' ? t('keys.items') : t('keys.field')} onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                  <Input className="font-mono text-xs" value={f.v} onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}><MoreHorizontal className="hidden" /><span className="text-xs">×</span></Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setFields((fs) => [...fs, { k: '', v: '' }])}><Plus className="size-3.5" />{t('keys.addField')}</Button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={useTtl} onCheckedChange={(v) => setUseTtl(v === true)} />{t('keys.addTtl')}</label>
            <Input type="number" className="h-8 w-28 font-mono text-xs" value={ttl} onChange={(e) => setTtl(Number(e.target.value))} disabled={!useTtl} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={create} disabled={!name.trim()}>{t('keys.addCreate')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeysSkeleton() {
  return <div className="space-y-4"><Skeleton className="h-9 w-64" /><div className="grid gap-3.5 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div></div>;
}
