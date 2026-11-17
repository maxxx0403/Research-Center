import { AlertTriangle, PackageX, Clock } from 'lucide-react';
import { getStatusColor } from '@/data/mockData';
import { isEquipmentOverdue, borrowDateTimeText, returnConditionLabel } from '@/lib/reservationUtils';
import { stockLevelOf, equipmentStatusLabel, lowStockLevelOf } from '@/lib/equipmentAvailability';






const colorMap = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground'
};

const statusLabels = {
  maintenance: 'Under Maintenance',
  damaged: 'Damaged',
};

// type="equipment" uses the equipment status names (Borrowed / In Use, Under Repair, ...).
const StatusBadge = ({ status, className = '', type }) => {
  const color = getStatusColor(status);
  const label = type === 'equipment'
    ? equipmentStatusLabel(status)
    : statusLabels[status] || status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[color] || colorMap.muted} ${className}`}>
      {label}
    </span>);

};

// ---------------------------------------------------------------------------
// Equipment stock warnings: "Low stock" (at or below the minimum quantity) / "Out of stock"
// ---------------------------------------------------------------------------
export const EquipmentStockBadge = ({ item, stock }) => {
  const level = stockLevelOf(item, stock);
  if (level === 'out') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive whitespace-nowrap">
        <PackageX className="w-3 h-3" /> Out of stock
      </span>
    );
  }
  if (level === 'low') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning/10 text-warning whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> Low: {stock?.[item.id]?.available ?? ''} left
      </span>
    );
  }
  return null;
};

const MAX_NAMES = 5;

const nameList = (items) => {
  const label = (e) => `${e.name}${e.laboratories?.lab_code ? ` (${e.laboratories.lab_code})` : ''}`;
  const shown = items.slice(0, MAX_NAMES).map(label).join(', ');
  return items.length > MAX_NAMES ? `${shown}, and ${items.length - MAX_NAMES} more` : shown;
};

/** Warning banner shown above the equipment table. */
export const EquipmentStockAlert = ({ items, stock }) => {
  const out = items.filter((e) => stockLevelOf(e, stock) === 'out');
  const low = items.filter((e) => stockLevelOf(e, stock) === 'low');
  if (!out.length && !low.length) return null;

  return (
    <div className="space-y-2">
      {out.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-3 flex items-start gap-2">
          <PackageX className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
          <p className="text-xs text-foreground">
            <strong>{out.length} equipment item{out.length === 1 ? ' is' : 's are'} out of stock</strong> — all units are currently borrowed or reserved: {nameList(out)}.
          </p>
        </div>
      )}
      {low.length > 0 && (
        <div className="bg-warning/10 border border-warning/25 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-warning" />
          <p className="text-xs text-foreground">
            <strong>{low.length} equipment item{low.length === 1 ? ' is' : 's are'} at or below the minimum quantity</strong>: {low.map((e) => `${e.name} (${stock?.[e.id]?.available ?? 0} left, min ${lowStockLevelOf(e)})`).slice(0, MAX_NAMES).join(', ')}{low.length > MAX_NAMES ? `, and ${low.length - MAX_NAMES} more` : ''}.
          </p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Borrowing record under an equipment reservation's status:
// "Overdue" / "Released by ... · time" / "Returned · condition".
// rows: one or more equipment_reservations of the same request.
// ---------------------------------------------------------------------------
export const BorrowInfo = ({ rows = [] }) => {
  const list = rows.filter(Boolean);
  if (!list.length) return null;
  const overdue = list.filter((r) => isEquipmentOverdue(r));
  const released = list.filter((r) => r.released_at && !r.returned_at);
  const returned = list.filter((r) => r.returned_at);
  const notPickedUp = list.filter((r) => r.status === 'cancelled' && !r.released_at && r.return_notes?.startsWith('Not released'));
  // Approved, never released, and the time is over: admin/staff decide (cancel or release by hand).
  const missedPickup = list.filter((r) => r.status === 'reserved' && !r.released_at && new Date(r.end_datetime).getTime() <= Date.now());
  if (!overdue.length && !released.length && !returned.length && !notPickedUp.length && !missedPickup.length) return null;
  const last = (arr, key) => arr.map((r) => r[key]).filter(Boolean).sort().pop();
  const lastReturned = returned.find((r) => r.returned_at === last(returned, 'returned_at'));
  const conditions = [...new Set(returned.map((r) => r.return_condition).filter(Boolean))];
  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-snug">
      {missedPickup.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-warning/10 text-warning" title="The reserved time is over and it was never released. Cancel it or release it with Change status / Release.">
          <Clock className="w-3 h-3" /> Not picked up{missedPickup.length > 1 ? ` (${missedPickup.length})` : ''}
        </span>
      )}
      {overdue.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-destructive/10 text-destructive">
          <Clock className="w-3 h-3" /> Overdue{overdue.length > 1 ? ` (${overdue.length})` : ''}
        </span>
      )}
      {released.length > 0 && (
        <div className="text-muted-foreground">
          Released {borrowDateTimeText(last(released, 'released_at'))}{released[0].released_by_name ? ` by ${released[0].released_by_name}` : ''}
        </div>
      )}
      {lastReturned && (
        <div className="text-muted-foreground">
          Returned {borrowDateTimeText(lastReturned.returned_at)}{lastReturned.returned_by_name ? ` to ${lastReturned.returned_by_name}` : ''}
          {conditions.length > 0 && (
            <> · <span className={conditions.some((x) => x !== 'good') ? 'font-semibold text-destructive' : 'font-semibold text-success'}>{conditions.map(returnConditionLabel).join(', ')}</span></>
          )}
          {lastReturned.return_notes && <div className="italic">“{lastReturned.return_notes}”</div>}
        </div>
      )}
      {notPickedUp.length > 0 && !released.length && !returned.length && (
        <div className="text-muted-foreground italic">Not picked up</div>
      )}
    </div>
  );
};

export default StatusBadge;