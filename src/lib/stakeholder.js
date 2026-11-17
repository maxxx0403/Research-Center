// Stakeholder type rules based on the account's email domain.
//   @cvsu.edu.ph -> CvSU stakeholder: choose Student or Faculty/Staff
//   anything else (e.g. @gmail.com) -> Non-CvSU Stakeholder (auto-selected)

export const STAKEHOLDER_OPTIONS = [
  { value: 'student', label: 'CvSU Student' },
  { value: 'faculty_staff', label: 'Instructor' },
  { value: 'non_cvsu', label: 'Non-CvSU Stakeholder' },
];

export const isCvsuEmail = (email) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return domain === 'cvsu.edu.ph' || domain.endsWith('.cvsu.edu.ph');
};

// Returns the options to show and the value to auto-select (or '' if the user must pick).
// `registeredType` is the type the user picked when registering (kept in the
// account's user_metadata). When present, the reserve form uses it directly.
export const getStakeholderConfig = (email, registeredType = '') => {
  const registered = STAKEHOLDER_OPTIONS.find((o) => o.value === registeredType);
  // CvSU Student / Instructor must have a CvSU email; Non-CvSU must not.
  // If they don't match, ignore the saved type and use the email-based rule below.
  const emailMatches = registered && (registered.value === 'non_cvsu' ? !isCvsuEmail(email) : isCvsuEmail(email));
  if (registered && emailMatches) {
    return { options: [registered], autoValue: registered.value };
  }
  if (!email) {
    return { options: STAKEHOLDER_OPTIONS, autoValue: '' };
  }
  if (isCvsuEmail(email)) {
    return {
      options: STAKEHOLDER_OPTIONS.filter((o) => o.value !== 'non_cvsu'),
      autoValue: '',
    };
  }
  return {
    options: STAKEHOLDER_OPTIONS.filter((o) => o.value === 'non_cvsu'),
    autoValue: 'non_cvsu',
  };
};

// Report filter: show everyone, only CvSU stakeholders (student + instructor), or only non-CvSU ones.
export const STAKEHOLDER_GROUPS = [
  { value: 'all', label: 'All stakeholders' },
  { value: 'cvsu', label: 'CvSU' },
  { value: 'non_cvsu', label: 'Non-CvSU' },
];

export const stakeholderGroupLabel = (group) =>
  STAKEHOLDER_GROUPS.find((g) => g.value === group)?.label || STAKEHOLDER_GROUPS[0].label;

// Does a reservation's stakeholder_type belong to the chosen group?
export const matchesStakeholderGroup = (stakeholderType, group = 'all') => {
  if (group === 'cvsu') return stakeholderType === 'student' || stakeholderType === 'faculty_staff';
  if (group === 'non_cvsu') return stakeholderType === 'non_cvsu';
  return true;
};

// stakeholder_type values that belong to a group, for database queries (null = no filter).
export const stakeholderTypesOf = (group = 'all') => {
  if (group === 'cvsu') return ['student', 'faculty_staff'];
  if (group === 'non_cvsu') return ['non_cvsu'];
  return null;
};
/**
 * College (CvSU) or school/agency (Non-CvSU) saved on the account at registration.
 * Returns '' when nothing usable is saved, so the form lets the user choose it.
 * For CvSU it must be one of the colleges in the dropdown list.
 */
export const accountUnitCollege = (user, isCvsuStakeholder, collegeOptions = []) => {
  const saved = String(user?.user_metadata?.unit_college || '').trim();
  if (!saved) return '';
  if (isCvsuStakeholder) return collegeOptions.some((c) => c.value === saved) ? saved : '';
  return saved;
};

// Account type for the User Accounts report and dashboard charts. Type saved at
// registration; older accounts without one are judged by their e-mail.
export const ACCOUNT_TYPES = {
  student: 'CvSU Student',
  faculty_staff: 'CvSU Instructor',
  non_cvsu: 'Non-CvSU',
};
export const accountTypeOf = (u) => (ACCOUNT_TYPES[u.stakeholder_type] ? u.stakeholder_type : isCvsuEmail(u.email) ? 'student' : 'non_cvsu');
export const isCvsuAccount = (u) => accountTypeOf(u) !== 'non_cvsu';