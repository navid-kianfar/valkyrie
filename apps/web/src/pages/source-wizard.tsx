import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Lock, Play } from '@/components/icons';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useSource, useSources } from '@/hooks/use-sources';
import { PageHeader } from '@/components/kit-extra';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FormState {
  name: string; group: string; host: string; port: string; username: string; password: string;
  mode: string; tlsEnabled: boolean; tlsSkipVerify: boolean; caCert: string; sni: string;
  sshEnabled: boolean; sshHost: string; sshPort: string; sshUser: string; sshPassword: string; sshPrivateKey: string;
  sentinelMaster: string; readOnly: boolean; guardDangerous: boolean; scanCount: string; visibleDbs: string;
}

const EMPTY: FormState = {
  name: '', group: 'Default', host: '', port: '6379', username: '', password: '',
  mode: 'standalone', tlsEnabled: false, tlsSkipVerify: false, caCert: '', sni: '',
  sshEnabled: false, sshHost: '', sshPort: '22', sshUser: '', sshPassword: '', sshPrivateKey: '',
  sentinelMaster: '', readOnly: false, guardDangerous: true, scanCount: '200', visibleDbs: '16',
};

interface ProbeResult { ok: boolean; latencyMs?: number; engine?: string; version?: string; role?: string; error?: string; }

