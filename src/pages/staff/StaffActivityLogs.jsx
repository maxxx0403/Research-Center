import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const StaffActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    // RLS scopes this to logs for the staff member's assigned floors
    // (plus any system-wide logs with no floor) — no extra filter needed.
    const { data } = await supabase
      .from('activity_logs')
      .select('id, action, description, floor, actor, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-heading text-sm font-bold">
          Activity Logs <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{logs.length}</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
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
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Loading…</td></tr>
            ) : logs.length ? logs.map((log) => (
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
            )) : (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffActivityLogs;