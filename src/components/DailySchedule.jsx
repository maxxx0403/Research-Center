import { Clock, Trash2, RotateCcw } from 'lucide-react';
import { TIME_OPTIONS, format12h } from '@/components/BookingDateTimeInput';
import PendingReservationDateNotice from '@/components/PendingReservationDateNotice';
import { eachDate, isNonOfficialDate, labelDate, MAX_BOOKING_DAYS } from '@/lib/dailySchedule';

// One row per booked date, each with its OWN start and end time.
// A date the researcher will not use can be removed (and added back).
// Props:
//   startDate / endDate  'YYYY-MM-DD' ('' = none)
//   dayTimes             { [date]: { start, end } }
//   skipped              { [date]: true }   (= removed dates)
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
        <Clock className="w-3.5 h-3.5" /> Choose a start date (and an end date if you need more than one day) to set the time for each date.
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
  const removed = dates.filter((d) => skipped[d] && !isUnavailable(d));
  const visible = dates.filter((d) => !skipped[d] || isUnavailable(d));

  const setTime = (d, field, value) => {
    const cur = dayTimes[d] || {};
    const next = { ...cur, [field]: value };
    // keep end after start
    if (field === 'start' && next.end && next.end <= value) next.end = '';
    onChange({ dayTimes: { ...dayTimes, [d]: next }, skipped });
  };

  const removeDate = (d) => {
    onChange({ dayTimes, skipped: { ...skipped, [d]: true } });
  };

  const restoreDate = (d) => {
    const next = { ...skipped };
    delete next[d];
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
          {multi ? `Set the time for each date (${bookable.length} ${bookable.length === 1 ? 'date' : 'dates'})` : 'Time'}
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
        {visible.map((d, i) => {
          const unavailable = isUnavailable(d);
          const t = dayTimes[d] || {};
          const endOptions = t.start ? TIME_OPTIONS.filter((x) => x > t.start) : TIME_OPTIONS;
          return (
            <div
              key={d}
              className={`rounded-xl border-2 px-3 py-2.5 ${unavailable ? 'border-border/60 bg-muted/40' : 'border-border bg-card'}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className={`min-w-[8.5rem] text-sm font-semibold ${unavailable ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {multi && !unavailable && (
                    <span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                      Day {bookable.indexOf(d) + 1}
                    </span>
                  )}
                  {labelDate(d)}
                </div>

                {unavailable ? (
                  <span className="text-xs text-amber-800 font-semibold">Not available — {unavailableNote}</span>
                ) : (
                  <>
                    <select
                      aria-label={`Start time on ${d}`}
                      value={t.start || ''}
                      required
                      onChange={(e) => setTime(d, 'start', e.target.value)}
                      className={`${selectClass} !bg-background !text-foreground min-w-0 flex-[1_1_8rem]`}
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
                      required
                      onChange={(e) => setTime(d, 'end', e.target.value)}
                      className={`${selectClass} !bg-background !text-foreground min-w-0 flex-[1_1_8rem]`}
                    >
                      <option value="">End time</option>
                      {endOptions.map((x) => (
                        <option key={x} value={x}>{format12h(x)}</option>
                      ))}
                    </select>
                    {multi && bookable.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDate(d)}
                        title={`Remove ${labelDate(d, { year: false })} from this reservation`}
                        aria-label={`Remove ${d}`}
                        className="inline-flex items-center gap-1 p-2 hover:bg-destructive/10 text-destructive rounded-xl transition-colors border border-destructive/20 cursor-pointer flex-shrink-0 text-xs font-semibold"
                      >
                        <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </>
                )}
              </div>
              {!unavailable && dates.length <= 7 && <PendingReservationDateNotice date={d} />}
            </div>
          );
        })}
      </div>

      {removed.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">Removed:</span>
          {removed.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => restoreDate(d)}
              title="Add this date back"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary cursor-pointer line-through hover:no-underline"
            >
              {labelDate(d, { year: false })} <RotateCcw className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailySchedule;