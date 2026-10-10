import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { acceptPrivacy, hasAcceptedPrivacy } from '@/lib/privacyConsent';

// ── Fill these in with the Research Center's real details ─────────────────────
const ORG_NAME = 'Cavite State University – Research Center';
const SYSTEM_NAME = 'Laboratory Reservation and Equipment Inventory Management System';
const CONTACT_OFFICE = 'Research Center Office, Cavite State University, Don Severino delas Alas Campus, Indang, Cavite';
const CONTACT_EMAIL = ''; // e.g. 'researchcenter@cvsu.edu.ph'. Leave empty to hide the email line.
const LAST_UPDATED = 'October 10, 2026';
// ──────────────────────────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="font-heading text-lg font-bold text-primary">{title}</h2>
    {children}
  </section>
);

const P = ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;

const UL = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const alreadyAccepted = hasAcceptedPrivacy();

  const handleAgree = () => {
    acceptPrivacy();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold no-underline hover:underline mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-10 space-y-8">
          <header className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="font-heading text-3xl font-bold text-foreground">Privacy Policy</h1>
            </div>
            <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </header>

          <Section title="1. About this policy">
            <P>
              This Privacy Policy explains how {ORG_NAME} (“we”, “us”, “our”) collects, uses, protects, and shares
              your personal data when you use the {SYSTEM_NAME} (the “Website”). We follow the Data Privacy Act of 2012
              (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National
              Privacy Commission (NPC). By using the Website, you acknowledge that you have read this policy.
            </P>
          </Section>

          <Section title="2. Personal data we collect">
            <P>Depending on how you use the Website, we may collect the following:</P>
            <UL
              items={[
                'Account information: full name, email address, and your password (handled by our authentication service; we cannot read your password).',
                'Reservation details: researcher name, email, contact number, student or ID number, college or unit, stakeholder type, adviser name, study title, research purpose, special requirements, and the names and student numbers of the members or users listed in your request.',
                'Booking information: the laboratories and equipment you request, the dates and times, and the status of your reservation (for example pending, approved, rejected, or cancelled), including any reasons or messages exchanged with the Research Center.',
                'Feedback and reports: ratings and comments you submit, and problem reports you send us.',
                'Documents you upload, such as paper submissions, and forms you download or fill out.',
                'Activity and technical information: actions performed in the system (activity logs), and small pieces of information stored in your browser to keep you signed in and to remember that you have seen this notice.',
              ]}
            />
          </Section>

          <Section title="3. How we collect your data">
            <P>
              We collect data directly from you when you create or use an account, fill out reservation forms, submit
              feedback or problem reports, or upload documents. Some information is created while you use the
              Website, such as the status of your reservations and activity logs.
            </P>
          </Section>

          <Section title="4. Why we use your data">
            <UL
              items={[
                'To create and manage your account and verify who you are.',
                'To process, approve, schedule, and keep records of laboratory and equipment reservations, and to check for schedule conflicts.',
                'To contact you about your reservations, requests, and problem reports.',
                'To manage laboratories, equipment inventory, and Research Center operations.',
                'To produce reports and statistics for the Research Center (for example total reservations or feedback ratings).',
                'To improve the Website, keep it secure, and prevent misuse.',
                'To comply with university requirements and applicable laws.',
              ]}
            />
            <P>
              We process your data based on your consent, because it is necessary to provide the reservation service you
              requested, and where required to comply with legal or university obligations.
            </P>
          </Section>

          <Section title="5. Who can see and receive your data">
            <UL
              items={[
                'Research Center administrators can see reservation, account, feedback, and report information needed to run the service.',
                'Research Center staff can see reservation information for the laboratories and equipment assigned to them.',
                'Other signed-in users who open the shared reservation calendar can see limited booking details, such as the time slot, the researcher’s name, and the study title. Your email address and contact number are not shown on the calendar.',
                'Service providers that host the Website’s database and authentication on our behalf, who may only handle your data to provide that service.',
                'University offices or authorities, when disclosure is required by law, regulation, or a valid order, or when needed to protect safety and property.',
              ]}
            />
            <P>We do not sell your personal data or use it for advertising.</P>
          </Section>

          <Section title="6. How we protect your data">
            <P>
              We use role-based access so people can only see the information their role requires, database access
              rules, and an authenticated sign-in. Inactive sessions are ended. No online system is completely
              secure, so please keep your password private and sign out when using a shared computer. If a personal data
              breach happens that is likely to put you at risk, we will respond and notify those affected and the NPC as
              required by law.
            </P>
          </Section>

          <Section title="7. How long we keep your data">
            <P>
              We keep your data only as long as needed for the purposes in this policy, for the Research Center’s
              record-keeping, and as required by university policies and applicable laws. When data is no longer needed, we
              delete it or make it anonymous.
            </P>
          </Section>

          <Section title="8. Browser storage (cookies and similar)">
            <P>
              The Website stores small items in your browser to keep you signed in, to end sessions that have been
              inactive for too long, to limit repeated login attempts, and to remember, during your visit, that you have seen this
              Privacy Notice. We do not use advertising or tracking cookies. You can clear this data in your browser settings,
              but you may need to sign in again.
            </P>
          </Section>

          <Section title="9. Your rights">
            <P>Under the Data Privacy Act of 2012, you have the right to:</P>
            <UL
              items={[
                'Be informed about how your personal data is collected and used.',
                'Access the personal data we hold about you.',
                'Object to the processing of your data, and withdraw your consent.',
                'Correct inaccurate or outdated data. You can update some details yourself in your account.',
                'Request erasure or blocking of your data when it is incomplete, outdated, false, unlawfully obtained, or no longer needed.',
                'Receive your data in a commonly used electronic format where applicable (data portability).',
                'Claim compensation for damages caused by inaccurate, unlawfully obtained, or unauthorized use of your data.',
                'File a complaint with the National Privacy Commission (privacy.gov.ph).',
              ]}
            />
            <P>
              Some data must be kept for record-keeping or legal reasons, so we may not always be able to delete it right
              away. To use any of your rights, contact us using the details below.
            </P>
          </Section>

          <Section title="10. Changes to this policy">
            <P>
              We may update this policy from time to time. The date at the top shows when it was last changed. The
              Privacy Notice is shown every time you open the Website, so you can always review it.
            </P>
          </Section>

          <Section title="11. Contact us">
            <P>For questions, requests, or concerns about your personal data, contact the {ORG_NAME}:</P>
            <ul className="text-sm text-muted-foreground leading-relaxed space-y-1">
              <li>{CONTACT_OFFICE}</li>
              {CONTACT_EMAIL && (
                <li>
                  Email:{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-semibold hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </li>
              )}
            </ul>
          </Section>

          <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Link
              to="/"
              className="text-center px-5 py-2.5 rounded-xl border-2 border-border text-foreground font-semibold text-sm no-underline hover:border-primary hover:text-primary transition-colors"
            >
              Back to Home
            </Link>
            {!alreadyAccepted && (
              <button
                type="button"
                onClick={handleAgree}
                className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                I Understand
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;