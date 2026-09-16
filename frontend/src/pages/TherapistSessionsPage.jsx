import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function TherapistSessionsPage() {
  const [sessions, setSessions] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'requested', 'upcoming', 'completed', 'cancelled'

  // Modal / Action states
  const [selectedSession, setSelectedSession] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [acceptMeetingLink, setAcceptMeetingLink] = useState('')

  // Notes editing state inside details modal
  const [notesSummary, setNotesSummary] = useState('')
  const [notesTherapistPrivate, setNotesTherapistPrivate] = useState('')
  const [notesObservation, setNotesObservation] = useState('')
  const [notesFollowUpDate, setNotesFollowUpDate] = useState('')
  const [notesMeetingLink, setNotesMeetingLink] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [submittingAction, setSubmittingAction] = useState(false)

  const token = sessionStorage.getItem('access_token')

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [sessionsRes, patientsRes] = await Promise.all([
        fetch(`${API_URL}/api/therapist/sessions`, { headers }),
        fetch(`${API_URL}/api/therapist/patients`, { headers }),
      ])

      if (sessionsRes.ok) {
        const sList = await sessionsRes.json()
        setSessions(sList)
      } else {
        throw new Error('Unable to load this information. Please try again.')
      }

      if (patientsRes.ok) {
        const pList = await patientsRes.json()
        setPatients(pList)
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

  const openDetailsModal = (session) => {
    setSelectedSession(session)
    setNotesSummary(session.session_summary || '')
    setNotesTherapistPrivate(session.therapist_notes || '')
    setNotesObservation(session.progress_observation || '')
    setNotesFollowUpDate(session.follow_up_date || '')
    setNotesMeetingLink(session.meeting_link || '')
    setIsDetailsOpen(true)
  }

  const closeDetailsModal = () => {
    setIsDetailsOpen(false)
    setSelectedSession(null)
  }

  const handleSaveNotes = async () => {
    if (!selectedSession || !token) return
    setSavingNotes(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${selectedSession.id}/therapist-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          therapist_notes: notesTherapistPrivate,
          progress_observation: notesObservation,
          follow_up_date: notesFollowUpDate || null,
        }),
      })

      // Also save session summary & meeting link if modified
      await fetch(`${API_URL}/api/sessions/${selectedSession.id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_summary: notesSummary,
        }),
      })

      if (notesMeetingLink !== selectedSession.meeting_link) {
        await fetch(`${API_URL}/api/sessions/${selectedSession.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            meeting_link: notesMeetingLink || null,
          }),
        })
      }

      setSuccessMessage('Clinical notes and session summary saved successfully.')
      closeDetailsModal()
      await fetchData()
    } catch (err) {
      setError(err.message || 'Unable to save notes. Please try again.')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleAcceptClick = (session) => {
    setSelectedSession(session)
    setAcceptMeetingLink(session.meeting_link || 'https://meet.google.com/')
    setIsAcceptModalOpen(true)
  }

  const handleConfirmAccept = async () => {
    if (!selectedSession || !token) return
    setSubmittingAction(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${selectedSession.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          meeting_link: selectedSession.session_type === 'VIRTUAL' ? acceptMeetingLink : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to accept session request.')

      setSuccessMessage('Session accepted and scheduled.')
      setIsAcceptModalOpen(false)
      setSelectedSession(null)
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to accept session.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleReject = async (sessionId) => {
    if (!token) return
    setSubmittingAction(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to reject session.')

      setSuccessMessage('Session request has been rejected.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to reject session.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const openRescheduleModal = (session) => {
    setSelectedSession(session)
    const existingDate = new Date(session.scheduled_at)
    const yyyy = existingDate.getFullYear()
    const mm = String(existingDate.getMonth() + 1).padStart(2, '0')
    const dd = String(existingDate.getDate()).padStart(2, '0')
    const hh = String(existingDate.getHours()).padStart(2, '0')
    const min = String(existingDate.getMinutes()).padStart(2, '0')
    setRescheduleDate(`${yyyy}-${mm}-${dd}`)
    setRescheduleTime(`${hh}:${min}`)
    setIsRescheduleOpen(true)
  }

  const handleConfirmReschedule = async () => {
    if (!selectedSession || !token || !rescheduleDate || !rescheduleTime) return
    setSubmittingAction(true)
    setError(null)
    try {
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
      const res = await fetch(`${API_URL}/api/sessions/${selectedSession.id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scheduled_at: scheduledAt }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to reschedule session.')

      setSuccessMessage('Session has been rescheduled successfully.')
      setIsRescheduleOpen(false)
      setSelectedSession(null)
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to reschedule session.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleCancel = async (sessionId) => {
    if (!token) return
    setSubmittingAction(true)
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
      if (!res.ok) throw new Error(data.detail || 'Failed to cancel session.')

      setSuccessMessage('Session has been cancelled.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to cancel session.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleMarkCompleted = async (session) => {
    if (!token) return
    setSubmittingAction(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${session.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_summary: session.session_summary || 'Session completed. Patient participated actively.',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to complete session.')

      setSuccessMessage('Session marked as completed.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to mark session as completed.')
    } finally {
      setSubmittingAction(false)
    }
  }

  // Filtered lists
  const requestedSessions = sessions.filter((s) => s.status === 'REQUESTED')
  const upcomingSessions = sessions
    .filter((s) => s.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
  const historySessions = sessions
    .filter((s) => s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'REJECTED')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))

  let displayedSessions = sessions
  if (activeTab === 'requested') displayedSessions = requestedSessions
  else if (activeTab === 'upcoming') displayedSessions = upcomingSessions
  else if (activeTab === 'completed') displayedSessions = sessions.filter((s) => s.status === 'COMPLETED')
  else if (activeTab === 'cancelled') displayedSessions = sessions.filter((s) => s.status === 'CANCELLED' || s.status === 'REJECTED')

  return (
    <div className="therapy-sessions-container">
      <section className="hero">
        <p className="eyebrow">Clinical Practice</p>
        <h1>Therapy Sessions & Notes</h1>
        <p>
          Review appointment requests from connected patients, conduct scheduled telehealth sessions,
          and maintain secure private clinical progress notes.
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

      {/* Filter Tabs */}
      <div className="filter-tabs" style={{ marginBottom: 24 }}>
        <button
          id="tab-all-sessions"
          className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Sessions ({sessions.length})
        </button>
        <button
          id="tab-requested-sessions"
          className={`filter-tab ${activeTab === 'requested' ? 'active' : ''}`}
          onClick={() => setActiveTab('requested')}
        >
          Requests ({requestedSessions.length})
        </button>
        <button
          id="tab-upcoming-sessions"
          className={`filter-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({upcomingSessions.length})
        </button>
        <button
          id="tab-completed-sessions"
          className={`filter-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({sessions.filter((s) => s.status === 'COMPLETED').length})
        </button>
        <button
          id="tab-cancelled-sessions"
          className={`filter-tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled / Rejected ({sessions.filter((s) => s.status === 'CANCELLED' || s.status === 'REJECTED').length})
        </button>
      </div>

      {loading ? (
        <section className="panel">
          <div style={{ padding: '36px 0', textAlign: 'center', color: '#638183' }}>
            Loading...
          </div>
        </section>
      ) : (
        <>
          {/* Incoming Session Requests Section */}
          {(activeTab === 'all' || activeTab === 'requested') && (
            <section className="panel" style={{ marginBottom: 24, borderLeft: requestedSessions.length > 0 ? '4px solid #c88a20' : '1px solid #e1ebea' }}>
              <div className="panel-heading">
                <div>
                  <h2>Incoming Session Requests</h2>
                  <p>Pending appointment requests submitted by your connected patients.</p>
                </div>
                {requestedSessions.length > 0 && (
                  <span className="status-pill status-pending">{requestedSessions.length} Action Needed</span>
                )}
              </div>

              {requestedSessions.length === 0 ? (
                <EmptyState
                  title="No pending session requests"
                  message="When connected patients request therapy appointments, they will appear here for your review."
                />
              ) : (
                <div className="card-grid">
                  {requestedSessions.map((session) => (
                    <article key={session.id} className="patient-card" style={{ background: '#fffcf7' }}>
                      <div className="patient-header">
                        <div>
                          <h3 className="patient-name">{session.patient?.name || 'Patient'}</h3>
                          <p className="patient-email">{session.patient?.email}</p>
                        </div>
                        <span className="status-pill status-pending">Requested</span>
                      </div>

                      <div style={{ background: '#fdf8ee', padding: 12, borderRadius: 8, fontSize: '0.88rem', color: '#4d3a1a', display: 'grid', gap: 4 }}>
                        <div>
                          <strong>Requested Date:</strong>{' '}
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
                          {session.session_type === 'VIRTUAL' ? '💻 Virtual Telehealth' : '🏢 In-Person Consultation'}
                        </div>
                        {session.patient_notes && (
                          <div style={{ marginTop: 4, fontStyle: 'italic', borderTop: '1px solid #e8dec8', paddingTop: 6 }}>
                            &ldquo;{session.patient_notes}&rdquo;
                          </div>
                        )}
                      </div>

                      <div className="patient-footer" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <button
                          id={`accept-session-${session.id}`}
                          className="primary-button compact-button"
                          disabled={submittingAction}
                          onClick={() => handleAcceptClick(session)}
                        >
                          Accept
                        </button>
                        <button
                          id={`reschedule-session-${session.id}`}
                          className="secondary-button compact-button"
                          disabled={submittingAction}
                          onClick={() => openRescheduleModal(session)}
                        >
                          Reschedule
                        </button>
                        <button
                          id={`reject-session-${session.id}`}
                          className="delete-btn"
                          disabled={submittingAction}
                          onClick={() => handleReject(session.id)}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Upcoming Sessions Section */}
          {(activeTab === 'all' || activeTab === 'upcoming') && (
            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div>
                  <h2>Upcoming Scheduled Sessions</h2>
                  <p>Confirmed consultations with your active patients.</p>
                </div>
                <span className="status-pill status-accepted">{upcomingSessions.length} Confirmed</span>
              </div>

              {upcomingSessions.length === 0 ? (
                <EmptyState
                  title="No therapy sessions scheduled."
                  message="Upcoming appointments will be listed here once accepted."
                />
              ) : (
                <div className="card-grid">
                  {upcomingSessions.map((session) => (
                    <article key={session.id} className="patient-card" style={{ background: '#f8fcfa' }}>
                      <div className="patient-header">
                        <div>
                          <h3 className="patient-name">{session.patient?.name || 'Patient'}</h3>
                          <p className="patient-email">{session.patient?.email}</p>
                        </div>
                        <span className="status-pill status-accepted">Scheduled</span>
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
                          {session.session_type === 'VIRTUAL' ? '💻 Virtual Session' : '🏢 In-Person'}
                        </div>
                      </div>

                      {/* Virtual session link */}
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

                      <div className="patient-footer" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <button
                          id={`notes-session-${session.id}`}
                          className="primary-button compact-button"
                          onClick={() => openDetailsModal(session)}
                        >
                          Notes & Details
                        </button>
                        <button
                          id={`complete-session-${session.id}`}
                          className="secondary-button compact-button"
                          disabled={submittingAction}
                          onClick={() => handleMarkCompleted(session)}
                        >
                          Complete
                        </button>
                        <button
                          className="secondary-button compact-button"
                          disabled={submittingAction}
                          onClick={() => openRescheduleModal(session)}
                        >
                          Reschedule
                        </button>
                        <button
                          className="delete-btn"
                          disabled={submittingAction}
                          onClick={() => handleCancel(session.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Session History Section */}
          {(activeTab === 'all' || activeTab === 'completed' || activeTab === 'cancelled') && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Session History</h2>
                  <p>Archived record of completed, rejected, and cancelled sessions.</p>
                </div>
              </div>

              {historySessions.length === 0 ? (
                <EmptyState
                  title="No past session history"
                  message="Completed and past sessions will be cataloged here."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Participant</th>
                        <th>Format</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Session Summary</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySessions.map((s) => (
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
                            <strong>{s.patient?.name || 'Patient'}</strong>
                            <div style={{ fontSize: '0.78rem', color: '#688486' }}>{s.patient?.email}</div>
                          </td>
                          <td>{s.session_type === 'VIRTUAL' ? 'Virtual' : 'In-Person'}</td>
                          <td>{s.duration} min</td>
                          <td>
                            <span
                              className={`status-pill ${
                                s.status === 'COMPLETED'
                                  ? 'status-accepted'
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
                              id={`view-history-${s.id}`}
                              className="secondary-button compact-button"
                              onClick={() => openDetailsModal(s)}
                            >
                              View / Edit Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Accept Session Modal */}
      {isAcceptModalOpen && selectedSession && (
        <div className="modal-backdrop" style={modalBackdropStyle}>
          <div className="modal-dialog" style={modalDialogStyle}>
            <div className="panel-heading" style={{ marginBottom: 14 }}>
              <div>
                <h2>Accept Session Request</h2>
                <p>Confirm appointment with {selectedSession.patient?.name}.</p>
              </div>
              <button className="text-button" onClick={() => setIsAcceptModalOpen(false)}>✕</button>
            </div>

            <div style={{ marginBottom: 16, background: '#f5faf9', padding: 14, borderRadius: 10, fontSize: '0.9rem', color: '#254a4c' }}>
              <div><strong>Scheduled:</strong> {new Date(selectedSession.scheduled_at).toLocaleString()}</div>
              <div><strong>Format:</strong> {selectedSession.session_type}</div>
              <div><strong>Duration:</strong> {selectedSession.duration} min</div>
            </div>

            {selectedSession.session_type === 'VIRTUAL' && (
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label htmlFor="accept-meeting-link">Virtual Meeting Link (Google Meet, Zoom, etc.)</label>
                <input
                  id="accept-meeting-link"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={acceptMeetingLink}
                  onChange={(e) => setAcceptMeetingLink(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="secondary-button compact-button"
                onClick={() => setIsAcceptModalOpen(false)}
              >
                Cancel
              </button>
              <button
                id="confirm-accept-btn"
                className="primary-button compact-button"
                disabled={submittingAction}
                onClick={handleConfirmAccept}
              >
                {submittingAction ? 'Confirming...' : 'Confirm & Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {isRescheduleOpen && selectedSession && (
        <div className="modal-backdrop" style={modalBackdropStyle}>
          <div className="modal-dialog" style={modalDialogStyle}>
            <div className="panel-heading" style={{ marginBottom: 14 }}>
              <div>
                <h2>Reschedule Session</h2>
                <p>Select a new appointment date and time for {selectedSession.patient?.name}.</p>
              </div>
              <button className="text-button" onClick={() => setIsRescheduleOpen(false)}>✕</button>
            </div>

            <div className="form-field">
              <label htmlFor="reschedule-date">New Date</label>
              <input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="reschedule-time">New Time</label>
              <input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="secondary-button compact-button"
                onClick={() => setIsRescheduleOpen(false)}
              >
                Cancel
              </button>
              <button
                id="confirm-reschedule-btn"
                className="primary-button compact-button"
                disabled={submittingAction || !rescheduleDate || !rescheduleTime}
                onClick={handleConfirmReschedule}
              >
                {submittingAction ? 'Rescheduling...' : 'Save New Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Details & Clinical Notes Modal */}
      {isDetailsOpen && selectedSession && (
        <div className="modal-backdrop" style={modalBackdropStyle}>
          <div className="modal-dialog" style={{ ...modalDialogStyle, maxWidth: 680 }}>
            <div className="panel-heading" style={{ marginBottom: 12 }}>
              <div>
                <h2>Session Details & Clinical Notes</h2>
                <p>Participant: {selectedSession.patient?.name} ({selectedSession.patient?.email})</p>
              </div>
              <button className="text-button" onClick={closeDetailsModal}>✕</button>
            </div>

            {/* Overview Metadata Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: '#f5faf9', padding: 14, borderRadius: 10, marginBottom: 18, fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Date</span>
                <strong>{new Date(selectedSession.scheduled_at).toLocaleDateString()}</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Time</span>
                <strong>{new Date(selectedSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Duration</span>
                <strong>{selectedSession.duration} mins</strong>
              </div>
              <div>
                <span style={{ color: '#688587', display: 'block' }}>Status</span>
                <span className={`status-pill ${selectedSession.status === 'COMPLETED' ? 'status-accepted' : 'status-pending'}`}>
                  {selectedSession.status}
                </span>
              </div>
            </div>

            {/* Virtual Session Link */}
            {selectedSession.session_type === 'VIRTUAL' && (
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label htmlFor="notes-meeting-link">Virtual Meeting Link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="notes-meeting-link"
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={notesMeetingLink}
                    onChange={(e) => setNotesMeetingLink(e.target.value)}
                  />
                  {notesMeetingLink && (
                    <a
                      href={notesMeetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="secondary-button compact-button"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >
                      Open Link
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Patient In-Session Notes (Read-only for therapist) */}
            {selectedSession.patient_notes && (
              <div style={{ background: '#f9fcfb', border: '1px solid #dbeae8', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 800, color: '#087b70' }}>
                  Patient Topics & Questions
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#2d5053', lineHeight: 1.5 }}>
                  {selectedSession.patient_notes}
                </p>
              </div>
            )}

            {/* Patient-Visible Session Summary */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label htmlFor="notes-summary">
                Session Summary <span style={{ fontWeight: 400, color: '#087b70', fontSize: '0.8rem' }}>(Visible to Patient)</span>
              </label>
              <textarea
                id="notes-summary"
                className="form-textarea"
                rows={3}
                placeholder="High-level takeaways, discussions, and guidance shared with the patient..."
                value={notesSummary}
                onChange={(e) => setNotesSummary(e.target.value)}
              />
            </div>

            {/* Progress Observation */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label htmlFor="notes-observation">Clinical Progress Observation</label>
              <textarea
                id="notes-observation"
                className="form-textarea"
                rows={2}
                placeholder="Clinical observations regarding affect, thought processes, coping responses..."
                value={notesObservation}
                onChange={(e) => setNotesObservation(e.target.value)}
              />
            </div>

            {/* Follow-Up Date */}
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label htmlFor="notes-followup">Recommended Follow-up Date</label>
              <input
                id="notes-followup"
                type="date"
                value={notesFollowUpDate}
                onChange={(e) => setNotesFollowUpDate(e.target.value)}
              />
            </div>

            {/* Therapist Private Notes - Strictly Confidential */}
            <div className="form-field" style={{ marginBottom: 18, borderTop: '2px dashed #e1ebea', paddingTop: 14 }}>
              <label htmlFor="notes-private" style={{ color: '#8a2b1f', display: 'flex', alignItems: 'center', gap: 6 }}>
                🔒 Private Therapist Notes <span style={{ fontWeight: 400, fontSize: '0.8rem' }}>(Strictly Confidential — NOT visible to patient)</span>
              </label>
              <textarea
                id="notes-private"
                className="form-textarea"
                rows={3}
                style={{ borderColor: '#eec9c3', background: '#fffcfb' }}
                placeholder="Private diagnostic impressions, clinical formulations, supervision notes..."
                value={notesTherapistPrivate}
                onChange={(e) => setNotesTherapistPrivate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
              {selectedSession.status !== 'COMPLETED' ? (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  disabled={submittingAction}
                  onClick={() => {
                    handleMarkCompleted(selectedSession)
                    closeDetailsModal()
                  }}
                >
                  ✓ Mark Session as Completed
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={closeDetailsModal}
                >
                  Close
                </button>
                <button
                  id="save-clinical-notes-btn"
                  type="button"
                  className="primary-button compact-button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
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
