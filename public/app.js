import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

let currentLocalityData = {};
let chatHistory = [];
let firebaseAuth = null;
let confirmationResult = null;

const authModal = document.getElementById('auth-modal');
const authStatusMsg = document.getElementById('auth-status-msg');
const googleLoginBtn = document.getElementById('google-login-btn');
const phoneAuthForm = document.getElementById('phone-auth-form');
const otpVerifyForm = document.getElementById('otp-verify-form');
const localityLabel = document.getElementById('locality-label');
const userChip = document.getElementById('user-chip');
const userIdentifier = document.getElementById('user-Identifier');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('medicine-search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('medicine-results-container');

// Chat UI elements
const chatFab = document.getElementById('chat-fab');
const chatWindow = document.getElementById('chat-window');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

async function initFirebase() {
  try {
    const resp = await fetch('/api/auth-config');
    const config = await resp.json();
    if (config.apiKey && config.apiKey !== 'DEMO') {
      const app = initializeApp(config);
      firebaseAuth = getAuth(app);
      window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' });
      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) completeUserOnboarding(user.displayName || user.phoneNumber || user.email);
      });
    }
  } catch (err) { console.error("Firebase err:", err); }
}

googleLoginBtn.addEventListener('click', async () => {
  try {
    authStatusMsg.textContent = 'Opening Google...';
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    completeUserOnboarding(result.user.displayName || result.user.email);
  } catch (error) { authStatusMsg.textContent = `Error: ${error.message}`; }
});

phoneAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let phone = document.getElementById('phone-input').value.trim();
  if (!phone.startsWith('+')) phone = `+91${phone.replace(/\s+/g, '')}`;
  try {
    authStatusMsg.textContent = `Sending OTP to ${phone}...`;
    confirmationResult = await signInWithPhoneNumber(firebaseAuth, phone, window.recaptchaVerifier);
    otpVerifyForm.classList.remove('hidden');
    authStatusMsg.textContent = 'OTP sent!';
  } catch (error) { authStatusMsg.textContent = `Error: ${error.message}`; }
});

otpVerifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('otp-input').value.trim();
  try {
    authStatusMsg.textContent = 'Verifying...';
    const result = await confirmationResult.confirm(code);
    completeUserOnboarding(result.user.phoneNumber);
  } catch (error) { authStatusMsg.textContent = 'Invalid OTP.'; }
});

logoutBtn.addEventListener('click', async () => {
  if (firebaseAuth) await signOut(firebaseAuth);
  authModal.classList.remove('hidden');
  userChip.classList.add('hidden');
});

function completeUserOnboarding(identifier) {
  authModal.classList.add('hidden');
  userIdentifier.textContent = identifier;
  userChip.classList.remove('hidden');
  requestRealGeolocation();
}

// REAL GOOGLE MAPS GEOLOCATION
function requestRealGeolocation() {
  if (!('geolocation' in navigator)) return;
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
        }
      } catch (err) { localityLabel.textContent = `GPS Connected`; }
    },
    (err) => { localityLabel.textContent = 'Location Blocked in Browser Settings'; },
    { enableHighAccuracy: true }
  );
}

// GROQ API SEARCH ENGINE
async function searchAI(query) {
  if (!query) return;
  resultsContainer.innerHTML = `<div class="med-detail-card"><h3>Asking Groq AI about "${query}"...</h3></div>`;
  try {
    const resp = await fetch(`/api/medicines?q=${encodeURIComponent(query)}`);
    const data = await resp.json();
    renderMedicineDetails(data.medicines || []);
  } catch (error) {
    resultsContainer.innerHTML = `<div class="med-detail-card"><p>AI Search Error.</p></div>`;
  }
}

function renderMedicineDetails(medicines) {
  if (medicines.length === 0) {
    resultsContainer.innerHTML = `<div class="med-detail-card"><h3>No results found</h3></div>`;
    return;
  }

  resultsContainer.innerHTML = medicines.map((med) => {
    let pharmacyRows = '';
    if (currentLocalityData.nearbyPharmacies) {
      pharmacyRows = currentLocalityData.nearbyPharmacies.map(pharm => 
        `<div class="pharmacy-row"><span>${pharm.name} (${pharm.distanceKm}km)</span><span class="pharmacy-price">₹${(med.basePriceINR * pharm.discountFactor).toFixed(2)}</span></div>`
      ).join('');
    }

    return `
      <article class="med-detail-card">
        <div class="med-card-top">
          <div>
            <span class="med-category-tag">${med.category || 'Medicine'}</span>
            <h3 class="med-title">${med.name}</h3>
            <p class="med-generic"><strong>Composition:</strong> ${med.genericName}</p>
          </div>
          <div class="price-box">
            <div class="mrp-line">Base Price: <span class="mrp-amount">₹${Number(med.basePriceINR).toFixed(2)}</span></div>
            <div class="pharmacy-price-list"><strong>Real Nearby Pharmacies:</strong>${pharmacyRows}</div>
          </div>
        </div>
        <div class="med-info-grid">
          <div class="info-panel"><h4>Clinical Description</h4><p>${med.description}</p></div>
          <div class="info-panel"><h4>Primary Uses</h4><ul>${(med.uses||[]).map(u => `<li>${u}</li>`).join('')}</ul></div>
          <div class="info-panel"><h4>Standard Dosage</h4><p>${med.standardDosage}</p></div>
          <div class="info-panel side-effects-panel"><h4>Known Side Effects</h4><ul>${(med.sideEffects||[]).map(s => `<li>${s}</li>`).join('')}</ul></div>
        </div>
        <div class="doctor-advice-banner"><strong>Doctor's Advice:</strong> ${med.doctorAdvice}</div>
      </article>
    `;
  }).join('');
}

searchBtn.addEventListener('click', () => searchAI(searchInput.value.trim()));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchAI(searchInput.value.trim()); }
});

// CHAT FAB LOGIC (Circle to Square transition)
chatFab.addEventListener('click', () => {
  chatFab.classList.add('hidden');
  chatWindow.classList.remove('hidden');
});

closeChatBtn.addEventListener('click', () => {
  chatWindow.classList.add('hidden');
  chatFab.classList.remove('hidden');
});

// CHAT SUBMIT LOGIC
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  appendChatMessage(text, 'user-bubble');
  chatInput.value = '';
  
  const loading = appendChatMessage('Typing...', 'bot-bubble');
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory })
    });
    const data = await resp.json();
    loading.innerHTML = formatText(data.reply || data.error);
    if (resp.ok && data.reply) {
      chatHistory.push({ role: 'user', text });
      chatHistory.push({ role: 'model', text: data.reply });
    }
  } catch (err) { loading.textContent = 'Error connecting to AI.'; }
});

// Clean formatter for structured chatbot output
function formatText(text) {
  return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
function appendChatMessage(text, className) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${className}`;
  div.innerHTML = className === 'user-bubble' ? text : formatText(text);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

initFirebase();