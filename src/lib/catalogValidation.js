const normalize = (value) => String(value || '').trim().toLocaleLowerCase();

export const isDuplicateLaboratory = (laboratories, candidate, excludeId) => {
  const code = normalize(candidate.lab_code);
  const name = normalize(candidate.lab_name);
  const floor = normalize(candidate.floor);

  return laboratories.some((lab) =>
    lab.id !== excludeId && (
      normalize(lab.lab_code) === code ||
      (normalize(lab.lab_name) === name && normalize(lab.floor) === floor)
    )
  );
};

export const isDuplicateEquipment = (items, candidate, excludeId) => {
  const name = normalize(candidate.name);
  const brand = normalize(candidate.brand);
  const model = normalize(candidate.model);
  const laboratoryId = candidate.laboratory_id == null ? null : Number(candidate.laboratory_id);

  return items.some((item) =>
    item.id !== excludeId &&
    normalize(item.name) === name &&
    normalize(item.brand) === brand &&
    normalize(item.model) === model &&
    (item.laboratory_id == null ? null : Number(item.laboratory_id)) === laboratoryId
  );
};

export const catalogDuplicateErrorMessage = (error, type) => {
  if (error?.message?.includes('DUPLICATE_LABORATORY')) {
    return 'A laboratory with the same code or the same name and floor already exists.';
  }
  if (error?.message?.includes('DUPLICATE_EQUIPMENT')) {
    return 'This equipment with the same name, brand, model, and laboratory already exists.';
  }
  return `Failed to ${type}: ${error?.message || 'Unknown error'}`;
};
