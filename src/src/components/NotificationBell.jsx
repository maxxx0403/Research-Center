import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CalendarCheck, Package, XCircle, CheckCircle2, MessageSquare, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// `homeLink` decides where notifications route to when clicked, since the
// same notification types are shared across the user/staff/admin panels
// but each panel has its own reservations/equipment paths.
const ICONS = {
  reservation_approved: CheckCircle2,
  reservation_rejected: XCircle,
  new_reservation: CalendarCheck,
  equipment_added: Package,
  equipment_removed: Trash2,
  reservation_message: MessageSquare
};

const NotificationBell = ({ reservationsLink = '/user/reservations', equipmentLink = '/admin/equipment' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.
    from('notifications').
    select('*').
    eq('user_id', user.id).
    order('created_at', { ascending: false }).
    limit(30);
    setNotifications(data || []);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.
    channel(`notifications:${user.id}`).
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
    (payload) => setNotifications((prev) => [payload.new, ...prev])
    ).
    subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    setOpen(false);
    const baseLink = n.type === 'equipment_added' ? equipmentLink : reservationsLink;
    // If this notification is about a specific reservation, jump straight to
    // it (the target page reads ?open=type:id and scrolls/opens it).
    const target = n.reservation_type && n.reservation_id
      ? `${baseLink}?open=${n.reservation_type}:${n.reservation_id}`
      : baseLink;
    navigate(target);
  };

  const timeAgo = (d) => {
    const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative bg-transparent border-none cursor-pointer text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
        title="Notifications">

        <Bell className="w-5 h-5" />
        {unreadCount > 0 &&
        <span className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground text-[0.65rem] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        }
      </button>

      {open &&
      <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-card border border-border rounded-xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card">
            <h3 className="font-heading text-sm font-bold">Notifications</h3>
            {unreadCount > 0 &&
          <button onClick={markAllRead} className="text-xs text-primary font-semibold bg-transparent border-none cursor-pointer inline-flex items-center gap-1 hover:underline">
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
          }
          </div>
          {notifications.length === 0 ?
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">No notifications yet.</div> :

        notifications.map((n) => {
          const Icon = ICONS[n.type] || Bell;
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-4 py-3 border-b border-muted last:border-0 flex gap-3 items-start cursor-pointer border-none transition-colors ${n.is_read ? 'bg-card hover:bg-muted/40' : 'bg-primary/5 hover:bg-primary/10'}`}>

                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[0.65rem] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>);

        })
        }
        </div>
      }
    </div>);

};

export default NotificationBell;