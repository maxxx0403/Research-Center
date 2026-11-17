// Excel exports and print-ready pages for the whole system.
//  - downloadExcelReport / printReport: shared builders. Every Excel file and every
//    printed page has a title, the dates covered, when it was generated, and a
//    status summary, followed by the full table (all details).
//  - downloadReservationsExcel / printReservations: the Reservations lists
//    (one tab at a time: laboratory reservations or equipment reservations).
import { APP_TIMEZONE } from '@/lib/timezone';
import { monthLabel } from '@/lib/monthRange';
import { STAKEHOLDER_OPTIONS, stakeholderGroupLabel } from '@/lib/stakeholder';

const fmtManila = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

const statusLabel = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const membersText = (list) =>
  Array.isArray(list) && list.length ? list.join(', ') : '';

const stakeholderLabel = (type) => STAKEHOLDER_OPTIONS.find((o) => o.value === type)?.label || type || '';

const refOf = (prefix, id) => `${prefix}${String(id).padStart(5, '0')}`;

const equipmentText = (list) =>
  (list || [])
    .map((re) => {
      const e = re.equipment;
      const name = [e?.name, e?.brand, e?.model].filter(Boolean).join(' ');
      return name ? `${name} x${re.quantity_reserved ?? 1}` : '';
    })
    .filter(Boolean)
    .join('; ');

// ---- Rows (one flat object per reservation) --------------------------------------------------

const labRow = (r) => ({
  ref: refOf('RC', r.id),
  batch_id: r.batch_id || '',
  researcher_name: r.researcher_name || '',
  email: r.email || '',
  phone: r.phone || '',
  unit_college: r.unit_college || '',
  adviser_name: r.adviser_name || '',
  study_title: r.study_title || '',
  stakeholder: stakeholderLabel(r.stakeholder_type),
  lab_name: r.laboratories?.lab_name || '',
  lab_code: r.laboratories?.lab_code || '',
  floor: r.laboratories?.floor ?? '',
  start: fmtManila(r.start_datetime),
  end: fmtManila(r.end_datetime),
  status: statusLabel(r.status),
  approved_at: fmtManila(r.approved_at),
  rejection_reason: r.rejection_reason || '',
  members: membersText(r.members_list),
  equipment: equipmentText(r.reservation_equipment),
});

const eqRow = (r) => ({
  ref: refOf('EQ', r.id),
  batch_id: r.batch_id || '',
  researcher_name: r.researcher_name || '',
  email: r.email || '',
  stakeholder: stakeholderLabel(r.stakeholder_type),
  equipment: r.equipment?.name || '',
  brand: r.equipment?.brand || '',
  model: r.equipment?.model || '',
  lab_code: r.equipment?.laboratories?.lab_code || '',
  floor: r.equipment?.laboratories?.floor ?? '',
  quantity: r.quantity_reserved ?? '',
  purpose: r.purpose || '',
  start: fmtManila(r.start_datetime),
  end: fmtManila(r.end_datetime),
  status: statusLabel(r.status),
  rejection_reason: r.rejection_reason || '',
  members: membersText(r.members_list),
  created_at: fmtManila(r.created_at),
});

// ---- Columns ---------------------------------------------------------------------------------
// Every column goes into both the Excel file and the printed page.

