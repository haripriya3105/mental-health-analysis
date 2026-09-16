import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function TherapistPatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const token = sessionStorage.getItem('access_token')

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [patientsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/therapist/patients`, { headers }),
        fetch(`${API_URL}/api/therapists/requests`, { headers }),
      ])

      if (patientsRes.ok) {
        const pList = await patientsRes.json()
        setPatients(pList)
      } else {
        throw new Error('Failed to load connected patients')
      }

      if (requestsRes.ok) {
        const rList = await requestsRes.json()
        const pending = rList.filter((r) => r.status === 'PENDING')
        setPendingRequests(pending)
      }
    } catch (err) {
      setError(err.message || 'Error loading clinical records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRequestAction = async (requestId, action) => {
    if (!token) return
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`${API_URL}/api/therapists/requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `Failed to ${action} request`)
      }

      setSuccessMessage(
        action === 'accept'
          ? 'Patient connection accepted. You can now review their wellbeing progress.'
          : 'Patient connection request rejected.'
      )
      // Refresh directory and pending list
      await fetchData()
    } catch (err) {
      setError(err.message || `Failed to ${action} request`)
    } finally {
      setActionLoading(false)
    }
  }

  const filteredPatients = patients.filter((p) => {
    const q = searchTerm.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.latest_trend?.toLowerCase().includes(q)
    )
  })

  const getTrendClass = (trend) => {
    if (!trend) return 'trend-insufficient'
    const lower = trend.toLowerCase()
    if (lower.includes('improv')) return 'trend-improving'
    if (lower.includes('worsen')) return 'trend-worsening'
    if (lower.includes('stable')) return 'trend-stable'
    if (lower.includes('mixed')) return 'trend-mixed'
    return 'trend-insufficient'
  }

  return (
    <div className="therapist-patients-container">
      <section className="hero">
        <p className="eyebrow">Clinical Directory</p>
        <h1>My Patients</h1>
        <p>
          Review active patient profiles, track mental health indicators over time, and manage
          clinical connection requests.
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

      {/* Pending Connection Requests Panel */}
      {pendingRequests.length > 0 && (
        <section className="panel" style={{ marginBottom: 24, borderLeft: '4px solid #c88a20' }}>
          <div className="panel-heading">
            <div>
              <h2 style={{ color: '#82560b' }}>Pending Patient Connection Requests</h2>
              <p>These patients have requested care connection with your practice.</p>
            </div>
            <span className="status-pill status-pending">
              {pendingRequests.length} pending
            </span>
          </div>

          <div className="card-grid">
            {pendingRequests.map((req) => (
              <article key={req.id} className="patient-card">
                <div className="patient-header">
                  <div>
                    <h3 className="patient-name">{req.patient?.name || 'New Patient'}</h3>
                    <p className="patient-email">{req.patient?.email}</p>
                  </div>
                  <span className="status-pill status-pending">Pending</span>
                </div>
                <p style={{ color: '#688486', fontSize: '0.86rem', margin: 0 }}>
                  Requested on{' '}
                  {new Date(req.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <div className="action-btn-group" style={{ marginTop: 6 }}>
                  <button
                    className="btn-accept"
                    disabled={actionLoading}
                    onClick={() => handleRequestAction(req.id, 'accept')}
                  >
                    Accept Patient
                  </button>
                  <button
                    className="btn-reject"
                    disabled={actionLoading}
                    onClick={() => handleRequestAction(req.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Active Patients Directory Panel */}
      <section className="panel">
        <div className="panel-heading" style={{ flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2>Connected Patients ({patients.length})</h2>
            <p>Patients with verified clinical relationship agreements.</p>
          </div>
          {patients.length > 0 && (
            <div style={{ minWidth: 240, maxWidth: 360, width: '100%' }}>
              <input
                type="search"
                placeholder="Search by name, email, or trend..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '36px 0', textAlign: 'center', color: '#678688' }}>
            Loading patient directory...
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            title="No connected patients yet"
            message="When patients send connection requests and you accept them, their progress records and trends will appear here."
          />
        ) : filteredPatients.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#678688' }}>
            No patients match &quot;{searchTerm}&quot;.
          </div>
        ) : (
          <div className="card-grid">
            {filteredPatients.map((patient) => (
              <article key={patient.id} className="patient-card">
                <div className="patient-header">
                  <div>
                    <h3 className="patient-name">{patient.name}</h3>
                    <p className="patient-email">{patient.email}</p>
                  </div>
                  <span className="status-pill status-accepted">{patient.status}</span>
                </div>

                {/* Patient Averages Grid */}
                <div className="patient-stats-grid">
                  <div className="patient-stat-item">
                    <small>Avg Mood</small>
                    <strong>{patient.average_mood != null ? `${patient.average_mood}/10` : '—'}</strong>
                  </div>
                  <div className="patient-stat-item">
                    <small>Avg Stress</small>
                    <strong>{patient.average_stress != null ? `${patient.average_stress}/10` : '—'}</strong>
                  </div>
                  <div className="patient-stat-item">
                    <small>Avg Energy</small>
                    <strong>{patient.average_energy != null ? `${patient.average_energy}/10` : '—'}</strong>
                  </div>
                </div>

                {/* Additional Clinical Signals */}
                <div style={{ display: 'grid', gap: 6, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#577678' }}>
                    <span>Last Check-in:</span>
                    <strong>
                      {patient.last_checkin
                        ? `${new Date(patient.last_checkin.date).toLocaleDateString()} (${patient.last_checkin.emotional_state || 'Logged'})`
                        : 'No check-ins yet'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#577678' }}>
                    <span>Recent Symptoms:</span>
                    <strong>
                      {patient.recent_symptom
                        ? `${patient.recent_symptom.name} (Sev ${patient.recent_symptom.severity}/10)`
                        : 'None reported'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#577678' }}>
                    <span>AI Trend:</span>
                    <span className={`trend-pill ${getTrendClass(patient.latest_trend)}`}>
                      {patient.latest_trend}
                    </span>
                  </div>
                </div>

                <div className="patient-footer">
                  <span style={{ fontSize: '0.8rem' }}>
                    {patient.total_checkins} check-in{patient.total_checkins === 1 ? '' : 's'} recorded
                  </span>
                  <button
                    id={`btn-view-patient-${patient.id}`}
                    className="primary-button compact-button"
                    onClick={() => navigate(`/therapist/patients/${patient.id}`)}
                  >
                    View Progress →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
