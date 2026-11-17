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

// ---------------------------------------------------------------------------
// Members list: individual members + whole sections (class lists)
// ---------------------------------------------------------------------------
// members_list is stored as text entries:
//   individual member:  "Full Name — Student No. 2023xxxx"
//   section member:     "Full Name — Student No. 2023xxxx — Section BSIT 3-1"
//                       (or "Full Name — Section BSIT 3-1" if the list had no number)
// The Section tag lets the request form show just the section instead of every name.
const SECTION_TAG_RE = /\s+—\s+Section\s+(.+)$/;
const HEADER_LINE_RE = /^\s*(no\.?|#)?\s*(full\s*)?(name|student|last\s*name|surname)\b/i;

/**
 * Reads a pasted/uploaded class list. One student per line; the student number is
 * any run of 6+ digits on the line, everything else is the name.
 * e.g. "Santos, Maria A.\t202302604" or "1. Juan Dela Cruz - 202301234"
 * @returns [{ name, studentNumber }]
 */
export const parseClassList = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    // skip empty lines and a header row like "No. | Name | Student Number" (headers have no student number)
    .filter((line) => line && !(HEADER_LINE_RE.test(line) && !/\d{6,}/.test(line)))
    .map((line) => {
      const numberMatch = line.match(/\d{6,}/);
      const studentNumber = numberMatch ? numberMatch[0] : '';
      const name = (numberMatch ? line.replace(numberMatch[0], ' ') : line)
        .replace(/^\s*\d{1,3}(?:[.)]|\t|\s+(?=[a-z]))\s*/i, '') // leading row number "1." / "1)" / "1<tab>"
        .replace(/[\t|;]+/g, ' ')
        .replace(/\s+[-–—]\s*$|^\s*[-–—]\s+/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s,]+|[\s,]+$/g, '')
        .trim();
      return { name, studentNumber };
    })
    .filter((s) => /[a-z]/i.test(s.name));

/** members_list entries for the students of each section: [{ name, text }] */
export const sectionMemberEntries = (sections) =>
  (sections || []).flatMap((section) => {
    const sectionName = sanitizeText(section.name, { maxLength: 60 });
    if (!sectionName) return [];
    return parseClassList(section.text).map((s) => {
      const name = sanitizeText(s.name, { maxLength: 150 });
      const number = sanitizeText(s.studentNumber, { maxLength: 50 });
      return `${name}${number ? ` — Student No. ${number}` : ''} — Section ${sectionName}`;
    });
  });

/**
 * Splits members_list into individual members and sections.
 * @returns { individuals: [entry], sections: [{ name, count }] }
 */
export const splitMembersBySection = (list) => {
  const individuals = [];
  const sections = new Map();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    if (typeof entry !== 'string' || !entry.trim()) return;
    const match = entry.match(SECTION_TAG_RE);
    if (match) {
      const name = match[1].trim();
      sections.set(name, (sections.get(name) || 0) + 1);
    } else {
      individuals.push(entry);
    }
  });
  return { individuals, sections: [...sections.entries()].map(([name, count]) => ({ name, count })) };
};

/**
 * "Name(s)" text for the request form: the requester, members added one by one,
 * and each section as one entry, e.g. "Section BSIT 3-1 (40 students)".
 */
export const formNamesText = (researcherName, membersList) => {
  const { individuals, sections } = splitMembersBySection(membersList);
  return [
    researcherName,
    ...individuals,
    ...sections.map((s) => `Section ${s.name} (${s.count} student${s.count === 1 ? '' : 's'})`),
  ].filter(Boolean).join(', ');
};