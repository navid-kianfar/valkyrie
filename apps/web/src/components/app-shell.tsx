import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ChevronDown, ChevronUp, Globe, Key, LayoutDashboard, LogOut, MenuIcon,
  Moon, Plus, Search, Server, Settings as SettingsIcon, SlidersHorizontal, Sun, Zap, Check, Bell, BookOpen,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/kit';
import { BrandChip, EngineChip, StatusDot } from '@/components/brand';
import { CommandPalette } from '@/components/command-palette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n, LOCALES, type Locale } from '@/i18n';
import { useTheme } from '@/providers/theme';
import { usePreferences } from '@/providers/preferences';
import { useAuth } from '@/providers/auth';
import { useSources } from '@/hooks/use-sources';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

export function AppShell() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme, resolved } = useTheme();
  const { logout } = useAuth();
  const { local } = usePreferences();
  const { data: sources } = useSources();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const healthy = sources?.filter((s) => s.stats.status === 'ok').length ?? 0;
  const total = sources?.length ?? 0;
  const usedMemory = sources?.reduce((sum, s) => sum + s.stats.usedMemory, 0) ?? 0;
  const maxMemory = sources?.reduce((sum, s) => sum + s.stats.maxMemory, 0) ?? 0;
  const unhealthy = sources?.filter((s) => s.stats.status === 'err' || s.stats.status === 'warn') ?? [];
  const title = pageTitle(location.pathname, t as (k: string, vars?: Record<string, string | number>) => string, sources);

  const fleetPercent = maxMemory > 0 ? Math.min(100, Math.round((usedMemory / maxMemory) * 100)) : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen">
        <aside className={cn('sticky top-0 flex h-screen flex-col overflow-y-auto border-e bg-card transition-all', collapsed ? 'w-16' : 'w-64')}>
          <div className="flex min-h-14 items-center gap-2.5 border-b px-4 py-3">
            <BrandChip size={32} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-tight">{t('common.appName')}</span>
                <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{local.consoleLabel || t('common.appTag')}</span>
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn('mx-3.5 mt-3 flex items-center gap-2.5 rounded-xl border bg-secondary/60 p-2.5 text-start hover:border-border-strong', collapsed && 'justify-center')}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Server className="size-4" /></span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-xs font-bold">{t('nav.allSources')}</b>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {healthy}/{total} {t('dash.clients')}
                      </span>
                    </span>
                    <span className="flex flex-col leading-none text-muted-foreground">
                      <ChevronUp className="size-3" /><ChevronDown className="size-3" />
                    </span>
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => navigate('/')}>
                <Check className="text-primary" />
                {t('nav.allSources')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {sources?.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => navigate(`/sources/${s.id}`)}>
                  <EngineChip source={s} />
                  <span className="truncate">{s.name}</span>
                  <span className="ms-auto"><StatusDot status={s.stats.status} pulse /></span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/sources/new')}>
                <Plus />
                {t('nav.addServer')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav className="flex flex-col gap-0.5 px-3 py-3">
            <div className={cn('px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', collapsed && 'text-center')}>{collapsed ? '·' : t('nav.general')}</div>
            {[
              { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), end: true },
              { to: '/keys', icon: Key, label: t('nav.keyBrowser') },
              { to: '/bulk', icon: Zap, label: t('nav.bulkOps') },
              { to: '/activity', icon: Activity, label: t('nav.activity') },
              { to: '/settings', icon: SlidersHorizontal, label: t('nav.settings') },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground',
                  isActive && 'bg-accent font-semibold text-accent-foreground [&_svg]:text-primary',
                  collapsed && 'justify-center px-0',
                )}
              >
                <item.icon className="size-4" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t p-3.5">
            {!collapsed && (
              <div className="mb-3 rounded-xl border bg-secondary/50 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold">{t('nav.fleetMemory')}</span>
                  <span className="text-[11px] text-muted-foreground">{maxMemory > 0 ? `${fleetPercent}%` : '—'}</span>
                </div>
                <Meter percent={fleetPercent} />
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  {formatBytes(usedMemory, locale)}{maxMemory > 0 ? ` / ${formatBytes(maxMemory, locale)}` : ''}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'justify-center')}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-accent text-xs font-bold text-primary">AD</span>
                {!collapsed && (
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{sources ? 'admin' : '…'}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">{t('common.envCredentials')}</span>
                  </span>
                )}
              </div>
              {!collapsed && (
                <Button variant="ghost" size="icon" onClick={logout} aria-label={t('common.signOut')}>
                  <LogOut className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/85 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} aria-label="sidebar">
              <MenuIcon className="size-4" />
            </Button>
            <span className="truncate text-sm font-bold">{title}</span>
            <div className="flex-1" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 w-[340px] items-center gap-2.5 rounded-lg border bg-secondary/60 px-3 text-sm text-muted-foreground hover:text-foreground md:flex"
            >
              <Search className="size-4" />
              <span className="flex-1 text-start">{t('common.search')}</span>
              <kbd className="rounded border bg-card px-1.5 py-0.5 text-[11px]">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label="search">
              <Search className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={t('nav.notifications')}>
                  <Bell className="size-4" />
                  {unhealthy.length > 0 && (
                    <span className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full border-2 border-card bg-destructive text-[9px] font-bold text-white">
                      {unhealthy.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>{t('nav.notifications')}</DropdownMenuLabel>
                {unhealthy.length === 0 && <div className="px-2.5 py-3 text-sm text-muted-foreground">{t('nav.notificationsEmpty')}</div>}
                {unhealthy.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => navigate(`/sources/${s.id}`)}>
                    <EngineChip source={s} />
                    <span className="truncate">{s.name}</span>
                    <span className="ms-auto"><StatusDot status={s.stats.status} /></span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-1.5 px-2 text-[13px] font-semibold">
                  <Globe className="size-4" />
                  {locale.toUpperCase()}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LOCALES.map((l) => (
                  <DropdownMenuItem key={l.code} onSelect={() => setLocale(l.code as Locale)}>
                    <Check className={cn(locale === l.code ? 'opacity-100' : 'opacity-0')} />
                    {l.native}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label={t('nav.theme')}>
                  {theme === 'system' ? <SunMoon2 /> : resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('nav.theme')}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-accent text-xs font-bold text-primary">AD</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>admin · {t('common.envCredentials')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}><SettingsIcon />{t('nav.settings')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/login')}><BookOpen />{t('common.appName')} concept</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={logout}><LogOut />{t('common.signOut')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="w-full flex-1 px-7 pb-14 pt-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
    </TooltipProvider>
  );
}

function SunMoon2() {
  return <Sun className="size-4 opacity-70" />;
}

function pageTitle(pathname: string, t: (k: string, vars?: Record<string, string | number>) => string, sources?: { id: number; name: string }[]): string {
  if (pathname === '/') return t('nav.dashboard');
  if (pathname === '/welcome') return t('welcome.title');
  if (/^\/sources\/(new|\d+)/.test(pathname)) {
    const id = Number(pathname.split('/')[2]);
    const src = sources?.find((x: { id: number; name: string }) => x.id === id);
    return src ? src.name : t('wizard.title');
  }
  if (pathname.startsWith('/keys')) return t('nav.keyBrowser');
  if (pathname.startsWith('/bulk')) return t('nav.bulkOps');
  if (pathname.startsWith('/activity')) return t('nav.activity');
  if (pathname.startsWith('/settings')) return t('nav.settings');
  if (pathname.startsWith('/cli')) return t('cli.title');
  return '';
}
