const BASE_URL = 'http://localhost:3000';

const TEST_CASES = [
  { label: '1. Conventional Medicine', query: 'Dolo 650', expectedIntents: ['medicine'] },
  { label: '2. Unfamiliar / Regional Brand', query: 'Livomyn tablet', expectedIntents: ['medicine'] },
  { label: '3. Ayurvedic Formulation', query: 'Arsh Kalp', expectedIntents: ['medicine'] },
  { label: '4. Misspelled Medicine', query: 'Aswagandha', expectedIntents: ['medicine'] },
  { label: '5. Hinglish Medical Query', query: 'sugar problem ka ilaj kya hai', expectedIntents: ['clinical_guidance', 'medicine'] },
  { label: '6. Medical Equipment', query: 'BP machine', expectedIntents: ['medical_equipment'] },
  { label: '7. Sexual Health Query', query: 'Sex', expectedIntents: ['clinical_guidance'] },
  { label: '8. Symptom Query', query: 'Weakness', expectedIntents: ['clinical_guidance'] },
  { label: '9. Veterinary Medicine Query', query: 'Pet fever', expectedIntents: ['clinical_guidance', 'medicine'] },
  { label: '10. General Healthcare Comparison', query: 'Difference between Ayurvedic and Allopathic medicine', expectedIntents: ['clinical_guidance'] },
  { label: '11. Ambiguous Query', query: 'Hair problem', expectedIntents: ['clinical_guidance'] },
  { label: '12. Unrelated Query Redirection', query: 'Who won the cricket match yesterday?', expectedIntents: ['non_medical_redirect'] }
];

async function runTests() {
  console.log('Running Universal Medical AI Search Acceptance Tests...\n');
  let passed = 0;

  for (const tc of TEST_CASES) {
    try {
      const resp = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: tc.query, history: [] })
      });
      const data = await resp.json();
      const ok = resp.ok && tc.expectedIntents.includes(data.intentType);

      if (ok) {
        passed++;
        console.log(`PASS | ${tc.label} ("${tc.query}") -> intent: ${data.intentType} | lang: ${data.detectedLanguage}`);
      } else {
        console.error(`FAIL | ${tc.label} ("${tc.query}") -> HTTP ${resp.status}, intent: ${data.intentType}`);
      }
    } catch (err) {
      console.error(`ERROR | ${tc.label}: ${err.message}`);
    }
  }

  console.log(`\nCompleted: ${passed}/${TEST_CASES.length} tests passed.`);
}

runTests();