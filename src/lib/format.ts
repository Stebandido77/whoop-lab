/**
 * The one place that decides how a number or a date looks.
 *
 * The locale is mutable on purpose. Every formatter here is called from render,
 * and the language switcher sets the locale synchronously *before* the re-render
 * it triggers, so a call always reads the locale the frame is being painted in.
 * A React context would have meant threading a hook through every leaf that
 * prints a number, which is most of them.
 */

/** Locale tags, not language codes: the decimal separator is the point of this. */
const LOCALES = { es: 'es-CO', en: 'en-GB' } as const;

let locale: string = LOCALES.es;

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

/**
 * `en-GB` rather than `en-US`: both give the point as decimal separator, which
 * is the whole reason this is switchable, but `en-GB` keeps day-before-month so
 * the axis labels stay the same width in both languages.
 */
export function setFormatLocale(lang: keyof typeof LOCALES): void {
  locale = LOCALES[lang];
  numberCache.clear();
  dateCache.clear();
}

const nf = (min: number, max: number) => {
  const key = `${locale}:${min}:${max}`;
  let cached = numberCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    numberCache.set(key, cached);
  }
  return cached;
};

const df = (key: string, options: Intl.DateTimeFormatOptions) => {
  const id = `${locale}:${key}`;
  let cached = dateCache.get(id);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    dateCache.set(id, cached);
  }
  return cached;
};

export const pad = (n: number) => String(n).padStart(2, '0');

/** `Date` -> `YYYY-MM-DD` in local time (never use toISOString: it shifts to UTC). */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromDayKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Spanish abbreviates with a trailing period («sept.») and English does not.
 * On an axis with a label every few pixels that period is a pixel of noise and
 * a character of width, and dropping it also keeps the two languages aligned.
 */
const abbreviate = (s: string) => s.replace(/\.$/, '');

/** 7 Jan 2024 was a Sunday, which is index 0 in `DayRecord.weekday`. */
const WEEKDAY_ORIGIN = new Date(2024, 0, 7);

export const weekdayName = (index: number): string => {
  const d = new Date(WEEKDAY_ORIGIN);
  d.setDate(d.getDate() + index);
  return abbreviate(df('weekday', { weekday: 'short' }).format(d));
};

export const monthName = (index: number): string =>
  abbreviate(df('month', { month: 'short' }).format(new Date(2024, index, 1)));

/**
 * Composed from the locale's own month and weekday names rather than handed to
 * `Intl.DateTimeFormat` whole, because the locale patterns are sentences —
 * `es-CO` returns «11 de sept» and puts a comma after the weekday. These labels
 * sit under a chart axis every few pixels, where every character counts. Both
 * languages the app speaks put the day before the month, which is the one thing
 * the composition assumes; a locale that does not would need its own branch.
 */
export const fmtDayShort = (k: string) => {
  const d = fromDayKey(k);
  return `${d.getDate()} ${monthName(d.getMonth())}`;
};

export const fmtDayLong = (k: string) => {
  const d = fromDayKey(k);
  return `${weekdayName(d.getDay())} ${d.getDate()} ${monthName(d.getMonth())} ${String(d.getFullYear()).slice(2)}`;
};

export const f0 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(0, 0).format(v);
export const f1 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(1, 1).format(v);
export const f2 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(2, 2).format(v);

/**
 * Three significant digits, however small the number is.
 *
 * A model explorer produces coefficients on wildly different scales — points of
 * recovery per hour of sleep is around 1, per kilocalorie is around 0,001 — and
 * a fixed two decimals prints the second one as «0,00», which reads as «no
 * effect» rather than «different unit».
 */
export const sig = (v: number | null | undefined, digits = 3) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const key = `${locale}:sig:${digits}`;
  let cached = numberCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, { maximumSignificantDigits: digits });
    numberCache.set(key, cached);
  }
  return cached.format(v);
};

/**
 * A p or q value, which needs a floor rather than rounding.
 *
 * `f2` turns 0,0004 into «0,00», and a reader is entitled to read that as zero.
 * No p-value in this project is zero — a bootstrap over 200 draws cannot go
 * below 1/201, and a t-distribution never reaches it either — so below a
 * thousandth the honest thing to print is the bound.
 */
export const pValue = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v < 0.001 ? `< ${sig(0.001, 1)}` : sig(v, 2);

/**
 * The same value with its relation attached, for running prose: `= 0,005` or
 * `< 0,001`, so a sentence can say «p < 0,001» rather than «p = < 0,001».
 */
export const pRelation = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '= —' : v < 0.001 ? `< ${sig(0.001, 1)}` : `= ${sig(v, 2)}`;

/** Thousands separators, no decimals: row counts on the import screen. */
export const count = (v: number) => nf(0, 0).format(v);

export const pct = (v: number | null | undefined) => (v == null ? '—' : `${f0(v)}%`);
export const bpm = (v: number | null | undefined) => (v == null ? '—' : `${f0(v)} bpm`);
export const ms = (v: number | null | undefined) => (v == null ? '—' : `${f0(v)} ms`);

/** Minutes -> `7h 42m`. */
export const hoursMinutes = (min: number | null | undefined) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const h = Math.floor(min / 60);
  return `${h}h ${pad(Math.round(min % 60))}m`;
};

/** Minutes past midnight (may exceed 1440) -> `23:15`. */
export const clockTime = (min: number | null | undefined) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;
};

export const signed = (v: number | null | undefined, fmt = f1, unit = '') =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}${unit}`;
