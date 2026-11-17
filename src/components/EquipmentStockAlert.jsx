import { AlertTriangle, PackageX } from 'lucide-react';

import { stockLevelOf } from '@/lib/equipmentStock';

const EquipmentStockBadge = ({ item, stock }) => {
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
        <AlertTriangle className="w-3 h-3" /> 1 left
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
const EquipmentStockAlert = ({ items, stock }) => {
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
            <strong>{low.length} equipment item{low.length === 1 ? ' has' : 's have'} only 1 unit left</strong>: {nameList(low)}.
          </p>
        </div>
      )}
    </div>
  );
};

export { EquipmentStockBadge };
export default EquipmentStockAlert;