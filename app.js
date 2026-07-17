/* ------------------------------------------------------------------
 * app.js — state, storage, rendering, and all the wiring.
 * Everything is kept in localStorage under a single key.
 * ------------------------------------------------------------------ */

const STORE_KEY = 'seera.v1';
const keyStore = p => `seera.key.${p}`; // one key per provider, so switching keeps both

const DEFAULT_STATE = {
  lang: 'ar',
  goals: { cal: 2000, protein: 150, carbs: 200, fat: 65 },
  profile: { age: 25, sex: 'male', height: 175, weight: 75, act: '1.375', goalType: 'cut' },
  ai: { provider: 'claude', model: '' },      // '' = use the provider default
  micros: { enabled: [...CORE_KEYS], targets: { ...DEFAULT_TARGETS } },
  customFoods: [],  // same shape as FOODS entries, with custom: true
  days: {},      // "YYYY-MM-DD" -> [ {id, name, cal, p, c, f, mi:{}} ]
  weights: [],   // [ {date, kg} ] sorted ascending
  saved: [],     // [ {id, name, cal, p, c, f, mi:{}} ]
};

let S = load();
let viewDate = todayISO();
let scanDraft = null;          // photo items awaiting confirmation
let builder = [];              // [{ key, grams }] — the meal being composed
let builderCat = 'all';
let builderNameTouched = false; // stop auto-naming once the user types their own

/* ---------- storage ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    const s = { ...structuredClone(DEFAULT_STATE), ...saved };
    // Merge nested defaults so states written by older versions still load.
    s.ai = { ...DEFAULT_STATE.ai, ...(saved.ai || {}) };
    s.micros = {
      enabled: saved.micros?.enabled ?? [...CORE_KEYS],
      targets: { ...DEFAULT_TARGETS, ...(saved.micros?.targets || {}) },
    };
    return s;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch {
    toast('Storage full — export a backup and clear old data.', true);
  }
  schedulePush();   // no-op unless signed in
}
const getKey = p => localStorage.getItem(keyStore(p || S.ai.provider)) || '';
const setKey = (p, k) => k ? localStorage.setItem(keyStore(p), k) : localStorage.removeItem(keyStore(p));
const activeModel = () => S.ai.model || PROVIDERS[S.ai.provider].defaultModel;

/* ---------- helpers ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const t = key => (I18N[S.lang][key] ?? I18N.en[key] ?? key);
const uid = () => Math.random().toString(36).slice(2, 10);
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const nName = n => (S.lang === 'ar' ? n.ar : n.en);
const nUnit = n => UNIT_LABEL[S.lang][n.unit];
/* small values (vit D, B12) need a decimal; big ones (sodium) don't */
const nFmt = (n, v) => (n.target < 10 ? Math.round(v * 10) / 10 : Math.round(v));

const enabledNutrients = () => NUTRIENTS.filter(n => S.micros.enabled.includes(n.key));

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}
function entriesFor(iso) { return S.days[iso] || []; }

function totalsFor(iso) {
  return entriesFor(iso).reduce((a, e) => ({
    cal: a.cal + e.cal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f,
  }), { cal: 0, p: 0, c: 0, f: 0 });
}

function microTotalsFor(iso) {
  const out = Object.fromEntries(NUTRIENTS.map(n => [n.key, 0]));
  for (const e of entriesFor(iso)) {
    for (const n of NUTRIENTS) out[n.key] += Number(e.mi?.[n.key]) || 0;
  }
  return out;
}

/* Arabic counts don't pluralise like English: 1 -> singular, 2 -> dual,
 * 3-10 -> plural, 11+ -> back to singular. */
function plural(n, kind) {
  const forms = {
    ar: { meal: ['وجبة', 'وجبتان', 'وجبات', 'وجبة'], entry: ['قياس', 'قياسان', 'قياسات', 'قياس'] },
    en: { meal: ['meal', 'meals', 'meals', 'meals'], entry: ['entry', 'entries', 'entries', 'entries'] },
  }[S.lang][kind];
  const i = n === 1 ? 0 : n === 2 ? 1 : (n >= 3 && n <= 10) ? 2 : 3;
  return `${n} ${forms[i]}`;
}

let toastTimer;
function toast(msg, isErr = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- i18n ---------- */
function applyLang() {
  const ar = S.lang === 'ar';
  document.documentElement.lang = ar ? 'ar' : 'en';
  document.documentElement.dir = ar ? 'rtl' : 'ltr';
  $('#langTxt').textContent = ar ? 'EN' : 'عربي';
  $('.lang-ava').textContent = ar ? 'ع' : 'EN';

  $$('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val) el.textContent = val;
  });
  render();
}

/* ================= RENDER ================= */
function render() {
  renderDate();
  renderTotals();
  renderMicros();
  renderEntries();
  renderSaved();
  renderWeight();
  renderSettings();
  renderMicroSettings();
  renderManualMicros();
  renderCats();
  renderFoodResults();
  renderBuilder();
  renderCustomMicroInputs();
  renderCustomList();
  renderCustomCats();
}

function renderCustomCats() {
  $('#cfCat').innerHTML = FOOD_CATS
    .filter(c => c.key !== 'all')
    .map(c => `<option value="${c.key}">${esc(catName(c))}</option>`).join('');
  $('#cfCat').value = 'custom';
}

function renderDate() {
  const today = todayISO();
  let label;
  if (viewDate === today) label = t('today');
  else if (viewDate === shiftISO(today, -1)) label = t('yesterday');
  else {
    const [y, m, d] = viewDate.split('-').map(Number);
    label = new Date(y, m - 1, d).toLocaleDateString(
      S.lang === 'ar' ? 'ar-SA' : 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'short' }
    );
  }
  $('#dateLabel').textContent = label;

  const atToday = viewDate >= today;
  const next = $('#nextDay');
  next.disabled = atToday;
  next.classList.toggle('is-on', !atToday);
  $('#prevDay').classList.toggle('is-on', atToday);
}

function renderTotals() {
  const tot = totalsFor(viewDate);
  const g = S.goals;

  $('#calEaten').textContent = r0(tot.cal);
  $('#calGoal').textContent = g.cal;

  const diff = g.cal - tot.cal;
  const leftEl = $('#calLeft');
  leftEl.textContent = diff >= 0
    ? `${r0(diff)} ${t('kcal')} ${t('left')}`
    : `${r0(-diff)} ${t('kcal')} ${t('over')}`;
  leftEl.classList.toggle('over', diff < 0);

  const CIRC = 2 * Math.PI * 86;
  const pct = Math.min(1, g.cal ? tot.cal / g.cal : 0);
  const ring = $('#calRing');
  ring.style.strokeDashoffset = String(CIRC * (1 - pct));
  ring.classList.toggle('over', tot.cal > g.cal);

  for (const [k, val, goal] of [['p', tot.p, g.protein], ['c', tot.c, g.carbs], ['f', tot.f, g.fat]]) {
    $(`#${k}Val`).textContent = r0(val);
    $(`#${k}Goal`).textContent = goal;
    $(`#${k}Bar`).style.width = `${Math.min(100, goal ? (val / goal) * 100 : 0)}%`;
  }
}

