import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please wait a few minutes before trying again.' }
});
app.use('/api/', apiLimiter);

// ============================================================================
// VERIFIED CLINICAL REFERENCE CATALOG (CDSCO / IP / WHO ESSENTIAL REFERENCE)
// ============================================================================
const VERIFIED_CLINICAL_CATALOG = [
  {
    id: 'med-paracetamol-650',
    name: 'Paracetamol 650mg (Dolo 650 / Calpol 650)',
    genericName: 'Paracetamol IP 650mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Tablet',
    targetSpecies: 'Human',
    category: 'Analgesic & Antipyretic',
    prescriptionStatus: 'OTC / Pharmacist Supervised',
    shortSummary: 'Standard antipyretic for acute fever and mild-to-moderate somatic pain relief.',
    description: 'Inhibits prostaglandin synthesis primarily in the central nervous system to reduce elevated body temperature and block pain impulse generation.',
    basePriceINR: 33.00,
    approxCostRangeINR: '₹30 – ₹36 (Strip of 15 Tablets)',
    packSize: 'Strip of 15 Tablets',
    uses: ['Reduction of acute fever', 'Tension headaches and migraine relief', 'Dental pain, myalgia, and post-vaccination pyrexia'],
    sideEffects: ['Rare skin hypersensitivity or rash', 'Mild gastric discomfort', 'Hepatotoxicity (liver injury) if daily maximum dose is exceeded'],
    standardDosage: 'Adults (≥50 kg): 1 tablet (650mg) every 6–8 hours after food as needed (Max 4,000mg/24 hrs). Pediatric (<12 yrs): Do not use 650mg strength; weight-based pediatric oral suspension (10–15 mg/kg/dose) under physician guidance only.',
    curableDiseases: ['Symptomatic relief of Acute Febrile Illness', 'Mild-to-Moderate Musculoskeletal Pain'],
    doctorAdvice: 'Maintain at least a 6-hour interval between doses. Avoid alcohol and check other cold/flu medicines for hidden paracetamol to prevent accidental overdose.',
    referenceSource: 'Indian Pharmacopoeia (IP) / National List of Essential Medicines (NLEM)'
  },
  {
    id: 'med-ors-who',
    name: 'Oral Rehydration Salts IP (Electral / WHO ORS)',
    genericName: 'Sodium Chloride, Potassium Chloride, Sodium Citrate & Dextrose Anhydrous IP',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Oral Powder Sachet',
    targetSpecies: 'Human',
    category: 'Electrolyte & Fluid Replenisher',
    prescriptionStatus: 'OTC (Over-the-Counter)',
    shortSummary: 'WHO-formulated reduced-osmolarity oral electrolyte replacement for dehydration.',
    description: 'Restores water and essential electrolytes lost during acute diarrhea, vomiting, or excessive heat exhaustion via sodium-glucose cotransport in the small intestine.',
    basePriceINR: 22.00,
    approxCostRangeINR: '₹20 – ₹25 (21.8g Sachet for 1 Litre)',
    packSize: 'Sachet of 21.8g Powder',
    uses: ['Prevention and treatment of dehydration from acute diarrhea', 'Fluid replacement in vomiting and heat exhaustion', 'Electrolyte recovery during febrile illnesses'],
    sideEffects: ['Nausea or vomiting if consumed too rapidly', 'Hypernatremia or puffiness of eyelids if mixed with insufficient water'],
    standardDosage: 'Preparation: Dissolve entire 21.8g sachet in exactly 1 Litre of safe drinking water. Adults: 200–400 ml after each loose stool. Pediatric: 50–100 ml (under 2 yrs) or 100–200 ml (2–10 yrs) sipped slowly after each loose stool. Discard unused solution after 24 hours.',
    curableDiseases: ['Mild-to-Moderate Dehydration', 'Electrolyte Imbalance secondary to Gastroenteritis'],
    doctorAdvice: 'Never boil the prepared ORS solution and never mix with milk, soup, or fruit juice. Seek immediate hospital care if the patient cannot drink or shows signs of severe lethargy.',
    referenceSource: 'WHO / UNICEF Reduced Osmolarity ORS Guidelines & IP'
  },
  {
    id: 'med-cetirizine-10',
    name: 'Cetirizine 10mg (Cetzine / Okacet / Alerid)',
    genericName: 'Cetirizine Hydrochloride IP 10mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Tablet',
    targetSpecies: 'Human',
    category: 'Second-Generation Antihistamine',
    prescriptionStatus: 'OTC / Pharmacist Supervised',
    shortSummary: 'Selective peripheral H1-receptor antagonist for allergic rhinitis and urticaria.',
    description: 'Blocks histamine H1 receptors on effector cells in the respiratory tract, skin, and blood vessels to suppress allergic inflammation, sneezing, and itching.',
    basePriceINR: 21.00,
    approxCostRangeINR: '₹18 – ₹26 (Strip of 10 Tablets)',
    packSize: 'Strip of 10 Tablets',
    uses: ['Seasonal and perennial allergic rhinitis (hay fever)', 'Chronic idiopathic urticaria (hives and skin itching)', 'Allergic conjunctivitis and insect bite reactions'],
    sideEffects: ['Mild drowsiness or fatigue', 'Dry mouth', 'Occasional headache or dizziness'],
    standardDosage: 'Adults & Adolescents (≥12 yrs): 10mg (1 tablet) once daily, preferably in the evening. Pediatric (6–11 yrs): 5mg once daily or 2.5mg twice daily using pediatric syrup formulation as advised by a pediatrician.',
    curableDiseases: ['Symptomatic relief of Allergic Rhinitis', 'Acute and Chronic Urticaria'],
    doctorAdvice: 'May cause mild sedation in sensitive individuals; avoid driving or operating machinery until you know how it affects you. Dose adjustment is required in renal impairment.',
    referenceSource: 'Indian Pharmacopoeia (IP) / CDSCO Standard Treatment Guidelines'
  },
  {
    id: 'med-pantoprazole-40',
    name: 'Pantoprazole 40mg (Pan 40 / Pantocid 40)',
    genericName: 'Pantoprazole Sodium Gastro-Resistant IP 40mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Enteric-Coated Tablet',
    targetSpecies: 'Human',
    category: 'Proton Pump Inhibitor (PPI)',
    prescriptionStatus: 'Prescription Only (Schedule H)',
    shortSummary: 'Gastric acid pump inhibitor for acid reflux (GERD) and peptic ulcer protection.',
    description: 'Irreversibly inhibits the H+/K+ ATPase enzyme system (proton pump) in gastric parietal cells, suppressing basal and stimulated gastric acid secretion.',
    basePriceINR: 155.00,
    approxCostRangeINR: '₹135 – ₹165 (Strip of 15 Tablets)',
    packSize: 'Strip of 15 Enteric-Coated Tablets',
    uses: ['Gastroesophageal Reflux Disease (GERD) and erosive esophagitis', 'Peptic and duodenal ulcer healing', 'Prevention of NSAID-induced gastric ulcers'],
    sideEffects: ['Headache or mild abdominal bloating', 'Flatulence or mild diarrhea', 'Vitamin B12 or magnesium deficiency with prolonged unsupervised use (>1 year)'],
    standardDosage: 'Adults: Typically 40mg once daily taken 30–60 minutes before breakfast (swallowed whole, do not crush or chew) for duration prescribed by a physician. Pediatric: Prescription-only; weight-based dosing determined strictly by a pediatric specialist.',
    curableDiseases: ['Erosive Esophagitis', 'Peptic Ulcer Disease', 'GERD'],
    doctorAdvice: 'Prescription medicine—do not use long-term without medical supervision. Seek urgent evaluation if you experience unexplained weight loss or difficulty swallowing.',
    referenceSource: 'National List of Essential Medicines (NLEM India) / IP'
  },
  {
    id: 'med-biotin-10mg',
    name: 'Biotin 10mg / 10,000 mcg (Biotin Forte / Hairbless)',
    genericName: 'Biotin USP / IP (Vitamin B7)',
    systemOfMedicine: 'Allopathic / Nutraceutical',
    dosageForm: 'Tablet',
    targetSpecies: 'Human',
    category: 'Water-Soluble B-Complex Vitamin Supplement',
    prescriptionStatus: 'OTC Nutritional Supplement',
    shortSummary: 'Essential coenzyme for keratin synthesis, fatty acid metabolism, and nail/hair health.',
    description: 'Acts as an essential cofactor for carboxylase enzymes involved in gluconeogenesis, fatty acid synthesis, and amino acid catabolism supporting keratin infrastructure.',
    basePriceINR: 140.00,
    approxCostRangeINR: '₹120 – ₹180 (Strip of 10 Tablets)',
    packSize: 'Strip of 10 Tablets',
    uses: ['Management of nutritional biotin deficiency', 'Supportive care for brittle nails and hair thinning associated with vitamin deficiency', 'Metabolic cofactor support'],
    sideEffects: ['Generally well-tolerated; rare mild gastrointestinal upset', 'High doses can interfere with laboratory immunoassays (especially thyroid and cardiac troponin blood tests)'],
    standardDosage: 'Adults: Recommended Dietary Allowance (RDA) is 30 mcg/day; therapeutic supplement tablets (5mg–10mg once daily after meals) should be taken only as guided by a physician. Pediatric: Consult a pediatrician for age-appropriate dietary allowance.',
    curableDiseases: ['Nutritional Biotin Deficiency'],
    doctorAdvice: 'Inform your doctor and pathology lab before blood tests, as high-dose biotin should be paused 48–72 hours prior to thyroid or hormone lab panels to prevent false test readings.',
    referenceSource: 'ICMR-NIN Dietary Guidelines for Indians / USP-NF'
  },
  {
    id: 'med-ashwagandha',
    name: 'Ashwagandha (Withania somnifera Standardized Extract)',
    genericName: 'Withania somnifera Root Extract (Ayurvedic Formulation)',
    systemOfMedicine: 'Ayurvedic / Herbal',
    dosageForm: 'Capsule / Tablet / Churna',
    targetSpecies: 'Human',
    category: 'Ayurvedic Rasayana & Adaptogen',
    prescriptionStatus: 'OTC Ayurvedic Supplement',
    shortSummary: 'Traditional Ayurvedic adaptogenic herb used for stress resilience and general vitality.',
    description: 'Contains bioactive withanolides that modulate hypothalamic-pituitary-adrenal (HPA) axis stress signaling and support neuromuscular recovery.',
    basePriceINR: 180.00,
    approxCostRangeINR: '₹150 – ₹240 (Bottle of 60 Capsules)',
    packSize: 'Bottle of 60 Capsules',
    uses: ['Supportive management of mild stress and fatigue', 'General physical stamina and sleep quality support in Ayurvedic practice'],
    sideEffects: ['Mild drowsiness or stomach upset at high doses', 'May interact with thyroid, sedative, blood pressure, or blood-sugar medications'],
    standardDosage: 'Adults: Typically 300mg–500mg standardized root extract once or twice daily after meals as directed by an Ayurvedic or medical practitioner. Pediatric & Pregnancy: Avoid unless specifically prescribed by a qualified physician.',
    curableDiseases: ['Stress-related fatigue (supportive Ayurvedic care)'],
    doctorAdvice: 'Contraindicated in pregnancy and autoimmune conditions unless supervised by a doctor. Monitor thyroid levels if taken alongside levothyroxine.',
    referenceSource: 'Ayurvedic Pharmacopoeia of India (API) / Ministry of AYUSH'
  },
  {
    id: 'med-vitamin-c-500',
    name: 'Vitamin C 500mg Chewable (Limcee / Celin 500)',
    genericName: 'Ascorbic Acid IP 100mg + Sodium Ascorbate IP 450mg (Eq. to 500mg Vitamin C)',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Chewable Tablet',
    targetSpecies: 'Human',
    category: 'Antioxidant & Water-Soluble Vitamin',
    prescriptionStatus: 'OTC Nutritional Supplement',
    shortSummary: 'Essential antioxidant vitamin for collagen biosynthesis, iron absorption, and immunity.',
    description: 'Supports hydroxylation reactions required for connective tissue collagen synthesis, enhances non-heme iron absorption, and protects cells against oxidative stress.',
    basePriceINR: 25.00,
    approxCostRangeINR: '₹23 – ₹28 (Strip of 15 Chewable Tablets)',
    packSize: 'Strip of 15 Chewable Tablets',
    uses: ['Prevention and treatment of Vitamin C deficiency (Scurvy)', 'Adjuvant support for iron absorption in iron-deficiency anemia', 'Wound healing and collagen tissue maintenance'],
    sideEffects: ['Heartburn or mild gastric acidity at high doses', 'Osmotic diarrhea if intake exceeds 2,000mg/day', 'Increased risk of oxalate kidney stones in predisposed individuals'],
    standardDosage: 'Adults: 1 chewable tablet (500mg) once daily or as directed by a healthcare provider. Pediatric: Use age-appropriate pediatric drops/syrup (40–65 mg/day RDA) under pediatric guidance.',
    curableDiseases: ['Ascorbic Acid Deficiency (Scurvy)'],
    doctorAdvice: 'Drink adequate water when taking Vitamin C supplements. Patients with a history of renal calculi (kidney stones) or G6PD deficiency should avoid high-dose supplementation.',
    referenceSource: 'Indian Pharmacopoeia (IP) / ICMR-NIN Nutritional Guidelines'
  },
  {
    id: 'med-cholecalciferol-60k',
    name: 'Vitamin D3 60,000 IU (Uprise-D3 60K / Calcirol)',
    genericName: 'Cholecalciferol IP 60,000 IU',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Softgel Capsule / Granules Sachet',
    targetSpecies: 'Human',
    category: 'Fat-Soluble Vitamin & Bone Calcium Regulator',
    prescriptionStatus: 'Pharmacist / Physician Guided Supplement',
    shortSummary: 'High-strength Cholecalciferol for correcting clinical Vitamin D deficiency.',
    description: 'Promotes intestinal absorption of calcium and phosphorus and regulates parathyroid hormone levels to maintain healthy bone mineralization.',
    basePriceINR: 130.00,
    approxCostRangeINR: '₹110 – ₹145 (Strip of 4 Softgel Capsules / Sachet)',
    packSize: 'Strip of 4 Softgel Capsules',
    uses: ['Treatment of confirmed Vitamin D3 insufficiency or deficiency', 'Adjuvant therapy in osteoporosis and osteomalacia', 'Hypocalcemia management'],
    sideEffects: ['Hypercalcemia (nausea, excessive thirst, constipation) if taken daily instead of weekly', 'Hypercalciuria or renal toxicity upon chronic overdose'],
    standardDosage: 'Adults: High-strength 60,000 IU is a WEEKLY or MONTHLY correction dose (typically 1 capsule once a week for 6–8 weeks with milk/meals), NEVER a daily dose, based on serum 25(OH)D lab levels. Pediatric: Strictly under pediatrician supervision.',
    curableDiseases: ['Vitamin D Deficiency', 'Nutritional Osteomalacia / Rickets'],
    doctorAdvice: 'CRITICAL SAFETY NOTE: 60,000 IU must NEVER be taken daily. Confirm deficiency with a 25-hydroxyvitamin D blood test and follow your doctor’s exact weekly schedule.',
    referenceSource: 'Indian Pharmacopoeia (IP) / Endocrine Society Clinical Practice Guidelines'
  },
  {
    id: 'med-amoxicillin-500',
    name: 'Amoxicillin 500mg (Mox 500 / Novamox 500)',
    genericName: 'Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Capsule',
    targetSpecies: 'Human',
    category: 'Beta-Lactam Penicillin Antibiotic',
    prescriptionStatus: 'Prescription Only (Schedule H)',
    shortSummary: 'Broad-spectrum penicillin antibiotic for confirmed bacterial infections.',
    description: 'Inhibits bacterial cell wall mucopeptide biosynthesis during active multiplication, resulting in bactericidal lysis of susceptible Gram-positive and Gram-negative bacteria.',
    basePriceINR: 108.00,
    approxCostRangeINR: '₹95 – ₹120 (Strip of 10 Capsules)',
    packSize: 'Strip of 10 Capsules',
    uses: ['Bacterial upper and lower respiratory tract infections (otitis media, sinusitis, pharyngitis)', 'Uncomplicated bacterial urinary tract and skin infections', 'Helicobacter pylori eradication regimens'],
    sideEffects: ['Diarrhea, nausea, or mild abdominal cramping', 'Allergic skin rash or urticaria', 'Severe penicillin anaphylaxis in hypersensitive patients'],
    standardDosage: 'Prescription-Only Medicine (Schedule H): Adult and pediatric dosage depends strictly on infection site, severity, and patient renal function as prescribed by a registered medical practitioner. Do not self-medicate.',
    curableDiseases: ['Susceptible Bacterial Sinusitis, Otitis Media, and Streptococcal Pharyngitis'],
    doctorAdvice: 'Antibiotics have zero effect on viral colds or flu. Never start an antibiotic without a doctor’s prescription, confirm no penicillin allergy exists, and always complete the full prescribed course.',
    referenceSource: 'ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes / IP'
  },
  {
    id: 'med-metformin-500',
    name: 'Metformin SR 500mg (Glycomet-SR 500)',
    genericName: 'Metformin Hydrochloride Sustained-Release IP 500mg',
    systemOfMedicine: 'Allopathic',
    dosageForm: 'Sustained-Release Tablet',
    targetSpecies: 'Human',
    category: 'Biguanide Oral Antidiabetic',
    prescriptionStatus: 'Prescription Only (Schedule H)',
    shortSummary: 'First-line prescription insulin sensitizer for Type 2 Diabetes Mellitus management.',
    description: 'Decreases hepatic glucose production (gluconeogenesis), decreases intestinal absorption of glucose, and improves insulin sensitivity by increasing peripheral glucose uptake.',
    basePriceINR: 62.00,
    approxCostRangeINR: '₹50 – ₹70 (Strip of 20 Sustained-Release Tablets)',
    packSize: 'Strip of 20 SR Tablets',
    uses: ['Glycemic control in Type 2 Diabetes Mellitus alongside diet and exercise', 'Insulin resistance management in PCOS under specialist care'],
    sideEffects: ['Transient metallic taste, mild nausea, or diarrhea (minimized by taking with meals)', 'Vitamin B12 deficiency with long-term therapy', 'Rare lactic acidosis in severe renal or hepatic impairment'],
    standardDosage: 'Prescription-Only Medicine (Schedule H): Individualized titration by a physician based on HbA1c, fasting blood glucose, and eGFR renal function tests. Taken with meals; swallow SR tablets whole.',
    curableDiseases: ['Long-term Glycemic Management of Type 2 Diabetes Mellitus'],
    doctorAdvice: 'Never self-initiate or alter diabetes medication doses without consulting your diabetologist. Monitor kidney function (eGFR) and Vitamin B12 levels annually.',
    referenceSource: 'ICMR Guidelines for Management of Type 2 Diabetes / IP'
  }
];

