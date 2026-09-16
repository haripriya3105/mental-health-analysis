import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent file location in /app/applet/data/mental_health_db.json
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'mental_health_db.json');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

function createInitialSeedData() {
  const demoPatient = {
    id: 1,
    name: 'Alex Morgan',
    email: 'demo@patient.com',
    password_hash: hashPassword('password123'),
    role: 'patient',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const demoTherapist = {
    id: 2,
    name: 'Dr. Sarah Jenkins',
    email: 'demo@therapist.com',
    password_hash: hashPassword('password123'),
    role: 'therapist',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const pastDays = [10, 8, 6, 4, 3, 1, 0];
  const sampleMoods = [
    { mood: 6, stress: 7, energy: 5, state: 'Anxious', notes: 'Busy week at work, feeling some tension.' },
    { mood: 5, stress: 8, energy: 4, state: 'Tired', notes: 'Did not sleep well last night.' },
    { mood: 7, stress: 5, energy: 6, state: 'Calm', notes: 'Took an evening walk, helped reset.' },
    { mood: 7, stress: 6, energy: 7, state: 'Neutral', notes: 'Focused on routine and hydration.' },
    { mood: 8, stress: 4, energy: 7, state: 'Calm', notes: 'Had a restful weekend.' },
    { mood: 8, stress: 3, energy: 8, state: 'Happy', notes: 'Connected with a good friend.' },
    { mood: 7, stress: 4, energy: 7, state: 'Calm', notes: 'Morning check-in: feeling grounded and ready.' },
  ];

  const moodEntries = pastDays.map((daysAgo, idx) => {
    const m = sampleMoods[idx] || sampleMoods[0];
    return {
      id: idx + 1,
      patient_id: demoPatient.id,
      mood_score: m.mood,
      stress_level: m.stress,
      energy_level: m.energy,
      emotional_state: m.state,
      notes: m.notes,
      created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  const symptomEntries = [
    {
      id: 1,
      patient_id: demoPatient.id,
      symptom_name: 'Fatigue',
      severity: 6,
      notes: 'Afternoon tiredness despite having coffee.',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      patient_id: demoPatient.id,
      symptom_name: 'Muscle tension in neck & shoulders',
      severity: 5,
      notes: 'Noticed while working at desk.',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const assessments = [
    {
      id: 1,
      patient_id: demoPatient.id,
      total_score: 9,
      result_category: 'MILD CONCERN',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      patient_id: demoPatient.id,
      total_score: 5,
      result_category: 'LOWER CONCERN',
      created_at: new Date().toISOString(),
    },
  ];

  const demoSessions = [
    {
      id: 1,
      patient_id: demoPatient.id,
      therapist_id: demoTherapist.id,
      scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
      duration: 50,
      session_type: 'VIRTUAL',
      status: 'SCHEDULED',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
      patient_notes: 'Follow up on cognitive reframing and coping strategies for work stress.',
      therapist_notes: 'Check progress on thought record exercises. Review sleep hygiene.',
      session_summary: null,
      progress_observation: 'Patient has maintained consistent daily check-ins.',
      follow_up_date: null,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      patient_id: demoPatient.id,
      therapist_id: demoTherapist.id,
      scheduled_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 50,
      session_type: 'VIRTUAL',
      status: 'COMPLETED',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
      patient_notes: 'Intake and goal-setting session.',
      therapist_notes: 'Patient was responsive and articulated specific goals regarding stress management.',
      session_summary: 'Reviewed baseline assessments. Established goals for stress management and daily mindfulness routines.',
      progress_observation: 'Good baseline awareness of stressors.',
      follow_up_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const demoNotifications = [
    {
      id: 1,
      user_id: demoPatient.id,
      type: 'SESSION_SCHEDULED',
      title: 'Upcoming Therapy Session',
      message: `You have an upcoming session with ${demoTherapist.name}.`,
      read: false,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      related_id: 1,
      related_type: 'session',
    },
    {
      id: 2,
      user_id: demoPatient.id,
      type: 'REPORT_AVAILABLE',
      title: 'New Progress Report Available',
      message: 'Your latest wellbeing trend report is ready to view.',
      read: true,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      related_id: null,
      related_type: 'report',
    },
    {
      id: 3,
      user_id: demoTherapist.id,
      type: 'SESSION_REMINDER',
      title: 'Upcoming Session Reminder',
      message: `Upcoming session with ${demoPatient.name} on your schedule.`,
      read: false,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      related_id: 1,
      related_type: 'session',
    },
  ];

  return {
    users: [demoPatient, demoTherapist],
    assessments,
    assessmentAnswers: [],
    moodEntries,
    symptomEntries,
    therapistRelationships: [],
    therapySessions: demoSessions,
    notifications: demoNotifications,
    counters: {
      nextUserId: 3,
      nextAssessmentId: 3,
      nextMoodId: moodEntries.length + 1,
      nextSymptomId: symptomEntries.length + 1,
      nextRelationshipId: 1,
      nextSessionId: 3,
      nextNotificationId: 4,
    },
  };
}

let dbMemoryCache = null;

function saveDbToDisk(data) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const tempFile = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

export function getDb() {
  if (dbMemoryCache) {
    return dbMemoryCache;
  }

  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      // Validate core collections exist
      if (Array.isArray(parsed.users) && parsed.counters) {
        if (!Array.isArray(parsed.therapistRelationships)) {
          parsed.therapistRelationships = [];
        }
        if (!parsed.counters.nextRelationshipId) {
          parsed.counters.nextRelationshipId = 1;
        }
        if (!Array.isArray(parsed.therapySessions)) {
          parsed.therapySessions = [
            {
              id: 1,
              patient_id: 1,
              therapist_id: 2,
              scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
              duration: 50,
              session_type: 'VIRTUAL',
              status: 'SCHEDULED',
              meeting_link: 'https://meet.google.com/abc-defg-hij',
              patient_notes: 'Follow up on cognitive reframing and coping strategies for work stress.',
              therapist_notes: 'Check progress on thought record exercises. Review sleep hygiene.',
              session_summary: null,
              progress_observation: 'Patient has maintained consistent daily check-ins.',
              follow_up_date: null,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: 2,
              patient_id: 1,
              therapist_id: 2,
              scheduled_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
              duration: 50,
              session_type: 'VIRTUAL',
              status: 'COMPLETED',
              meeting_link: 'https://meet.google.com/abc-defg-hij',
              patient_notes: 'Intake and goal-setting session.',
              therapist_notes: 'Patient was responsive and articulated specific goals regarding stress management.',
              session_summary: 'Reviewed baseline assessments. Established goals for stress management and daily mindfulness routines.',
              progress_observation: 'Good baseline awareness of stressors.',
              follow_up_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ];
        }
        if (!parsed.counters.nextSessionId) {
          parsed.counters.nextSessionId = (parsed.therapySessions.length || 0) + 1;
        }
        if (!Array.isArray(parsed.notifications) || parsed.notifications.length === 0) {
          parsed.notifications = [
            {
              id: 1,
              user_id: 1,
              type: 'SESSION_SCHEDULED',
              title: 'Upcoming Therapy Session',
              message: 'You have an upcoming session with Dr. Sarah Jenkins.',
              read: false,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              related_id: 1,
              related_type: 'session',
            },
            {
              id: 2,
              user_id: 1,
              type: 'REPORT_AVAILABLE',
              title: 'New Progress Report Available',
              message: 'Your latest wellbeing trend report is ready to view.',
              read: true,
              created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              related_id: null,
              related_type: 'report',
            },
            {
              id: 3,
              user_id: 2,
              type: 'SESSION_REMINDER',
              title: 'Upcoming Session Reminder',
              message: 'Upcoming session with Alex Morgan on your schedule.',
              read: false,
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              related_id: 1,
              related_type: 'session',
            },
          ];
        }
        if (!parsed.counters.nextNotificationId || parsed.counters.nextNotificationId <= 3) {
          parsed.counters.nextNotificationId = (parsed.notifications.length || 0) + 1;
        }
        dbMemoryCache = parsed;
        return dbMemoryCache;
      }
    }
  } catch (err) {
    console.error('Failed to read existing database file, will initialize seed:', err);
  }

  // First-time setup only: seed demo data and write to disk
  dbMemoryCache = createInitialSeedData();
  saveDbToDisk(dbMemoryCache);
  return dbMemoryCache;
}

export function persistDb() {
  if (dbMemoryCache) {
    saveDbToDisk(dbMemoryCache);
  }
}

// Helper methods for users
export function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  const db = getDb();
  return db.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

export function findUserById(id) {
  if (!id) return null;
  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(numId)) return null;
  const db = getDb();
  return db.users.find(u => u.id === numId) || null;
}

export function createUser({ name, email, password, role }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const db = getDb();

  if (db.users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('USER_EXISTS');
  }

  const newUser = {
    id: db.counters.nextUserId++,
    name: String(name).trim(),
    email: cleanEmail,
    password_hash: hashPassword(password),
    role,
    created_at: new Date().toISOString(),
  };

  db.users.push(newUser);
  persistDb();
  return newUser;
}

// Helper methods for therapist-patient relationships
export function getRelationships() {
  const db = getDb();
  return db.therapistRelationships || [];
}

export function findRelationshipById(id) {
  const db = getDb();
  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(numId)) return null;
  return (db.therapistRelationships || []).find(r => r.id === numId) || null;
}

export function findRelationship(patientId, therapistId) {
  const db = getDb();
  const pId = typeof patientId === 'number' ? patientId : parseInt(patientId, 10);
  const tId = typeof therapistId === 'number' ? therapistId : parseInt(therapistId, 10);
  return (db.therapistRelationships || []).find(
    r => r.patient_id === pId && r.therapist_id === tId
  ) || null;
}

export function hasActiveRelationship(patientId, therapistId) {
  const rel = findRelationship(patientId, therapistId);
  return !!(rel && rel.status === 'ACCEPTED');
}

export function createRelationship({ patient_id, therapist_id, status = 'PENDING' }) {
  const db = getDb();
  const pId = typeof patient_id === 'number' ? patient_id : parseInt(patient_id, 10);
  const tId = typeof therapist_id === 'number' ? therapist_id : parseInt(therapist_id, 10);

  const existing = findRelationship(pId, tId);
  if (existing) {
    if (existing.status === 'PENDING') {
      throw new Error('REQUEST_ALREADY_PENDING');
    }
    if (existing.status === 'ACCEPTED') {
      throw new Error('ALREADY_CONNECTED');
    }
    // If was REJECTED or INACTIVE, reactivate
    existing.status = status;
    existing.updated_at = new Date().toISOString();
    persistDb();
    return existing;
  }

  const newRel = {
    id: db.counters.nextRelationshipId++,
    patient_id: pId,
    therapist_id: tId,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!Array.isArray(db.therapistRelationships)) {
    db.therapistRelationships = [];
  }
  db.therapistRelationships.push(newRel);
  persistDb();
  return newRel;
}

export function updateRelationshipStatus(id, newStatus) {
  const rel = findRelationshipById(id);
  if (!rel) return null;
  rel.status = newStatus;
  rel.updated_at = new Date().toISOString();
  persistDb();
  return rel;
}

// Helper methods for Therapy Sessions
export function getTherapySessions() {
  const db = getDb();
  return db.therapySessions || [];
}

export function findTherapySessionById(id) {
  const db = getDb();
  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(numId)) return null;
  return (db.therapySessions || []).find(s => s.id === numId) || null;
}

export function createTherapySession({
  patient_id,
  therapist_id,
  scheduled_at,
  duration = 50,
  session_type = 'VIRTUAL',
  status = 'REQUESTED',
  meeting_link = null,
  patient_notes = null,
  therapist_notes = null,
  session_summary = null,
  progress_observation = null,
  follow_up_date = null,
}) {
  const db = getDb();
  if (!Array.isArray(db.therapySessions)) {
    db.therapySessions = [];
  }
  if (!db.counters.nextSessionId) {
    db.counters.nextSessionId = 1;
  }

  const pId = typeof patient_id === 'number' ? patient_id : parseInt(patient_id, 10);
  const tId = typeof therapist_id === 'number' ? therapist_id : parseInt(therapist_id, 10);

  const newSession = {
    id: db.counters.nextSessionId++,
    patient_id: pId,
    therapist_id: tId,
    scheduled_at: new Date(scheduled_at).toISOString(),
    duration: typeof duration === 'number' ? duration : (parseInt(duration, 10) || 50),
    session_type: session_type === 'IN_PERSON' ? 'IN_PERSON' : 'VIRTUAL',
    status: status || 'REQUESTED',
    meeting_link: meeting_link ? String(meeting_link).trim() : null,
    patient_notes: patient_notes ? String(patient_notes).trim() : null,
    therapist_notes: therapist_notes ? String(therapist_notes).trim() : null,
    session_summary: session_summary ? String(session_summary).trim() : null,
    progress_observation: progress_observation ? String(progress_observation).trim() : null,
    follow_up_date: follow_up_date ? String(follow_up_date).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.therapySessions.push(newSession);
  persistDb();
  return newSession;
}

export function updateTherapySession(id, updates) {
  const session = findTherapySessionById(id);
  if (!session) return null;

  const allowedFields = [
    'scheduled_at',
    'duration',
    'session_type',
    'status',
    'meeting_link',
    'patient_notes',
    'therapist_notes',
    'session_summary',
    'progress_observation',
    'follow_up_date',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'scheduled_at') {
        session.scheduled_at = new Date(updates.scheduled_at).toISOString();
      } else if (field === 'duration') {
        session.duration = parseInt(updates.duration, 10) || session.duration;
      } else {
        session[field] = updates[field];
      }
    }
  }

  session.updated_at = new Date().toISOString();
  persistDb();
  return session;
}

// Helper methods for notifications
export function getNotifications() {
  const db = getDb();
  return db.notifications || [];
}

export function findNotificationById(id) {
  if (!id) return null;
  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(numId)) return null;
  const db = getDb();
  return (db.notifications || []).find(n => n.id === numId) || null;
}

export function getUserNotifications(userId) {
  if (!userId) return [];
  const numId = typeof userId === 'number' ? userId : parseInt(userId, 10);
  const db = getDb();
  return (db.notifications || [])
    .filter(n => n.user_id === numId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createNotification({
  user_id,
  type,
  title,
  message,
  related_id = null,
  related_type = null,
}) {
  if (!user_id || !type || !title || !message) {
    throw new Error('user_id, type, title, and message are required for a notification');
  }

  const db = getDb();
  if (!Array.isArray(db.notifications)) {
    db.notifications = [];
  }
  if (!db.counters.nextNotificationId) {
    db.counters.nextNotificationId = (db.notifications.length || 0) + 1;
  }

  const newNotif = {
    id: db.counters.nextNotificationId++,
    user_id: typeof user_id === 'number' ? user_id : parseInt(user_id, 10),
    type: String(type).trim().toUpperCase(),
    title: String(title).trim(),
    message: String(message).trim(),
    read: false,
    created_at: new Date().toISOString(),
    related_id: related_id !== undefined && related_id !== null ? Number(related_id) : null,
    related_type: related_type ? String(related_type).trim() : null,
  };

  db.notifications.push(newNotif);
  persistDb();
  return newNotif;
}

export function markNotificationAsRead(id, userId) {
  const notif = findNotificationById(id);
  if (!notif) return null;
  if (userId !== undefined && userId !== null) {
    const numUserId = typeof userId === 'number' ? userId : parseInt(userId, 10);
    if (notif.user_id !== numUserId) {
      return null; // Not owned by this user
    }
  }

  notif.read = true;
  persistDb();
  return notif;
}

export function markAllNotificationsAsRead(userId) {
  if (!userId) return 0;
  const numUserId = typeof userId === 'number' ? userId : parseInt(userId, 10);
  const db = getDb();
  let updatedCount = 0;

  for (const n of db.notifications || []) {
    if (n.user_id === numUserId && !n.read) {
      n.read = true;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    persistDb();
  }
  return updatedCount;
}

export function hasDuplicateNotification({ user_id, type, related_id = null, withinHours = 24 }) {
  const db = getDb();
  const numUserId = typeof user_id === 'number' ? user_id : parseInt(user_id, 10);
  const cutoff = Date.now() - (withinHours * 60 * 60 * 1000);

  return (db.notifications || []).some(n => {
    if (n.user_id !== numUserId || n.type !== type) return false;
    if (related_id !== null && n.related_id !== Number(related_id)) return false;
    return new Date(n.created_at).getTime() >= cutoff;
  });
}


