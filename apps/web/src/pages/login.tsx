import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/auth';
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
  const { data: meta } = useMeta();
  const [showPw, setShowPw] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
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
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 text-[#e7e9f8] lg:flex" style={{ background: 'radial-gradient(1100px 620px at 88% -12%, rgba(99,102,241,.5) 0%, rgba(99,102,241,0) 55%), radial-gradient(900px 540px at -12% 112%, rgba(49,46,129,.5) 0%, rgba(49,46,129,0) 58%), #0b0b18' }}>
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(148,163,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,255,.055) 1px, transparent 1px)', backgroundSize: '36px 36px', maskImage: 'radial-gradient(ellipse 90% 80% at 40% 20%, black 35%, transparent 78%)' }} />
        <div className="relative flex items-center gap-3">
          <BrandChip size={38} />
          <b className="text-[17px] tracking-tight text-white">{t('common.appName')}</b>
          <span className="ms-auto font-mono text-xs text-white/40">{meta ? `v${meta.version}` : ''}</span>
        </div>
        <div className="relative">
          <h1 className="max-w-[520px] text-[clamp(34px,3.3vw,46px)] font-extrabold leading-[1.12] tracking-tight text-white">{t('login.brandTitle')}</h1>
          <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-[#a5aacb]">{t('login.brandSubtitle')}</p>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          {['Redis 6.2', 'Redis 7.x', 'Valkey 7 / 8', 'KeyDB', 'Dragonfly', 'Cluster', 'Sentinel'].map((chip) => (
            <span key={chip} className="rounded-full border border-white/15 bg-white/[.03] px-3.5 py-1.5 text-[13px] text-[#b9bdd9]">{chip}</span>
          ))}
        </div>
      </section>

      <section className="relative flex flex-col bg-card p-7">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-1.5 px-2.5 text-[13px] font-semibold">{locale.toUpperCase()}<span className="text-xs">▾</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l.code} onSelect={() => setLocale(l.code as Locale)} className={cn(locale === l.code && 'text-primary')}>{l.native}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mx-auto my-auto w-full max-w-[430px] py-10">
          <h1 className="text-[31px] font-bold tracking-tight">{t('login.welcome')}</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{t('login.subtitle')}</p>
          <form className="mt-7" onSubmit={submit}>
            <div className="mb-4">
              <Label htmlFor="username" className="mb-1.5">{t('common.username')}</Label>
              <Input id="username" value={username} readOnly className="cursor-default bg-secondary text-muted-foreground" />
            </div>
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password">{t('common.password')}</Label>
                <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => toast.info(t('login.forgotToast'))}>{t('login.forgot')}</button>
              </div>
              <div className="relative">
                <Input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={cn('pe-10', error && 'border-destructive')} autoFocus />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
            <div className="mt-6 flex items-center gap-3 rounded-xl border bg-secondary/40 px-4 py-3 text-[13px] text-muted-foreground">
              <ShieldCheck className="size-4.5 shrink-0 text-primary" />
              {t('login.secured')}
            </div>
          </form>
        </div>
        <p className="pb-2 text-center text-xs text-muted-foreground">
          {t('common.appName')} <span className="font-mono">{meta ? `v${meta.version}` : ''}</span> · {t('login.footer')}
        </p>
      </section>
    </div>
  );
}
