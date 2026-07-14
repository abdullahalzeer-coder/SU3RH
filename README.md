# سعره — Se3ra

تطبيق تتبّع السعرات والبروتين والكربوهيدرات والدهون، مع تحليل صور الوجبات بالذكاء الاصطناعي.
يعمل على الآيفون كتطبيق مستقل (PWA) بدون App Store.

A calorie / protein / carbs / fat tracker with AI meal-photo scanning. Installs on iPhone as a
standalone app (PWA) — no App Store, no build step, no dependencies.

---

## 1. Put it online (required for iPhone)

iOS only allows "Add to Home Screen" from an **HTTPS** page, so the folder has to be hosted.
Easiest option, no account or tooling needed:

1. Open **https://app.netlify.com/drop**
2. Drag this whole `سعره` folder onto the page.
3. You get an HTTPS URL like `https://something-random.netlify.app`.
   (Sign in with a free account if you want that URL to stick around permanently.)

Any static host works the same way — GitHub Pages, Vercel, Cloudflare Pages.

## 2. Install on your iPhone

1. Open the URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch it from the home screen. It runs full screen with its own icon, and works offline.

## 3. Add an AI key (for photo scanning only)

You can use **any of three providers** — pick one in **الإعدادات / Settings → الذكاء الاصطناعي**,
paste that provider's key, and press Save.

| Provider | Get a key | Default model |
|---|---|---|
| Claude (Anthropic) | console.anthropic.com/settings/keys | `claude-opus-4-8` |
| Gemini (Google) | aistudio.google.com/apikey | `gemini-2.0-flash` |
| OpenAI (ChatGPT) | platform.openai.com/api-keys | `gpt-4o` |

The **Model** field is editable — when a provider ships a newer model, just type its name. You don't
need a code change, and you don't need to wait for me.

Keys are stored per provider, so you can keep all three saved and switch between them freely. A key
lives in your phone's browser storage and is sent only to the provider you selected.

Every other feature (manual entry, saved meals, goals, weight, micronutrients) works with no key at all.

**Cost:** a fraction of a US cent per photo on any of them. Set a spend limit in the provider's
console if you want a hard ceiling.

---

## Features

- **حلقة السعرات** — daily calorie ring + protein / carbs / fat progress bars against your goals.
- **المغذيات الدقيقة** — micronutrients. 8 tracked by default (fiber, sugar, saturated fat, sodium,
  cholesterol, potassium, calcium, iron) and 6 more you can switch on in Settings (magnesium, zinc,
  vitamins A, C, D, B12). Each has an editable daily target. Nutrients you want to *reach* fill
  green; nutrients you want to *stay under* (sodium, sugar, saturated fat, cholesterol) turn red
  once you pass them.
- **تحليل الصور** — photograph a meal; the AI identifies each item and estimates calories, macros
  **and micronutrients**. You can correct any number before adding it — correcting an item's
  calories rescales its macros *and* micros proportionally, so the entry stays consistent.
- **بناء وجبة من المكونات** — build a meal from a **122-ingredient database**. Search (in Arabic or
  English) or filter by category, tap an ingredient, type its weight in grams, and the calories,
  macros and micronutrients are computed and summed live. Tapping the same ingredient twice adds
  another portion. This is the most *accurate* way to log — a scale beats any photo estimate.

  Meat, rice and pasta are listed **raw/dry and cooked separately**, because they are not
  interchangeable — cooking changes the weight, so the calories per gram change with it:
  - Meat *loses* about a quarter of its weight as water. Raw chicken breast is 120 kcal/100 g;
    cooked is 165.
  - Rice and pasta *absorb* water and roughly **triple** in weight. Dry white rice is 365 kcal/100 g;
    cooked is 130.

  Log whichever state you actually put on the scale. If you weigh your rice dry before cooking, use
  the ناشف / dry entry.

  Eggs are **counted, not weighed** — "2 eggs" (72 kcal each), not "100 g of egg". Half-units work.

- **مكوناتي المخصصة** — save your own ingredients, two ways:
  - **📷 Scan the label.** Photograph the Nutrition Facts panel on a package. The AI *transcribes*
    it (it is told to read, never to estimate — a nutrient not printed on the label comes back as
    zero rather than a plausible guess). It converts the per-serving figures to the per-100 g basis
    the database uses, and keeps the label's own serving as a countable unit — so "3 pretzels (28 g)"
    can be logged as *2 servings*, not *56 grams*.
  - **✏️ By hand.** Type the values in, optionally with micronutrients.

  Saved ingredients appear in the normal ingredient search with a ⭐, filed under whatever category
  you choose, and all together under **مكوناتي / My ingredients**.
- **إدخال يدوي** — manual entry. Micronutrients sit in an optional collapsed section: fill in the
  ones you know, leave the rest blank. Option to save any meal as a favorite (favorites remember
  their micronutrients too).
- **وجبات محفوظة** — searchable favorites, re-added in one tap.
- **الوزن** — weight log with a 60-day trend chart and a 30-day change readout.
- **أهداف تلقائية** — **Calculate & apply** sets your calories, macros *and* micronutrient targets
  together from age / sex / height / weight / activity / goal:
  - Calories via Mifflin-St Jeor; protein scales with bodyweight and goal; fat at 25% of intake.
  - Fiber, sugar and saturated fat scale with your **calorie goal** (14 g fiber per 1000 kcal;
    sugar and saturated fat each capped at 10% of energy).
  - Iron, calcium, potassium, magnesium, zinc and vitamins A / C / D scale with your **sex and
    age** (e.g. iron is 18 mg for a woman under 50 and 8 mg for a man; calcium rises after 50).
  - Sodium (2300 mg), cholesterol (300 mg) and B12 (2.4 µg) stay fixed — those recommendations
    genuinely don't depend on body size.

  Every target stays editable afterwards. Note that re-running the auto-calculation **overwrites
  targets you edited by hand**.
- **عربي / English** — full RTL Arabic and English, toggled from the top bar.
- Works offline; browse and log past days.

## Your data

Everything is stored **on your device only** (`localStorage`). There is no server and no account.

That means: clearing Safari's website data, or deleting the app, **erases your history**.
Use **الإعدادات → تصدير نسخة / Settings → Export backup** regularly — it saves a JSON file you
can re-import on any device.

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup / app shell |
| `styles.css` | All styling |
| `app.js` | State, storage, rendering, event wiring |
| `ai.js` | Claude / Gemini / OpenAI adapters + image downscaling |
| `nutrients.js` | Micronutrient definitions (units, targets, goal-vs-limit) |
| `foods.js` | Ingredient database — 122 foods, per 100 g |
| `i18n.js` | Arabic + English strings |
| `sw.js` | Service worker (offline caching) |
| `manifest.webmanifest` | PWA metadata |
| `icons/` | App icons |

`nutrients.js` is the single source of truth for micronutrients — the AI request schema, the
manual-entry fields, the Today bars and the Settings list are all generated from that one array.
To add a nutrient, add one line there and nothing else.

To add an **ingredient**, add one `f(...)` line to `foods.js` — it appears in search immediately.
Values are per 100 g, from standard food-composition tables. They describe a *typical* example of
that food; a fattier cut of lamb or a heavier pour of oil will differ from the table.

## Notes for later

- The API key currently lives in the app on your phone. That's fine for a private, single-user
  app. If you ever share this URL with other people, move the call behind a serverless proxy that
  holds the key — only the `url` and `headers` of an adapter in `ai.js` need to change.
- AI portion estimates are estimates. They are good at identifying food, rough at guessing how much
  oil went into the pan, and roughest of all on vitamins. Treat fiber/sodium/sugar as useful, and
  the vitamin figures as a ballpark. Correct the numbers when you know better.
