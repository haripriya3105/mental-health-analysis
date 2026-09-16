import crypto from 'node:crypto';
import {
  generateAIAnalysis,
  analyzePatterns,
  calculateTrendSignals,
  calculateSymptomTrend,
  calculateEmotionalDistribution,
} from './analysisService.js';
import {
  getDb,
  persistDb,
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  getRelationships,
  findRelationshipById,
  findRelationship,
  hasActiveRelationship,
  createRelationship,
  updateRelationshipStatus,
  getTherapySessions,
  findTherapySessionById,
  createTherapySession,
  updateTherapySession,
} from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mental-health-secure-secret-key-2026';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

function createAccessToken(user) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
  const payload = { sub: String(user.id), role: user.role, exp };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAccessToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function formatSessionForPatient(session) {
  const therapist = findUserById(session.therapist_id);
  return {
    id: session.id,
    patient_id: session.patient_id,
    therapist_id: session.therapist_id,
    therapist: therapist ? { id: therapist.id, name: therapist.name, email: therapist.email } : null,
    scheduled_at: session.scheduled_at,
    duration: session.duration,
    session_type: session.session_type,
    status: session.status,
    meeting_link: session.meeting_link,
    patient_notes: session.patient_notes,
    session_summary: session.session_summary,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

function formatSessionForTherapist(session) {
  const patient = findUserById(session.patient_id);
  return {
    id: session.id,
    patient_id: session.patient_id,
    therapist_id: session.therapist_id,
    patient: patient ? { id: patient.id, name: patient.name, email: patient.email } : null,
    scheduled_at: session.scheduled_at,
    duration: session.duration,
    session_type: session.session_type,
    status: session.status,
    meeting_link: session.meeting_link,
    patient_notes: session.patient_notes,
    therapist_notes: session.therapist_notes,
    session_summary: session.session_summary,
    progress_observation: session.progress_observation,
    follow_up_date: session.follow_up_date,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

// Initial seed questions matching backend/app/assessment_seed.py
const INITIAL_QUESTIONS = [
  { id: 1, question_text: "In the past two weeks, how often have you felt emotionally overwhelmed?", category: "emotional wellbeing", question_order: 1 },
  { id: 2, question_text: "In the past two weeks, how often have you had difficulty relaxing after a busy day?", category: "stress", question_order: 2 },
  { id: 3, question_text: "In the past two weeks, how often have you had low energy for your usual activities?", category: "energy", question_order: 3 },
  { id: 4, question_text: "In the past two weeks, how often have you found it difficult to focus on everyday tasks?", category: "focus", question_order: 4 },
  { id: 5, question_text: "In the past two weeks, how often have you felt disconnected from people around you?", category: "connection", question_order: 5 },
  { id: 6, question_text: "In the past two weeks, how often have sleep difficulties affected your wellbeing?", category: "sleep", question_order: 6 },
  { id: 7, question_text: "In the past two weeks, how often have you felt unable to manage everyday pressures?", category: "coping", question_order: 7 },
  { id: 8, question_text: "In the past two weeks, how often have you been worried about your general wellbeing?", category: "wellness", question_order: 8 },
];

function categoryForScore(score) {
  if (score <= 5) {
    return {
      category: "LOWER CONCERN",
      guidance: "Your responses currently show relatively few signs of emotional difficulty. Continue noticing the routines and support that help you feel well."
    };
  }
  if (score <= 11) {
    return {
      category: "MILD CONCERN",
      guidance: "Your responses show some areas that may benefit from additional self-care and monitoring."
    };
  }
  if (score <= 17) {
    return {
      category: "MODERATE CONCERN",
      guidance: "Your responses suggest that you may benefit from additional support and speaking with a qualified professional."
    };
  }
  return {
    category: "HIGHER CONCERN",
    guidance: "Your responses indicate that seeking support from a qualified mental health professional may be especially helpful."
  };
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const parseJsonBody = readBody;

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload || !payload.sub) return null;
  return findUserById(payload.sub);
}

export function createApiMiddleware() {
  // Ensure persistent db is initialized on server start
  getDb();

  return async (req, res, next) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      return res.end();
    }

    // Health check
    if (pathname === '/health' || pathname === '/api/health') {
      return sendJson(res, 200, { status: "ok" });
    }

    // ==========================================
    // Authentication Endpoints
    // ==========================================
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { name, email, password, role } = body;

        if (!name || !email || !password || !role) {
          return sendJson(res, 422, { detail: "Missing required fields" });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        if (findUserByEmail(cleanEmail)) {
          return sendJson(res, 409, { detail: "An account with this email already exists" });
        }

        if (String(password).length < 8) {
          return sendJson(res, 422, { detail: "Use a password with at least 8 characters." });
        }

        if (!['patient', 'therapist'].includes(role)) {
          return sendJson(res, 422, { detail: "Role must be 'patient' or 'therapist'" });
        }

        const newUser = createUser({
          name: String(name).trim(),
          email: cleanEmail,
          password: String(password),
          role,
        });

        const token = createAccessToken(newUser);
        return sendJson(res, 201, {
          access_token: token,
          token_type: "bearer",
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
          },
        });
      } catch (err) {
        if (err && err.message === 'USER_EXISTS') {
          return sendJson(res, 409, { detail: "An account with this email already exists" });
        }
        return sendJson(res, 400, { detail: "Invalid request payload" });
      }
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const { email, password } = body;

        if (!email || !password) {
          return sendJson(res, 401, { detail: "Incorrect email or password" });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const user = findUserByEmail(cleanEmail);

        if (!user || !verifyPassword(String(password), user.password_hash)) {
          return sendJson(res, 401, { detail: "Incorrect email or password" });
        }

        const token = createAccessToken(user);
        return sendJson(res, 200, {
          access_token: token,
          token_type: "bearer",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      } catch {
        return sendJson(res, 400, { detail: "Invalid request payload" });
      }
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      return sendJson(res, 200, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    }

    // ==========================================
    // Assessment Endpoints
    // ==========================================
    if (pathname === '/api/assessment/questions' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }
      const questions = [...INITIAL_QUESTIONS].sort((a, b) => a.question_order - b.question_order);
      return sendJson(res, 200, questions);
    }

    if (pathname === '/api/assessment/submit' && req.method === 'POST') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      try {
        const body = await readBody(req);
        const { answers } = body;

        if (!Array.isArray(answers) || answers.length === 0) {
          return sendJson(res, 422, { detail: "Please answer every assessment question exactly once." });
        }

        const expectedIds = INITIAL_QUESTIONS.map(q => q.id);
        const suppliedIds = answers.map(a => a.question_id);

        const uniqueSupplied = new Set(suppliedIds);
        if (uniqueSupplied.size !== expectedIds.length || !expectedIds.every(id => uniqueSupplied.has(id))) {
          return sendJson(res, 422, { detail: "Please answer every assessment question exactly once." });
        }

        let totalScore = 0;
        for (const item of answers) {
          const val = Number(item.answer_value);
          if (isNaN(val) || val < 0 || val > 3) {
            return sendJson(res, 422, { detail: "Answer value must be between 0 and 3." });
          }
          totalScore += val;
        }

        const db = getDb();
        const { category, guidance } = categoryForScore(totalScore);
        const assessment = {
          id: db.counters.nextAssessmentId++,
          patient_id: user.id,
          total_score: totalScore,
          result_category: category,
          created_at: new Date().toISOString(),
        };
        db.assessments.push(assessment);

        for (const ans of answers) {
          db.assessmentAnswers.push({
            id: db.assessmentAnswers.length + 1,
            assessment_id: assessment.id,
            question_id: ans.question_id,
            answer_value: ans.answer_value,
          });
        }
        persistDb();

        return sendJson(res, 201, {
          id: assessment.id,
          total_score: totalScore,
          result_category: category,
          guidance,
          created_at: assessment.created_at,
        });
      } catch {
        return sendJson(res, 400, { detail: "Invalid request payload" });
      }
    }

    if (pathname === '/api/assessment/history' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const history = db.assessments
        .filter(a => a.patient_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(a => ({
          id: a.id,
          total_score: a.total_score,
          result_category: a.result_category,
          created_at: a.created_at,
        }));

      return sendJson(res, 200, history);
    }

    // ==========================================
    // Mood Tracking Endpoints
    // ==========================================
    if ((pathname === '/api/mood' || pathname === '/api/mood/entries') && req.method === 'POST') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      try {
        const body = await readBody(req);
        const moodScore = Number(body.mood_score);
        const stressLevel = Number(body.stress_level);
        const energyLevel = Number(body.energy_level);
        const emotionalState = body.emotional_state ? String(body.emotional_state).trim() : '';

        if (isNaN(moodScore) || moodScore < 1 || moodScore > 10) {
          return sendJson(res, 422, { detail: "Mood score must be between 1 and 10." });
        }
        if (isNaN(stressLevel) || stressLevel < 1 || stressLevel > 10) {
          return sendJson(res, 422, { detail: "Stress level must be between 1 and 10." });
        }
        if (isNaN(energyLevel) || energyLevel < 1 || energyLevel > 10) {
          return sendJson(res, 422, { detail: "Energy level must be between 1 and 10." });
        }
        if (!emotionalState) {
          return sendJson(res, 422, { detail: "Please select your emotional state." });
        }

        const db = getDb();
        const entry = {
          id: db.counters.nextMoodId++,
          patient_id: user.id,
          mood_score: Math.round(moodScore),
          stress_level: Math.round(stressLevel),
          energy_level: Math.round(energyLevel),
          emotional_state: emotionalState,
          notes: body.notes ? String(body.notes).trim() : null,
          created_at: new Date().toISOString(),
        };
        db.moodEntries.push(entry);
        persistDb();

        return sendJson(res, 201, entry);
      } catch {
        return sendJson(res, 400, { detail: "Invalid request payload" });
      }
    }

    if (pathname === '/api/mood/history' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const history = db.moodEntries
        .filter(e => e.patient_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sendJson(res, 200, history);
    }

    if (pathname === '/api/mood/latest' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const history = db.moodEntries
        .filter(e => e.patient_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sendJson(res, 200, history[0] || null);
    }

    if (pathname === '/api/mood/trends' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const daysParam = parsedUrl.searchParams.get('days');
      const days = daysParam ? parseInt(daysParam, 10) : 30;
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const db = getDb();
      const trends = db.moodEntries
        .filter(e => e.patient_id === user.id && new Date(e.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(e => ({
          id: e.id,
          date: new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          full_date: new Date(e.created_at).toISOString().slice(0, 10),
          created_at: e.created_at,
          mood_score: e.mood_score,
          stress_level: e.stress_level,
          energy_level: e.energy_level,
          emotional_state: e.emotional_state,
        }));

      return sendJson(res, 200, trends);
    }

    // ==========================================
    // Symptom Tracking Endpoints
    // ==========================================
    if (pathname === '/api/symptoms' && req.method === 'POST') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      try {
        const body = await readBody(req);
        const symptomName = body.symptom_name ? String(body.symptom_name).trim() : '';
        const severity = Number(body.severity);

        if (!symptomName) {
          return sendJson(res, 422, { detail: "Please provide a symptom name." });
        }
        if (isNaN(severity) || severity < 1 || severity > 10) {
          return sendJson(res, 422, { detail: "Severity must be between 1 and 10." });
        }

        const db = getDb();
        const entry = {
          id: db.counters.nextSymptomId++,
          patient_id: user.id,
          symptom_name: symptomName,
          severity: Math.round(severity),
          notes: body.notes ? String(body.notes).trim() : null,
          created_at: new Date().toISOString(),
        };
        db.symptomEntries.push(entry);
        persistDb();

        return sendJson(res, 201, entry);
      } catch {
        return sendJson(res, 400, { detail: "Invalid request payload" });
      }
    }

    if (pathname === '/api/symptoms/history' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const history = db.symptomEntries
        .filter(e => e.patient_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sendJson(res, 200, history);
    }

    if (pathname.startsWith('/api/symptoms/') && req.method === 'DELETE') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const idPart = pathname.slice('/api/symptoms/'.length);
      const symptomId = parseInt(idPart, 10);
      if (isNaN(symptomId)) {
        return sendJson(res, 400, { detail: "Invalid symptom ID" });
      }

      const db = getDb();
      const entry = db.symptomEntries.find(e => e.id === symptomId);
      if (!entry) {
        return sendJson(res, 404, { detail: "Symptom entry not found" });
      }
      if (entry.patient_id !== user.id) {
        return sendJson(res, 403, { detail: "Cannot delete other patients' data" });
      }

      const idx = db.symptomEntries.findIndex(e => e.id === symptomId);
      db.symptomEntries.splice(idx, 1);
      persistDb();

      return sendJson(res, 200, { message: "Symptom entry deleted successfully", id: symptomId });
    }

    // ==========================================
    // AI Analysis / Pattern Insights Endpoints
    // ==========================================
    if ((pathname === '/api/analysis' || pathname === '/api/insights') && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const userMoods = db.moodEntries.filter(m => m.patient_id === user.id);
      const userSymptoms = db.symptomEntries.filter(s => s.patient_id === user.id);
      const userAssessments = db.assessments.filter(a => a.patient_id === user.id);

      try {
        const analysisResult = await generateAIAnalysis(userMoods, userSymptoms, userAssessments);
        return sendJson(res, 200, analysisResult);
      } catch (err) {
        return sendJson(res, 500, { detail: "Failed to generate pattern analysis: " + err.message });
      }
    }

    // ==========================================
    // Therapist & Relationship Endpoints (Phase 7)
    // ==========================================

    // 1. Get available therapists list (for patients)
    if (pathname === '/api/therapists' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      const db = getDb();
      const therapists = db.users
        .filter(u => u.role === 'therapist')
        .map(t => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
          created_at: t.created_at,
        }));
      return sendJson(res, 200, therapists);
    }

    // 2. Send connection request to therapist (patient only)
    if (pathname === '/api/therapists/requests' && req.method === 'POST') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Only patients can send connection requests to therapists." });
      }

      try {
        const body = await readBody(req);
        const therapistId = Number(body.therapist_id);
        if (isNaN(therapistId) || therapistId <= 0) {
          return sendJson(res, 422, { detail: "Please provide a valid therapist ID." });
        }

        const therapist = findUserById(therapistId);
        if (!therapist || therapist.role !== 'therapist') {
          return sendJson(res, 404, { detail: "Therapist not found." });
        }

        const rel = createRelationship({
          patient_id: user.id,
          therapist_id: therapistId,
          status: 'PENDING',
        });

        return sendJson(res, 201, {
          ...rel,
          therapist: { id: therapist.id, name: therapist.name, email: therapist.email },
        });
      } catch (err) {
        if (err && err.message === 'REQUEST_ALREADY_PENDING') {
          return sendJson(res, 400, { detail: "A connection request is already pending with this therapist." });
        }
        if (err && err.message === 'ALREADY_CONNECTED') {
          return sendJson(res, 400, { detail: "You already have an active relationship with this therapist." });
        }
        return sendJson(res, 400, { detail: "Failed to send connection request." });
      }
    }

    // 3. View connection requests (patient views own, therapist views incoming)
    if (pathname === '/api/therapists/requests' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }

      const db = getDb();
      const allRels = db.therapistRelationships || [];

      if (user.role === 'patient') {
        const userRels = allRels
          .filter(r => r.patient_id === user.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(r => {
            const t = findUserById(r.therapist_id);
            return {
              id: r.id,
              patient_id: r.patient_id,
              therapist_id: r.therapist_id,
              status: r.status,
              created_at: r.created_at,
              updated_at: r.updated_at,
              therapist: t ? { id: t.id, name: t.name, email: t.email } : null,
            };
          });
        return sendJson(res, 200, userRels);
      }

      if (user.role === 'therapist') {
        const therapistRels = allRels
          .filter(r => r.therapist_id === user.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(r => {
            const p = findUserById(r.patient_id);
            return {
              id: r.id,
              patient_id: r.patient_id,
              therapist_id: r.therapist_id,
              status: r.status,
              created_at: r.created_at,
              updated_at: r.updated_at,
              patient: p ? { id: p.id, name: p.name, email: p.email } : null,
            };
          });
        return sendJson(res, 200, therapistRels);
      }

      return sendJson(res, 403, { detail: "Unauthorized role" });
    }

    // 4. Accept or reject connection request (therapist only)
    if (
      pathname.startsWith('/api/therapists/requests/') &&
      (pathname.endsWith('/accept') || pathname.endsWith('/reject')) &&
      req.method === 'POST'
    ) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can accept or reject requests." });
      }

      const isAccept = pathname.endsWith('/accept');
      const idPart = pathname
        .replace('/api/therapists/requests/', '')
        .replace(isAccept ? '/accept' : '/reject', '');
      const reqId = parseInt(idPart, 10);

      if (isNaN(reqId)) {
        return sendJson(res, 400, { detail: "Invalid connection request ID." });
      }

      const rel = findRelationshipById(reqId);
      if (!rel) {
        return sendJson(res, 404, { detail: "Connection request not found." });
      }
      if (rel.therapist_id !== user.id) {
        return sendJson(res, 403, { detail: "You can only manage connection requests sent to you." });
      }

      const newStatus = isAccept ? 'ACCEPTED' : 'REJECTED';
      const updated = updateRelationshipStatus(reqId, newStatus);
      const patient = findUserById(updated.patient_id);

      return sendJson(res, 200, {
        ...updated,
        patient: patient ? { id: patient.id, name: patient.name, email: patient.email } : null,
        message: isAccept ? "Request accepted successfully." : "Request rejected.",
      });
    }

    // 5. Therapist Dashboard Summary (therapist only)
    if (pathname === '/api/therapist/dashboard' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can access this dashboard." });
      }

      const db = getDb();
      const allRels = (db.therapistRelationships || []).filter(r => r.therapist_id === user.id);
      const connectedRels = allRels.filter(r => r.status === 'ACCEPTED');
      const pendingRels = allRels.filter(r => r.status === 'PENDING');

      const connectedPatientIds = new Set(connectedRels.map(r => r.patient_id));

      const recentActivity = [];
      for (const m of db.moodEntries) {
        if (connectedPatientIds.has(m.patient_id)) {
          const p = findUserById(m.patient_id);
          recentActivity.push({
            id: `mood-${m.id}`,
            type: 'check-in',
            patient_id: m.patient_id,
            patient_name: p ? p.name : 'Unknown Patient',
            created_at: m.created_at,
            summary: `Logged mood (${m.mood_score}/10, stress ${m.stress_level}/10, state: ${m.emotional_state})`,
          });
        }
      }

      for (const a of db.assessments) {
        if (connectedPatientIds.has(a.patient_id)) {
          const p = findUserById(a.patient_id);
          recentActivity.push({
            id: `assessment-${a.id}`,
            type: 'assessment',
            patient_id: a.patient_id,
            patient_name: p ? p.name : 'Unknown Patient',
            created_at: a.created_at,
            summary: `Completed assessment (${a.result_category}, score: ${a.total_score})`,
          });
        }
      }

      recentActivity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const pendingRequests = pendingRels.map(r => {
        const p = findUserById(r.patient_id);
        return {
          id: r.id,
          patient_id: r.patient_id,
          created_at: r.created_at,
          status: r.status,
          patient: p ? { id: p.id, name: p.name, email: p.email } : null,
        };
      });

      const allSessions = getTherapySessions().filter(
        s => s.therapist_id === user.id && connectedPatientIds.has(s.patient_id)
      );
      const requestedSessionsCount = allSessions.filter(s => s.status === 'REQUESTED').length;
      const upcomingSessionsCount = allSessions.filter(s => s.status === 'SCHEDULED').length;

      return sendJson(res, 200, {
        total_connected_patients: connectedRels.length,
        pending_requests_count: pendingRels.length,
        pending_requests: pendingRequests,
        pending_sessions_count: requestedSessionsCount,
        upcoming_sessions_count: upcomingSessionsCount,
        recent_activity: recentActivity.slice(0, 10),
      });
    }

    // 6. Therapist Connected Patients List (therapist only)
    if (pathname === '/api/therapist/patients' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can access the patient directory." });
      }

      const db = getDb();
      const connectedRels = (db.therapistRelationships || []).filter(
        r => r.therapist_id === user.id && r.status === 'ACCEPTED'
      );

      const patientSummaries = await Promise.all(
        connectedRels.map(async rel => {
          const p = findUserById(rel.patient_id);
          if (!p) return null;

          const patientMoods = db.moodEntries.filter(m => m.patient_id === p.id);
          const patientSymptoms = db.symptomEntries.filter(s => s.patient_id === p.id);
          const patientAssessments = db.assessments.filter(a => a.patient_id === p.id);

          const sortedMoods = [...patientMoods].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const lastCheckIn = sortedMoods[0] || null;

          let avgMood = null;
          let avgStress = null;
          let avgEnergy = null;
          if (patientMoods.length > 0) {
            avgMood = Number((patientMoods.reduce((sum, m) => sum + m.mood_score, 0) / patientMoods.length).toFixed(1));
            avgStress = Number((patientMoods.reduce((sum, m) => sum + m.stress_level, 0) / patientMoods.length).toFixed(1));
            avgEnergy = Number((patientMoods.reduce((sum, m) => sum + m.energy_level, 0) / patientMoods.length).toFixed(1));
          }

          const sortedSymptoms = [...patientSymptoms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const recentSymptom = sortedSymptoms[0] || null;

          let trend = 'Insufficient data';
          if (patientMoods.length >= 2) {
            try {
              const analysis = await generateAIAnalysis(patientMoods, patientSymptoms, patientAssessments);
              trend = analysis.trend || 'Stable';
            } catch {
              trend = 'Stable';
            }
          }

          return {
            id: p.id,
            patient_id: p.id,
            relationship_id: rel.id,
            name: p.name,
            email: p.email,
            status: rel.status,
            connected_at: rel.updated_at || rel.created_at,
            total_checkins: patientMoods.length,
            last_checkin: lastCheckIn ? {
              date: lastCheckIn.created_at,
              mood: lastCheckIn.mood_score,
              stress: lastCheckIn.stress_level,
              energy: lastCheckIn.energy_level,
              emotional_state: lastCheckIn.emotional_state,
            } : null,
            average_mood: avgMood,
            average_stress: avgStress,
            average_energy: avgEnergy,
            recent_symptom: recentSymptom ? {
              name: recentSymptom.symptom_name,
              severity: recentSymptom.severity,
              date: recentSymptom.created_at,
            } : null,
            total_symptoms: patientSymptoms.length,
            latest_trend: trend,
          };
        })
      );

      return sendJson(res, 200, patientSummaries.filter(Boolean));
    }

    // 7. Connected Patient Progress Detail (therapist only, STRICT AUTHORIZATION)
    if (
      pathname.startsWith('/api/therapist/patients/') &&
      pathname.endsWith('/progress') &&
      req.method === 'GET'
    ) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can access patient progress." });
      }

      const patientIdStr = pathname
        .replace('/api/therapist/patients/', '')
        .replace('/progress', '');
      const patientId = parseInt(patientIdStr, 10);

      if (isNaN(patientId)) {
        return sendJson(res, 400, { detail: "Invalid patient ID." });
      }

      const patient = findUserById(patientId);
      if (!patient || patient.role !== 'patient') {
        return sendJson(res, 404, { detail: "Patient not found." });
      }

      // CRITICAL SERVER-SIDE AUTHORIZATION:
      // Verify active ACCEPTED relationship exists between this therapist and patient
      if (!hasActiveRelationship(patientId, user.id)) {
        return sendJson(res, 403, {
          detail: "Access denied. You do not have an active accepted relationship with this patient.",
        });
      }

      const daysParam = parsedUrl.searchParams.get('days');
      const days = daysParam ? parseInt(daysParam, 10) : 30;
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const db = getDb();
      const allPatientMoods = db.moodEntries.filter(m => m.patient_id === patientId);
      const filteredMoods = allPatientMoods
        .filter(m => new Date(m.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const moodTrends = filteredMoods.map(m => ({
        id: m.id,
        date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full_date: new Date(m.created_at).toISOString().slice(0, 10),
        created_at: m.created_at,
        mood_score: m.mood_score,
        stress_level: m.stress_level,
        energy_level: m.energy_level,
        emotional_state: m.emotional_state,
        notes: m.notes,
      }));

      const recentCheckins = [...allPatientMoods]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      const patientSymptoms = db.symptomEntries
        .filter(s => s.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const patientAssessments = db.assessments
        .filter(a => a.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // AI Analysis based on patient's records
      let aiAnalysis = null;
      try {
        const analysisData = filteredMoods.length > 0 ? filteredMoods : allPatientMoods;
        aiAnalysis = await generateAIAnalysis(analysisData, patientSymptoms, patientAssessments);
      } catch {
        aiAnalysis = {
          trend: 'Insufficient data',
          trend_description: 'Not enough historical data to calculate a meaningful trend.',
          summary: 'Not enough historical data to calculate a meaningful trend.',
          key_patterns: [],
          recommendations: [],
        };
      }

      const relationship = findRelationship(patientId, user.id);

      return sendJson(res, 200, {
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          created_at: patient.created_at,
          connected_at: relationship ? (relationship.updated_at || relationship.created_at) : null,
          status: relationship ? relationship.status : null,
        },
        filter_days: days,
        total_checkins: allPatientMoods.length,
        filtered_checkins: filteredMoods.length,
        mood_trends: moodTrends,
        recent_checkins: recentCheckins,
        symptoms: patientSymptoms,
        assessments: patientAssessments,
        ai_analysis: aiAnalysis,
      });
    }

    // ==========================================
    // Phase 8: Reports and Analytics Endpoints
    // ==========================================

    // 1. Patient Progress Report (Patient only)
    if (pathname === '/api/patient/progress-report' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const daysParam = parsedUrl.searchParams.get('days');
      const days = daysParam ? parseInt(daysParam, 10) : 30;
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const db = getDb();
      const allMoods = db.moodEntries.filter(m => m.patient_id === user.id);
      const filteredMoods = allMoods
        .filter(m => new Date(m.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const allSymptoms = db.symptomEntries.filter(s => s.patient_id === user.id);
      const filteredSymptoms = allSymptoms
        .filter(s => new Date(s.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const assessments = db.assessments
        .filter(a => a.patient_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Empty state
      if (allMoods.length === 0) {
        return sendJson(res, 200, {
          has_data: false,
          has_sufficient_data: false,
          message: "No progress data available yet.",
          patient: { id: user.id, name: user.name, email: user.email },
          filter_days: days,
          total_checkins: 0,
          filtered_checkins: 0,
          average_mood: null,
          average_stress: null,
          average_energy: null,
          mood_trend: 'Insufficient data',
          stress_trend: 'Insufficient data',
          energy_trend: 'Insufficient data',
          overall_trend: 'Insufficient data',
          symptom_trend: 'Insufficient data',
          mood_over_time: [],
          symptoms: [],
          frequent_symptoms: [],
          symptom_severity_over_time: [],
          emotional_state_distribution: [],
          assessments: assessments,
          latest_assessment: assessments[0] || null,
          key_patterns: [],
          recommendations: [],
          summary: "No progress data available yet.",
          safety_disclaimer: "AI insights are for informational and wellness purposes only and are not a medical diagnosis.",
        });
      }

      const dataForAnalysis = filteredMoods.length >= 2 ? filteredMoods : allMoods;
      const patterns = analyzePatterns(dataForAnalysis, filteredSymptoms, assessments);
      const symptomTrend = calculateSymptomTrend(filteredSymptoms.length > 0 ? filteredSymptoms : allSymptoms);
      const emotionalDist = calculateEmotionalDistribution(filteredMoods.length > 0 ? filteredMoods : allMoods);

      const moodOverTime = (filteredMoods.length > 0 ? filteredMoods : allMoods).map(m => ({
        id: m.id,
        date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full_date: new Date(m.created_at).toISOString().slice(0, 10),
        created_at: m.created_at,
        mood_score: m.mood_score,
        stress_level: m.stress_level,
        energy_level: m.energy_level,
        emotional_state: m.emotional_state,
        notes: m.notes,
      }));

      const symptomSeverityOverTime = (filteredSymptoms.length > 0 ? filteredSymptoms : allSymptoms).map(s => ({
        id: s.id,
        date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full_date: new Date(s.created_at).toISOString().slice(0, 10),
        created_at: s.created_at,
        name: s.symptom_name,
        severity: s.severity,
        notes: s.notes,
      }));

      let aiResult = null;
      try {
        aiResult = await generateAIAnalysis(dataForAnalysis, filteredSymptoms, assessments);
      } catch {
        aiResult = patterns;
      }

      const hasSufficient = filteredMoods.length >= 2;

      return sendJson(res, 200, {
        has_data: true,
        has_sufficient_data: hasSufficient,
        message: hasSufficient ? null : "Not enough historical data to calculate a meaningful report.",
        patient: { id: user.id, name: user.name, email: user.email },
        filter_days: days,
        total_checkins: allMoods.length,
        filtered_checkins: filteredMoods.length,
        average_mood: patterns.average_mood,
        average_stress: patterns.average_stress,
        average_energy: patterns.average_energy,
        mood_trend: hasSufficient ? patterns.mood_direction : 'Insufficient data',
        stress_trend: hasSufficient ? patterns.stress_direction : 'Insufficient data',
        energy_trend: hasSufficient ? patterns.energy_direction : 'Insufficient data',
        overall_trend: hasSufficient ? (aiResult?.trend || patterns.trend) : 'Insufficient data',
        symptom_trend: symptomTrend,
        mood_over_time: moodOverTime,
        symptoms: filteredSymptoms,
        frequent_symptoms: patterns.frequent_symptoms || [],
        symptom_severity_over_time: symptomSeverityOverTime,
        emotional_state_distribution: emotionalDist,
        assessments: assessments,
        latest_assessment: assessments[0] || null,
        key_patterns: aiResult?.key_patterns || patterns.key_patterns || [],
        recommendations: aiResult?.recommendations || patterns.recommendations || [],
        summary: aiResult?.summary || patterns.summary || "Summary unavailable",
        safety_disclaimer: "AI insights are for informational and wellness purposes only and are not a medical diagnosis.",
      });
    }

    // 2. Therapist Reports List & Practice Analytics (Therapist only)
    if (pathname === '/api/therapist/reports' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const db = getDb();
      const relationships = getRelationships().filter(
        r => r.therapist_id === user.id && r.status === 'ACCEPTED'
      );

      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      let activeCount = 0;
      let recentCheckinsCount = 0;
      const allRecentActivity = [];

      const connectedPatients = relationships.map(rel => {
        const patient = findUserById(rel.patient_id);
        if (!patient) return null;

        const pMoods = db.moodEntries
          .filter(m => m.patient_id === patient.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const pSymptoms = db.symptomEntries
          .filter(s => s.patient_id === patient.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const latestMood = pMoods.length > 0 ? pMoods[pMoods.length - 1] : null;
        const lastCheckinTime = latestMood ? new Date(latestMood.created_at).getTime() : 0;

        const hasRecentCheckin = lastCheckinTime >= sevenDaysAgo;
        const isActive = lastCheckinTime >= thirtyDaysAgo;

        if (hasRecentCheckin) recentCheckinsCount++;
        if (isActive) activeCount++;

        const patterns = analyzePatterns(pMoods, pSymptoms, []);
        const symptomTrend = calculateSymptomTrend(pSymptoms);
        const trendSignals = calculateTrendSignals(pMoods, pSymptoms);

        pMoods.slice(-3).forEach(m => {
          allRecentActivity.push({
            id: `mood-${m.id}`,
            patient_id: patient.id,
            patient_name: patient.name,
            type: 'check-in',
            summary: `Mood ${m.mood_score}/10, Stress ${m.stress_level}/10 (${m.emotional_state || 'Check-in'})`,
            created_at: m.created_at,
          });
        });

        return {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          connected_at: rel.updated_at || rel.created_at,
          total_checkins: pMoods.length,
          last_checkin: latestMood ? latestMood.created_at : null,
          average_mood: patterns.average_mood,
          average_stress: patterns.average_stress,
          average_energy: patterns.average_energy,
          mood_direction: pMoods.length >= 2 ? patterns.mood_direction : 'Insufficient data',
          stress_direction: pMoods.length >= 2 ? patterns.stress_direction : 'Insufficient data',
          energy_direction: pMoods.length >= 2 ? patterns.energy_direction : 'Insufficient data',
          symptom_trend: symptomTrend,
          overall_trend: pMoods.length >= 2 ? patterns.trend : 'Insufficient data',
          trend_signals: trendSignals,
          has_recent_checkin: hasRecentCheckin,
          is_active: isActive,
        };
      }).filter(Boolean);

      allRecentActivity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sendJson(res, 200, {
        total_connected_patients: connectedPatients.length,
        active_patients: activeCount,
        patients_with_recent_checkins: recentCheckinsCount,
        upcoming_sessions: 0,
        recent_activity: allRecentActivity.slice(0, 15),
        patients: connectedPatients,
      });
    }

    // 3. Therapist Individual Patient Detailed Report (Therapist only, with strict relationship authorization)
    if (pathname.startsWith('/api/therapist/reports/') && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Insufficient permissions" });
      }

      const idPart = pathname.slice('/api/therapist/reports/'.length);
      const patientId = parseInt(idPart, 10);
      if (isNaN(patientId)) {
        return sendJson(res, 400, { detail: "Invalid patient ID" });
      }

      const patient = findUserById(patientId);
      if (!patient || patient.role !== 'patient') {
        return sendJson(res, 404, { detail: "Patient not found" });
      }

      // CRITICAL SECURITY ENFORCEMENT: Therapist can access ONLY patients with an accepted relationship
      if (!hasActiveRelationship(patientId, user.id)) {
        return sendJson(res, 403, {
          detail: "Access denied. You do not have an active accepted relationship with this patient.",
        });
      }

      const daysParam = parsedUrl.searchParams.get('days');
      const days = daysParam ? parseInt(daysParam, 10) : 30;
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const db = getDb();
      const allPatientMoods = db.moodEntries.filter(m => m.patient_id === patientId);
      const filteredMoods = allPatientMoods
        .filter(m => new Date(m.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const allPatientSymptoms = db.symptomEntries.filter(s => s.patient_id === patientId);
      const filteredSymptoms = allPatientSymptoms
        .filter(s => new Date(s.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const patientAssessments = db.assessments
        .filter(a => a.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const dataForAnalysis = filteredMoods.length >= 2 ? filteredMoods : allPatientMoods;
      const patterns = analyzePatterns(dataForAnalysis, filteredSymptoms, patientAssessments);
      const symptomTrend = calculateSymptomTrend(filteredSymptoms.length > 0 ? filteredSymptoms : allPatientSymptoms);
      const trendSignals = calculateTrendSignals(
        filteredMoods.length >= 3 ? filteredMoods : allPatientMoods,
        filteredSymptoms.length >= 2 ? filteredSymptoms : allPatientSymptoms
      );
      const emotionalDist = calculateEmotionalDistribution(filteredMoods.length > 0 ? filteredMoods : allPatientMoods);

      const moodTrends = (filteredMoods.length > 0 ? filteredMoods : allPatientMoods).map(m => ({
        id: m.id,
        date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full_date: new Date(m.created_at).toISOString().slice(0, 10),
        created_at: m.created_at,
        mood_score: m.mood_score,
        stress_level: m.stress_level,
        energy_level: m.energy_level,
        emotional_state: m.emotional_state,
        notes: m.notes,
      }));

      const symptomSeverityData = (filteredSymptoms.length > 0 ? filteredSymptoms : allPatientSymptoms).map(s => ({
        id: s.id,
        date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        full_date: new Date(s.created_at).toISOString().slice(0, 10),
        name: s.symptom_name,
        severity: s.severity,
        notes: s.notes,
      }));

      const recentCheckins = [...allPatientMoods]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);

      let aiResult = null;
      try {
        aiResult = await generateAIAnalysis(dataForAnalysis, filteredSymptoms, patientAssessments);
      } catch {
        aiResult = patterns;
      }

      const relationship = findRelationship(patientId, user.id);
      const hasSufficient = filteredMoods.length >= 2;

      return sendJson(res, 200, {
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          created_at: patient.created_at,
          connected_at: relationship ? (relationship.updated_at || relationship.created_at) : null,
          status: relationship ? relationship.status : null,
        },
        filter_days: days,
        total_checkins: allPatientMoods.length,
        filtered_checkins: filteredMoods.length,
        has_sufficient_data: hasSufficient,
        message: hasSufficient ? null : "Not enough historical data to calculate a meaningful trend.",
        average_mood: patterns.average_mood,
        average_stress: patterns.average_stress,
        average_energy: patterns.average_energy,
        mood_direction: hasSufficient ? patterns.mood_direction : 'Insufficient data',
        stress_direction: hasSufficient ? patterns.stress_direction : 'Insufficient data',
        energy_direction: hasSufficient ? patterns.energy_direction : 'Insufficient data',
        symptom_trend: symptomTrend,
        ai_wellbeing_trend: hasSufficient ? (aiResult?.trend || patterns.trend) : 'Insufficient data',
        ai_progress_summary: aiResult?.summary || patterns.summary,
        trend_signals: trendSignals,
        mood_trends: moodTrends,
        symptom_history: filteredSymptoms,
        symptom_severity_over_time: symptomSeverityData,
        frequent_symptoms: patterns.frequent_symptoms || [],
        emotional_state_distribution: emotionalDist,
        assessment_history: patientAssessments,
        latest_assessment: patientAssessments[0] || null,
        recent_checkins: recentCheckins,
        recommendations: aiResult?.recommendations || patterns.recommendations || [],
        key_patterns: aiResult?.key_patterns || patterns.key_patterns || [],
        safety_disclaimer: "AI insights are for informational and wellness purposes only and are not a medical diagnosis.",
      });
    }

    // ==========================================
    // THERAPY SESSIONS API ENDPOINTS (Phase 9A)
    // ==========================================

    // 1. Patient requests session
    if ((pathname === '/api/sessions/request' || pathname === '/api/sessions') && req.method === 'POST') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Only patients can request therapy sessions." });
      }

      const body = await parseJsonBody(req);
      const therapistId = parseInt(body.therapist_id, 10);
      if (!therapistId || isNaN(therapistId)) {
        return sendJson(res, 400, { detail: "A valid therapist ID is required." });
      }

      const therapist = findUserById(therapistId);
      if (!therapist || therapist.role !== 'therapist') {
        return sendJson(res, 404, { detail: "Therapist not found." });
      }

      // CRITICAL AUTHORIZATION: Patient can only request sessions with ACCEPTED connected therapists
      if (!hasActiveRelationship(user.id, therapistId)) {
        return sendJson(res, 403, {
          detail: "You can only request sessions with your connected therapist.",
        });
      }

      if (!body.scheduled_at) {
        return sendJson(res, 400, { detail: "Scheduled date and time are required." });
      }

      const scheduledDate = new Date(body.scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return sendJson(res, 400, { detail: "Invalid scheduled date and time format." });
      }

      const duration = body.duration ? parseInt(body.duration, 10) : 50;
      const sessionType = body.session_type === 'IN_PERSON' ? 'IN_PERSON' : 'VIRTUAL';

      const newSession = createTherapySession({
        patient_id: user.id,
        therapist_id: therapistId,
        scheduled_at: scheduledDate.toISOString(),
        duration,
        session_type: sessionType,
        status: 'REQUESTED',
        meeting_link: sessionType === 'VIRTUAL' ? (body.meeting_link || null) : null,
        patient_notes: body.patient_notes || null,
      });

      return sendJson(res, 201, {
        message: "Session request sent.",
        session: formatSessionForPatient(newSession),
      });
    }

    // 2. Patient: list own sessions
    if (pathname === '/api/patient/sessions' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Only patients can view their sessions." });
      }

      const statusFilter = parsedUrl.searchParams.get('status');
      let sessions = getTherapySessions().filter(s => s.patient_id === user.id);

      if (statusFilter === 'upcoming') {
        sessions = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'REQUESTED');
        sessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      } else if (statusFilter === 'completed') {
        sessions = sessions.filter(s => s.status === 'COMPLETED');
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      } else if (statusFilter === 'cancelled') {
        sessions = sessions.filter(s => s.status === 'CANCELLED' || s.status === 'REJECTED');
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      } else {
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      }

      return sendJson(res, 200, sessions.map(formatSessionForPatient));
    }

    // 3. Therapist: list sessions for connected patients
    if (pathname === '/api/therapist/sessions' && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can view their practice sessions." });
      }

      const statusFilter = parsedUrl.searchParams.get('status');
      const patientIdParam = parsedUrl.searchParams.get('patient_id');

      let sessions = getTherapySessions().filter(s => s.therapist_id === user.id);

      if (patientIdParam) {
        const pId = parseInt(patientIdParam, 10);
        sessions = sessions.filter(s => s.patient_id === pId);
      }

      // STRICT AUTHORIZATION: Therapist can ONLY view sessions of connected patients
      sessions = sessions.filter(s => hasActiveRelationship(s.patient_id, user.id));

      if (statusFilter === 'requested') {
        sessions = sessions.filter(s => s.status === 'REQUESTED');
        sessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      } else if (statusFilter === 'upcoming') {
        sessions = sessions.filter(s => s.status === 'SCHEDULED');
        sessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      } else if (statusFilter === 'completed') {
        sessions = sessions.filter(s => s.status === 'COMPLETED');
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      } else if (statusFilter === 'cancelled') {
        sessions = sessions.filter(s => s.status === 'CANCELLED' || s.status === 'REJECTED');
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      } else {
        sessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      }

      return sendJson(res, 200, sessions.map(formatSessionForTherapist));
    }

    // 4. Session Details by ID
    const singleSessionMatch = pathname.match(/^\/api\/sessions\/(\d+)$/);
    if (singleSessionMatch && req.method === 'GET') {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }

      const sessionId = parseInt(singleSessionMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (user.role === 'patient') {
        if (session.patient_id !== user.id) {
          return sendJson(res, 403, { detail: "Access denied. You can only view your own sessions." });
        }
        return sendJson(res, 200, formatSessionForPatient(session));
      } else if (user.role === 'therapist') {
        if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
          return sendJson(res, 403, { detail: "Access denied. You can only view sessions for your connected patients." });
        }
        return sendJson(res, 200, formatSessionForTherapist(session));
      } else {
        return sendJson(res, 403, { detail: "Unauthorized." });
      }
    }

    // 5. Accept Session (Therapist only)
    const acceptMatch = pathname.match(/^\/api\/sessions\/(\d+)\/accept$/);
    if (acceptMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can accept session requests." });
      }

      const sessionId = parseInt(acceptMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      const updates = { status: 'SCHEDULED' };

      if (body.meeting_link !== undefined) {
        updates.meeting_link = body.meeting_link ? String(body.meeting_link).trim() : null;
      }
      if (body.duration) {
        updates.duration = parseInt(body.duration, 10);
      }
      if (body.scheduled_at) {
        updates.scheduled_at = body.scheduled_at;
      }

      const updated = updateTherapySession(sessionId, updates);
      return sendJson(res, 200, {
        message: "Session accepted and scheduled.",
        session: formatSessionForTherapist(updated),
      });
    }

    // 6. Reject Session (Therapist only)
    const rejectMatch = pathname.match(/^\/api\/sessions\/(\d+)\/reject$/);
    if (rejectMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can reject session requests." });
      }

      const sessionId = parseInt(rejectMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const updated = updateTherapySession(sessionId, { status: 'REJECTED' });
      return sendJson(res, 200, {
        message: "Session request rejected.",
        session: formatSessionForTherapist(updated),
      });
    }

    // 7. Reschedule Session (Therapist or Patient)
    const rescheduleMatch = pathname.match(/^\/api\/sessions\/(\d+)\/reschedule$/);
    if (rescheduleMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }

      const sessionId = parseInt(rescheduleMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      const isPatient = user.role === 'patient' && session.patient_id === user.id;
      const isTherapist = user.role === 'therapist' && session.therapist_id === user.id && hasActiveRelationship(session.patient_id, user.id);

      if (!isPatient && !isTherapist) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      if (!body.scheduled_at) {
        return sendJson(res, 400, { detail: "New scheduled date and time is required." });
      }

      const newDate = new Date(body.scheduled_at);
      if (isNaN(newDate.getTime())) {
        return sendJson(res, 400, { detail: "Invalid date format." });
      }

      const updates = { scheduled_at: newDate.toISOString() };
      if (user.role === 'therapist' && session.status === 'REQUESTED') {
        updates.status = 'SCHEDULED';
      }

      const updated = updateTherapySession(sessionId, updates);
      return sendJson(res, 200, {
        message: "Session rescheduled successfully.",
        session: user.role === 'patient' ? formatSessionForPatient(updated) : formatSessionForTherapist(updated),
      });
    }

    // 8. Cancel Session (Therapist or Patient)
    const cancelMatch = pathname.match(/^\/api\/sessions\/(\d+)\/cancel$/);
    if (cancelMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }

      const sessionId = parseInt(cancelMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      const isPatient = user.role === 'patient' && session.patient_id === user.id;
      const isTherapist = user.role === 'therapist' && session.therapist_id === user.id && hasActiveRelationship(session.patient_id, user.id);

      if (!isPatient && !isTherapist) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const updated = updateTherapySession(sessionId, { status: 'CANCELLED' });
      return sendJson(res, 200, {
        message: "Session cancelled.",
        session: user.role === 'patient' ? formatSessionForPatient(updated) : formatSessionForTherapist(updated),
      });
    }

    // 9. Complete Session (Therapist only)
    const completeMatch = pathname.match(/^\/api\/sessions\/(\d+)\/complete$/);
    if (completeMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can mark sessions as completed." });
      }

      const sessionId = parseInt(completeMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      const updates = { status: 'COMPLETED' };
      if (body.session_summary !== undefined) updates.session_summary = body.session_summary;
      if (body.therapist_notes !== undefined) updates.therapist_notes = body.therapist_notes;
      if (body.progress_observation !== undefined) updates.progress_observation = body.progress_observation;
      if (body.follow_up_date !== undefined) updates.follow_up_date = body.follow_up_date;

      const updated = updateTherapySession(sessionId, updates);
      return sendJson(res, 200, {
        message: "Session marked as completed.",
        session: formatSessionForTherapist(updated),
      });
    }

    // 10. Update Session Summary (Therapist only, Patient-visible)
    const summaryMatch = pathname.match(/^\/api\/sessions\/(\d+)\/summary$/);
    if (summaryMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can record session summaries." });
      }

      const sessionId = parseInt(summaryMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      const updated = updateTherapySession(sessionId, {
        session_summary: body.session_summary !== undefined ? body.session_summary : session.session_summary,
      });

      return sendJson(res, 200, {
        message: "Session summary saved.",
        session: formatSessionForTherapist(updated),
      });
    }

    // 11. Update Therapist Private Notes (Therapist only)
    const therapistNotesMatch = pathname.match(/^\/api\/sessions\/(\d+)\/therapist-notes$/);
    if (therapistNotesMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'therapist') {
        return sendJson(res, 403, { detail: "Only therapists can manage clinical notes." });
      }

      const sessionId = parseInt(therapistNotesMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      const updates = {};
      if (body.therapist_notes !== undefined) updates.therapist_notes = body.therapist_notes;
      if (body.progress_observation !== undefined) updates.progress_observation = body.progress_observation;
      if (body.follow_up_date !== undefined) updates.follow_up_date = body.follow_up_date;

      const updated = updateTherapySession(sessionId, updates);
      return sendJson(res, 200, {
        message: "Clinical notes updated.",
        session: formatSessionForTherapist(updated),
      });
    }

    // 12. Update Patient Notes (Patient only)
    const patientNotesMatch = pathname.match(/^\/api\/sessions\/(\d+)\/patient-notes$/);
    if (patientNotesMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }
      if (user.role !== 'patient') {
        return sendJson(res, 403, { detail: "Only patients can edit patient notes." });
      }

      const sessionId = parseInt(patientNotesMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      if (session.patient_id !== user.id) {
        return sendJson(res, 403, { detail: "Access denied." });
      }

      const body = await parseJsonBody(req);
      const updated = updateTherapySession(sessionId, {
        patient_notes: body.patient_notes !== undefined ? body.patient_notes : session.patient_notes,
      });

      return sendJson(res, 200, {
        message: "Patient notes saved.",
        session: formatSessionForPatient(updated),
      });
    }

    // 13. General Session Update
    const generalSessionMatch = pathname.match(/^\/api\/sessions\/(\d+)$/);
    if (generalSessionMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
      const user = getAuthUser(req);
      if (!user) {
        return sendJson(res, 401, { detail: "Could not validate credentials" });
      }

      const sessionId = parseInt(generalSessionMatch[1], 10);
      const session = findTherapySessionById(sessionId);
      if (!session) {
        return sendJson(res, 404, { detail: "Session not found." });
      }

      const body = await parseJsonBody(req);
      const updates = {};

      if (user.role === 'patient') {
        if (session.patient_id !== user.id) {
          return sendJson(res, 403, { detail: "Access denied." });
        }
        if (body.patient_notes !== undefined) updates.patient_notes = body.patient_notes;
        const updated = updateTherapySession(sessionId, updates);
        return sendJson(res, 200, formatSessionForPatient(updated));
      } else if (user.role === 'therapist') {
        if (session.therapist_id !== user.id || !hasActiveRelationship(session.patient_id, user.id)) {
          return sendJson(res, 403, { detail: "Access denied." });
        }
        if (body.meeting_link !== undefined) updates.meeting_link = body.meeting_link;
        if (body.duration !== undefined) updates.duration = body.duration;
        if (body.status !== undefined) updates.status = body.status;
        if (body.session_summary !== undefined) updates.session_summary = body.session_summary;
        if (body.therapist_notes !== undefined) updates.therapist_notes = body.therapist_notes;
        if (body.progress_observation !== undefined) updates.progress_observation = body.progress_observation;
        if (body.follow_up_date !== undefined) updates.follow_up_date = body.follow_up_date;
        const updated = updateTherapySession(sessionId, updates);
        return sendJson(res, 200, formatSessionForTherapist(updated));
      } else {
        return sendJson(res, 403, { detail: "Unauthorized." });
      }
    }

    // Not an API route -> pass to next middleware
    next();
  };
}
