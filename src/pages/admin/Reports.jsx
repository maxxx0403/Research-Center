import { useState } from 'react';
import { FlaskConical, Package } from 'lucide-react';
import LaboratoryReport from '@/components/LaboratoryReport';
import EquipmentReport from '@/components/EquipmentReport';

const Reports = () => {
  const [tab, setTab] = useState('lab');

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border">
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

      {tab === 'lab' && <LaboratoryReport />}
      {tab === 'equipment' && <EquipmentReport />}
    </div>
  );
};

export default Reports;