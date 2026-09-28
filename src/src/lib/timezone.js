// Single source of truth for time in this system: Philippine Time (Asia/Manila, UTC+8).
// The Philippines has no daylight saving time, so a fixed +08:00 offset is safe.
export const APP_TIMEZONE = 'Asia/Manila';
const PH_OFFSET = '+08:00';

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Value from a <input type="datetime-local"> ("2026-09-28T09:00") is a wall-clock
// time with no timezone. Treat it as Manila time and return a real ISO instant.
export const manilaInputToISO = (value) => {
  if (!value) return value;
  if (NAIVE_RE.test(value)) {
    const withSeconds = value.length === 16 ? `${value}:00` : value;
    return new Date(`${withSeconds}${PH_OFFSET}`).toISOString();
  }
  return new Date(value).toISOString();
};

// Manila wall-clock parts for any Date / ISO string.
export const getManilaParts = (dateLike = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(dateLike));
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
};

// "YYYY-MM-DDTHH:mm" in Manila time. Use for datetime-local `min` / `value`.
export const toManilaInputValue = (dateLike = new Date()) => {
  const p = getManilaParts(dateLike);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

export const nowManilaInput = () => toManilaInputValue(new Date());

// "YYYY-MM-DD" for today in Manila.
export const todayManilaDate = () => toManilaInputValue(new Date()).slice(0, 10);

// Parse the naive datetime-local string without involving the browser timezone.
const parseNaive = (value) => {
  const m = NAIVE_RE.exec(value || '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return { y, mo, d, h, mi, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
};

export const isSundayInput = (value) => parseNaive(value)?.dow === 0;

export const isOutsideHoursInput = (value) => {
  const p = parseNaive(value);
  if (!p) return false;
  return p.h < 7 || p.h > 18 || (p.h === 18 && p.mi > 0);
};

// Is this datetime-local value already in the past (Manila time)?
export const isPastInput = (value) => {
  if (!value) return false;
  return new Date(manilaInputToISO(value)).getTime() < Date.now();
};

// Reservations must be made at least this many days before the reserved date.
export const MIN_ADVANCE_DAYS = 7;

// Earliest date (YYYY-MM-DD, Manila) that can be reserved: today + 7 days.
export const earliestBookableDate = () => {
  const [y, m, d] = todayManilaDate().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + MIN_ADVANCE_DAYS)).toISOString().slice(0, 10);
};

// Same as above, as a datetime-local value (use for `min`).
export const earliestBookableInput = () => `${earliestBookableDate()}T00:00`;

// True if the chosen datetime-local value is earlier than the earliest bookable date.
export const isTooSoonInput = (value) => !!value && value < earliestBookableInput();

// Human-readable earliest bookable date, e.g. "October 5, 2026".
export const earliestBookableLabel = () =>
  new Date(`${earliestBookableDate()}T00:00:00${PH_OFFSET}`).toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
