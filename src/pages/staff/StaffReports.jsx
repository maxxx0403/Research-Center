import { useState } from 'react';
import { FlaskConical, Package, Activity, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LaboratoryReport, { FacilitiesReport } from '@/components/LaboratoryReport';
import EquipmentReport, { EquipmentIssuesReport } from '@/components/EquipmentReport';
import { ReportDateFilter } from '@/components/MonthFilter';
import { STAKEHOLDER_GROUPS, stakeholderGroupLabel } from '@/lib/stakeholder';
import { currentMonthManila, monthLabel } from '@/lib/monthRange';

const StaffReports = () => {
  const { assignedRoomIds } = useAuth();
  const [tab, setTab] = useState('lab');
  const [month, setMonth] = useState(''); // '' = all dates (default)
  const [stakeholder, setStakeholder] = useState('all'); // 'all' | 'cvsu' | 'non_cvsu'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
      <div className="flex gap-1">
        {[
          { key: 'lab', label: 'Laboratories', icon: FlaskConical },
          { key: 'equipment', label: 'Equipment', icon: Package },
          { key: 'monitoring', label: 'Monitoring', icon: Activity },
          { key: 'issues', label: 'Lost & Damaged', icon: AlertTriangle },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-transparent border-t-0 border-x-0 border-b-2 -mb-px cursor-pointer transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
        <div className="pb-2 flex flex-wrap items-center gap-2 ml-auto justify-end">
          <select
            aria-label="Stakeholder filter"
            value={stakeholder}
            onChange={(e) => setStakeholder(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:border-primary"
          >
            {STAKEHOLDER_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <button
            type="button"
            aria-pressed={!month}
            onClick={() => setMonth('')}
            className={`px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${
              !month
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            All dates
          </button>
          <div className={month ? '' : 'opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity'}>
            <ReportDateFilter value={month || currentMonthManila()} onChange={setMonth} />
          </div>
        </div>
      </div>

      {tab === 'monitoring' ? (
      <p className="text-xs text-muted-foreground -mt-2">
        Live status of your assigned laboratories right now. The date filter does not apply here.
      </p>
      ) : tab === 'issues' ? (
      <p className="text-xs text-muted-foreground -mt-2">
        Lost or damaged equipment is shown as it is now. The date filter ({month ? <span className="font-semibold text-foreground">{monthLabel(month)}</span> : <span className="font-semibold text-foreground">all dates</span>}) applies to equipment returned damaged or incomplete and to stock alerts.
      </p>
      ) : (
      <p className="text-xs text-muted-foreground -mt-2">
        Showing only what was actually used (completed or in use) {month ? <>in <span className="font-semibold text-foreground">{monthLabel(month)}</span></> : <>across <span className="font-semibold text-foreground">all dates</span>, most recent first</>}. Exported files use the same dates{stakeholder !== 'all' && <> and show only <span className="font-semibold text-foreground">{stakeholderGroupLabel(stakeholder)}</span> stakeholders</>}.
      </p>
      )}

      {tab === 'lab' && <LaboratoryReport roomIds={assignedRoomIds} month={month} stakeholder={stakeholder} />}
      {tab === 'equipment' && <EquipmentReport roomIds={assignedRoomIds} month={month} stakeholder={stakeholder} />}
      {tab === 'monitoring' && (
        <FacilitiesReport roomIds={assignedRoomIds} />
      )}
      {tab === 'issues' && <EquipmentIssuesReport roomIds={assignedRoomIds} month={month} />}
    </div>
  );
};

export default StaffReports;