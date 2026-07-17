# Build prompt — paste everything below into a fresh Claude conversation

---

Build me a calorie and nutrition tracking app called **سعره** ("Se3ra"). I'll use it on my iPhone. Read this whole spec, ask me the few questions at the end, then build it.

## Hard constraints (read first)

- My machine has **no Node.js, no npm, and no working Python**. So: **no build step, no framework, no bundler, no dependencies.** Plain HTML + CSS + vanilla JS that a browser loads directly. If you propose anything that needs `npm install`, I can't run it.
- It must install on an iPhone as a **PWA** (Progressive Web App) — a web manifest, a service worker, and Apple touch-icon meta tags, so I can open it in Safari and "Add to Home Screen" and it runs full-screen with its own icon and works offline.
- To test it locally you can spin up a static file server (e.g. a PowerShell `System.Net.HttpListener` one-liner) — but the shipped app is just static files.

## What the app does

A daily tracker for **calories, protein, carbs, fat, and micronutrients**, with four ways to log food and cloud sync. Bilingual **Arabic (RTL) and English**, toggled from a button in the top bar. All data stored in `localStorage` by default.

### 1. Today screen
- A big **calorie ring** (SVG) showing calories eaten vs. daily goal, with "remaining / over" shown as a pill.
- **Macro progress bars** for protein / carbs / fat against goals.
- A **micronutrient card**: 8 shown by default (fiber, sugar, saturated fat, sodium, cholesterol, potassium, calcium, iron) with a further 6 toggleable in Settings (magnesium, zinc, vitamins A/C/D/B12). Each has an editable daily target and a progress bar. Distinguish **goals to reach** (fill green, exceeding is fine) from **limits to stay under** (sodium, sugar, saturated fat, cholesterol — turn red once exceeded). This distinction matters; don't paint "too much sodium" the same as "plenty of fiber."
- A list of the day's meals, each deletable. Arrows to browse previous days.

### 2. Four ways to add food
1. **AI photo scan** — I photograph a meal; an AI vision model identifies each item and estimates calories, macros **and** micronutrients. Show a confidence badge and a per-item breakdown I can edit before adding. Editing an item's calories must rescale its macros AND micros proportionally so the numbers stay consistent.
2. **Build from an ingredient database** — a searchable database of ~120 ingredients (per-100g values for macros + all micros), weighted toward Gulf/Middle Eastern food (kabsa, shawarma, foul, tamees, dates, labneh, etc.). Search in Arabic or English, filter by category, tap an ingredient, type its weight in grams; totals compute live. Meat and rice/pasta must be listed **both raw and cooked separately** (cooking changes weight, so calories-per-gram differ). Eggs are **counted per-piece**, not weighed.
3. **Custom ingredients** — I save my own ingredients two ways: type the values manually, OR **photograph a Nutrition Facts label** and have the AI transcribe it (read, never estimate — nutrients not printed on the label come back as zero). Convert the label's per-serving values to the per-100g basis the database uses, and keep the label's serving as a countable unit (so "3 pretzels (28g)" logs as *2 servings*, not *56 grams*). Saved ingredients appear in the normal ingredient search.
4. **Manual entry** — name + calories + macros, with micronutrients in an optional collapsed section. Option to save any meal as a reusable favorite.

### 3. AI provider — pick one of three
Support **Claude (Anthropic), Gemini (Google), and OpenAI (ChatGPT)**. In Settings I choose the provider and paste that provider's API key; the key is stored per-provider in `localStorage` and the request goes straight from the browser to that provider (Claude needs the `anthropic-dangerous-direct-browser-access` header). Make the **model name an editable text field** with a sensible default per provider, so a newer model never needs a code change. All three must return the SAME normalized result shape so the rest of the app doesn't care which is used.

### 4. Other tabs
- **Weight** — log weight over time, show current / 30-day change / starting weight, and a trend chart (hand-drawn SVG, no chart library).
- **Settings** — daily goals (manual, or **auto-calculated** from age/sex/height/weight/activity/goal using Mifflin-St Jeor). The auto-calc must set calories, macros AND micronutrient targets together: fiber/sugar/saturated-fat scale with the calorie goal; iron/calcium/vitamins scale with sex and age; sodium/cholesterol/B12 stay fixed. Also: micronutrient toggles + targets, the AI provider/key, cloud-sync login, and data export/import (JSON backup).

### 5. Cloud sync (optional, via Firebase)
- Email/password login + Firestore. Loads from a CDN as an ES module so there's still no build step. One document per user holding the whole state blob.
- **Critical merge behavior:** the first time I sign in on a device, MERGE local + cloud (union of meals/weights/saved/custom, newest-wins for settings) so turning sync on can never lose data. After that first merge the cloud is authoritative, so deletes actually propagate instead of being resurrected.
- Leave it fully optional: if the Firebase config file is empty, the app runs exactly as before, device-only. Include Firestore security rules that restrict each user to their own document, and make clear the Firebase web config is public by design (the rules are what protect the data).

## Design
Light "Notion-style" UI: soft lavender-grey canvas, white rounded cards with soft shadows (not hard borders), emoji as icons, **green for actions/progress, blue for selection/links**, red for limits/danger. Bottom tab bar (Today / Add / Weight / Settings). Full RTL for Arabic. Make it responsive — it must look right on a 375px-wide phone with no horizontal scroll and nothing clipped at the screen edges.

## Architecture
Keep it modular, one concern per file: markup, styles, app logic/state, an AI adapter layer (the three providers behind one interface), a nutrients definitions file (units/targets/goal-vs-limit — generate the AI schema, form fields, bars and settings from this one array), the ingredient database, the i18n strings, the cloud/Firebase layer, the service worker, the manifest, and icons. Store everything under one `localStorage` key with a migration path so older saved states still load.

## Gotchas I already hit — save yourself the trouble
- Make the **service worker network-first**, not cache-first. A cache-first worker pins users to the first version they ever loaded and they never get updates.
- **Validate the AI's numbers** — clamp saturated fat to ≤ total fat, sugar to ≤ total carbs, and zero out negatives. Models occasionally return impossible values that would corrupt daily totals.
- Rank ingredient search so a whole-word match beats a mid-word substring (Arabic example: searching بيض/egg shouldn't surface سمك أبيض/white fish first).
- Don't send an `effort` parameter on the Claude request — some models (Haiku) reject it.
- Arabic pluralizes differently (1 = singular, 2 = dual, 3–10 = plural, 11+ = singular) — handle count labels properly.

## Deploy
Host it free on **GitHub Pages** from a public repo (Pages is free only on public repos). Nothing sensitive goes in the repo — the API key is pasted at runtime, personal data lives on-device, and the Firebase config is public anyway once deployed. A push to `main` is the deploy.

## Before you start, ask me:
1. UI language — Arabic + English toggle, or one language?
2. Which AI provider(s) should I wire up first, and do I want cloud sync now or later?
3. Anything about the ingredient list I want tailored to what I actually eat?

Then build it, test it in a browser at phone width before telling me it's done, and give me step-by-step instructions to get it onto my iPhone and to get an AI API key.
