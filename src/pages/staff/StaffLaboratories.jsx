import { useState, useEffect } from 'react';
import { Search, MapPin } from 'lucide-react';
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

  const filtered = labs.filter((l) =>
  !search ||
  l.lab_name.toLowerCase().includes(search.toLowerCase()) ||
  l.lab_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Laboratories</h2>
          <p className="text-xs text-muted-foreground">{assignedRoomIds.length ? `${assignedRoomIds.length} assigned room${assignedRoomIds.length > 1 ? 's' : ''}` : 'all rooms'} — you can update availability for your assigned rooms</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search labs..." className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
        </div>
      </div>

      {loading ?
      <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div> :
      filtered.length === 0 ?
      <div className="text-center py-16 text-muted-foreground text-sm bg-card rounded-xl shadow-card">No laboratories found for your assigned rooms.</div> :

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lab) =>
        <div key={lab.id} className="bg-card rounded-xl shadow-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading text-sm font-bold">{lab.lab_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[0.7rem] bg-muted px-1.5 py-0.5 rounded text-primary">{lab.lab_code}</code>
                    {lab.floor && <span className="text-[0.7rem] text-muted-foreground inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {lab.floor}</span>}
                  </div>
                </div>
                <StatusBadge status={lab.status} />
              </div>
              {lab.description && <p className="text-xs text-muted-foreground">{lab.description}</p>}
              {lab.max_capacity && <p className="text-xs text-muted-foreground">Capacity: <span className="font-semibold text-foreground">{lab.max_capacity}</span></p>}

              <div className="flex gap-2 pt-2 border-t border-border">
                {['available', 'maintenance'].map((s) =>
            <button
              key={s}
              onClick={() => updateStatus(lab, s)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${lab.status === s ? 'bg-primary/20 text-primary cursor-default' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}>

                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
            )}
              </div>
            </div>
        )}
        </div>
      }
    </div>);

};

export default StaffLaboratories;