// ============================================================================
// IN-MEMORY CACHES & STRICT ENGLISH/HINGLISH MODEL FILTERING
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

// ============================================================================
// JSON PARSER WITH TRUNCATION AUTO-REPAIR
// ============================================================================
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
        // Continue to truncation auto-repair
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
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return JSON.parse(repaired);
}

// ============================================================================
// RESILIENT AI COMPLETION CLIENT (WITH JSON VALIDATION & MODEL FAILOVER)
// ============================================================================
async function callGroqAI({ messages, maxTokens = 900, temperature = 0.2, expectJson = false }) {
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
              console.warn(`[Language Guard]: Model "${model}" output non-English script. Failing over.`);
              blacklistedModels.add(model);
              lastError = new Error(`Model ${model} returned unsupported script.`);
              break;
            }

            const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            if (expectJson) {
              try {
                const parsedJson = extractAndRepairJson(cleanContent);
                return { content: cleanContent, json: parsedJson, model };
              } catch (parseErr) {
                console.warn(`[AI JSON Parse Failover]: Model "${model}" returned unparseable output (${parseErr.message}). Trying next model.`);
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

        if (response.status === 400 && /max_tokens|context_window/i.test(errMsg) && currentMaxTokens > 500) {
          currentMaxTokens = 500;
          continue;
        }

        if (
          response.status === 400 ||
          response.status === 403 ||
          response.status === 404 ||
          /terms acceptance|decommissioned|does not exist|classification|not supported/i.test(errMsg)
        ) {
          console.warn(`[AI Model Failover]: Blacklisting incompatible model "${model}" (${errMsg})`);
          blacklistedModels.add(model);
          lastError = new Error(errMsg);
          break;
        }

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(errMsg);
          const delayMs = 700 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }

        lastError = new Error(errMsg);
        break;
      } catch (networkErr) {
        if (networkErr.code === 'INVALID_API_KEY') throw networkErr;
        lastError = networkErr;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  }

  throw lastError || new Error('AI service temporarily unavailable.');
}