/* --- micronutrients on the Today tab --- */
function renderMicros() {
  const list = enabledNutrients();
  $('#microCard').hidden = list.length === 0;
  if (!list.length) return;

  const tot = microTotalsFor(viewDate);

  $('#microList').innerHTML = list.map(n => {
    const val = tot[n.key];
    const target = S.micros.targets[n.key] || 0;
    const pct = target ? Math.min(100, (val / target) * 100) : 0;
    const over = target && val > target;
    const isLimit = n.kind === 'limit';

    // A limit is a ceiling, so exceeding it is bad (red). A goal is a floor,
    // so exceeding it is fine — never paint that red.
    const cls = isLimit ? (over ? 'over' : 'limit') : 'goal';

    return `
      <div class="micro">
        <div class="macro-head">
          <span class="macro-name">
            ${esc(nName(n))}
            <em class="micro-kind">${isLimit ? t('limitWord') : t('targetWord')}</em>
          </span>
          <span class="macro-num">
            <b>${nFmt(n, val)}</b> / ${nFmt(n, target)} ${esc(nUnit(n))}
          </span>
        </div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function macroLine(e) {
  return `<i class="mp">${t('protein')} ${r1(e.p)}${t('g')}</i> · ` +
         `<i class="mc">${t('carbs')} ${r1(e.c)}${t('g')}</i> · ` +
         `<i class="mf">${t('fat')} ${r1(e.f)}${t('g')}</i>`;
}

function renderEntries() {
  const list = $('#entryList');
  const items = entriesFor(viewDate);
  const tot = totalsFor(viewDate);

  $('#entryCount').textContent = items.length
    ? `${plural(items.length, 'meal')} · ${r0(tot.cal)} ${t('kcal')}`
    : t('noMealsShort');

  $('#entryEmpty').hidden = items.length > 0;
  list.innerHTML = items.map(e => `
    <div class="item">
      <div class="item-ico">🍽️</div>
      <div class="item-main">
        <div class="item-name">${esc(e.name)}</div>
        <div class="item-macros">${macroLine(e)}</div>
      </div>
      <div class="item-cal">${r0(e.cal)} <small>${t('kcal')}</small></div>
      <button class="item-del" type="button" data-del="${e.id}" aria-label="delete">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => {
      S.days[viewDate] = entriesFor(viewDate).filter(x => x.id !== b.dataset.del);
      if (!S.days[viewDate].length) delete S.days[viewDate];
      save(); renderTotals(); renderMicros(); renderEntries();
      toast(t('deleted'));
    };
  });
}

function renderSaved() {
  const q = ($('#savedSearch').value || '').trim().toLowerCase();
  const meals = S.saved.filter(m => !q || m.name.toLowerCase().includes(q));

  $('#savedEmpty').hidden = S.saved.length > 0;
  $('#savedList').innerHTML = meals.map(m => `
    <div class="item">
      <div class="item-ico">⭐</div>
      <div class="item-main">
        <div class="item-name">${esc(m.name)}</div>
        <div class="item-macros">${macroLine(m)}</div>
      </div>
      <div class="item-cal">${r0(m.cal)} <small>${t('kcal')}</small></div>
      <button class="item-add" type="button" data-quick="${m.id}" aria-label="add">+</button>
      <button class="item-del" type="button" data-unsave="${m.id}" aria-label="remove">✕</button>
    </div>`).join('');

  $('#savedList').querySelectorAll('[data-quick]').forEach(b => {
    b.onclick = () => {
      const m = S.saved.find(x => x.id === b.dataset.quick);
      if (m) {
        addEntry({ name: m.name, cal: m.cal, p: m.p, c: m.c, f: m.f, mi: m.mi });
        toast(t('added'));
      }
    };
  });
  $('#savedList').querySelectorAll('[data-unsave]').forEach(b => {
    b.onclick = () => {
      S.saved = S.saved.filter(x => x.id !== b.dataset.unsave);
      save(); renderSaved();
    };
  });
}

/* --- optional micro inputs on the manual-entry form --- */
function renderManualMicros() {
  const list = enabledNutrients();
  $('#manualMicroWrap').hidden = list.length === 0;
  if (!list.length) return;

  $('#microInputs').innerHTML = list.map(n => `
    <label class="field">
      <span>${esc(nName(n))} <em class="unit">${esc(nUnit(n))}</em></span>
      <input type="number" min="0" step="0.1" inputmode="decimal"
             placeholder="0" data-mi="${n.key}">
    </label>`).join('');
}

function readManualMicros() {
  const mi = {};
  $$('#microInputs [data-mi]').forEach(inp => {
    const v = parseFloat(inp.value);
    if (isFinite(v) && v > 0) mi[inp.dataset.mi] = v;
  });
  return mi;
}

/* ================= MEAL BUILDER ================= */
const foodName = fd => (S.lang === 'ar' ? fd.ar : fd.en);
const catName = c => (S.lang === 'ar' ? c.ar : c.en);

/* Built-ins plus your own saved ingredients, as one list. */
const allFoods = () => [...FOODS, ...S.customFoods];
const foodBy = key => FOOD_BY_KEY[key] || S.customFoods.find(x => x.key === key);

/* Foods with a `unit` are counted (2 eggs), not weighed (100 g). */
const isCounted = fd => !!(fd.unit && fd.unit.g > 0);
const unitName = fd => (S.lang === 'ar' ? fd.unit.ar : fd.unit.en);
/** kcal of one piece, for a counted food. */
const kcalPerUnit = fd => Math.round((fd.kcal * fd.unit.g) / 100);

/** Scale one ingredient's per-100g values to the weighed amount. */
function scaleFood(fd, grams) {
  const k = grams / 100;
  const mi = {};
  for (const n of NUTRIENTS) mi[n.key] = (fd.mi[n.key] || 0) * k;
  return { cal: fd.kcal * k, p: fd.protein * k, c: fd.carbs * k, f: fd.fat * k, mi };
}

