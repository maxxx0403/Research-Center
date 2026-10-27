// Stakeholder type rules based on the account's email domain.
//   @cvsu.edu.ph -> CvSU stakeholder: choose Student or Faculty/Staff
//   anything else (e.g. @gmail.com) -> Non-CvSU Stakeholder (auto-selected)

export const STAKEHOLDER_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'faculty_staff', label: 'Faculty/Staff' },
  { value: 'non_cvsu', label: 'Non-CvSU Stakeholder' },
];

export const isCvsuEmail = (email) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return domain === 'cvsu.edu.ph' || domain.endsWith('.cvsu.edu.ph');
};

// Returns the options to show and the value to auto-select (or '' if the user must pick).
export const getStakeholderConfig = (email) => {
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