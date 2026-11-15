import { useState, useCallback } from 'react';
import { MoreVertical, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Reusable "3 dots" actions menu for table rows / cards.
 *
 * items: array of
 *  - { label, icon: LucideIcon, onClick, href (external/new tab), to (in-app route), disabled, hidden, destructive, success } -> normal action
 *  - { label, icon, value, options: [{ value, label }], onChange, disabled, hidden }     -> submenu with radio options
 *  - { separator: true }                                                                 -> divider
 *  - { heading: 'Text' }                                                                 -> small label
 */
const RowActions = ({ items = [], label = 'Actions', align = 'end', className }) => {
  const navigate = useNavigate();
  // Drop hidden items, then tidy up separators (no leading/trailing/double separators)
  const visible = items.filter((i) => i && !i.hidden);
  const tidy = visible.filter((item, idx, arr) => {
    if (!item.separator) return true;
    if (idx === 0 || idx === arr.length - 1) return false;
    return !arr[idx - 1].separator;
  });

  if (tidy.filter((i) => !i.separator && !i.heading).length === 0) return null;

  const BASE_ITEM =
    'gap-3 cursor-pointer text-sm px-3 py-2.5 rounded-lg text-foreground focus:text-foreground focus:bg-black/5 dark:focus:bg-white/10 data-[state=open]:text-foreground [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:text-muted-foreground';

  const itemCls = (item) =>
    cn(
      BASE_ITEM,
      item.destructive && 'text-destructive focus:text-destructive focus:bg-destructive/10 [&_svg]:text-destructive',
      item.success && 'text-success focus:text-success focus:bg-success/10 [&_svg]:text-success'
    );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-lg border-none bg-transparent text-muted-foreground cursor-pointer',
            'hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground transition-colors',
            className
          )}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className="min-w-[14rem] z-[60] p-2 rounded-2xl border-0 bg-[#f0f4fa] dark:bg-popover shadow-[0_4px_20px_rgba(0,0,0,0.18)]" onClick={(e) => e.stopPropagation()}>
        {tidy.map((item, idx) => {
          if (item.separator) return <DropdownMenuSeparator key={`sep-${idx}`} className="my-1.5 mx-1 bg-black/10 dark:bg-white/10" />;
          if (item.heading) return <DropdownMenuLabel key={`h-${idx}`} className="text-xs text-muted-foreground">{item.heading}</DropdownMenuLabel>;

          const Icon = item.icon;

          if (item.options) {
            return (
              <DropdownMenuSub key={`${item.label}-${idx}`}>
                <DropdownMenuSubTrigger disabled={item.disabled} className={cn(BASE_ITEM, 'data-[state=open]:bg-black/5')}>
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="z-[70] min-w-[12rem] p-2 rounded-2xl border-0 bg-[#f0f4fa] dark:bg-popover shadow-[0_4px_20px_rgba(0,0,0,0.18)]">
                  <DropdownMenuRadioGroup value={item.value} onValueChange={(v) => v !== item.value && item.onChange?.(v)}>
                    {item.options.map((o) => (
                      <DropdownMenuRadioItem key={o.value} value={o.value} className="cursor-pointer text-sm py-2.5 rounded-lg text-foreground focus:text-foreground focus:bg-black/5 dark:focus:bg-white/10">
                        {o.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          if (item.href) {
            return (
              <DropdownMenuItem key={`${item.label}-${idx}`} asChild disabled={item.disabled} className={itemCls(item)}>
                <a href={item.href} target="_blank" rel="noreferrer" className="no-underline">
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </a>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem
              key={`${item.label}-${idx}`}
              disabled={item.disabled}
              onSelect={() => (item.to ? navigate(item.to) : item.onClick?.())}
              className={itemCls(item)}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


/**
 * Helpers for cancelling only SOME of the labs / days / equipment inside a
 * multi-reservation (rows that share a batch_id).
 *
 * Usage in a page:
 *   const cancelSel = useCancelSelection();
 *   ... inside the expanded rows of a group:
 *   <ItemCancelControls
 *     checked={cancelSel.has(group.key, it.id)}
 *     onToggle={() => cancelSel.toggle(group.key, it.id)}
 *     canCancel={CANCELLABLE.includes(it.status)}
 *     onCancel={() => handleCancelItems(group, [it.id])}
 *   />
 *   <SelectedCancelBar count={cancelSel.get(group.key).length} onCancel={...} onClear={() => cancelSel.clear(group.key)} />
 */
export const useCancelSelection = () => {
  const [selected, setSelected] = useState({});

  const get = useCallback((groupKey) => selected[groupKey] || [], [selected]);
  const has = useCallback((groupKey, id) => (selected[groupKey] || []).includes(id), [selected]);
  const toggle = useCallback((groupKey, id) => {
    setSelected((prev) => {
      const cur = prev[groupKey] || [];
      return { ...prev, [groupKey]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  }, []);
  const clear = useCallback((groupKey) => setSelected((prev) => ({ ...prev, [groupKey]: [] })), []);

  return { get, has, toggle, clear };
};

/** Checkbox + "Cancel" button for one lab/day/equipment row. Renders nothing if it can't be cancelled. */
export const ItemCancelControls = ({ checked, onToggle, canCancel, onCancel, disabled = false }) => {
  if (!canCancel) return null;
  return (
    <div className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        aria-label="Select to cancel"
        className="w-3.5 h-3.5 cursor-pointer accent-[var(--color-destructive,#dc2626)]"
      />
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded text-[0.7rem] font-semibold cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3 h-3" /> Cancel
      </button>
    </div>
  );
};

/** Bar shown above a group's rows once one or more rows are ticked. */
export const SelectedCancelBar = ({ count, onCancel, onClear, disabled = false }) => {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
      <span className="font-semibold text-foreground">{count} selected</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="px-2.5 py-1 rounded border border-border bg-card text-foreground font-semibold cursor-pointer hover:bg-muted inline-flex items-center gap-1 disabled:opacity-50"
        >
          <X className="w-3 h-3" /> Clear
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground font-semibold border-none cursor-pointer hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" /> Cancel selected
        </button>
      </div>
    </div>
  );
};

export default RowActions;