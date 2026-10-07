import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FlaskConical, Package, CalendarCheck, FileText } from 'lucide-react';

const quickLinks = [
  { to: '/user/reserve', icon: FlaskConical, label: 'Reserve Lab' },
  { to: '/user/reserve-equipment', icon: Package, label: 'Reserve Equipment' },
  { to: '/user/reservations', icon: CalendarCheck, label: 'My Reservations' },
  { to: '/user/forms', icon: FileText, label: 'Forms and Papers' },
];

const faqs = [
  {
    q: 'How do I reserve a laboratory?',
    a: 'Go to Reserve Lab, fill in your details, choose the laboratory (you can add more than one), set the start and end schedule, add any equipment you need, then write your purpose and submit. Your request will be marked Pending until it is approved.',
  },
  {
    q: 'How do I reserve equipment only?',
    a: 'Use Reserve Equipment. Pick the equipment and quantity, set the schedule, and submit. You can add several equipment in one request.',
  },
  {
    q: 'How far in advance do I need to book?',
    a: 'Reservations must be made at least 1 week (7 days) in advance. You cannot book for today, this week, or past dates.',
  },
  {
    q: 'What are the operating hours?',
    a: 'Reservations are available from 7:00 AM to 6:00 PM, Monday to Saturday. The Research Center is closed on Sundays.',
  },
  {
    q: 'What do the reservation statuses mean?',
    a: 'Pending means your request is waiting for approval. Reserved means it was approved. In Use means the reservation is ongoing, and Completed means it is done. Rejected means it was not approved, and Cancelled means it was cancelled.',
  },
  {
    q: 'Can I edit or cancel my reservation?',
    a: 'Open My Reservations and click the three dots (⋮) on the reservation. You can edit it while it is Pending or Rejected (Edit & Resubmit), and cancel it while it is Pending or Reserved.',
  },
  {
    q: 'Why was my request rejected?',
    a: 'The reason is shown under the status in My Reservations. If you need more details, use Ask why in the three dots menu to message the Research Center.',
  },
  {
    q: 'How do I download my reservation form?',
    a: 'Once a reservation is approved, open the three dots (⋮) in My Reservations and choose Download Form.',
  },
  {
    q: 'Where can I find the forms and papers?',
    a: 'Go to Forms and Papers. You can download the forms you need there and submit your papers.',
  },
  {
    q: 'Can I change my name or password?',
    a: 'Your full name comes from your account and cannot be changed. You can change your password anytime in Settings. If you forgot your password, use the password reset option on the login page.',
  },
];

const UserHelp = () => {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">Help &amp; Support</h1>
        <p className="text-muted-foreground">Answers to common questions about reserving laboratories and equipment.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="bg-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center no-underline text-foreground text-sm font-semibold hover:-translate-y-0.5 transition-transform"
          >
            <l.icon className="w-5 h-5 text-primary" />
            {l.label}
          </Link>
        ))}
      </div>

      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-primary">Frequently Asked Questions</h2>
        </div>
        <div>
          {faqs.map((f, idx) => {
            const open = openIdx === idx;
            return (
              <div key={f.q} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? -1 : idx)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left bg-transparent border-none cursor-pointer text-sm font-semibold text-foreground"
                >
                  {f.q}
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <p className="px-6 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h3 className="font-heading text-base font-bold text-foreground">Still need help?</h3>
          <p className="text-sm text-muted-foreground">If something is not working, send us a report and we will look into it.</p>
        </div>
        <Link
          to="/user/report-problem"
          className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm no-underline inline-flex items-center hover:-translate-y-0.5 transition-all flex-shrink-0"
        >
          Report a Problem
        </Link>
      </div>
    </div>
  );
};

export default UserHelp;