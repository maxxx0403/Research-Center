import { MoreVertical } from 'lucide-react';
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

export default RowActions;