import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '48kb' }));
app.use(express.static('public'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please wait a few minutes before trying again.' }
});
app.use('/api/', apiLimiter);

// ============================================================================
// VERIFIED CLINICAL REFERENCE CATALOG (FALLBACK & SEMANTIC GROUNDING)
// ============================================================================
const VERIFIED_CLINICAL_CATALOG = [
  {
    id: 'med-paracetamol-650',
    name: 'Paracetamol 650mg (Dolo 650 / Calpol 650)',
    genericName: 'Paracetamol IP 650mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Tablet',
    category: 'Analgesic & Antipyretic',
    prescriptionStatus: 'OTC / Pharmacist Supervised',
    shortSummary: 'Standard antipyretic for acute fever and mild-to-moderate somatic pain relief.',
    description: 'Inhibits prostaglandin synthesis primarily in the central nervous system to reduce elevated body temperature and block pain impulse generation.',
    evidenceSummary: 'Clinically established first-line antipyretic and analgesic listed in the Indian Pharmacopoeia (IP) and WHO Essential Medicines List.',
    basePriceINR: 33.00,
    approxCostRangeINR: '₹30 – ₹36 (Strip of 15 Tablets)',
    packSize: 'Strip of 15 Tablets',
    uses: ['Reduction of acute fever', 'Tension headaches and migraine relief', 'Dental pain, myalgia, and post-vaccination pyrexia'],
    sideEffects: ['Rare skin hypersensitivity or rash', 'Mild gastric discomfort', 'Hepatotoxicity (liver injury) if daily maximum dose is exceeded'],
    standardDosage: 'Adults (≥50 kg): 1 tablet (650mg) every 6–8 hours after food as needed (Max 4,000mg/24 hrs). Pediatric (<12 yrs): Do not use 650mg strength; weight-based oral suspension (10–15 mg/kg/dose) under physician guidance only.',
    curableDiseases: ['Symptomatic relief of Acute Febrile Illness', 'Mild-to-Moderate Musculoskeletal Pain'],
    doctorAdvice: 'Maintain at least a 6-hour interval between doses. Avoid alcohol and check other cold/flu medicines for hidden paracetamol. Never give human paracetamol to pets.',
    referenceSource: 'Indian Pharmacopoeia (IP) / National List of Essential Medicines (NLEM)'
  },
  {
    id: 'med-ors-who',
    name: 'Oral Rehydration Salts IP (Electral / WHO ORS)',
    genericName: 'Sodium Chloride, Potassium Chloride, Sodium Citrate & Dextrose Anhydrous IP',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Oral Powder Sachet',
    category: 'Electrolyte & Fluid Replenisher',
    prescriptionStatus: 'OTC (Over-the-Counter)',
    shortSummary: 'WHO-formulated reduced-osmolarity oral electrolyte replacement for dehydration.',
    description: 'Restores water and essential electrolytes lost during acute diarrhea, vomiting, or excessive heat exhaustion via sodium-glucose cotransport in the small intestine.',
    evidenceSummary: 'Gold-standard clinically proven oral rehydration therapy endorsed by WHO, UNICEF, and the Indian Academy of Pediatrics.',
    basePriceINR: 22.00,
    approxCostRangeINR: '₹20 – ₹25 (21.8g Sachet for 1 Litre)',
    packSize: 'Sachet of 21.8g Powder',
    uses: ['Prevention and treatment of dehydration from acute diarrhea', 'Fluid replacement in vomiting and heat exhaustion', 'Electrolyte recovery during febrile illnesses'],
    sideEffects: ['Nausea or vomiting if consumed too rapidly', 'Hypernatremia or eyelid puffiness if mixed with insufficient water'],
    standardDosage: 'Dissolve entire 21.8g sachet in 1 Litre of safe drinking water. Adults: 200–400 ml after each loose stool. Pediatric: 50–100 ml (<2 yrs) or 100–200 ml (2–10 yrs) sipped slowly. Discard unused solution after 24 hours.',
    curableDiseases: ['Mild-to-Moderate Dehydration', 'Electrolyte Imbalance secondary to Gastroenteritis'],
    doctorAdvice: 'Never boil prepared ORS or mix with milk/juice. Seek urgent hospital care if the patient cannot keep fluids down or shows signs of lethargy.',
    referenceSource: 'WHO / UNICEF Reduced Osmolarity ORS Guidelines & IP'
  },
  {
    id: 'med-cetirizine-10',
    name: 'Cetirizine 10mg (Cetzine / Okacet / Alerid)',
    genericName: 'Cetirizine Hydrochloride IP 10mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Tablet',
    category: 'Second-Generation Antihistamine',
    prescriptionStatus: 'OTC / Pharmacist Supervised',
    shortSummary: 'Selective peripheral H1-receptor antagonist for allergic rhinitis and urticaria.',
    description: 'Blocks histamine H1 receptors on effector cells in the respiratory tract, skin, and blood vessels to suppress allergic inflammation, sneezing, and itching.',
    evidenceSummary: 'Well-established clinical efficacy in allergic rhinitis and chronic urticaria with lower sedation than first-generation antihistamines.',
    basePriceINR: 21.00,
    approxCostRangeINR: '₹18 – ₹26 (Strip of 10 Tablets)',
    packSize: 'Strip of 10 Tablets',
    uses: ['Seasonal and perennial allergic rhinitis (hay fever)', 'Chronic idiopathic urticaria (hives and skin itching)', 'Allergic conjunctivitis and insect bite reactions'],
    sideEffects: ['Mild drowsiness or fatigue', 'Dry mouth', 'Occasional headache or dizziness'],
    standardDosage: 'Adults & Adolescents (≥12 yrs): 10mg once daily, preferably in the evening. Pediatric (6–11 yrs): 5mg once daily using pediatric syrup as advised by a pediatrician.',
    curableDiseases: ['Symptomatic relief of Allergic Rhinitis', 'Acute and Chronic Urticaria'],
    doctorAdvice: 'Avoid driving if drowsiness occurs. Dose adjustment is necessary in moderate-to-severe kidney impairment.',
    referenceSource: 'Indian Pharmacopoeia (IP) / CDSCO Standard Treatment Guidelines'
  },
  {
    id: 'med-pantoprazole-40',
    name: 'Pantoprazole 40mg (Pan 40 / Pantocid 40)',
    genericName: 'Pantoprazole Sodium Gastro-Resistant IP 40mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Gastro-Resistant Tablet',
    category: 'Proton Pump Inhibitor (PPI)',
    prescriptionStatus: 'Prescription Only (Schedule H)',
    shortSummary: 'Gastric acid pump inhibitor for acid reflux (GERD) and peptic ulcer protection.',
    description: 'Irreversibly inhibits the H+/K+ ATPase enzyme system (proton pump) in gastric parietal cells, suppressing basal and stimulated gastric acid secretion.',
    evidenceSummary: 'Clinically proven gastric acid suppression for GERD and peptic ulcers; long-term unsupervised use carries nutrient malabsorption risks.',
    basePriceINR: 155.00,
    approxCostRangeINR: '₹135 – ₹165 (Strip of 15 Tablets)',
    packSize: 'Strip of 15 Enteric-Coated Tablets',
    uses: ['Gastroesophageal Reflux Disease (GERD) and erosive esophagitis', 'Peptic and duodenal ulcer healing', 'Prevention of NSAID-induced gastric ulcers'],
    sideEffects: ['Headache or mild abdominal bloating', 'Flatulence or mild diarrhea', 'Vitamin B12 or magnesium deficiency with prolonged unsupervised use (>1 year)'],
    standardDosage: 'Adults: Typically 40mg once daily taken 30–60 minutes before breakfast (swallowed whole) for duration prescribed by a doctor. Pediatric: Prescription-only; weight-based dosing by a pediatric specialist.',
    curableDiseases: ['Erosive Esophagitis', 'Peptic Ulcer Disease', 'GERD'],
    doctorAdvice: 'Schedule H prescription medicine—do not use continuously without medical review. Seek urgent care for unexplained weight loss or difficulty swallowing.',
    referenceSource: 'National List of Essential Medicines (NLEM India) / IP'
  },
  {
    id: 'med-ashwagandha',
    name: 'Ashwagandha (Withania somnifera)',
    genericName: 'Withania somnifera Root Extract / Churna',
    systemOfMedicine: 'Ayurvedic / Herbal',
    dosageForm: 'Capsule / Tablet / Churna (Powder)',
    category: 'Ayurvedic Rasayana (Adaptogenic Herb)',
    prescriptionStatus: 'OTC Ayurvedic / Nutraceutical Supplement',
    shortSummary: 'Classical Ayurvedic Rasayana herb traditionally used for stress resilience, vitality, and sleep support.',
    description: 'Contains bioactive withanolides studied for modulating hypothalamic-pituitary-adrenal (HPA) axis stress responses and supporting physical stamina.',
    evidenceSummary: 'Traditional Use: Extensive classical use in Ayurveda as a Balya and Rasayana. Scientific Evidence: Moderate clinical trial evidence supports mild-to-moderate stress/cortisol reduction and sleep quality improvement; long-term safety data remains limited.',
    basePriceINR: 220.00,
    approxCostRangeINR: '₹180 – ₹320 (60 Capsules / 100g Churna)',
    packSize: 'Bottle of 60 Capsules / 100g Powder',
    uses: ['Traditional adaptogenic support for stress and fatigue', 'Supportive care for sleep quality and physical endurance', 'General convalescence tonic in Ayurveda'],
    sideEffects: ['Mild gastrointestinal upset, nausea, or loose stools at high doses', 'Drowsiness when combined with sedatives', 'Rare reports of herb-induced liver injury with unstandardized extracts'],
    standardDosage: 'Adults: Standardized root extract 300–600mg daily (or 3–6g Churna with warm milk/water) as guided by a qualified Ayurvedic or medical practitioner. Pediatric & Pregnancy: Avoid unless specifically prescribed by a specialist.',
    curableDiseases: ['Supportive stress and fatigue management (non-curative adjuvant)'],
    doctorAdvice: 'Natural does not mean risk-free: avoid during pregnancy, autoimmune conditions, hyperthyroidism, or before surgery, and check for interactions with thyroid, diabetes, or sedative medicines.',
    referenceSource: 'Ayurvedic Pharmacopoeia of India (API) / NCCIH Clinical Evidence Summary'
  },
  {
    id: 'med-arsh-kalp',
    name: 'Arsh Kalp / Arsha Kalpa Vati',
    genericName: 'Classical Polyherbal Ayurvedic Formulation (Haritaki, Neem, Rasaut, Nagkesar, Reetha)',
    systemOfMedicine: 'Ayurvedic / Herbal',
    dosageForm: 'Tablet (Vati)',
    category: 'Ayurvedic Anorectal & Digestive Formulation',
    prescriptionStatus: 'OTC Proprietary / Classical Ayurvedic Medicine',
    shortSummary: 'Traditional Ayurvedic formulation used for symptomatic relief in hemorrhoids (piles) and constipation.',
    description: 'Combines mild herbal laxatives and astringent botanicals aimed at softening stools, reducing straining, and soothing local anorectal inflammation.',
    evidenceSummary: 'Traditional Use: Documented in Ayurvedic texts for Arsha (hemorrhoids) and bowel regulation. Scientific Evidence: Limited large-scale randomized clinical trials; primarily supported by traditional Ayurvedic practice and symptomatic bowel-softening mechanisms.',
    basePriceINR: 135.00,
    approxCostRangeINR: '₹110 – ₹160 (Pack of 40–60 Tablets)',
    packSize: 'Bottle of 60 Tablets',
    uses: ['Traditional supportive relief of bleeding and non-bleeding hemorrhoids (piles)', 'Relief of straining associated with chronic constipation', 'Supportive digestive and bowel regularity care'],
    sideEffects: ['Abdominal cramping or loose stools if overused', 'Possible gastric irritation in sensitive individuals'],
    standardDosage: 'Adults: Typically 1–2 tablets twice daily with lukewarm water after meals as directed by an Ayurvedic physician. Pediatric & Pregnancy: Contraindicated in pregnancy due to purgative herbs; pediatric use only under physician supervision.',
    curableDiseases: ['Symptomatic support in Grade I–II Hemorrhoids (Arsha) and Constipation'],
    doctorAdvice: 'Persistent rectal bleeding, severe pain, or changes in bowel habits must be evaluated by a physician or surgeon to rule out fissures, polyps, or colorectal conditions.',
    referenceSource: 'Ayurvedic Formulary of India / AYUSH Clinical Practice Guidelines'
  },
  {
    id: 'med-chyawanprash',
    name: 'Chyawanprash (Classical Avaleha)',
    genericName: 'Amalaki (Emblica officinalis) Base with 40+ Classical Ayurvedic Herbs, Honey & Ghee',
    systemOfMedicine: 'Ayurvedic / Herbal',
    dosageForm: 'Herbal Paste (Avaleha)',
    category: 'Ayurvedic Immunomodulatory & Respiratory Rasayana',
    prescriptionStatus: 'OTC Classical Ayurvedic Formulation',
    shortSummary: 'Traditional Amla-based polyherbal jam used for respiratory wellness, digestion, and seasonal immunity.',
    description: 'Rich in natural polyphenols and vitamin C from Amalaki combined with Pippali, Guduchi, and Ashwagandha to support upper respiratory resilience and convalescence.',
    evidenceSummary: 'Traditional Use: Classical Rasayana in Charaka Samhita. Scientific Evidence: Small clinical studies suggest supportive benefits for seasonal respiratory symptoms and antioxidant status, though it does not prevent or cure specific infections.',
    basePriceINR: 240.00,
    approxCostRangeINR: '₹210 – ₹390 (500g – 1kg Jar)',
    packSize: '500g Jar',
    uses: ['Seasonal respiratory tract wellness and general vitality', 'Supportive nutrition during convalescence', 'Antioxidant and digestive support'],
    sideEffects: ['Blood sugar spikes in diabetic patients (standard variants contain jaggery/sugar)', 'Mild acidity or heaviness if taken in excess'],
    standardDosage: 'Adults: 1 teaspoon (approx. 10–12g) once or twice daily, often followed by warm milk or water. Pediatric (>5 yrs): ½ teaspoon daily as guided by a physician.',
    curableDiseases: ['General wellness & seasonal respiratory support (preventive/supportive only)'],
    doctorAdvice: 'Individuals with Diabetes Mellitus must avoid sugar-based Chyawanprash and consult their doctor even before using sugar-free variants.',
    referenceSource: 'Ayurvedic Pharmacopoeia of India (API) / AYUSH'
  },
  {
    id: 'med-vitamin-d3-60k',
    name: 'Vitamin D3 60,000 IU (Uprise-D3 60K / Calcirol)',
    genericName: 'Cholecalciferol IP 60,000 IU',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Softgel Capsule / Granules',
    category: 'Fat-Soluble Vitamin & Bone Calcium Regulator',
    prescriptionStatus: 'Pharmacist / Physician Guided Supplement',
    shortSummary: 'High-strength Cholecalciferol for correcting clinical Vitamin D deficiency.',
    description: 'Promotes intestinal absorption of calcium and phosphorus and regulates parathyroid hormone levels to maintain healthy bone mineralization.',
    evidenceSummary: 'Clinically proven therapy for correcting serum 25-hydroxyvitamin D deficiency and nutritional osteomalacia.',
    basePriceINR: 130.00,
    approxCostRangeINR: '₹110 – ₹145 (Strip of 4 Softgel Capsules)',
    packSize: 'Strip of 4 Softgel Capsules',
    uses: ['Treatment of confirmed Vitamin D3 insufficiency or deficiency', 'Adjuvant therapy in osteoporosis and osteomalacia', 'Hypocalcemia management'],
    sideEffects: ['Hypercalcemia (nausea, excessive thirst, constipation) if taken daily instead of weekly', 'Hypercalciuria or renal toxicity upon chronic overdose'],
    standardDosage: 'Adults: High-strength 60,000 IU is a WEEKLY or MONTHLY correction dose (typically 1 capsule once a week for 6–8 weeks with meals), NEVER a daily dose. Pediatric: Strictly under pediatrician supervision.',
    curableDiseases: ['Vitamin D Deficiency', 'Nutritional Osteomalacia / Rickets'],
    doctorAdvice: 'CRITICAL SAFETY NOTE: 60,000 IU must NEVER be taken daily. Confirm deficiency with a 25(OH)D blood test and follow your doctor’s exact schedule.',
    referenceSource: 'Indian Pharmacopoeia (IP) / Endocrine Society Clinical Practice Guidelines'
  }
];

