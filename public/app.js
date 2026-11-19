import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

let currentLocalityData = {
  locality: 'India (Standard MRP)',
  nearbyPharmacies: [
    { name: 'Pradhan Mantri Bhartiya Janaushadhi Kendra', distanceKm: 0.8, discountFactor: 0.50 },
    { name: 'MedPlus Pharmacy', distanceKm: 1.2, discountFactor: 0.85 },
    { name: 'Apollo Pharmacy', distanceKm: 1.6, discountFactor: 0.90 }
  ]
};
let lastSearchPayload = null;
let lastSearchQuery = '';
let searchConversationHistory = [];
let chatHistory = [];
let firebaseAuth = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const authStatusMsg = document.getElementById('auth-status-msg');
const googleLoginBtn = document.getElementById('google-login-btn');
const localityLabel = document.getElementById('locality-label');
const userChip = document.getElementById('user-chip');
const userIdentifier = document.getElementById('user-Identifier');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('medicine-search-input');
const searchBtn = document.getElementById('search-btn');
const basicStrip = document.getElementById('basic-descriptions-strip');
const refreshRecBtn = document.getElementById('refresh-rec-btn');
const recDisclaimerBanner = document.getElementById('rec-disclaimer-banner');
const resultsContainer = document.getElementById('medicine-results-container');

// Chat UI Elements
const chatFab = document.getElementById('chat-fab');
const chatWindow = document.getElementById('chat-window');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setAuthMessage(text, isError = false) {
  authStatusMsg.textContent = text;
  authStatusMsg.classList.toggle('error-text', isError);
}

// ============================================================================
// FIREBASE AUTHENTICATION (GOOGLE SIGN-IN ONLY + SESSION PERSISTENCE)
// ============================================================================
function mapFirebaseError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return 'Google Sign-In popup was closed before completing login. Click "Continue with Google" to try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked by your browser. Please allow popups for this site and click "Continue with Google" again.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Sign-in request was cancelled. Please try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error while contacting Google Sign-In. Check your internet connection and retry.';
  }
  return error?.message || 'Google authentication failed. Please try again.';
}

async function initFirebase() {
  try {
    const resp = await fetch('/api/auth-config');
    const config = await resp.json();
    if (config.apiKey && config.apiKey !== 'DEMO' && !config.apiKey.includes('paste_your')) {
      const app = initializeApp(config);
      firebaseAuth = getAuth(app);

      await setPersistence(firebaseAuth, browserLocalPersistence);

      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          completeUserOnboarding(user.displayName || user.email);
        } else {
          authModal.classList.remove('hidden');
          userChip.classList.add('hidden');
        }
      });
    } else {
      setAuthMessage('Firebase credentials are not configured on the server.', true);
    }
  } catch (err) {
    setAuthMessage(`Auth service initialization error: ${err.message}`, true);
  }
}

