import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';













const UserEquipment = () => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState(0);
  const [labs, setLabs] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: eqData }, { data: labData }] = await Promise.all([
      supabase.from('equipment').select('*, laboratories(lab_name, lab_code)').order('name'),
      supabase.from('laboratories').select('id, lab_name, lab_code').order('lab_code')]
      );
      setEquipment(eqData || []);
      setLabs(labData || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = equipment.filter((e) => {
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.brand.toLowerCase().includes(search.toLowerCase());
    const matchesLab = !selectedLab || e.laboratory_id === selectedLab;
    return matchesSearch && matchesLab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Equipment Inventory</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} equipment items</p>
        </div>
        <Link to="/user/reserve-equipment" className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm no-underline hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2">
          <Package className="w-4 h-4" /> Reserve Equipment
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment…" className="w-full pl-10 pr-4 py-2.5 border-2 border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
        </div>
        <select value={selectedLab} onChange={(e) => setSelectedLab(Number(e.target.value))} className="px-4 py-2.5 border-2 border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:border-primary">
          <option value={0}>All Laboratories</option>
          {labs.map((l) => <option key={l.id} value={l.id}>{l.lab_code} - {l.lab_name}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b-2 border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand / Model</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ?
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</td></tr> :
              filtered.length ? filtered.map((e) =>
              <tr key={e.id} className="border-b border-muted hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{e.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.brand && <span>{e.brand}</span>}
                    {e.model && <span className="text-xs ml-1 text-muted-foreground/70">({e.model})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.laboratories?.lab_code}</code>
                    <div className="text-xs text-muted-foreground mt-0.5">{e.laboratories?.lab_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    {e.status === 'maintenance' ? (
                      <span className="text-xs text-muted-foreground italic">Under Maintenance</span>
                    ) : (
                      <Link to={`/user/reserve-equipment?equipment_id=${e.id}`} className="text-primary text-xs font-semibold hover:underline no-underline">
                        Reserve →
                      </Link>
                    )}
                  </td>
                </tr>
              ) :
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No equipment found</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>);

};

export default UserEquipment;