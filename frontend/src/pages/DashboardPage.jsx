import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth/AuthContext.jsx'
import AppSidebar from '../components/AppSidebar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AssessmentPage from './AssessmentPage.jsx'
import MoodTrackerPage from './MoodTrackerPage.jsx'
import SymptomsPage from './SymptomsPage.jsx'
import AIInsightsPage from './AIInsightsPage.jsx'
import PatientTherapyPage from './PatientTherapyPage.jsx'
import TherapistPatientsPage from './TherapistPatientsPage.jsx'
import PatientProgressPage from './PatientProgressPage.jsx'

const patientActions = [
  'Daily Check-in',
  'Mental Health Assessment',
  'View AI Insights',
  'Write Journal',
  'View Recommendations',
]
const therapistActions = ['View Patients', 'View Reports', 'Add Recommendation', 'Add Therapy Note']
const API_URL = import.meta.env.VITE_API_URL || ''

function MetricCard({ id, label, value = '—', detail = 'No data yet' }) {
  return (
    <article id={id} className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  )
}

function PlaceholderChart({ title, message }) {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>History will appear here once data is available.</p>
        </div>
      </div>
      <div className="chart-empty">
        <div className="chart-grid" aria-hidden="true" />
        <EmptyState title="No trend data yet" message={message} />
      </div>
    </section>
  )
}

