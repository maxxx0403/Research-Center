import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  currentMonthManila, shiftMonth, MONTH_NAMES,
  isDateRange, splitDateRange, makeDateRange, todayRangeManila,
  weekRangeOf, thisWeekRangeManila, shiftWeek, monthLabel,
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

const linkCls =
  'px-3 py-2 rounded-lg bg-transparent border-none text-sm font-semibold text-primary cursor-pointer hover:underline';

const REPORT_DATE_MODES = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' },
  { value: 'custom', label: 'Custom date' },
];

/**
 * Date filter for the reports. A dropdown picks the mode (Monthly / Weekly / Custom date)
 * and the controls next to it change with the mode.
 * value / onChange use "YYYY-MM" (monthly) or "YYYY-MM-DD_YYYY-MM-DD" (weekly = Mon-Sun, or custom).
 */
export const ReportDateFilter = ({ value, onChange, showThisMonth = true }) => {
  const [mode, setMode] = useState(isDateRange(value) ? 'custom' : 'month');
  // What is really shown follows the value (e.g. a plain "YYYY-MM" is always monthly).
  const shown = !isDateRange(value) ? 'month' : mode === 'week' ? 'week' : 'custom';
  const thisMonth = currentMonthManila();
  const today = todayManilaDate();

  const changeMode = (next) => {
    if (next === shown) return;
    const range = splitDateRange(value);
    setMode(next);
    // keep the user near the date they were looking at
    if (next === 'month') onChange(range ? range.from.slice(0, 7) : value);
    if (next === 'week') onChange(weekRangeOf(range ? range.from : today));
    if (next === 'custom') onChange(range ? value : todayRangeManila());
  };

  const modeSelect = (
    <select aria-label="Date filter type" value={shown} onChange={(e) => changeMode(e.target.value)} className={selectCls}>
      {REPORT_DATE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
    </select>
  );

  if (shown === 'week') {
    const { from } = splitDateRange(value);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {modeSelect}
        <button type="button" aria-label="Previous week" className={arrowCls} onClick={() => onChange(shiftWeek(value, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="date"
          aria-label="Pick any day in the week"
          value={from}
          onChange={(e) => e.target.value && onChange(weekRangeOf(e.target.value))}
          className={dateCls}
        />
        <button type="button" aria-label="Next week" className={arrowCls} onClick={() => onChange(shiftWeek(value, 1))}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel(value)}</span>
        {showThisMonth && value !== thisWeekRangeManila() && (
          <button type="button" onClick={() => onChange(thisWeekRangeManila())} className={linkCls}>This week</button>
        )}
      </div>
    );
  }

  if (shown === 'custom') {
    const { from, to } = splitDateRange(value);
    const isToday = from === today && to === today;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {modeSelect}
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
        {showThisMonth && !isToday && <button type="button" onClick={() => onChange(todayRangeManila())} className={linkCls}>Today</button>}
      </div>
    );
  }

  // Monthly
  const monthValue = isDateRange(value) ? thisMonth : value;
  const [year, month] = monthValue.split('-').map(Number);
  const thisYear = Number(thisMonth.slice(0, 4));
  const first = Math.min(thisYear - 4, year);
  const last = Math.max(thisYear + 1, year);
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const set = (y, m) => onChange(`${y}-${String(m).padStart(2, '0')}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {modeSelect}
      <button type="button" aria-label="Previous month" className={arrowCls} onClick={() => onChange(shiftMonth(monthValue, -1))}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select aria-label="Month" value={month} onChange={(e) => set(year, Number(e.target.value))} className={selectCls}>
        {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select aria-label="Year" value={year} onChange={(e) => set(Number(e.target.value), month)} className={selectCls}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button type="button" aria-label="Next month" className={arrowCls} onClick={() => onChange(shiftMonth(monthValue, 1))}>
        <ChevronRight className="w-4 h-4" />
      </button>
      {showThisMonth && monthValue !== thisMonth && <button type="button" onClick={() => onChange(thisMonth)} className={linkCls}>This month</button>}
    </div>
  );
};

export default MonthFilter;