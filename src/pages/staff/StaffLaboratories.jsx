import { useState, useEffect } from 'react';
import { Search, Minus, Plus, UserPlus, RefreshCw } from 'lucide-react';
import RowActions from '@/components/RowActions';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const StaffLaboratories = () => {
  const { assignedRoomIds } = useAuth();
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLabs = async () => {
    let query = supabase.from('laboratories').select('*').order('lab_code');
    if (assignedRoomIds.length) query = query.in('id', assignedRoomIds);
    const { data } = await query;
    setLabs(data || []);
    setLoading(false);
  };

  useEffect(() => { loadLabs(); }, [assignedRoomIds]);

  const updateStatus = async (lab, newStatus) => {
    const { error } = await supabase.from('laboratories').update({ status: newStatus }).eq('id', lab.id);
    if (error) { toast.error('Failed to update status: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, status: newStatus } : l));
    toast.success(`${lab.lab_name} marked as ${newStatus}.`);
  };

  // Manually adjust how many people are currently inside a lab. The room's
  // status follows this count: it stays "available" while there's still room,
  // and becomes "occupied" only once it's full (current === max capacity).
  // A room under maintenance keeps that status regardless of occupancy.
  const adjustOccupancy = async (lab, delta) => {
    const current = lab.current_occupancy ?? 0;
    const max = lab.max_capacity || 0;
    const next = Math.max(0, max > 0 ? Math.min(max, current + delta) : current + delta);
    if (next === current) return;

    const updates = { current_occupancy: next };
    if (lab.status !== 'maintenance') {
      updates.status = max > 0 && next >= max ? 'occupied' : 'available';
    }

    const { error } = await supabase.from('laboratories').update(updates).eq('id', lab.id);
    if (error) { toast.error('Failed to update occupancy: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, ...updates } : l));
  };

  const filtered = labs.filter((l) =>
  !search ||
  l.lab_name.toLowerCase().includes(search.toLowerCase()) ||
  l.lab_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lab name or code…"
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} laborator{filtered.length === 1 ? 'y' : 'ies'}</p>
      </div>

      {loading ?
      <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div> :
      filtered.length === 0 ?
      <div className="text-center py-16 text-muted-foreground text-sm bg-card rounded-xl shadow-card">No laboratories found for your assigned rooms.</div> :

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-5">
          {filtered.map((lab) => {
          const pct = (lab.max_capacity ?? 0) > 0 ? Math.round((lab.current_occupancy ?? 0) / (lab.max_capacity ?? 1) * 100) : 0;
          const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
          return (
            <div key={lab.id} className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex justify-between items-start gap-2">
                <div>
                  <h2 className="font-heading text-sm font-bold">{lab.lab_name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[0.7rem] bg-muted px-1.5 py-0.5 rounded text-primary">{lab.lab_code}</code>
                    {lab.floor && <span className="text-[0.7rem] text-muted-foreground">· {lab.floor}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lab.status} />
                  <RowActions
                    items={[
                      {
                        label: 'Change status',
                        icon: RefreshCw,
                        value: lab.status,
                        options: [
                          { value: 'available', label: 'Available' },
                          { value: 'maintenance', label: 'Under Maintenance' },
                        ],
                        onChange: (st) => updateStatus(lab, st),
                      },
                    ]}
                  />
                </div>
              </div>
              <div className="p-5 space-y-4">
                {lab.description && <p className="text-xs text-muted-foreground leading-relaxed">{lab.description}</p>}
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                    <span className="inline-flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Occupancy</span>
                    <span>{lab.current_occupancy ?? 0} / {lab.max_capacity ?? 0} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2"><div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustOccupancy(lab, -1)}
                      disabled={(lab.current_occupancy ?? 0) <= 0}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer transition-colors"
                      title="Remove one person"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-muted-foreground w-28 text-center">people inside</span>
                    <button
                      type="button"
                      onClick={() => adjustOccupancy(lab, 1)}
                      disabled={lab.max_capacity ? (lab.current_occupancy ?? 0) >= lab.max_capacity : false}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer transition-colors"
                      title="Add one person"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {lab.equipment_list && (
                  <div className="text-xs text-muted-foreground"><strong className="text-foreground">Equipment:</strong> {lab.equipment_list}</div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      }
    </div>);

};

export default StaffLaboratories;