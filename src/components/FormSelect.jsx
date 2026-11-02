import { useEffect, useId, useState } from 'react';
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
 * wrapperClassName: (searchable only) layout classes for the outer wrapper, e.g. 'flex-1' to fill a flex row.
 */
const FormSelect = ({ value, onChange, options = [], placeholder = 'Select…', className, wrapperClassName, disabled, searchable = false }) => {
  const current = value === undefined || value === null || value === 0 || value === '0' ? '' : String(value);
  const listId = useId();
  const selectedLabel = options.find((option) => String(option.value) === current)?.label || '';
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    setQuery(selectedLabel);
    setOpen(false);
  }, [selectedLabel]);

  if (searchable) {
    const chooseOption = (option) => {
      if (!option || option.disabled) return;
      onChange(String(option.value));
      setQuery(current ? option.label : '');
      setOpen(false);
    };

    return (
      <div className={cn('relative min-w-0', wrapperClassName)}>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-label={placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            if (query !== selectedLabel && !options.some((option) => option.label === query && !option.disabled)) {
              setQuery(selectedLabel);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery(selectedLabel);
            } else if (event.key === 'ArrowDown' && filteredOptions.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % filteredOptions.length);
            } else if (event.key === 'ArrowUp' && filteredOptions.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index - 1 + filteredOptions.length) % filteredOptions.length);
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              chooseOption(filteredOptions[activeIndex] || filteredOptions.find((option) => !option.disabled));
            }
          }}
          className={cn(
            'w-full min-w-0 pr-10',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#008000]" aria-hidden="true" />
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-[80] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border-2 border-[#008000] bg-background p-1.5 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
          >
            {filteredOptions.length ? filteredOptions.map((option, index) => (
              <li
                id={`${listId}-${index}`}
                key={String(option.value)}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={!!option.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm',
                  option.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-primary/10',
                  index === activeIndex && !option.disabled && 'bg-primary/10'
                )}
              >
                {option.label}
              </li>
            )) : (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">No options available</li>
            )}
          </ul>
        )}
      </div>
    );
  }

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