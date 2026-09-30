import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; resolved: 'light' | 'dark'; }
const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'valkyrie.theme';

function apply(theme: Theme): 'light' | 'dark' {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  return dark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'light');
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => apply((localStorage.getItem(KEY) as Theme) || 'light'));

  useEffect(() => {
    setResolved(apply(theme));
    localStorage.setItem(KEY, theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(apply(theme));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return <Ctx.Provider value={{ theme, setTheme: setThemeState, resolved }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme outside provider');
  return ctx;
}