function builderTotals() {
  const tot = { cal: 0, p: 0, c: 0, f: 0, mi: Object.fromEntries(NUTRIENTS.map(n => [n.key, 0])) };
  for (const row of builder) {
    const fd = foodBy(row.key);
    if (!fd) continue;
    const s = scaleFood(fd, row.grams);
    tot.cal += s.cal; tot.p += s.p; tot.c += s.c; tot.f += s.f;
    for (const n of NUTRIENTS) tot.mi[n.key] += s.mi[n.key];
  }
  return tot;
}

function renderCats() {
  $('#catRow').innerHTML = FOOD_CATS.map(c => `
    <button class="cat ${c.key === builderCat ? 'is-on' : ''}" type="button" data-cat="${c.key}">
      ${esc(catName(c))}
    </button>`).join('');

  $$('#catRow [data-cat]').forEach(b => {
    b.onclick = () => { builderCat = b.dataset.cat; renderCats(); renderFoodResults(); };
  });
}

/* Rank a match: a name that STARTS with the query beats one where a later word
 * does, which beats a match buried mid-word. Without this, searching "بيض"
 * (egg) surfaces "سمك أبيض" first, because بيض sits inside أبيض. */
function matchScore(fd, q) {
  let best = 99;
  for (const name of [fd.ar.toLowerCase(), fd.en.toLowerCase()]) {
    if (!name.includes(q)) continue;
    if (name.startsWith(q)) best = Math.min(best, 0);
    else if (name.split(/[\s(،,\-]+/).some(w => w.startsWith(q))) best = Math.min(best, 1);
    else best = Math.min(best, 2);
  }
  return best;
}

function renderFoodResults() {
  const q = ($('#foodSearch').value || '').trim().toLowerCase();

  let hits = allFoods().filter(fd => {
    if (builderCat === 'all') return true;
    // "My ingredients" means everything you created, whatever category you filed
    // it under — otherwise your own salt-free sauce hides among the built-in ones.
    if (builderCat === 'custom') return !!fd.custom;
    return fd.cat === builderCat;
  });
  if (q) {
    hits = hits
      .map(fd => ({ fd, score: matchScore(fd, q) }))
      .filter(x => x.score < 99)
      .sort((a, b) => a.score - b.score)
      .map(x => x.fd);
  }
  hits = hits.slice(0, 60);

  $('#foodResults').innerHTML = hits.length
    ? hits.map(fd => {
        // Show what you'd actually log it in: kcal per egg, or kcal per 100 g.
        const per = isCounted(fd)
          ? `${kcalPerUnit(fd)} <small>${t('perOne')} ${esc(unitName(fd))}</small>`
          : `${fd.kcal} <small>${t('per100')}</small>`;
        return `
          <button class="food" type="button" data-food="${esc(fd.key)}">
            <span class="food-name">${fd.custom ? '⭐ ' : ''}${esc(foodName(fd))}</span>
            <span class="food-kcal">${per}</span>
          </button>`;
      }).join('')
    : `<p class="muted small center" style="padding:12px">${esc(t('noFoodFound'))}</p>`;

  $$('#foodResults [data-food]').forEach(b => b.onclick = () => addToBuilder(b.dataset.food));
}

function addToBuilder(key) {
  const fd = foodBy(key);
  if (!fd) return;

  // A food with a piece weight defaults to piece mode ("1 tomato"); anything
  // else is weighed. Either way `grams` is the source of truth — `mode` only
  // decides how the amount is shown, so switching units never changes intake.
  const piece = isCounted(fd);
  const stepFor = row => (row.mode === 'piece' ? fd.unit.g : (fd.serving || 100));

  const existing = builder.find(r => r.key === key);
  if (existing) existing.grams += stepFor(existing);   // tapping again adds another
  else builder.push({ key, grams: piece ? fd.unit.g : (fd.serving || 100), mode: piece ? 'piece' : 'g' });

  renderBuilder();
}

function autoName() {
  if (builderNameTouched || !builder.length) return;
  const names = builder.map(r => foodName(foodBy(r.key)));
  $('#btName').value = names.slice(0, 3).join(' + ') + (names.length > 3 ? ' …' : '');
}

function renderBuilder() {
  $('#builder').hidden = builder.length === 0;
  if (!builder.length) return;

  $('#builderList').innerHTML = builder.map((row, i) => {
    const fd = foodBy(row.key);
    const s = scaleFood(fd, row.grams);
    const canPiece = isCounted(fd);
    const inPiece = canPiece && row.mode === 'piece';

    // In piece mode the input shows a count (2 tomatoes); in grams it shows grams.
    const amount = inPiece ? Math.round((row.grams / fd.unit.g) * 100) / 100 : r0(row.grams);
    const sub = inPiece
      ? `${r0(s.cal)} ${t('kcal')} · ${r0(row.grams)}${t('gram')}`   // show the grams too, for reference
      : `${r0(s.cal)} ${t('kcal')}`;

    // A food with a piece weight gets a grams/piece toggle; everything else a static غ.
    const unitCtrl = canPiece
      ? `<div class="unit-toggle">
           <button type="button" class="ut ${!inPiece ? 'on' : ''}" data-mode="g:${i}">${t('gram')}</button>
           <button type="button" class="ut ${inPiece ? 'on' : ''}" data-mode="piece:${i}">${esc(unitName(fd))}</button>
         </div>`
      : `<em class="unit">${t('gram')}</em>`;

    return `
      <div class="builder-row">
        <div class="br-main">
          <div class="br-name">${esc(foodName(fd))}</div>
          <div class="br-cal">${sub}</div>
        </div>
        <div class="br-amount">
          <input type="number" min="0" max="5000" step="${inPiece ? '0.5' : '1'}"
                 inputmode="decimal" value="${amount}" data-grams="${i}">
          ${unitCtrl}
        </div>
        <button class="item-del" type="button" data-brm="${i}" aria-label="remove">✕</button>
      </div>`;
  }).join('');

  $$('#builderList [data-grams]').forEach(inp => {
    inp.oninput = () => {
      const i = +inp.dataset.grams;
      const row = builder[i];
      const fd = foodBy(row.key);
      const val = Math.max(0, +inp.value || 0);
      row.grams = (row.mode === 'piece') ? val * fd.unit.g : val;
      renderBuilderTotals();               // live, without rebuilding the row you're typing in
    };
  });

  // Grams <-> piece toggle. Keep `grams` fixed so the meal amount is unchanged;
  // only the way it's shown flips (200g tomato <-> ~1.7 pieces).
  $$('#builderList [data-mode]').forEach(btn => {
    btn.onclick = () => {
      const [mode, i] = btn.dataset.mode.split(':');
      builder[+i].mode = mode;
      renderBuilder();
    };
  });
  $$('#builderList [data-brm]').forEach(b => {
    b.onclick = () => {
      builder.splice(+b.dataset.brm, 1);
      if (!builder.length) { builderNameTouched = false; $('#btName').value = ''; }
      renderBuilder();
    };
  });

  autoName();
  renderBuilderTotals();
}

/** Totals only — safe to call on every keystroke. */
function renderBuilderTotals() {
  const tot = builderTotals();

  $('#btCal').textContent = r0(tot.cal);
  $('#btMacros').innerHTML =
    `<i class="mp">${t('protein')} ${r1(tot.p)}${t('g')}</i> · ` +
    `<i class="mc">${t('carbs')} ${r1(tot.c)}${t('g')}</i> · ` +
    `<i class="mf">${t('fat')} ${r1(tot.f)}${t('g')}</i>`;

  const list = enabledNutrients();
  $('#btMicros').hidden = list.length === 0;
  $('#btMicros').innerHTML = list
    .map(n => `<span class="micro-pill">${esc(nName(n))} <b>${nFmt(n, tot.mi[n.key])}</b>${esc(nUnit(n))}</span>`)
    .join('');

  // keep the per-row calorie figures honest while the amount changes
  builder.forEach((row, i) => {
    const cell = $(`#builderList .builder-row:nth-child(${i + 1}) .br-cal`);
    if (!cell) return;
    const fd = foodBy(row.key);
    const cal = r0(scaleFood(fd, row.grams).cal);
    const inPiece = isCounted(fd) && row.mode === 'piece';
    cell.textContent = inPiece
      ? `${cal} ${t('kcal')} · ${r0(row.grams)}${t('gram')}`
      : `${cal} ${t('kcal')}`;
  });
}

function clearBuilder() {
  builder = [];
  builderNameTouched = false;
  $('#btName').value = '';
  $('#btSave').checked = false;
  $('#builder').hidden = true;
}

/* ================= CLOUD SYNC =================
 * Model: the first time you sign in on a device we MERGE — the union of what
 * is on the phone and what is in the cloud — so adopting sync can never lose
 * data. After that merge the cloud is authoritative: local edits are pushed,
 * remote changes are applied. That's what makes deletes work; a permanent
 * union-merge would resurrect every meal you ever deleted.
 */
let cloudUser = null;
let applyingRemote = false;   // guards the push->snapshot->apply->push loop
let pushTimer = null;
let lastSyncAt = 0;

const mergedFlag = uid => `seera.merged.${uid}`;

function schedulePush() {
  if (!window.Cloud?.configured || !cloudUser || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    Cloud.push(structuredClone(S));
  }, 800);   // coalesce bursts of edits into one write
}

