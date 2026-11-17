import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please try again shortly.' }
});
app.use('/api/', apiLimiter);

// ============================================================================
// BULLETPROOF AUTO-MODEL FETCHER
// ============================================================================
let activeModel = null;

async function callGroqAI({ messages, jsonMode = false }) {
  const apiKey = process.env.GROK_API_KEY;
  
  if (!activeModel) {
    const modelResp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const modelData = await modelResp.json();
    const availableModels = modelData.data.map(m => m.id);
    
    // 1. Try known stable conversational models first
    const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'];
    activeModel = preferred.find(m => availableModels.includes(m));
    
    // 2. If restricted, grab any model that is NOT a guard, tool, or audio model
    if (!activeModel) {
      activeModel = availableModels.find(m => 
        !m.includes('guard') && 
        !m.includes('tool') && 
        !m.includes('vision') &&
        !m.includes('whisper')
      ) || availableModels[0];
    }
    console.log("✅ Auto-selected valid Groq Conversational Model:", activeModel);
  }

  const body = {
    model: activeModel,
    messages,
    temperature: 0.2,
    max_tokens: 512
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  
  // If the model fails after selection, clear it so it tries another one next time
  if (!response.ok) {
    activeModel = null;
    throw new Error(data.error?.message || 'AI API error');
  }
  
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// ENDPOINTS
// ============================================================================
app.get('/api/auth-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

app.post('/api/location', async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'Valid GPS required.' });

  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    let localityName = `Lat: ${lat.toFixed(2)}, Lng: ${lng.toFixed(2)}`;
    let pinCode = '';
    let pharmacies = [];

    const geoResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsApiKey}`);
    const geoData = await geoResp.json();
    
    if (geoData.status === 'OK' && geoData.results.length > 0) {
      localityName = geoData.results[0].formatted_address;
      const postalObj = geoData.results[0].address_components.find(c => c.types.includes('postal_code'));
      if (postalObj) pinCode = postalObj.long_name;
    }

    const placesResp = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=pharmacy&key=${mapsApiKey}`);
    const placesData = await placesResp.json();

    if (placesData.status === 'OK' && placesData.results.length > 0) {
      pharmacies = placesData.results.slice(0, 3).map((place, idx) => ({
        name: place.name,
        distanceKm: Number((0.5 + idx * 0.4).toFixed(1)),
        discountFactor: idx === 0 ? 0.85 : 0.92,
        badge: place.opening_hours?.open_now ? 'Open Now' : 'Verified Pharmacy'
      }));
    } else {
      pharmacies = [{ name: 'No local pharmacies found nearby', distanceKm: 0, discountFactor: 1, badge: 'N/A' }];
    }

    res.json({ locality: localityName, pinCode, coordinates: { lat, lng }, nearbyPharmacies: pharmacies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve real GPS location.' });
  }
});

app.get('/api/medicines', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json({ medicines: [] });

  try {
    const prompt = `Provide complete clinical details for the medicine or supplement: "${query}".
Output ONLY a valid JSON object matching this exact schema (no markdown, no backticks):
{
  "name": "Brand & Generic Name",
  "genericName": "Salt Composition",
  "category": "Pharmacological Class",
  "shortSummary": "One sentence summary",
  "description": "Clinical mechanism",
  "basePriceINR": 150.00,
  "packSize": "Strip of 10 Tablets",
  "uses": ["Use 1", "Use 2"],
  "sideEffects": ["Side effect 1", "Side effect 2"],
  "standardDosage": "Standard adult dosage instructions",
  "curableDiseases": ["Condition 1", "Condition 2"],
  "doctorAdvice": "Important clinical precautions"
}`;

    const aiJsonText = await callGroqAI({
      messages: [
        { role: 'system', content: 'You are a JSON API. Output strictly parseable JSON.' },
        { role: 'user', content: prompt }
      ],
      jsonMode: true
    });

    const parsed = JSON.parse(aiJsonText);
    parsed.basePriceINR = Number(parsed.basePriceINR) || 120.00;
    return res.json({ medicines: [parsed] });
  } catch (err) {
    console.error('Search Engine AI Error:', err.message);
    return res.json({ medicines: [] });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'A valid user message is required.' });

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful, conversational AI. Answer normal everyday questions politely. If asked a medical question, answer using structured headings and bullet points. Give direct, clean answers.' },
      ...history.map(turn => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: String(turn.text) })),
      { role: 'user', content: message }
    ];

    const replyText = await callGroqAI({ messages, jsonMode: false });
    return res.json({ reply: replyText });
  } catch (error) {
    return res.status(502).json({ error: `AI Error: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`MediDirectory Server running on http://localhost:${PORT}`);
});