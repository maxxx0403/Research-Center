import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonthManila, shiftMonth, MONTH_NAMES } from '@/lib/monthRange';

const selectCls =
  'px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:border-primary';
const arrowCls =
  'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground cursor-pointer hover:bg-muted';

/**
 * Month picker for monthly reports: [<] [Month v] [Year v] [>]  (+ "This month").
 * value / onChange use "YYYY-MM".
 * showThisMonth={false} hides the "This month" shortcut.
 */
const MonthFilter = ({ value, onChange, showThisMonth = true }) => {
  const [year, month] = value.split('-').map(Number);
  const thisMonth = currentMonthManila();
  const thisYear = Number(thisMonth.slice(0, 4));

  // Years from 4 years back to next year (always include the selected one)
  const first = Math.min(thisYear - 4, year);
  const last = Math.max(thisYear + 1, year);
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  const set = (y, m) => onChange(`${y}-${String(m).padStart(2, '0')}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
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