/** Union of two states — used once, at first sign-in on a device. */
function mergeStates(a, b) {
  const out = structuredClone(b);   // start from remote
  const newer = (a.updatedAtMs || 0) >= (b.updatedAtMs || 0) ? a : b;

  // Scalars: whichever side was touched most recently.
  out.goals = newer.goals ?? b.goals;
  out.profile = newer.profile ?? b.profile;
  out.micros = newer.micros ?? b.micros;
  out.ai = newer.ai ?? b.ai;
  out.lang = newer.lang ?? b.lang;

  // Meals: union per day, de-duplicated by entry id.
  out.days = { ...(b.days || {}) };
  for (const [date, entries] of Object.entries(a.days || {})) {
    const byId = new Map((out.days[date] || []).map(e => [e.id, e]));
    for (const e of entries) byId.set(e.id, e);
    out.days[date] = [...byId.values()];
  }

  // Weights: one per date.
  const wByDate = new Map((b.weights || []).map(w => [w.date, w]));
  for (const w of a.weights || []) wByDate.set(w.date, w);
  out.weights = [...wByDate.values()].sort((x, y) => x.date.localeCompare(y.date));

  // Saved meals + custom ingredients: union by id/key.
  const byKey = (list, k) => new Map((list || []).map(x => [x[k], x]));
  const savedM = byKey(b.saved, 'id');
  for (const m of a.saved || []) savedM.set(m.id, m);
  out.saved = [...savedM.values()];

  const cfM = byKey(b.customFoods, 'key');
  for (const c of a.customFoods || []) cfM.set(c.key, c);
  out.customFoods = [...cfM.values()];

  return out;
}

function applyRemote(remote) {
  applyingRemote = true;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(remote));
    S = load();
    if (!S.days[viewDate]) viewDate = todayISO();
    builder = builder.filter(r => foodBy(r.key));   // a device may have deleted a custom ingredient
    applyLang();
    lastSyncAt = Date.now();
    renderCloud();
  } finally {
    applyingRemote = false;
  }
}

async function onSignedIn(u) {
  cloudUser = u;
  renderCloud();

  try {
    const remote = await Cloud.fetchOnce();

    if (!remote) {
      // Nothing in the cloud yet: this device seeds it.
      await Cloud.push(structuredClone(S));
    } else if (!localStorage.getItem(mergedFlag(u.uid))) {
      // First sign-in on this device: union, so neither side is lost.
      const merged = mergeStates({ ...S, updatedAtMs: Date.now() }, remote);
      applyRemote(merged);
      await Cloud.push(structuredClone(S));
    } else {
      // Already merged before: the cloud is the truth.
      applyRemote(remote);
    }

    localStorage.setItem(mergedFlag(u.uid), '1');
    lastSyncAt = Date.now();
    toast(t('syncOn'));
  } catch (e) {
    toast(`${t('syncFailed')} — ${cloudErr(e)}`, true);
  }
  renderCloud();
}

const cloudErr = e => (e.i18n ? t(e.i18n) : e.message);

function renderCloud() {
  const box = $('#cloudCard');
  if (!window.Cloud?.configured) {
    $('#cloudStatus').textContent = t('cloudNotSetUp');
    $('#cloudStatus').className = 'cloud-status off';
    $('#authForm').hidden = true;
    $('#cloudAccount').hidden = true;
    return;
  }

  if (cloudUser) {
    $('#cloudStatus').textContent = lastSyncAt
      ? `${t('syncedAs')} ${cloudUser.email}`
      : t('syncing');
    $('#cloudStatus').className = 'cloud-status on';
    $('#authForm').hidden = true;
    $('#cloudAccount').hidden = false;
    $('#cloudEmail').textContent = cloudUser.email;
  } else {
    $('#cloudStatus').textContent = t('signedOut');
    $('#cloudStatus').className = 'cloud-status off';
    $('#authForm').hidden = false;
    $('#cloudAccount').hidden = true;
  }
}

function initCloud() {
  if (!window.Cloud?.configured) { renderCloud(); return; }

  Cloud.on('auth', u => {
    if (u) onSignedIn(u);
    else { cloudUser = null; lastSyncAt = 0; renderCloud(); }
  });

  Cloud.on('remote', remote => {
    if (applyingRemote) return;
    applyRemote(remote);
  });

  Cloud.on('status', s => {
    if (s.kind === 'synced') { lastSyncAt = s.at; renderCloud(); }
    if (s.kind === 'error') toast(`${t('syncFailed')} — ${s.message}`, true);
  });

  renderCloud();
}

/* ================= CUSTOM INGREDIENTS ================= */

/** Build the form's nutrient inputs once, from the nutrient list. */
function renderCustomMicroInputs() {
  $('#cfMicros').innerHTML = NUTRIENTS.map(n => `
    <label class="field">
      <span>${esc(nName(n))} <em class="unit">${esc(nUnit(n))}</em></span>
      <input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" data-cf="${n.key}">
    </label>`).join('');
}

/** Fill the form from a scanned label (values arrive per 100 g + a serving unit). */
function fillCustomForm(d) {
  $('#cfName').value = S.lang === 'ar' ? d.name_ar : d.name_en;
  $('#cfCat').value = 'custom';

  // A label's serving ("3 pretzels (28g)") becomes a countable unit.
  $('#cfCounted').checked = true;
  $('#cfUnitLabel').value = S.lang === 'ar' ? d.servingLabelAr : d.servingLabelEn;
  $('#cfUnitG').value = d.servingG;
  toggleCustomUnit();

  $('#cfCal').value = d.per100.kcal;
  $('#cfP').value = d.per100.protein;
  $('#cfC').value = d.per100.carbs;
  $('#cfF').value = d.per100.fat;

  $$('#cfMicros [data-cf]').forEach(inp => {
    const v = d.per100.mi[inp.dataset.cf];
    inp.value = v > 0 ? v : '';
  });

  $('#cfMicrosWrap').open = true;
  $('#customForm').hidden = false;
}

function toggleCustomUnit() {
  $('#cfUnitRow').hidden = !$('#cfCounted').checked;
}

function clearCustomForm() {
  $('#customForm').reset?.();
  ['cfName', 'cfUnitLabel', 'cfUnitG', 'cfCal', 'cfP', 'cfC', 'cfF'].forEach(id => { $(`#${id}`).value = ''; });
  $$('#cfMicros [data-cf]').forEach(i => { i.value = ''; });
  $('#cfCounted').checked = false;
  $('#cfCat').value = 'custom';
  toggleCustomUnit();
  $('#customForm').hidden = true;
  $('#cfPreviewWrap').hidden = true;
  $('#labelInput').value = '';
}

function saveCustomFood() {
  const name = $('#cfName').value.trim();
  const kcal = +$('#cfCal').value || 0;
  if (!name) { toast(t('needName'), true); return; }

  const counted = $('#cfCounted').checked;
  const unitG = +$('#cfUnitG').value || 0;
  if (counted && !unitG) { toast(t('needUnitWeight'), true); return; }

  const mi = {};
  for (const n of NUTRIENTS) {
    const v = parseFloat($(`#cfMicros [data-cf="${n.key}"]`).value);
    mi[n.key] = isFinite(v) && v > 0 ? v : 0;
  }

  const fd = {
    key: 'custom-' + uid(),
    ar: name, en: name,                 // one name, shown in both languages
    cat: $('#cfCat').value || 'custom',
    kcal,
    protein: +$('#cfP').value || 0,
    carbs: +$('#cfC').value || 0,
    fat: +$('#cfF').value || 0,
    serving: counted ? unitG : 100,
    unit: counted ? { ar: $('#cfUnitLabel').value.trim() || 'حصة', en: $('#cfUnitLabel').value.trim() || 'serving', g: unitG } : null,
    mi,
    custom: true,
  };

  S.customFoods.push(fd);
  save();
  clearCustomForm();
  renderCustomList();
  renderFoodResults();
  toast(t('ingredientSaved'));
}

function renderCustomList() {
  const list = S.customFoods;
  $('#customEmpty').hidden = list.length > 0;

  $('#customList').innerHTML = list.map(fd => `
    <div class="item">
      <div class="item-ico">⭐</div>
      <div class="item-main">
        <div class="item-name">${esc(foodName(fd))}</div>
        <div class="item-macros">${isCounted(fd)
          ? `${kcalPerUnit(fd)} ${t('kcal')} / ${esc(unitName(fd))} (${fd.unit.g}${t('gram')})`
          : `${fd.kcal} ${t('kcal')} ${t('per100')}`}</div>
      </div>
      <button class="item-add" type="button" data-cadd="${esc(fd.key)}" aria-label="add">+</button>
      <button class="item-del" type="button" data-cdel="${esc(fd.key)}" aria-label="delete">✕</button>
    </div>`).join('');

  $$('#customList [data-cadd]').forEach(b => b.onclick = () => {
    addToBuilder(b.dataset.cadd);
    toast(t('addedToMeal'));
  });
  $$('#customList [data-cdel]').forEach(b => b.onclick = () => {
    S.customFoods = S.customFoods.filter(x => x.key !== b.dataset.cdel);
    // Anything already in the builder that referenced it has to go too.
    builder = builder.filter(r => foodBy(r.key));
    save();
    renderCustomList();
    renderFoodResults();
    renderBuilder();
  });
}

/* --- read a Nutrition Facts label --- */
async function handleLabel(file) {
  const key = getKey();
  if (!key) {
    toast(t('noApiKey'), true);
    switchTab('settings');
    return;
  }

  const status = $('#cfStatus');
  $('#cfPreviewWrap').hidden = false;
  status.className = 'scan-status';
  status.innerHTML = `<span class="spinner"></span><span>${esc(t('readingLabel'))}</span>`;

  let img;
  try {
    img = await fileToJpegBase64(file, 1400);   // labels are small text — keep more detail
  } catch (e) {
    status.className = 'scan-status err';
    status.textContent = e.message;
    return;
  }
  $('#cfPreview').src = img.dataUrl;

  try {
    const d = await analyzeLabelPhoto(img.base64, {
      provider: S.ai.provider, key, model: activeModel(),
    });

    status.className = 'scan-status';
    status.textContent = d.notes || t('labelRead');
    fillCustomForm(d);
  } catch (e) {
    status.className = 'scan-status err';
    status.textContent = `${t('labelFailed')} — ${e.message}`;
    if (e.kind === 'auth') setTimeout(() => switchTab('settings'), 1200);
  }
}

