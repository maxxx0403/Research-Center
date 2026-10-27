import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MonthFilter from '@/components/MonthFilter';
import { currentMonthManila, monthLabel, monthRangeISO } from '@/lib/monthRange';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { downloadActivityLogsExcel } from '@/lib/exportActivityLogs';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonthManila);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    const { startISO, endISO } = monthRangeISO(month);
    const { data, error: fetchError } = await fetchAllPages(() =>
      supabase
        .from('activity_logs')
        .select('id, action, description, floor, actor, created_at')
        .not('actor', 'is', null)
        .neq('actor', '')
        .not('actor', 'ilike', 'system')
        .gte('created_at', startISO)
        .lt('created_at', endISO)
        .order('created_at', { ascending: false })
    );
    if (fetchError) {
      console.error('Error fetching activity logs:', fetchError);
      setError('Unable to load activity logs. Please try again.');
      setLogs([]);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportLogs = async () => {
    setExporting(true);
    try {
      await downloadActivityLogsExcel(logs, month);
    } catch (exportError) {
      console.error('Error exporting activity logs:', exportError);
      setError('Unable to export activity logs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-bold">
          Activity Logs — {monthLabel(month)} <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{logs.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <MonthFilter value={month} onChange={setMonth} />
          <button
            type="button"
            onClick={exportLogs}
            disabled={loading || exporting || logs.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-xs">Loading…</div>
      ) : error ? (
        <div role="alert" className="text-center py-8 text-destructive text-xs">{error}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">No activity for {monthLabel(month)}.</div>
      ) : (
        <>
          {/* Phone / tablet: stacked cards */}
          <div className="md:hidden divide-y divide-muted">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{log.actor || 'System'}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <span className="inline-block bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-xs font-semibold">
                  {log.action.replace(/_/g, ' ')}
                </span>
                <p className="text-xs text-muted-foreground">{log.description}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b-2 border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-semibold">{log.actor || 'System'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-xs font-semibold">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityLogs;