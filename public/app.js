import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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
let chatHistory = [];

// Firebase & Singleton reCAPTCHA State
let firebaseAuth = null;
let recaptchaWidgetId = null;
let confirmationResult = null;
let lastFormattedPhone = '';
let isSendingOtp = false;
let isVerifyingOtp = false;
let resendCooldownTimer = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const authStatusMsg = document.getElementById('auth-status-msg');
const googleLoginBtn = document.getElementById('google-login-btn');
const phoneAuthForm = document.getElementById('phone-auth-form');
const phoneInput = document.getElementById('phone-input');
const sendOtpBtn = document.getElementById('send-otp-btn');
const otpVerifyForm = document.getElementById('otp-verify-form');
const otpInput = document.getElementById('otp-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const resendOtpBtn = document.getElementById('resend-otp-btn');
const changePhoneBtn = document.getElementById('change-phone-btn');
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
// FIREBASE AUTHENTICATION (SINGLETON RECAPTCHA + E.164 + SESSION PERSISTENCE)
// ============================================================================
async function ensureRecaptchaReady() {
  if (!firebaseAuth) return null;

  // Initialize RecaptchaVerifier strictly ONCE
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
      size: 'invisible',
      'expired-callback': () => {
        resetRecaptchaWidget();
        setAuthMessage('Security verification expired. Please click Send OTP again.', true);
      }
    });
    recaptchaWidgetId = await window.recaptchaVerifier.render();
  }
  return window.recaptchaVerifier;
}

function resetRecaptchaWidget() {
  try {
    if (typeof window.grecaptcha !== 'undefined' && recaptchaWidgetId !== null) {
      window.grecaptcha.reset(recaptchaWidgetId);
    }
  } catch (err) {
    console.warn('reCAPTCHA widget reset notice:', err.message);
  }
}

function disposeRecaptcha() {
  try {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
      recaptchaWidgetId = null;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = '';
  } catch (_) {
    window.recaptchaVerifier = null;
    recaptchaWidgetId = null;
  }
}

function validateAndFormatE164(rawInput) {
  const cleaned = rawInput.replace(/[\s\-()]/g, '');

  // Strict 10-digit check for Indian (+91) numbers
  if (cleaned.startsWith('+91')) {
    const localDigits = cleaned.slice(3).replace(/\D/g, '');
    if (localDigits.length !== 10 || !/^[6-9]\d{9}$/.test(localDigits)) {
      return {
        valid: false,
        error: `Indian (+91) mobile numbers must be 10 digits starting with 6–9 (entered ${localDigits.length} digits).`
      };
    }
    return { valid: true, formatted: `+91${localDigits}` };
  }

  // General international E.164 numbers (+[country code][subscriber number], 8 to 15 digits total)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return { valid: true, formatted: cleaned };
  }

  // 10-digit local Indian number typed without +91 prefix
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return { valid: true, formatted: `+91${digitsOnly}` };
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]\d{9}$/.test(digitsOnly.slice(2))) {
    return { valid: true, formatted: `+${digitsOnly}` };
  }

  return {
    valid: false,
    error: 'Enter a valid phone number in international E.164 format (e.g., +91 98765 43210 or +1 415 555 2671).'
  };
}

function mapFirebaseError(error) {
  const code = error?.code || '';
  if (code === 'auth/billing-not-enabled') {
    return 'Firebase Console Billing Requirement: Real carrier SMS requires upgrading your Firebase project to the Blaze (Pay-as-you-go) billing plan (first 10 SMS/day are free), or registering a test number under Authentication → Sign-in method → Phone → Phone numbers for testing.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Console Setting Required: Enable Phone Sign-In under Authentication → Sign-in method and allow your country code (e.g., +91 India) under Authentication → Settings → SMS region policy.';
  }
  if (code === 'auth/invalid-phone-number') {
    return 'Invalid phone number format. Include your country code (e.g., +91 98765 43210).';
  }
  if (code === 'auth/invalid-verification-code') {
    return 'Incorrect 6-digit OTP code. Please check the SMS and try again.';
  }
  if (code === 'auth/code-expired') {
    return 'This OTP code has expired. Click "Resend OTP" to request a fresh code.';
  }
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
    return 'Too many OTP requests for this number or project. Please wait a few minutes before retrying.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error while contacting Firebase. Check your internet connection and retry.';
  }
  return error?.message || 'Authentication failed. Please try again.';
}

