import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LifeBuoy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import FormSelect from '@/components/FormSelect';

const inputClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

const CATEGORIES = [
  { value: 'reservation', label: 'Reservation problem' },
  { value: 'bug', label: 'Website error / something is not working' },
  { value: 'account', label: 'Account or login' },
  { value: 'lab_equipment', label: 'Laboratory or equipment concern' },
  { value: 'other', label: 'Other' },
];

const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

const STATUS_STYLE = {
  open: 'bg-warning/15 text-warning',
  in_progress: 'bg-primary/10 text-primary',
  resolved: 'bg-success/15 text-success',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

const UserReportProblem = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [reports, setReports] = useState([]);

  const loadReports = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('problem_reports')
      .select('id, category, subject, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setReports(data || []);
  }, [user?.id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!category) return setError('Please select what kind of problem you are reporting.');
    if (!subject.trim()) return setError('Please enter a short title for the problem.');
    if (description.trim().length < 10) return setError('Please describe the problem in a bit more detail (at least 10 characters).');

    setLoading(true);
    const { error: err } = await supabase.from('problem_reports').insert({
      user_id: user.id,
      reporter_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      email: user.email,
      category,
      subject: subject.trim(),
      description: description.trim(),
    });
    setLoading(false);

    if (err) {
      setError(err.message || 'Failed to send your report. Please try again.');
      return;
    }
    setSuccess(true);
    setCategory('');
    setSubject('');
    setDescription('');
    loadReports();
  };

  if (success) {
    return (
      <div className="max-w-[600px] mx-auto">
        <div className="bg-card rounded-2xl shadow-lg p-12 text-center animate-fade-up">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="font-heading text-3xl text-primary mb-3">Report sent</h2>
          <p className="text-muted-foreground mb-6">Thank you. We received your report and will look into it.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setSuccess(false)}
              className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all"
            >
              Report Another Problem
            </button>
            <Link
              to="/user/help"
              className="bg-transparent text-muted-foreground border-2 border-border px-6 py-3 rounded-xl font-semibold no-underline hover:border-primary hover:text-primary transition-colors"
            >
              Back to Help
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto space-y-6">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">Report a Problem</h1>
        <p className="text-muted-foreground">Tell us what went wrong and we will look into it.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg p-8 space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block mb-2 font-semibold text-foreground text-sm">
            What is the problem about? <span className="text-destructive">*</span>
          </label>
          <FormSelect
            value={category}
            onChange={setCategory}
            placeholder="Select a category…"
            className={inputClass}
            options={CATEGORIES}
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-foreground text-sm">
            Short title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="e.g. Can't submit my equipment reservation"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-foreground text-sm">
            Describe the problem <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="What were you trying to do, and what happened instead? Include any error message you saw."
            className={`${inputClass} resize-y`}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/2000</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/user/help" className="text-sm text-primary font-semibold no-underline inline-flex items-center gap-1.5 hover:underline">
            <LifeBuoy className="w-4 h-4" /> Check Help &amp; Support first
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-base border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Report'}
          </button>
        </div>
      </form>

      {reports.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-primary">Your recent reports</h2>
          </div>
          <ul className="list-none m-0 p-0">
            {reports.map((r) => (
              <li key={r.id} className="px-6 py-3 border-b border-border last:border-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(r.category)} · {new Date(r.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[r.status] || 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserReportProblem;