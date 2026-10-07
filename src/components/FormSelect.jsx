import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Styled dropdown that replaces the native <select> in the reservation forms.
 * The opened list matches the portal theme (white card, #008000 border,
 * green highlight) instead of the browser's default list.
 *
 * value:    selected value (number/string). '' / 0 / null shows the placeholder.
 * onChange: receives the selected value as a STRING (wrap with Number() for ids).
 * options:  [{ value, label, disabled }]
 */
const FormSelect = ({ value, onChange, options = [], placeholder = 'Select…', className, disabled }) => {
  const current = value === undefined || value === null || value === 0 || value === '0' ? '' : String(value);

  return (
    <SelectPrimitive.Root value={current} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex items-center justify-between gap-2 text-left cursor-pointer',
          'data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
      >
        <span className="flex-1 min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#008000]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[80] overflow-hidden rounded-2xl border-2 border-[#008000] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] min-w-[var(--radix-select-trigger-width)] max-w-[min(92vw,34rem)] max-h-[min(var(--radix-select-content-available-height),20rem)]"
        >
          <SelectPrimitive.Viewport className="p-1.5 max-h-[inherit] overflow-y-auto">
            {options.length === 0 && (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">No options available</div>
            )}
            {options.map((o) => (
              <SelectPrimitive.Item
                key={String(o.value)}
                value={String(o.value)}
                disabled={o.disabled}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer outline-none select-none data-[highlighted]:bg-[#008000]/10 data-[state=checked]:font-semibold data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="w-4 h-4 text-[#008000]" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};

export default FormSelect;