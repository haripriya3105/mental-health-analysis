import crypto from 'node:crypto';
import { generateAIAnalysis } from './analysisService.js';
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

      return sendJson(res, 200, {
        total_connected_patients: connectedRels.length,
        pending_requests_count: pendingRels.length,
        pending_requests: pendingRequests,
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

    // Not an API route -> pass to next middleware
    next();
  };
}
