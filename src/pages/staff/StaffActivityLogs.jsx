import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const StaffActivityLogs = () => {
  const { user, assignedRoomIds } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const roomKey = assignedRoomIds.join(',');

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);

    // Older logs were saved with only the actor's name (no actor_id), so match those by name too.
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
    const myName = profile?.full_name?.trim() || user.email || '';
    const quoted = `"${myName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    // A staff member sees:
    //  1. what they did themselves,
    //  2. what an admin did to their assigned rooms / equipment,
    //  3. what an admin did about their account.
    const rules = [`actor_id.eq.${user.id}`, `target_user_id.eq.${user.id}`];
    if (myName) rules.push(`actor.eq.${quoted}`);
    if (assignedRoomIds.length) {
      rules.push(`and(actor_role.eq.admin,laboratory_ids.ov.{${assignedRoomIds.join(',')}})`);
    }

    let { data, error } = await supabase
      .from('activity_logs')
      .select('id, action, description, floor, actor, created_at')
      .not('actor', 'is', null)
      .or(rules.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      // New columns not created yet (migration not run) -> fall back to name only.
      console.error('Activity log query failed:', error);
      ({ data } = await supabase
        .from('activity_logs')
        .select('id, action, description, floor, actor, created_at')
        .eq('actor', myName)
        .order('created_at', { ascending: false })
        .limit(200));
    }
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomKey]);

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-heading text-sm font-bold">
          Activity Logs <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{logs.length}</span>
        </h2>
      </div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-xs">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">No activity yet.</div>
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

export default StaffActivityLogs;