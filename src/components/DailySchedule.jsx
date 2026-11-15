import { Clock } from 'lucide-react';
import { TIME_OPTIONS, format12h } from '@/components/BookingDateTimeInput';
import PendingReservationDateNotice from '@/components/PendingReservationDateNotice';
import { eachDate, isNonOfficialDate, labelDate, MAX_BOOKING_DAYS } from '@/lib/dailySchedule';

// One row per booked date, each with its OWN start and end time.
// Props:
//   startDate / endDate  'YYYY-MM-DD' ('' = none)
//   dayTimes             { [date]: { start, end } }
//   skipped              { [date]: true }
//   allowNonOfficial     false -> Friday-Sunday rows are shown as "not available" and are not booked
//   unavailableNote      text explaining why Friday-Sunday is not available
//   onChange({ dayTimes, skipped })
const DailySchedule = ({
  startDate,
  endDate,
  dayTimes = {},
  skipped = {},
  allowNonOfficial = false,
  unavailableNote = 'Friday to Sunday are non-official hours and are not accepting reservations.',
  onChange,
  selectClass = '',
}) => {
  const dates = eachDate(startDate, endDate);

  if (!startDate) {
    return (
      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Choose a start date to set the start and end time for each date.
      </p>
    );
  }

  if (dates.length > MAX_BOOKING_DAYS) {
    return (
      <p className="mt-3 text-xs font-semibold text-destructive">
        You can book at most {MAX_BOOKING_DAYS} dates in one reservation. Please shorten the date range.
      </p>
    );
  }

  const multi = dates.length > 1;
  const isUnavailable = (d) => !allowNonOfficial && isNonOfficialDate(d);
  const bookable = dates.filter((d) => !isUnavailable(d) && !skipped[d]);

  const setTime = (d, field, value) => {
    const cur = dayTimes[d] || {};
    const next = { ...cur, [field]: value };
    // keep end after start
    if (field === 'start' && next.end && next.end <= value) next.end = '';
    onChange({ dayTimes: { ...dayTimes, [d]: next }, skipped });
  };

  const toggleSkip = (d) => {
    const next = { ...skipped };
    if (next[d]) delete next[d];
    else next[d] = true;
    onChange({ dayTimes, skipped: next });
  };

  const copyFirstToAll = () => {
    const first = bookable[0];
    const src = first && dayTimes[first];
    if (!src || !src.start || !src.end) return;
    const next = { ...dayTimes };
    bookable.forEach((d) => { next[d] = { start: src.start, end: src.end }; });
    onChange({ dayTimes: next, skipped });
  };

  const firstFilled = bookable[0] && dayTimes[bookable[0]]?.start && dayTimes[bookable[0]]?.end;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          {multi ? `Time for each date (${bookable.length} of ${dates.length} dates)` : 'Time'}
          <span className="text-destructive">*</span>
        </p>
        {multi && bookable.length > 1 && (
          <button
            type="button"
            onClick={copyFirstToAll}
            disabled={!firstFilled}
            className="text-xs font-semibold text-primary border border-primary/30 bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Use first day&apos;s time for all dates
          </button>
        )}
      </div>

      <div className="space-y-2">
        {dates.map((d) => {
          const unavailable = isUnavailable(d);
          const skip = !!skipped[d];
          const t = dayTimes[d] || {};
          const endOptions = t.start ? TIME_OPTIONS.filter((x) => x > t.start) : TIME_OPTIONS;
          const disabled = unavailable || skip;
          return (
            <div
              key={d}
              className={`rounded-xl border-2 px-3 py-2.5 ${disabled ? 'border-border/60 bg-muted/40' : 'border-border bg-card'}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className={`min-w-[8.5rem] text-sm font-semibold ${disabled ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {labelDate(d)}
                </div>

                {unavailable ? (
                  <span className="text-xs text-amber-800 font-semibold">Not available — {unavailableNote}</span>
                ) : (
                  <>
                    <select
                      aria-label={`Start time on ${d}`}
                      value={t.start || ''}
                      disabled={disabled}
                      required={!disabled}
                      onChange={(e) => setTime(d, 'start', e.target.value)}
                      className={`${selectClass} !bg-background !text-foreground min-w-0 flex-[1_1_8rem] disabled:opacity-50`}
                    >
                      <option value="">Start time</option>
                      {TIME_OPTIONS.slice(0, -1).map((x) => (
                        <option key={x} value={x}>{format12h(x)}</option>
                      ))}
                    </select>
                    <span className="text-muted-foreground text-sm">to</span>
                    <select
                      aria-label={`End time on ${d}`}
                      value={t.end || ''}
                      disabled={disabled}
                      required={!disabled}
                      onChange={(e) => setTime(d, 'end', e.target.value)}
                      className={`${selectClass} !bg-background !text-foreground min-w-0 flex-[1_1_8rem] disabled:opacity-50`}
                    >
                      <option value="">End time</option>
                      {endOptions.map((x) => (
                        <option key={x} value={x}>{format12h(x)}</option>
                      ))}
                    </select>
                    {multi && (
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                        <input type="checkbox" checked={skip} onChange={() => toggleSkip(d)} className="w-4 h-4 accent-[color:var(--primary)]" />
                        Skip this date
                      </label>
                    )}
                  </>
                )}
              </div>
              {!disabled && dates.length <= 7 && <PendingReservationDateNotice date={d} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailySchedule;