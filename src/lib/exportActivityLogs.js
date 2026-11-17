import { APP_TIMEZONE } from '@/lib/timezone';
import { downloadExcelReport, excelFileName, reportInfo } from '@/lib/exportReservations';

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

const actionLabel = (action) =>
  (action || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Downloads the activity logs as a print-ready Excel file:
 * title, dates covered, date generated, a count per action, then every log.
 */
export const downloadActivityLogsExcel = async (logs, month) => {
  const counts = new Map();
  logs.forEach((log) => {
    const key = actionLabel(log.action) || 'Other';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const summary = [
    ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value })),
    { label: 'Total', value: logs.length, bold: true },
  ];

  await downloadExcelReport({
    fileName: excelFileName('activity-logs', month),
    sheets: [{
      name: 'Activity Logs',
      title: 'Activity Logs Report',
      info: reportInfo({ month, extra: [['Total Activities', logs.length]] }),
      summaryTitle: 'Activity Summary',
      summary,
      columns: [
        { header: 'Time (PH)', key: 'time', width: 24 },
        { header: 'User', key: 'actor', width: 28 },
        { header: 'Role', key: 'role', width: 12 },
        { header: 'Action', key: 'action', width: 28 },
        { header: 'Description', key: 'description', width: 80 },
        { header: 'Floor', key: 'floor', width: 18 },
      ],
      rows: logs.map((log) => ({
        time: formatTimestamp(log.created_at),
        actor: log.actor || '',
        role: actionLabel(log.actor_role),
        action: actionLabel(log.action),
        description: log.description || '',
        floor: log.floor || '',
      })),
      emptyText: 'No activity found.',
    }],
  });
};