// ============================================================================
// STAGE 1-4: PRE-LLM QUERY NORMALIZATION, LANGUAGE & FUZZY ALIAS ENGINE
// ============================================================================
const PHONETIC_AND_REGIONAL_ALIASES = [
  { pattern: /\b(arsh\s*kalp|arsha\s*kalpa|arshkalp|arshakalp)\b/i, canonical: 'Arsh Kalp (Ayurvedic formulation for piles/hemorrhoids)', hint: 'ayurvedic_medicine' },
  { pattern: /\b(aswagandha|ashwagandha|ashvagandha|ashwaganda)\b/i, canonical: 'Ashwagandha (Withania somnifera)', hint: 'ayurvedic_medicine' },
  { pattern: /\b(chavanprash|chyawanprash|chyavanprash|chawanprash)\b/i, canonical: 'Chyawanprash (Classical Ayurvedic Avaleha)', hint: 'ayurvedic_medicine' },
  { pattern: /\b(triphala|trifala)\b/i, canonical: 'Triphala (Ayurvedic three-fruit formulation)', hint: 'ayurvedic_medicine' },
  { pattern: /\b(paracetmol|paracitamol|paracetamol|dolo\s*650)\b/i, canonical: 'Paracetamol 650mg (Dolo 650)', hint: 'allopathic_medicine' },
  { pattern: /\b(sugar\s*problem|sugar\s*ka\s*ilaj|madhumeh|high\s*sugar)\b/i, canonical: 'Diabetes Mellitus / Blood Glucose Management', hint: 'symptom_or_condition' },
  { pattern: /\b(bp\s*machine|blood\s*pressure\s*machine|bp\s*monitor|sphygmomanometer)\b/i, canonical: 'Blood Pressure Monitor (BP Machine)', hint: 'medical_equipment' },
  { pattern: /\b(sugar\s*machine|glucometer|glucose\s*monitor)\b/i, canonical: 'Blood Glucometer (Blood Glucose Monitoring Device)', hint: 'medical_equipment' },
  { pattern: /\b(nebulizer|nebuliser)\b/i, canonical: 'Nebulizer Machine (Aerosol Therapy Device)', hint: 'medical_equipment' },
  { pattern: /\b(oximeter|pulse\s*oximeter)\b/i, canonical: 'Pulse Oximeter (SpO2 Monitor)', hint: 'medical_equipment' },
  { pattern: /\b(pet\s*fever|dog\s*fever|cat\s*fever|kutte\s*ko\s*bukhar)\b/i, canonical: 'Fever in Pets (Veterinary Pyrexia Evaluation)', hint: 'veterinary_health' }
];

const HINGLISH_MARKERS_REGEX = /\b(kya|hai|hain|kaise|kab|kyu|kyon|dawa|dawai|ilaj|bukhar|dard|pet|kamzori|bal|baal|jhadna|neend|chahiye|lena|khana|peena|upay|lakshan|fayde|nuksan|batao|bataiye|ke\s+liye|ki\s+dawa|ka\s+ilaj|mein|aur|nahi)\b/i;

function analyzeRawQuery(rawQuery) {
  const trimmed = rawQuery.trim();
  const isHinglish = HINGLISH_MARKERS_REGEX.test(trimmed);
  let normalizedHint = '';
  let categoryHint = '';

  for (const entry of PHONETIC_AND_REGIONAL_ALIASES) {
    if (entry.pattern.test(trimmed)) {
      normalizedHint = entry.canonical;
      categoryHint = entry.hint;
      break;
    }
  }

  return {
    originalQuery: trimmed,
    detectedLanguage: isHinglish ? 'Hinglish' : 'English',
    normalizedHint,
    categoryHint
  };
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function findInVerifiedCatalogFuzzy(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const exactOrSub = VERIFIED_CLINICAL_CATALOG.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.genericName.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.shortSummary.toLowerCase().includes(q) ||
    item.uses.some(u => u.toLowerCase().includes(q))
  );
  if (exactOrSub.length > 0) return exactOrSub;

  // Fuzzy token similarity for misspelled medicine names (edit distance <= 2)
  const queryTokens = q.split(/\s+/).filter(t => t.length >= 4);
  if (queryTokens.length === 0) return [];

  return VERIFIED_CLINICAL_CATALOG.filter(item => {
    const itemTokens = `${item.name} ${item.genericName}`.toLowerCase().split(/[\s()/,-]+/).filter(t => t.length >= 4);
    return queryTokens.some(qt =>
      itemTokens.some(it => Math.abs(qt.length - it.length) <= 2 && levenshteinDistance(qt, it) <= 2)
    );
  });
}

// ============================================================================
// IN-MEMORY CACHES & RESILIENT MULTI-MODEL AI CLIENT
// ============================================================================
const searchCache = new Map();
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

const aiEnrichedRecCache = new Map();
let cachedModelList = null;
let cachedModelListTimestamp = 0;
const MODEL_CACHE_TTL_MS = 30 * 60 * 1000;
const blacklistedModels = new Set();

const PREFERRED_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gemma2-9b-it',
  'mixtral-8x7b-32768'
];

const NON_TEXT_CHAT_MODEL_REGEX = /orpheus|canopylabs|tts|whisper|audio|speech|playai|guard|safeguard|embed|rerank|tool-use|distil-whisper|allam|saba|arabic/i;
const UNWANTED_FOREIGN_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u4E00-\u9FFF]/;

function getConfiguredApiKey() {
  const raw = process.env.GROK_API_KEY || process.env.GROQ_API_KEY || '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

function getApiBaseUrl(apiKey) {
  if (apiKey.startsWith('xai-')) {
    return 'https://api.x.ai/v1';
  }
  return 'https://api.groq.com/openai/v1';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getCandidateTextModels(apiKey, baseUrl) {
  if (apiKey.startsWith('xai-')) {
    return ['grok-2-latest', 'grok-beta'];
  }

  const now = Date.now();
  if (!cachedModelList || now - cachedModelListTimestamp > MODEL_CACHE_TTL_MS) {
    try {
      const resp = await fetchWithTimeout(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      }, 8000);

      if (resp.ok) {
        const data = await resp.json();
        const rawModels = Array.isArray(data.data) ? data.data : [];

        const validIds = rawModels
          .filter(m => m && m.id && m.active !== false && !NON_TEXT_CHAT_MODEL_REGEX.test(m.id))
          .map(m => m.id);

        const prioritized = PREFERRED_TEXT_MODELS.filter(id => validIds.includes(id));
        const others = validIds.filter(id => !prioritized.includes(id));
        cachedModelList = [...prioritized, ...others];
        cachedModelListTimestamp = now;
      }
    } catch (err) {
      console.warn('[AI Model Discovery Warning]: Using static preferred model list:', err.message);
    }
  }

  const baseList = cachedModelList && cachedModelList.length > 0
    ? cachedModelList
    : PREFERRED_TEXT_MODELS;

  const available = baseList.filter(m => !blacklistedModels.has(m));
  return available.length > 0 ? available : PREFERRED_TEXT_MODELS;
}

function extractAndRepairJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty AI response');
  }

  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in AI response');
  }

  cleaned = cleaned.slice(firstBrace);

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        return JSON.parse(cleaned.slice(0, lastBrace + 1));
      } catch (__) {
        // Proceed to truncation repair
      }
    }
  }

  let repaired = cleaned.replace(/,\s*$/, '');
  let inString = false;
  let escapeNext = false;
  const stack = [];

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, '');
  while (stack.length > 0) repaired += stack.pop();

  return JSON.parse(repaired);
}

async function callGroqAI({ messages, maxTokens = 850, temperature = 0.2, expectJson = false }) {
  const apiKey = getConfiguredApiKey();
  if (!apiKey || apiKey === 'DEMO' || apiKey.includes('paste_your')) {
    const err = new Error('GROK_API_KEY is missing or invalid in environment variables.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const baseUrl = getApiBaseUrl(apiKey);
  const candidates = await getCandidateTextModels(apiKey, baseUrl);
  let lastError = null;

  for (let i = 0; i < Math.min(candidates.length, 5); i++) {
    const model = candidates[i];
    let currentMaxTokens = maxTokens;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: currentMaxTokens
          })
        }, 16000);

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            if (UNWANTED_FOREIGN_SCRIPT_REGEX.test(content)) {
              blacklistedModels.add(model);
              lastError = new Error(`Model ${model} returned unsupported foreign script.`);
              break;
            }

            const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            if (expectJson) {
              try {
                const parsedJson = extractAndRepairJson(cleanContent);
                return { content: cleanContent, json: parsedJson, model };
              } catch (parseErr) {
                console.warn(`[AI JSON Parse Failover]: Model "${model}" returned unparseable output. Failing over.`);
                lastError = parseErr;
                break;
              }
            }

            return { content: cleanContent, model };
          }
        }

        const errMsg = data.error?.message || `HTTP ${response.status}`;

        if (response.status === 401) {
          const authErr = new Error('Invalid AI API key (401 Unauthorized). Check GROK_API_KEY in .env / Render.');
          authErr.code = 'INVALID_API_KEY';
          throw authErr;
        }

        if (response.status === 400 && /max_tokens|context_window/i.test(errMsg) && currentMaxTokens > 512) {
          currentMaxTokens = 512;
          continue;
        }

        if (
          response.status === 400 ||
          response.status === 403 ||
          response.status === 404 ||
          /terms acceptance|decommissioned|does not exist|classification|not supported/i.test(errMsg)
        ) {
          blacklistedModels.add(model);
          lastError = new Error(errMsg);
          break;
        }

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(errMsg);
          await new Promise(r => setTimeout(r, 700 * Math.pow(2, attempt)));
          continue;
        }

        lastError = new Error(errMsg);
        break;
      } catch (networkErr) {
        if (networkErr.code === 'INVALID_API_KEY') throw networkErr;
        lastError = networkErr;
        if (attempt === 0) await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  throw lastError || new Error('AI service temporarily unavailable.');
}

