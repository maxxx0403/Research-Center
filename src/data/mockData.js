















































export const laboratories = [
{ id: 1, lab_name: 'Natural Product Laboratory', lab_code: 'LAB-NPL', description: 'Advanced facility for extraction, isolation, and characterization of natural compounds from plant and marine sources', max_capacity: 15, current_occupancy: 5, status: 'available', equipment_list: 'HPLC systems, GC-MS, Rotary evaporators, Ultrasonic baths, Freeze dryers, Analytical balances, Fume hoods', safety_requirements: 'Safety goggles, Lab coats, Chemical handling training required' },
{ id: 2, lab_name: 'Chemical Biology and Biotechnology Laboratory', lab_code: 'LAB-CBBL', description: 'State-of-the-art facility for chemical synthesis, biological assays, and biotechnology research', max_capacity: 20, current_occupancy: 12, status: 'available', equipment_list: 'PCR machines, Gel electrophoresis systems, Microplate readers, Incubators, Biosafety cabinets', safety_requirements: 'Biosafety Level 2 protocols, Sterile technique training' },
{ id: 3, lab_name: 'Genetic Engineering and Systems Biology Laboratory', lab_code: 'LAB-GESB', description: 'Cutting-edge molecular biology facility for gene editing, cloning, and systems biology research', max_capacity: 12, current_occupancy: 0, status: 'available', equipment_list: 'DNA sequencers, Thermocyclers, Gel documentation systems, Electroporation equipment', safety_requirements: 'GMO handling certification, Containment protocols' },
{ id: 4, lab_name: 'Bio-Analytical Services Facility', lab_code: 'LAB-BASF', description: 'Comprehensive analytical testing facility for biological and chemical sample characterization', max_capacity: 18, current_occupancy: 8, status: 'available', equipment_list: 'LC-MS/MS systems, NMR spectrometer, FTIR, UV-Vis spectrophotometers', safety_requirements: 'Instrument training certification required' },
{ id: 5, lab_name: 'Genetics Laboratory', lab_code: 'LAB-GEN', description: 'Specialized facility for genetic analysis, DNA fingerprinting, and heredity studies', max_capacity: 16, current_occupancy: 16, status: 'occupied', equipment_list: 'Automated DNA extractors, Capillary electrophoresis, Real-time PCR', safety_requirements: 'Genetic material handling protocols' },
{ id: 6, lab_name: 'Bacteriology Laboratory', lab_code: 'LAB-BAC', description: 'Microbiology facility for bacterial isolation, identification, and antimicrobial susceptibility testing', max_capacity: 14, current_occupancy: 0, status: 'maintenance', equipment_list: 'Autoclave systems, Laminar flow hoods, Incubators, Microscopes', safety_requirements: 'Biosafety protocols, Sterilization procedures' },
{ id: 7, lab_name: 'Common Equipment Room', lab_code: 'LAB-CER', description: 'Shared facility housing high-value analytical instruments and specialized equipment', max_capacity: 10, current_occupancy: 3, status: 'available', equipment_list: 'Mass spectrometers, High-resolution microscopes, Particle size analyzers', safety_requirements: 'Equipment training mandatory' },
{ id: 8, lab_name: 'Microbial Culture Collection and Services Facility', lab_code: 'LAB-MCCSF', description: 'Repository and maintenance facility for microbial strains with culture services', max_capacity: 12, current_occupancy: 4, status: 'available', equipment_list: 'Cryopreservation systems, Freeze dryers, Fermentation equipment', safety_requirements: 'Microbial safety protocols' }];


export const labIcons = {
  1: 'Leaf', 2: 'Dna', 3: 'GitBranch', 4: 'BarChart3',
  5: 'Search', 6: 'Bug', 7: 'Wrench', 8: 'Flask'
};