/* --- settings --- */
function renderSettings() {
  $('#gCal').value = S.goals.cal;
  $('#gP').value = S.goals.protein;
  $('#gC').value = S.goals.carbs;
  $('#gF').value = S.goals.fat;

  const p = S.profile;
  $('#pAge').value = p.age;
  $('#pSex').value = p.sex;
  $('#pHeight').value = p.height;
  $('#pWeight').value = p.weight;
  $('#pAct').value = p.act;
  $('#pGoalType').value = p.goalType;

  // AI provider
  $('#aiProvider').value = S.ai.provider;
  $('#aiModel').value = S.ai.model;
  $('#aiModel').placeholder = PROVIDERS[S.ai.provider].defaultModel;
  $('#apiKey').value = getKey();
  $('#keysLink').href = PROVIDERS[S.ai.provider].keysUrl;
  $('#keysLink').textContent = `${t('getKeyFrom')} ${PROVIDERS[S.ai.provider].label} ←`;
}

function renderMicroSettings() {
  $('#microSettingsList').innerHTML = NUTRIENTS.map(n => {
    const on = S.micros.enabled.includes(n.key);
    return `
      <div class="micro-row">
        <label class="check micro-toggle">
          <input type="checkbox" data-mi-on="${n.key}" ${on ? 'checked' : ''}>
          <span>${esc(nName(n))}</span>
        </label>
        <div class="micro-target">
          <input type="number" min="0" step="0.1" inputmode="decimal"
                 value="${S.micros.targets[n.key]}" data-mi-target="${n.key}" ${on ? '' : 'disabled'}>
          <em class="unit">${esc(nUnit(n))}</em>
          <span class="kind-tag ${n.kind}">${n.kind === 'limit' ? t('limitWord') : t('targetWord')}</span>
        </div>
      </div>`;
  }).join('');

  $$('#microSettingsList [data-mi-on]').forEach(cb => {
    cb.onchange = () => {
      const k = cb.dataset.miOn;
      S.micros.enabled = cb.checked
        ? [...new Set([...S.micros.enabled, k])]
        : S.micros.enabled.filter(x => x !== k);
      // Keep the stored order stable so the UI doesn't reshuffle on toggle.
      S.micros.enabled.sort((a, b) =>
        NUTRIENTS.findIndex(n => n.key === a) - NUTRIENTS.findIndex(n => n.key === b));
      save();
      renderMicros();
      renderManualMicros();
      renderMicroSettings();
    };
  });

  $$('#microSettingsList [data-mi-target]').forEach(inp => {
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= 0) {
        S.micros.targets[inp.dataset.miTarget] = v;
        save();
        renderMicros();
        toast(t('saved'));
      }
    };
  });
}

/* ---------- weight ---------- */
function renderWeight() {
  const w = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));

  $('#weightSub').textContent = w.length ? plural(w.length, 'entry') : t('noWeightShort');

  if (!w.length) {
    $('#wCurrent').textContent = '—';
    $('#wChange').textContent = '—';
    $('#wStart').textContent = '—';
  } else {
    const last = w[w.length - 1];
    $('#wCurrent').textContent = `${r1(last.kg)}`;
    $('#wStart').textContent = `${r1(w[0].kg)}`;

    const cutoff = shiftISO(todayISO(), -30);
    const past = w.filter(x => x.date <= cutoff).pop() || w[0];
    const delta = last.kg - past.kg;
    const el = $('#wChange');
    el.textContent = `${delta > 0 ? '+' : ''}${r1(delta)}`;
    el.className = 'stat-val ' + (delta < 0 ? 'down' : delta > 0 ? 'up' : '');
  }

  drawChart(w);

  $('#weightList').innerHTML = [...w].reverse().slice(0, 30).map(x => `
    <div class="item">
      <div class="item-ico">⚖️</div>
      <div class="item-main"><div class="item-name">${x.date}</div></div>
      <div class="item-cal">${r1(x.kg)} <small>kg</small></div>
      <button class="item-del" type="button" data-wdel="${x.date}" aria-label="delete">✕</button>
    </div>`).join('');

  $('#weightList').querySelectorAll('[data-wdel]').forEach(b => {
    b.onclick = () => {
      S.weights = S.weights.filter(x => x.date !== b.dataset.wdel);
      save(); renderWeight();
    };
  });
}

function drawChart(w) {
  const svg = $('#wChart');
  const empty = $('#wChartEmpty');

  if (w.length < 2) {
    svg.innerHTML = '';
    svg.style.display = 'none';
    empty.hidden = false;
    return;
  }
  svg.style.display = 'block';
  empty.hidden = true;

  const pts = w.slice(-60);
  const W = 320, H = 150, padX = 26, padTop = 12, padBot = 22;

  const vals = pts.map(p => p.kg);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;

  const x = i => padX + (i / (pts.length - 1)) * (W - padX * 2);
  const y = v => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBot);

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - padBot} L${padX},${H - padBot} Z`;

  const gridY = [0, 0.5, 1].map(f => {
    const yy = padTop + f * (H - padTop - padBot);
    const val = max - f * (max - min);
    return `<line class="grid-line" x1="${padX}" y1="${yy}" x2="${W - padX}" y2="${yy}"/>
            <text class="lbl" x="4" y="${yy + 3}">${val.toFixed(1)}</text>`;
  }).join('');

  const dots = pts.map((p, i) =>
    `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="${i === pts.length - 1 ? 3.5 : 2}"/>`
  ).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1da34e" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#1da34e" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridY}
    <path class="area" d="${area}"/>
    <path class="line" d="${line}"/>
    ${dots}
    <text class="lbl" x="${padX}" y="${H - 6}">${pts[0].date.slice(5)}</text>
    <text class="lbl" x="${W - padX}" y="${H - 6}" text-anchor="end">${pts[pts.length - 1].date.slice(5)}</text>`;
}

/* ================= ACTIONS ================= */
function addEntry({ name, cal, p, c, f, mi }) {
  if (!S.days[viewDate]) S.days[viewDate] = [];
  S.days[viewDate].push({
    id: uid(), name,
    cal: r0(cal), p: r1(p), c: r1(c), f: r1(f),
    mi: mi && Object.keys(mi).length ? { ...mi } : {},
  });
  save();
  renderTotals();
  renderMicros();
  renderEntries();
}

function switchTab(tab) {
  $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  ['today', 'add', 'weight', 'settings'].forEach(v => { $(`#view-${v}`).hidden = v !== tab; });
  window.scrollTo({ top: 0 });
}

/* ================= PHOTO SCAN ================= */
async function handlePhoto(file) {
  const key = getKey();
  if (!key) {
    toast(t('noApiKey'), true);
    switchTab('settings');
    $('#apiKey').focus();
    return;
  }

  scanDraft = null;
  $('#scanResult').hidden = true;
  $('#scanPreviewWrap').hidden = false;

  const status = $('#scanStatus');
  status.className = 'scan-status';
  status.innerHTML = `<span class="spinner"></span><span>${esc(t('analyzing'))}</span>`;

  let img;
  try {
    img = await fileToJpegBase64(file);
  } catch (e) {
    status.className = 'scan-status err';
    status.textContent = e.message;
    return;
  }
  $('#scanPreview').src = img.dataUrl;

  try {
    const result = await analyzeMealPhoto(img.base64, {
      provider: S.ai.provider,
      key,
      model: activeModel(),
    });

    if (!result.food_detected || !result.items.length) {
      status.className = 'scan-status err';
      status.textContent = t('noFood');
      return;
    }

    status.className = 'scan-status';
    status.textContent = '';
    scanDraft = result;
    renderScanResult();
  } catch (e) {
    status.className = 'scan-status err';
    status.textContent = `${t('scanFailed')} — ${e.message}`;
    if (e.kind === 'auth') setTimeout(() => switchTab('settings'), 1200);
  }
}

function renderScanResult() {
  if (!scanDraft) return;
  const ar = S.lang === 'ar';

  const chip = $('#confChip');
  chip.className = `chip ${scanDraft.confidence}`;
  chip.textContent = t('conf' + scanDraft.confidence[0].toUpperCase() + scanDraft.confidence.slice(1));
  $('#scanNotes').textContent = scanDraft.notes || '';

  $('#scanItems').innerHTML = scanDraft.items.map((it, i) => `
    <div class="scan-item">
      <div class="scan-item-top">
        <div class="scan-item-name">
          ${esc(ar ? it.name_ar : it.name_en)}
          <div class="muted small">${esc(it.portion)}</div>
        </div>
        <input class="scan-item-cal" type="number" min="0" step="1" inputmode="numeric"
               value="${it.calories}" data-cal="${i}">
        <button class="scan-item-rm" type="button" data-rm="${i}" aria-label="remove">✕</button>
      </div>
      <div class="scan-item-macros">
        <span class="mp">${t('protein')} ${r1(it.protein_g)}${t('g')}</span> ·
        <span class="mc">${t('carbs')} ${r1(it.carbs_g)}${t('g')}</span> ·
        <span class="mf">${t('fat')} ${r1(it.fat_g)}${t('g')}</span>
      </div>
    </div>`).join('');

  // Editing calories rescales that item's macros AND micros proportionally,
  // so a portion correction stays internally consistent.
  $('#scanItems').querySelectorAll('[data-cal]').forEach(inp => {
    inp.onchange = () => {
      const it = scanDraft.items[+inp.dataset.cal];
      const next = Math.max(0, r0(+inp.value || 0));
      if (it.calories > 0 && next > 0) {
        const k = next / it.calories;
        it.protein_g = r1(it.protein_g * k);
        it.carbs_g = r1(it.carbs_g * k);
        it.fat_g = r1(it.fat_g * k);
        for (const n of NUTRIENTS) it.micros[n.key] = nFmt(n, it.micros[n.key] * k);
      }
      it.calories = next;
      renderScanResult();
    };
  });
  $('#scanItems').querySelectorAll('[data-rm]').forEach(b => {
    b.onclick = () => {
      scanDraft.items.splice(+b.dataset.rm, 1);
      if (!scanDraft.items.length) { cancelScan(); return; }
      renderScanResult();
    };
  });

  $('#scanTotalCal').textContent = r0(scanDraft.items.reduce((a, i) => a + i.calories, 0));

  // micro summary for the whole scan
  const list = enabledNutrients();
  $('#scanMicros').hidden = list.length === 0;
  if (list.length) {
    $('#scanMicros').innerHTML = list.map(n => {
      const sum = scanDraft.items.reduce((a, it) => a + (it.micros[n.key] || 0), 0);
      return `<span class="micro-pill">${esc(nName(n))} <b>${nFmt(n, sum)}</b>${esc(nUnit(n))}</span>`;
    }).join('');
  }

  $('#scanResult').hidden = false;
}

function cancelScan() {
  scanDraft = null;
  $('#scanResult').hidden = true;
  $('#scanPreviewWrap').hidden = true;
  $('#photoInput').value = '';
}

/* ================= GOAL MATH ================= */
function calcGoals(p) {
  const w = +p.weight, h = +p.height, a = +p.age;
  const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'male' ? 5 : -161); // Mifflin-St Jeor
  const tdee = bmr * parseFloat(p.act);

  const adj = p.goalType === 'cut' ? -500 : p.goalType === 'bulk' ? 300 : 0;
  const cal = Math.max(1200, r0(tdee + adj));

  // Protein scales with the goal; fat holds at 25% of intake; carbs take the rest.
  const perKg = p.goalType === 'cut' ? 2.0 : p.goalType === 'bulk' ? 1.8 : 1.6;
  const protein = r0(w * perKg);
  const fat = r0((cal * 0.25) / 9);
  const carbs = Math.max(0, r0((cal - protein * 4 - fat * 9) / 4));

  return { cal, protein, carbs, fat };
}