googleLoginBtn.addEventListener('click', async () => {
  if (!firebaseAuth) {
    setAuthMessage('Firebase authentication is still initializing.', true);
    return;
  }
  try {
    googleLoginBtn.disabled = true;
    setAuthMessage('Opening Google Sign-In...');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(firebaseAuth, provider);
    completeUserOnboarding(result.user.displayName || result.user.email);
  } catch (error) {
    setAuthMessage(mapFirebaseError(error), true);
  } finally {
    googleLoginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  if (firebaseAuth) await signOut(firebaseAuth);
  authModal.classList.remove('hidden');
  userChip.classList.add('hidden');
  setAuthMessage('');
});

function completeUserOnboarding(identifier) {
  authModal.classList.add('hidden');
  userIdentifier.textContent = identifier;
  userChip.classList.remove('hidden');
  setAuthMessage('');
  requestRealGeolocation();
}

// ============================================================================
// REAL GOOGLE MAPS GEOLOCATION
// ============================================================================
function requestRealGeolocation() {
  if (!('geolocation' in navigator)) {
    localityLabel.textContent = 'GPS Unsupported • Showing Standard MRP';
    return;
  }
  localityLabel.textContent = 'Connecting to GPS...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const resp = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude })
        });
        const data = await resp.json();
        if (resp.ok) {
          currentLocalityData = data;
          localityLabel.textContent = `${data.locality} • Real Pharmacies Verified`;
          if (lastSearchPayload) {
            renderSearchPayload(lastSearchPayload, lastSearchQuery);
          }
        }
      } catch (err) {
        localityLabel.textContent = `GPS Connected (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
      }
    },
    () => {
      localityLabel.textContent = 'Location Blocked in Browser Settings • Showing Standard MRP';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ============================================================================
// DYNAMIC MEDICINE RECOMMENDATIONS (ROTATING + CACHED + NON-BLOCKING)
// ============================================================================
const REC_STORAGE_KEY = 'medipulse_last_rec_ids';

async function loadRecommendations() {
  if (!basicStrip) return;
  refreshRecBtn.disabled = true;
  basicStrip.innerHTML = `<div class="basic-pill-card"><p class="rec-meta-line">Loading rotating clinical &amp; Ayurvedic reference cards...</p></div>`;

  try {
    const previousIds = sessionStorage.getItem(REC_STORAGE_KEY) || '';
    const resp = await fetch(`/api/recommendations?exclude=${encodeURIComponent(previousIds)}`);
    const data = await resp.json();
    const list = Array.isArray(data.recommendations) ? data.recommendations : [];

    if (data.disclaimer && recDisclaimerBanner) {
      recDisclaimerBanner.innerHTML = `<strong>Medical Safety Disclaimer:</strong> ${escapeHtml(data.disclaimer.replace(/^Medical Safety Disclaimer:\s*/i, ''))}`;
    }

    if (list.length === 0) {
      basicStrip.innerHTML = `<div class="basic-pill-card"><p class="rec-meta-line">No reference recommendations available at the moment.</p></div>`;
      return;
    }

    sessionStorage.setItem(REC_STORAGE_KEY, list.map(m => m.id).join(','));

    basicStrip.innerHTML = list.map((med) => {
      const isRx = /prescription|schedule h/i.test(med.prescriptionStatus || '');
      const badgeClass = isRx ? 'rx' : 'otc';
      const badgeLabel = isRx ? 'Rx Only' : (med.systemOfMedicine || 'OTC / Supplement');
      const usesText = Array.isArray(med.uses) ? med.uses.slice(0, 2).join('; ') : '';
      const sideEffectsText = Array.isArray(med.sideEffects) ? med.sideEffects.slice(0, 2).join('; ') : '';

      return `
        <div class="basic-pill-card" data-med-name="${escapeHtml(med.name.split('(')[0].trim())}">
          <div class="rec-card-header">
            <h4>${escapeHtml(med.name)}</h4>
            <span class="rx-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
          </div>
          <div class="rec-cost">Approx. Cost: ${escapeHtml(med.approxCostRangeINR || `₹${Number(med.basePriceINR).toFixed(2)}`)}</div>
          <p class="rec-meta-line"><strong>Common Uses:</strong> ${escapeHtml(usesText)}</p>
          <p class="rec-meta-line"><strong>Possible Side Effects:</strong> ${escapeHtml(sideEffectsText)}</p>
          <div class="rec-dosage-box">
            <strong>General Dosage Ref:</strong> ${escapeHtml(med.standardDosage)}
          </div>
        </div>
      `;
    }).join('');

    basicStrip.querySelectorAll('.basic-pill-card').forEach((card) => {
      card.addEventListener('click', () => {
        const medName = card.getAttribute('data-med-name');
        if (medName) {
          searchInput.value = medName;
          searchAI(medName, false);
        }
      });
    });
  } catch (err) {
    basicStrip.innerHTML = `
      <div class="basic-pill-card">
        <p class="rec-meta-line">Unable to load medicine recommendations right now. Click "Rotate List" to retry.</p>
      </div>`;
  } finally {
    refreshRecBtn.disabled = false;
  }
}

if (refreshRecBtn) {
  refreshRecBtn.addEventListener('click', () => loadRecommendations());
}

// ============================================================================
// UNIVERSAL CONVERSATIONAL MEDICAL AI SEARCH ENGINE
// ============================================================================
function clearSearchResults() {
  lastSearchPayload = null;
  lastSearchQuery = '';
  searchConversationHistory = [];
  resultsContainer.innerHTML = '';
  searchInput.value = '';
  searchInput.focus();
}

async function searchAI(query, isFollowUp = false) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    resultsContainer.innerHTML = `
      <div class="med-detail-card">
        <h3>Ask any medical or healthcare question</h3>
        <p>Search Allopathic or Ayurvedic medicines (e.g., Dolo 650, Arsh Kalp, Ashwagandha), medical devices (BP machine), symptoms (weakness, sugar problem), sexual health, or pet healthcare.</p>
      </div>`;
    return;
  }

  if (!isFollowUp) {
    searchConversationHistory = [];
  }

  const historySnapshot = [...searchConversationHistory];

  searchBtn.disabled = true;
  resultsContainer.innerHTML = `<div class="med-detail-card"><h3>Understanding "${escapeHtml(cleanQuery)}" via Universal Medical AI...</h3></div>`;

  try {
    const resp = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: cleanQuery,
        history: historySnapshot
      })
    });
    const data = await resp.json();

    if (!resp.ok) {
      resultsContainer.innerHTML = `
        <div class="med-detail-card">
          <div class="rec-card-header">
            <h3>Search Notice</h3>
            <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
          </div>
          <p>${escapeHtml(data.error || 'Unable to process this search right now.')}</p>
        </div>`;
      document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
      return;
    }

    lastSearchPayload = data;
    lastSearchQuery = cleanQuery;

    const resolvedTopic =
      data.medicines?.[0]?.name ||
      data.device?.title ||
      data.guidance?.title ||
      data.interpretedQuery ||
      cleanQuery;

    const resolvedSummary =
      data.medicines?.[0]?.description ||
      data.device?.purpose ||
      data.guidance?.overview ||
      data.interpretedQuery ||
      cleanQuery;

    searchConversationHistory.push({ role: 'user', text: cleanQuery });
    searchConversationHistory.push({
      role: 'assistant',
      intentType: data.intentType || 'clinical_guidance',
      topic: resolvedTopic,
      text: resolvedSummary
    });

    renderSearchPayload(data, cleanQuery);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    resultsContainer.innerHTML = `
      <div class="med-detail-card">
        <div class="rec-card-header">
          <h3>Network Connection Error</h3>
          <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
        </div>
        <p>Could not reach the medical AI search server. Please check your internet connection and try again.</p>
      </div>`;
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
  } finally {
    searchBtn.disabled = false;
  }
}

function buildFollowUpSectionHtml(followUpQuestions = []) {
  const chipsHtml = (followUpQuestions || [])
    .map(q => `<button type="button" class="chip-btn followup-chip" data-followup="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
    .join('');

  return `
    <div class="followup-panel">
      <span class="followup-label">Continue Conversational Medical Search</span>
      ${chipsHtml ? `<div class="clarification-chips">${chipsHtml}</div>` : ''}
      <form id="inline-followup-form" class="followup-form">
        <input type="text" id="inline-followup-input" placeholder="Ask a follow-up question (e.g., side effects, Ayurvedic vs Allopathic, child dosage)..." autocomplete="off" required />
        <button type="submit" id="inline-followup-btn" class="btn btn-primary">Ask Follow-Up</button>
      </form>
    </div>
  `;
}

