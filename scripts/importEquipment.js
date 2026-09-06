import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function importEquipment() {
  try {
    console.log('🔄 Starting equipment import...');
    console.log(`📦 Preparing to insert ${equipmentData.length} equipment items\n`);

    // Insert in batches to avoid timeout
    const batchSize = 10;
    let inserted = 0;

    for (let i = 0; i < equipmentData.length; i += batchSize) {
      const batch = equipmentData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('equipment')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }

      inserted += data.length;
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: Inserted ${data.length} items (Total: ${inserted}/${equipmentData.length})`);
    }

    console.log(`\n🎉 Successfully imported all ${inserted} equipment items!\n`);
    return { success: true, count: inserted };
  } catch (error) {
    console.error('❌ Equipment import failed:', error);
    process.exit(1);
  }
}

// Run the import
importEquipment().then(() => {
  console.log('✨ Import complete!');
  process.exit(0);
});
