import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Globe, Info, Layers, Monitor, Moon, RotateCcw, SlidersHorizontal, Sun, Trash2 } from '@/components/icons';
import { useI18n, LOCALES, type Locale, type Dictionary } from '@/i18n';
import { useTheme } from '@/providers/theme';
import { usePreferences, type SessionTimeout } from '@/providers/preferences';
import { useMeta, useSources } from '@/hooks/use-sources';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/kit-extra';
import { BrandChip } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Section = 'appearance' | 'general' | 'defaults' | 'about' | 'danger';

const NAV: { id: Section; icon: typeof Sun; key: keyof Dictionary }[] = [
  { id: 'appearance', icon: Sun, key: 'settings.appearance' },
  { id: 'general', icon: SlidersHorizontal, key: 'settings.general' },
  { id: 'defaults', icon: Layers, key: 'settings.defaults' },
  { id: 'about', icon: Info, key: 'settings.about' },
  { id: 'danger', icon: AlertTriangle, key: 'settings.danger' },
];

export function SettingsPage() {
  const { t, locale, setLocale, dir, rtlPreview, setRtlPreview } = useI18n();
  const { theme, setTheme } = useTheme();
  const { data: meta } = useMeta();
  const { local, setLocal, server, setServer } = usePreferences();
  const [section, setSection] = useState<Section>('appearance');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState('');
  const [resetting, setResetting] = useState(false);
  const { data: sources } = useSources();

  const themes = [
    { id: 'light', icon: Sun, label: t('settings.theme.light') },
    { id: 'dark', icon: Moon, label: t('settings.theme.dark'), badge: t('settings.theme.default') },
    { id: 'system', icon: Monitor, label: t('settings.theme.system') },
  ] as const;

  function resetWorkspace() {
    localStorage.removeItem('valkyrie.cliHistory');
    setLocal('scanCount', 200);
    setLocal('pageSize', 50);
    setLocal('defaultTtl', 0);
    setLocal('valuePreviewKb', 10);
    setLocal('consoleLabel', '');
    toast.success(t('settings.resetWorkspaceDone'));
  }

  async function resetApplication() {
    if (resetWord !== 'reset') return;
    setResetting(true);
    try {
      for (const source of sources ?? []) {
        await api.del(`/sources/${source.id}`);
      }
      localStorage.removeItem('valkyrie.cliHistory');
      localStorage.removeItem('valkyrie.prefs');
      toast.success(t('settings.resetApplicationDone', { n: sources?.length ?? 0 }));
      setResetOpen(false);
      setResetWord('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} desc={t('settings.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="sticky top-[70px] self-start rounded-xl border bg-card p-2.5">
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
                  section === n.id && 'bg-accent font-semibold text-accent-foreground [&_svg]:text-primary',
                  n.id === 'danger' && 'text-destructive [&_svg]:text-destructive',
                )}
              >
                <n.icon className="size-4 shrink-0" />{t(n.key)}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {section === 'appearance' && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-[15px]">{t('settings.appearance')}</CardTitle>
                  <CardDescription className="text-[13px]">{t('settings.themeDesc')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Label className="mb-2 block text-sm">{t('settings.theme')}</Label>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                  {themes.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => setTheme(th.id)}
                      aria-pressed={theme === th.id}
                      className={cn(
                        'rounded-xl border-[1.5px] p-2.5 text-center transition-all hover:border-border-strong',
                        theme === th.id ? 'border-primary shadow-[0_0_0_3px] shadow-ring/25' : 'border-border',
                      )}
                    >
                      <ThemePreview variant={th.id} />
                      <b className="flex items-center justify-center gap-1.5 text-xs">
                        {th.label}
                        {'badge' in th && th.badge && <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">{th.badge}</span>}
                      </b>
                    </button>
                  ))}
                </div>

                <Separator className="my-5" />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-md">
                    <b className="flex items-center gap-2 text-[13.5px]"><Globe className="size-4 text-primary" />{t('settings.language')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
                  </div>
                  <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.native}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className="max-w-md">
                    <b className="text-[13.5px]">{t('settings.rtl')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('settings.rtlDesc')} <code className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{dir}</code>
                    </p>
                  </div>
                  <Switch checked={rtlPreview} onCheckedChange={setRtlPreview} aria-label={t('settings.rtl')} />
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className="max-w-md">
                    <b className="text-[13.5px]">{t('settings.compact')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.compactDesc')}</p>
                  </div>
                  <Switch checked={local.compact} onCheckedChange={(v) => setLocal('compact', v)} aria-label={t('settings.compact')} />
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'general' && (
            <Card>
              <CardHeader><CardTitle className="text-[15px]">{t('settings.general')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5" htmlFor="console-label">{t('settings.consoleLabel')}</Label>
                    <Input
                      id="console-label"
                      value={local.consoleLabel}
                      onChange={(e) => setLocal('consoleLabel', e.target.value)}
                      placeholder={t('settings.consoleLabelPlaceholder')}
                      maxLength={48}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.consoleLabelHint')}</p>
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.sessionTimeout')}</Label>
                    <Select value={local.sessionTimeout} onValueChange={(v) => setLocal('sessionTimeout', v as SessionTimeout)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8h">{t('settings.session.8h')}</SelectItem>
                        <SelectItem value="24h">{t('settings.session.24h')}</SelectItem>
                        <SelectItem value="30d">{t('settings.session.30d')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className="max-w-lg">
                    <b className="text-[13.5px]">{t('settings.logCommands')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.logCommandsDesc')}</p>
                  </div>
                  <Switch checked={server.logCommands} onCheckedChange={(v) => setServer({ logCommands: v })} aria-label={t('settings.logCommands')} />
                </div>

                <Separator className="my-5" />

                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-lg">
                    <b className="text-[13.5px]">{t('settings.poll')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.pollDesc')}</p>
                  </div>
                  <Switch checked={server.pollSeconds > 0} onCheckedChange={(v) => setServer({ pollSeconds: v ? 5 : 0 })} aria-label={t('settings.poll')} />
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'defaults' && (
            <Card>
              <CardHeader><CardTitle className="text-[15px]">{t('settings.defaults')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.scanCount')}</Label>
                    <Input
                      type="number" min={10} max={5000} value={local.scanCount}
                      onChange={(e) => setLocal('scanCount', Number(e.target.value) || 0)}
                      className="max-w-44 font-mono"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaults.scanCountHint')}</p>
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.pageSize')}</Label>
                    <Select value={String(local.pageSize)} onValueChange={(v) => setLocal('pageSize', Number(v))}>
                      <SelectTrigger className="max-w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{[10, 50, 100, 250].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.defaultTtl')}</Label>
                    <Input
                      type="number" min={0} value={local.defaultTtl}
                      onChange={(e) => setLocal('defaultTtl', Number(e.target.value) || 0)}
                      className="max-w-44 font-mono"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaults.defaultTtlHint')}</p>
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.valuePreview')}</Label>
                    <Select value={String(local.valuePreviewKb)} onValueChange={(v) => setLocal('valuePreviewKb', Number(v))}>
                      <SelectTrigger className="max-w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1, 10, 100].map((n) => <SelectItem key={n} value={String(n)}>{`${n} KB`}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaults.valuePreviewHint')}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{t('settings.defaultsNote')}</p>
              </CardContent>
            </Card>
          )}

          {section === 'about' && (
            <Card>
              <CardHeader><CardTitle className="text-[15px]">{t('settings.about')}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3.5">
                <BrandChip size={40} />
                <div className="min-w-0">
                  <b className="flex items-center gap-2 text-sm">
                    {t('common.appName')}
                    <span className="rounded-md border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{meta ? `v${meta.version}` : '—'}</span>
                  </b>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings.aboutDesc')}</p>
                </div>
                <span className="flex-1" />
                <Badge variant="outline">{t('common.selfHosted')}</Badge>
                <Button
                  variant="outline"
                  onClick={() => toast.success(t('settings.upToDate'), { description: meta ? `v${meta.version}` : undefined })}
                >
                  <RotateCcw className="size-4" />{t('settings.checkUpdates')}
                </Button>
              </CardContent>
            </Card>
          )}

          {section === 'danger' && (
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-[15px] text-destructive">{t('settings.danger')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-lg">
                    <b className="text-[13.5px]">{t('settings.resetWorkspace')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.resetWorkspaceDesc')}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={resetWorkspace}>
                    {t('settings.resetWorkspaceAction')}
                  </Button>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-lg">
                    <b className="text-[13.5px]">{t('settings.resetApplication')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.resetApplicationDesc')}</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => { setResetWord(''); setResetOpen(true); }}>
                    <Trash2 className="size-4" />{t('settings.resetApplicationAction')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.resetDesc', { n: sources?.length ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="mb-1.5">{t('settings.resetTypeWord', { word: 'reset' })}</Label>
            <Input value={resetWord} onChange={(e) => setResetWord(e.target.value)} placeholder="reset" className="font-mono" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
              disabled={resetWord !== 'reset' || resetting}
              onClick={(e) => { e.preventDefault(); void resetApplication(); }}
            >
              {t('settings.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Miniature console mock-up shown inside each theme card, as in the concept. */
function ThemePreview({ variant }: { variant: 'light' | 'dark' | 'system' }) {
  return (
    <div
      className={cn(
        'mb-2 flex h-16 flex-col overflow-hidden rounded-[9px] border',
        variant === 'light' && 'border-zinc-200 bg-[#f2f4f8]',
        variant === 'dark' && 'border-[#1d2836] bg-[#0a0e14]',
        variant === 'system' && 'border-border',
      )}
      style={variant === 'system' ? { background: 'linear-gradient(90deg,#f2f4f8 50%,#0a0e14 50%)' } : undefined}
    >
      {variant !== 'system' && (
        <div className={cn('flex h-3 items-center gap-[3px] px-[5px]', variant === 'light' ? 'bg-white' : 'bg-[#10161e]')}>
          {[0, 1, 2].map((i) => (
            <i key={i} className={cn('block size-1 rounded-full', i === 2 ? 'bg-primary' : variant === 'light' ? 'bg-[#cdd5df]' : 'bg-[#2b3a4b]')} />
          ))}
        </div>
      )}
      <div className="flex flex-1 gap-1 p-[5px]">
        <div className={cn('w-[18px] rounded', variant === 'light' ? 'bg-white' : variant === 'dark' ? 'bg-[#10161e]' : 'bg-white/90')} />
        <div className={cn('grid flex-1 grid-cols-2 gap-[3px] rounded p-1', variant === 'light' ? 'bg-white' : 'bg-[#10161e]')}>
          {[0, 1, 2, 3].map((i) => <i key={i} className={cn('block rounded-[3px]', variant === 'light' ? 'bg-[#eef1f5]' : 'bg-[#1b2531]')} />)}
        </div>
      </div>
    </div>
  );
}