function attachSearchInteractiveHandlers() {
  document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);

  resultsContainer.querySelectorAll('.followup-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextQ = btn.getAttribute('data-followup');
      if (nextQ) {
        searchInput.value = nextQ;
        searchAI(nextQ, true);
      }
    });
  });

  const inlineForm = document.getElementById('inline-followup-form');
  const inlineInput = document.getElementById('inline-followup-input');
  const inlineBtn = document.getElementById('inline-followup-btn');
  if (inlineForm && inlineInput) {
    inlineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const followText = inlineInput.value.trim();
      if (followText) {
        if (inlineBtn) inlineBtn.disabled = true;
        searchInput.value = followText;
        searchAI(followText, true);
      }
    });
  }
}

function renderSearchPayload(data, searchedQuery) {
  const intentType = data.intentType || 'clinical_guidance';
  const langBadge = data.detectedLanguage
    ? `<span class="lang-pill">${escapeHtml(data.detectedLanguage)}</span>`
    : '';
  const interpretedLabel = data.interpretedQuery && data.interpretedQuery.toLowerCase() !== searchedQuery.toLowerCase()
    ? `Interpreted "${escapeHtml(searchedQuery)}" → ${escapeHtml(data.interpretedQuery)}`
    : `Result for "${escapeHtml(data.interpretedQuery || searchedQuery)}"`;

  const toolbarHtml = `
    <div class="results-toolbar">
      <span>${interpretedLabel}${langBadge}</span>
      <button type="button" id="clear-results-btn" class="btn-link">Clear Result ✕</button>
    </div>
  `;

  if (intentType === 'non_medical_redirect' && data.redirect) {
    const examples = (data.redirect.exampleQueries || [])
      .map(ex => `<button type="button" class="chip-btn followup-chip" data-followup="${escapeHtml(ex)}">${escapeHtml(ex)}</button>`)
      .join('');

    resultsContainer.innerHTML = `
      ${toolbarHtml}
      <article class="med-detail-card">
        <span class="med-category-tag">Healthcare Specialist Scope</span>
        <h3 class="med-title">${escapeHtml(data.redirect.title)}</h3>
        <p style="margin-top: 0.6rem; color: #334155;">${escapeHtml(data.redirect.message)}</p>
        ${examples ? `<div style="margin-top: 1rem;"><span class="followup-label">Try Asking a Medical Question:</span><div class="clarification-chips">${examples}</div></div>` : ''}
      </article>
    `;
    attachSearchInteractiveHandlers();
    return;
  }

  if (intentType === 'medical_equipment' && data.device) {
    const d = data.device;
    resultsContainer.innerHTML = `
      ${toolbarHtml}
      <article class="med-detail-card">
        <div class="med-card-top">
          <div>
            <span class="med-system-tag">Medical Equipment &amp; Device</span>
            <span class="med-category-tag">${escapeHtml(d.category || 'Diagnostic Equipment')}</span>
            <h3 class="med-title">${escapeHtml(d.title)}</h3>
            <p class="med-generic" style="margin-top: 0.35rem;">${escapeHtml(d.purpose)}</p>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel">
            <h4>Types &amp; Variants Available</h4>
            <ul>${(d.typesAvailable || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          </div>
          <div class="info-panel">
            <h4>Selection &amp; Accuracy Criteria</h4>
            <ul>${(d.selectionCriteria || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
          </div>
          <div class="info-panel">
            <h4>Proper Usage Guidelines</h4>
            <p>${escapeHtml(d.properUsage)}</p>
          </div>
        </div>
        <div class="doctor-advice-banner">
          <strong>Calibration, Safety &amp; Clinical Guidance:</strong> ${escapeHtml(d.safetyAndMaintenance)}
          <div style="font-size: 0.78rem; color: #475569; margin-top: 0.35rem;">Reference: ${escapeHtml(d.referenceSource || 'MediPulse Medical AI')} • Discuss abnormal home readings with a qualified doctor.</div>
        </div>
      </article>
      ${buildFollowUpSectionHtml(data.followUpQuestions)}
    `;
    attachSearchInteractiveHandlers();
    return;
  }

  if (intentType === 'clinical_guidance' && data.guidance) {
    const g = data.guidance;
    const isVet = /veterinary/i.test(g.domainTag || '');
    resultsContainer.innerHTML = `
      ${toolbarHtml}
      <article class="med-detail-card">
        <div class="med-card-top">
          <div>
            <span class="med-system-tag">${escapeHtml(g.domainTag || 'Clinical Health Guidance')}</span>
            <h3 class="med-title">${escapeHtml(g.title)}</h3>
            <p class="med-generic" style="margin-top: 0.4rem; color: #1e293b;">${escapeHtml(g.overview)}</p>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel">
            <h4>Possible Causes &amp; Key Factors</h4>
            <ul>${(g.possibleCausesOrFactors || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
          </div>
          <div class="info-panel">
            <h4>Evaluation, Care &amp; Prevention Options</h4>
            <ul>${(g.evaluationAndCare || []).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
          </div>
          <div class="info-panel side-effects-panel">
            <h4>Warning Signs (When to Seek Prompt Care)</h4>
            <ul>${(g.redFlags || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="doctor-advice-banner">
          <strong>${isVet ? 'Veterinary Safety Advice:' : 'Medical Safety Advice:'}</strong> ${escapeHtml(g.doctorAdvice)}
          <div style="font-size: 0.78rem; color: #475569; margin-top: 0.35rem;">Reference: ${escapeHtml(g.referenceSource || 'MediPulse Medical AI')} • Educational information does not replace ${isVet ? 'a licensed veterinarian' : 'a qualified physician'}.</div>
        </div>
      </article>
      ${buildFollowUpSectionHtml(data.followUpQuestions)}
    `;
    attachSearchInteractiveHandlers();
    return;
  }

  const medicines = Array.isArray(data.medicines) ? data.medicines : [];
  if (medicines.length === 0) {
    resultsContainer.innerHTML = `
      ${toolbarHtml}
      <div class="med-detail-card">
        <h3>No specific clinical record matched</h3>
        <p>Try adding a symptom, active ingredient, or system of medicine (Allopathic, Ayurvedic, Homeopathic, or Veterinary) below.</p>
      </div>
      ${buildFollowUpSectionHtml(data.followUpQuestions)}
    `;
    attachSearchInteractiveHandlers();
    return;
  }

  const noticeBanner = data.notice
    ? `<div class="rec-disclaimer">${escapeHtml(data.notice)}</div>`
    : '';

  const cardsHtml = medicines.map((med) => {
    const basePrice = Number(med.basePriceINR) || 95.00;
    const isVet = /veterinary/i.test(med.systemOfMedicine || '') || /veterinary/i.test(med.prescriptionStatus || '');
    const pharmacies = Array.isArray(currentLocalityData.nearbyPharmacies)
      ? currentLocalityData.nearbyPharmacies
      : [];

    const pharmacyRows = isVet
      ? `<div class="pharmacy-row"><span>Available at licensed Veterinary Pharmacies</span></div>`
      : pharmacies.map(pharm =>
          `<div class="pharmacy-row">
            <span>${escapeHtml(pharm.name)} (${escapeHtml(pharm.distanceKm)}km)</span>
            <span class="pharmacy-price">₹${(basePrice * (pharm.discountFactor || 0.9)).toFixed(2)}</span>
          </div>`
        ).join('');

    return `
      <article class="med-detail-card">
        <div class="med-card-top">
          <div>
            <span class="med-system-tag">${escapeHtml(med.systemOfMedicine || 'Allopathic')}</span>
            <span class="med-category-tag">${escapeHtml(med.dosageForm || 'Formulation')}</span>
            <span class="med-category-tag">${escapeHtml(med.category || 'Medicine')}</span>
            <span class="med-category-tag">${escapeHtml(med.prescriptionStatus || 'Clinical Reference')}</span>
            <h3 class="med-title">${escapeHtml(med.name)}</h3>
            <p class="med-generic"><strong>Composition / Ingredients:</strong> ${escapeHtml(med.genericName)} • ${escapeHtml(med.packSize || 'Standard Pack')}</p>
            ${med.evidenceSummary ? `<div class="evidence-box"><strong>Evidence &amp; Clinical Context:</strong> ${escapeHtml(med.evidenceSummary)}</div>` : ''}
          </div>
          <div class="price-box">
            <div class="mrp-line">Approx. MRP: <span class="mrp-amount">₹${basePrice.toFixed(2)}</span></div>
            <div class="pharmacy-price-list"><strong>${isVet ? 'Dispensing Info:' : 'Nearby Pharmacy Estimates:'}</strong>${pharmacyRows}</div>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel"><h4>Overview &amp; Mechanism</h4><p>${escapeHtml(med.description)}</p></div>
          <div class="info-panel"><h4>Common Medical / Traditional Uses</h4><ul>${(med.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul></div>
          <div class="info-panel"><h4>General Dosage Reference</h4><p>${escapeHtml(med.standardDosage)}</p></div>
          <div class="info-panel"><h4>Indications &amp; Supportive Role</h4><ul>${(med.curableDiseases || []).map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>
          <div class="info-panel side-effects-panel"><h4>Side Effects, Contraindications &amp; Interactions</h4><ul>${(med.sideEffects || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>
        </div>
        <div class="doctor-advice-banner">
          <strong>Medical Safety &amp; Doctor's Advice:</strong> ${escapeHtml(med.doctorAdvice)}
          <div style="font-size: 0.78rem; color: #475569; margin-top: 0.35rem;">Reference: ${escapeHtml(med.referenceSource || 'MediPulse Medical AI')} • Consult a qualified physician, Ayurvedic practitioner, or veterinarian before use.</div>
        </div>
      </article>
    `;
  }).join('');

  resultsContainer.innerHTML = toolbarHtml + noticeBanner + cardsHtml + buildFollowUpSectionHtml(data.followUpQuestions);
  attachSearchInteractiveHandlers();
}

