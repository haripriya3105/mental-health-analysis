import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function PatientTherapyPage() {
  const [therapists, setTherapists] = useState([])
  const [requests, setRequests] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Request Session form state
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [selectedTherapistId, setSelectedTherapistId] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(50)
  const [sessionType, setSessionType] = useState('VIRTUAL') // 'VIRTUAL' | 'IN_PERSON'
  const [sessionNotes, setSessionNotes] = useState('')
  const [submittingSession, setSubmittingSession] = useState(false)

  // History / Filter tabs
  const [historyTab, setHistoryTab] = useState('upcoming') // 'upcoming', 'all', 'completed', 'cancelled'

  // Details Modal state
  const [selectedSession, setSelectedSession] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [patientNoteEdit, setPatientNoteEdit] = useState('')
  const [savingPatientNotes, setSavingPatientNotes] = useState(false)

  const token = sessionStorage.getItem('access_token')

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [therapistsRes, requestsRes, sessionsRes] = await Promise.all([
        fetch(`${API_URL}/api/therapists`, { headers }),
        fetch(`${API_URL}/api/therapists/requests`, { headers }),
        fetch(`${API_URL}/api/patient/sessions`, { headers }),
      ])

      if (therapistsRes.ok) {
        const tList = await therapistsRes.json()
        setTherapists(tList)
      } else {
        throw new Error('Unable to load this information. Please try again.')
      }

      if (requestsRes.ok) {
        const rList = await requestsRes.json()
        setRequests(rList)
      } else {
        throw new Error('Unable to load this information. Please try again.')
      }

      if (sessionsRes.ok) {
        const sList = await sessionsRes.json()
        setSessions(sList)
      } else {
        throw new Error('Unable to load this information. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Unable to load this information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const acceptedRequests = requests.filter((r) => r.status === 'ACCEPTED')
  const pendingRequests = requests.filter((r) => r.status === 'PENDING')
  const otherRequests = requests.filter((r) => r.status !== 'ACCEPTED' && r.status !== 'PENDING')

  const connectedTherapistIds = new Set(acceptedRequests.map((r) => r.therapist_id))
  const pendingTherapistIds = new Set(pendingRequests.map((r) => r.therapist_id))

  // Set default selected therapist when accepted requests change
  useEffect(() => {
    if (acceptedRequests.length > 0 && !selectedTherapistId) {
      setSelectedTherapistId(String(acceptedRequests[0].therapist_id))
    }
  }, [acceptedRequests, selectedTherapistId])

  const handleSendRequest = async (therapistId) => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`${API_URL}/api/therapists/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ therapist_id: therapistId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send connection request')
      }

      setSuccessMessage('Connection request sent successfully to your chosen therapist.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to send request.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestSessionSubmit = async (e) => {
    e.preventDefault()
    if (!token) return
    if (!selectedTherapistId) {
      setError('Please select a connected therapist.')
      return
    }
    if (!sessionDate || !sessionTime) {
      setError('Please choose both a date and time for your session.')
      return
    }

    setSubmittingSession(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const scheduledAt = new Date(`${sessionDate}T${sessionTime}`).toISOString()
      const res = await fetch(`${API_URL}/api/sessions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          therapist_id: parseInt(selectedTherapistId, 10),
          scheduled_at: scheduledAt,
          duration: parseInt(sessionDuration, 10),
          session_type: sessionType,
          patient_notes: sessionNotes || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to request therapy session.')
      }

      setSuccessMessage('Session request sent.')
      setShowRequestForm(false)
      setSessionNotes('')
      setSessionDate('')
      setSessionTime('')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to request session.')
    } finally {
      setSubmittingSession(false)
    }
  }

  const handleCancelSession = async (sessionId) => {
    if (!token) return
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to cancel session.')
      }

      setSuccessMessage('Session has been cancelled.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to cancel session.')
    }
  }

  const openDetailsModal = (session) => {
    setSelectedSession(session)
    setPatientNoteEdit(session.patient_notes || '')
    setIsDetailsOpen(true)
  }

  const closeDetailsModal = () => {
    setIsDetailsOpen(false)
    setSelectedSession(null)
  }

  const handleSavePatientNotes = async () => {
    if (!selectedSession || !token) return
    setSavingPatientNotes(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${selectedSession.id}/patient-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_notes: patientNoteEdit,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save notes.')
      }

      setSuccessMessage('Your personal session notes have been saved.')
      setSelectedSession(data.session)
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to save notes.')
    } finally {
      setSavingPatientNotes(false)
    }
  }

  // Session filtering
  const upcomingSessions = sessions
    .filter((s) => s.status === 'SCHEDULED' || s.status === 'REQUESTED')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))

  const completedSessions = sessions
    .filter((s) => s.status === 'COMPLETED')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))

  const cancelledSessions = sessions
    .filter((s) => s.status === 'CANCELLED' || s.status === 'REJECTED')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))

  let filteredHistory = sessions
  if (historyTab === 'upcoming') filteredHistory = upcomingSessions
  else if (historyTab === 'completed') filteredHistory = completedSessions
  else if (historyTab === 'cancelled') filteredHistory = cancelledSessions

  // Min date for scheduling (today)
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="therapy-page-container">
      <section className="hero">
        <p className="eyebrow">Professional Care</p>
        <h1>Therapy & Care Team</h1>
        <p>
          Connect with licensed mental health practitioners, book virtual or in-person therapy sessions,
          and coordinate your personalized wellness plan.
        </p>
      </section>

      {error && (
        <div className="error" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-banner" style={{ marginBottom: 18 }}>
          <span>✓ {successMessage}</span>
          <button
            className="text-button"
            style={{ fontWeight: 700, margin: 0, padding: 0 }}
            onClick={() => setSuccessMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Connected Therapist Section */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Your Connected Therapist</h2>
            <p>Active care provider connected to your health records.</p>
          </div>
          {acceptedRequests.length > 0 && (
            <span className="status-pill status-accepted">Connected</span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#688587' }}>
            Loading...
          </div>
        ) : acceptedRequests.length === 0 ? (
          <EmptyState
            title="No connected therapist yet."
            message="Connect with an available practitioner below to schedule appointments and share your wellbeing progress."
          />
        ) : (
          <div className="card-grid">
            {acceptedRequests.map((req) => (
              <article key={req.id} className="patient-card" style={{ background: '#f8fcfa' }}>
                <div className="patient-header">
                  <div>
                    <h3 className="patient-name">{req.therapist?.name || 'Licensed Therapist'}</h3>
                    <p className="patient-email">{req.therapist?.email}</p>
                  </div>
                  <span className="status-pill status-accepted">Active Care</span>
                </div>

                <p style={{ color: '#456a6c', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                  This therapist has secure access to review your daily mood check-ins, physical
                  symptom entries, and completed wellness assessments.
                </p>

                <div className="patient-footer" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <span>
                    Connected on{' '}
                    {new Date(req.updated_at || req.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <button
                    id="open-request-session-btn"
                    className="primary-button compact-button"
                    onClick={() => {
                      setSelectedTherapistId(String(req.therapist_id))
                      setShowRequestForm(true)
                    }}
                  >
                    Request Session
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 2. Request Session Form / Section */}
      {acceptedRequests.length > 0 && showRequestForm && (
        <section className="panel" style={{ marginBottom: 24, border: '2px solid #a8e1d9', background: '#fafdfd' }}>
          <div className="panel-heading">
            <div>
              <h2>Request a Therapy Session</h2>
              <p>Choose your preferred appointment schedule and consultation format.</p>
            </div>
            <button
              className="text-button"
              style={{ fontWeight: 700 }}
              onClick={() => setShowRequestForm(false)}
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleRequestSessionSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {/* Therapist selection */}
              <div className="form-field">
                <label htmlFor="therapist-select">Therapist</label>
                <select
                  id="therapist-select"
                  value={selectedTherapistId}
                  onChange={(e) => setSelectedTherapistId(e.target.value)}
                  required
                >
                  {acceptedRequests.map((r) => (
                    <option key={r.therapist_id} value={r.therapist_id}>
                      {r.therapist?.name} ({r.therapist?.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="form-field">
                <label htmlFor="session-date-input">Appointment Date</label>
                <input
                  id="session-date-input"
                  type="date"
                  min={todayStr}
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </div>

              {/* Time */}
              <div className="form-field">
                <label htmlFor="session-time-input">Time</label>
                <input
                  id="session-time-input"
                  type="time"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  required
                />
              </div>

              {/* Format */}
              <div className="form-field">
                <label htmlFor="session-type-select">Session Format</label>
                <select
                  id="session-type-select"
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                >
                  <option value="VIRTUAL">💻 Virtual Telehealth (Video/Audio)</option>
                  <option value="IN_PERSON">🏢 In-Person Consultation</option>
                </select>
              </div>

              {/* Duration */}
              <div className="form-field">
                <label htmlFor="session-duration-select">Duration</label>
                <select
                  id="session-duration-select"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                >
                  <option value={30}>30 minutes</option>
                  <option value={50}>50 minutes (Standard)</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="form-field" style={{ marginTop: 14 }}>
              <label htmlFor="session-notes-input">Reason or Notes for Session (Optional)</label>
              <textarea
                id="session-notes-input"
                className="form-textarea"
                rows={3}
                placeholder="What topics, feelings, or questions would you like to explore during this session?"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setShowRequestForm(false)}
              >
                Cancel
              </button>
              <button
                id="request-session-submit-btn"
                type="submit"
                className="primary-button compact-button"
                disabled={submittingSession}
              >
                {submittingSession ? 'Sending Request...' : 'Request Session'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Upcoming Sessions */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Upcoming Sessions</h2>
            <p>Your confirmed and requested therapy consultations.</p>
          </div>
          {acceptedRequests.length > 0 && !showRequestForm && (
            <button
              id="new-session-button"
              className="primary-button compact-button"
              onClick={() => setShowRequestForm(true)}
            >
              + Request Session
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#688587' }}>
            Loading...
          </div>
        ) : upcomingSessions.length === 0 ? (
          <EmptyState
            title="No therapy sessions scheduled."
            message="You have no upcoming therapy sessions booked at this time."
          />
        ) : (
          <div className="card-grid">
            {upcomingSessions.map((session) => (
              <article key={session.id} className="patient-card" style={{ background: '#f8fcfa' }}>
                <div className="patient-header">
                  <div>
                    <h3 className="patient-name">{session.therapist?.name || 'Therapist'}</h3>
                    <p className="patient-email">{session.therapist?.email}</p>
                  </div>
                  <span
                    className={`status-pill ${
                      session.status === 'SCHEDULED' ? 'status-accepted' : 'status-pending'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>

                <div style={{ background: '#edf7f4', padding: 12, borderRadius: 8, fontSize: '0.88rem', color: '#164c45', display: 'grid', gap: 4 }}>
                  <div>
                    <strong>Date:</strong>{' '}
                    {new Date(session.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div>
                    <strong>Time:</strong>{' '}
                    {new Date(session.scheduled_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                  <div>
                    <strong>Duration:</strong> {session.duration} minutes
                  </div>
                  <div>
                    <strong>Format:</strong>{' '}
                    {session.session_type === 'VIRTUAL' ? '💻 Virtual Telehealth' : '🏢 In-Person'}
                  </div>
                </div>

                {/* Virtual session join link */}
                <div style={{ margin: '4px 0' }}>
                  {session.session_type === 'VIRTUAL' ? (
                    session.meeting_link ? (
                      <a
                        id={`join-session-${session.id}`}
                        href={session.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="primary-button compact-button"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                      >
                        🎥 Join Session
                      </a>
                    ) : (
                      <span style={{ color: '#688486', fontSize: '0.86rem', fontStyle: 'italic' }}>
                        Meeting link not configured.
                      </span>
                    )
                  ) : (
                    <span style={{ color: '#48696b', fontSize: '0.86rem' }}>📍 Clinic Consultation Room</span>
                  )}
                </div>

                <div className="patient-footer" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button
                    id={`view-session-${session.id}`}
                    className="secondary-button compact-button"
                    onClick={() => openDetailsModal(session)}
                  >
                    View Details
                  </button>
                  <button
                    id={`cancel-session-${session.id}`}
                    className="delete-btn"
                    onClick={() => handleCancelSession(session.id)}
                  >
                    Cancel Session
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 4. Session History */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Session History</h2>
            <p>Past sessions, clinical summaries, and previous appointments.</p>
          </div>
        </div>

        {/* History Filter Tabs */}
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          <button
            id="tab-history-upcoming"
            className={`filter-tab ${historyTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setHistoryTab('upcoming')}
          >
            Upcoming ({upcomingSessions.length})
          </button>
          <button
            id="tab-history-completed"
            className={`filter-tab ${historyTab === 'completed' ? 'active' : ''}`}
            onClick={() => setHistoryTab('completed')}
          >
            Completed ({completedSessions.length})
          </button>
          <button
            id="tab-history-cancelled"
            className={`filter-tab ${historyTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setHistoryTab('cancelled')}
          >
            Cancelled ({cancelledSessions.length})
          </button>
          <button
            id="tab-history-all"
            className={`filter-tab ${historyTab === 'all' ? 'active' : ''}`}
            onClick={() => setHistoryTab('all')}
          >
            All Sessions ({sessions.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#688587' }}>
            Loading...
          </div>
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            title="No sessions found"
            message="No therapy sessions match the chosen filter."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Participant</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Session Summary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>
                        {new Date(s.scheduled_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#688486' }}>
                        {new Date(s.scheduled_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td>
                      <strong>{s.therapist?.name || 'Therapist'}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#688486' }}>{s.therapist?.email}</div>
                    </td>
                    <td>{s.session_type === 'VIRTUAL' ? 'Virtual' : 'In-Person'}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          s.status === 'COMPLETED'
                            ? 'status-accepted'
                            : s.status === 'SCHEDULED'
                            ? 'status-accepted'
                            : s.status === 'REQUESTED'
                            ? 'status-pending'
                            : s.status === 'REJECTED'
                            ? 'status-rejected'
                            : 'status-inactive'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <span style={{ fontSize: '0.85rem', color: '#395759', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.session_summary || <em style={{ color: '#88a1a3' }}>No summary recorded</em>}
                      </span>
                    </td>
                    <td>
                      <button
                        id={`view-details-${s.id}`}
                        className="secondary-button compact-button"
                        onClick={() => openDetailsModal(s)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Pending Connection Requests */}
      {pendingRequests.length > 0 && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div>
              <h2>Pending Connection Requests</h2>
              <p>Requests currently awaiting review by the therapist.</p>
            </div>
            <span className="status-pill status-pending">Awaiting Review</span>
          </div>

          <div className="card-grid">
            {pendingRequests.map((req) => (
              <article key={req.id} className="patient-card">
                <div className="patient-header">
                  <div>
                    <h3 className="patient-name">{req.therapist?.name || 'Therapist'}</h3>
                    <p className="patient-email">{req.therapist?.email}</p>
                  </div>
                  <span className="status-pill status-pending">Pending</span>
                </div>
                <p style={{ color: '#688486', fontSize: '0.88rem', margin: 0 }}>
                  Your connection invitation was submitted on{' '}
                  <strong>
                    {new Date(req.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                  . You will be notified once the practitioner accepts your request.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 6. Available Practitioners Directory */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Available Practitioners</h2>
            <p>Select a licensed professional to initiate care coordination.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#678688' }}>
            Loading...
          </div>
        ) : therapists.length === 0 ? (
          <EmptyState
            title="No therapists currently listed"
            message="Check back soon as new practitioners join the network."
          />
        ) : (
          <div className="card-grid">
            {therapists.map((t) => {
              const isConnected = connectedTherapistIds.has(t.id)
              const isPending = pendingTherapistIds.has(t.id)

              return (
                <article key={t.id} className="patient-card">
                  <div className="patient-header">
                    <div>
                      <h3 className="patient-name">{t.name}</h3>
                      <p className="patient-email">{t.email}</p>
                    </div>
                    {isConnected ? (
                      <span className="status-pill status-accepted">Connected</span>
                    ) : isPending ? (
                      <span className="status-pill status-pending">Pending</span>
                    ) : (
                      <span className="status-pill status-inactive">Available</span>
                    )}
                  </div>

                  <p style={{ color: '#456a6c', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                    Clinical practice specialization: Mental wellbeing, mood stabilization,
                    stress management, and cognitive behavioral wellness.
                  </p>

                  <div className="patient-footer">
                    <span>Practitioner ID #{t.id}</span>
                    {isConnected ? (
                      <button
                        className="secondary-button"
                        disabled
                        style={{ cursor: 'default', opacity: 0.8 }}
                      >
                        ✓ Connected
                      </button>
                    ) : isPending ? (
                      <button
                        className="secondary-button"
                        disabled
                        style={{ cursor: 'default', opacity: 0.8 }}
                      >
                        Request Sent
                      </button>
                    ) : (
                      <button
                        id={`request-connect-${t.id}`}
                        className="primary-button compact-button"
                        disabled={submitting}
                        onClick={() => handleSendRequest(t.id)}
                      >
                        {submitting ? 'Connecting...' : 'Request Connection'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* 7. Past Requests */}
      {otherRequests.length > 0 && (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div>
              <h2>Past Requests</h2>
              <p>History of earlier connection requests.</p>
            </div>
          </div>
          <div className="history-list">
            {otherRequests.map((req) => (
              <article key={req.id}>
                <span>{new Date(req.updated_at || req.created_at).toLocaleDateString()}</span>
                <strong>{req.therapist?.name || 'Therapist'}</strong>
                <span
                  className={`status-pill ${
                    req.status === 'REJECTED' ? 'status-rejected' : 'status-inactive'
                  }`}
                >
                  {req.status}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 8. Session Details Modal */}
      {isDetailsOpen && selectedSession && (
        <div className="modal-backdrop" style={modalBackdropStyle}>
          <div className="modal-dialog" style={{ ...modalDialogStyle, maxWidth: 640 }}>
            <div className="panel-heading" style={{ marginBottom: 14 }}>
              <div>
                <h2>Session Details</h2>
                <p>Provider: {selectedSession.therapist?.name} ({selectedSession.therapist?.email})</p>
              </div>
              <button className="text-button" onClick={closeDetailsModal}>✕</button>
            </div>

            {/* Metadata Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, background: '#f5faf9', padding: 14, borderRadius: 10, marginBottom: 18, fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Date</span>
                <strong>{new Date(selectedSession.scheduled_at).toLocaleDateString()}</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Time</span>
                <strong>{new Date(selectedSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Format</span>
                <strong>{selectedSession.session_type === 'VIRTUAL' ? 'Virtual' : 'In-Person'}</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Status</span>
                <span className={`status-pill ${selectedSession.status === 'COMPLETED' ? 'status-accepted' : 'status-pending'}`}>
                  {selectedSession.status}
                </span>
              </div>
            </div>

            {/* Virtual Join Action */}
            {selectedSession.session_type === 'VIRTUAL' && (
              <div style={{ marginBottom: 16, padding: 14, background: '#f0f9f7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ color: '#087b70', display: 'block' }}>Telehealth Video Room</strong>
                  <span style={{ fontSize: '0.82rem', color: '#527274' }}>
                    {selectedSession.meeting_link ? 'Link configured and ready' : 'Meeting link not configured.'}
                  </span>
                </div>
                {selectedSession.meeting_link ? (
                  <a
                    href={selectedSession.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-button compact-button"
                    style={{ textDecoration: 'none' }}
                  >
                    Join Session
                  </a>
                ) : (
                  <span style={{ color: '#688486', fontSize: '0.86rem', fontStyle: 'italic' }}>
                    Meeting link not configured.
                  </span>
                )}
              </div>
            )}

            {/* Therapist Session Summary (Visible to Patient) */}
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#163e41' }}>Practitioner Session Summary</h3>
              <div style={{ background: '#fafdfd', border: '1px solid #dce9e8', borderRadius: 8, padding: 14, minHeight: 60, color: '#254b4d', fontSize: '0.92rem', lineHeight: 1.55 }}>
                {selectedSession.session_summary || (
                  <em style={{ color: '#7a9697' }}>Your therapist has not recorded a public session summary for this appointment yet.</em>
                )}
              </div>
            </div>

            {/* Patient Personal Notes (Editable by patient) */}
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label htmlFor="patient-session-notes">
                My Session Notes & Takeaways <span style={{ fontWeight: 400, color: '#557274', fontSize: '0.8rem' }}>(Personal to you)</span>
              </label>
              <textarea
                id="patient-session-notes"
                className="form-textarea"
                rows={3}
                placeholder="Record personal reflections, thoughts, or questions regarding this session..."
                value={patientNoteEdit}
                onChange={(e) => setPatientNoteEdit(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={closeDetailsModal}
              >
                Close
              </button>
              <button
                id="save-patient-notes-btn"
                type="button"
                className="primary-button compact-button"
                disabled={savingPatientNotes}
                onClick={handleSavePatientNotes}
              >
                {savingPatientNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalBackdropStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(18, 63, 67, 0.45)',
  backdropFilter: 'blur(3px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  padding: 16,
}

const modalDialogStyle = {
  background: '#ffffff',
  borderRadius: 16,
  padding: 24,
  width: '100%',
  maxWidth: 520,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(18, 63, 67, 0.2)',
  border: '1px solid #dcece8',
}