/* ================= WIRING ================= */
function init() {
  $$('.tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $('#goAdd').onclick = () => switchTab('add');
  $('#emptyAdd').onclick = () => { switchTab('add'); $('#pickPhoto').click(); };

  $('#langBtn').onclick = () => {
    S.lang = S.lang === 'ar' ? 'en' : 'ar';
    save();
    applyLang();
    if (scanDraft) renderScanResult();
  };

  $('#prevDay').onclick = () => {
    viewDate = shiftISO(viewDate, -1);
    renderDate(); renderTotals(); renderMicros(); renderEntries();
  };
  $('#nextDay').onclick = () => {
    if (viewDate >= todayISO()) return;
    viewDate = shiftISO(viewDate, 1);
    renderDate(); renderTotals(); renderMicros(); renderEntries();
  };

  // photo
  $('#pickPhoto').onclick = () => $('#photoInput').click();
  $('#photoInput').onchange = e => {
    const f = e.target.files?.[0];
    if (f) handlePhoto(f);
  };
  $('#scanCancel').onclick = cancelScan;
  $('#scanConfirm').onclick = () => {
    if (!scanDraft) return;
    for (const it of scanDraft.items) {
      addEntry({
        name: S.lang === 'ar' ? it.name_ar : it.name_en,
        cal: it.calories, p: it.protein_g, c: it.carbs_g, f: it.fat_g,
        mi: it.micros,
      });
    }
    cancelScan();
    switchTab('today');
    toast(t('added'));
  };

  // manual entry
  $('#manualForm').onsubmit = e => {
    e.preventDefault();
    const entry = {
      name: $('#mName').value.trim(),
      cal: +$('#mCal').value || 0,
      p: +$('#mP').value || 0,
      c: +$('#mC').value || 0,
      f: +$('#mF').value || 0,
      mi: readManualMicros(),
    };
    if (!entry.name) return;

    addEntry(entry);
    if ($('#mSave').checked) {
      S.saved.push({ id: uid(), ...entry });
      save();
      renderSaved();
    }
    e.target.reset();
    $('#mP').value = $('#mC').value = $('#mF').value = 0;
    toast(t('added'));
    switchTab('today');
  };

  $('#savedSearch').oninput = renderSaved;

  // custom ingredients
  $('#scanLabelBtn').onclick = () => $('#labelInput').click();
  $('#labelInput').onchange = e => {
    const f = e.target.files?.[0];
    if (f) handleLabel(f);
  };
  $('#manualIngBtn').onclick = () => {
    const form = $('#customForm');
    form.hidden = !form.hidden;
    if (!form.hidden) $('#cfName').focus();
  };
  $('#cfCounted').onchange = toggleCustomUnit;
  $('#cfSave').onclick = saveCustomFood;
  $('#cfCancel').onclick = clearCustomForm;

  // meal builder
  $('#foodSearch').oninput = renderFoodResults;
  $('#builderClear').onclick = clearBuilder;
  $('#btName').oninput = () => { builderNameTouched = true; };
  $('#btAdd').onclick = () => {
    if (!builder.length) return;

    const tot = builderTotals();
    const name = $('#btName').value.trim() || t('customMeal');

    // Round first, then drop zeros — a trace amount that rounds to 0 is not
    // worth storing, and this keeps the shape identical to a manual entry.
    const mi = {};
    for (const n of NUTRIENTS) {
      const v = nFmt(n, tot.mi[n.key]);
      if (v > 0) mi[n.key] = v;
    }

    const entry = { name, cal: tot.cal, p: tot.p, c: tot.c, f: tot.f, mi };
    addEntry(entry);

    if ($('#btSave').checked) {
      S.saved.push({ id: uid(), ...entry, cal: r0(tot.cal), p: r1(tot.p), c: r1(tot.c), f: r1(tot.f) });
      save();
      renderSaved();
    }

    clearBuilder();
    switchTab('today');
    toast(t('added'));
  };

  // weight
  $('#wDate').value = todayISO();
  $('#weightForm').onsubmit = e => {
    e.preventDefault();
    const kg = +$('#wInput').value;
    const date = $('#wDate').value;
    if (!kg || !date) return;

    S.weights = S.weights.filter(x => x.date !== date); // one entry per day
    S.weights.push({ date, kg });
    S.weights.sort((a, b) => a.date.localeCompare(b.date));

    const latest = S.weights[S.weights.length - 1];
    if (latest.date === date) S.profile.weight = kg; // keep goal math on the latest number

    save();
    renderWeight();
    renderSettings();
    $('#wInput').value = '';
    toast(t('saved'));
  };

  // goals
  $('#goalsForm').onsubmit = e => {
    e.preventDefault();
    S.goals = {
      cal: +$('#gCal').value, protein: +$('#gP').value,
      carbs: +$('#gC').value, fat: +$('#gF').value,
    };
    save();
    renderTotals();
    toast(t('goalsSaved'));
  };

  $('#calcForm').onsubmit = e => {
    e.preventDefault();
    S.profile = {
      age: +$('#pAge').value, sex: $('#pSex').value,
      height: +$('#pHeight').value, weight: +$('#pWeight').value,
      act: $('#pAct').value, goalType: $('#pGoalType').value,
    };

    // Macros first — the calorie goal feeds the energy-scaled micros
    // (fiber, sugar, saturated fat), so the order matters here.
    S.goals = calcGoals(S.profile);
    S.micros.targets = calcMicroTargets(S.profile, S.goals.cal);

    save();
    renderSettings();
    renderMicroSettings();
    renderTotals();
    renderMicros();
    toast(t('goalsMicrosSaved'));
  };

  // AI provider
  $('#aiProvider').onchange = () => {
    S.ai.provider = $('#aiProvider').value;
    S.ai.model = ''; // a model name from one provider is meaningless to another
    save();
    renderSettings();
  };
  $('#aiSave').onclick = () => {
    S.ai.model = $('#aiModel').value.trim();
    setKey(S.ai.provider, $('#apiKey').value.trim());
    save();
    renderSettings();
    toast(t('saved'));
  };
  $('#apiClear').onclick = () => {
    setKey(S.ai.provider, '');
    $('#apiKey').value = '';
    toast(t('saved'));
  };

  // data
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seera-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#importBtn').onclick = () => $('#importInput').click();
  $('#importInput').onchange = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (typeof data !== 'object' || !data.goals || !data.days) throw new Error('bad');
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      S = load(); // re-run the same migration path as a cold start
      viewDate = todayISO();
      applyLang();
      toast(t('imported'));
    } catch {
      toast(t('importFailed'), true);
    }
    e.target.value = '';
  };
  $('#resetBtn').onclick = () => {
    if (!confirm(t('resetConfirm'))) return;
    localStorage.removeItem(STORE_KEY);
    S = structuredClone(DEFAULT_STATE);
    viewDate = todayISO();
    applyLang();
  };

  // cloud sync
  const authFields = () => ({
    email: $('#authEmail').value.trim(),
    pass: $('#authPass').value,
  });
  const withAuth = fn => async () => {
    const { email, pass } = authFields();
    if (!email || !pass) { toast(t('needEmailPass'), true); return; }
    try {
      await fn(email, pass);
      $('#authPass').value = '';
    } catch (e) {
      toast(cloudErr(e), true);
    }
  };
  $('#signInBtn').onclick = withAuth((e, p) => Cloud.signIn(e, p));
  $('#signUpBtn').onclick = withAuth((e, p) => Cloud.signUp(e, p));
  $('#signOutBtn').onclick = async () => {
    await Cloud.signOut();
    toast(t('signedOut'));
  };
  $('#resetPassBtn').onclick = async () => {
    const { email } = authFields();
    if (!email) { toast(t('needEmail'), true); return; }
    try {
      await Cloud.resetPassword(email);
      toast(t('resetSent'));
    } catch (e) {
      toast(cloudErr(e), true);
    }
  };

  applyLang();

  // cloud.js is a module, so it runs before DOMContentLoaded — but listen for
  // the event too, in case that ordering ever changes.
  if (window.Cloud) initCloud();
  else window.addEventListener('cloud-ready', initCloud, { once: true });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);
