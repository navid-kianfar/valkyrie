import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { useI18n } from '@/i18n';
import { useSources } from '@/hooks/use-sources';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/ui/command';
import { Key, LayoutDashboard, History, Settings, Server, Plus, Zap, Terminal, SunMoon, LogOut } from '@/components/icons';

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setTheme, resolved } = useTheme();
  const { logout } = useAuth();
  const { data: sources } = useSources();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const pages = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), to: '/' },
    { icon: Key, label: t('nav.keyBrowser'), to: '/keys' },
    { icon: Zap, label: t('nav.bulkOps'), to: '/bulk' },
    { icon: History, label: t('nav.activity'), to: '/activity' },
    { icon: Settings, label: t('nav.settings'), to: '/settings' },
    { icon: Terminal, label: t('cli.title'), to: '/cli' },
    { icon: Plus, label: t('palette.action.addServer'), to: '/sources/new' },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('palette.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('palette.empty')}</CommandEmpty>
        <CommandGroup heading={t('palette.pages')}>
          {pages.map((p) => (
            <CommandItem key={p.to} onSelect={() => { setOpen(false); navigate(p.to); }}>
              <p.icon />
              {p.label}
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        {sources && sources.length > 0 && (
          <CommandGroup heading={t('palette.sources')}>
            {sources.map((s) => (
              <CommandItem key={s.id} onSelect={() => { setOpen(false); navigate(`/sources/${s.id}`); }}>
                <Server />
                <span className="truncate">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.host}:{s.port}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t('palette.actions')}>
          <CommandItem onSelect={() => { setOpen(false); setTheme(resolved === 'dark' ? 'light' : 'dark'); }}>
            <SunMoon />
            {t('palette.action.theme')}
            <CommandShortcut>⌘⇧L</CommandShortcut>
          </CommandItem>
          <CommandItem destructive onSelect={() => { setOpen(false); logout(); }}>
            <LogOut />
            {t('palette.action.signOut')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>↑ ↓ {t('palette.navigate')}</span>
        <span>↵ {t('palette.select')}</span>
        <span>esc {t('palette.close')}</span>
      </div>
    </CommandDialog>
  );
}
