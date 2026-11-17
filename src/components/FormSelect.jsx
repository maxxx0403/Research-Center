import { Fragment, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Upload, X, Users, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseClassList } from '@/lib/validation';
import { RETURN_CONDITIONS } from '@/lib/reservationUtils';

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
  // option.keywords: extra words that also match the search box (e.g. the category).
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.keywords || ''}`.toLowerCase().includes(query.trim().toLowerCase())
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
              <Fragment key={String(option.value)}>
              {/* option.group: shows a small heading whenever the group changes */}
              {option.group && option.group !== filteredOptions[index - 1]?.group && (
                <li role="presentation" className="sticky top-0 z-10 bg-background px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {option.group}
                </li>
              )}
              <li
                id={`${listId}-${index}`}
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
              </Fragment>
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

// ---------------------------------------------------------------------------
// Section list for the reservation forms: a whole section (class) can be
// submitted as one list instead of adding each student with "Add Member".
// sections: [{ name, text }]   onChange: (nextSections) => void
// ---------------------------------------------------------------------------

// Turns an uploaded Excel (.xlsx) / CSV / text file into lines of text.
const readClassListFile = async (file) => {
  if (/\.xlsx$/i.test(file.name)) {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const lines = [];
    workbook.worksheets[0]?.eachRow((row) => {
      const cells = [];
      row.eachCell((cell) => cells.push(String(cell.text ?? '').trim()));
      lines.push(cells.filter(Boolean).join('\t'));
    });
    return lines.join('\n');
  }
  return file.text();
};

export const SectionListInput = ({ sections, onChange }) => {
  const [fileError, setFileError] = useState('');
  const update = (idx, patch) => onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const remove = (idx) => onChange(sections.filter((_, i) => i !== idx));

  const onFile = async (idx, file) => {
    setFileError('');
    if (!file) return;
    if (!/\.(xlsx|csv|txt)$/i.test(file.name)) {
      setFileError('Please upload an Excel (.xlsx), CSV (.csv) or text (.txt) file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError('The file is too big (2 MB max).');
      return;
    }
    try {
      const text = await readClassListFile(file);
      update(idx, { text: [sections[idx].text, text].filter((t) => t && t.trim()).join('\n') });
    } catch (err) {
      console.error('Could not read class list:', err);
      setFileError('Could not read that file. You can copy the names and paste them instead.');
    }
  };

  if (!sections.length) return null;

  return (
    <div className="space-y-3 mt-3">
      {sections.map((section, idx) => {
        const students = parseClassList(section.text);
        return (
          <div key={idx} className="rounded-xl border-2 !border-[color:var(--field-border)] bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-primary uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Section List #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Remove section list"
                className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-foreground">
                Section <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={section.name}
                maxLength={60}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="e.g. BSIT 3-1"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="text-xs font-semibold text-foreground">
                  Class List <span className="text-destructive">*</span>
                </label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.csv,.txt"
                    className="hidden"
                    onChange={(e) => { onFile(idx, e.target.files?.[0]); e.target.value = ''; }}
                  />
                </label>
              </div>
              <textarea
                value={section.text}
                onChange={(e) => update(idx, { text: e.target.value })}
                rows={5}
                placeholder={'Paste the class list here, one student per line:\nSantos, Maria A.    202302604\nDela Cruz, Juan    202301234'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {students.length
                  ? <><strong className="text-foreground">{students.length}</strong> student{students.length === 1 ? '' : 's'} found. The request form will show only the section{section.name.trim() ? <> (<strong className="text-foreground">{section.name.trim()}</strong>)</> : ''}, not every name.</>
                  : 'You can copy the names and student numbers from Excel and paste them here, or upload the file.'}
              </p>
            </div>
          </div>
        );
      })}
      {fileError && <p className="text-xs text-destructive">{fileError}</p>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// "Mark as returned" pop-up for admin/staff: condition of the equipment + notes.
// rows: the equipment_reservations being returned. onConfirm({ condition, notes })
// ---------------------------------------------------------------------------
export const ReturnEquipmentDialog = ({ rows, onCancel, onConfirm, busy }) => {
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const needsNotes = condition !== 'good';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (!rows?.length) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" onClick={() => !busy && onCancel()} role="dialog" aria-modal="true" aria-label="Mark as returned">
      <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-base font-bold flex items-center gap-2"><PackageCheck className="w-5 h-5 text-primary" /> Mark as returned</h2>
          <p className="text-xs text-muted-foreground mt-1">Check the equipment before receiving it back.</p>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm">
          <ul className="space-y-1 list-none p-0 m-0">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-xs">
                <span className="font-semibold">{r.equipment?.name || `#${r.id}`}</span>
                <span className="text-muted-foreground">Qty {r.quantity_reserved}</span>
              </li>
            ))}
          </ul>
          <fieldset className="space-y-2 border-0 p-0 m-0">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Condition</legend>
            {RETURN_CONDITIONS.map((c) => (
              <label key={c.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 cursor-pointer ${condition === c.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="return_condition" value={c.value} checked={condition === c.value} onChange={() => setCondition(c.value)} className="accent-[hsl(var(--primary))]" />
                <span className="font-semibold">{c.label}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Notes {needsNotes ? <span className="text-destructive">*</span> : <span className="normal-case font-normal">(optional)</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={needsNotes ? 'What is damaged or missing?' : 'e.g. Returned with case and charger'}
              className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground border border-border cursor-pointer hover:bg-border disabled:opacity-50">Cancel</button>
          <button
            type="button"
            disabled={busy || (needsNotes && !notes.trim())}
            onClick={() => onConfirm({ condition, notes })}
            className="px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground border-none cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FormSelect;