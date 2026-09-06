/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];













const AuthContext = createContext({ user: null, session: null, loading: true, role: null, isAdmin: false, isStaff: false, assignedRooms: [], assignedRoomIds: [], assignedFloors: [], signOut: async () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  // Rooms (laboratories) this staff member has been assigned to. Empty
  // array means "no rooms assigned yet" (pages fall back to unrestricted).
  const [assignedRooms, setAssignedRooms] = useState([]);

  const fetchRole = async (userId) => {
    const { data } = await supabase.
    from('user_roles').
    select('role').
    eq('user_id', userId).
    maybeSingle();
    const userRole = data?.role || 'user';
    setRole(userRole);

    if (userRole === 'staff') {
      const { data: roomsData } = await supabase.
      from('staff_room_assignments').
      select('laboratory_id, laboratories(id, lab_name, lab_code, floor)').
      eq('user_id', userId);
      setAssignedRooms((roomsData || []).map((r) => r.laboratories).filter(Boolean));
    } else {
      setAssignedRooms([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer role fetch to avoid Supabase auth deadlock
        setTimeout(() => fetchRole(session.user.id), 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (role !== null && user) setLoading(false);
  }, [role, user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setAssignedRooms([]);
  };

  // Auto sign-out after 10 minutes of inactivity while logged in
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const handleInactivityLogout = async () => {
      await signOut();
      window.location.href = '/login?reason=timeout';
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const assignedRoomIds = assignedRooms.map((r) => r.id);
  const assignedFloors = [...new Set(assignedRooms.map((r) => r.floor).filter(Boolean))];

  return (
    <AuthContext.Provider value={{ user, session, loading, role, isAdmin: role === 'admin', isStaff: role === 'staff', assignedRooms, assignedRoomIds, assignedFloors, signOut }}>
      {children}
    </AuthContext.Provider>);

};