async function initFirebase() {
  try {
    const resp = await fetch('/api/auth-config');
    const config = await resp.json();
    if (config.apiKey && config.apiKey !== 'DEMO' && !config.apiKey.includes('paste_your')) {
      const app = initializeApp(config);
      firebaseAuth = getAuth(app);

      // Persist authenticated sessions across page refreshes
      await setPersistence(firebaseAuth, browserLocalPersistence);

      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          completeUserOnboarding(user.displayName || user.phoneNumber || user.email);
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
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    completeUserOnboarding(result.user.displayName || result.user.email);
  } catch (error) {
    setAuthMessage(mapFirebaseError(error), true);
  } finally {
    googleLoginBtn.disabled = false;
  }
});

async function triggerPhoneOtp(e164Phone) {
  if (!firebaseAuth || isSendingOtp) return;

  try {
    isSendingOtp = true;
    sendOtpBtn.disabled = true;
    resendOtpBtn.disabled = true;
    setAuthMessage(`Verifying security check & sending SMS OTP to ${e164Phone}...`);

    const verifier = await ensureRecaptchaReady();
    confirmationResult = await signInWithPhoneNumber(firebaseAuth, e164Phone, verifier);

    lastFormattedPhone = e164Phone;
    otpVerifyForm.classList.remove('hidden');
    otpInput.value = '';
    otpInput.focus();
    startResendCooldown(30);
    setAuthMessage(`Real SMS OTP sent to ${e164Phone}. Enter the 6-digit code below.`);
  } catch (error) {
    resetRecaptchaWidget();
    setAuthMessage(mapFirebaseError(error), true);
  } finally {
    isSendingOtp = false;
    sendOtpBtn.disabled = false;
  }
}

function startResendCooldown(seconds) {
  if (resendCooldownTimer) clearInterval(resendCooldownTimer);
  let remaining = seconds;
  resendOtpBtn.disabled = true;
  resendOtpBtn.textContent = `Resend OTP (${remaining}s)`;
  resendCooldownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendCooldownTimer);
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = 'Resend OTP';
    } else {
      resendOtpBtn.textContent = `Resend OTP (${remaining}s)`;
    }
  }, 1000);
}

phoneAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const check = validateAndFormatE164(phoneInput.value.trim());
  if (!check.valid) {
    setAuthMessage(check.error, true);
    return;
  }
  phoneInput.value = check.formatted;
  await triggerPhoneOtp(check.formatted);
});

resendOtpBtn.addEventListener('click', async () => {
  if (!lastFormattedPhone || isSendingOtp) return;
  resetRecaptchaWidget();
  await triggerPhoneOtp(lastFormattedPhone);
});

changePhoneBtn.addEventListener('click', () => {
  if (resendCooldownTimer) clearInterval(resendCooldownTimer);
  otpVerifyForm.classList.add('hidden');
  confirmationResult = null;
  phoneInput.focus();
  setAuthMessage('Enter your phone number with country code (e.g., +91 98765 43210).');
});

otpVerifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isVerifyingOtp) return;

  const code = otpInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    setAuthMessage('Please enter a valid 6-digit numeric OTP code.', true);
    return;
  }
  if (!confirmationResult) {
    setAuthMessage('Please request an SMS OTP first.', true);
    return;
  }

  try {
    isVerifyingOtp = true;
    verifyOtpBtn.disabled = true;
    setAuthMessage('Verifying OTP...');
    const result = await confirmationResult.confirm(code);
    confirmationResult = null;
    completeUserOnboarding(result.user.phoneNumber);
  } catch (error) {
    setAuthMessage(mapFirebaseError(error), true);
  } finally {
    isVerifyingOtp = false;
    verifyOtpBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  if (resendCooldownTimer) clearInterval(resendCooldownTimer);
  disposeRecaptcha();
  confirmationResult = null;
  if (firebaseAuth) await signOut(firebaseAuth);
  authModal.classList.remove('hidden');
  userChip.classList.add('hidden');
  otpVerifyForm.classList.add('hidden');
  setAuthMessage('');
});

