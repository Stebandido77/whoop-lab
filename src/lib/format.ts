const LOCALE = 'es-CO';

export const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
export const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const pad = (n: number) => String(n).padStart(2, '0');

/** `Date` -> `YYYY-MM-DD` in local time (never use toISOString: it shifts to UTC). */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromDayKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDayShort = (k: string) => {
  const d = fromDayKey(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const fmtDayLong = (k: string) => {
  const d = fromDayKey(k);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

const nf = (min: number, max: number) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });

export const f0 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(0, 0).format(v);
export const f1 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(1, 1).format(v);
export const f2 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : nf(2, 2).format(v);

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
