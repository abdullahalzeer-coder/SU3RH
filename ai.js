/* ------------------------------------------------------------------
 * ai.js — meal photo -> nutrition estimate.
 *
 * Three providers behind one interface. Each returns the SAME normalized
 * object, so the rest of the app never knows which one is in use:
 *
 *   { food_detected, confidence, notes, items: [
 *       { name_en, name_ar, portion, calories, protein_g, carbs_g, fat_g,
 *         micros: { fiber, sugar, ... } } ] }
 *
 * The key is stored on this device and the request goes straight from the
 * browser to the provider. To move a provider behind a server proxy later,
 * only its `url` and `headers` need to change.
 * ------------------------------------------------------------------ */

const PROVIDERS = {
  claude: { label: 'Claude (Anthropic)', defaultModel: 'claude-opus-4-8',  keysUrl: 'https://console.anthropic.com/settings/keys' },
  gemini: { label: 'Gemini (Google)',    defaultModel: 'gemini-2.0-flash', keysUrl: 'https://aistudio.google.com/apikey' },
  openai: { label: 'OpenAI (ChatGPT)',   defaultModel: 'gpt-4o',           keysUrl: 'https://platform.openai.com/api-keys' },
};

const SYSTEM_PROMPT = `You are a nutrition estimator for a calorie-tracking app.

Given a photo of a meal, identify every distinct food and drink item and estimate its nutrition for the portion actually visible in the photo.

Rules:
- Estimate the VISIBLE portion, not a generic serving. Use plates, cutlery, hands and cans as size references.
- Split composite dishes into their meaningful components only when the components are separately visible (e.g. rice + grilled chicken + salad). Keep a single mixed dish (e.g. a burger, a shawarma wrap) as one item.
- Middle Eastern and Gulf dishes are common: kabsa, mandi, shawarma, hummus, mutabbaq, foul, tamees, luqaimat, etc. Recognise them by name.
- "portion" is a short human description of the amount, e.g. "1 cup", "approx. 200g", "1 medium plate".
- name_ar is the Arabic name; name_en is the English name.
- Macros must be physically plausible: protein*4 + carbs*4 + fat*9 should land within roughly 10% of calories.
- Also estimate micronutrients for each item. Use standard food-composition values for the food and scale them to the estimated portion. Saturated fat must never exceed total fat, and sugar must never exceed total carbs. Use 0 where a nutrient is genuinely absent (e.g. cholesterol in a plant-only food) — do not use 0 as a shorthand for "unknown".
- Units matter: *_g in grams, *_mg in milligrams, *_ug in micrograms.
- confidence: "high" for clear, well-lit, unambiguous single dishes; "medium" when portion size is uncertain; "low" when the image is blurry, dark, partially hidden, or the dish is hard to identify.
- notes: one short sentence (in English) about the main source of uncertainty, e.g. "Oil used in cooking is not visible, so calories may be higher."
- If the photo contains no food or drink at all, set food_detected to false and items to an empty array.

Estimate honestly. Do not round everything to neat numbers, and do not systematically under-report. Vitamin and mineral figures from a photo are rough by nature — that is expected, but base them on the actual food rather than guessing.`;

const USER_PROMPT = 'Estimate the nutrition of everything visible in this meal photo.';

/* --- reading a packaged-food Nutrition Facts label --- */
const LABEL_SYSTEM_PROMPT = `You read Nutrition Facts labels from photos and transcribe them exactly.

You are TRANSCRIBING, not estimating. Every number must be read off the label. If a nutrient is not printed on the label, return 0 for it — do not infer or guess a plausible value from what the food seems to be.

Rules:
- Read the "per serving" column, NOT the "per container" column, whenever both are shown.
- serving_size_g is the serving weight in GRAMS, taken from the parenthesised gram figure in the serving size line. For "3 pretzels (28g)" that is 28. If the serving is given in ml, use the ml figure. If no gram/ml figure appears anywhere, return 0.
- serving_label is the human part of the serving size, without the grams: for "3 pretzels (28g)" that is "3 pretzels". Give it in English and in Arabic.
- name_en / name_ar: the product name if visible on the packaging; otherwise a short description of the food.
- Units on the label are already correct — carry them across unchanged. Sodium, cholesterol, calcium, potassium, iron, magnesium and zinc in mg; vitamin A, D and B12 in mcg; everything else in grams. Do NOT convert %DV into an amount; if only a %DV is printed with no absolute amount, return 0 for that nutrient.
- "Includes Xg Added Sugars" is NOT the sugar figure. Use "Total Sugars" for sugar_g.
- A value printed as "<1g" should be read as the number it is under, halved — so "<1g" becomes 0.5.
- Trans fat is not tracked; ignore it.
- label_readable: false if this is not a nutrition label, or it is too blurry/cropped to transcribe. Set it true only if you could actually read the numbers.
- notes: one short English sentence noting anything unclear, or "" if the label was fully legible.`;

