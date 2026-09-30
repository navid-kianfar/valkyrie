import { useState } from 'react';
import { toast } from 'sonner';
import { Globe, Info, Moon, SlidersHorizontal, Sun, Layers, AlertTriangle, Monitor } from 'lucide-react';
import { useI18n, LOCALES, type Locale } from '@/i18n';
import { useTheme } from '@/providers/theme';
import { useMeta } from '@/hooks/use-sources';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/kit-extra';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { BrandChip } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV = [
  { id: 'appearance', icon: Sun, key: 'settings.appearance' },
  { id: 'general', icon: SlidersHorizontal, key: 'settings.defaults' },
  { id: 'about', icon: Info, key: 'settings.about' },
  { id: 'danger', icon: AlertTriangle, key: 'settings.danger' },
] as const;

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { data: meta } = useMeta();
  const [section, setSection] = useState('appearance');
  const [scanCount, setScanCount] = useState(localStorage.getItem('valkyrie.scanCount') ?? '200');
  const [pageSize, setPageSize] = useState(localStorage.getItem('valkyrie.pageSize') ?? '50');
  const [defaultTtl, setDefaultTtl] = useState(localStorage.getItem('valkyrie.defaultTtl') ?? '0');

  function saveDefault(key: string, value: string) {
    localStorage.setItem(key, value);
    toast.success(t('settings.saved'));
  }

  function resetLocal() {
    localStorage.removeItem('valkyrie.cliHistory');
    localStorage.removeItem('valkyrie.scanCount');
    localStorage.removeItem('valkyrie.pageSize');
    localStorage.removeItem('valkyrie.defaultTtl');
    localStorage.removeItem('valkyrie.theme');
    localStorage.removeItem('valkyrie.locale');
    toast.success(t('settings.saved'));
    window.location.reload();
  }

  const themes = [
    { id: 'light', icon: Sun, label: t('settings.theme.light'), cls: 'bg-white border-zinc-200' },
    { id: 'dark', icon: Moon, label: t('settings.theme.dark'), cls: 'bg-zinc-950 border-zinc-800' },
    { id: 'system', icon: Monitor, label: t('settings.theme.system'), cls: 'bg-gradient-to-r from-white to-zinc-950 border-zinc-400' },
  ] as const;

  return (
    <div>
      <PageHeader title={t('settings.title')} desc={t('settings.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="sticky top-[70px] self-start rounded-xl border bg-card p-2.5">
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setSection(n.id)} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground', section === n.id && 'bg-accent font-semibold text-accent-foreground [&_svg]:text-primary', n.id === 'danger' && 'text-destructive [&_svg]:text-destructive')}>
                <n.icon className="size-4" />{t(n.key)}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex flex-col gap-4">
          {section === 'appearance' && (
            <Card>
              <CardHeader><CardTitle>{t('settings.appearance')}</CardTitle><CardDescription>{t('settings.themeDesc')}</CardDescription></CardHeader>
              <CardContent>
                <Label className="mb-2 block text-sm">{t('settings.theme')}</Label>
                <div className="grid max-w-lg grid-cols-3 gap-3">
                  {themes.map((th) => (
                    <button key={th.id} onClick={() => setTheme(th.id)} className={cn('rounded-xl border-[1.5px] p-2.5 text-center transition-all hover:border-strong', theme === th.id ? 'border-primary shadow-[0_0_0_3px] shadow-ring/20' : 'border-border')}>
                      <div className={cn('mb-2 flex h-14 items-center justify-center rounded-lg border', th.cls)}><th.icon className="size-5 text-muted-foreground" /></div>
                      <b className="text-xs">{th.label}</b>
                    </button>
                  ))}
                </div>
                <Separator className="my-5" />
                <div className="flex items-center justify-between gap-4">
                  <div className="max-w-md">
                    <b className="flex items-center gap-2 text-[13.5px]"><Globe className="size-4 text-primary" />{t('settings.language')}</b>
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
                  </div>
                  <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.native}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'general' && (
            <Card>
              <CardHeader><CardTitle>{t('settings.defaults')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.scanCount')}</Label>
                    <Input type="number" value={scanCount} onChange={(e) => setScanCount(e.target.value)} onBlur={() => saveDefault('valkyrie.scanCount', scanCount)} className="max-w-40 font-mono" />
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaults.scanCountHint')}</p>
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.pageSize')}</Label>
                    <Input type="number" value={pageSize} onChange={(e) => setPageSize(e.target.value)} onBlur={() => saveDefault('valkyrie.pageSize', pageSize)} className="max-w-40 font-mono" />
                  </div>
                  <div>
                    <Label className="mb-1.5">{t('settings.defaults.defaultTtl')}</Label>
                    <Input type="number" value={defaultTtl} onChange={(e) => setDefaultTtl(e.target.value)} onBlur={() => saveDefault('valkyrie.defaultTtl', defaultTtl)} className="max-w-40 font-mono" />
                    <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaults.defaultTtlHint')}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{t('settings.defaultsNote')}</p>
              </CardContent>
            </Card>
          )}

          {section === 'about' && (
            <Card>
              <CardHeader><CardTitle>{t('settings.about')}</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-4">
                <BrandChip size={40} />
                <div>
                  <b className="text-sm">{t('common.appName')} <span className="ms-1 rounded-md border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{meta ? `v${meta.version}` : ''}</span></b>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings.aboutDesc')}</p>
                </div>
                <span className="flex-1" />
                <Badge variant="outline">{t('common.selfHosted')}</Badge>
              </CardContent>
            </Card>
          )}

          {section === 'danger' && (
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-destructive">{t('settings.danger')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <b className="text-[13.5px]">{t('settings.defaults')}</b>
                    <p className="text-xs text-muted-foreground">{t('settings.defaultsNote')}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetLocal}>{t('common.delete')}</Button>
                </div>
                <Separator />
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="size-3.5" />{t('settings.aboutDesc')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
