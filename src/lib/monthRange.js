// Helpers for monthly reports. A "month" is a string like "2026-10".
// Months are always cut at midnight Philippine time (Asia/Manila, UTC+8).
import { todayManilaDate, manilaInputToISO, APP_TIMEZONE } from '@/lib/timezone';

// "YYYY-MM" for the current month in Manila.
export const currentMonthManila = () => todayManilaDate().slice(0, 7);

const split = (ym) => ym.split('-').map(Number);
const pad = (n) => String(n).padStart(2, '0');

// Move a month forward/backward: shiftMonth('2026-01', -1) -> '2025-12'
export const shiftMonth = (ym, delta) => {
  const [y, m] = split(ym);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
};

// [start, end) of the month as ISO instants, for .gte(start) / .lt(end) queries.
export const monthRangeISO = (ym) => ({
  startISO: manilaInputToISO(`${ym}-01T00:00`),
  endISO: manilaInputToISO(`${shiftMonth(ym, 1)}-01T00:00`),
});

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

// "October 2026"
export const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00+08:00`).toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'long',
    year: 'numeric',
  });

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];