import { useState } from 'react';
import { FlaskConical, Package } from 'lucide-react';
import LaboratoryReport from '@/components/LaboratoryReport';
import EquipmentReport from '@/components/EquipmentReport';
import MonthFilter from '@/components/MonthFilter';
import { currentMonthManila, monthLabel } from '@/lib/monthRange';

const Reports = () => {
  const [tab, setTab] = useState('lab');
  const [month, setMonth] = useState(currentMonthManila());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
      <div className="flex gap-1">
        {[
          { key: 'lab', label: 'Laboratories', icon: FlaskConical },
          { key: 'equipment', label: 'Equipment', icon: Package },
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
        <div className="pb-2"><MonthFilter value={month} onChange={setMonth} /></div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Showing only what was actually used (completed or in use) in <span className="font-semibold text-foreground">{monthLabel(month)}</span>. Exported files use the same month.
      </p>

      {tab === 'lab' && <LaboratoryReport month={month} />}
      {tab === 'equipment' && <EquipmentReport month={month} />}
    </div>
  );
};

export default Reports;