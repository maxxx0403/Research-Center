import { reservations, laboratories } from '@/data/mockData';

const Reports = () => {
  const completed = reservations.filter((r) => r.status === 'completed').length;
  const cancelled = reservations.filter((r) => r.status === 'cancelled').length;
  const active = reservations.filter((r) => ['reserved', 'in_use'].includes(r.status)).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {[
        { label: 'Total Reservations', value: reservations.length, color: 'text-primary' },
        { label: 'Completed', value: completed, color: 'text-success' },
        { label: 'Active', value: active, color: 'text-warning' },
        { label: 'Cancelled', value: cancelled, color: 'text-destructive' }].
        map((s) =>
        <div key={s.label} className="bg-card rounded-xl p-5 shadow-card text-center">
            <div className={`font-heading text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        )}
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-heading text-sm font-bold">Reservations by Laboratory</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-muted/50 border-b-2 border-border"><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Laboratory</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Total</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Completed</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Active</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Cancelled</th></tr></thead>
            <tbody>{laboratories.map((l) => {
                const labRes = reservations.filter((r) => r.laboratory_id === l.id);
                return (
                  <tr key={l.id} className="border-b border-muted hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{l.lab_name}</td>
                  <td className="px-4 py-3">{labRes.length}</td>
                  <td className="px-4 py-3 text-success font-semibold">{labRes.filter((r) => r.status === 'completed').length}</td>
                  <td className="px-4 py-3 text-warning font-semibold">{labRes.filter((r) => ['reserved', 'in_use'].includes(r.status)).length}</td>
                  <td className="px-4 py-3 text-destructive font-semibold">{labRes.filter((r) => r.status === 'cancelled').length}</td>
                </tr>);

              })}</tbody>
          </table>
        </div>
      </div>
    </div>);

};

export default Reports;