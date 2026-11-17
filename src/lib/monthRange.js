// Helpers for monthly reports. A "month" is a string like "2026-10".
// The same value can also be a custom date range: "2026-11-02_2026-11-05"
// (from_to, both inclusive). One day = the same date twice, e.g.
// "2026-11-02_2026-11-02". Every helper below understands both forms, so
// pages that filter by "month" automatically support custom dates too.
// Months are always cut at midnight Philippine time (Asia/Manila, UTC+8).
import { todayManilaDate, manilaInputToISO, APP_TIMEZONE } from '@/lib/timezone';

// "YYYY-MM" for the current month in Manila.
export const currentMonthManila = () => todayManilaDate().slice(0, 7);

const split = (ym) => ym.split('-').map(Number);
const pad = (n) => String(n).padStart(2, '0');

const RANGE_RE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;

// True when the value is a custom date range ("YYYY-MM-DD_YYYY-MM-DD").
export const isDateRange = (v) => RANGE_RE.test(v || '');

// Build / read a custom range value. from > to is swapped automatically.
export const makeDateRange = (from, to) => {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return `${a}_${b}`;
};
export const splitDateRange = (v) => {
  const m = RANGE_RE.exec(v || '');
  return m ? { from: m[1], to: m[2] } : null;
};

// Today (Manila) as a one-day range.
export const todayRangeManila = () => {
  const t = todayManilaDate();
  return `${t}_${t}`;
};

// 'YYYY-MM-DD' + n days (pure calendar math, no timezone involved).
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// Move a month forward/backward: shiftMonth('2026-01', -1) -> '2025-12'
export const shiftMonth = (ym, delta) => {
  const [y, m] = split(ym);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
};

// [start, end) of the month as ISO instants, for .gte(start) / .lt(end) queries.
export const monthRangeISO = (ym) => {
  const r = splitDateRange(ym);
  if (r) {
    return {
      startISO: manilaInputToISO(`${r.from}T00:00`),
      endISO: manilaInputToISO(`${addDays(r.to, 1)}T00:00`), // "to" day is included
    };
  }
  return {
    startISO: manilaInputToISO(`${ym}-01T00:00`),
    endISO: manilaInputToISO(`${shiftMonth(ym, 1)}-01T00:00`),
  };
};

// True if the date/ISO value falls inside the month (Manila time). An empty
// month means "all months", so everything matches.
export const isInMonth = (value, ym) => {
  if (!ym) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const { startISO, endISO } = monthRangeISO(ym);
  return t >= new Date(startISO).getTime() && t < new Date(endISO).getTime();
};

// "October 2026"  /  "Nov 2, 2026"  /  "Nov 2, 2026 – Nov 5, 2026"
const dayLabel = (ymd) =>
  new Date(`${ymd}T00:00:00+08:00`).toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const monthLabel = (ym) => {
  if (!ym) return 'All dates';
  const r = splitDateRange(ym);
  if (r) return r.from === r.to ? dayLabel(r.from) : `${dayLabel(r.from)} – ${dayLabel(r.to)}`;
  return new Date(`${ym}-01T00:00:00+08:00`).toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'long',
    year: 'numeric',
  });
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---- Weekly reports: a week is Monday-Sunday, stored as a custom range ("YYYY-MM-DD_YYYY-MM-DD").
// Monday-Sunday range of the week that contains the given date.
export const weekRangeOf = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const monday = addDays(ymd, -((dow + 6) % 7));
  return makeDateRange(monday, addDays(monday, 6));
};

// This week (Manila time).
export const thisWeekRangeManila = () => weekRangeOf(todayManilaDate());

// Move a week range forward/backward: shiftWeek('2026-11-09_2026-11-15', 1) -> '2026-11-16_2026-11-22'
export const shiftWeek = (range, delta) => {
  const r = splitDateRange(range);
  return makeDateRange(addDays(r.from, delta * 7), addDays(r.to, delta * 7));
};

// Short Manila date for an ISO instant: "Nov 17, 2026". Empty value -> "—".
export const shortDateManila = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, month: 'short', day: 'numeric', year: 'numeric' })
    : '—';