const LAB_COLUMNS = [
  { header: 'Reservation No.', key: 'ref' },
  { header: 'Batch ID', key: 'batch_id' },
  { header: 'Researcher', key: 'researcher_name' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
  { header: 'Unit / College', key: 'unit_college' },
  { header: 'Adviser / Sections', key: 'adviser_name' },
  { header: 'Study Title', key: 'study_title' },
  { header: 'Stakeholder Type', key: 'stakeholder' },
  { header: 'Laboratory', key: 'lab_name' },
  { header: 'Lab Code', key: 'lab_code' },
  { header: 'Floor', key: 'floor' },
  { header: 'Start (PH Time)', key: 'start' },
  { header: 'End (PH Time)', key: 'end' },
  { header: 'Status', key: 'status' },
  { header: 'Approved At (PH Time)', key: 'approved_at' },
  { header: 'Rejection Reason', key: 'rejection_reason' },
  { header: 'Members', key: 'members' },
  { header: 'Equipment Reserved', key: 'equipment' },
];

const EQ_COLUMNS = [
  { header: 'Request No.', key: 'ref' },
  { header: 'Batch ID', key: 'batch_id' },
  { header: 'Researcher', key: 'researcher_name' },
  { header: 'Email', key: 'email' },
  { header: 'Stakeholder Type', key: 'stakeholder' },
  { header: 'Equipment', key: 'equipment' },
  { header: 'Brand', key: 'brand' },
  { header: 'Model', key: 'model' },
  { header: 'Lab Code', key: 'lab_code' },
  { header: 'Floor', key: 'floor' },
  { header: 'Quantity', key: 'quantity' },
  { header: 'Purpose', key: 'purpose' },
  { header: 'Start (PH Time)', key: 'start' },
  { header: 'End (PH Time)', key: 'end' },
  { header: 'Status', key: 'status' },
  { header: 'Rejection Reason', key: 'rejection_reason' },
  { header: 'Members', key: 'members' },
  { header: 'Submitted At (PH Time)', key: 'created_at' },
];

// Every reservation status, in the order they happen.
export const RESERVATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'reserved', label: 'Reserved (Approved)' },
  { value: 'in_use', label: 'In Use' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

// [{ label, value }] count per status (every status listed, even when 0) + total.
const statusSummaryOf = (items) => {
  const counts = new Map(RESERVATION_STATUSES.map((st) => [st.value, 0]));
  let other = 0;
  items.forEach((it) => {
    if (counts.has(it.status)) counts.set(it.status, counts.get(it.status) + 1);
    else other += 1;
  });
  return [
    ...RESERVATION_STATUSES.map((st) => ({ label: st.label, value: counts.get(st.value) })),
    ...(other ? [{ label: 'Other', value: other }] : []),
    { label: 'Total', value: items.length, bold: true },
  ];
};

const bySchedule = (a, b) => new Date(a.start_datetime || 0) - new Date(b.start_datetime || 0);

// Picks the columns, rows and titles for the tab being exported.
const prepare = (labItems, eqItems, type) => {
  const isLab = type === 'lab';
  const items = isLab ? labItems : eqItems;
  return {
    isLab,
    title: isLab ? 'Laboratory Reservations Report' : 'Equipment Reservations Report',
    fileBase: isLab ? 'laboratory-reservations' : 'equipment-reservations',
    columns: isLab ? LAB_COLUMNS : EQ_COLUMNS,
    rows: [...items].sort(bySchedule).map(isLab ? labRow : eqRow),
    summary: statusSummaryOf(items),
  };
};

// ---- Shared: dates and info lines -----------------------------------------------------------

// "November 17, 2026, 4:50 PM" (PH time) - used as the generated date on every file.
export const generatedOnText = () =>
  new Intl.DateTimeFormat('en-PH', { timeZone: APP_TIMEZONE, dateStyle: 'long', timeStyle: 'short' }).format(new Date());

const todayStamp = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/**
 * Standard info lines under the title: dates covered, stakeholder (if any), generated on.
 * @param {object} p { month: "" | "YYYY-MM" | range, stakeholder?, extra?: [[label, value]] }
 */
export const reportInfo = ({ month, stakeholder, extra = [] } = {}) => [
  ['Date Covered', monthLabel(month || '')],
  ...(stakeholder ? [['Stakeholder', stakeholderGroupLabel(stakeholder)]] : []),
  ...extra,
  ['Date Generated', `${generatedOnText()} (PH Time)`],
];

const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ---- Shared: Excel ---------------------------------------------------------------------------

const GREEN = 'FF166534';
const LIGHT_GREEN = 'FFDCFCE7';
const thinBorder = { style: 'thin', color: { argb: 'FF9CA3AF' } };
const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

const widthFor = (column, rows) => {
  if (column.width) return column.width;
  const longest = Math.max(
    String(column.header).length,
    ...rows.map((r) => String(r[column.key] ?? '').length),
  );
  return Math.min(Math.max(longest + 2, 10), 50);
};

/**
 * Downloads a print-ready Excel file. Each sheet starts with:
 *   Title / info lines (Date Covered, Date Generated, ...) / Status Summary / full table.
 * @param {object} p
 *  - fileName: "something.xlsx"
 *  - sheets: [{ name, title, info: [[label, value]], summary?: [{ label, value, bold? }],
 *               summaryTitle?, columns: [{ header, key, width? }], rows: [{...}], emptyText? }]
 */
export const downloadExcelReport = async ({ fileName, sheets }) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Reservation System';
  workbook.created = new Date();

  sheets.forEach((def) => {
    const { columns, rows = [] } = def;
    const colCount = Math.max(columns.length, 2);
    const sheet = workbook.addWorksheet(String(def.name || 'Report').slice(0, 31));
    sheet.columns = columns.map((c) => ({ key: c.key, width: widthFor(c, rows) }));

    // Title
    const titleRow = sheet.addRow([def.title]);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, colCount);
    titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: GREEN } };
    titleRow.height = 26;
    titleRow.alignment = { vertical: 'middle' };

    // Info lines (Date Covered, Date Generated, ...)
    (def.info || []).forEach(([label, value]) => {
      const row = sheet.addRow([`${label}:`, String(value ?? '')]);
      row.getCell(1).font = { name: 'Arial', size: 10, bold: true };
      row.getCell(2).font = { name: 'Arial', size: 10 };
      row.getCell(2).alignment = { horizontal: 'left' };
      if (colCount > 2) sheet.mergeCells(row.number, 2, row.number, colCount);
    });

    // Status summary
    if (def.summary?.length) {
      sheet.addRow([]);
      const head = sheet.addRow([def.summaryTitle || 'Status Summary', 'Count']);
      [1, 2].forEach((n) => {
        const cell = head.getCell(n);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        cell.border = allBorders;
      });
      def.summary.forEach((item) => {
        const row = sheet.addRow([item.label, item.value]);
        [1, 2].forEach((n) => {
          const cell = row.getCell(n);
          cell.font = { name: 'Arial', size: 10, bold: !!item.bold };
          cell.border = allBorders;
          if (item.bold) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
        });
        row.getCell(2).alignment = { horizontal: 'right' };
      });
    }

    // Table
    sheet.addRow([]);
    const header = sheet.addRow(columns.map((c) => c.header));
    header.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = allBorders;
    });
    header.height = 22;
    const headerRowNumber = header.number;

    if (rows.length) {
      rows.forEach((r) => {
        const row = sheet.addRow(columns.map((c) => r[c.key] ?? ''));
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.border = allBorders;
        });
      });
      sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: columns.length } };
    } else {
      const row = sheet.addRow([def.emptyText || 'No records found.']);
      sheet.mergeCells(row.number, 1, row.number, colCount);
      row.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    }

    // Ready to print: landscape, fit all columns on one page width, header repeats on every page.
    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    sheet.headerFooter = {
      oddFooter: `&L${def.title}&RPage &P of &N`,
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName,
  );
};