// ============================================================================
// DIAGNOSTIC & CONFIG ENDPOINTS
// ============================================================================
app.get('/api/health', (req, res) => {
  const apiKey = getConfiguredApiKey();
  const hasKey = Boolean(apiKey && apiKey !== 'DEMO' && !apiKey.includes('paste_your'));
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: hasKey,
    aiProvider: apiKey.startsWith('xai-') ? 'xAI Grok' : 'Groq Cloud',
    mapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    firebaseConfigured: Boolean(process.env.FIREBASE_API_KEY),
    blacklistedModels: Array.from(blacklistedModels)
  });
});

app.get('/api/auth-config', (req, res) => {
  res.json({
    apiKey: (process.env.FIREBASE_API_KEY || '').trim(),
    authDomain: (process.env.FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: (process.env.FIREBASE_PROJECT_ID || '').trim(),
    appId: (process.env.FIREBASE_APP_ID || '').trim()
  });
});

// ============================================================================
// REAL GOOGLE MAPS LOCATION & PHARMACY TRACKER
// ============================================================================
app.post('/api/location', async (req, res) => {
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Valid numeric GPS coordinates required.' });
  }

  const mapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  const fallbackPharmacies = [
    { name: 'Pradhan Mantri Bhartiya Janaushadhi Kendra', distanceKm: 0.8, discountFactor: 0.50, badge: 'Govt Generic Store' },
    { name: 'MedPlus Pharmacy', distanceKm: 1.2, discountFactor: 0.85, badge: 'Verified Pharmacy' },
    { name: 'Apollo Pharmacy', distanceKm: 1.6, discountFactor: 0.90, badge: 'Verified Pharmacy' }
  ];

  try {
    let localityName = `Lat: ${lat.toFixed(2)}, Lng: ${lng.toFixed(2)}`;
    let pinCode = '';
    let pharmacies = fallbackPharmacies;

    if (mapsApiKey && mapsApiKey !== 'DEMO') {
      const geoResp = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsApiKey}`,
        {},
        8000
      );
      const geoData = await geoResp.json();

      if (geoData.status === 'OK' && geoData.results?.length > 0) {
        localityName = geoData.results[0].formatted_address;
        const postalObj = geoData.results[0].address_components?.find(c => c.types.includes('postal_code'));
        if (postalObj) pinCode = postalObj.long_name;
      }

      const placesResp = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=pharmacy&key=${mapsApiKey}`,
        {},
        8000
      );
      const placesData = await placesResp.json();

      if (placesData.status === 'OK' && placesData.results?.length > 0) {
        pharmacies = placesData.results.slice(0, 3).map((place, idx) => ({
          name: place.name,
          distanceKm: Number((0.5 + idx * 0.4).toFixed(1)),
          discountFactor: idx === 0 ? 0.85 : 0.92,
          badge: place.opening_hours?.open_now ? 'Open Now' : 'Verified Pharmacy'
        }));
      }
    }

    res.json({ locality: localityName, pinCode, coordinates: { lat, lng }, nearbyPharmacies: pharmacies });
  } catch (error) {
    console.error('[Location API Error]:', error.message);
    res.json({
      locality: `Lat: ${lat.toFixed(2)}, Lng: ${lng.toFixed(2)}`,
      pinCode: '',
      coordinates: { lat, lng },
      nearbyPharmacies: fallbackPharmacies
    });
  }
});

// ============================================================================
// DYNAMIC MEDICINE RECOMMENDATIONS ENDPOINT (ROTATING + AI ENRICHED + CACHED)
// ============================================================================
app.get('/api/recommendations', async (req, res) => {
  try {
    const excludeParam = (req.query.exclude || '').trim();
    const excludedIds = new Set(excludeParam ? excludeParam.split(',').map(s => s.trim()) : []);

    let pool = VERIFIED_CLINICAL_CATALOG.filter(item => !excludedIds.has(item.id));
    if (pool.length < 4) {
      pool = [...VERIFIED_CLINICAL_CATALOG];
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, 4);

    const uncached = selected.filter(m => !aiEnrichedRecCache.has(m.id));
    if (uncached.length > 0) {
      try {
        const namesList = uncached.map(m => `${m.id}: ${m.name}`).join('; ');
        const prompt = `For each medicine listed (${namesList}), provide a concise 1-sentence safety note in English distinguishing adult vs pediatric/prescription status.
Return ONLY a JSON object mapping each id to its note string, e.g. {"med-paracetamol-650": "..."}`;

        const { json: parsedNotes } = await callGroqAI({
          messages: [
            { role: 'system', content: 'You are a clinical pharmacology assistant. Output valid JSON in English only.' },
            { role: 'user', content: prompt }
          ],
          maxTokens: 320,
          temperature: 0.1,
          expectJson: true
        });

        uncached.forEach(item => {
          const note = typeof parsedNotes[item.id] === 'string' ? parsedNotes[item.id] : item.doctorAdvice;
          aiEnrichedRecCache.set(item.id, { ...item, aiSafetyHighlight: note });
        });
      } catch (aiErr) {
        uncached.forEach(item => {
          aiEnrichedRecCache.set(item.id, { ...item, aiSafetyHighlight: item.doctorAdvice });
        });
      }
    }

    const recommendations = selected.map(item => aiEnrichedRecCache.get(item.id) || item);

    return res.json({
      recommendations,
      disclaimer: 'Medical Safety Disclaimer: Information displayed is sourced from standard pharmacopoeia references for educational purposes only. Do not self-medicate. Always consult a registered medical practitioner or licensed pharmacist before taking any medication.'
    });
  } catch (error) {
    console.error('[Recommendations Endpoint Error]:', error.message);
    return res.status(500).json({
      error: 'Unable to load medicine recommendations right now.',
      recommendations: VERIFIED_CLINICAL_CATALOG.slice(0, 4)
    });
  }
});

