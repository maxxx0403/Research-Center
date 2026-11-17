import { STAKEHOLDER_GROUPS } from '@/lib/stakeholder';

const tabCls = (active) =>
  `px-3 py-2 text-sm font-semibold cursor-pointer border-none transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
  }`;

/**
 * Segmented filter for the reports: All stakeholders / CvSU / Non-CvSU.
 * value / onChange use 'all' | 'cvsu' | 'non_cvsu'.
 */
const StakeholderFilter = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Stakeholder filter">
    {STAKEHOLDER_GROUPS.map((g) => (
      <button key={g.value} type="button" aria-pressed={value === g.value} className={tabCls(value === g.value)} onClick={() => onChange(g.value)}>
        {g.label}
      </button>
    ))}
  </div>
);

export default StakeholderFilter;