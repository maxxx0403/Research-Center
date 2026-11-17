import { ReportDateFilter } from '@/components/MonthFilter';
import { currentMonthManila } from '@/lib/monthRange';
import { STAKEHOLDER_GROUPS } from '@/lib/stakeholder';

/**
 * Date filter for the Reservations lists: "All dates" + a dropdown (Monthly / Weekly / Custom date).
 * value: "" = all dates, otherwise "YYYY-MM" or "YYYY-MM-DD_YYYY-MM-DD". Uses the same picker as Reports.
 * Admin + staff also pass stakeholder / onStakeholderChange to show the CvSU / Non-CvSU dropdown.
 */
const ReservationMonthFilter = ({ value, onChange, stakeholder, onStakeholderChange }) => (
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
      All dates
    </button>
    {onStakeholderChange && (
      <select
        aria-label="Stakeholder filter"
        value={stakeholder}
        onChange={(e) => onStakeholderChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:border-primary"
      >
        {STAKEHOLDER_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
    )}
    <div className={value ? '' : 'opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity'}>
      <ReportDateFilter value={value || currentMonthManila()} onChange={onChange} showThisMonth={false} />
    </div>
  </div>
);

export default ReservationMonthFilter;