// ============================================================================
// UNIVERSAL CONVERSATIONAL MEDICAL AI SEARCH PIPELINE
// ============================================================================
async function executeUniversalMedicalSearch(rawQuery, history = []) {
  const analysis = analyzeRawQuery(rawQuery);
  const { originalQuery, detectedLanguage, normalizedHint, categoryHint } = analysis;
  const normalizedKey = `${originalQuery.toLowerCase()}::${history.length}`;

  // Use cache only for standalone initial queries (no active conversation thread)
  if (history.length === 0) {
    const cached = searchCache.get(normalizedKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      return { ...cached.payload, source: 'cache' };
    }
  }

  // Stage 4: Check local verified reference catalog for grounding context
  const localMatches = findInVerifiedCatalogFuzzy(normalizedHint || originalQuery);
  const groundingContext = localMatches.length > 0
    ? `\nVerified Local Reference Matches (use to ground prices/facts if relevant): ${localMatches.map(m => `${m.name} (${m.systemOfMedicine}, MRP ~₹${m.basePriceINR})`).join('; ')}`
    : '';

  const hintContext = normalizedHint
    ? `\nPhonetic/Regional Normalization Hint: The user's query likely refers to "${normalizedHint}" (Category hint: ${categoryHint}).`
    : '';

  const safeHistory = Array.isArray(history)
    ? history.slice(-6).map(turn => ({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: String(turn.text || '').slice(0, 600)
      }))
    : [];

  const systemPrompt = `You are MediPulse Universal Medical AI, an intelligent, clinical-grade healthcare search assistant for India.
Your job is to understand WHAT THE USER MEANS—even with spelling mistakes, phonetic spellings, incomplete words, regional/Sanskrit terms, Hinglish, or natural-language questions—and respond with high medical accuracy and safety.

CORE RULES:
1. LANGUAGE MIRRORING (ENGLISH OR HINGLISH ONLY):
   - Detected user language: ${detectedLanguage}.
   - If the user wrote in Hinglish (Hindi in Roman script, e.g., "sugar problem", "bukhar ki dawa", "bal jhadne ka ilaj"), write your explanations naturally in clear Hinglish (Roman script) while keeping JSON keys in English.
   - If the user wrote in English, write 100% in clear Indian English.
   - NEVER output Arabic, Chinese, or any non-Latin foreign script.
2. UNIVERSAL DOMAIN COVERAGE:
   - Allopathic medicines (tablets, capsules, syrups, injections, creams, ointments, drops).
   - Ayurvedic, classical & proprietary formulations (e.g., Arsh Kalp, Ashwagandha, Chyawanprash, Triphala, Dabur/Patanjali products), Homeopathic, Unani, and Siddha preparations. Always explicitly distinguish **Traditional/Classical Uses** from **Scientific Clinical Evidence** and warn that herbal/natural does not automatically mean risk-free.
   - Medical equipment & diagnostic devices (BP monitors, glucometers, ECG machines, nebulizers, oxygen concentrators, stethoscopes, pulse oximeters, implants) — explain types, purpose, and selection criteria.
   - Symptoms, diseases & general healthcare (e.g., "Weakness", "Sugar problem", "I feel tired", "Something for sleep", "Medicine for hair fall") — explain possible medical causes, lifestyle/hygiene guidance, diagnostic evaluation options, and red-flag symptoms without blindly recommending drugs.
   - Sexual & reproductive health (e.g., "Sex", erectile dysfunction, infertility, contraception, STIs) — respond respectfully, scientifically, and without judgment.
   - Veterinary medicine (e.g., "Pet fever", animal medicines) — explicitly distinguish animal healthcare from human medicines (warn that human painkillers like Paracetamol/Ibuprofen are toxic to pets) and advise consulting a veterinarian.
   - Comparisons & term explanations (e.g., Ayurvedic vs Allopathic approaches).
3. VAGUE, AMBIGUOUS & UNRELATED QUERIES:
   - For vague medical queries (e.g., "Hair problem", "BP", "Weakness"), provide a helpful initial medical overview AND include 2–3 clickable clarifying follow-up options in "followUpQuestions" rather than rejecting the query.
   - If the query is completely unrelated to health, medicine, biology, wellness, or veterinary care (e.g., movies, cricket, coding, politics), classify as "non_medical_redirect" and politely explain that MediPulse specializes in healthcare without inventing fake medical connections.
4. STRICT FACTUALITY & SAFETY:
   - Never invent medicines, ingredients, prices, or clinical trials. If reliable information is unavailable for an obscure brand, explicitly state the uncertainty.
   - Never recommend prescription medicines (Schedule H/H1/X) or personalized dosages for self-medication. Clearly distinguish Adult, Pediatric, and Prescription-Only rules.

Output ONLY a single raw JSON object (no markdown fences) using ONE of these 4 response structures:

STRUCTURE A — Specific Medicine / Formulation (Allopathic, Ayurvedic, Homeopathic, Unani, Siddha, Nutraceutical, or Veterinary):
{
  "intentType": "medicine",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Clear description of what the user searched (including spelling/Hinglish correction if any)",
  "wasCorrected": true,
  "isAmbiguousMatch": false,
  "medicines": [
    {
      "name": "Full Medicine / Formulation Name",
      "genericName": "Active Salt Composition or Key Classical Ingredients",
      "systemOfMedicine": "Allopathic | Ayurvedic / Herbal | Homeopathic | Unani | Siddha | Veterinary | Nutraceutical",
      "dosageForm": "Tablet | Capsule | Syrup | Paste (Avaleha) | Injection | Drops | Ointment | Powder",
      "category": "Therapeutic / Pharmacological Class",
      "prescriptionStatus": "OTC | Supplement | Prescription Only (Schedule H) | Veterinary Rx",
      "description": "Clear mechanism of action or traditional formulation overview",
      "evidenceSummary": "Explicit distinction between Scientific Clinical Evidence and Traditional/Classical Use (plus uncertainty notice if applicable)",
      "basePriceINR": 95,
      "packSize": "Standard Pack Size",
      "uses": ["Primary use 1", "Primary use 2", "Primary use 3"],
      "sideEffects": ["Side effect / contraindication 1", "Interaction / precaution 2"],
      "standardDosage": "General reference distinguishing Adult vs Pediatric vs Prescription-Only (or Animal Species for Veterinary). No self-medication prescription.",
      "curableDiseases": ["Approved clinical indication or supportive role"],
      "doctorAdvice": "Key safety warnings, interactions, and when to consult a doctor or veterinarian"
    }
  ],
  "followUpQuestions": ["Relevant follow-up question 1", "Relevant follow-up question 2"]
}

STRUCTURE B — Medical Equipment & Diagnostic Devices (BP monitor, glucometer, nebulizer, oximeter, etc.):
{
  "intentType": "medical_equipment",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Identified Medical Device / Equipment",
  "device": {
    "title": "Device Name",
    "category": "Diagnostic Device | Respiratory Equipment | Home Monitoring | Clinical Implant",
    "purpose": "What the device measures or treats and why it is used",
    "typesAvailable": ["Type 1 (e.g., Upper-arm oscillometric monitor)", "Type 2 (e.g., Wrist monitor)"],
    "selectionCriteria": ["Key buying/clinical accuracy factor 1 (e.g., cuff size, clinical validation)", "Factor 2", "Factor 3"],
    "properUsage": "Step-by-step best practices for accurate readings or safe home use",
    "safetyAndMaintenance": "Calibration, hygiene, contraindications, and when readings require a doctor's review"
  },
  "followUpQuestions": ["Relevant follow-up question 1", "Relevant follow-up question 2"]
}

STRUCTURE C — Symptoms, Diseases, Sexual Health, Veterinary Care, Comparisons, or Vague Medical Queries:
{
  "intentType": "clinical_guidance",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "How the AI interpreted the user's health/symptom/veterinary/sexual-health query",
  "guidance": {
    "title": "Clear Clinical Topic Title",
    "domainTag": "Symptom & Evaluation | Chronic Condition | Sexual & Reproductive Health | Veterinary Care | Sleep & Wellness | Treatment Comparison",
    "overview": "Empathetic, scientifically accurate, non-judgmental 2–3 sentence explanation answering the user's question directly",
    "possibleCausesOrFactors": ["Cause / factor / comparison point 1", "Point 2", "Point 3"],
    "evaluationAndCare": ["Recommended diagnostic test or lifestyle/hygiene measure 1", "Measure 2", "Measure 3"],
    "redFlags": ["Serious warning symptom requiring prompt medical/veterinary evaluation 1", "Warning sign 2"],
    "doctorAdvice": "Clear guidance on professional consultation and why self-medication should be avoided"
  },
  "followUpQuestions": ["Clarifying or next-step question 1", "Question 2", "Question 3"]
}

STRUCTURE D — Completely Non-Medical Query (Polite Redirection):
{
  "intentType": "non_medical_redirect",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Non-medical topic detected",
  "redirect": {
    "title": "Healthcare & Medical Search Assistant",
    "message": "Polite 2-sentence explanation that MediPulse specializes in medicines, Ayurvedic/traditional formulations, medical devices, symptoms, and veterinary health, inviting the user to enter a health-related query.",
    "exampleQueries": ["Dolo 650 uses and precautions", "What is Arsh Kalp?", "How to choose a BP machine", "Causes of persistent tiredness"]
  }
}`;

  const userPrompt = `User Raw Query: "${originalQuery}"${hintContext}${groundingContext}
Synthesize the most helpful, medically accurate JSON response now.`;

  try {
    const { json: parsed, model } = await callGroqAI({
      messages: [
        { role: 'system', content: systemPrompt },
        ...safeHistory,
        { role: 'user', content: userPrompt }
      ],
      maxTokens: 900,
      temperature: 0.15,
      expectJson: true
    });

    const intentType = parsed.intentType || 'clinical_guidance';
    const followUps = Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.filter(q => typeof q === 'string' && q.trim()).slice(0, 3)
      : [];

    if (intentType === 'medicine') {
      const rawList = Array.isArray(parsed.medicines) ? parsed.medicines : [parsed];
      const sanitizedList = rawList
        .filter(item => item && (item.name || item.genericName))
        .slice(0, 3)
        .map((item, idx) => {
          const basePrice = Number(item.basePriceINR) > 0 ? Number(item.basePriceINR) : 95.00;
          return {
            id: `ai-${Date.now()}-${idx}`,
            name: item.name || normalizedHint || originalQuery,
            genericName: item.genericName || 'Refer to official formulation label',
            systemOfMedicine: item.systemOfMedicine || 'Allopathic',
            dosageForm: item.dosageForm || 'Standard Formulation',
            category: item.category || 'Clinical Preparation',
            prescriptionStatus: item.prescriptionStatus || 'Consult Physician / Pharmacist',
            description: item.description || 'Clinical information synthesized via MediPulse Medical AI.',
            evidenceSummary: item.evidenceSummary || 'Consult standard pharmacopoeia or a qualified healthcare practitioner for clinical evidence details.',
            basePriceINR: basePrice,
            packSize: item.packSize || 'Standard Pack',
            uses: Array.isArray(item.uses) && item.uses.length > 0 ? item.uses : ['Consult a qualified healthcare professional for approved indications'],
            sideEffects: Array.isArray(item.sideEffects) && item.sideEffects.length > 0 ? item.sideEffects : ['Consult official package insert or pharmacist for adverse effects'],
            standardDosage: item.standardDosage || 'Dosage must be determined by a qualified medical practitioner based on age, weight, and clinical condition.',
            curableDiseases: Array.isArray(item.curableDiseases) && item.curableDiseases.length > 0 ? item.curableDiseases : ['Approved clinical indications only'],
            doctorAdvice: item.doctorAdvice || 'Do not self-medicate. Consult a registered medical practitioner before taking any medication.',
            referenceSource: `MediPulse Medical AI (${model})`
          };
        });

      const payload = {
        intentType: 'medicine',
        detectedLanguage: parsed.detectedLanguage || detectedLanguage,
        interpretedQuery: parsed.interpretedQuery || normalizedHint || originalQuery,
        wasCorrected: Boolean(parsed.wasCorrected || normalizedHint),
        isAmbiguousMatch: Boolean(parsed.isAmbiguousMatch || sanitizedList.length > 1),
        medicines: sanitizedList,
        followUpQuestions: followUps
      };

      if (history.length === 0) {
        searchCache.set(normalizedKey, { timestamp: Date.now(), payload });
      }
      return { ...payload, source: 'ai' };
    }

    if (intentType === 'medical_equipment' && parsed.device) {
      const d = parsed.device;
      const payload = {
        intentType: 'medical_equipment',
        detectedLanguage: parsed.detectedLanguage || detectedLanguage,
        interpretedQuery: parsed.interpretedQuery || normalizedHint || originalQuery,
        device: {
          title: d.title || normalizedHint || originalQuery,
          category: d.category || 'Medical Device',
          purpose: d.purpose || '',
          typesAvailable: Array.isArray(d.typesAvailable) ? d.typesAvailable : [],
          selectionCriteria: Array.isArray(d.selectionCriteria) ? d.selectionCriteria : [],
          properUsage: d.properUsage || '',
          safetyAndMaintenance: d.safetyAndMaintenance || 'Follow manufacturer calibration instructions and review abnormal readings with a doctor.',
          referenceSource: `MediPulse Medical AI (${model})`
        },
        followUpQuestions: followUps,
        medicines: []
      };

      if (history.length === 0) {
        searchCache.set(normalizedKey, { timestamp: Date.now(), payload });
      }
      return { ...payload, source: 'ai' };
    }

    if (intentType === 'non_medical_redirect' && parsed.redirect) {
      return {
        intentType: 'non_medical_redirect',
        detectedLanguage: parsed.detectedLanguage || detectedLanguage,
        interpretedQuery: parsed.interpretedQuery || originalQuery,
        redirect: {
          title: parsed.redirect.title || 'Healthcare & Medical Search Assistant',
          message: parsed.redirect.message || 'MediPulse AI specializes in medical, pharmaceutical, Ayurvedic, device, and veterinary queries. Please enter a health-related question.',
          exampleQueries: Array.isArray(parsed.redirect.exampleQueries) ? parsed.redirect.exampleQueries.slice(0, 4) : []
        },
        medicines: []
      };
    }

    // Default: clinical_guidance (Symptoms, conditions, sexual health, veterinary, comparisons, ambiguous queries)
    const g = parsed.guidance || {};
    const payload = {
      intentType: 'clinical_guidance',
      detectedLanguage: parsed.detectedLanguage || detectedLanguage,
      interpretedQuery: parsed.interpretedQuery || normalizedHint || originalQuery,
      guidance: {
        title: g.title || normalizedHint || originalQuery,
        domainTag: g.domainTag || 'Clinical Health Guidance',
        overview: g.overview || 'Consult a qualified healthcare professional for an accurate evaluation.',
        possibleCausesOrFactors: Array.isArray(g.possibleCausesOrFactors) ? g.possibleCausesOrFactors : [],
        evaluationAndCare: Array.isArray(g.evaluationAndCare) ? g.evaluationAndCare : [],
        redFlags: Array.isArray(g.redFlags) ? g.redFlags : [],
        doctorAdvice: g.doctorAdvice || 'Always consult a registered medical practitioner or veterinarian before starting any treatment.',
        referenceSource: `MediPulse Medical AI (${model})`
      },
      followUpQuestions: followUps,
      medicines: []
    };

    if (history.length === 0) {
      searchCache.set(normalizedKey, { timestamp: Date.now(), payload });
    }
    return { ...payload, source: 'ai' };
  } catch (err) {
    console.error('[Universal Search AI Error]:', err.message);

    if (localMatches.length > 0) {
      return {
        intentType: 'medicine',
        detectedLanguage,
        interpretedQuery: normalizedHint || originalQuery,
        isAmbiguousMatch: localMatches.length > 1,
        medicines: localMatches,
        followUpQuestions: ['What are the side effects?', 'Is a prescription required?'],
        source: 'verified-catalog-fallback',
        notice: 'Showing verified clinical reference data while live AI search is momentarily busy.'
      };
    }

    const errorObj = new Error(
      err.code === 'MISSING_API_KEY'
        ? 'Server configuration notice: GROK_API_KEY is missing in environment variables.'
        : err.code === 'INVALID_API_KEY'
          ? 'Server configuration notice: GROK_API_KEY was rejected (401 Unauthorized).'
          : 'The AI medical search service is temporarily busy or unreachable. Please try again in a few seconds.'
    );
    errorObj.statusCode = 503;
    throw errorObj;
  }
}

