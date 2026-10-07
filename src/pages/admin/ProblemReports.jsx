import { useState, useEffect, useMemo } from 'react';
import { Trash2, Clock, CheckCircle2, RotateCcw, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import RowActions from '@/components/RowActions';

const CATEGORY_LABEL = {
  reservation: 'Reservation problem',
  bug: 'Website error',
  account: 'Account or login',
  lab_equipment: 'Laboratory or equipment',
  other: 'Other',
};

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };
const STATUS_STYLE = {
  open: 'bg-warning/15 text-warning',
  in_progress: 'bg-primary/10 text-primary',
  resolved: 'bg-success/15 text-success',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });

const StatusBadge = ({ status }) => (
  <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[status] || 'bg-muted text-muted-foreground'}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

const ProblemReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('problem_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching problem reports:', error);
      toast.error('Failed to load reports: ' + error.message);
    }
    setReports(data || []);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    setBusyId(id);
    const { error } = await supabase
      .from('problem_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Failed to update status: ' + error.message);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}.`);
  };

  const deleteReport = async (id) => {
    if (!confirm('Delete this report?')) return;
    setBusyId(id);
    const { error } = await supabase.from('problem_reports').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Failed to delete report: ' + error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const counts = useMemo(
    () => ({
      all: reports.length,
      open: reports.filter((r) => r.status === 'open').length,
      in_progress: reports.filter((r) => r.status === 'in_progress').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
    }),
    [reports]
  );

  const visible = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  const actionsFor = (r) => [
    {
      label: 'Mark as In progress',
      icon: Clock,
      onClick: () => updateStatus(r.id, 'in_progress'),
      hidden: r.status === 'in_progress' || r.status === 'resolved',
      disabled: busyId === r.id,
    },
    {
      label: 'Mark as Resolved',
      icon: CheckCircle2,
      success: true,
      onClick: () => updateStatus(r.id, 'resolved'),
      hidden: r.status === 'resolved',
      disabled: busyId === r.id,
    },
    {
      label: 'Reopen',
      icon: RotateCcw,
      onClick: () => updateStatus(r.id, 'open'),
      hidden: r.status !== 'resolved',
      disabled: busyId === r.id,
    },
    { separator: true },
    { label: 'Delete', icon: Trash2, destructive: true, onClick: () => deleteReport(r.id), disabled: busyId === r.id },
  ];

  const Description = ({ r }) => (
    <div>
      <p className={`text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap ${expanded === r.id ? '' : 'line-clamp-2'}`}>
        {r.description}
      </p>
      {r.description.length > 110 && (
        <button
          type="button"
          onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          className="mt-1 text-xs font-semibold text-primary bg-transparent border-none p-0 cursor-pointer hover:underline"
        >
          {expanded === r.id ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: counts.all, color: 'bg-primary/10 text-primary' },
          { label: 'Open', value: counts.open, color: 'bg-warning/10 text-warning' },
          { label: 'In progress', value: counts.in_progress, color: 'bg-primary/10 text-primary' },
          { label: 'Resolved', value: counts.resolved, color: 'bg-success/10 text-success' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${s.color}`}><Flag className="w-5 h-5" /></div>
            <div>
              <h3 className="font-heading text-xl font-bold leading-none">{s.value}</h3>
              <p className="text-[0.7rem] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold">Problem Reports</h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  filter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {f.label} ({counts[f.value]})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No reports found</div>
        ) : (
          <>
            {/* Phone / tablet: stacked cards */}
            <div className="lg:hidden grid gap-3 p-4 sm:grid-cols-2">
              {visible.map((r) => (
                <div key={r.id} className="border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{r.subject}</div>
                      <div className="text-xs text-muted-foreground">{r.reporter_name} · {r.email}</div>
                    </div>
                    <RowActions items={actionsFor(r)} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[r.category] || r.category}</span>
                  </div>
                  <Description r={r} />
                  <div className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Reported by</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Problem</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-muted hover:bg-muted/30 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.reporter_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{CATEGORY_LABEL[r.category] || r.category}</td>
                      <td className="px-4 py-3 max-w-[340px]">
                        <div className="font-semibold text-sm mb-1">{r.subject}</div>
                        <Description r={r} />
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3"><RowActions items={actionsFor(r)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProblemReports;