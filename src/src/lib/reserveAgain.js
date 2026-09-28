// Helpers for the "Reserve Again" feature.
//
// A user picks one of their earlier (approved) reservations and is sent to the
// normal reserve form with everything pre-filled EXCEPT the schedule. They edit
// what changed and submit, which saves a brand-new reservation (the old one is
// never touched).

// members_list is stored as "Full Name — Student No. 2023xxxx"; turn it back
// into { name, studentNumber } rows for the form.
export const parseMembers = (list) => {
  const rows = (Array.isArray(list) ? list : [])
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => {
      const [name, rest = ''] = String(entry).split(/\s+—\s+Student No\.\s*/);
      return { name: (name || '').trim(), studentNumber: rest.trim() };
    })
    .filter((m) => m.name);
  return rows.length ? rows : [{ name: '', studentNumber: '' }];
};

const commonFields = (r) => ({
  phone: r.phone ? String(r.phone) : '',
  unit_college: r.unit_college || '',
  adviser_name: r.adviser_name || '',
  study_title: r.study_title || '',
  special_requirements: r.special_requirements || '',
  stakeholder_type: r.stakeholder_type || '',
  members: parseMembers(r.members_list),
});

const idLabel = (prefix, id) => `${prefix}${String(id).padStart(5, '0')}`;

/**
 * @param {{ items: Array }} group  a lab reservation group (one row, or a multi-lab batch)
 */
export const buildLabPrefill = (group) => {
  const items = [...group.items].sort((a, b) => a.id - b.id);
  const primary = items[0];
  return {
    kind: 'lab',
    sourceLabel: `#${idLabel('RC', primary.id)}`,
    ...commonFields(primary),
    purpose: primary.research_purpose || '',
    // Labs keep their order; equipment points at the lab row it was reserved under.
    labs: items.map((it) => ({ labId: it.laboratory_id })),
    equipments: items.flatMap((it, labIdx) =>
      (it.reservation_equipment || [])
        .filter((re) => re.equipment?.id)
        .map((re) => ({
          equipmentId: re.equipment.id,
          quantity: re.quantity_reserved || 1,
          labIdx,
        }))
    ),
  };
};

/**
 * @param {{ items: Array }} group  an equipment reservation group (one row, or a multi-item batch)
 */
export const buildEquipmentPrefill = (group) => {
  const items = [...group.items].sort((a, b) => a.id - b.id);
  const primary = items[0];
  return {
    kind: 'equipment',
    sourceLabel: `#${idLabel('EQ', primary.id)}`,
    ...commonFields(primary),
    purpose: primary.purpose || '',
    equipments: items.map((it) => ({
      equipmentId: it.equipment_id,
      quantity: it.quantity_reserved || 1,
    })),
  };
};
