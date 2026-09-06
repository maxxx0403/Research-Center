import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ReservationCalendarView from '@/components/ReservationCalendarView';

const UserCalendarReservations = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-12 text-muted-foreground">Please log in</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">Reservations Calendar</h1>
        <p className="text-muted-foreground">View all your laboratory reservations in calendar format</p>
      </div>
      <ReservationCalendarView />
    </div>
  );
};

export default UserCalendarReservations;
