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
    <div className="grid grid-cols-2 gap-2">
      <input
        type="date"
        value={date}
        min={min ? min.slice(0, 10) : undefined}
        required={required}
        onChange={(e) => {
          setDate(e.target.value);
          emit(e.target.value, time);
        }}
        className={className}
      />
      <select
        value={time}
        required={required}
        onChange={(e) => {
          setTime(e.target.value);
          emit(date, e.target.value);
        }}
        className={className}
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