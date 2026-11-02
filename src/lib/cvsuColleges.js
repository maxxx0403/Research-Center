// Colleges / units of Cavite State University (Main Campus) plus High School.
// Used as the "Unit / College / Agency" dropdown for CvSU stakeholders
// (Student or Faculty/Staff). Non-CvSU stakeholders type their own agency.
export const CVSU_COLLEGES = [
  'College of Agriculture, Food, Environment and Natural Resources (CAFENR)',
  'College of Arts and Sciences (CAS)',
  'College of Criminal Justice (CCJ)',
  'College of Economics, Management and Development Studies (CEMDS)',
  'College of Education (CED)',
  'College of Engineering and Information Technology (CEIT)',
  'College of Medicine (COM)',
  'College of Nursing (CON)',
  'College of Sports, Physical Education and Recreation (CSPEAR)',
  'College of Veterinary Medicine and Biomedical Sciences (CVMBS)',
  'Graduate School and Open Learning College (GS-OLC)',
  'High School',
].map((name) => ({ value: name, label: name }));