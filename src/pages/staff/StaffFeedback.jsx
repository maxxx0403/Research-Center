import { useState, useEffect, useMemo } from 'react';
import { Star, EyeOff, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Stars = ({ n }) =>
<div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? 'fill-warning text-warning' : 'text-border'}`} />)}</div>;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const StaffFeedback = () => {
  const { assignedRoomIds } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [labFilter, setLabFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Stable key so the effect doesn't re-run on every render.
  const roomKey = (assignedRoomIds || []).join(',');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const ids = (assignedRoomIds || []).map(Number);
      const scoped = ids.length > 0; // no assigned rooms yet -> unrestricted (same as other staff pages)

      let fbQuery = supabase
        .from('feedbacks')
        .select('*, laboratories(lab_name, lab_code)')
        .order('submitted_at', { ascending: false });
      let labQuery = supabase.from('laboratories').select('id, lab_name, lab_code').order('lab_code');
      let eqQuery = supabase.from('equipment').select('id, name, laboratory_id').order('name');

      if (scoped) {
        fbQuery = fbQuery.in('laboratory_id', ids);
        labQuery = labQuery.in('id', ids);
        eqQuery = eqQuery.in('laboratory_id', ids);
      }

      const [fb, lb, eq] = await Promise.all([fbQuery, labQuery, eqQuery]);
      setFeedbacks(fb.data || []);
      setLabs(lb.data || []);
      setEquipment(eq.data || []);
      setLabFilter('');
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  const equipmentByLab = useMemo(() => {
    const map = {};
    equipment.forEach((e) => {
      const key = String(e.laboratory_id);
      (map[key] = map[key] || []).push(e.name);
    });
    return map;
  }, [equipment]);

  const shown = labFilter ? feedbacks.filter((f) => String(f.laboratory_id) === labFilter) : feedbacks;
  const avg = shown.length > 0 ? (shown.reduce((a, f) => a + f.rating, 0) / shown.length).toFixed(1) : 0;
  const selectedLab = labs.find((l) => String(l.id) === labFilter);

  const EquipmentChips = ({ labId }) => {
    const list = equipmentByLab[String(labId)] || [];
    if (list.length === 0) return null;
    return (
      <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground mt-0.5">
        <Package className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[220px]" title={list.join(', ')}>{list.join(', ')}</span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {[
        { label: 'Total Feedback', value: shown.length, color: 'bg-primary/10 text-primary' },
        { label: 'Avg Rating', value: avg, color: 'bg-warning/10 text-warning' },
        { label: 'Excellent (5★)', value: shown.filter((f) => f.rating === 5).length, color: 'bg-success/10 text-success' },
        { label: 'Poor (1-2★)', value: shown.filter((f) => f.rating <= 2).length, color: 'bg-destructive/10 text-destructive' }].
        map((s) =>
        <div key={s.label} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${s.color}`}><Star className="w-5 h-5" /></div>
            <div><h3 className="font-heading text-xl font-bold leading-none">{s.value}</h3><p className="text-[0.7rem] text-muted-foreground mt-0.5">{s.label}</p></div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold">Feedback for Your Labs &amp; Equipment <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{shown.length}</span></h2>
          <select value={labFilter} onChange={(e) => setLabFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-xs bg-card">
            <option value="">All my labs</option>
            {labs.map((l) => <option key={l.id} value={String(l.id)}>{l.lab_code} — {l.lab_name}</option>)}
          </select>
        </div>

        {selectedLab && (equipmentByLab[String(selectedLab.id)] || []).length > 0 && (
          <div className="px-6 py-3 border-b border-border bg-muted/30 text-xs">
            <span className="font-semibold">Equipment in {selectedLab.lab_name}:</span>{' '}
            <span className="text-muted-foreground">{equipmentByLab[String(selectedLab.id)].join(', ')}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No feedback for your labs yet</div>
        ) : (
          <>
            {/* Phone / tablet: stacked cards */}
            <div className="lg:hidden grid gap-3 p-4 sm:grid-cols-2">
              {shown.map((fb) => (
                <div key={fb.id} className="border border-border rounded-xl p-3.5 space-y-2">
                  {fb.is_anonymous ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      <EyeOff className="w-3 h-3" /> Anonymous
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-sm">{fb.researcher_name}</div>
                      <div className="text-xs text-muted-foreground">{fb.email}</div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Stars n={fb.rating} /><span className="text-xs text-muted-foreground font-semibold">{fb.rating}/5</span>
                  </div>
                  <p className="text-xs leading-relaxed">{fb.comment || <span className="text-muted-foreground italic">No comment</span>}</p>
                  <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground pt-1">
                    <div>
                      <span>{fb.laboratories?.lab_name || <span className="italic">General</span>}</span>
                      <EquipmentChips labId={fb.laboratory_id} />
                    </div>
                    <span className="whitespace-nowrap">{fmtDate(fb.submitted_at)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-muted/50 border-b-2 border-border">
                  {['Researcher', 'Lab / Equipment', 'Rating', 'Comment', 'Date'].map((h) =>
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {shown.map((fb) =>
                    <tr key={fb.id} className="border-b border-muted hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {fb.is_anonymous ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            <EyeOff className="w-3 h-3" /> Anonymous
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold">{fb.researcher_name}</div>
                            <div className="text-xs text-muted-foreground">{fb.email}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {fb.laboratories?.lab_name || <span className="text-muted-foreground italic">General</span>}
                        <EquipmentChips labId={fb.laboratory_id} />
                      </td>
                      <td className="px-4 py-3"><Stars n={fb.rating} /><span className="text-xs text-muted-foreground font-semibold">{fb.rating}/5</span></td>
                      <td className="px-4 py-3 text-xs max-w-[260px] leading-relaxed">{fb.comment || <span className="text-muted-foreground italic">No comment</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(fb.submitted_at)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StaffFeedback;