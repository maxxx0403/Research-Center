// Exports ALL laboratory and equipment reservations to a single .xlsx file
// (one sheet each) so the admin can keep an offline copy of the data.
// exceljs is loaded on demand so it doesn't bloat the main bundle.
import { APP_TIMEZONE } from '@/lib/timezone';

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

const LAB_COLUMNS = [
  { header: 'Reservation ID', key: 'id', width: 38 },
  { header: 'Batch ID', key: 'batch_id', width: 38 },
  { header: 'Researcher', key: 'researcher_name', width: 26 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Unit / College', key: 'unit_college', width: 24 },
  { header: 'Adviser', key: 'adviser_name', width: 24 },
  { header: 'Study Title', key: 'study_title', width: 40 },
  { header: 'Stakeholder Type', key: 'stakeholder_type', width: 18 },
  { header: 'Laboratory', key: 'lab_name', width: 28 },
  { header: 'Lab Code', key: 'lab_code', width: 12 },
  { header: 'Floor', key: 'floor', width: 10 },
  { header: 'Start (PH Time)', key: 'start', width: 22 },
  { header: 'End (PH Time)', key: 'end', width: 22 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Approved At (PH Time)', key: 'approved_at', width: 22 },
  { header: 'Rejection Reason', key: 'rejection_reason', width: 34 },
  { header: 'Members', key: 'members', width: 40 },
  { header: 'Equipment Reserved', key: 'equipment', width: 44 },
];

const EQ_COLUMNS = [
  { header: 'Reservation ID', key: 'id', width: 38 },
  { header: 'Batch ID', key: 'batch_id', width: 38 },
  { header: 'Researcher', key: 'researcher_name', width: 26 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Equipment', key: 'equipment', width: 30 },
  { header: 'Brand', key: 'brand', width: 18 },
  { header: 'Lab Code', key: 'lab_code', width: 12 },
  { header: 'Floor', key: 'floor', width: 10 },
  { header: 'Quantity', key: 'quantity', width: 10 },
  { header: 'Purpose', key: 'purpose', width: 40 },
  { header: 'Start (PH Time)', key: 'start', width: 22 },
  { header: 'End (PH Time)', key: 'end', width: 22 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Rejection Reason', key: 'rejection_reason', width: 34 },
  { header: 'Members', key: 'members', width: 40 },
  { header: 'Submitted At (PH Time)', key: 'created_at', width: 22 },
];

const labRow = (r) => ({
  id: r.id,
  batch_id: r.batch_id || '',
  researcher_name: r.researcher_name || '',
  email: r.email || '',
  phone: r.phone || '',
  unit_college: r.unit_college || '',
  adviser_name: r.adviser_name || '',
  study_title: r.study_title || '',
  stakeholder_type: r.stakeholder_type || '',
  lab_name: r.laboratories?.lab_name || '',
  lab_code: r.laboratories?.lab_code || '',
  floor: r.laboratories?.floor ?? '',
  start: fmtManila(r.start_datetime),
  end: fmtManila(r.end_datetime),
  status: statusLabel(r.status),
  approved_at: fmtManila(r.approved_at),
  rejection_reason: r.rejection_reason || '',
  members: membersText(r.members_list),
  equipment: (r.reservation_equipment || [])
    .map((re) => {
      const e = re.equipment;
      const name = [e?.name, e?.brand, e?.model].filter(Boolean).join(' ');
      return name ? `${name} x${re.quantity_reserved ?? 1}` : '';
    })
    .filter(Boolean)
    .join('; '),
});

const eqRow = (r) => ({
  id: r.id,
  batch_id: r.batch_id || '',
  researcher_name: r.researcher_name || '',
  email: r.email || '',
  equipment: r.equipment?.name || '',
  brand: r.equipment?.brand || '',
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

const addSheet = (wb, name, columns, rows) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  rows.forEach((r) => ws.addRow(r));

  const header = ws.getRow(1);
  header.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;

  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
  });

  if (columns.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  return ws;
};

/**
 * Builds the workbook and returns it as a Blob.
 * @param {Array} labItems  rows from `reservations` (with laboratories + reservation_equipment joins)
 * @param {Array} eqItems   rows from `equipment_reservations` (with equipment + laboratories joins)
 */
export const buildReservationsWorkbook = async (labItems = [], eqItems = []) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reservation System';
  wb.created = new Date();

  addSheet(wb, 'Laboratory Reservations', LAB_COLUMNS, labItems.map(labRow));
  addSheet(wb, 'Equipment Reservations', EQ_COLUMNS, eqItems.map(eqRow));

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

/** Builds the workbook and triggers a browser download. */
export const downloadReservationsExcel = async (labItems, eqItems) => {
  const blob = await buildReservationsWorkbook(labItems, eqItems);
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservations-backup-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