const LABEL_USER_PROMPT = 'Transcribe the Nutrition Facts label in this photo.';

/* --- JSON schema, generated so nutrients.js stays the only place to edit --- */
function buildSchema() {
  const micro = {};
  for (const n of NUTRIENTS) micro[n.field] = { type: 'number' };

  const itemProps = {
    name_en: { type: 'string' },
    name_ar: { type: 'string' },
    portion: { type: 'string' },
    calories: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    ...micro,
  };

  return {
    type: 'object',
    properties: {
      food_detected: { type: 'boolean' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      notes: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: itemProps,
          required: Object.keys(itemProps),
          additionalProperties: false,
        },
      },
    },
    required: ['food_detected', 'confidence', 'notes', 'items'],
    additionalProperties: false,
  };
}

/* Schema for a transcribed Nutrition Facts label (values are PER SERVING). */
function buildLabelSchema() {
  const props = {
    label_readable: { type: 'boolean' },
    name_en: { type: 'string' },
    name_ar: { type: 'string' },
    serving_size_g: { type: 'number' },
    serving_label_en: { type: 'string' },
    serving_label_ar: { type: 'string' },
    notes: { type: 'string' },
    calories: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
  };
  for (const n of NUTRIENTS) props[n.field] = { type: 'number' };

  return {
    type: 'object',
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

/* Gemini takes an OpenAPI-flavoured subset: no additionalProperties. */
function toGeminiSchema(s) {
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties') continue;
    if (k === 'properties') {
      out.properties = Object.fromEntries(
        Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)])
      );
    } else if (k === 'items') {
      out.items = toGeminiSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

class AIError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind; // 'auth' | 'rate' | 'network' | 'api' | 'refusal'
  }
}

/* --- per-provider request builders + response readers --- */
const ADAPTERS = {
  claude: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: key => ({
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (model, base64, schema, sys, user) => ({
      model,
      max_tokens: 4096,
      system: sys,
      // No `effort` here on purpose: the Model field in Settings is free text,
      // and effort is rejected by some models (Haiku 4.5 among them). Sending
      // it would break the app for anyone who picks a cheaper model.
      output_config: {
        format: { type: 'json_schema', schema },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: user },
        ],
      }],
    }),
    read: data => {
      if (data.stop_reason === 'refusal') {
        throw new AIError('The model declined to analyze this image.', 'refusal');
      }
      const block = (data.content || []).find(b => b.type === 'text');
      if (!block) throw new AIError('Empty response.', 'api');
      return block.text;
    },
  },

  gemini: {
    url: model =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: key => ({
      'content-type': 'application/json',
      'x-goog-api-key': key,
    }),
    body: (model, base64, schema, sys, user) => ({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          { text: user },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
      },
    }),
    read: data => {
      const cand = data.candidates?.[0];
      if (!cand) {
        const blocked = data.promptFeedback?.blockReason;
        throw new AIError(blocked ? `Blocked: ${blocked}` : 'Empty response.', blocked ? 'refusal' : 'api');
      }
      const text = (cand.content?.parts || []).map(p => p.text).filter(Boolean).join('');
      if (!text) throw new AIError('Empty response.', 'api');
      return text;
    },
  },

  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: key => ({
      'content-type': 'application/json',
      'authorization': `Bearer ${key}`,
    }),
    body: (model, base64, schema, sys, user) => ({
      model,
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'nutrition', strict: true, schema },
      },
    }),
    read: data => {
      const msg = data.choices?.[0]?.message;
      if (msg?.refusal) throw new AIError(msg.refusal, 'refusal');
      if (!msg?.content) throw new AIError('Empty response.', 'api');
      return msg.content;
    },
  },
};

/**
 * One vision call, whichever provider and whichever task.
 * @param {string} base64 JPEG image data, base64, no data: prefix
 * @param {{provider:string, key:string, model:string}} cfg
 */
