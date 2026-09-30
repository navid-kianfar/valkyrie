import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Plus, ScanSearch, Upload, ArrowRight } from '@/components/icons';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/kit-extra';

interface ScanResult { host: string; port: number; open: boolean; }

export function WelcomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cidr, setCidr] = useState('');
  const [ports, setPorts] = useState('6379');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runScan() {
    setScanning(true);
    setResults(null);
    try {
      const portList = ports.split(',').map((p) => Number(p.trim())).filter((p) => p > 0 && p < 65536);
      const res = await api.post<{ scanned: number; open: ScanResult[] }>('/sources/scan', { cidr: cidr.trim(), ports: portList });
      setResults(res.open);
      setSelected(new Set(res.open.map((r) => `${r.host}:${r.port}`)));
      if (res.open.length > 0) toast.success(t('welcome.scanFound', { n: res.open.length }));
      else toast.info(t('welcome.scanNone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function addSelected() {
    if (!results || importing) return;
    const items = results.filter((r) => selected.has(`${r.host}:${r.port}`)).map((r) => ({
      name: `${r.host.replace(/\./g, '-')}-${r.port}`,
      host: r.host,
      port: r.port,
    }));
    if (items.length === 0) { toast.info(t('welcome.scanAddNone')); return; }
    setImporting(true);
    try {
      const res = await api.post<{ imported: number }>('/sources/import', { items });
      toast.success(t('welcome.importDone', { n: res.imported }));
      qc.clear();
      navigate('/');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const res = await api.post<{ imported: number }>('/sources/import', { items });
      toast.success(t('welcome.importDone', { n: res.imported }));
      qc.clear();
      navigate('/');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('welcome.title')} desc={t('welcome.subtitle')} />
      <div className="flex flex-col gap-3">
        <Link to="/sources/new" className="group flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Plus className="size-5" /></span>
          <span className="flex-1"><b className="text-sm">{t('welcome.addTitle')}</b><span className="block text-[13px] text-muted-foreground">{t('welcome.addDesc')}</span></span>
          <ArrowRight className="mt-3 size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
        </Link>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><ScanSearch className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <b className="text-sm">{t('welcome.scanTitle')}</b>
              <span className="block text-[13px] text-muted-foreground">{t('welcome.scanDesc')}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
            <div>
              <Label className="mb-1.5 text-xs">{t('welcome.scanCidr')}</Label>
              <Input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24" className="font-mono" />
              <p className="mt-1 text-xs text-muted-foreground">{t('welcome.scanCidrHint')}</p>
            </div>
            <div>
              <Label className="mb-1.5 text-xs">{t('welcome.scanPorts')}</Label>
              <Input value={ports} onChange={(e) => setPorts(e.target.value)} className="font-mono" />
            </div>
            <div className="flex items-end">
              <Button onClick={runScan} disabled={scanning || !cidr.trim()} className="w-full sm:w-auto">
                {scanning ? t('welcome.scanning', { count: '' }) : t('welcome.scanRun')}
              </Button>
            </div>
          </div>
          {results && results.length > 0 && (
            <div className="mt-4 rounded-lg border p-3">
              <div className="mb-2 text-xs font-semibold text-success">{t('welcome.scanFound', { n: results.length })}</div>
              <div className="grid gap-1.5">
                {results.map((r) => {
                  const id = `${r.host}:${r.port}`;
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={selected.has(id)}
                        onCheckedChange={(v) => setSelected((prev) => { const next = new Set(prev); if (v) next.add(id); else next.delete(id); return next; })}
                      />
                      <span className="font-mono">{r.host}:{r.port}</span>
                    </label>
                  );
                })}
              </div>
              <Button size="sm" className="mt-3" onClick={addSelected} disabled={importing || selected.size === 0}>{t('welcome.scanAdd')}{selected.size > 0 && ` (${selected.size})`}</Button>
            </div>
          )}
          {results && results.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{t('welcome.scanNone')}</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Upload className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <b className="text-sm">{t('welcome.importTitle')}</b>
              <span className="block text-[13px] text-muted-foreground">{t('welcome.importDesc')}</span>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>{t('welcome.importPick')}</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t('welcome.importHint')}</p>
        </div>
      </div>

      <Alert className="mt-5">
        <Info className="size-4" />
        <AlertTitle>{t('welcome.whatIs')}</AlertTitle>
        <AlertDescription>{t('welcome.whatIsDesc')}</AlertDescription>
      </Alert>

      <p className="mt-4 text-sm"><Link to="/" className="text-primary hover:underline">{t('welcome.skip')}</Link></p>
    </div>
  );
}
