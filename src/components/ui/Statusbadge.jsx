import { getStatusColor } from '@/data/mockData';






const colorMap = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground'
};

const StatusBadge = ({ status, className = '' }) => {
  const safeStatus = status || 'unknown';
  const color = getStatusColor(safeStatus);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[color] || colorMap.muted} ${className}`}>
      {safeStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </span>);

};

export default StatusBadge;