// File name helper: "equipment-report_all-dates_2026-11-17.xlsx"
export const excelFileName = (base, month, stakeholder) =>
  `${base}_${month || 'all-dates'}${stakeholder && stakeholder !== 'all' ? `_${stakeholder}` : ''}_${todayStamp()}.xlsx`;

// ---- Shared: Print ---------------------------------------------------------------------------

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 8px; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 4px; color: #166534; }
  h2 { font-size: 11px; margin: 14px 0 6px; }
  .meta { font-size: 10px; color: #333; margin: 0 0 10px; line-height: 1.6; }
  .summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
  .summary div { border: 1px solid #999; border-radius: 4px; padding: 4px 8px; font-size: 9px; }
  .summary b { font-size: 11px; margin-left: 4px; }
  .summary .total { background: #dcfce7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
  th { background: #166534; color: #fff; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .empty { padding: 20px; text-align: center; color: #555; }
  .section + .section { page-break-before: always; }
`;

const sectionHtml = (def) => {
  const head = def.columns.map((c) => `<th>${esc(c.header)}</th>`).join('');
  const body = def.rows?.length
    ? def.rows.map((r) => `<tr>${def.columns.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${def.columns.length}">${esc(def.emptyText || 'No records found.')}</td></tr>`;
  const info = (def.info || []).map(([label, value]) => `${esc(label)}: <strong>${esc(value)}</strong>`).join('<br>');
  const summary = def.summary?.length
    ? `<h2>${esc(def.summaryTitle || 'Status Summary')}</h2><div class="summary">${def.summary
      .map((s) => `<div class="${s.bold ? 'total' : ''}">${esc(s.label)}<b>${esc(s.value)}</b></div>`)
      .join('')}</div>`
    : '';
  return `<div class="section">
  <h1>${esc(def.title)}</h1>
  <p class="meta">${info}</p>
  ${summary}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</div>`;
};

/**
 * Opens the browser's print dialog (choose "Save as PDF" there for a PDF) with the
 * same parts as the Excel file: title, info lines, status summary and the full table.
 * Takes the same `sheets` list as downloadExcelReport; each one starts on a new page.
 * Uses a hidden frame, so no pop-up is needed.
 */
export const printReport = ({ title, sheets }) => {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title || sheets[0]?.title || 'Report')}</title><style>${PRINT_CSS}</style></head>
<body>${sheets.map(sectionHtml).join('')}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  win.document.open();
  win.document.write(html);
  win.document.close();

  const cleanup = () => iframe.remove();
  win.onafterprint = () => setTimeout(cleanup, 300);
  // give the frame a moment to lay out, then open the print dialog
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60000); // fallback if the browser never fires afterprint
  }, 250);
};

// ---- Reservations ----------------------------------------------------------------------------

const reservationSheet = (labItems, eqItems, opts) => {
  const { columns, rows, title, summary } = prepare(labItems, eqItems, opts.type);
  return {
    name: opts.type === 'lab' ? 'Laboratory Reservations' : 'Equipment Reservations',
    title,
    info: reportInfo({ month: opts.month, stakeholder: opts.stakeholder || 'all', extra: [['Total Reservations', rows.length]] }),
    summary,
    columns,
    rows,
    emptyText: 'No reservations found.',
  };
};

/**
 * Downloads the reservations of one tab as a print-ready Excel file
 * (title, dates, status summary, then every detail column).
 * @param {object} opts { type: 'lab' | 'equipment', month, stakeholder: 'all' | 'cvsu' | 'non_cvsu' }
 */
export const downloadReservationsExcel = (labItems = [], eqItems = [], opts = {}) => {
  const { fileBase } = prepare([], [], opts.type);
  return downloadExcelReport({
    fileName: excelFileName(fileBase, opts.month, opts.stakeholder),
    sheets: [reservationSheet(labItems, eqItems, opts)],
  });
};

/** Print / Save as PDF: same content as the Excel file (all details). */
export const printReservations = (labItems = [], eqItems = [], opts = {}) => {
  const sheet = reservationSheet(labItems, eqItems, opts);
  printReport({ title: sheet.title, sheets: [sheet] });
};