function QuickActions({ actions, onAssessment, onCheckIn, onInsights, onViewPatients }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Quick actions</h2>
          <p>Helpful tools for your daily routine and care.</p>
        </div>
      </div>
      <div className="action-grid">
        {actions.map((action) => {
          if (action === 'Daily Check-in') {
            return (
              <button
                id="action-daily-checkin"
                className="action-card enabled-action"
                key={action}
                onClick={onCheckIn}
              >
                <span className="action-icon" aria-hidden="true">
                  +
                </span>
                <span>{action}</span>
                <small>Available now</small>
              </button>
            )
          }
          if (action === 'Mental Health Assessment') {
            return (
              <button
                id="action-assessment"
                className="action-card enabled-action"
                key={action}
                onClick={onAssessment}
              >
                <span className="action-icon" aria-hidden="true">
                  +
                </span>
                <span>{action}</span>
                <small>Available now</small>
              </button>
            )
          }
          if (action === 'View AI Insights') {
            return (
              <button
                id="action-ai-insights"
                className="action-card enabled-action"
                key={action}
                onClick={onInsights}
              >
                <span className="action-icon" aria-hidden="true">
                  ✦
                </span>
                <span>{action}</span>
                <small>Available now</small>
              </button>
            )
          }
          if (action === 'View Patients') {
            return (
              <button
                id="action-view-patients"
                className="action-card enabled-action"
                key={action}
                onClick={onViewPatients}
              >
                <span className="action-icon" aria-hidden="true">
                  👥
                </span>
                <span>{action}</span>
                <small>Available now</small>
              </button>
            )
          }
          return (
            <button className="action-card" key={action} disabled>
              <span className="action-icon" aria-hidden="true">
                +
              </span>
              <span>{action}</span>
              <small>Coming soon</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [latestAssessment, setLatestAssessment] = useState(null)
  const [latestMood, setLatestMood] = useState(null)
  const [symptoms, setSymptoms] = useState([])
  const [moodTrends, setMoodTrends] = useState([])
  const [aiAnalysis, setAiAnalysis] = useState(null)

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (!token) return

    const headers = { Authorization: `Bearer ${token}` }

    // Fetch assessment history
    fetch(`${API_URL}/api/assessment/history`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => setLatestAssessment(items[0] || null))
      .catch(() => setLatestAssessment(null))

    // Fetch latest mood check-in
    fetch(`${API_URL}/api/mood/latest`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((item) => setLatestMood(item || null))
      .catch(() => setLatestMood(null))

    // Fetch symptoms history
    fetch(`${API_URL}/api/symptoms/history`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => setSymptoms(items || []))
      .catch(() => setSymptoms([]))

    // Fetch 7-day mood trends
    fetch(`${API_URL}/api/mood/trends?days=7`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => setMoodTrends(items || []))
      .catch(() => setMoodTrends([]))

    // Fetch AI pattern insights
    fetch(`${API_URL}/api/analysis`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAiAnalysis(data))
      .catch(() => setAiAnalysis(null))
  }, [])

  const isToday = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const today = new Date()
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    )
  }

  // Summary values
  const moodValue = latestMood ? `${latestMood.mood_score} / 10` : '—'
  const moodDetail = latestMood
    ? `${isToday(latestMood.created_at) ? 'Today' : 'Latest'}: ${latestMood.emotional_state}`
    : 'No check-in yet'

  const stressValue = latestMood ? `${latestMood.stress_level} / 10` : '—'
  const stressDetail = latestMood
    ? latestMood.stress_level > 6
      ? 'Elevated stress'
      : latestMood.stress_level > 3
        ? 'Moderate level'
        : 'Relaxed / Low'
    : 'No check-in yet'

  const energyValue = latestMood ? `${latestMood.energy_level} / 10` : '—'
  const energyDetail = latestMood
    ? latestMood.energy_level > 6
      ? 'High energy'
      : latestMood.energy_level > 3
        ? 'Steady energy'
        : 'Low energy'
    : 'No check-in yet'

  const symptomsValue = symptoms.length > 0 ? `${symptoms.length}` : '0'
  const symptomsDetail =
    symptoms.length > 0
      ? `Latest: ${symptoms[0].symptom_name} (${symptoms[0].severity}/10)`
      : 'No symptoms reported'

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Today’s space</p>
        <h1>Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p>
          Small check-ins can help you notice what you need today. Be gentle with yourself.
        </p>
      </section>

      {/* Summary Cards */}
      <section className="metric-grid">
        <MetricCard
          id="metric-card-mood"
          label="Today's Mood"
          value={moodValue}
          detail={moodDetail}
        />
        <MetricCard
          id="metric-card-stress"
          label="Stress Level"
          value={stressValue}
          detail={stressDetail}
        />
        <MetricCard
          id="metric-card-energy"
          label="Energy Level"
          value={energyValue}
          detail={energyDetail}
        />
        <MetricCard
          id="metric-card-symptoms"
          label="Tracked Symptoms"
          value={symptomsValue}
          detail={symptomsDetail}
        />
      </section>

      {/* AI Insights Card */}
      <section
        id="dashboard-ai-insights-card"
        className="assessment-summary panel"
        style={{
          background: '#f4faf8',
          borderColor: '#cfe6e2',
          borderLeft: '4px solid #087b70',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem' }}>✦</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#10393b' }}>AI Wellbeing Insights</h2>
            {aiAnalysis?.trend && (
              <span
                className={`trend-pill ${
                  aiAnalysis.trend.toLowerCase().includes('improving')
                    ? 'trend-improving'
                    : aiAnalysis.trend.toLowerCase().includes('worsening')
                    ? 'trend-worsening'
                    : aiAnalysis.trend.toLowerCase().includes('mixed')
                    ? 'trend-mixed'
                    : aiAnalysis.trend.toLowerCase().includes('insufficient')
                    ? 'trend-insufficient'
                    : 'trend-stable'
                }`}
                style={{ marginLeft: 4 }}
              >
                Trend: {aiAnalysis.trend}
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: '#335759', fontSize: '0.96rem', lineHeight: 1.5 }}>
            {aiAnalysis?.summary ||
              'Complete your daily check-ins to receive personalized AI pattern insights and wellness reflections.'}
          </p>
        </div>
        <button
          id="dashboard-view-insights-btn"
          className="primary-button compact-button"
          onClick={() => navigate('/patient/ai-insights')}
        >
          View AI Insights →
        </button>
      </section>

      {/* Assessment Summary */}
      <section className="assessment-summary panel">
        <div>
          <h2>Latest assessment</h2>
          <p>
            {latestAssessment
              ? `${latestAssessment.result_category} · Score ${latestAssessment.total_score} · ${new Date(latestAssessment.created_at).toLocaleDateString()}`
              : 'Complete your first assessment to begin tracking your wellness patterns.'}
          </p>
        </div>
        <button
          id="dashboard-take-assessment-btn"
          className="primary-button compact-button"
          onClick={() => navigate('/patient/assessment')}
        >
          Take Assessment
        </button>
      </section>

      {/* Quick Actions */}
      <QuickActions
        actions={patientActions}
        onAssessment={() => navigate('/patient/assessment')}
        onCheckIn={() => navigate('/patient/mood-tracker')}
        onInsights={() => navigate('/patient/ai-insights')}
      />

      {/* Interactive / Trend Charts */}
      <div className="dashboard-grid">
        {moodTrends.length > 0 ? (
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Mood trend (7 days)</h2>
                <p>Recent self-reported mood scores.</p>
              </div>
              <button
                className="text-button"
                style={{ cursor: 'pointer', fontWeight: 700 }}
                onClick={() => navigate('/patient/mood-tracker')}
              >
                View all trends →
              </button>
            </div>
            <div className="chart-container-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                  <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                  <Tooltip formatter={(v) => [`${v} / 10`, 'Mood Score']} />
                  <Line
                    type="monotone"
                    dataKey="mood_score"
                    name="Mood"
                    stroke="#087b70"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#087b70' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : (
          <PlaceholderChart
            title="Mood trend"
            message="Complete your first daily check-in to see your trends."
          />
        )}

        {moodTrends.length > 0 ? (
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Stress & energy trend (7 days)</h2>
                <p>Patterns in stress and physical/mental energy.</p>
              </div>
              <button
                className="text-button"
                style={{ cursor: 'pointer', fontWeight: 700 }}
                onClick={() => navigate('/patient/mood-tracker')}
              >
                View details →
              </button>
            </div>
            <div className="chart-container-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                  <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                  <Tooltip formatter={(v, name) => [`${v} / 10`, name]} />
                  <Legend verticalAlign="top" height={32} />
                  <Line
                    type="monotone"
                    dataKey="stress_level"
                    name="Stress"
                    stroke="#b56317"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#b56317' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="energy_level"
                    name="Energy"
                    stroke="#1e7399"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#1e7399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : (
          <PlaceholderChart
            title="Stress & energy"
            message="Your stress and energy patterns will appear here."
          />
        )}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent symptoms</h2>
              <p>Physical and cognitive signs recorded.</p>
            </div>
            <button
              className="text-button"
              style={{ cursor: 'pointer', fontWeight: 700 }}
              onClick={() => navigate('/patient/symptoms')}
            >
              Log symptom →
            </button>
          </div>
          {symptoms.length === 0 ? (
            <EmptyState
              title="No symptoms logged"
              message="Track headaches, fatigue, sleep disruptions, or other symptoms anytime."
            />
          ) : (
            <div className="history-list">
              {symptoms.slice(0, 4).map((s) => (
                <article key={s.id}>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  <strong>{s.symptom_name}</strong>
                  <em>Severity {s.severity}/10</em>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Recommendations</h2>
          <EmptyState
            title="No recommendations yet"
            message="Recommendations will appear here when they are available."
          />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming therapy</h2>
              <p>Professional care coordination.</p>
            </div>
            <button
              id="btn-nav-therapy"
              className="text-button"
              style={{ cursor: 'pointer', fontWeight: 700 }}
              onClick={() => navigate('/patient/therapy')}
            >
              Manage care →
            </button>
          </div>
          <EmptyState
            title="Therapy & Care Network"
            message="Connect with licensed mental health practitioners to review your wellbeing progress and receive clinical guidance."
          />
        </section>

        <section className="panel">
          <h2>Notifications</h2>
          <EmptyState title="You’re all caught up" message="New notifications will appear here." />
        </section>
      </div>

      <aside className="safety-note">
        <strong>Important:</strong> AI insights and self-tracking data are not a medical diagnosis.
        If you are in immediate danger or experiencing a crisis, contact a qualified mental health
        professional or local emergency service.
      </aside>
    </>
  )
}

function TherapistDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState(null)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const token = sessionStorage.getItem('access_token')

  const fetchTherapistData = async () => {
    if (!token) return
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [dashRes, patientsRes] = await Promise.all([
        fetch(`${API_URL}/api/therapist/dashboard`, { headers }),
        fetch(`${API_URL}/api/therapist/patients`, { headers }),
      ])

      if (dashRes.ok) {
        const dJson = await dashRes.json()
        setDashboardData(dJson)
      }
      if (patientsRes.ok) {
        const pJson = await patientsRes.json()
        setPatients(pJson)
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTherapistData()
  }, [])

  const handleRequestAction = async (requestId, action) => {
    if (!token) return
    setActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_URL}/api/therapists/requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(action === 'accept' ? 'Patient connection accepted!' : 'Connection request rejected.')
        await fetchTherapistData()
      } else {
        setMessage(data.detail || 'Action failed.')
      }
    } catch {
      setMessage('Error processing request.')
    } finally {
      setActionLoading(false)
    }
  }

  const pendingRequests = dashboardData?.pending_requests || []
  const recentActivity = dashboardData?.recent_activity || []

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Practice overview</p>
        <h1>Welcome, {user?.name || 'Practitioner'}</h1>
        <p>
          Specialization: <strong>Licensed Clinical Mental Health Practice</strong>
        </p>
      </section>

      {message && (
        <div className="success-banner" style={{ marginBottom: 18 }}>
          <span>{message}</span>
          <button
            className="text-button"
            style={{ fontWeight: 700, margin: 0, padding: 0 }}
            onClick={() => setMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards with REAL Data */}
      <section className="metric-grid">
        <MetricCard
          id="metric-total-patients"
          label="Connected patients"
          value={dashboardData ? String(dashboardData.total_connected_patients) : (loading ? '...' : '0')}
          detail={dashboardData?.total_connected_patients === 1 ? '1 active relationship' : `${dashboardData?.total_connected_patients || 0} active relationships`}
        />
        <MetricCard
          id="metric-pending-requests"
          label="Pending requests"
          value={dashboardData ? String(dashboardData.pending_requests_count) : (loading ? '...' : '0')}
          detail={dashboardData?.pending_requests_count > 0 ? 'Action required' : 'All caught up'}
        />
        <MetricCard
          id="metric-recent-activity"
          label="Recent check-ins"
          value={dashboardData ? String(recentActivity.length) : (loading ? '...' : '0')}
          detail="From connected patients"
        />
        <MetricCard
          id="metric-clinical-status"
          label="Practice status"
          value="Active"
          detail="Accepting patient requests"
        />
      </section>

      {/* Quick Actions */}
      <QuickActions
        actions={therapistActions}
        onViewPatients={() => navigate('/therapist/patients')}
      />

      {/* Pending Connection Requests Alert */}
      {pendingRequests.length > 0 && (
        <section className="panel" style={{ marginBottom: 20, borderLeft: '4px solid #c88a20' }}>
          <div className="panel-heading">
            <div>
              <h2 style={{ color: '#82560b' }}>Pending Connection Requests ({pendingRequests.length})</h2>
              <p>Patients waiting for your approval to connect records.</p>
            </div>
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
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </p>
                <div className="action-btn-group" style={{ marginTop: 8 }}>
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

      {/* Dashboard Grid: Patient List & Recent Activity */}
      <div className="dashboard-grid">
        <section className="panel span-two">
          <div className="panel-heading">
            <div>
              <h2>Connected Patients ({patients.length})</h2>
              <p>Active patients with verified clinical relationships.</p>
            </div>
            <button
              id="btn-manage-all-patients"
              className="text-button"
              style={{ fontWeight: 700, cursor: 'pointer' }}
              onClick={() => navigate('/therapist/patients')}
            >
              Full directory →
            </button>
          </div>

          {patients.length === 0 ? (
            <EmptyState
              title="No connected patients yet"
              message="When patients send connection requests and you accept them, their progress records and trends will appear here."
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Avg Mood</th>
                    <th>Avg Stress</th>
                    <th>Avg Energy</th>
                    <th>AI Trend</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#668486' }}>{p.email}</div>
                      </td>
                      <td>
                        <strong>{p.average_mood != null ? `${p.average_mood}/10` : '—'}</strong>
                      </td>
                      <td>
                        <strong>{p.average_stress != null ? `${p.average_stress}/10` : '—'}</strong>
                      </td>
                      <td>
                        <strong>{p.average_energy != null ? `${p.average_energy}/10` : '—'}</strong>
                      </td>
                      <td>
                        <span className="status-pill status-accepted">
                          {p.latest_trend}
                        </span>
                      </td>
                      <td>
                        <button
                          className="primary-button compact-button"
                          onClick={() => navigate(`/therapist/patients/${p.id}`)}
                        >
                          View Progress →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Patient Activity</h2>
              <p>Latest check-ins from connected patients.</p>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState
              title="No recent activity"
              message="Patient assessments and check-ins will appear here as connected patients log data."
            />
          ) : (
            <div className="history-list">
              {recentActivity.slice(0, 8).map((act) => (
                <article key={act.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#133f43' }}>{act.patient_name}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#688486' }}>
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#496b6d' }}>{act.summary}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export default function DashboardPage({ role }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isDashboard = location.pathname === `/${role}` || location.pathname === `/${role}/`
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAssessment = role === 'patient' && location.pathname === '/patient/assessment'
  const isMoodTracker =
    role === 'patient' &&
    (location.pathname === '/patient/mood-tracker' ||
      location.pathname === '/patient/daily-check-in')
  const isSymptoms = role === 'patient' && location.pathname === '/patient/symptoms'
  const isInsights =
    role === 'patient' &&
    (location.pathname === '/patient/ai-insights' ||
      location.pathname === '/patient/insights')
  const isTherapy = role === 'patient' && location.pathname === '/patient/therapy'

  const isPatients =
    role === 'therapist' &&
    (location.pathname === '/therapist/patients' ||
      location.pathname === '/therapist/my-patients')
  const isPatientProgress =
    role === 'therapist' && location.pathname.startsWith('/therapist/patients/')
  const patientProgressId = isPatientProgress
    ? location.pathname.replace('/therapist/patients/', '').split('/')[0]
    : null

  return (
    <div className="app-shell">
      <AppSidebar
        role={role}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />
      <div className="content-area">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <div>
            <p className="topbar-kicker">{role === 'patient' ? 'Patient portal' : 'Therapist portal'}</p>
            <span>{user?.email}</span>
          </div>
          <button className="topbar-logout" onClick={handleLogout}>
            Log out
          </button>
        </header>
        <main className="dashboard-content">
          {isAssessment ? (
            <AssessmentPage />
          ) : isMoodTracker ? (
            <MoodTrackerPage />
          ) : isSymptoms ? (
            <SymptomsPage />
          ) : isInsights ? (
            <AIInsightsPage />
          ) : isTherapy ? (
            <PatientTherapyPage />
          ) : isPatientProgress ? (
            <PatientProgressPage patientId={patientProgressId} />
          ) : isPatients ? (
            <TherapistPatientsPage />
          ) : isDashboard ? (
            role === 'patient' ? (
              <PatientDashboard />
            ) : (
              <TherapistDashboard />
            )
          ) : (
            <section className="panel feature-empty">
              <h1>{location.pathname.split('/').pop().replaceAll('-', ' ')}</h1>
              <EmptyState
                title="This section is not available yet"
                message="It will be added in a later project step."
              />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

