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

    // Extract active topic name & summary to keep subsequent follow-up questions anchored
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