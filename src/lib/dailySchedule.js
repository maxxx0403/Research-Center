import { validateBookingDateTime } from '@/lib/timezone';

// Helpers for "one start/end time per booked date".
// A schedule is: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' | '', dayTimes: { [date]: { start: 'HH:mm', end: 'HH:mm' } }, skipped: { [date]: true } }
// Every booked date becomes its own slot (and its own reservation row).

export const MAX_BOOKING_DAYS = 31;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Friday (5), Saturday (6) and Sunday (0) are "non-official" days.
const NON_OFFICIAL_DAYS = [0, 5, 6];

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const emptySchedule = () => ({ startDate: '', endDate: '', dayTimes: {}, skipped: {} });

export const isNonOfficialDate = (iso) => NON_OFFICIAL_DAYS.includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

// Every calendar date from startDate to endDate (inclusive). No end date = just the start date.
// Returns at most MAX_BOOKING_DAYS + 1 dates, so callers can tell when the range is too long.
export const eachDate = (startDate, endDate) => {
  if (!DATE_RE.test(startDate || '')) return [];
  const end = DATE_RE.test(endDate || '') && endDate >= startDate ? endDate : startDate;
  const out = [];
  let cur = startDate;
  while (cur <= end && out.length <= MAX_BOOKING_DAYS) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
};

export const isRangeTooLong = (schedule) => eachDate(schedule.startDate, schedule.endDate).length > MAX_BOOKING_DAYS;

export const labelDate = (iso, { year = true } = {}) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year ? { year: 'numeric' } : {}),
  });

const time12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// The dates that will really be booked: skipped days and (when not allowed) Fri-Sun are left out.
export const buildSlots = (schedule, { allowNonOfficial = false } = {}) => {
  const { startDate, endDate, dayTimes = {}, skipped = {} } = schedule || {};
  return eachDate(startDate, endDate)
    .filter((date) => !skipped[date] && (allowNonOfficial || !isNonOfficialDate(date)))
    .map((date) => {
      const t = dayTimes[date] || {};
      return {
        date,
        start: t.start || '',
        end: t.end || '',
        startDatetime: t.start ? `${date}T${t.start}` : '',
        endDatetime: t.end ? `${date}T${t.end}` : '',
      };
    });
};

// Returns an error message, or null when every slot is valid.
export const validateSlots = (slots, { subject } = {}) => {
  if (!slots.length) return 'Please choose at least one available date to reserve.';
  for (const s of slots) {
    if (!s.start || !s.end) return `${labelDate(s.date)}: please select both a start time and an end time.`;
    const err = validateBookingDateTime(s.startDatetime, s.endDatetime, { allowNonOfficial: true, subject });
    if (err) return `${labelDate(s.date)}: ${err}`;
  }
  return null;
};

// Short human description, e.g. "Dec 1, 8:00 AM – 5:00 PM" or "3 dates (Dec 1 – Dec 5)".
export const describeSlots = (slots) => {
  if (!slots.length) return '';
  const short = (iso) => labelDate(iso, { year: false }).replace(/^\w+, /, '');
  if (slots.length === 1) {
    const s = slots[0];
    return s.start && s.end ? `${short(s.date)}, ${time12(s.start)} – ${time12(s.end)}` : short(s.date);
  }
  return `${slots.length} dates (${short(slots[0].date)} – ${short(slots[slots.length - 1].date)})`;
};