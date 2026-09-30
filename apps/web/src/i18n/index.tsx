import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en, { type Dictionary } from './en';
import ar from './ar';
import tr from './tr';
import fa from './fa';

export type Locale = 'en' | 'ar' | 'tr' | 'fa';
export type { Dictionary };

const DICTS: Record<Locale, Dictionary> = { en, ar, tr, fa };
export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'fa', label: 'Persian', native: 'فارسی' },
];

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: 'ltr' | 'rtl';
  /** Settings → Appearance: mirror the UI even in an LTR locale. */
  rtlPreview: boolean;
  setRtlPreview: (on: boolean) => void;
  t: (key: keyof Dictionary, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);
const STORAGE_KEY = 'valkyrie.locale';
const RTL_KEY = 'valkyrie.rtl';

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && DICTS[stored]) return stored;
  const nav = navigator.language.slice(0, 2) as Locale;
  return DICTS[nav] ? nav : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const [rtlPreview, setRtlPreviewState] = useState<boolean>(() => localStorage.getItem(RTL_KEY) === 'true');
  const dir: 'ltr' | 'rtl' = locale === 'ar' || locale === 'fa' || rtlPreview ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }, []);

  const setRtlPreview = useCallback((on: boolean) => {
    if (on) localStorage.setItem(RTL_KEY, 'true');
    else localStorage.removeItem(RTL_KEY);
    setRtlPreviewState(on);
  }, []);

  const t = useCallback((key: keyof Dictionary, vars?: Record<string, string | number>) => {
    let text: string = DICTS[locale][key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, dir, rtlPreview, setRtlPreview, t }), [locale, setLocale, dir, rtlPreview, setRtlPreview, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
