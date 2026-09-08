import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';

// Only Sunday (0) is closed; Friday and Saturday are open with the same hours.
const CLOSED_DAYS = [0];

const isWeekend = (year, month, day) => {
  const dow = new Date(year, month, day).getDay();
  return CLOSED_DAYS.includes(dow);
};

const toDateKey = (year, month, day) => {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

export const ReservationCalendarView = ({ labId = null }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  const [staffUnavailability, setStaffUnavailability] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchReservations();
    fetchStaffUnavailability();
  }, [currentDate, labId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      let query = supabase
        .from('reservations')
        .select('*, laboratories(lab_name, lab_code)')
        .gte('start_datetime', monthStart.toISOString())
        .lte('end_datetime', monthEnd.toISOString())
        .eq('status', 'reserved')
        .order('start_datetime', { ascending: true });

      if (labId) {
        query = query.eq('laboratory_id', labId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
    setLoading(false);
  };

  const fetchStaffUnavailability = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStartKey = toDateKey(year, month, 1);
      const monthEndKey = toDateKey(year, month, new Date(year, month + 1, 0).getDate());

      let query = supabase
        .from('staff_unavailability')
        .select('*, laboratories(lab_name, lab_code)')
        .gte('unavailable_date', monthStartKey)
        .lte('unavailable_date', monthEndKey);

      // When viewing a specific room's calendar, only show unavailability
      // that applies to that room: rows with no room set (whole-day, all
      // rooms) plus rows explicitly scoped to this labId.
      if (labId) {
        query = query.or(`laboratory_id.is.null,laboratory_id.eq.${labId}`);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const grouped = {};
      (rows || []).forEach((r) => {
        if (!grouped[r.unavailable_date]) grouped[r.unavailable_date] = [];
        grouped[r.unavailable_date].push({
          name: r.staff_name || 'A staff member',
          reason: r.reason,
          roomLabel: r.laboratories ? `${r.laboratories.lab_name} (${r.laboratories.lab_code})` : 'All rooms',
        });
      });
      setStaffUnavailability(grouped);
    } catch (error) {
      console.error('Error fetching staff unavailability:', error);
    }
  };

  const getUnavailableStaffForDate = (day) => {
    const key = toDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    return staffUnavailability[key] || [];
  };

  const getDaysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const getFirstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getReservationsForDate = (day) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return reservations.filter((res) => {
      const resStart = new Date(res.start_datetime);
      const resEnd = new Date(res.end_datetime);
      return (
        resStart.toDateString() === targetDate.toDateString() ||
        (resStart < targetDate && resEnd > targetDate)
      );
    });
  };

  const previousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-primary">{monthName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bookings available <span className="font-semibold text-foreground">Monday – Saturday</span> only · 7:00 AM – 6:00 PM
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={previousMonth} className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded bg-muted border border-border" />
          Available
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/30" />
          Closed (Sun)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserX className="w-3.5 h-3.5 text-amber-600" />
          Room unavailable
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
          <div key={d} className={`text-center font-bold text-sm p-2 ${CLOSED_DAYS.includes(i) ? 'text-destructive/60' : 'text-muted-foreground'}`}>
            {d}
            {CLOSED_DAYS.includes(i) && (
              <span className="block text-[9px] font-normal leading-none mt-0.5 text-destructive/50">closed</span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {days.map((day, idx) => {
          const closed = day ? isWeekend(currentDate.getFullYear(), currentDate.getMonth(), day) : false;
          const dayReservations = day && !closed ? getReservationsForDate(day) : [];
          const unavailableStaff = day ? getUnavailableStaffForDate(day) : [];
          const isToday = day && new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
          const isSelected = selectedDate === day && !closed;

          return (
            <div
              key={idx}
              onClick={() => { if (!day || closed) return; setSelectedDate(selectedDate === day ? null : day); }}
              title={unavailableStaff.length > 0 ? `Unavailable: ${unavailableStaff.map((s) => `${s.name} (${s.roomLabel})`).join(', ')}` : undefined}
              className={`min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1.5 sm:p-2 rounded-lg border-2 transition-colors
                ${!day ? 'bg-muted/20 border-transparent' : ''}
                ${closed ? 'bg-destructive/5 border-destructive/20 cursor-not-allowed' : isToday ? 'border-primary bg-primary/5 cursor-pointer' : isSelected ? 'bg-primary/10 border-primary cursor-pointer' : day ? 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer' : ''}
              `}
            >
              {day && (
                <>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className={`font-semibold text-sm ${closed ? 'text-destructive/40' : isToday ? 'text-primary' : 'text-foreground'}`}>
                      {day}
                    </div>
                    {!closed && unavailableStaff.length > 0 && (
                      <UserX className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    )}
                  </div>
                  {closed ? (
                    <div className="text-[10px] text-destructive/50 font-medium mt-1 leading-tight">No booking</div>
                  ) : (
                    <div className="space-y-1">
                      {dayReservations.slice(0, 2).map((res, i) => (
                        <div key={i} className="text-xs px-1 py-0.5 rounded bg-secondary/50 text-secondary-foreground truncate" title={`${res.researcher_name} - ${res.laboratories?.lab_code || 'Lab'}`}>
                          {res.researcher_name.split(' ')[0]}
                        </div>
                      ))}
                      {dayReservations.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">+{dayReservations.length - 2} more</div>
                      )}
                      {unavailableStaff.length > 0 && (
                        <div className="text-[10px] text-amber-700 px-1 truncate">
                          {unavailableStaff.length === 1
                            ? `${unavailableStaff[0].roomLabel} unavailable`
                            : `${unavailableStaff.length} rooms unavailable`}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && !isWeekend(currentDate.getFullYear(), currentDate.getMonth(), selectedDate) && (
        <div className="bg-card rounded-xl border-2 border-border p-6">
          <h3 className="font-heading text-lg font-bold text-primary mb-4">
            Reservations for {new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>

          {getUnavailableStaffForDate(selectedDate).length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> Room unavailable this day
              </p>
              <ul className="space-y-0.5">
                {getUnavailableStaffForDate(selectedDate).map((s, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    {s.name} <span className="text-amber-700 font-medium">· {s.roomLabel}</span>
                    {s.reason && <span className="text-amber-700"> — {s.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {getReservationsForDate(selectedDate).length > 0 ? (
              getReservationsForDate(selectedDate).map((res, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{res.researcher_name}</p>
                      <p className="text-sm text-muted-foreground">{res.laboratories?.lab_name || 'Lab'} ({res.laboratories?.lab_code})</p>
                    </div>
                    <StatusBadge status={res.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {new Date(res.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(res.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {res.study_title && <p className="text-sm text-foreground">{res.study_title}</p>}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No reservations for this date.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationCalendarView;