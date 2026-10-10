import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { hasAcceptedPrivacy, acceptPrivacy } from '@/lib/privacyConsent';

/**
 * Privacy Notice shown when someone opens the website for the first time.
 * It is not shown on the Privacy Policy page itself, so the full text can be read.
 */
const PrivacyNotice = () => {
  const { pathname } = useLocation();
  const [accepted, setAccepted] = useState(() => hasAcceptedPrivacy());

  const visible = !accepted && pathname !== '/privacy-policy';

  // Keep the page behind the notice from scrolling.
  useEffect(() => {
    if (!visible) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const handleAccept = () => {
    acceptPrivacy();
    setAccepted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 id="privacy-notice-title" className="font-heading text-xl font-bold text-foreground">
            Privacy Notice
          </h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          The CvSU Research Center Laboratory Reservation System collects and uses some of your personal
          information, such as your name, email, student number, contact number, and the details of your
          reservations, so we can process your laboratory and equipment requests.
        </p>
        <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1.5 mb-4">
          <li>We only use your data to run the reservation service and to keep our records.</li>
          <li>We do not sell your personal data.</li>
          <li>Only authorized Research Center personnel can see your reservation details.</li>
          <li>You have rights over your data under the Data Privacy Act of 2012 (RA 10173).</li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Please read our{' '}
          <Link to="/privacy-policy" className="text-primary font-semibold hover:underline">
            full Privacy Policy
          </Link>{' '}
          to learn how we collect, use, protect, and share your data.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link
            to="/privacy-policy"
            className="text-center px-5 py-2.5 rounded-xl border-2 border-border text-foreground font-semibold text-sm no-underline hover:border-primary hover:text-primary transition-colors"
          >
            Read Full Policy
          </Link>
          <button
            type="button"
            onClick={handleAccept}
            className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNotice;