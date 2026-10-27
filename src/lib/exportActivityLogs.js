import { APP_TIMEZONE } from '@/lib/timezone';
import { monthLabel } from '@/lib/monthRange';

const formatTimestamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export const downloadActivityLogsExcel = async (logs, month) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Reservation System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Activity Logs', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Time (PH)', key: 'time', width: 24 },
    { header: 'User', key: 'actor', width: 28 },
    { header: 'Action', key: 'action', width: 32 },
    { header: 'Description', key: 'description', width: 80 },
    { header: 'Floor', key: 'floor', width: 18 },
  ];

  logs.forEach((log) => sheet.addRow({
    time: formatTimestamp(log.created_at),
    actor: log.actor || '',
    action: (log.action || '').replace(/_/g, ' '),
    description: log.description || '',
    floor: log.floor || '',
  }));

  const header = sheet.getRow(1);
  header.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity-logs-${month}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
