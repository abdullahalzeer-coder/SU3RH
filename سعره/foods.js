/* ------------------------------------------------------------------
 * foods.js — ingredient database. All values are PER 100 g (or per 100 ml
 * for liquids), based on standard food-composition tables (USDA FoodData
 * Central and equivalents), rounded.
 *
 * They are reference values, not measurements of the specific food in your
 * hand: a fattier cut of lamb or a heavier pour of oil will differ. Cooked
 * weights are used where you'd normally weigh the food cooked (rice, pasta,
 * meat); raw where you'd weigh it raw (vegetables, fruit).
 *
 * f(key, ar, en, cat, kcal, protein, carbs, fat, micros, serving, unit)
 *   micros  — omitted keys default to 0
 *   serving — grams of a typical portion, used as the default amount when you
 *             tap the ingredient. Falls back to 100 g.
 *   unit    — { ar, en, g }: this food is counted in PIECES, not weighed. The
 *             builder then asks for a count (2 eggs) instead of grams, and
 *             `g` is what one piece weighs. Values above are still per 100 g.
 *
 * Meat is listed both RAW and COOKED, and they are not interchangeable: meat
 * loses roughly a quarter of its weight as water when cooked, so 100 g of raw
 * chicken becomes ~75 g cooked and is more calorie-dense per gram. Log whichever
 * state you actually put on the scale.
 * ------------------------------------------------------------------ */

const FOOD_CATS = [
  { key: 'all',       ar: 'الكل',        en: 'All' },
  { key: 'meat',      ar: 'لحوم ودواجن', en: 'Meat & poultry' },
  { key: 'fish',      ar: 'أسماك',       en: 'Fish & seafood' },
  { key: 'dairy',     ar: 'ألبان وبيض',  en: 'Dairy & eggs' },
  { key: 'grain',     ar: 'نشويات',      en: 'Grains & starches' },
  { key: 'legume',    ar: 'بقوليات',     en: 'Legumes' },
  { key: 'veg',       ar: 'خضار',        en: 'Vegetables' },
  { key: 'fruit',     ar: 'فواكه',       en: 'Fruit' },
  { key: 'nut',       ar: 'مكسرات وبذور',en: 'Nuts & seeds' },
  { key: 'fat',       ar: 'دهون وزيوت',  en: 'Fats & oils' },
  { key: 'dish',      ar: 'أطباق جاهزة', en: 'Prepared dishes' },
  { key: 'drink',     ar: 'مشروبات',     en: 'Drinks' },
  { key: 'sweet',     ar: 'حلويات',      en: 'Sweets' },
  { key: 'condiment', ar: 'توابل وصلصات',en: 'Sauces & condiments' },
  { key: 'custom',    ar: 'مكوناتي',      en: 'My ingredients' },
];

const f = (key, ar, en, cat, kcal, protein, carbs, fat, mi = {}, serving = 0, unit = null) => ({
  key, ar, en, cat, kcal, protein, carbs, fat, serving, unit,
  mi: {
    fiber: 0, sugar: 0, satfat: 0, sodium: 0, cholesterol: 0, potassium: 0,
    calcium: 0, iron: 0, magnesium: 0, zinc: 0, vitA: 0, vitC: 0, vitD: 0, vitB12: 0,
    ...mi,
  },
});

