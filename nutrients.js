/* ------------------------------------------------------------------
 * nutrients.js — single source of truth for micronutrients.
 * Both the AI schema (ai.js) and the UI (app.js) are generated from this,
 * so adding a nutrient here is the only edit needed to support it.
 *
 * kind:   'goal'  -> aim to reach the target  (bar fills green)
 *         'limit' -> aim to stay under it     (bar turns red once exceeded)
 * core:   shown by default; the rest are opt-in from Settings.
 * target: generic adult fallback, used before any profile exists.
 * derive: personalised target, from { sex, age, cal }. Omitted where the
 *         recommendation genuinely does not depend on the person — sodium and
 *         cholesterol are population-wide ceilings, and B12 is a flat number.
 *
 * Sources: fiber 14 g/1000 kcal (US Dietary Guidelines); free sugars and
 * saturated fat each <10% of energy (WHO); the rest are US RDA/AI values,
 * which vary by sex and age band.
 * ------------------------------------------------------------------ */

const NUTRIENTS = [
  // --- core 8 ---
  {
    key: 'fiber', field: 'fiber_g', unit: 'g', ar: 'ألياف', en: 'Fiber',
    target: 25, kind: 'goal', core: true,
    derive: ({ cal }) => Math.round((14 * cal) / 1000),
  },
  {
    key: 'sugar', field: 'sugar_g', unit: 'g', ar: 'سكريات', en: 'Sugar',
    target: 50, kind: 'limit', core: true,
    derive: ({ cal }) => Math.round((0.10 * cal) / 4), // <10% of energy
  },
  {
    key: 'satfat', field: 'sat_fat_g', unit: 'g', ar: 'دهون مشبعة', en: 'Saturated fat',
    target: 20, kind: 'limit', core: true,
    derive: ({ cal }) => Math.round((0.10 * cal) / 9), // <10% of energy
  },
  {
    key: 'sodium', field: 'sodium_mg', unit: 'mg', ar: 'صوديوم', en: 'Sodium',
    target: 2300, kind: 'limit', core: true, // population-wide ceiling
  },
  {
    key: 'cholesterol', field: 'cholesterol_mg', unit: 'mg', ar: 'كوليسترول', en: 'Cholesterol',
    target: 300, kind: 'limit', core: true, // population-wide ceiling
  },
  {
    key: 'potassium', field: 'potassium_mg', unit: 'mg', ar: 'بوتاسيوم', en: 'Potassium',
    target: 3500, kind: 'goal', core: true,
    derive: ({ sex }) => (sex === 'male' ? 3400 : 2600),
  },
  {
    key: 'calcium', field: 'calcium_mg', unit: 'mg', ar: 'كالسيوم', en: 'Calcium',
    target: 1000, kind: 'goal', core: true,
    derive: ({ sex, age }) => {
      if (age <= 18) return 1300;
      if (age >= 71) return 1200;
      if (age >= 51 && sex === 'female') return 1200;
      return 1000;
    },
  },
  {
    key: 'iron', field: 'iron_mg', unit: 'mg', ar: 'حديد', en: 'Iron',
    target: 14, kind: 'goal', core: true,
    derive: ({ sex, age }) => {
      if (sex === 'female') {
        if (age <= 18) return 15;
        return age <= 50 ? 18 : 8; // higher through the menstruating years
      }
      return age <= 18 ? 11 : 8;
    },
  },

  // --- optional 6 ---
  {
    key: 'magnesium', field: 'magnesium_mg', unit: 'mg', ar: 'مغنيسيوم', en: 'Magnesium',
    target: 400, kind: 'goal', core: false,
    derive: ({ sex, age }) => {
      if (sex === 'male') return age <= 18 ? 410 : age <= 30 ? 400 : 420;
      return age <= 18 ? 360 : age <= 30 ? 310 : 320;
    },
  },
  {
    key: 'zinc', field: 'zinc_mg', unit: 'mg', ar: 'زنك', en: 'Zinc',
    target: 11, kind: 'goal', core: false,
    derive: ({ sex, age }) => (sex === 'male' ? 11 : age <= 18 ? 9 : 8),
  },
  {
    key: 'vitA', field: 'vit_a_ug', unit: 'ug', ar: 'فيتامين A', en: 'Vitamin A',
    target: 900, kind: 'goal', core: false,
    derive: ({ sex }) => (sex === 'male' ? 900 : 700),
  },
  {
    key: 'vitC', field: 'vit_c_mg', unit: 'mg', ar: 'فيتامين C', en: 'Vitamin C',
    target: 90, kind: 'goal', core: false,
    derive: ({ sex }) => (sex === 'male' ? 90 : 75),
  },
  {
    key: 'vitD', field: 'vit_d_ug', unit: 'ug', ar: 'فيتامين D', en: 'Vitamin D',
    target: 15, kind: 'goal', core: false,
    derive: ({ age }) => (age >= 71 ? 20 : 15),
  },
  {
    key: 'vitB12', field: 'vit_b12_ug', unit: 'ug', ar: 'فيتامين B12', en: 'Vitamin B12',
    target: 2.4, kind: 'goal', core: false, // flat across adults
  },
];

const UNIT_LABEL = {
  ar: { g: 'غ', mg: 'ملغ', ug: 'مكغ' },
  en: { g: 'g', mg: 'mg', ug: 'µg' },
};

const CORE_KEYS = NUTRIENTS.filter(n => n.core).map(n => n.key);
const DEFAULT_TARGETS = Object.fromEntries(NUTRIENTS.map(n => [n.key, n.target]));
const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map(n => [n.key, n]));

/**
 * Personalised micronutrient targets.
 * Nutrients without a `derive` keep their generic value on purpose.
 * @param {{sex:string, age:number}} profile
 * @param {number} cal  the daily calorie goal (fiber/sugar/sat-fat scale with it)
 */
function calcMicroTargets(profile, cal) {
  const ctx = { sex: profile.sex, age: +profile.age, cal: +cal };
  const out = {};
  for (const n of NUTRIENTS) out[n.key] = n.derive ? n.derive(ctx) : n.target;
  return out;
}