export const reservations = [
{ id: 1, researcher_name: 'Dr. Maria Santos', email: 'maria.santos@university.edu', phone: '+63 917 123 4567', research_purpose: 'Extraction of bioactive compounds from endemic Philippine plants', laboratory_id: 1, lab_name: 'Natural Product Laboratory', lab_code: 'LAB-NPL', equipment_needed: 'HPLC, Rotary evaporator', start_datetime: '2026-04-10T09:00', end_datetime: '2026-04-10T17:00', status: 'reserved', special_requirements: 'Need access to fume hoods', created_at: '2026-04-08T14:30:00' },
{ id: 2, researcher_name: 'Prof. James Chen', email: 'jchen@biotech.org', phone: '+63 918 234 5678', research_purpose: 'CRISPR gene editing experiments on rice cultivars', laboratory_id: 3, lab_name: 'Genetic Engineering and Systems Biology Laboratory', lab_code: 'LAB-GESB', equipment_needed: 'Thermocycler, Electroporation equipment', start_datetime: '2026-04-11T08:00', end_datetime: '2026-04-11T18:00', status: 'reserved', special_requirements: 'Biosafety Level 2 required', created_at: '2026-04-07T10:15:00' },
{ id: 3, researcher_name: 'Dr. Ana Reyes', email: 'areyes@research.ph', phone: '+63 919 345 6789', research_purpose: 'Antimicrobial susceptibility testing of soil bacteria isolates', laboratory_id: 6, lab_name: 'Bacteriology Laboratory', lab_code: 'LAB-BAC', equipment_needed: 'Laminar flow hood, Incubator', start_datetime: '2026-04-09T10:00', end_datetime: '2026-04-09T16:00', status: 'in_use', special_requirements: '', created_at: '2026-04-06T08:45:00' },
{ id: 4, researcher_name: 'Dr. Roberto Cruz', email: 'rcruz@upm.edu', phone: '+63 920 456 7890', research_purpose: 'NMR spectroscopy analysis of synthesized compounds', laboratory_id: 4, lab_name: 'Bio-Analytical Services Facility', lab_code: 'LAB-BASF', equipment_needed: 'NMR spectrometer', start_datetime: '2026-04-08T13:00', end_datetime: '2026-04-08T17:00', status: 'completed', special_requirements: 'Need booking for NMR', created_at: '2026-04-05T16:20:00' },
{ id: 5, researcher_name: 'Dr. Lisa Wang', email: 'lwang@genetics.org', phone: '+63 921 567 8901', research_purpose: 'DNA fingerprinting of endemic species', laboratory_id: 5, lab_name: 'Genetics Laboratory', lab_code: 'LAB-GEN', equipment_needed: 'DNA extractors, Capillary electrophoresis', start_datetime: '2026-04-07T09:00', end_datetime: '2026-04-07T15:00', status: 'completed', special_requirements: '', created_at: '2026-04-04T11:00:00' },
{ id: 6, researcher_name: 'Mr. Kevin Tan', email: 'ktan@student.edu', phone: '+63 922 678 9012', research_purpose: 'PCR amplification for thesis project', laboratory_id: 2, lab_name: 'Chemical Biology and Biotechnology Laboratory', lab_code: 'LAB-CBBL', equipment_needed: 'PCR machine, Gel electrophoresis', start_datetime: '2026-04-12T08:00', end_datetime: '2026-04-12T12:00', status: 'reserved', special_requirements: 'Graduate student - needs supervisor approval', created_at: '2026-04-08T09:30:00' },
{ id: 7, researcher_name: 'Dr. Patricia Gomez', email: 'pgomez@micro.ph', phone: '', research_purpose: 'Microbial strain preservation and cataloguing', laboratory_id: 8, lab_name: 'Microbial Culture Collection and Services Facility', lab_code: 'LAB-MCCSF', equipment_needed: 'Cryopreservation system', start_datetime: '2026-04-06T10:00', end_datetime: '2026-04-06T16:00', status: 'cancelled', special_requirements: '', created_at: '2026-04-03T14:10:00' },
{ id: 8, researcher_name: 'Dr. Marco Villanueva', email: 'mvillanueva@chem.edu', phone: '+63 923 789 0123', research_purpose: 'Mass spectrometry analysis of environmental samples', laboratory_id: 7, lab_name: 'Common Equipment Room', lab_code: 'LAB-CER', equipment_needed: 'Mass spectrometer', start_datetime: '2026-04-09T14:00', end_datetime: '2026-04-09T18:00', status: 'in_use', special_requirements: 'Requires calibration before use', created_at: '2026-04-07T13:45:00' }];


