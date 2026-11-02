import { describe, expect, it } from 'vitest';
import { isDuplicateEquipment, isDuplicateLaboratory } from './catalogValidation';

describe('catalog duplicate validation', () => {
  it('matches laboratories by code regardless of case or surrounding spaces', () => {
    expect(isDuplicateLaboratory(
      [{ id: 1, lab_code: 'CHEM-01', lab_name: 'Chemistry Lab', floor: 'Second Floor' }],
      { lab_code: ' chem-01 ', lab_name: 'Other Name', floor: 'Third Floor' }
    )).toBe(true);
  });

  it('matches laboratories by name and floor when the code differs', () => {
    expect(isDuplicateLaboratory(
      [{ id: 1, lab_code: 'CHEM-01', lab_name: 'Chemistry Lab', floor: 'Second Floor' }],
      { lab_code: 'CHEM-02', lab_name: ' chemistry lab ', floor: ' second floor ' }
    )).toBe(true);
  });

  it('allows editing the same laboratory and a same name on another floor', () => {
    const labs = [{ id: 1, lab_code: 'CHEM-01', lab_name: 'Chemistry Lab', floor: 'Second Floor' }];
    expect(isDuplicateLaboratory(labs, labs[0], 1)).toBe(false);
    expect(isDuplicateLaboratory(labs, {
      lab_code: 'CHEM-02',
      lab_name: 'Chemistry Lab',
      floor: 'Third Floor',
    })).toBe(false);
  });

  it('matches equipment by name, brand, model, and laboratory', () => {
    const equipment = [{
      id: 1,
      name: 'Digital Microscope',
      brand: 'Olympus',
      model: 'CX23',
      laboratory_id: 3,
    }];
    expect(isDuplicateEquipment(equipment, {
      name: ' digital microscope ',
      brand: 'olympus',
      model: 'cx23',
      laboratory_id: '3',
    })).toBe(true);
    expect(isDuplicateEquipment(equipment, {
      name: 'Digital Microscope',
      brand: 'Olympus',
      model: 'CX23',
      laboratory_id: 4,
    })).toBe(false);
    expect(isDuplicateEquipment(equipment, equipment[0], 1)).toBe(false);
  });
});
