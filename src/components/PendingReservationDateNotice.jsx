import { useEffect, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import {
  fetchPendingReservationCounts,
  MAX_PENDING_RESERVATIONS_PER_DATE,
} from '@/lib/pendingReservationLimit';

const PendingReservationDateNotice = ({ date }) => {
  const [count, setCount] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!date) {
      setCount(null);
      setLoadError(false);
      return undefined;
    }

    let active = true;
    const loadCount = async () => {
      try {
        const counts = await fetchPendingReservationCounts([date]);
        if (active) {
          setCount(counts[date] || 0);
          setLoadError(false);
        }
      } catch (error) {
        console.error('Error fetching pending reservation count:', error);
        if (active) {
          setCount(null);
          setLoadError(true);
        }
      }
    };

    loadCount();
    const intervalId = window.setInterval(loadCount, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [date]);

  if (!date) return null;

  if (loadError) {
    return (
      <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Could not check pending bookings for this date. Retry before submitting your booking.
      </p>
    );
  }

  if (count === null) return null;

  return (
    <p
      role="status"
      className={`mt-2 flex items-start gap-1.5 text-xs ${
        count >= MAX_PENDING_RESERVATIONS_PER_DATE ? 'font-semibold text-destructive' : 'text-muted-foreground'
      }`}
    >
      {count >= MAX_PENDING_RESERVATIONS_PER_DATE ? (
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      )}
      {count >= MAX_PENDING_RESERVATIONS_PER_DATE
        ? `${count}/${MAX_PENDING_RESERVATIONS_PER_DATE} pending bookings. This date has reached its limit.`
        : `${count}/${MAX_PENDING_RESERVATIONS_PER_DATE} pending bookings on this date across all labs and equipment.`}
    </p>
  );
};

export default PendingReservationDateNotice;