export const feedbacks = [
{ id: 1, researcher_name: 'Dr. Maria Santos', email: 'maria.santos@university.edu', lab_name: 'Natural Product Laboratory', rating: 5, comment: 'Excellent facilities and well-maintained equipment. The HPLC system performed flawlessly.', submitted_at: '2026-04-08T16:30:00' },
{ id: 2, researcher_name: 'Prof. James Chen', email: 'jchen@biotech.org', lab_name: 'Genetic Engineering and Systems Biology Laboratory', rating: 4, comment: 'Great lab setup for gene editing work. Would appreciate more thermocycler units.', submitted_at: '2026-04-07T14:20:00' },
{ id: 3, researcher_name: 'Dr. Lisa Wang', email: 'lwang@genetics.org', lab_name: 'Genetics Laboratory', rating: 5, comment: 'The DNA sequencing platform is top-notch. Very satisfied with the results.', submitted_at: '2026-04-06T11:45:00' },
{ id: 4, researcher_name: 'Dr. Roberto Cruz', email: 'rcruz@upm.edu', lab_name: 'Bio-Analytical Services Facility', rating: 3, comment: 'NMR spectrometer needs calibration. Results were acceptable but could be better.', submitted_at: '2026-04-05T17:00:00' },
{ id: 5, researcher_name: 'Mr. Kevin Tan', email: 'ktan@student.edu', lab_name: null, rating: 4, comment: 'Reservation process was smooth and easy. Staff was very helpful.', submitted_at: '2026-04-04T10:30:00' },
{ id: 6, researcher_name: 'Dr. Ana Reyes', email: 'areyes@research.ph', lab_name: 'Bacteriology Laboratory', rating: 2, comment: 'Lab was under maintenance during my visit. Had to reschedule. Better communication needed.', submitted_at: '2026-04-03T09:15:00' }];


export const activityLogs = [
{ id: 1, username: 'admin', action: 'update_reservation', description: 'Changed reservation #3 status to in_use', ip_address: '192.168.1.100', created_at: '2026-04-09T10:05:00' },
{ id: 2, username: 'admin', action: 'lab_status_change', description: "Changed lab 'Bacteriology Laboratory' status to maintenance", ip_address: '192.168.1.100', created_at: '2026-04-09T09:30:00' },
{ id: 3, username: 'admin', action: 'login', description: 'Successful login', ip_address: '192.168.1.100', created_at: '2026-04-09T08:00:00' },
{ id: 4, username: 'admin', action: 'update_reservation', description: 'Changed reservation #4 status to completed', ip_address: '192.168.1.100', created_at: '2026-04-08T17:15:00' },
{ id: 5, username: 'admin', action: 'update_reservation', description: 'Changed reservation #7 status to cancelled', ip_address: '192.168.1.100', created_at: '2026-04-08T15:00:00' },
{ id: 6, username: 'admin', action: 'lab_updated', description: "Updated lab 'Natural Product Laboratory'", ip_address: '192.168.1.100', created_at: '2026-04-08T11:20:00' },
{ id: 7, username: 'System', action: 'system_init', description: 'Database initialized with Research Center Laboratory facilities', ip_address: '127.0.0.1', created_at: '2026-04-01T00:00:00' }];


export function getStatusColor(status) {
  switch (status) {
    case 'available':return 'success';
    case 'reserved':return 'primary';
    case 'in_use':case 'occupied':return 'warning';
    case 'completed':return 'success';
    case 'cancelled':case 'maintenance':case 'restricted':return 'destructive';
    default:return 'muted';
  }
}

export function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}