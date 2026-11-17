// Equipment categories, so researchers can pick from a short list instead of one long dropdown.
// A category saved on the equipment (equipment.category) always wins; otherwise it is guessed from the name.

export const EQUIPMENT_CATEGORIES = [
  'Chromatography & Mass Spectrometry',
  'Spectroscopy',
  'Molecular Biology & Genetics',
  'Microscopy & Imaging',
  'Incubation & Culture',
  'Sterilization & Safety Cabinets',
  'Sample Preparation',
  'Analyzers & Readers',
  'Other',
];

// Order matters: the first matching rule wins.
const RULES = [
  ['Chromatography & Mass Spectrometry', /hplc|gc[\s-]?ms|lc[\s-]?ms|mass spec|chromatograph/i],
  ['Spectroscopy', /nmr|ftir|spectrophotomet|uv[\s-]?vis|spectromet|raman|\bicp\b|\baas\b/i],
  ['Molecular Biology & Genetics', /pcr|thermocycler|thermal cycler|electrophoresis|sequenc|gel doc|electroporat|\bdna\b|\brna\b|extractor|genetic/i],
  ['Microscopy & Imaging', /microscop|imaging|camera/i],
  ['Incubation & Culture', /incubat|ferment|cryopreserv|shaker|bioreactor|culture/i],
  ['Sterilization & Safety Cabinets', /autoclave|steriliz|biosafety|laminar|fume hood|cabinet|\bhood\b/i],
  ['Sample Preparation', /evaporator|ultrason|sonicat|freeze|lyophil|balance|centrifug|homogeniz|grinder|\bmill\b|vortex|stirrer|hot plate|\boven\b|water bath/i],
  ['Analyzers & Readers', /plate reader|reader|analy[sz]er|\bmeter\b|zetasizer|particle/i],
];

export const guessCategory = (name = '') => {
  const hit = RULES.find(([, re]) => re.test(name || ''));
  return hit ? hit[0] : 'Other';
};

export const categoryOf = (eq) => {
  const saved = typeof eq?.category === 'string' ? eq.category.trim() : '';
  return saved || guessCategory(eq?.name);
};

// Position of a category in the standard list (custom categories go after it, alphabetically).
export const categoryRank = (category) => {
  const i = EQUIPMENT_CATEGORIES.indexOf(category);
  return i === -1 ? EQUIPMENT_CATEGORIES.length - 1 + 0.5 : i;
};

export const compareCategories = (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b);

// [{ category, count }] for the equipment that exists, in a stable, friendly order.
export const summarizeCategories = (equipmentList = []) => {
  const counts = new Map();
  equipmentList.forEach((eq) => {
    const c = categoryOf(eq);
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((x, y) => compareCategories(x.category, y.category));
};