import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Package, Users, Download, Printer, Search, GraduationCap, Briefcase, Building2, Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadExcelReport, excelFileName, printReport, reportInfo } from '@/lib/exportReservations';
import { ACCOUNT_TYPES, accountTypeOf, isCvsuAccount } from '@/lib/stakeholder';
import { isInMonth, shortDateManila } from '@/lib/monthRange';
import LaboratoryReport, { FacilitiesReport } from '@/components/LaboratoryReport';
import EquipmentReport, { EquipmentIssuesReport } from '@/components/EquipmentReport';
import { ReportDateFilter } from '@/components/MonthFilter';
import { STAKEHOLDER_GROUPS, stakeholderGroupLabel } from '@/lib/stakeholder';

// ---------------------------------------------------------------------------
// User Accounts report: how many registered with a CvSU account vs Non-CvSU.
// ---------------------------------------------------------------------------
// Account type helpers live in lib/stakeholder.js (shared with the dashboard charts).

const UserAccountsReport = ({ month, stakeholder }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc('get_user_account_report').then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        console.error('User account report failed:', rpcError);
        setError(/get_user_account_report/i.test(rpcError.message || '')
          ? 'The database is missing the get_user_account_report function. Please run the migration 20261117050000_user_report_low_stock.sql.'
          : 'Could not load the user accounts.');
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Registered in the chosen period + stakeholder filter
  const inScope = useMemo(() => users.filter((u) => isInMonth(u.created_at, month)
    && (stakeholder === 'all' || (stakeholder === 'cvsu' ? isCvsuAccount(u) : !isCvsuAccount(u)))), [users, month, stakeholder]);

  const counts = useMemo(() => {
    const c = { total: inScope.length, cvsu: 0, student: 0, faculty_staff: 0, non_cvsu: 0 };
    inScope.forEach((u) => {
      const t = accountTypeOf(u);
      c[t] += 1;
      if (t !== 'non_cvsu') c.cvsu += 1;
    });
    return c;
  }, [inScope]);

  const byUnit = useMemo(() => {
    const map = new Map();
    inScope.forEach((u) => {
      const unit = u.unit_college?.trim() || '(not given)';
      const key = `${isCvsuAccount(u) ? 'CvSU' : 'Non-CvSU'}|${unit}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .map(([key, count]) => { const [group, unit] = key.split('|'); return { group, unit, count }; })
      .sort((a, b) => b.count - a.count || a.unit.localeCompare(b.unit));
  }, [inScope]);

  const term = search.trim().toLowerCase();
  const rows = inScope.filter((u) => !term || [u.full_name, u.email, u.unit_college, ACCOUNT_TYPES[accountTypeOf(u)]]
    .some((v) => String(v || '').toLowerCase().includes(term)));

  const cards = [
    { label: 'Total Accounts', value: counts.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'CvSU Accounts', value: counts.cvsu, icon: GraduationCap, color: 'text-success', bg: 'bg-success/10', sub: `${counts.student} students · ${counts.faculty_staff} instructors` },
    { label: 'Non-CvSU Accounts', value: counts.non_cvsu, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'CvSU Instructors', value: counts.faculty_staff, icon: Briefcase, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  const buildSheets = () => [
    {
      name: 'User Accounts',
      title: 'User Accounts Report',
      info: reportInfo({ month, stakeholder, extra: [['Based On', 'Date of registration']] }),
      summaryTitle: 'Account Summary',
      summary: [
        { label: 'CvSU Accounts', value: counts.cvsu },
        { label: '   CvSU Students', value: counts.student },
        { label: '   CvSU Instructors', value: counts.faculty_staff },
        { label: 'Non-CvSU Accounts', value: counts.non_cvsu },
        { label: 'Total Accounts', value: counts.total, bold: true },
      ],
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Account Type', key: 'type' },
        { header: 'College / School / Agency', key: 'unit' },
        { header: 'Registered', key: 'registered' },
        { header: 'Last Sign-in', key: 'lastSignIn' },
      ],
      rows: inScope.map((u) => ({
        name: u.full_name || '',
        email: u.email || '',
        type: ACCOUNT_TYPES[accountTypeOf(u)],
        unit: u.unit_college || '',
        registered: shortDateManila(u.created_at),
        lastSignIn: shortDateManila(u.last_sign_in_at),
      })),
      emptyText: 'No accounts were registered in this period.',
    },
    {
      name: 'By College or School',
      title: 'Accounts by College / School / Agency',
      info: reportInfo({ month, stakeholder }),
      columns: [
        { header: 'Group', key: 'group' },
        { header: 'College / School / Agency', key: 'unit' },
        { header: 'Accounts', key: 'count' },
      ],
      rows: byUnit,
      emptyText: 'No accounts.',
    },
  ];

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadExcelReport({ fileName: excelFileName('user-accounts-report', month, stakeholder), sheets: buildSheets() });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Could not export the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const th = 'px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  if (error) return <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}><c.icon className={`w-5 h-5 ${c.color}`} /></div>
            <div className="min-w-0">
              <div className={`font-heading text-2xl font-bold leading-tight ${c.color}`}>{loading ? '…' : c.value}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{c.label}</div>
              {c.sub && !loading && <div className="text-[10px] text-muted-foreground/80 leading-tight">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold">Registered Accounts ({rows.length})</h2>
          <div className="flex flex-wrap items-center gap-2 ml-auto justify-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, college…" className="pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary w-56" />
            </div>
            <button type="button" onClick={exportExcel} disabled={loading || exporting} className={btn}><Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
            <button type="button" onClick={() => printReport({ title: 'User Accounts Report', sheets: buildSheets() })} disabled={loading} className={btn}><Printer className="w-4 h-4" /> Print</button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b-2 border-border">
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Account Type</th>
                  <th className={th}>College / School</th>
                  <th className={th}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.user_id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isCvsuAccount(u) ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{ACCOUNT_TYPES[accountTypeOf(u)]}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{u.unit_college || '—'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{shortDateManila(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
import { currentMonthManila, monthLabel } from '@/lib/monthRange';

const Reports = () => {
  const [tab, setTab] = useState('lab');
  const [month, setMonth] = useState(''); // '' = all dates (default)
  const [stakeholder, setStakeholder] = useState('all'); // 'all' | 'cvsu' | 'non_cvsu'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
      <div className="flex gap-1">
        {[
          { key: 'lab', label: 'Laboratories', icon: FlaskConical },
          { key: 'equipment', label: 'Equipment', icon: Package },
          { key: 'monitoring', label: 'Monitoring', icon: Activity },
          { key: 'issues', label: 'Lost & Damaged', icon: AlertTriangle },
          { key: 'users', label: 'User Accounts', icon: Users },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-transparent border-t-0 border-x-0 border-b-2 -mb-px cursor-pointer transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
        <div className="pb-2 flex flex-wrap items-center gap-2 ml-auto justify-end">
          <select
            aria-label="Stakeholder filter"
            value={stakeholder}
            onChange={(e) => setStakeholder(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:border-primary"
          >
            {STAKEHOLDER_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <button
            type="button"
            aria-pressed={!month}
            onClick={() => setMonth('')}
            className={`px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${
              !month
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            All dates
          </button>
          <div className={month ? '' : 'opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity'}>
            <ReportDateFilter value={month || currentMonthManila()} onChange={setMonth} />
          </div>
        </div>
      </div>

      {tab === 'monitoring' ? (
      <p className="text-xs text-muted-foreground -mt-2">
        Live status of every laboratory right now. The date filter does not apply here.
      </p>
      ) : tab === 'issues' ? (
      <p className="text-xs text-muted-foreground -mt-2">
        Lost or damaged equipment is shown as it is now. The date filter ({month ? <span className="font-semibold text-foreground">{monthLabel(month)}</span> : <span className="font-semibold text-foreground">all dates</span>}) applies to equipment returned damaged or incomplete and to stock alerts.
      </p>
      ) : tab === 'users' ? (
      <p className="text-xs text-muted-foreground -mt-2">
        Accounts registered {month ? <>in <span className="font-semibold text-foreground">{monthLabel(month)}</span></> : <>on <span className="font-semibold text-foreground">all dates</span></>} (admin and staff accounts are not counted){stakeholder !== 'all' && <>, <span className="font-semibold text-foreground">{stakeholderGroupLabel(stakeholder)}</span> only</>}.
      </p>
      ) : (
      <p className="text-xs text-muted-foreground -mt-2">
        Showing only what was actually used (completed or in use) {month ? <>in <span className="font-semibold text-foreground">{monthLabel(month)}</span></> : <>across <span className="font-semibold text-foreground">all dates</span>, most recent first</>}. Exported files use the same dates{stakeholder !== 'all' && <> and show only <span className="font-semibold text-foreground">{stakeholderGroupLabel(stakeholder)}</span> stakeholders</>}.
      </p>
      )}

      {tab === 'lab' && <LaboratoryReport month={month} stakeholder={stakeholder} />}
      {tab === 'equipment' && <EquipmentReport month={month} stakeholder={stakeholder} />}
      {tab === 'monitoring' && (
        <FacilitiesReport />
      )}
      {tab === 'issues' && <EquipmentIssuesReport month={month} />}
      {tab === 'users' && <UserAccountsReport month={month} stakeholder={stakeholder} />}
    </div>
  );
};

export default Reports;