function findInVerifiedCatalog(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return VERIFIED_CLINICAL_CATALOG.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.genericName.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.systemOfMedicine.toLowerCase().includes(q) ||
    item.shortSummary.toLowerCase().includes(q) ||
    item.uses.some(u => u.toLowerCase().includes(q))
  );
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

app.get('/api/health/ai', async (req, res) => {
  try {
    const { content, model } = await callGroqAI({
      messages: [{ role: 'user', content: 'Reply with OK' }],
      maxTokens: 20,
      temperature: 0
    });
    res.json({ ok: true, model, reply: content });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
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
// DYNAMIC MEDICINE RECOMMENDATIONS ENDPOINT
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
// INTELLIGENT MULTI-INTENT, SPELLING-TOLERANT & MULTI-MATCH SEARCH ENGINE
// ============================================================================
function normalizeSearchItem(raw, fallbackTitle, modelName) {
  const numericPrice = Number(raw.basePriceINR);
  const hasRetailPrice = Number.isFinite(numericPrice) && numericPrice > 0;

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: raw.name || fallbackTitle,
    genericName: raw.genericName || 'Refer to clinical reference',
    systemOfMedicine: raw.systemOfMedicine || 'Allopathic',
    dosageForm: raw.dosageForm || 'Standard Formulation',
    targetSpecies: raw.targetSpecies || 'Human',
    category: raw.category || 'Healthcare Reference',
    prescriptionStatus: raw.prescriptionStatus || 'Consult Physician / Pharmacist',
    description: raw.description || 'Clinical information retrieved via live AI healthcare intelligence.',
    hasRetailPrice,
    basePriceINR: hasRetailPrice ? numericPrice : 0,
    approxCostRangeINR: raw.approxCostRangeINR || (hasRetailPrice ? `Approx. ₹${numericPrice.toFixed(0)}` : 'N/A (Varies by provider/clinic)'),
    packSize: raw.packSize || 'Standard Unit',
    uses: Array.isArray(raw.uses) && raw.uses.length > 0 ? raw.uses : ['Consult a qualified healthcare professional for approved uses'],
    sideEffects: Array.isArray(raw.sideEffects) && raw.sideEffects.length > 0 ? raw.sideEffects : ['Consult official package insert or clinician for adverse effects/precautions'],
    standardDosage: raw.standardDosage || 'Dosage or protocol must be determined by a qualified medical practitioner based on age, species, and clinical condition.',
    curableDiseases: Array.isArray(raw.curableDiseases) && raw.curableDiseases.length > 0 ? raw.curableDiseases : ['Approved clinical indications only'],
    doctorAdvice: raw.doctorAdvice || 'Do not self-medicate. Consult a qualified doctor, pharmacist, or veterinarian before use.',
    referenceSource: raw.referenceSource || `AI Clinical Intelligence (${modelName})`
  };
}

app.get('/api/medicines', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({
      error: 'Please enter a medicine name, symptom, health device, or question to search.',
      medicines: []
    });
  }

  if (query.length > 140) {
    return res.status(400).json({
      error: 'Search query is too long. Please keep it under 140 characters.',
      medicines: []
    });
  }

  const normalizedKey = query.toLowerCase();

  const cached = searchCache.get(normalizedKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
    return res.json({ ...cached.payload, source: 'cache' });
  }

  try {
    const prompt = `Analyze the user's search query: "${query}"

You are an intelligent Indian healthcare & general search engine. Understand spelling mistakes, phonetic typos, incomplete medicine names, singular/plural forms, natural language questions, and regional brands.

Classify the query into ONE of 4 intents:
1. "medical_item": Any Allopathic medicine, tablet, capsule, syrup, injection, drops, Ayurvedic/herbal formulation (e.g., Liv.52, Ashwagandha), Homeopathic remedy (e.g., Arnica 30C), Veterinary medicine, medical device (e.g., oximeter), or diagnostic test (e.g., HbA1c, CBC).
   - IMPORTANT: Never reject a potentially medical query due to misspellings or unfamiliar regional names.
   - If the query is incomplete or matches multiple distinct medicines/brands (e.g., "pan", "azithro", "calpol", "paracetmol" syrup vs tablet), return 2 to 3 clearly distinguished objects in "items" so the user can compare them!
2. "medical_condition": A disease, symptom, syndrome, or treatment topic (e.g., "migraine", "acidity", "dengue fever", "dry cough at night"). Return 1 structured clinical overview object in "items" (set basePriceINR to 0 and packSize to "Clinical Condition Overview").
3. "general_knowledge": A clearly non-medical query (e.g., "capital of Japan", "what is photosynthesis", "Python list comprehension"). Set "items" to [] and provide a helpful, accurate answer in "generalAnswer".
4. "ambiguous": An ultra-short or genuinely ambiguous term with completely different medical vs non-medical meanings (e.g., "iron", "mercury", "culture", "cold"). Provide 2 to 4 clickable clarification queries in "clarificationOptions".

Output ONLY valid raw JSON (no markdown) matching this exact schema:
{
  "intent": "medical_item | medical_condition | general_knowledge | ambiguous",
  "correctedQuery": "Normalized or spelling-corrected search term",
  "spellingNote": "Empty string if exact match, OR brief note e.g. 'Showing matches for Azithromycin (auto-corrected from azithro)'",
  "generalAnswer": {
    "title": "Topic title (only if intent is general_knowledge)",
    "summary": "Clear, accurate 2-4 sentence answer",
    "keyPoints": ["Point 1", "Point 2"]
  },
  "clarificationOptions": ["Option 1 (e.g. Iron supplement tablets)", "Option 2 (e.g. Serum Iron blood test)"],
  "items": [
    {
      "name": "Full Product / Topic Name",
      "genericName": "Active Composition / Formulation / Test Type",
      "systemOfMedicine": "Allopathic | Ayurvedic | Homeopathic | Veterinary | Diagnostic / Device | Clinical Condition",
      "dosageForm": "Tablet | Capsule | Syrup | Injection | Drops | Powder | Device | Test | Condition",
      "targetSpecies": "Human | Veterinary",
      "category": "Pharmacological or Healthcare Class",
      "prescriptionStatus": "OTC | Supplement | Ayurvedic / Homeopathic | Prescription Only (Schedule H) | Veterinary Rx | Informational",
      "description": "Clear 1-2 sentence mechanism or clinical overview",
      "basePriceINR": 95,
      "approxCostRangeINR": "₹80 – ₹110 (or 'Varies by lab/clinic' for tests/conditions)",
      "packSize": "Strip of 10 Tablets / Bottle / Test",
      "uses": ["Primary use 1", "Primary use 2", "Primary use 3"],
      "sideEffects": ["Side effect or precaution 1", "Side effect or precaution 2"],
      "standardDosage": "General authoritative reference distinguishing Adult vs Pediatric vs Veterinary vs Prescription-Only rules (never prescribe self-medication)",
      "curableDiseases": ["Approved indication 1", "Approved indication 2"],
      "doctorAdvice": "Key precautions and advice to consult a qualified doctor, pharmacist, or veterinarian"
    }
  ]
}`;

    const { json: parsed, model } = await callGroqAI({
      messages: [
        {
          role: 'system',
          content: 'You are an intelligent, spelling-tolerant Indian medical and general search API grounded in Indian Pharmacopoeia (IP), AYUSH, CDSCO, and WHO reference standards. Never invent retail drug prices; if not a packaged drug, set basePriceINR to 0. Output valid JSON only.'
        },
        { role: 'user', content: prompt }
      ],
      maxTokens: 950,
      temperature: 0.15,
      expectJson: true
    });

    const intent = ['medical_item', 'medical_condition', 'general_knowledge', 'ambiguous'].includes(parsed.intent)
      ? parsed.intent
      : (Array.isArray(parsed.items) && parsed.items.length > 0 ? 'medical_item' : 'general_knowledge');

    const rawItems = Array.isArray(parsed.items) ? parsed.items.slice(0, 4) : [];
    const medicines = rawItems.map(item => normalizeSearchItem(item, parsed.correctedQuery || query, model));

    const payload = {
      intent,
      correctedQuery: parsed.correctedQuery || query,
      spellingNote: typeof parsed.spellingNote === 'string' ? parsed.spellingNote.trim() : '',
      generalAnswer: parsed.generalAnswer || null,
      clarificationOptions: Array.isArray(parsed.clarificationOptions) ? parsed.clarificationOptions.slice(0, 4) : [],
      medicines
    };

    searchCache.set(normalizedKey, { timestamp: Date.now(), payload });
    return res.json({ ...payload, source: 'ai' });
  } catch (err) {
    console.error('[Search Engine AI Error]:', err.message);

    const fallbackMatches = findInVerifiedCatalog(query);
    if (fallbackMatches.length > 0) {
      return res.json({
        intent: 'medical_item',
        correctedQuery: query,
        spellingNote: '',
        medicines: fallbackMatches.map(m => ({ ...m, hasRetailPrice: true })),
        source: 'verified-catalog-fallback',
        notice: 'Showing verified Indian Pharmacopoeia reference data while live AI search is busy.'
      });
    }

    const diagnosticHint = err.code === 'MISSING_API_KEY'
      ? 'Server configuration notice: GROK_API_KEY is missing in environment variables.'
      : err.code === 'INVALID_API_KEY'
        ? 'Server configuration notice: GROK_API_KEY was rejected (401 Unauthorized).'
        : 'The AI clinical search service is temporarily busy or unreachable. Please try again in a few seconds.';

    return res.status(503).json({
      error: diagnosticHint,
      medicines: []
    });
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
3. For medicine or health queries, use clear headings, bullet points, and bold labels for Common Uses, Approximate INR Cost, Possible Side Effects, and General Reference Dosage (clearly separating Adult, Pediatric, Veterinary, and Prescription-Only rules).
4. Never diagnose conditions, never provide personalized dosage prescriptions, and never encourage unsupervised use of prescription medicines. Always remind the user to consult a qualified doctor, pharmacist, or veterinarian.
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
      maxTokens: 500,
      temperature: 0.2
    });

    return res.json({ reply: content });
  } catch (error) {
    console.error('[Chatbot AI Error]:', error.message);

    const catalogMatch = findInVerifiedCatalog(cleanMessage)[0];
    if (catalogMatch) {
      const fallbackReply = `**${catalogMatch.name}** (${catalogMatch.genericName})\n\n` +
        `**Classification:** ${catalogMatch.prescriptionStatus}\n` +
        `**Approx. Cost:** ${catalogMatch.approxCostRangeINR}\n` +
        `**Common Uses:** ${catalogMatch.uses.join(', ')}\n` +
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