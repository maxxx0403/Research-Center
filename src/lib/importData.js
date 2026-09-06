import { supabase } from '@/integrations/supabase/client';
import { laboratories } from '@/data/mockData';

/**
 * Equipment data extracted from laboratory equipment lists
 */
const equipmentData = [
  // Natural Product Laboratory (Lab 1)
  { name: 'HPLC System', brand: 'Agilent', model: 'HP 1200', laboratory_id: 1, quantity: 2, available_quantity: 2, status: 'available' },
  { name: 'GC-MS', brand: 'Shimadzu', model: 'QP2010 Plus', laboratory_id: 1, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Rotary Evaporator', brand: 'IKA', model: 'RV 10', laboratory_id: 1, quantity: 3, available_quantity: 2, status: 'available' },
  { name: 'Ultrasonic Bath', brand: 'Branson', model: '3800', laboratory_id: 1, quantity: 2, available_quantity: 2, status: 'available' },
  { name: 'Freeze Dryer', brand: 'Labconco', model: 'FreeZone', laboratory_id: 1, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Analytical Balance', brand: 'Sartorius', model: 'Cubis', laboratory_id: 1, quantity: 4, available_quantity: 3, status: 'available' },
  { name: 'Fume Hood', brand: 'Thermo', model: 'Series 4000', laboratory_id: 1, quantity: 3, available_quantity: 2, status: 'available' },

  // Chemical Biology and Biotechnology Laboratory (Lab 2)
  { name: 'PCR Machine', brand: 'Bio-Rad', model: 'CFX96', laboratory_id: 2, quantity: 3, available_quantity: 2, status: 'available' },
  { name: 'Gel Electrophoresis System', brand: 'Bio-Rad', model: 'PowerPac Basic', laboratory_id: 2, quantity: 4, available_quantity: 3, status: 'available' },
  { name: 'Microplate Reader', brand: 'Tecan', model: 'Infinite Pro', laboratory_id: 2, quantity: 2, available_quantity: 1, status: 'available' },
  { name: 'Incubator', brand: 'Thermo', model: 'Heratherm', laboratory_id: 2, quantity: 3, available_quantity: 2, status: 'available' },
  { name: 'Biosafety Cabinet', brand: 'Thermo', model: 'MSC-Advance', laboratory_id: 2, quantity: 2, available_quantity: 2, status: 'available' },

  // Genetic Engineering and Systems Biology Laboratory (Lab 3)
  { name: 'DNA Sequencer', brand: 'Illumina', model: 'MiSeq', laboratory_id: 3, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Thermocycler', brand: 'Applied Biosystems', model: 'ProFlex', laboratory_id: 3, quantity: 2, available_quantity: 2, status: 'available' },
  { name: 'Gel Documentation System', brand: 'Bio-Rad', model: 'ChemiDoc MP', laboratory_id: 3, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Electroporation Equipment', brand: 'Bio-Rad', model: 'Gene Pulser Xcell', laboratory_id: 3, quantity: 1, available_quantity: 1, status: 'available' },

  // Bio-Analytical Services Facility (Lab 4)
  { name: 'LC-MS/MS System', brand: 'Agilent', model: '6470', laboratory_id: 4, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'NMR Spectrometer', brand: 'Bruker', model: 'AVANCE III', laboratory_id: 4, quantity: 1, available_quantity: 0, status: 'available' },
  { name: 'FTIR Spectrometer', brand: 'Thermo', model: 'Nicolet iS5', laboratory_id: 4, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'UV-Vis Spectrophotometer', brand: 'Shimadzu', model: 'UV-2600', laboratory_id: 4, quantity: 2, available_quantity: 2, status: 'available' },

  // Genetics Laboratory (Lab 5)
  { name: 'Automated DNA Extractor', brand: 'Qiagen', model: 'EZ1', laboratory_id: 5, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Capillary Electrophoresis System', brand: 'Agilent', model: '3500xL', laboratory_id: 5, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Real-time PCR', brand: 'Bio-Rad', model: 'CFX Connect', laboratory_id: 5, quantity: 2, available_quantity: 1, status: 'available' },

  // Bacteriology Laboratory (Lab 6)
  { name: 'Autoclave System', brand: 'Systec', model: 'D-65', laboratory_id: 6, quantity: 2, available_quantity: 2, status: 'available' },
  { name: 'Laminar Flow Hood', brand: 'Thermo', model: 'KingFisher', laboratory_id: 6, quantity: 2, available_quantity: 2, status: 'available' },
  { name: 'Laboratory Incubator', brand: 'Memmert', model: 'IN55', laboratory_id: 6, quantity: 3, available_quantity: 3, status: 'available' },
  { name: 'Microscope', brand: 'Olympus', model: 'BX53', laboratory_id: 6, quantity: 3, available_quantity: 2, status: 'available' },

  // Common Equipment Room (Lab 7)
  { name: 'Mass Spectrometer', brand: 'Thermo', model: 'Q Exactive Plus', laboratory_id: 7, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'High-resolution Microscope', brand: 'Zeiss', model: 'Axio Imager', laboratory_id: 7, quantity: 2, available_quantity: 1, status: 'available' },
  { name: 'Particle Size Analyzer', brand: 'Malvern', model: 'Zetasizer Ultra', laboratory_id: 7, quantity: 1, available_quantity: 1, status: 'available' },

  // Microbial Culture Collection and Services Facility (Lab 8)
  { name: 'Cryopreservation System', brand: 'Eppendorf', model: 'CryoCube', laboratory_id: 8, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Freeze Dryer System', brand: 'Virtis', model: 'Genesis', laboratory_id: 8, quantity: 1, available_quantity: 1, status: 'available' },
  { name: 'Fermentation Equipment', brand: 'Infors', model: 'Multifors', laboratory_id: 8, quantity: 2, available_quantity: 1, status: 'available' }
];

/**
 * Import all laboratories to Supabase
 */
export const importLaboratories = async () => {
  try {
    console.log('Starting laboratory import...');
    
    // First, delete existing laboratories (optional - uncomment if you want to clear)
    // await supabase.from('laboratories').delete().neq('id', 0);
    
    const { data, error } = await supabase
      .from('laboratories')
      .insert(
        laboratories.map(lab => ({
          lab_name: lab.lab_name,
          lab_code: lab.lab_code,
          description: lab.description,
          max_capacity: lab.max_capacity,
          current_occupancy: lab.current_occupancy,
          status: lab.status,
          equipment_list: lab.equipment_list,
          safety_requirements: lab.safety_requirements
        }))
      )
      .select();

    if (error) {
      console.error('Error importing laboratories:', error);
      throw error;
    }

    console.log(`Successfully imported ${data?.length || 0} laboratories`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Laboratory import failed:', error);
    return { success: false, error };
  }
};

/**
 * Import all equipment to Supabase
 */
export const importEquipment = async () => {
  try {
    console.log('Starting equipment import...');
    
    // First, delete existing equipment (optional - uncomment if you want to clear)
    // await supabase.from('equipment').delete().neq('id', 0);
    
    const { data, error } = await supabase
      .from('equipment')
      .insert(
        equipmentData.map(eq => ({
          name: eq.name,
          brand: eq.brand || null,
          model: eq.model || null,
          laboratory_id: eq.laboratory_id,
          quantity: eq.quantity,
          available_quantity: eq.available_quantity,
          status: eq.status
        }))
      )
      .select();

    if (error) {
      console.error('Error importing equipment:', error);
      throw error;
    }

    console.log(`Successfully imported ${data?.length || 0} equipment items`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Equipment import failed:', error);
    return { success: false, error };
  }
};

/**
 * Create admin user account
 */
export const createAdminUser = async (email = 'mhar.granado@cvsu.edu.ph', password = 'Admin@123456') => {
  try {
    console.log('Creating admin account...');
    
    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: 'Administrator',
          role: 'admin'
        },
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('Error creating admin user:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('User creation returned no user data');
    }

    console.log('Admin user created, adding role...');

    // Add admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'admin'
      });

    if (roleError) {
      console.error('Error setting admin role:', roleError);
      throw roleError;
    }

    console.log(`✅ Admin account created successfully!\nEmail: ${email}\nPassword: ${password}\n⚠️  Please change the password after first login!`);
    return { 
      success: true, 
      user: data.user,
      credentials: { email, password }
    };
  } catch (error) {
    console.error('Admin user creation failed:', error);
    return { success: false, error };
  }
};

/**
 * Import all facilities and equipment
 */
export const importAllData = async () => {
  try {
    console.log('Starting full data import...');
    
    const labResult = await importLaboratories();
    if (!labResult.success) {
      throw new Error('Failed to import laboratories');
    }

    const eqResult = await importEquipment();
    if (!eqResult.success) {
      throw new Error('Failed to import equipment');
    }

    console.log('All data imported successfully!');
    return {
      success: true,
      laboratories: labResult.count,
      equipment: eqResult.count
    };
  } catch (error) {
    console.error('Full import failed:', error);
    return { success: false, error };
  }
};
