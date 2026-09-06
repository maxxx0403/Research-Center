// src/lib/validation.js
// Centralized input validation & sanitization helpers.
// Used on every user-facing form (auth, reservations, feedback, file uploads)
// as a defense-in-depth layer in front of Supabase RLS.

// --- Sanitization -----------------------------------------------------

// Strips characters that have no business being in a plain-text field and
// collapses excess whitespace. This is NOT a substitute for RLS / parameterized
// queries (Supabase already parameterizes everything) — it's here to stop
// stored-XSS style payloads (e.g. "<script>", "javascript:") from ever
// reaching the database in free-text fields that get rendered back later.
export const sanitizeText = (value, { maxLength = 500 } = {}) => {
  if (value == null) return '';
  let v = String(value);
  v = v.replace(/<[^>]*>/g, ''); // strip HTML tags
  v = v.replace(/javascript:/gi, '');
  v = v.replace(/on\w+\s*=/gi, ''); // strip inline event handlers like onclick=
  v = v.trim();
  if (v.length > maxLength) v = v.slice(0, maxLength);
  return v;
};

// --- Field validators ---------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// PH mobile numbers: 09XXXXXXXXX or +639XXXXXXXXX
const PH_PHONE_RE = /^(\+63|0)9\d{9}$/;

export const validateEmail = (email) => {
  if (!email) return 'Email is required.';
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
  if (email.length > 254) return 'Email is too long.';
  return null;
};

export const validatePhone = (phone, { required = false } = {}) => {
  if (!phone) return required ? 'Phone number is required.' : null;
  const digits = String(phone).trim();
  if (!PH_PHONE_RE.test(digits)) {
    return 'Enter a valid PH mobile number (e.g. 09171234567).';
  }
  return null;
};

export const validateRequiredText = (value, label, { minLength = 2, maxLength = 500 } = {}) => {
  const v = (value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < minLength) return `${label} is too short.`;
  if (v.length > maxLength) return `${label} must be under ${maxLength} characters.`;
  return null;
};

// Password strength: min 8 chars, at least one letter and one number.
// (Supabase Auth's own "leaked password protection" and rate limiting are
// configured separately in the Supabase Dashboard — see SECURITY.md.)
export const validatePassword = (password) => {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
};

export const passwordStrength = (password) => {
  if (!password) return { score: 0, label: 'Too short' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'];
  return { score, label: labels[Math.min(score, labels.length - 1)] };
};

// --- Reservation form validation ----------------------------------------

// Validates the common fields shared by lab and equipment reservation forms.
// Returns null if valid, or a user-facing error string.
export const validateReservationFields = ({ researcher_name, email, phone, study_title, research_purpose }) => {
  return (
    validateRequiredText(researcher_name, 'Researcher / requester name', { minLength: 2, maxLength: 150 }) ||
    (email ? validateEmail(email) : null) ||
    validatePhone(phone, { required: true }) ||
    validateRequiredText(study_title, 'Study title', { minLength: 2, maxLength: 300 }) ||
    validateRequiredText(research_purpose, 'Purpose', { minLength: 5, maxLength: 1000 }) ||
    null
  );
};

// --- File upload validation ---------------------------------------------

export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const validateUploadFile = (file) => {
  if (!file) return 'Please select a file.';
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return 'Please upload a PDF or DOCX file only.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'File is too large. Maximum size is 10 MB.';
  }
  // Block double-extension / executable-disguised-as-doc tricks
  const name = file.name || '';
  if (/\.(exe|js|sh|bat|php|html?|svg)$/i.test(name)) {
    return 'That file type is not allowed.';
  }
  return null;
};

// --- Simple client-side login throttle (defense-in-depth) ---------------
// Supabase Auth already rate-limits sign-in attempts server-side; this just
// avoids hammering the API from a compromised/scripted client and gives the
// user clear feedback. Not a substitute for server-side rate limiting.

const ATTEMPTS_KEY = 'login_attempts_v1';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000; // 1 minute

export const checkLoginThrottle = () => {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      const secondsLeft = Math.ceil((data.lockedUntil - Date.now()) / 1000);
      return { allowed: false, secondsLeft };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
};

export const recordLoginAttempt = (success) => {
  try {
    if (success) {
      sessionStorage.removeItem(ATTEMPTS_KEY);
      return;
    }
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    data.count += 1;
    if (data.count >= MAX_ATTEMPTS) {
      data.lockedUntil = Date.now() + COOLDOWN_MS;
      data.count = 0;
    }
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — fail open, server-side limits still apply
  }
};
