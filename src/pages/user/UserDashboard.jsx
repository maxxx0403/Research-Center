import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, FlaskConical, CheckCircle2, XCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import ReservationCalendarView from '@/components/ReservationCalendarView';

const UserDashboard = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReservations = async () => {
      const { data } = await supabase
        .from('reservations')
        .select('id, researcher_name, research_purpose, start_datetime, end_datetime, status, created_at, laboratories(lab_name, lab_code)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setReservations(data || []);
      setLoading(false);
    };
    if (user) fetchReservations();
  }, [user]);

  const total = reservations.length;
  const completed = reservations.filter((r) => r.status === 'completed').length;
  const cancelled = reservations.filter((r) => r.status === 'cancelled').length;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Researcher';

  return (
    <div className="space-y-6 dash-black">
      {/* Profile + quick action + calendar */}
      <div className="space-y-6">

        {/* Profile row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm text-foreground truncate">{loading ? '…' : displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><CalendarCheck className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-foreground leading-none">{loading ? '…' : total}</h3>
              <p className="text-xs text-muted-foreground mt-1">Total Reservations</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-foreground leading-none">{loading ? '…' : completed}</h3>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0"><XCircle className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-foreground leading-none">{loading ? '…' : cancelled}</h3>
              <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
            </div>
          </div>
        </div>

        {/* Quick action */}
        <div className="flex items-center justify-end flex-wrap gap-3">
          <Link to="/user/reserve" className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm no-underline hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> New Reservation
          </Link>
        </div>

        {/* Reservations Calendar */}
        <div className="isolate bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70 rounded-2xl
            shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
            relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
          <div className="px-6 py-4 border-b border-white/40">
            <h2 className="font-heading text-sm font-bold text-primary">Reservation Calendar</h2>
          </div>
          <div className="p-6">
            <ReservationCalendarView />
          </div>
        </div>
      </div>

      {/* Recent Reservations */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold">Recent Reservations</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No reservations yet</p>
            <Link to="/user/reserve" className="text-primary underline text-sm">Reserve your first lab →</Link>
          </div>
        ) : (
          <>
            {/* Phone / tablet: stacked cards */}
            <div className="md:hidden divide-y divide-muted">
              {reservations.slice(0, 8).map((r) => (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{r.laboratories?.lab_name}</div>
                      <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{r.laboratories?.lab_code}</code>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{r.research_purpose.slice(0, 80)}{r.research_purpose.length > 80 ? '…' : ''}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>#RC{String(r.id).padStart(5, '0')}</span>
                    <span>
                      {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–{new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.slice(0, 8).map((r) => (
                    <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-xs">#RC{String(r.id).padStart(5, '0')}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.laboratories?.lab_name}</div>
                        <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{r.laboratories?.lab_code}</code>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px]">{r.research_purpose.slice(0, 80)}{r.research_purpose.length > 80 ? '…' : ''}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                        {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
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

export default UserDashboard;