const FOODS = [
  /* ---------------- meat & poultry — COOKED ---------------- */
  f('chicken-breast', 'صدر دجاج (مطبوخ)', 'Chicken breast, cooked', 'meat', 165, 31, 0, 3.6,
    { satfat: 1.0, sodium: 74, cholesterol: 85, potassium: 256, calcium: 15, iron: 1.0, magnesium: 29, zinc: 1.0, vitA: 9, vitD: 0.1, vitB12: 0.3 }, 150),
  f('chicken-thigh', 'فخذ دجاج (مطبوخ، بدون جلد)', 'Chicken thigh, cooked, skinless', 'meat', 209, 26, 0, 11,
    { satfat: 3.0, sodium: 88, cholesterol: 135, potassium: 230, calcium: 12, iron: 1.3, magnesium: 23, zinc: 2.1, vitA: 18, vitD: 0.2, vitB12: 0.6 }, 120),
  f('chicken-skin-on', 'دجاج بالجلد (مطبوخ)', 'Chicken with skin, cooked', 'meat', 239, 27, 0, 14,
    { satfat: 3.8, sodium: 82, cholesterol: 88, potassium: 223, calcium: 15, iron: 1.3, magnesium: 23, zinc: 1.9, vitA: 48, vitD: 0.2, vitB12: 0.3 }, 150),
  f('beef-mince', 'لحم بقر مفروم ٩٠٪ (مطبوخ)', 'Ground beef 90%, cooked', 'meat', 217, 26, 0, 12,
    { satfat: 4.7, sodium: 72, cholesterol: 78, potassium: 318, calcium: 18, iron: 2.5, magnesium: 21, zinc: 5.8, vitD: 0.1, vitB12: 2.5 }, 125),
  f('beef-steak', 'ستيك لحم بقر (مطبوخ)', 'Beef steak, cooked', 'meat', 206, 29, 0, 9,
    { satfat: 3.5, sodium: 55, cholesterol: 80, potassium: 330, calcium: 20, iron: 1.7, magnesium: 25, zinc: 4.5, vitB12: 1.5 }, 170),
  f('lamb', 'لحم غنم (مطبوخ)', 'Lamb, cooked', 'meat', 258, 25, 0, 17,
    { satfat: 7.0, sodium: 72, cholesterol: 97, potassium: 310, calcium: 17, iron: 1.9, magnesium: 24, zinc: 4.5, vitB12: 2.6 }, 150),
  f('camel', 'لحم إبل (مطبوخ)', 'Camel meat, cooked', 'meat', 160, 27, 0, 5,
    { satfat: 2.0, sodium: 60, cholesterol: 85, potassium: 300, calcium: 12, iron: 3.0, magnesium: 20, zinc: 4.0, vitB12: 2.0 }, 150),
  f('turkey-breast', 'صدر ديك رومي (مطبوخ)', 'Turkey breast, cooked', 'meat', 135, 30, 0, 1,
    { satfat: 0.3, sodium: 60, cholesterol: 70, potassium: 250, calcium: 12, iron: 1.2, magnesium: 28, zinc: 1.7, vitB12: 0.4 }, 120),
  f('liver', 'كبد بقري (مطبوخ)', 'Beef liver, cooked', 'meat', 175, 27, 5, 5,
    { satfat: 1.9, sodium: 80, cholesterol: 396, potassium: 350, calcium: 6, iron: 6.5, magnesium: 21, zinc: 5.3, vitA: 9440, vitC: 1.6, vitD: 1.2, vitB12: 70 }, 100),

  /* ---------------- meat & poultry — RAW ----------------
   * Weigh here if you weigh before cooking. Same cut, fewer calories per gram,
   * because the water hasn't cooked off yet. */
  f('chicken-breast-raw', 'صدر دجاج (نيء)', 'Chicken breast, raw', 'meat', 120, 22.5, 0, 2.6,
    { satfat: 0.6, sodium: 45, cholesterol: 64, potassium: 334, calcium: 5, iron: 0.4, magnesium: 27, zinc: 0.7, vitA: 6, vitD: 0.1, vitB12: 0.2 }, 200),
  f('chicken-thigh-raw', 'فخذ دجاج (نيء، بدون جلد)', 'Chicken thigh, raw, skinless', 'meat', 121, 19.7, 0, 4.7,
    { satfat: 1.2, sodium: 86, cholesterol: 94, potassium: 230, calcium: 7, iron: 0.9, magnesium: 22, zinc: 1.5, vitA: 15, vitD: 0.1, vitB12: 0.5 }, 160),
  f('chicken-skin-on-raw', 'دجاج بالجلد (نيء)', 'Chicken with skin, raw', 'meat', 215, 18.6, 0, 15.1,
    { satfat: 4.3, sodium: 70, cholesterol: 75, potassium: 189, calcium: 11, iron: 0.9, magnesium: 20, zinc: 1.3, vitA: 40, vitD: 0.1, vitB12: 0.3 }, 200),
  f('beef-mince-raw', 'لحم بقر مفروم ٩٠٪ (نيء)', 'Ground beef 90%, raw', 'meat', 176, 20, 0, 10,
    { satfat: 4.0, sodium: 66, cholesterol: 62, potassium: 318, calcium: 14, iron: 2.0, magnesium: 20, zinc: 4.6, vitD: 0.1, vitB12: 2.1 }, 150),
  f('beef-steak-raw', 'ستيك لحم بقر (نيء)', 'Beef steak, raw', 'meat', 150, 21, 0, 7,
    { satfat: 2.7, sodium: 52, cholesterol: 62, potassium: 330, calcium: 17, iron: 1.5, magnesium: 22, zinc: 3.8, vitB12: 1.3 }, 200),
  f('lamb-raw', 'لحم غنم (نيء)', 'Lamb, raw', 'meat', 202, 18, 0, 14,
    { satfat: 6.2, sodium: 65, cholesterol: 70, potassium: 266, calcium: 9, iron: 1.6, magnesium: 22, zinc: 3.4, vitB12: 2.3 }, 180),
  f('camel-raw', 'لحم إبل (نيء)', 'Camel meat, raw', 'meat', 120, 21, 0, 2.9,
    { satfat: 1.2, sodium: 55, cholesterol: 70, potassium: 280, calcium: 10, iron: 2.5, magnesium: 18, zinc: 3.5, vitB12: 1.6 }, 180),
  f('turkey-breast-raw', 'صدر ديك رومي (نيء)', 'Turkey breast, raw', 'meat', 111, 24, 0, 0.7,
    { satfat: 0.2, sodium: 50, cholesterol: 60, potassium: 250, calcium: 9, iron: 0.9, magnesium: 25, zinc: 1.3, vitB12: 0.3 }, 150),
  f('liver-raw', 'كبد بقري (نيء)', 'Beef liver, raw', 'meat', 135, 20, 3.9, 3.6,
    { satfat: 1.2, sodium: 69, cholesterol: 275, potassium: 313, calcium: 5, iron: 4.9, magnesium: 18, zinc: 4.0, vitA: 4968, vitC: 1.3, vitD: 0.9, vitB12: 59 }, 120),

  /* ---------------- fish & seafood ---------------- */
  f('salmon', 'سلمون', 'Salmon, cooked', 'fish', 208, 22, 0, 13,
    { satfat: 3.1, sodium: 61, cholesterol: 63, potassium: 363, calcium: 9, iron: 0.3, magnesium: 29, zinc: 0.4, vitA: 12, vitD: 11, vitB12: 3.2 }, 150),
  f('tuna-canned', 'تونة معلبة بالماء', 'Tuna, canned in water', 'fish', 116, 26, 0, 1,
    { satfat: 0.2, sodium: 247, cholesterol: 42, potassium: 237, calcium: 11, iron: 1.3, magnesium: 28, zinc: 0.7, vitD: 1.7, vitB12: 2.2 }, 100),
  f('white-fish', 'سمك أبيض (هامور)', 'White fish (hamour/cod)', 'fish', 105, 23, 0, 0.9,
    { satfat: 0.2, sodium: 78, cholesterol: 55, potassium: 440, calcium: 18, iron: 0.4, magnesium: 36, zinc: 0.5, vitD: 1.0, vitB12: 1.0 }, 150),
  f('shrimp', 'روبيان', 'Shrimp, cooked', 'fish', 99, 24, 0.2, 0.3,
    { satfat: 0.1, sodium: 111, cholesterol: 189, potassium: 259, calcium: 70, iron: 0.5, magnesium: 39, zinc: 1.6, vitD: 0.1, vitB12: 1.1 }, 100),
  f('sardines', 'سردين معلب', 'Sardines, canned', 'fish', 208, 25, 0, 11,
    { satfat: 1.5, sodium: 307, cholesterol: 142, potassium: 397, calcium: 382, iron: 2.9, magnesium: 39, zinc: 1.3, vitD: 4.8, vitB12: 8.9 }, 90),

  /* ---------------- dairy & eggs ---------------- */
  // Counted in eggs, not grams. One large egg ≈ 50 g -> ~72 kcal.
  f('egg', 'بيض كامل', 'Egg, whole', 'dairy', 143, 13, 0.7, 9.5,
    { satfat: 3.1, sugar: 0.4, sodium: 142, cholesterol: 372, potassium: 138, calcium: 56, iron: 1.8, magnesium: 12, zinc: 1.3, vitA: 160, vitD: 2.0, vitB12: 0.9 },
    50, { ar: 'بيضة', en: 'egg', g: 50 }),
  f('egg-white', 'بياض بيض', 'Egg white', 'dairy', 52, 11, 0.7, 0.2,
    { sodium: 166, potassium: 163, calcium: 7, iron: 0.1, magnesium: 11, vitB12: 0.1 },
    33, { ar: 'بياض', en: 'white', g: 33 }),
  f('milk-whole', 'حليب كامل الدسم', 'Milk, whole', 'dairy', 61, 3.2, 4.8, 3.3,
    { satfat: 1.9, sugar: 4.8, sodium: 43, cholesterol: 10, potassium: 150, calcium: 113, magnesium: 10, zinc: 0.4, vitA: 46, vitD: 1.3, vitB12: 0.5 }, 250),
  f('milk-lowfat', 'حليب قليل الدسم', 'Milk, low-fat', 'dairy', 42, 3.4, 5, 1,
    { satfat: 0.6, sugar: 5.0, sodium: 44, cholesterol: 5, potassium: 150, calcium: 125, magnesium: 11, zinc: 0.4, vitA: 58, vitD: 1.2, vitB12: 0.5 }, 250),
  f('greek-yogurt', 'زبادي يوناني (خالي الدسم)', 'Greek yogurt, non-fat', 'dairy', 59, 10, 3.6, 0.4,
    { satfat: 0.1, sugar: 3.2, sodium: 36, cholesterol: 5, potassium: 141, calcium: 110, magnesium: 11, zinc: 0.5, vitB12: 0.75 }, 170),
  f('yogurt', 'لبن زبادي كامل', 'Yogurt, full-fat', 'dairy', 61, 3.5, 4.7, 3.3,
    { satfat: 2.1, sugar: 4.7, sodium: 46, cholesterol: 13, potassium: 155, calcium: 121, magnesium: 12, zinc: 0.6, vitA: 27, vitD: 0.1, vitB12: 0.4 }, 170),
  f('labneh', 'لبنة', 'Labneh', 'dairy', 174, 6.2, 4, 15,
    { satfat: 9.0, sugar: 4.0, sodium: 70, cholesterol: 40, potassium: 130, calcium: 110, magnesium: 12, zinc: 0.6, vitA: 120, vitD: 0.1, vitB12: 0.4 }, 30),
  f('white-cheese', 'جبن أبيض / فيتا', 'White cheese / feta', 'dairy', 264, 14, 4, 21,
    { satfat: 15, sugar: 4.0, sodium: 917, cholesterol: 89, potassium: 62, calcium: 493, iron: 0.7, magnesium: 19, zinc: 2.9, vitA: 125, vitD: 0.4, vitB12: 1.7 }, 30),
  f('halloumi', 'جبن حلوم', 'Halloumi', 'dairy', 321, 22, 2, 25,
    { satfat: 17, sugar: 2.0, sodium: 1200, cholesterol: 70, potassium: 80, calcium: 700, iron: 0.3, magnesium: 20, zinc: 2.5, vitA: 150, vitD: 0.3, vitB12: 1.2 }, 40),
  f('cheddar', 'جبن شيدر', 'Cheddar cheese', 'dairy', 403, 23, 3, 33,
    { satfat: 19, sugar: 0.5, sodium: 653, cholesterol: 105, potassium: 98, calcium: 710, iron: 0.7, magnesium: 28, zinc: 3.1, vitA: 265, vitD: 0.6, vitB12: 1.1 }, 30),
  f('cottage-cheese', 'جبن قريش', 'Cottage cheese', 'dairy', 98, 11, 3.4, 4.3,
    { satfat: 1.7, sugar: 2.7, sodium: 364, cholesterol: 17, potassium: 104, calcium: 83, magnesium: 8, zinc: 0.4, vitA: 37, vitB12: 0.4 }, 100),
  f('cream-cheese', 'جبن كريمي', 'Cream cheese', 'dairy', 350, 6, 5.5, 34,
    { satfat: 20, sugar: 3.8, sodium: 314, cholesterol: 101, potassium: 138, calcium: 97, magnesium: 9, zinc: 0.5, vitA: 308, vitD: 0.2, vitB12: 0.2 }, 30),

  /* ---------------- grains & starches (cooked unless noted) ---------------- */
  f('white-rice', 'أرز أبيض (مطبوخ)', 'White rice, cooked', 'grain', 130, 2.7, 28, 0.3,
    { fiber: 0.4, sugar: 0.1, satfat: 0.1, sodium: 1, potassium: 35, calcium: 10, iron: 0.2, magnesium: 12, zinc: 0.5 }, 150),
  f('brown-rice', 'أرز بني (مطبوخ)', 'Brown rice, cooked', 'grain', 123, 2.7, 26, 1,
    { fiber: 1.6, sugar: 0.4, satfat: 0.2, sodium: 4, potassium: 86, calcium: 10, iron: 0.6, magnesium: 39, zinc: 0.6 }, 150),
  /* Dry / uncooked — weigh here if you weigh before cooking. Rice and pasta
   * absorb water and roughly TRIPLE in weight, so 100 g dry rice becomes about
   * 300 g cooked. That is why dry looks so much more calorie-dense per gram. */
  f('white-rice-raw', 'أرز أبيض (ناشف)', 'White rice, dry', 'grain', 365, 7.1, 80, 0.7,
    { fiber: 1.3, sugar: 0.1, satfat: 0.2, sodium: 5, potassium: 115, calcium: 28, iron: 0.8, magnesium: 25, zinc: 1.1 }, 75),
  f('brown-rice-raw', 'أرز بني (ناشف)', 'Brown rice, dry', 'grain', 370, 7.9, 77, 2.9,
    { fiber: 3.5, sugar: 0.9, satfat: 0.6, sodium: 7, potassium: 223, calcium: 23, iron: 1.5, magnesium: 143, zinc: 2.0 }, 75),
  f('pasta-raw', 'معكرونة (ناشفة)', 'Pasta / macaroni, dry', 'grain', 371, 13, 75, 1.5,
    { fiber: 3.2, sugar: 2.7, satfat: 0.3, sodium: 6, potassium: 223, calcium: 21, iron: 1.3, magnesium: 53, zinc: 1.4 }, 85),

  f('arabic-bread', 'خبز عربي', 'Arabic bread (khubz)', 'grain', 275, 9, 55, 1.2,
    { fiber: 2.5, sugar: 1.5, satfat: 0.2, sodium: 500, potassium: 120, calcium: 90, iron: 3.2, magnesium: 25, zinc: 0.8 }, 60),
  f('white-bread', 'خبز أبيض', 'White bread', 'grain', 265, 9, 49, 3.2,
    { fiber: 2.7, sugar: 5.0, satfat: 0.7, sodium: 491, potassium: 115, calcium: 144, iron: 3.6, magnesium: 23, zinc: 0.7 }, 30),
  f('brown-bread', 'خبز أسمر', 'Whole-wheat bread', 'grain', 247, 13, 41, 3.4,
    { fiber: 7.0, sugar: 6.0, satfat: 0.7, sodium: 450, potassium: 250, calcium: 107, iron: 2.5, magnesium: 75, zinc: 1.8 }, 32),
  f('tamees', 'تميس / خبز تنور', 'Tamees / tandoor bread', 'grain', 290, 9, 57, 3,
    { fiber: 2.5, sugar: 2.0, satfat: 0.6, sodium: 480, potassium: 120, calcium: 60, iron: 3.0, magnesium: 28, zinc: 0.8 }, 120),
  f('pasta', 'معكرونة (مطبوخة)', 'Pasta, cooked', 'grain', 158, 6, 31, 0.9,
    { fiber: 1.8, sugar: 0.6, satfat: 0.2, sodium: 1, potassium: 44, calcium: 7, iron: 0.5, magnesium: 18, zinc: 0.5 }, 180),
  f('oats', 'شوفان (جاف)', 'Oats, dry', 'grain', 389, 17, 66, 7,
    { fiber: 10.6, sugar: 0.0, satfat: 1.2, sodium: 2, potassium: 429, calcium: 54, iron: 4.7, magnesium: 177, zinc: 4.0 }, 40),
  f('bulgur', 'برغل (مطبوخ)', 'Bulgur, cooked', 'grain', 83, 3, 19, 0.2,
    { fiber: 4.5, sugar: 0.1, sodium: 5, potassium: 68, calcium: 10, iron: 1.0, magnesium: 32, zinc: 0.6 }, 150),
  f('quinoa', 'كينوا (مطبوخة)', 'Quinoa, cooked', 'grain', 120, 4.4, 21, 1.9,
    { fiber: 2.8, sugar: 0.9, satfat: 0.2, sodium: 7, potassium: 172, calcium: 17, iron: 1.5, magnesium: 64, zinc: 1.1 }, 150),
  f('couscous', 'كسكس (مطبوخ)', 'Couscous, cooked', 'grain', 112, 3.8, 23, 0.2,
    { fiber: 1.4, sugar: 0.1, sodium: 5, potassium: 58, calcium: 8, iron: 0.4, magnesium: 8, zinc: 0.3 }, 150),
  f('potato', 'بطاطس مسلوقة', 'Potato, boiled', 'grain', 87, 1.9, 20, 0.1,
    { fiber: 1.8, sugar: 0.9, sodium: 4, potassium: 379, calcium: 8, iron: 0.3, magnesium: 20, zinc: 0.3, vitC: 13 }, 150),
  f('sweet-potato', 'بطاطا حلوة', 'Sweet potato', 'grain', 90, 2, 21, 0.2,
    { fiber: 3.3, sugar: 6.5, sodium: 36, potassium: 475, calcium: 38, iron: 0.7, magnesium: 27, zinc: 0.3, vitA: 709, vitC: 12.8 }, 150),
  f('fries', 'بطاطس مقلية', 'French fries', 'grain', 312, 3.4, 41, 15,
    { fiber: 3.8, sugar: 0.3, satfat: 2.3, sodium: 210, potassium: 579, calcium: 18, iron: 0.8, magnesium: 30, zinc: 0.4, vitC: 9 }, 120),

  /* ---------------- legumes ---------------- */
  f('lentils', 'عدس (مطبوخ)', 'Lentils, cooked', 'legume', 116, 9, 20, 0.4,
    { fiber: 7.9, sugar: 1.8, sodium: 2, potassium: 369, calcium: 19, iron: 3.3, magnesium: 36, zinc: 1.3, vitC: 1.5 }, 150),
  f('chickpeas', 'حمص حب (مطبوخ)', 'Chickpeas, cooked', 'legume', 164, 8.9, 27, 2.6,
    { fiber: 7.6, sugar: 4.8, satfat: 0.3, sodium: 7, potassium: 291, calcium: 49, iron: 2.9, magnesium: 48, zinc: 1.5, vitC: 1.3 }, 150),
  f('fava-beans', 'فول مدمس', 'Fava beans (foul), cooked', 'legume', 110, 7.6, 19, 0.4,
    { fiber: 5.4, sugar: 1.8, sodium: 5, potassium: 268, calcium: 36, iron: 1.5, magnesium: 36, zinc: 1.0, vitC: 0.3 }, 200),
  f('kidney-beans', 'فاصولياء حمراء', 'Kidney beans, cooked', 'legume', 127, 8.7, 23, 0.5,
    { fiber: 6.4, sugar: 0.3, sodium: 1, potassium: 405, calcium: 28, iron: 2.9, magnesium: 45, zinc: 1.0, vitC: 1.2 }, 150),
  f('white-beans', 'فاصولياء بيضاء', 'White beans, cooked', 'legume', 139, 9.7, 25, 0.4,
    { fiber: 6.3, sugar: 0.3, sodium: 6, potassium: 561, calcium: 90, iron: 3.7, magnesium: 63, zinc: 1.0 }, 150),
  f('hummus-dip', 'حمص بالطحينة', 'Hummus (dip)', 'legume', 166, 7.9, 14, 9.6,
    { fiber: 6.0, sugar: 0.3, satfat: 1.4, sodium: 379, potassium: 228, calcium: 38, iron: 2.4, magnesium: 71, zinc: 1.8, vitC: 0.8 }, 60),

  /* ---------------- vegetables (raw) ---------------- */
  f('tomato', 'طماطم', 'Tomato', 'veg', 18, 0.9, 3.9, 0.2,
    { fiber: 1.2, sugar: 2.6, sodium: 5, potassium: 237, calcium: 10, iron: 0.3, magnesium: 11, zinc: 0.2, vitA: 42, vitC: 14 }, 120),
  f('cucumber', 'خيار', 'Cucumber', 'veg', 15, 0.7, 3.6, 0.1,
    { fiber: 0.5, sugar: 1.7, sodium: 2, potassium: 147, calcium: 16, iron: 0.3, magnesium: 13, zinc: 0.2, vitA: 5, vitC: 2.8 }, 100),
  f('onion', 'بصل', 'Onion', 'veg', 40, 1.1, 9.3, 0.1,
    { fiber: 1.7, sugar: 4.2, sodium: 4, potassium: 146, calcium: 23, iron: 0.2, magnesium: 10, zinc: 0.2, vitC: 7.4 }, 80),
  f('lettuce', 'خس', 'Lettuce', 'veg', 15, 1.4, 2.9, 0.2,
    { fiber: 1.3, sugar: 0.8, sodium: 28, potassium: 194, calcium: 36, iron: 0.9, magnesium: 13, zinc: 0.2, vitA: 370, vitC: 9.2 }, 50),
  f('spinach', 'سبانخ', 'Spinach', 'veg', 23, 2.9, 3.6, 0.4,
    { fiber: 2.2, sugar: 0.4, sodium: 79, potassium: 558, calcium: 99, iron: 2.7, magnesium: 79, zinc: 0.5, vitA: 469, vitC: 28 }, 80),
  f('broccoli', 'بروكلي', 'Broccoli', 'veg', 34, 2.8, 6.6, 0.4,
    { fiber: 2.6, sugar: 1.7, sodium: 33, potassium: 316, calcium: 47, iron: 0.7, magnesium: 21, zinc: 0.4, vitA: 31, vitC: 89 }, 100),
  f('carrot', 'جزر', 'Carrot', 'veg', 41, 0.9, 9.6, 0.2,
    { fiber: 2.8, sugar: 4.7, sodium: 69, potassium: 320, calcium: 33, iron: 0.3, magnesium: 12, zinc: 0.2, vitA: 835, vitC: 5.9 }, 80),
  f('bell-pepper', 'فلفل رومي', 'Bell pepper', 'veg', 31, 1, 6, 0.3,
    { fiber: 2.1, sugar: 4.2, sodium: 4, potassium: 211, calcium: 7, iron: 0.4, magnesium: 12, zinc: 0.3, vitA: 157, vitC: 128 }, 120),
  f('eggplant', 'باذنجان', 'Eggplant', 'veg', 25, 1, 5.9, 0.2,
    { fiber: 3.0, sugar: 3.5, sodium: 2, potassium: 229, calcium: 9, iron: 0.2, magnesium: 14, zinc: 0.2, vitC: 2.2 }, 100),
  f('zucchini', 'كوسا', 'Zucchini', 'veg', 17, 1.2, 3.1, 0.3,
    { fiber: 1.0, sugar: 2.5, sodium: 8, potassium: 261, calcium: 16, iron: 0.4, magnesium: 18, zinc: 0.3, vitA: 10, vitC: 17.9 }, 120),
  f('cauliflower', 'قرنبيط', 'Cauliflower', 'veg', 25, 1.9, 5, 0.3,
    { fiber: 2.0, sugar: 1.9, sodium: 30, potassium: 299, calcium: 22, iron: 0.4, magnesium: 15, zinc: 0.3, vitC: 48 }, 100),
  f('okra', 'بامية', 'Okra', 'veg', 33, 1.9, 7, 0.2,
    { fiber: 3.2, sugar: 1.5, sodium: 7, potassium: 299, calcium: 82, iron: 0.6, magnesium: 57, zinc: 0.6, vitA: 36, vitC: 23 }, 100),
  f('mushroom', 'فطر', 'Mushrooms', 'veg', 22, 3.1, 3.3, 0.3,
    { fiber: 1.0, sugar: 2.0, sodium: 5, potassium: 318, calcium: 3, iron: 0.5, magnesium: 9, zinc: 0.5, vitD: 0.2, vitB12: 0.04 }, 80),
  f('green-peas', 'بازلاء', 'Green peas', 'veg', 81, 5.4, 14, 0.4,
    { fiber: 5.7, sugar: 5.7, sodium: 5, potassium: 244, calcium: 25, iron: 1.5, magnesium: 33, zinc: 1.2, vitA: 38, vitC: 40 }, 100),
  f('corn', 'ذرة', 'Sweetcorn', 'veg', 96, 3.4, 21, 1.5,
    { fiber: 2.4, sugar: 4.5, satfat: 0.2, sodium: 15, potassium: 270, calcium: 2, iron: 0.5, magnesium: 37, zinc: 0.5, vitC: 6.8 }, 100),
  f('parsley', 'بقدونس', 'Parsley', 'veg', 36, 3, 6.3, 0.8,
    { fiber: 3.3, sugar: 0.9, sodium: 56, potassium: 554, calcium: 138, iron: 6.2, magnesium: 50, zinc: 1.1, vitA: 421, vitC: 133 }, 30),

  /* ---------------- fruit ---------------- */
  f('dates', 'تمر', 'Dates', 'fruit', 282, 2.5, 75, 0.4,
    { fiber: 8.0, sugar: 63, sodium: 2, potassium: 656, calcium: 39, iron: 1.0, magnesium: 43, zinc: 0.4 }, 24),
  f('banana', 'موز', 'Banana', 'fruit', 89, 1.1, 23, 0.3,
    { fiber: 2.6, sugar: 12, sodium: 1, potassium: 358, calcium: 5, iron: 0.3, magnesium: 27, zinc: 0.2, vitC: 8.7 }, 120),
  f('apple', 'تفاح', 'Apple', 'fruit', 52, 0.3, 14, 0.2,
    { fiber: 2.4, sugar: 10, sodium: 1, potassium: 107, calcium: 6, iron: 0.1, magnesium: 5, zinc: 0.04, vitC: 4.6 }, 180),
  f('orange', 'برتقال', 'Orange', 'fruit', 47, 0.9, 12, 0.1,
    { fiber: 2.4, sugar: 9.4, potassium: 181, calcium: 40, iron: 0.1, magnesium: 10, zinc: 0.07, vitA: 11, vitC: 53 }, 130),
  f('grapes', 'عنب', 'Grapes', 'fruit', 69, 0.7, 18, 0.2,
    { fiber: 0.9, sugar: 16, sodium: 2, potassium: 191, calcium: 10, iron: 0.4, magnesium: 7, zinc: 0.1, vitC: 3.2 }, 100),
  f('watermelon', 'بطيخ', 'Watermelon', 'fruit', 30, 0.6, 7.6, 0.2,
    { fiber: 0.4, sugar: 6.2, sodium: 1, potassium: 112, calcium: 7, iron: 0.2, magnesium: 10, zinc: 0.1, vitA: 28, vitC: 8.1 }, 200),
  f('mango', 'مانجو', 'Mango', 'fruit', 60, 0.8, 15, 0.4,
    { fiber: 1.6, sugar: 14, sodium: 1, potassium: 168, calcium: 11, iron: 0.2, magnesium: 10, zinc: 0.1, vitA: 54, vitC: 36 }, 150),
  f('strawberry', 'فراولة', 'Strawberries', 'fruit', 32, 0.7, 7.7, 0.3,
    { fiber: 2.0, sugar: 4.9, sodium: 1, potassium: 153, calcium: 16, iron: 0.4, magnesium: 13, zinc: 0.1, vitC: 58.8 }, 100),
  f('avocado', 'أفوكادو', 'Avocado', 'fruit', 160, 2, 8.5, 14.7,
    { fiber: 6.7, sugar: 0.7, satfat: 2.1, sodium: 7, potassium: 485, calcium: 12, iron: 0.6, magnesium: 29, zinc: 0.6, vitA: 7, vitC: 10 }, 100),
  f('fig', 'تين', 'Figs', 'fruit', 74, 0.8, 19, 0.3,
    { fiber: 2.9, sugar: 16, sodium: 1, potassium: 232, calcium: 35, iron: 0.4, magnesium: 17, zinc: 0.2, vitC: 2 }, 50),

  /* ---------------- nuts & seeds ---------------- */
  f('almonds', 'لوز', 'Almonds', 'nut', 579, 21, 22, 50,
    { fiber: 12.5, sugar: 4.4, satfat: 3.8, sodium: 1, potassium: 733, calcium: 269, iron: 3.7, magnesium: 270, zinc: 3.1 }, 28),
  f('walnuts', 'جوز', 'Walnuts', 'nut', 654, 15, 14, 65,
    { fiber: 6.7, sugar: 2.6, satfat: 6.1, sodium: 2, potassium: 441, calcium: 98, iron: 2.9, magnesium: 158, zinc: 3.1, vitC: 1.3 }, 28),
  f('cashews', 'كاجو', 'Cashews', 'nut', 553, 18, 30, 44,
    { fiber: 3.3, sugar: 5.9, satfat: 7.8, sodium: 12, potassium: 660, calcium: 37, iron: 6.7, magnesium: 292, zinc: 5.8 }, 28),
  f('pistachio', 'فستق', 'Pistachios', 'nut', 560, 20, 28, 45,
    { fiber: 10, sugar: 7.7, satfat: 5.9, sodium: 1, potassium: 1025, calcium: 105, iron: 3.9, magnesium: 121, zinc: 2.2, vitC: 5.6 }, 28),
  f('peanut-butter', 'زبدة فول سوداني', 'Peanut butter', 'nut', 588, 25, 20, 50,
    { fiber: 6.0, sugar: 9.0, satfat: 10, sodium: 17, potassium: 649, calcium: 43, iron: 1.9, magnesium: 154, zinc: 2.9 }, 32),
  f('tahini', 'طحينة', 'Tahini', 'nut', 595, 17, 21, 54,
    { fiber: 9.3, sugar: 0.5, satfat: 7.6, sodium: 115, potassium: 414, calcium: 426, iron: 8.9, magnesium: 95, zinc: 4.6 }, 15),
  f('sunflower-seeds', 'بذور دوار الشمس', 'Sunflower seeds', 'nut', 584, 21, 20, 51,
    { fiber: 8.6, sugar: 2.6, satfat: 4.5, sodium: 9, potassium: 645, calcium: 78, iron: 5.3, magnesium: 325, zinc: 5.0, vitC: 1.4 }, 28),

  /* ---------------- fats & oils ---------------- */
  f('olive-oil', 'زيت زيتون', 'Olive oil', 'fat', 884, 0, 0, 100,
    { satfat: 13.8, sodium: 2, potassium: 1, iron: 0.6 }, 14),
  f('vegetable-oil', 'زيت نباتي', 'Vegetable oil', 'fat', 884, 0, 0, 100,
    { satfat: 10 }, 14),
  f('butter', 'زبدة', 'Butter', 'fat', 717, 0.9, 0.1, 81,
    { satfat: 51, sugar: 0.1, sodium: 11, cholesterol: 215, potassium: 24, calcium: 24, vitA: 684, vitD: 1.5, vitB12: 0.2 }, 14),
  f('ghee', 'سمن', 'Ghee', 'fat', 900, 0, 0, 100,
    { satfat: 62, cholesterol: 256, vitA: 840, vitD: 1.5 }, 14),
  f('mayonnaise', 'مايونيز', 'Mayonnaise', 'fat', 680, 1, 0.6, 75,
    { satfat: 11, sugar: 0.6, sodium: 635, cholesterol: 42, potassium: 20, calcium: 8, vitA: 40, vitD: 0.4 }, 15),

  /* ---------------- prepared dishes ---------------- */
  f('kabsa', 'كبسة', 'Kabsa (rice & chicken)', 'dish', 180, 9, 22, 6,
    { fiber: 1.0, sugar: 1.2, satfat: 1.8, sodium: 380, cholesterol: 30, potassium: 180, calcium: 20, iron: 1.2, magnesium: 20, zinc: 0.9, vitA: 60, vitC: 3, vitB12: 0.2 }, 300),
  f('shawarma', 'شاورما', 'Shawarma', 'dish', 250, 16, 18, 13,
    { fiber: 1.5, sugar: 1.5, satfat: 4.0, sodium: 620, cholesterol: 45, potassium: 250, calcium: 45, iron: 1.8, magnesium: 25, zinc: 2.0, vitA: 30, vitC: 4, vitB12: 0.9 }, 200),
  f('falafel', 'فلافل', 'Falafel', 'dish', 333, 13, 32, 18,
    { fiber: 5.0, sugar: 1.0, satfat: 2.4, sodium: 294, potassium: 585, calcium: 54, iron: 3.4, magnesium: 82, zinc: 1.5, vitC: 1.6 }, 60),
  f('mutabbal', 'متبل', 'Mutabbal / baba ghanoush', 'dish', 150, 2.5, 8, 13,
    { fiber: 3.5, sugar: 3.0, satfat: 1.9, sodium: 320, potassium: 250, calcium: 60, iron: 1.0, magnesium: 30, zinc: 0.5, vitC: 3 }, 60),
  f('tabbouleh', 'تبولة', 'Tabbouleh', 'dish', 120, 2.5, 12, 7,
    { fiber: 3.0, sugar: 1.5, satfat: 1.0, sodium: 250, potassium: 300, calcium: 50, iron: 2.0, magnesium: 25, zinc: 0.5, vitA: 150, vitC: 40 }, 100),
  f('pizza', 'بيتزا', 'Pizza', 'dish', 266, 11, 33, 10,
    { fiber: 2.3, sugar: 3.6, satfat: 4.5, sodium: 598, cholesterol: 17, potassium: 172, calcium: 188, iron: 2.5, magnesium: 23, zinc: 1.3, vitA: 68, vitB12: 0.4 }, 120),
  f('burger', 'برجر', 'Beef burger (sandwich)', 'dish', 295, 17, 24, 14,
    { fiber: 1.5, sugar: 4.5, satfat: 5.5, sodium: 500, cholesterol: 45, potassium: 240, calcium: 100, iron: 2.6, magnesium: 24, zinc: 3.0, vitA: 30, vitB12: 1.5 }, 200),
  f('grilled-kebab', 'كباب مشوي', 'Grilled kebab', 'dish', 230, 20, 4, 15,
    { fiber: 0.5, sugar: 1.0, satfat: 6.0, sodium: 450, cholesterol: 70, potassium: 280, calcium: 25, iron: 2.2, magnesium: 22, zinc: 4.0, vitB12: 2.0 }, 150),

  /* ---------------- drinks (per 100 ml) ---------------- */
  f('coffee-black', 'قهوة سادة', 'Black coffee', 'drink', 2, 0.1, 0, 0,
    { potassium: 49, magnesium: 3 }, 240),
  f('arabic-coffee', 'قهوة عربية', 'Arabic coffee (qahwa)', 'drink', 3, 0.1, 0.5, 0,
    { potassium: 55, magnesium: 4 }, 60),
  f('tea', 'شاي بدون سكر', 'Tea, unsweetened', 'drink', 1, 0, 0.3, 0,
    { potassium: 37, magnesium: 3 }, 240),
  f('ayran', 'لبن عيران', 'Ayran / laban', 'drink', 40, 1.7, 2.5, 2.5,
    { sugar: 2.5, satfat: 1.6, sodium: 130, cholesterol: 8, potassium: 100, calcium: 65, magnesium: 8, zinc: 0.3, vitB12: 0.2 }, 250),
  f('orange-juice', 'عصير برتقال', 'Orange juice', 'drink', 45, 0.7, 10.4, 0.2,
    { fiber: 0.2, sugar: 8.4, sodium: 1, potassium: 200, calcium: 11, iron: 0.2, magnesium: 11, vitA: 5, vitC: 50 }, 250),
  f('cola', 'مشروب غازي', 'Cola / soft drink', 'drink', 42, 0, 10.6, 0,
    { sugar: 10.6, sodium: 4, potassium: 2 }, 330),

  /* ---------------- sweets ---------------- */
  f('sugar', 'سكر', 'Sugar', 'sweet', 387, 0, 100, 0,
    { sugar: 100 }, 4),
  f('honey', 'عسل', 'Honey', 'sweet', 304, 0.3, 82, 0,
    { sugar: 82, sodium: 4, potassium: 52, calcium: 6, iron: 0.4, magnesium: 2 }, 21),
  f('dark-chocolate', 'شوكولاتة داكنة ٧٠٪', 'Dark chocolate 70%', 'sweet', 598, 7.8, 46, 43,
    { fiber: 11, sugar: 24, satfat: 24, sodium: 20, potassium: 715, calcium: 73, iron: 11.9, magnesium: 228, zinc: 3.3 }, 30),
  f('milk-chocolate', 'شوكولاتة بالحليب', 'Milk chocolate', 'sweet', 535, 7.6, 59, 30,
    { fiber: 3.4, sugar: 52, satfat: 18, sodium: 79, cholesterol: 23, potassium: 372, calcium: 189, iron: 2.4, magnesium: 63, zinc: 2.3, vitA: 60, vitB12: 0.7 }, 30),
  f('ice-cream', 'آيس كريم', 'Ice cream', 'sweet', 207, 3.5, 24, 11,
    { fiber: 0.7, sugar: 21, satfat: 6.8, sodium: 80, cholesterol: 44, potassium: 199, calcium: 128, iron: 0.1, magnesium: 14, zinc: 0.7, vitA: 118, vitD: 0.2, vitB12: 0.4 }, 100),
  f('luqaimat', 'لقيمات', 'Luqaimat', 'sweet', 400, 4, 50, 20,
    { fiber: 1.5, sugar: 25, satfat: 3.5, sodium: 150, potassium: 80, calcium: 25, iron: 1.5, magnesium: 15, zinc: 0.5 }, 60),
  f('kunafa', 'كنافة', 'Kunafa', 'sweet', 350, 6, 40, 18,
    { fiber: 1.0, sugar: 25, satfat: 9.0, sodium: 200, cholesterol: 40, potassium: 120, calcium: 130, iron: 1.2, magnesium: 15, zinc: 0.8, vitA: 130 }, 100),

  /* ---------------- sauces & condiments ---------------- */
  f('salt', 'ملح', 'Salt', 'condiment', 0, 0, 0, 0,
    { sodium: 38758, calcium: 24, iron: 0.3, magnesium: 1 }, 2),
  f('ketchup', 'كاتشب', 'Ketchup', 'condiment', 101, 1.0, 25, 0.1,
    { fiber: 0.3, sugar: 21, sodium: 907, potassium: 281, calcium: 15, iron: 0.4, magnesium: 13, vitA: 21, vitC: 4 }, 15),
  f('soy-sauce', 'صلصة صويا', 'Soy sauce', 'condiment', 53, 8, 4.9, 0.1,
    { fiber: 0.8, sugar: 0.4, sodium: 5493, potassium: 217, calcium: 33, iron: 1.9, magnesium: 43, zinc: 0.5 }, 15),
  f('garlic', 'ثوم', 'Garlic', 'condiment', 149, 6.4, 33, 0.5,
    { fiber: 2.1, sugar: 1.0, satfat: 0.1, sodium: 17, potassium: 401, calcium: 181, iron: 1.7, magnesium: 25, zinc: 1.2, vitC: 31 }, 5),
  f('lemon-juice', 'عصير ليمون', 'Lemon juice', 'condiment', 22, 0.4, 6.9, 0.2,
    { fiber: 0.3, sugar: 2.5, sodium: 1, potassium: 103, calcium: 6, iron: 0.1, magnesium: 6, vitC: 39 }, 15),
];

const FOOD_BY_KEY = Object.fromEntries(FOODS.map(x => [x.key, x]));
