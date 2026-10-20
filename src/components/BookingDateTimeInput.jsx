import { useEffect, useState } from 'react';

// Operating hours: 7:00 AM to 6:00 PM, every 30 minutes.
const OPEN_HOUR = 7;
const CLOSE_HOUR = 18;

const pad = (n) => String(n).padStart(2, '0');

const format12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
};

const TIME_OPTIONS = (() => {
  const list = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    list.push(`${pad(h)}:00`);
    if (h < CLOSE_HOUR) list.push(`${pad(h)}:30`);
  }
  return list;
})();

// Drop-in replacement for <input type="datetime-local">.
// Same value format ("YYYY-MM-DDTHH:mm"), but the time can only be picked
// from 7:00 AM to 6:00 PM. `min` can be a date or a datetime string.
//
// Layout: date and time sit side by side only when the container is wide enough
// for both (each needs ~10.5rem); otherwise they stack. This depends on the
// width of the container, not the screen, so it also works next to a sidebar,
// inside modals, and on tablets. `min-w-0` stops iOS Safari's date input from
// forcing the column wider than its container (which made fields overlap).
const BookingDateTimeInput = ({ value, onChange, min, required, className = '' }) => {
  const [date, setDate] = useState(value ? value.slice(0, 10) : '');
  const [time, setTime] = useState(value ? value.slice(11, 16) : '');

  // Keep in sync when the parent changes/resets the value.
  useEffect(() => {
    setDate(value ? value.slice(0, 10) : '');
    setTime(value ? value.slice(11, 16) : '');
  }, [value]);

  const emit = (d, t) => onChange(d && t ? `${d}T${t}` : '');

  // Show an already-saved time even if it is outside the usual slots.
  const options = time && !TIME_OPTIONS.includes(time) ? [time, ...TIME_OPTIONS] : TIME_OPTIONS;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-2 w-full min-w-0">
      <input
        type="date"
        value={date}
        min={min ? min.slice(0, 10) : undefined}
        required={required}
        onChange={(e) => {
          setDate(e.target.value);
          emit(e.target.value, time);
        }}
        style={{ minWidth: 0 }}
        className={`${className} block min-w-0 max-w-full [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em]`}
      />
      <select
        value={time}
        required={required}
        onChange={(e) => {
          setTime(e.target.value);
          emit(date, e.target.value);
        }}
        style={{ minWidth: 0 }}
        className={`${className} block min-w-0 max-w-full`}
      >
        <option value="">Select time</option>
        {options.map((t) => (
          <option key={t} value={t}>{format12h(t)}</option>
        ))}
      </select>
    </div>
  );
};

export default BookingDateTimeInput;