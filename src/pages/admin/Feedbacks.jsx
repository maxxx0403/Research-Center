import { useState, useEffect } from 'react';
import { Star, Trash2, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import RowActions from '@/components/RowActions';

const Stars = ({ n }) =>
<div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? 'fill-warning text-warning' : 'text-border'}`} />)}</div>;


const Feedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const { data } = await supabase
        .from('feedbacks')
        .select('*, laboratories(lab_name, lab_code)')
        .order('submitted_at', { ascending: false });
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    }
    setLoading(false);
  };

  const deleteFeedback = async (id) => {
    if (!confirm('Delete this feedback?')) return;
    setDeleting(id);
    try {
      await supabase.from('feedbacks').delete().eq('id', id);
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Failed to delete feedback');
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
        { label: 'Total Feedback', value: feedbacks.length, color: 'bg-primary/10 text-primary' },
        ...[
          [5, 'bg-success/10 text-success'],
          [3, 'bg-warning/10 text-warning'],
          [0, 'bg-muted text-muted-foreground'],
        ].map(([n, color]) => ({
          label: `${n} Star${n === 1 ? '' : 's'}`,
          value: feedbacks.filter((f) => Number(f.rating) === n).length,
          color,
        }))].
        map((s) =>
        <div key={s.label} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${s.color}`}><Star className="w-5 h-5" /></div>
            <div><h3 className="font-heading text-xl font-bold leading-none">{s.value}</h3><p className="text-[0.7rem] text-muted-foreground mt-0.5">{s.label}</p></div>
          </div>
        )}
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-heading text-sm font-bold">All Feedback <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{feedbacks.length}</span></h2></div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No feedback yet</div>
        ) : (
          <>
            {/* Phone / tablet: stacked cards */}
            <div className="lg:hidden grid gap-3 p-4 sm:grid-cols-2">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
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
                    <RowActions
                      items={[{ label: deleting === fb.id ? 'Deleting…' : 'Delete', icon: Trash2, destructive: true, disabled: deleting === fb.id, onClick: () => deleteFeedback(fb.id) }]}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars n={fb.rating} /><span className="text-xs text-muted-foreground font-semibold">{fb.rating}/5</span>
                  </div>
                  <p className="text-xs leading-relaxed">{fb.comment || <span className="text-muted-foreground italic">No comment</span>}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{fb.laboratories?.lab_name || <span className="italic">General</span>}</span>
                    <span>{new Date(fb.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-muted/50 border-b-2 border-border"><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Researcher</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Lab</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Rating</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Comment</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Actions</th></tr></thead>
                <tbody>
                  {feedbacks.map((fb) =>
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
                      <td className="px-4 py-3 text-xs">{fb.laboratories?.lab_name || <span className="text-muted-foreground italic">General</span>}</td>
                      <td className="px-4 py-3"><Stars n={fb.rating} /><span className="text-xs text-muted-foreground font-semibold">{fb.rating}/5</span></td>
                      <td className="px-4 py-3 text-xs max-w-[260px] leading-relaxed">{fb.comment || <span className="text-muted-foreground italic">No comment</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(fb.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <RowActions
                          items={[{ label: deleting === fb.id ? 'Deleting…' : 'Delete', icon: Trash2, destructive: true, disabled: deleting === fb.id, onClick: () => deleteFeedback(fb.id) }]}
                        />
                      </td>
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

export default Feedbacks;