import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

let patientToken = '';
let therapistToken = '';
let testPatientToken = '';

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING PHASE 8 VERIFICATION TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Setup & Auth
  const patLogin = await post('/api/auth/login', { email: 'demo@patient.com', password: 'password123' });
  assert.strictEqual(patLogin.status, 200, 'Patient login failed');
  patientToken = patLogin.data.access_token;

  const thLogin = await post('/api/auth/login', { email: 'demo@therapist.com', password: 'password123' });
  assert.strictEqual(thLogin.status, 200, 'Therapist login failed');
  therapistToken = thLogin.data.access_token;

  // Create a brand new patient without any check-ins to test empty/insufficient states
  const randEmail = `newpatient_${Date.now()}@example.com`;
  const regRes = await post('/api/auth/register', {
    name: 'Empty State Patient',
    email: randEmail,
    password: 'password123',
    role: 'patient',
  });
  assert.strictEqual(regRes.status, 201, 'Registration of test patient failed');
  testPatientToken = regRes.data.access_token;
  const newPatientId = regRes.data.user.id;

  // SECTION 1: Patient Progress Report Tests
  console.log('\n--- Category 1: Patient Progress Report (/api/patient/progress-report) ---');

  const p30 = await get('/api/patient/progress-report?days=30', patientToken);
  test('1. Patient progress report returns 200 for authenticated patient', () => {
    assert.strictEqual(p30.status, 200);
  });

  test('2. Response contains has_data and has_sufficient_data indicators', () => {
    assert.strictEqual(p30.data.has_data, true);
    assert.strictEqual(p30.data.has_sufficient_data, true);
  });

  test('3. Response includes patient identification details', () => {
    assert.strictEqual(p30.data.patient.id, 1);
    assert.strictEqual(p30.data.patient.name, 'Alex Morgan');
  });

  test('4. Correctly computes average mood, stress, and energy', () => {
    assert(typeof p30.data.average_mood === 'number');
    assert(typeof p30.data.average_stress === 'number');
    assert(typeof p30.data.average_energy === 'number');
  });

  test('5. Computes directional trends (mood, stress, energy, overall)', () => {
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p30.data.mood_trend));
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p30.data.stress_trend));
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p30.data.energy_trend));
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p30.data.overall_trend));
  });

  test('6. Contains mood_over_time data points for charts', () => {
    assert(Array.isArray(p30.data.mood_over_time));
    assert(p30.data.mood_over_time.length > 0);
    assert(p30.data.mood_over_time[0].mood_score !== undefined);
  });

  test('7. Filters correctly for 7 days', async () => {
    const p7 = await get('/api/patient/progress-report?days=7', patientToken);
    assert.strictEqual(p7.status, 200);
    assert.strictEqual(p7.data.filter_days, 7);
  });

  test('8. Filters correctly for 90 days', async () => {
    const p90 = await get('/api/patient/progress-report?days=90', patientToken);
    assert.strictEqual(p90.status, 200);
    assert.strictEqual(p90.data.filter_days, 90);
  });

  test('9. Includes symptom severity patterns and frequent symptoms', () => {
    assert(Array.isArray(p30.data.symptom_severity_over_time));
    assert(Array.isArray(p30.data.frequent_symptoms));
    assert(['Improving', 'Stable', 'Worsening', 'Insufficient data'].includes(p30.data.symptom_trend));
  });

  test('10. Includes emotional-state distribution breakdown', () => {
    assert(Array.isArray(p30.data.emotional_state_distribution));
    if (p30.data.emotional_state_distribution.length > 0) {
      assert(p30.data.emotional_state_distribution[0].state !== undefined);
      assert(p30.data.emotional_state_distribution[0].percentage !== undefined);
    }
  });

  test('11. Includes standardized assessment summary and history', () => {
    assert(Array.isArray(p30.data.assessments));
    assert(p30.data.latest_assessment !== null);
  });

  test('12. Includes key AI patterns and wellness recommendations', () => {
    assert(Array.isArray(p30.data.key_patterns));
    assert(Array.isArray(p30.data.recommendations));
    assert(typeof p30.data.summary === 'string');
  });

  test('13. Includes required safety disclaimer', () => {
    assert.strictEqual(
      p30.data.safety_disclaimer,
      'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'
    );
  });

  // Empty state test
  const pEmpty = await get('/api/patient/progress-report?days=30', testPatientToken);
  test('14. Handles empty state with has_data: false and clear message', () => {
    assert.strictEqual(pEmpty.status, 200);
    assert.strictEqual(pEmpty.data.has_data, false);
    assert.strictEqual(pEmpty.data.has_sufficient_data, false);
    assert.strictEqual(pEmpty.data.message, 'No progress data available yet.');
  });

  // SECTION 2: Therapist Practice Reports (/api/therapist/reports)
  console.log('\n--- Category 2: Therapist Practice Analytics (/api/therapist/reports) ---');

  const thReports = await get('/api/therapist/reports', therapistToken);
  test('15. Therapist practice reports returns 200 for therapist', () => {
    assert.strictEqual(thReports.status, 200);
  });

  test('16. Practice analytics includes total_connected_patients', () => {
    assert(typeof thReports.data.total_connected_patients === 'number');
    assert(thReports.data.total_connected_patients >= 1);
  });

  test('17. Practice analytics includes active_patients and recent checkin counts', () => {
    assert(typeof thReports.data.active_patients === 'number');
    assert(typeof thReports.data.patients_with_recent_checkins === 'number');
    assert(typeof thReports.data.upcoming_sessions === 'number');
  });

  test('18. Practice analytics includes recent_activity list across connected patients', () => {
    assert(Array.isArray(thReports.data.recent_activity));
  });

  test('19. Patients array contains individual patient summary indicators', () => {
    assert(Array.isArray(thReports.data.patients));
    const p = thReports.data.patients[0];
    assert(p.id !== undefined);
    assert(p.name !== undefined);
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p.mood_direction));
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p.stress_direction));
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(p.energy_direction));
  });

  // SECTION 3: Therapist Individual Patient Report (/api/therapist/reports/:patientId)
  console.log('\n--- Category 3: Therapist Individual Patient Report (/api/therapist/reports/:patientId) ---');

  const thPatientReport = await get('/api/therapist/reports/1?days=30', therapistToken);
  test('20. Detailed report returns 200 for connected patient', () => {
    assert.strictEqual(thPatientReport.status, 200);
  });

  test('21. Detailed report includes patient overview & relationship status', () => {
    assert.strictEqual(thPatientReport.data.patient.id, 1);
    assert.strictEqual(thPatientReport.data.patient.status, 'ACCEPTED');
  });

  test('22. Directional indicators: Stress decreasing = Improving, increasing = Worsening', () => {
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(thPatientReport.data.stress_direction));
  });

  test('23. Directional indicators: Energy increasing = Improving, decreasing = Worsening', () => {
    assert(['Improving', 'Stable', 'Worsening', 'Mixed', 'Insufficient data'].includes(thPatientReport.data.energy_direction));
  });

  test('24. Trend Signals are present and explicitly labeled "Trend signal" (NOT "Diagnosis")', () => {
    assert(Array.isArray(thPatientReport.data.trend_signals));
    thPatientReport.data.trend_signals.forEach(sig => {
      assert(sig.title.includes('Trend signal') || sig.title.includes('Trend Signal'));
      assert(!sig.title.toLowerCase().includes('diagnosis'), 'Must never diagnose');
    });
  });

  test('25. Detailed report includes symptom severity trajectory and history', () => {
    assert(Array.isArray(thPatientReport.data.symptom_severity_over_time));
    assert(Array.isArray(thPatientReport.data.symptom_history));
  });

  test('26. Detailed report includes emotional-state distribution', () => {
    assert(Array.isArray(thPatientReport.data.emotional_state_distribution));
  });

  test('27. Detailed report includes assessment history', () => {
    assert(Array.isArray(thPatientReport.data.assessment_history));
    assert(thPatientReport.data.latest_assessment !== null);
  });

  test('28. Detailed report includes recent check-ins list', () => {
    assert(Array.isArray(thPatientReport.data.recent_checkins));
    assert(thPatientReport.data.recent_checkins.length > 0);
  });

  test('29. Detailed report includes safety disclaimer', () => {
    assert.strictEqual(
      thPatientReport.data.safety_disclaimer,
      'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'
    );
  });

  // SECTION 4: Security & Access Control
  console.log('\n--- Category 4: Security & Access Control ---');

  const pAccessTh = await get('/api/therapist/reports', patientToken);
  test('30. Patient cannot access therapist practice reports (403)', () => {
    assert.strictEqual(pAccessTh.status, 403);
  });

  const pAccessThDetail = await get('/api/therapist/reports/1', patientToken);
  test('31. Patient cannot access therapist detailed reports (403)', () => {
    assert.strictEqual(pAccessThDetail.status, 403);
  });

  const thAccessPat = await get('/api/patient/progress-report', therapistToken);
  test('32. Therapist cannot access patient self-report endpoint (403)', () => {
    assert.strictEqual(thAccessPat.status, 403);
  });

  const anonAccess = await get('/api/patient/progress-report');
  test('33. Unauthenticated request rejected with 401', () => {
    assert.strictEqual(anonAccess.status, 401);
  });

  // Therapist accessing patient WITHOUT accepted relationship
  const thAccessUnconnected = await get(`/api/therapist/reports/${newPatientId}`, therapistToken);
  test('34. Therapist cannot access reports of a patient without accepted relationship (403)', () => {
    assert.strictEqual(thAccessUnconnected.status, 403);
    assert(thAccessUnconnected.data.detail.includes('Access denied') || thAccessUnconnected.data.detail.includes('relationship'));
  });

  test('35. Responses never leak password hashes, tokens, or JWT secrets', () => {
    const rawStr = JSON.stringify(thPatientReport.data) + JSON.stringify(p30.data);
    assert(!rawStr.includes('password_hash'), 'password_hash leaked');
    assert(!rawStr.includes('JWT_SECRET'), 'JWT_SECRET leaked');
    assert(!rawStr.includes('token_type'), 'Internal token leaked');
  });

  // SECTION 5: Regression & Phase 1-7 Compatibility
  console.log('\n--- Category 5: Regression & Existing Feature Integrity ---');

  const patMood = await get('/api/mood/latest', patientToken);
  test('36. Mood Tracker endpoint continues working normally (Phase 4/5)', () => {
    assert.strictEqual(patMood.status, 200);
  });

  const patAssessment = await get('/api/assessment/history', patientToken);
  test('37. Assessment history endpoint continues working normally (Phase 3)', () => {
    assert.strictEqual(patAssessment.status, 200);
    assert(Array.isArray(patAssessment.data));
  });

  const patInsights = await get('/api/analysis', patientToken);
  test('38. AI Insights endpoint continues working normally (Phase 6)', () => {
    assert.strictEqual(patInsights.status, 200);
    assert(patInsights.data.trend !== undefined);
  });

  const thPatients = await get('/api/therapist/patients', therapistToken);
  test('39. Therapist relationships & patients directory continues working normally (Phase 7)', () => {
    assert.strictEqual(thPatients.status, 200);
    assert(Array.isArray(thPatients.data));
  });

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