// Backward-compatible GET endpoint
app.get('/api/medicines', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Please enter a medicine, symptom, device, or healthcare question.', medicines: [] });
  }
  if (query.length > 250) {
    return res.status(400).json({ error: 'Please keep your search query under 250 characters.', medicines: [] });
  }

  try {
    const result = await executeUniversalMedicalSearch(query, []);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 503).json({ error: err.message, medicines: [] });
  }
});

// Conversational multi-turn search endpoint
app.post('/api/search', async (req, res) => {
  const { query = '', history = [] } = req.body || {};
  const cleanQuery = typeof query === 'string' ? query.trim() : '';

  if (!cleanQuery) {
    return res.status(400).json({ error: 'Please enter a medicine, symptom, device, or healthcare question.', medicines: [] });
  }
  if (cleanQuery.length > 250) {
    return res.status(400).json({ error: 'Please keep your search query under 250 characters.', medicines: [] });
  }

  try {
    const result = await executeUniversalMedicalSearch(cleanQuery, history);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 503).json({ error: err.message, medicines: [] });
  }
});

// ============================================================================
// CHATBOT BACKEND (STRICT ENGLISH / HINGLISH LANGUAGE MIRRORING)
// ============================================================================
const CHAT_SYSTEM_INSTRUCTION = `
You are MediBot, a polite, knowledgeable medical information assistant for MediPulse India.
1. STRICT LANGUAGE RULE (ENGLISH OR HINGLISH ONLY):
   - If the user writes in English, respond 100% in clear Indian English.
   - If the user writes in Hinglish (Hindi written in the Latin/English alphabet), respond naturally in Hinglish using the English/Roman alphabet.
   - NEVER respond in Arabic, Chinese, Russian, or any non-English foreign script.
2. Answer everyday greetings and general questions naturally and concisely.
3. For medicine, Ayurvedic, device, sexual-health, or veterinary queries, use clear headings, bullet points, and bold labels. Distinguish traditional uses from clinical evidence, never prescribe personalized dosages, and always remind the user to consult a qualified doctor or veterinarian.
`.trim();

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};
  const cleanMessage = typeof message === 'string' ? message.trim() : '';

  if (!cleanMessage) {
    return res.status(400).json({ error: 'Please enter a message.' });
  }

  try {
    const safeHistory = Array.isArray(history)
      ? history.slice(-8).map(turn => ({
          role: turn.role === 'model' ? 'assistant' : 'user',
          content: String(turn.text || '').slice(0, 1000)
        }))
      : [];

    const messages = [
      { role: 'system', content: CHAT_SYSTEM_INSTRUCTION },
      ...safeHistory,
      {
        role: 'user',
        content: `${cleanMessage}\n\n[System Note: Reply strictly in English or Hinglish matching the user's language.]`
      }
    ];

    const { content } = await callGroqAI({
      messages,
      maxTokens: 550,
      temperature: 0.2
    });

    return res.json({ reply: content });
  } catch (error) {
    console.error('[Chatbot AI Error]:', error.message);

    const catalogMatch = findInVerifiedCatalogFuzzy(cleanMessage)[0];
    if (catalogMatch) {
      const fallbackReply = `**${catalogMatch.name}** (${catalogMatch.genericName})\n\n` +
        `**System & Classification:** ${catalogMatch.systemOfMedicine} • ${catalogMatch.prescriptionStatus}\n` +
        `**Approx. Cost:** ${catalogMatch.approxCostRangeINR}\n` +
        `**Common Uses:** ${catalogMatch.uses.join(', ')}\n` +
        `**Evidence Note:** ${catalogMatch.evidenceSummary}\n` +
        `**Possible Side Effects:** ${catalogMatch.sideEffects.join(', ')}\n` +
        `**General Dosage Reference:** ${catalogMatch.standardDosage}\n\n` +
        `*Note: Live AI chat is temporarily busy; showing verified reference data. Always consult a qualified doctor before taking medication.*`;
      return res.json({ reply: fallbackReply });
    }

    return res.status(503).json({
      error: 'MediBot is temporarily unable to reach the AI service. Please try sending your message again in a moment.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`MediPulse India Server running on http://localhost:${PORT}`);
});