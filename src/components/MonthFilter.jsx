import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  currentMonthManila, shiftMonth, MONTH_NAMES,
  isDateRange, splitDateRange, makeDateRange, todayRangeManila,
} from '@/lib/monthRange';
import { todayManilaDate } from '@/lib/timezone';

const selectCls =
  'px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:border-primary';
const arrowCls =
  'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground cursor-pointer hover:bg-muted';
const dateCls =
  'px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:border-primary';
const tabCls = (active) =>
  `px-3 py-2 text-sm font-semibold cursor-pointer border-none transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
  }`;

/**
 * Date picker for reports and reservation lists. Two modes:
 *   - Month:       [<] [Month v] [Year v] [>]  (+ "This month")
 *   - Custom date: [From date] to [To date]    (+ "Today")  - one day or a range
 * value / onChange use "YYYY-MM" (month) or "YYYY-MM-DD_YYYY-MM-DD" (custom dates).
 * showThisMonth={false} hides the "This month" / "Today" shortcuts.
 */
const MonthFilter = ({ value, onChange, showThisMonth = true }) => {
  const custom = isDateRange(value);
  const thisMonth = currentMonthManila();

  const modeSwitch = (
    <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Filter type">
      <button type="button" aria-pressed={!custom} className={tabCls(!custom)} onClick={() => !custom || onChange(thisMonth)}>
        Month
      </button>
      <button type="button" aria-pressed={custom} className={tabCls(custom)} onClick={() => custom || onChange(todayRangeManila())}>
        Custom date
      </button>
    </div>
  );

  if (custom) {
    const { from, to } = splitDateRange(value);
    const today = todayManilaDate();
    const isToday = from === today && to === today;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {modeSwitch}
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => e.target.value && onChange(makeDateRange(e.target.value, to < e.target.value ? e.target.value : to))}
          className={dateCls}
        />
        <span className="text-sm text-muted-foreground">to</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from}
          onChange={(e) => e.target.value && onChange(makeDateRange(from, e.target.value))}
          className={dateCls}
        />
        {showThisMonth && !isToday && (
          <button
            type="button"
            onClick={() => onChange(todayRangeManila())}
            className="px-3 py-2 rounded-lg bg-transparent border-none text-sm font-semibold text-primary cursor-pointer hover:underline"
          >
            Today
          </button>
        )}
      </div>
    );
  }

  const [year, month] = value.split('-').map(Number);
  const thisYear = Number(thisMonth.slice(0, 4));

  // Years from 4 years back to next year (always include the selected one)
  const first = Math.min(thisYear - 4, year);
  const last = Math.max(thisYear + 1, year);
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  const set = (y, m) => onChange(`${y}-${String(m).padStart(2, '0')}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {modeSwitch}

      <button type="button" aria-label="Previous month" className={arrowCls} onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft className="w-4 h-4" />
      </button>

      <select aria-label="Month" value={month} onChange={(e) => set(year, Number(e.target.value))} className={selectCls}>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>

      <select aria-label="Year" value={year} onChange={(e) => set(Number(e.target.value), month)} className={selectCls}>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <button type="button" aria-label="Next month" className={arrowCls} onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight className="w-4 h-4" />
      </button>

      {showThisMonth && value !== thisMonth && (
        <button
          type="button"
          onClick={() => onChange(thisMonth)}
          className="px-3 py-2 rounded-lg bg-transparent border-none text-sm font-semibold text-primary cursor-pointer hover:underline"
        >
          This month
        </button>
      )}
    </div>
  );
};

export default MonthFilter;