import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function PatientTherapyPage() {
  const [therapists, setTherapists] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const token = sessionStorage.getItem('access_token')

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [therapistsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/therapists`, { headers }),
        fetch(`${API_URL}/api/therapists/requests`, { headers }),
      ])

      if (therapistsRes.ok) {
        const tList = await therapistsRes.json()
        setTherapists(tList)
      } else {
        throw new Error('Failed to load therapists list')
      }

      if (requestsRes.ok) {
        const rList = await requestsRes.json()
        setRequests(rList)
      } else {
        throw new Error('Failed to load connection requests')
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to care services.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

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
      // Refresh requests
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to send request.')
    } finally {
      setSubmitting(false)
    }
  }

  // Identify connected therapists (ACCEPTED) and pending requests
  const acceptedRequests = requests.filter((r) => r.status === 'ACCEPTED')
  const pendingRequests = requests.filter((r) => r.status === 'PENDING')
  const otherRequests = requests.filter((r) => r.status !== 'ACCEPTED' && r.status !== 'PENDING')

  const connectedTherapistIds = new Set(acceptedRequests.map((r) => r.therapist_id))
  const pendingTherapistIds = new Set(pendingRequests.map((r) => r.therapist_id))

  return (
    <div className="therapy-page-container">
      <section className="hero">
        <p className="eyebrow">Professional Care</p>
        <h1>Therapy & Care Team</h1>
        <p>
          Connect with licensed mental health practitioners who can review your wellbeing history,
          provide professional guidance, and support your ongoing progress.
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

      {/* Connected Therapist Section */}
      {acceptedRequests.length > 0 && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div>
              <h2>Your Connected Therapist</h2>
              <p>Active care provider connected to your health records.</p>
            </div>
            <span className="status-pill status-accepted">Connected</span>
          </div>

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

                <div className="patient-footer">
                  <span>
                    Connected on{' '}
                    {new Date(req.updated_at || req.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Pending / Active Requests Status */}
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

      {/* Available Therapists Directory */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Available Practitioners</h2>
            <p>Select a licensed professional to initiate care coordination.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#678688' }}>
            Loading available practitioners...
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
    </div>
  )
}
