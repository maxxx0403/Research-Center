import MonthFilter from '@/components/MonthFilter';
import { currentMonthManila } from '@/lib/monthRange';

/**
 * Month filter for the Reservations lists (admin + staff).
 * value: "" = all months, otherwise "YYYY-MM". Uses the same picker as Reports.
 */
const ReservationMonthFilter = ({ value, onChange }) => (
  <div className="flex flex-wrap items-center gap-2 pb-2">
    <button
      type="button"
      aria-pressed={!value}
      onClick={() => onChange('')}
      className={`px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${
        !value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border hover:bg-muted'
      }`}
    >
      All months
    </button>
    <div className={value ? '' : 'opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity'}>
      <MonthFilter value={value || currentMonthManila()} onChange={onChange} showThisMonth={false} />
    </div>
  </div>
);

export default ReservationMonthFilter;