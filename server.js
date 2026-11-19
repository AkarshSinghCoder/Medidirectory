async function executeUniversalMedicalSearch(rawQuery, history = []) {
  const analysis = analyzeRawQuery(rawQuery);
  const { originalQuery, detectedLanguage, normalizedHint, categoryHint } = analysis;
  const hasHistory = Array.isArray(history) && history.length > 0;
  const normalizedKey = `${originalQuery.toLowerCase()}::0`;

  // Use cache only for standalone initial queries (no active conversation thread)
  if (!hasHistory) {
    const cached = searchCache.get(normalizedKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      return { ...cached.payload, source: 'cache' };
    }
  }

  // Extract previous topic context so short follow-ups ("side effects?", "child dose?") stay anchored
  const previousTopic = hasHistory
    ? [...history].reverse().find(t => t && t.role === 'assistant' && t.topic)?.topic || ''
    : '';

  const lookupTerm = normalizedHint || (previousTopic ? `${previousTopic} ${originalQuery}` : originalQuery);
  const localMatches = findInVerifiedCatalogFuzzy(lookupTerm);
  const groundingContext = localMatches.length > 0
    ? `\nVerified Local Reference Matches: ${localMatches.map(m => `${m.name} (${m.systemOfMedicine}, MRP ~₹${m.basePriceINR})`).join('; ')}`
    : '';

  const hintContext = normalizedHint
    ? `\nPhonetic/Regional Normalization Hint: The user's query likely refers to "${normalizedHint}" (Category hint: ${categoryHint}).`
    : '';

  const contextAnchor = previousTopic
    ? `\nActive Conversation Topic from Previous Turn: "${previousTopic}". If the user's current input is a follow-up question (such as side effects, dosage, precautions, price, or comparison), answer it specifically in relation to "${previousTopic}".`
    : '';

  // Keep assistant turns formatted as valid JSON so the LLM strictly maintains JSON output on follow-up turns
  const safeHistory = hasHistory
    ? history.slice(-6).map(turn => {
        if (turn.role === 'assistant') {
          const summaryObj = {
            intentType: turn.intentType || 'clinical_guidance',
            interpretedQuery: turn.topic || turn.text || '',
            summary: String(turn.text || '').slice(0, 400)
          };
          return { role: 'assistant', content: JSON.stringify(summaryObj) };
        }
        return { role: 'user', content: String(turn.text || '').slice(0, 400) };
      })
    : [];

  const systemPrompt = `You are MediPulse Universal Medical AI, an intelligent, clinical-grade healthcare search assistant for India.
Your job is to understand WHAT THE USER MEANS—even with spelling mistakes, phonetic spellings, incomplete words, regional/Sanskrit terms, Hinglish, or follow-up questions—and respond with high medical accuracy and safety.

CORE RULES:
1. LANGUAGE MIRRORING (ENGLISH OR HINGLISH ONLY):
   - Detected user language: ${detectedLanguage}.
   - If the user wrote in Hinglish (Hindi in Roman script, e.g., "sugar problem", "bukhar ki dawa", "bal jhadne ka ilaj"), write your explanations naturally in clear Hinglish (Roman script) while keeping JSON keys in English.
   - If the user wrote in English, write 100% in clear Indian English.
   - NEVER output Arabic, Chinese, or any non-Latin foreign script.
2. UNIVERSAL DOMAIN COVERAGE & FOLLOW-UPS:
   - Handle follow-up questions seamlessly using the Active Conversation Topic when provided.
   - Cover Allopathic medicines, Ayurvedic/classical formulations (e.g., Arsh Kalp, Ashwagandha, Chyawanprash), Homeopathic/Unani/Siddha preparations, medical equipment (BP monitors, glucometers, nebulizers), symptoms/diseases, sexual & reproductive health, and veterinary medicine.
   - Distinguish Traditional/Classical Uses from Scientific Clinical Evidence and warn that herbal/natural does not automatically mean risk-free.
   - For veterinary queries, warn that human medicines (like Paracetamol/Ibuprofen) are toxic to pets.
3. VAGUE, AMBIGUOUS & UNRELATED QUERIES:
   - For vague medical queries, provide a helpful initial medical overview AND include 2–3 clickable clarifying follow-up options in "followUpQuestions".
   - If the query is completely unrelated to health, medicine, biology, wellness, or veterinary care, classify as "non_medical_redirect".
4. STRICT FACTUALITY & SAFETY:
   - Never invent medicines, ingredients, prices, or clinical trials.
   - Never recommend prescription medicines (Schedule H/H1/X) or personalized dosages for self-medication. Clearly distinguish Adult, Pediatric, and Prescription-Only rules.

Output ONLY a single raw JSON object (no markdown fences, no commentary outside JSON) using ONE of these 4 response structures:

STRUCTURE A — Specific Medicine / Formulation:
{
  "intentType": "medicine",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Clear description of what the user searched",
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
      "evidenceSummary": "Explicit distinction between Scientific Clinical Evidence and Traditional/Classical Use",
      "basePriceINR": 95,
      "packSize": "Standard Pack Size",
      "uses": ["Primary use 1", "Primary use 2", "Primary use 3"],
      "sideEffects": ["Side effect / contraindication 1", "Interaction / precaution 2"],
      "standardDosage": "General reference distinguishing Adult vs Pediatric vs Prescription-Only (or Species for Veterinary)",
      "curableDiseases": ["Approved clinical indication or supportive role"],
      "doctorAdvice": "Key safety warnings, interactions, and when to consult a doctor or veterinarian"
    }
  ],
  "followUpQuestions": ["Relevant follow-up question 1", "Relevant follow-up question 2"]
}

STRUCTURE B — Medical Equipment & Diagnostic Devices:
{
  "intentType": "medical_equipment",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Identified Medical Device / Equipment",
  "device": {
    "title": "Device Name",
    "category": "Diagnostic Device | Respiratory Equipment | Home Monitoring | Clinical Implant",
    "purpose": "What the device measures or treats and why it is used",
    "typesAvailable": ["Type 1", "Type 2"],
    "selectionCriteria": ["Key accuracy/selection factor 1", "Factor 2"],
    "properUsage": "Step-by-step best practices for accurate readings or safe home use",
    "safetyAndMaintenance": "Calibration, hygiene, contraindications, and when readings require a doctor's review"
  },
  "followUpQuestions": ["Relevant follow-up question 1", "Relevant follow-up question 2"]
}

STRUCTURE C — Symptoms, Diseases, Follow-Up Explanations, Sexual Health, Veterinary Care, or Comparisons:
{
  "intentType": "clinical_guidance",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "How the AI interpreted the user's question",
  "guidance": {
    "title": "Clear Clinical Topic Title",
    "domainTag": "Follow-Up Clinical Answer | Symptom & Evaluation | Chronic Condition | Sexual & Reproductive Health | Veterinary Care | Treatment Comparison",
    "overview": "Clear, scientifically accurate 2–3 sentence direct answer to the user's question",
    "possibleCausesOrFactors": ["Key point / cause / factor 1", "Point 2", "Point 3"],
    "evaluationAndCare": ["Recommended diagnostic test, precaution, or care step 1", "Step 2", "Step 3"],
    "redFlags": ["Serious warning symptom requiring prompt medical/veterinary evaluation 1", "Warning sign 2"],
    "doctorAdvice": "Clear guidance on professional consultation and why self-medication should be avoided"
  },
  "followUpQuestions": ["Next-step follow-up question 1", "Question 2"]
}

STRUCTURE D — Completely Non-Medical Query:
{
  "intentType": "non_medical_redirect",
  "detectedLanguage": "${detectedLanguage}",
  "interpretedQuery": "Non-medical topic detected",
  "redirect": {
    "title": "Healthcare & Medical Search Assistant",
    "message": "Polite 2-sentence explanation that MediPulse specializes in healthcare and medical queries.",
    "exampleQueries": ["Dolo 650 uses and precautions", "What is Arsh Kalp?", "How to choose a BP machine", "Causes of persistent tiredness"]
  }
}`;

  const userPrompt = `User Query: "${originalQuery}"${contextAnchor}${hintContext}${groundingContext}
Return ONLY valid raw JSON answering this query.`;

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

      if (!hasHistory) {
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

      if (!hasHistory) {
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

    if (!hasHistory) {
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