searchBtn.addEventListener('click', () => searchAI(searchInput.value, false));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchAI(searchInput.value, false);
  }
});
searchInput.addEventListener('search', () => {
  if (!searchInput.value.trim()) {
    clearSearchResults();
  }
});

// ============================================================================
// CHATBOT WIDGET (CIRCLE FAB TO SQUARE WINDOW + STRUCTURED FORMATTING)
// ============================================================================
chatFab.addEventListener('click', () => {
  chatFab.classList.add('hidden');
  chatWindow.classList.remove('hidden');
  chatInput.focus();
});

closeChatBtn.addEventListener('click', () => {
  chatWindow.classList.add('hidden');
  chatFab.classList.remove('hidden');
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  appendChatMessage(text, 'user-bubble');
  chatInput.value = '';

  const loading = appendChatMessage('Thinking...', 'bot-bubble');
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory })
    });
    const data = await resp.json();
    const replyText = data.reply || data.error || 'Unable to generate a response right now.';
    loading.innerHTML = formatText(replyText);

    if (resp.ok && data.reply) {
      chatHistory.push({ role: 'user', text });
      chatHistory.push({ role: 'model', text: data.reply });
    }
  } catch (err) {
    loading.textContent = 'Network error connecting to MediBot. Please try again.';
  }
});

function formatText(text) {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function appendChatMessage(text, className) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${className}`;
  div.innerHTML = className === 'user-bubble' ? escapeHtml(text) : formatText(text);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// Initialize non-blocking recommendations immediately and start Firebase Auth
loadRecommendations();
initFirebase();