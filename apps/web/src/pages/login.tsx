import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, ArrowRight, AlertTriangle, Languages, Moon, Sun, LightningFill } from '@/components/icons';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/auth';
import { useTheme } from '@/providers/theme';
import { usePreferences } from '@/providers/preferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BrandChip } from '@/components/brand';
import { useMeta } from '@/hooks/use-sources';
import { LOCALES, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

export function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { login } = useAuth();
  const { resolved, setTheme } = useTheme();
  const { local } = usePreferences();
  const { data: meta } = useMeta();
  const [showPw, setShowPw] = useState(false);
  const [username] = useState('admin');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(local.sessionTimeout !== '8h');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await login(username, password, remember);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.06fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden px-[52px] pb-[38px] pt-[42px] text-[#e7e9f8] lg:flex" style={{ background: 'radial-gradient(1100px 620px at 88% -12%, rgba(99,102,241,.5) 0%, rgba(99,102,241,0) 55%), radial-gradient(900px 540px at -12% 112%, rgba(49,46,129,.5) 0%, rgba(49,46,129,0) 58%), #0b0b18' }}>
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(148,163,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,255,.055) 1px, transparent 1px)', backgroundSize: '36px 36px', maskImage: 'radial-gradient(ellipse 90% 80% at 40% 20%, black 35%, transparent 78%)' }} />
        <div className="relative flex items-center gap-3">
          <BrandChip size={38} />
          <b className="text-[17.5px] tracking-tight text-white">{t('common.appName')}</b>
          <span className="ms-auto font-mono text-[11.5px] text-white/40">{meta ? `v${meta.version}` : ''}</span>
        </div>

        <div className="relative mt-[8vh]">
          <h1 className="max-w-[520px] text-[clamp(34px,3.3vw,46px)] font-[750] leading-[1.12] tracking-[-.03em] text-white">{t('login.brandTitle')}</h1>
          <p className="mt-[18px] max-w-[460px] text-[15.5px] leading-relaxed text-[#a5aacb]">{t('login.brandSubtitle')}</p>

          {/* Live-looking fleet mock-ups, as on the concept's auth screen. */}
          <div className="relative mt-[7vh] max-w-[470px] pb-24">
            <div className="rounded-[15px] border border-white/[.09] bg-[rgba(16,15,36,.78)] p-[17px] shadow-[0_28px_70px_-14px_rgba(0,0,0,.6)] backdrop-blur-[7px]">
              {[
                { name: 'prod-redis-01', ms: '12 ms', pct: 72, dot: 'bg-emerald-400' },
                { name: 'cache-valkey-01', ms: '8 ms', pct: 48, dot: 'bg-emerald-400' },
                { name: 'analytics-redis', ms: '184 ms', pct: 31, dot: 'bg-amber-400' },
              ].map((row, i) => (
                <div key={row.name} className={cn(i > 0 && 'mt-3')}>
                  <div className="flex items-center gap-2.5">
                    <span className={cn('size-[9px] shrink-0 rounded-full', row.dot)} />
                    <span className="font-mono text-[13px] font-medium text-[#eceefc]">{row.name}</span>
                    <span className="ms-auto font-mono text-xs text-[#8f95bd]">{row.ms}</span>
                  </div>
                  <div className="mt-[11px] h-1 overflow-hidden rounded-full bg-white/[.09]">
                    <i className="block h-full rounded-full bg-[#818cf8]" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute -end-[54px] bottom-0 w-[76%] rounded-[15px] border border-white/[.09] bg-[rgba(16,15,36,.78)] p-[17px] shadow-[0_28px_70px_-14px_rgba(0,0,0,.6)] backdrop-blur-[7px]" style={{ animation: 'vk-floaty 7s ease-in-out infinite alternate' }}>
              <div className="flex items-center gap-2.5">
                <LightningFill className="size-4 text-[#a5b4fc]" />
                <b className="text-[13.5px] text-[#eceefc]">{t('login.preview.bulk')}</b>
                <span className="ms-auto font-mono text-xs text-[#8f95bd]">64%</span>
              </div>
              <div className="mt-[11px] h-1 overflow-hidden rounded-full bg-white/[.09]">
                <i className="block h-full w-[64%] rounded-full bg-[#a5b4fc]" />
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="font-mono text-xs text-[#8f95bd]">{t('login.preview.keys')}</span>
                <span className="ms-auto font-mono text-xs text-[#8f95bd]">{t('login.preview.freed')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-[6vh] flex flex-wrap gap-2.5">
          {['Redis 6.2', 'Redis 7.x', 'Valkey 7 / 8', 'KeyDB', 'Dragonfly', 'Cluster', 'Sentinel'].map((chip) => (
            <span key={chip} className="rounded-full border border-white/15 bg-white/[.03] px-3.5 py-1.5 text-[13px] text-[#b9bdd9]">{chip}</span>
          ))}
        </div>
      </section>

      <section className="relative flex flex-col bg-card px-[30px] pb-5 pt-6">
        <div className="flex justify-end gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-[37px] gap-2 px-3 text-[13px] font-semibold" aria-label={t('nav.language')}>
                <Languages className="size-[15px]" />
                {locale.toUpperCase()}
                <span className="text-[10px] opacity-60">▾</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px]">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l.code} onSelect={() => setLocale(l.code as Locale)} className={cn(locale === l.code && 'text-primary')}>
                  <span className={cn('w-3.5', locale !== l.code && 'opacity-0')}>✓</span>
                  {l.native}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="size-[37px]"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={t('nav.theme')}
          >
            {resolved === 'dark' ? <Moon className="size-[15px]" /> : <Sun className="size-[15px]" />}
          </Button>
        </div>

        <div className="mx-auto my-auto w-full max-w-[430px] py-10">
          <h1 className="text-[31px] font-bold tracking-[-.025em]">{t('login.welcome')}</h1>
          <p className="mt-1.5 text-[14.5px] text-muted-foreground">{t('login.subtitle')}</p>
          <form className="mt-[30px]" onSubmit={submit}>
            <div className="mb-4">
              <Label htmlFor="username" className="mb-1.5">{t('common.username')}</Label>
              <Input id="username" value={username} readOnly className="cursor-default bg-secondary text-muted-foreground" />
            </div>
            <div className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <Label htmlFor="password">{t('common.password')}</Label>
                <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => toast.info(t('login.forgotToast'))}>{t('login.forgot')}</button>
              </div>
              <div className="relative">
                <Input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={cn('pe-10', error && 'border-destructive')} autoFocus />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-destructive">
                  <AlertTriangle className="size-3.5" />{t('login.invalid')}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              {t('login.remember')}
            </label>
            <Button type="submit" size="lg" className="mt-5 w-full gap-2" disabled={busy}>
              {t('common.signIn')}<ArrowRight className="size-4 rtl:-scale-x-100" />
            </Button>
            <div className="mt-6 flex items-center gap-3 rounded-[13px] border bg-secondary/40 px-4 py-3 text-[12.5px] text-muted-foreground">
              <ShieldCheck className="size-[17px] shrink-0 text-primary" />
              {t('login.secured')}
            </div>
          </form>
        </div>
        <p className="pb-1.5 text-center text-xs text-muted-foreground">
          {t('common.appName')} <span className="font-mono">{meta ? `v${meta.version}` : ''}</span> · {t('login.footer')}
        </p>
      </section>
    </div>
  );
}