export function SourceWizardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = id !== undefined;
  const qc = useQueryClient();
  const { data: existing } = useSource(editing ? Number(id) : null);
  const { data: sources } = useSources();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing && existing && loadedFor !== existing.id) {
    setForm({
      ...EMPTY,
      name: existing.name, group: existing.group, host: existing.host, port: String(existing.port),
      username: existing.username ?? '', mode: existing.mode, readOnly: existing.readOnly,
      guardDangerous: existing.guardDangerous, scanCount: String(existing.scanCount), visibleDbs: String(existing.row.visibleDbs),
      tlsEnabled: existing.row.tlsEnabled, tlsSkipVerify: existing.row.tlsSkipVerify,
      caCert: existing.row.tlsCaCert ?? '', sni: existing.row.tlsSni ?? '',
      sshEnabled: existing.row.sshEnabled, sshHost: existing.row.sshHost ?? '', sshPort: String(existing.row.sshPort), sshUser: existing.row.sshUser ?? '',
      sentinelMaster: existing.row.sentinelMaster ?? '',
    });
    setLoadedFor(existing.id);
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const steps = [t('wizard.stepConnection'), t('wizard.stepSecurity'), t('wizard.stepTopology'), t('wizard.stepReview')];
  const stepValid = useMemo(() => {
    if (step === 1) return form.name.trim().length > 0 && form.host.trim().length > 0 && Number(form.port) > 0;
    if (step === 2) return !form.sshEnabled || (form.sshHost.trim() && form.sshUser.trim());
    if (step === 3) return form.mode !== 'sentinel' || form.sentinelMaster.trim().length > 0;
    return true;
  }, [step, form]);

  function payload() {
    return {
      name: form.name.trim(), group: form.group.trim() || 'Default', host: form.host.trim(), port: Number(form.port),
      username: form.username.trim(), password: form.password || undefined,
      mode: form.mode,
      /* empty strings mean "clear this field" — an omitted key would be kept as-is by the API */
      tls: { enabled: form.tlsEnabled, skipVerify: form.tlsSkipVerify, caCert: form.caCert.trim(), sni: form.sni.trim() },
      ssh: { enabled: form.sshEnabled, host: form.sshHost.trim(), port: Number(form.sshPort), username: form.sshUser.trim(), password: form.sshPassword || undefined, privateKey: form.sshPrivateKey || undefined },
      sentinelMaster: form.sentinelMaster || undefined,
      readOnly: form.readOnly, guardDangerous: form.guardDangerous,
      scanCount: Number(form.scanCount), visibleDbs: Number(form.visibleDbs),
    };
  }

  async function runTest() {
    setTesting(true);
    setProbe(null);
    setError(null);
    try {
      const res = await api.post<ProbeResult>('/sources/test', payload());
      setProbe(res);
      if (!res.ok) setError(res.error ?? t('wizard.testFail'));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setProbe({ ok: false, error: message });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/sources/${id}`, payload());
        toast.success(t('wizard.updated'));
      } else {
        await api.post('/sources', payload());
        toast.success(t('wizard.created'));
      }
      void qc.invalidateQueries({ queryKey: ['sources'] });
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (editing && !existing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-96" />
        <Card><CardContent className="space-y-4 pt-6">
          <div className="flex gap-8">{[1, 2, 3, 4].map((i) => <div key={i} className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-3 w-20" /></div>)}</div>
          {[1, 2, 3, 4].map((i) => <div key={i} className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-9 w-full rounded-md" /></div>)}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={editing ? t('server.editConnection') : t('wizard.title')}
        desc={t('wizard.subtitle')}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-4 rtl:-scale-x-100" />{t('common.back')}</Button>}
      />
      <Card>
        <div className="flex items-center gap-3 overflow-x-auto border-b px-5 py-4">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <button type="button" className="flex items-center gap-2.5" onClick={() => setStep(i + 1)}>
                <span className={cn(
                  'flex h-[26px] w-[26px] items-center justify-center rounded-full border text-xs font-bold',
                  step === i + 1 && 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px] shadow-ring/30',
                  step > i + 1 && 'border-primary/30 bg-accent text-primary',
                  step < i + 1 && 'border-border bg-card text-muted-foreground',
                )}>{step > i + 1 ? <Check className="size-3" /> : i + 1}</span>
                <b className={cn('text-[13px]', step === i + 1 ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>{label}</b>
              </button>
              {i < steps.length - 1 && <span className="h-0 w-6 border-t-2 border-dashed border-border sm:w-12" />}
            </div>
          ))}
        </div>
        <CardContent className="space-y-4 pt-5">
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('common.name')} hint={t('wizard.nameHint')}>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="prod-redis-01" />
                </Field>
                <Field label={t('common.group')} hint={t('wizard.groupHint')}>
                  <Input value={form.group} onChange={(e) => set('group', e.target.value)} placeholder="Production" list="valkyrie-groups" />
                  <datalist id="valkyrie-groups">
                    {[...new Set((sources ?? []).map((s) => s.group))].filter((g) => g && g !== 'Default').map((g) => <option key={g} value={g} />)}
                  </datalist>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                <Field label={t('common.host')}><Input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="10.0.0.5" className="font-mono" /></Field>
                <Field label={t('common.port')}><Input type="number" value={form.port} onChange={(e) => set('port', e.target.value)} className="font-mono" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${t('common.username')} · ${t('wizard.optionalAcl')}`}><Input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="default" /></Field>
                <Field label={t('common.password')} hint={editing ? t('wizard.passwordKeep') : undefined}><Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} /></Field>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <ToggleRow title={t('wizard.tls')} desc={t('wizard.tlsDesc')} checked={form.tlsEnabled} onChange={(v) => set('tlsEnabled', v)} />
              {form.tlsEnabled && (
                <div className="space-y-3 rounded-xl border bg-secondary/40 p-4">
                  <Field label={t('wizard.tlsCa')} hint={t('wizard.tlsCaHint')}>
                    <Textarea rows={3} value={form.caCert} onChange={(e) => set('caCert', e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" />
                  </Field>
                  <Field label={t('wizard.tlsSni')} hint={t('wizard.tlsSniHint')}><Input value={form.sni} onChange={(e) => set('sni', e.target.value)} placeholder="redis.internal.acme.io" className="font-mono" /></Field>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Switch checked={form.tlsSkipVerify} onCheckedChange={(v) => set('tlsSkipVerify', v)} />
                    {t('wizard.tlsSkip')} <span className="rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning">{t('wizard.insecure')}</span>
                  </label>
                </div>
              )}
              <div className="border-t pt-4" />
              <ToggleRow title={t('wizard.ssh')} desc={t('wizard.sshDesc')} checked={form.sshEnabled} onChange={(v) => set('sshEnabled', v)} />
              {form.sshEnabled && (
                <div className="grid gap-4 rounded-xl border bg-secondary/40 p-4 sm:grid-cols-2">
                  <Field label={t('wizard.sshHost')}><Input value={form.sshHost} onChange={(e) => set('sshHost', e.target.value)} className="font-mono" /></Field>
                  <Field label={t('common.port')}><Input type="number" value={form.sshPort} onChange={(e) => set('sshPort', e.target.value)} className="font-mono" /></Field>
                  <Field label={t('wizard.sshUser')}><Input value={form.sshUser} onChange={(e) => set('sshUser', e.target.value)} /></Field>
                  <Field label={t('wizard.sshPassword')}><Input type="password" value={form.sshPassword} onChange={(e) => set('sshPassword', e.target.value)} /></Field>
                  <div className="sm:col-span-2">
                    <Field label={t('wizard.sshKey')}><Textarea rows={2} value={form.sshPrivateKey} onChange={(e) => set('sshPrivateKey', e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" /></Field>
                  </div>
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('wizard.mode')}>
                  <Select value={form.mode} onValueChange={(v) => set('mode', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['standalone', 'replica', 'cluster', 'sentinel'].map((m) => <SelectItem key={m} value={m}>{t(`wizard.mode.${m}` as never)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('wizard.sentinelMaster')}>
                  <Input value={form.sentinelMaster} onChange={(e) => set('sentinelMaster', e.target.value)} placeholder="mymaster" disabled={form.mode !== 'sentinel'} />
                </Field>
              </div>
              <ToggleRow title={t('wizard.readOnly')} desc={t('wizard.readOnlyDesc')} checked={form.readOnly} onChange={(v) => set('readOnly', v)} />
              <ToggleRow title={t('wizard.guard')} desc={t('wizard.guardDesc')} checked={form.guardDangerous} onChange={(v) => set('guardDangerous', v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('wizard.scanCount')} hint={t('wizard.scanCountHint')}><Input type="number" value={form.scanCount} onChange={(e) => set('scanCount', e.target.value)} className="max-w-40 font-mono" /></Field>
                <Field label={t('server.tabDatabases')}><Input type="number" value={form.visibleDbs} onChange={(e) => set('visibleDbs', e.target.value)} className="max-w-40 font-mono" /></Field>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="overflow-hidden rounded-xl border">
                {[
                  [t('common.name'), form.name],
                  [t('wizard.reviewEndpoint'), `${form.host}:${form.port}`],
                  [t('wizard.reviewAuth'), form.username ? t('wizard.reviewAuthUser') : t('wizard.reviewAuthNone')],
                  [t('wizard.reviewTls'), form.tlsEnabled ? t('wizard.reviewOn') : t('wizard.reviewOff')],
                  [t('wizard.reviewMode'), t(`wizard.mode.${form.mode}` as never)],
                  [t('wizard.reviewGuards'), form.guardDangerous ? t('wizard.reviewOn') : t('wizard.reviewOff')],
                ].map(([k, v], i) => (
                  <div key={i} className={cn('flex items-center justify-between gap-4 border-b px-3.5 py-2.5 text-[13px] last:border-0', i % 2 === 0 && 'bg-secondary/50')}>
                    <span className="text-muted-foreground">{k}</span><span className="font-mono text-xs font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-xl border border-dashed p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('wizard.runTest')}</span>
                  <Button variant="outline" size="sm" onClick={runTest} disabled={testing || !stepValid}>
                    <Play className="size-3.5" />{testing ? t('wizard.testing') : t('wizard.runTest')}
                  </Button>
                </div>
                {probe && probe.ok && (
                  <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-success"><Check className="size-4" />{t('wizard.testOk', { ms: probe.latencyMs ?? 0 })}</span>
                    <span className="font-mono text-xs text-muted-foreground">{probe.engine} {probe.version} · {probe.role}</span>
                  </div>
                )}
                {probe && !probe.ok && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-semibold text-destructive">
                    <CircleAlert className="size-4" />{t('wizard.testFail')}
                  </div>
                )}
              </div>
              {error && (
                <p className="flex items-center gap-2 text-sm text-destructive"><Lock className="size-4" />{error}</p>
              )}
            </>
          )}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}>
              <ArrowLeft className="size-4 rtl:-scale-x-100" />{t('common.back')}
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!stepValid}>{t('common.next')}<ArrowRight className="size-4 rtl:-scale-x-100" /></Button>
            ) : (
              <Button onClick={save} disabled={saving || !probe?.ok}>{saving ? t('common.loading') : editing ? t('common.save') : t('wizard.create')}<Check className="size-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="max-w-[520px]"><b className="text-[13.5px]">{title}</b><p className="mt-0.5 text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
