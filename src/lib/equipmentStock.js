// 'out'  = every unit is borrowed/reserved right now
// 'low'  = only 1 unit left (for equipment that has more than 1 unit)
// 'ok'   = enough units left, or the stock is not loaded yet
export const stockLevelOf = (item, stock) => {
  const entry = stock?.[item.id];
  if (!entry) return 'ok';
  const total = Number(item.quantity) || 0;
  if (total > 0 && entry.available <= 0) return 'out';
  if (total > 1 && entry.available === 1) return 'low';
  return 'ok';
};

export const availableNowOf = (item, stock) => stock?.[item.id]?.available ?? null;