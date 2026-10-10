import { supabase } from '@/integrations/supabase/client';

/**
 * ON/OFF switch for "non-official hours" (Friday - Sunday bookings).
 * OFF = users cannot book on Fri/Sat/Sun. ON = they can (7:00 AM - 6:00 PM).
 */
const NonOfficialToggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label="Allow Friday to Sunday bookings"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    title={checked ? 'Friday–Sunday bookings are ON (click to turn OFF)' : 'Friday–Sunday bookings are OFF (click to turn ON)'}
    className="inline-flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-success' : 'bg-muted-foreground/40'}`}>
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </span>
    <span className={`text-xs font-bold w-7 text-left ${checked ? 'text-success' : 'text-muted-foreground'}`}>{checked ? 'ON' : 'OFF'}</span>
  </button>
);

/** "All ON / All OFF" buttons for the rows currently shown. */
export const NonOfficialBulk = ({ onAll, disabled = false, count = 0 }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="font-semibold text-muted-foreground whitespace-nowrap">Fri–Sun ({count} shown):</span>
    <button type="button" disabled={disabled} onClick={() => onAll(true)} className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground font-semibold cursor-pointer hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">All ON</button>
    <button type="button" disabled={disabled} onClick={() => onAll(false)} className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground font-semibold cursor-pointer hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">All OFF</button>
  </div>
);

/** Saves the flag for one or many rows. Returns the Supabase error (or null).
 *  The database also checks permissions (admin: all, staff: only their rooms/equipment). */
export const saveNonOfficialHours = async (table, ids, value) => {
  const { error } = await supabase.from(table).update({ allow_non_official_hours: value }).in('id', ids);
  return error || null;
};

export default NonOfficialToggle;