async function callVision(base64, cfg, schema, system, user) {
  const adapter = ADAPTERS[cfg.provider];
  if (!adapter) throw new AIError(`Unknown provider: ${cfg.provider}`, 'api');

  const model = cfg.model || PROVIDERS[cfg.provider].defaultModel;

  let res;
  try {
    res = await fetch(adapter.url(model), {
      method: 'POST',
      headers: adapter.headers(cfg.key),
      body: JSON.stringify(adapter.body(model, base64, schema, system, user)),
    });
  } catch (e) {
    // A CORS rejection also lands here and is indistinguishable from being offline.
    throw new AIError(e.message || 'Network error', 'network');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || body?.error?.status || '';
    } catch { /* non-JSON error body */ }

    if (res.status === 401 || res.status === 403) throw new AIError(detail || 'Invalid API key', 'auth');
    if (res.status === 429) throw new AIError(detail || 'Rate limited — try again shortly', 'rate');
    throw new AIError(detail || `API error ${res.status}`, 'api');
  }

  const raw = adapter.read(await res.json());

  try {
    return JSON.parse(raw);
  } catch {
    throw new AIError('Could not read the model response.', 'api');
  }
}

/** Meal photo -> per-item nutrition estimate. */
async function analyzeMealPhoto(base64, cfg) {
  const parsed = await callVision(base64, cfg, buildSchema(), SYSTEM_PROMPT, USER_PROMPT);
  return normalize(parsed);
}

/**
 * Nutrition Facts label -> an ingredient, converted to the per-100g basis the
 * food database uses, and carrying the label's own serving as a countable unit
 * (so "3 pretzels (28g)" can be logged as 2 servings rather than 56 grams).
 */
async function analyzeLabelPhoto(base64, cfg) {
  const d = await callVision(base64, cfg, buildLabelSchema(), LABEL_SYSTEM_PROMPT, LABEL_USER_PROMPT);

  if (!d.label_readable) {
    throw new AIError(d.notes || 'That photo is not a readable nutrition label.', 'unreadable');
  }

  const num = v => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  };

  const servingG = num(d.serving_size_g);
  if (!servingG) {
    throw new AIError('The label does not show a serving size in grams.', 'unreadable');
  }

  // The label is per serving; the database is per 100 g.
  const k = 100 / servingG;
  const mi = {};
  for (const n of NUTRIENTS) mi[n.key] = Math.round(num(d[n.field]) * k * 100) / 100;

  const fat = Math.round(num(d.fat_g) * k * 10) / 10;
  const carbs = Math.round(num(d.carbs_g) * k * 10) / 10;
  mi.satfat = Math.min(mi.satfat, fat);
  mi.sugar = Math.min(mi.sugar, carbs);

  return {
    name_en: String(d.name_en || 'Packaged food'),
    name_ar: String(d.name_ar || 'منتج معلّب'),
    notes: String(d.notes || ''),
    servingG,
    servingLabelEn: String(d.serving_label_en || 'serving'),
    servingLabelAr: String(d.serving_label_ar || 'حصة'),
    per100: {
      kcal: Math.round(num(d.calories) * k),
      protein: Math.round(num(d.protein_g) * k * 10) / 10,
      carbs,
      fat,
      mi,
    },
  };
}

/* The schema guarantees the shape, but never trust a model blindly:
 * clamp negatives, and enforce the physical constraints the prompt asks for. */
function normalize(parsed) {
  const num = (v, dp = 1) => {
    const n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    const p = 10 ** dp;
    return Math.round(n * p) / p;
  };

  const items = (parsed.items || []).map(it => {
    const fat = num(it.fat_g);
    const carbs = num(it.carbs_g);

    const micros = {};
    for (const n of NUTRIENTS) micros[n.key] = num(it[n.field], n.target < 10 ? 2 : 1);

    // Sub-components can't exceed their parent macro.
    micros.satfat = Math.min(micros.satfat, fat);
    micros.sugar = Math.min(micros.sugar, carbs);

    return {
      name_en: String(it.name_en || 'Food'),
      name_ar: String(it.name_ar || 'طعام'),
      portion: String(it.portion || ''),
      calories: Math.round(num(it.calories, 0)),
      protein_g: num(it.protein_g),
      carbs_g: carbs,
      fat_g: fat,
      micros,
    };
  });

  return {
    food_detected: !!parsed.food_detected,
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
    notes: String(parsed.notes || ''),
    items,
  };
}

/**
 * Shrink + re-encode an image so the upload stays small and the media type
 * always matches what we tell the API (image/jpeg).
 * @returns {Promise<{base64:string, dataUrl:string}>}
 */
function fileToJpegBase64(file, maxEdge = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], dataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image file.'));
    };

    img.src = url;
  });
}
