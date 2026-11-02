// Tracks "this browser tab is in the middle of a password reset".
//
// Opening the emailed reset link makes Supabase create a temporary session so
// the new password can be saved. That session must NOT behave like a normal
// login (no dashboard, no auto-login) - the app uses this flag to ignore it
// everywhere except the /reset-password page.
import { supabase } from '@/integrations/supabase/client';

const FLAG = 'cvsurc:password-recovery';
const MAX_AGE_MS = 60 * 60 * 1000; // a reset attempt is valid for 1 hour

const readFlag = () => {
  try {
    const t = Number(sessionStorage.getItem(FLAG));
    return !!t && Date.now() - t < MAX_AGE_MS;
  } catch {
    return false;
  }
};

const writeFlag = (on) => {
  try {
    if (on) sessionStorage.setItem(FLAG, String(Date.now()));
    else sessionStorage.removeItem(FLAG);
  } catch { /* storage unavailable */ }
};

// Decide synchronously, at page load, whether the URL is a password-reset link.
// (With PKCE the link is just ?code=..., but the code verifier saved when the
// reset was requested is tagged "/PASSWORD_RECOVERY" - so we can tell it apart
// from an email-confirmation link BEFORE the client exchanges the code.)
const detectRecoveryFromUrl = () => {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('type') === 'recovery') return true;
    if (search.get('code')) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.endsWith('-code-verifier') &&
        (localStorage.getItem(key) || '').endsWith('/PASSWORD_RECOVERY')) {
          return true;
        }
      }
    }
  } catch { /* ignore */ }
  return false;
};

if (detectRecoveryFromUrl()) writeFlag(true);

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') writeFlag(true);
  if (event === 'SIGNED_OUT') writeFlag(false);
});

export const isRecoveryActive = () => readFlag();
export const endRecovery = () => writeFlag(false);