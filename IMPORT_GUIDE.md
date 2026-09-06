# Facilities & Equipment Import Guide

## Overview
The import feature allows you to bulk import all laboratory facilities and equipment data from the mockData into your Supabase database.

## What Gets Imported

### Facilities (8 Laboratories)
1. **Natural Product Laboratory** (LAB-NPL)
2. **Chemical Biology and Biotechnology Laboratory** (LAB-CBBL)
3. **Genetic Engineering and Systems Biology Laboratory** (LAB-GESB)
4. **Bio-Analytical Services Facility** (LAB-BASF)
5. **Genetics Laboratory** (LAB-GEN)
6. **Bacteriology Laboratory** (LAB-BAC)
7. **Common Equipment Room** (LAB-CER)
8. **Microbial Culture Collection and Services Facility** (LAB-MCCSF)

### Equipment (38 Items)
Each facility has multiple equipment items with:
- Brand and model information
- Quantity tracking
- Availability status
- Laboratory assignment

## How to Use

### Method 1: Using the Admin Import Page (Recommended)

1. **Login as Admin**
   - Go to `/admin` and log in with your admin credentials

2. **Navigate to Import Page**
   - Click "Import Data" in the admin sidebar
   - Or go directly to `/admin/import-data`

3. **Choose Import Option**
   - **Import Laboratories** - Import only facilities
   - **Import Equipment** - Import only equipment
   - **Import All** - Import both facilities and equipment in one click

4. **Monitor Status**
   - Success messages will show how many items were imported
   - Error messages will indicate if something went wrong

### Method 2: Using Code

```javascript
// In any React component or file
import { importAllData, importLaboratories, importEquipment } from '@/lib/importData';

// Import everything
const result = await importAllData();
console.log(`Imported ${result.laboratories} labs and ${result.equipment} equipment`);

// Or import separately
const labResult = await importLaboratories();
const eqResult = await importEquipment();
```

## API Endpoints

The import functions are exported from `/src/lib/importData.js`:

### `importLaboratories()`
Imports all 8 laboratory facilities to the `laboratories` table

**Returns:**
```javascript
{
  success: boolean,
  count: number,  // Number of laboratories imported
  error?: Error
}
```

### `importEquipment()`
Imports all 38 equipment items to the `equipment` table

**Returns:**
```javascript
{
  success: boolean,
  count: number,  // Number of equipment items imported
  error?: Error
}
```

### `importAllData()`
Imports both laboratories and equipment in sequence

**Returns:**
```javascript
{
  success: boolean,
  laboratories: number,
  equipment: number,
  error?: Error
}
```

## Important Notes

⚠️ **Before Importing**
- Ensure you're logged in as an admin
- The import will ADD data to your tables
- If records with the same lab_code or name exist, there may be duplicates
- Consider backing up your database first

📝 **Data Structure**
- All laboratories are created with `status: 'available'` (except Bacteriology Lab which is 'maintenance')
- Equipment quantities are realistic based on lab requirements
- All items are marked as 'available' initially

🔄 **Re-importing**
- If you want to clear old data first, uncomment the delete lines in `/src/lib/importData.js`
- By default, data is simply added (no duplicate checking)

## File Locations

- **Import Functions:** `src/lib/importData.js`
- **Import UI Component:** `src/pages/admin/ImportData.jsx`
- **Source Data:** `src/data/mockData.js`

## Troubleshooting

### "Failed to import laboratories"
- Check Supabase connection
- Verify you have admin permissions
- Check browser console for detailed error message

### "Some data imported, some failed"
- Individual items may have failed due to validation errors
- Check the `laboratories` and `equipment` tables for partial data
- Retry or import individual items manually

### Duplicates appear
- The import doesn't check for existing data
- Delete old records from `equipment` and `laboratories` tables first
- Or modify the import functions to include duplicate checking

## Next Steps

After importing:
1. ✅ Review the imported data in the "Laboratories" and "Equipment" admin pages
2. ✅ Verify all information is correct
3. ✅ Start accepting reservations
4. ✅ Set up availability schedules as needed