function completeUserOnboarding(identifier) {
  authModal.classList.add('hidden');
  userIdentifier.textContent = identifier;
  userChip.classList.remove('hidden');
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
  basicStrip.innerHTML = `<div class="basic-pill-card"><p class="rec-meta-line">Loading rotating clinical reference cards...</p></div>`;

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
      const badgeLabel = isRx ? 'Rx Only' : 'OTC / Supplement';
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
          searchAI(medName);
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
// INTELLIGENT MULTI-INTENT SEARCH ENGINE & IMMEDIATE RESULTS UI
// ============================================================================
function clearSearchResults() {
  lastSearchPayload = null;
  lastSearchQuery = '';
  resultsContainer.innerHTML = '';
  searchInput.value = '';
  searchInput.focus();
}

async function searchAI(query) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    resultsContainer.innerHTML = `
      <div class="med-detail-card">
        <h3>Please enter a search query</h3>
        <p>Search any medicine (Allopathic, Ayurvedic, Homeopathic, Veterinary), symptom, diagnostic test, medical device, or general question.</p>
      </div>`;
    return;
  }

  searchBtn.disabled = true;
  resultsContainer.innerHTML = `<div class="med-detail-card"><h3>Analyzing "${escapeHtml(cleanQuery)}" via intelligent clinical &amp; AI search...</h3></div>`;

  try {
    const resp = await fetch(`/api/medicines?q=${encodeURIComponent(cleanQuery)}`);
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
    renderSearchPayload(data, cleanQuery);
  } catch (error) {
    resultsContainer.innerHTML = `
      <div class="med-detail-card">
        <div class="rec-card-header">
          <h3>Network Connection Error</h3>
          <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
        </div>
        <p>Could not reach the search server. Please check your internet connection and try again.</p>
      </div>`;
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
  } finally {
    searchBtn.disabled = false;
  }
}

function renderSearchPayload(data, searchedQuery) {
  const intentType = data.intentType || 'medicine';

  // 1. Clarification Card for ambiguous queries
  if (intentType === 'clarification' && data.clarification) {
    const chipsHtml = (data.clarification.suggestions || [])
      .map(opt => `<button type="button" class="chip-btn" data-suggestion="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
      .join('');

    resultsContainer.innerHTML = `
      <div class="results-toolbar">
        <span>Clarification Needed for "${escapeHtml(searchedQuery)}"</span>
        <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
      </div>
      <article class="med-detail-card">
        <h3 class="med-title">${escapeHtml(data.clarification.question)}</h3>
        <p class="med-generic" style="margin-top: 0.35rem;">Select one of the specific options below to view detailed reference information:</p>
        <div class="clarification-chips">${chipsHtml}</div>
      </article>
    `;

    resultsContainer.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-suggestion');
        if (chosen) {
          searchInput.value = chosen;
          searchAI(chosen);
        }
      });
    });
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
    return;
  }

  // 2. Non-Medical General Knowledge Card
  if (intentType === 'non_medical' && data.generalAnswer) {
    resultsContainer.innerHTML = `
      <div class="results-toolbar">
        <span>General Information Result for "${escapeHtml(searchedQuery)}"</span>
        <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
      </div>
      <article class="med-detail-card">
        <span class="med-category-tag">${escapeHtml(data.generalAnswer.category || 'General Information')}</span>
        <h3 class="med-title">${escapeHtml(data.generalAnswer.title || searchedQuery)}</h3>
        <p style="margin-top: 0.65rem; color: #334155;">${escapeHtml(data.generalAnswer.summary)}</p>
      </article>
    `;
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
    return;
  }

  // 3. Condition, Symptom, Diagnostic Test, or Medical Device Card
  if (intentType === 'condition_or_device' && data.topic) {
    const t = data.topic;
    resultsContainer.innerHTML = `
      <div class="results-toolbar">
        <span>Clinical &amp; Healthcare Reference for "${escapeHtml(searchedQuery)}"</span>
        <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
      </div>
      <article class="med-detail-card">
        <div class="med-card-top">
          <div>
            <span class="med-category-tag">${escapeHtml(t.subType || 'Healthcare Reference')}</span>
            <h3 class="med-title">${escapeHtml(t.title)}</h3>
            <p class="med-generic" style="margin-top: 0.35rem;">${escapeHtml(t.overview)}</p>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel">
            <h4>Key Clinical Facts &amp; Parameters</h4>
            <ul>${(t.keyPoints || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
          </div>
          <div class="info-panel">
            <h4>Standard Care, Preparation or Usage</h4>
            <p>${escapeHtml(t.managementOrUsage)}</p>
          </div>
          <div class="info-panel side-effects-panel">
            <h4>Warning Signs &amp; Precautions</h4>
            <ul>${(t.redFlags || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="doctor-advice-banner">
          <strong>Medical Guidance:</strong> ${escapeHtml(t.doctorAdvice)}
          <div style="font-size: 0.78rem; color: #475569; margin-top: 0.35rem;">Reference: ${escapeHtml(t.referenceSource || 'Standard Clinical Reference')} • Always consult a qualified doctor for personal diagnosis or treatment.</div>
        </div>
      </article>
    `;
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
    return;
  }

  // 4. Medicine / Supplement / Ayurvedic / Homeopathic / Veterinary Card(s)
  const medicines = Array.isArray(data.medicines) ? data.medicines : [];
  if (medicines.length === 0) {
    resultsContainer.innerHTML = `
      <div class="med-detail-card">
        <div class="rec-card-header">
          <h3>No matching results found</h3>
          <button type="button" id="clear-results-btn" class="btn-link">Clear ✕</button>
        </div>
        <p>Please try refining your query with a brand name, active ingredient, or symptom.</p>
      </div>`;
    document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
    return;
  }

  let toolbarLabel = `Showing result${medicines.length > 1 ? `s (${medicines.length} similar matches distinguished)` : ''} for "${escapeHtml(searchedQuery)}"`;
  if (data.wasCorrected && data.correctedQuery) {
    toolbarLabel = `Showing results for "${escapeHtml(data.correctedQuery)}" (corrected from "${escapeHtml(searchedQuery)}")`;
  }

  const toolbarHtml = `
    <div class="results-toolbar">
      <span>${toolbarLabel}</span>
      <button type="button" id="clear-results-btn" class="btn-link">Clear Result ✕</button>
    </div>
  `;

  const noticeBanner = data.notice
    ? `<div class="rec-disclaimer">${escapeHtml(data.notice)}</div>`
    : '';

  resultsContainer.innerHTML = toolbarHtml + noticeBanner + medicines.map((med) => {
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
            <p class="med-generic"><strong>Composition:</strong> ${escapeHtml(med.genericName)} • ${escapeHtml(med.packSize || 'Standard Pack')}</p>
          </div>
          <div class="price-box">
            <div class="mrp-line">Approx. MRP: <span class="mrp-amount">₹${basePrice.toFixed(2)}</span></div>
            <div class="pharmacy-price-list"><strong>${isVet ? 'Dispensing Info:' : 'Nearby Pharmacy Estimates:'}</strong>${pharmacyRows}</div>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel"><h4>Clinical Description</h4><p>${escapeHtml(med.description)}</p></div>
          <div class="info-panel"><h4>Common Medical Uses</h4><ul>${(med.uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul></div>
          <div class="info-panel"><h4>General Dosage Reference</h4><p>${escapeHtml(med.standardDosage)}</p></div>
          <div class="info-panel"><h4>Approved Indications</h4><ul>${(med.curableDiseases || []).map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>
          <div class="info-panel side-effects-panel"><h4>Possible Side Effects</h4><ul>${(med.sideEffects || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>
        </div>
        <div class="doctor-advice-banner">
          <strong>Medical Safety &amp; Advice:</strong> ${escapeHtml(med.doctorAdvice)}
          <div style="font-size: 0.78rem; color: #475569; margin-top: 0.35rem;">Reference: ${escapeHtml(med.referenceSource || 'Standard Clinical Pharmacopoeia')} • Always consult a qualified physician, veterinarian, or pharmacist before use.</div>
        </div>
      </article>
    `;
  }).join('');

  document.getElementById('clear-results-btn')?.addEventListener('click', clearSearchResults);
}

searchBtn.addEventListener('click', () => searchAI(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchAI(searchInput.value);
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