export function formatNumber(n: number | null | undefined, locale: string, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
}

export function formatBytes(bytes: number | null | undefined, locale: string): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${formatNumber(value, locale, value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number, locale: string): string {
  if (seconds < 60) return `${formatNumber(seconds, locale)}s`;
  if (seconds < 3600) return `${formatNumber(Math.floor(seconds / 60), locale)}m`;
  if (seconds < 86400) return `${formatNumber(Math.floor(seconds / 3600), locale)}h`;
  return `${formatNumber(Math.floor(seconds / 86400), locale)}d`;
}

/** CLIENT LIST reports age/idle as whole seconds; -1 means "not applicable". */
export function formatSeconds(seconds: number, locale: string): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return formatDuration(Math.floor(seconds), locale);
}

export function formatMs(ms: number | null | undefined, locale: string): string {
  if (ms === null || ms === undefined) return '—';
  if (ms <= 0) return '<1 ms';
  if (ms < 1) return `${formatNumber(Math.round(ms * 1000), locale)} µs`;
  return `${formatNumber(ms, locale, ms < 10 ? 1 : 0)} ms`;
}

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
