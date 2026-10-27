import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { todayManilaDate, earliestBookableDate, earliestBookableLabel, MIN_ADVANCE_DAYS } from '@/lib/timezone';

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

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ---- date helpers (all pure "YYYY-MM-DD" strings, no browser timezone involved) ----
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const isoToDisplay = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '';

const isoLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// Accepts "MM/DD/YYYY" or "YYYY-MM-DD"; returns "YYYY-MM-DD" or null if not a real date.
const parseTyped = (text) => {
  const t = String(text || '').trim();
  let y;
  let m;
  let d;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) {
    m = Number(us[1]);
    d = Number(us[2]);
    y = Number(us[3]);
  } else {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (!iso) return null;
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return toISO(y, m - 1, d);
};

// Auto-insert the slashes while typing digits: 11032026 -> 11/03/2026.
const formatTyping = (raw) => {
  if (raw.includes('-')) return raw.slice(0, 10); // pasted ISO date
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const useIsWide = () => {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
};

// Drop-in replacement for <input type="datetime-local">.
// Same value format ("YYYY-MM-DDTHH:mm").
//  - Date: can be TYPED (MM/DD/YYYY, slashes are added automatically) or picked
//    from a calendar. Dates before `min` are disabled and cannot be clicked, and
//    the 1-week advance-booking buffer is shown right on the calendar.
//  - Time: picked from 7:00 AM to 6:00 PM, every 30 minutes.
// `min` can be a date or a datetime string.
//
// Layout: date and time sit side by side when there is room and wrap onto two
// lines on narrow columns (phone / tablet). The calendar is a bottom sheet on
// phones and a popover from tablet width up.
const BookingDateTimeInput = ({ value, onChange, min, required, className = '' }) => {
  const initialDate = value ? value.slice(0, 10) : '';
  const [date, setDate] = useState(initialDate);
  const [text, setText] = useState(isoToDisplay(initialDate));
  const [time, setTime] = useState(value ? value.slice(11, 16) : '');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = initialDate || (min ? min.slice(0, 10) : todayManilaDate());
    return { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 };
  });
  const [pos, setPos] = useState(null);

  const wide = useIsWide();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const lastEmitted = useRef(value || '');

  const minDate = min ? min.slice(0, 10) : '';
  const today = todayManilaDate();
  // The 1-week advance-booking window: today .. (earliest bookable date - 1).
  const showBuffer = !!minDate && minDate === earliestBookableDate() && minDate > today;

  // Keep in sync when the parent changes/resets the value (but not for our own emits).
  useEffect(() => {
    if ((value || '') === lastEmitted.current) return;
    lastEmitted.current = value || '';
    const d = value ? value.slice(0, 10) : '';
    setDate(d);
    setText(isoToDisplay(d));
    setTime(value ? value.slice(11, 16) : '');
    setError('');
  }, [value]);

  const emit = (d, t) => {
    const out = d && t ? `${d}T${t}` : '';
    lastEmitted.current = out;
    onChange(out);
  };

  const checkMin = useCallback(
    (iso) => (minDate && iso < minDate ? `Earliest available date is ${isoLabel(minDate)}.` : ''),
    [minDate]
  );

  // Block native form submit while the typed date is incomplete / not allowed.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setCustomValidity(error || (text && !date ? 'Enter a valid date (MM/DD/YYYY).' : ''));
  }, [error, text, date]);

  const handleText = (e) => {
    const formatted = formatTyping(e.target.value);
    setText(formatted);
    const iso = parseTyped(formatted);
    if (!iso) {
      setError('');
      setDate('');
      emit('', time);
      return;
    }
    const err = checkMin(iso);
    setError(err);
    if (err) {
      setDate('');
      emit('', time);
    } else {
      setDate(iso);
      emit(iso, time);
      setView({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 });
    }
  };

  const handleBlur = () => {
    if (text && !parseTyped(text)) setError('Enter a valid date (MM/DD/YYYY).');
  };

  const pick = (iso) => {
    setDate(iso);
    setText(isoToDisplay(iso));
    setError('');
    emit(iso, time);
    setOpen(false);
  };

  const openCalendar = () => {
    const base = date || minDate || today;
    setView({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
    setOpen(true);
  };

  // Popover position (tablet / desktop). Phones use a bottom sheet instead.
  const updatePos = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const height = 420;
    let top = r.bottom + 6;
    if (top + height > window.innerHeight && r.top - height - 6 > 8) top = r.top - height - 6;
    setPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open || !wide) return undefined;
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, wide, updatePos]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    if (!wide) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, wide]);

  // ---- calendar grid ----
  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
  const prevMonthLast = new Date(Date.UTC(view.y, view.m, 0)).toISOString().slice(0, 10);
  const canGoPrev = !minDate || prevMonthLast >= minDate;
  const goMonth = (delta) => {
    const dt = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() });
  };

  const options = time && !TIME_OPTIONS.includes(time) ? [time, ...TIME_OPTIONS] : TIME_OPTIONS;

  const calendar = (
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        className="absolute inset-0 bg-black/40 md:bg-transparent"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Choose a date"
        style={wide && pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
        className={
          'absolute bg-card text-card-foreground border border-border shadow-2xl p-4 ' +
          (wide
            ? 'rounded-2xl'
            : 'inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]')
        }
      >
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-border text-primary touch-manipulation hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-heading font-bold text-primary text-base">{monthLabel}</div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-border text-primary touch-manipulation hover:bg-primary/10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] font-bold text-muted-foreground py-1">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const iso = toISO(view.y, view.m, day);
            const disabled = !!minDate && iso < minDate;
            const buffer = showBuffer && disabled && iso >= today;
            const selected = iso === date;
            const isToday = iso === today;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                aria-disabled={disabled}
                aria-label={isoLabel(iso) + (buffer ? ' (not available, advance booking buffer)' : '')}
                onClick={() => pick(iso)}
                className={
                  'h-10 sm:h-11 rounded-lg text-sm font-semibold touch-manipulation transition-colors ' +
                  (selected
                    ? 'bg-primary text-primary-foreground'
                    : disabled
                      ? buffer
                        ? 'bg-amber-100 text-amber-800/60 line-through cursor-not-allowed'
                        : 'text-muted-foreground/40 line-through cursor-not-allowed'
                      : 'text-foreground hover:bg-primary/15 border border-transparent hover:border-primary/40') +
                  (isToday && !selected ? ' ring-2 ring-primary/50' : '')
                }
              >
                {day}
              </button>
            );
          })}
        </div>

        {showBuffer && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Reservations need <span className="font-bold">{MIN_ADVANCE_DAYS} days (1 week)</span> advance notice. The
              highlighted dates are not available. Earliest date: <span className="font-bold">{earliestBookableLabel()}</span>.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 w-full md:hidden py-2.5 rounded-xl border-2 border-border text-sm font-semibold text-muted-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2">
      <div ref={wrapRef} className="relative min-w-0 max-w-full flex-[1_1_11.5rem]">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          maxLength={10}
          value={text}
          required={required}
          onChange={handleText}
          onBlur={handleBlur}
          aria-invalid={!!error}
          className={`${className} w-full min-w-0 !pr-12 ${error ? '!border-destructive' : ''}`}
        />
        <button
          type="button"
          onClick={openCalendar}
          aria-label="Open calendar"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 touch-manipulation"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>
        {error && <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>}
      </div>

      <select
        value={time}
        required={required}
        onChange={(e) => {
          setTime(e.target.value);
          emit(date, e.target.value);
        }}
        className={`${className} !bg-background !text-foreground min-w-0 max-w-full flex-[1_1_9rem] self-start`}
      >
        <option value="" className="bg-background text-foreground">Select time</option>
        {options.map((t) => (
          <option key={t} value={t} className="bg-background text-foreground">{format12h(t)}</option>
        ))}
      </select>

      {open && createPortal(calendar, document.body)}
    </div>
  );
};

export default BookingDateTimeInput;