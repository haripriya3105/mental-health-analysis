import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function PatientProgressPage({ patientId }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [daysFilter, setDaysFilter] = useState(30)

  const token = sessionStorage.getItem('access_token')

  const fetchProgress = async (days) => {
    if (!token || !patientId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/therapist/patients/${patientId}/progress?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.detail || 'Unable to access patient progress.')
      }

      setData(json)
    } catch (err) {
      setError(err.message || 'Failed to load patient records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProgress(daysFilter)
  }, [patientId, daysFilter])

  const getTrendClass = (trend) => {
    if (!trend) return 'trend-insufficient'
    const lower = trend.toLowerCase()
    if (lower.includes('improv')) return 'trend-improving'
    if (lower.includes('worsen')) return 'trend-worsening'
    if (lower.includes('stable')) return 'trend-stable'
    if (lower.includes('mixed')) return 'trend-mixed'
    return 'trend-insufficient'
  }

  if (loading && !data) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#57787a' }}>
        <p>Loading patient progress records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="patient-progress-error">
        <button
          className="text-button"
          style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 16 }}
          onClick={() => navigate('/therapist/patients')}
        >
          ← Back to Patients Directory
        </button>
        <section className="panel" style={{ borderLeft: '4px solid #c53030' }}>
          <h2>Access Restricted</h2>
          <div className="error" style={{ margin: '14px 0' }}>
            {error}
          </div>
          <p style={{ color: '#587678' }}>
            Therapists can only access health records and progress histories for patients with an
            active, accepted clinical relationship.
          </p>
          <button
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => navigate('/therapist/patients')}
          >
            Return to Patients List
          </button>
        </section>
      </div>
    )
  }

  const patient = data?.patient || {}
  const moodTrends = data?.mood_trends || []
  const symptoms = data?.symptoms || []
  const assessments = data?.assessments || []
  const recentCheckins = data?.recent_checkins || []
  const aiAnalysis = data?.ai_analysis || null

  const hasMoodData = moodTrends.length >= 2
  const latestAssessment = assessments[0] || null

  return (
    <div className="patient-progress-container">
      {/* Navigation Header */}
      <div style={{ marginBottom: 18 }}>
        <button
          className="text-button"
          style={{ cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => navigate('/therapist/patients')}
        >
          ← Back to Patients Directory
        </button>
      </div>

      {/* Patient Overview Card */}
      <section className="patient-overview-card">
        <div className="overview-top">
          <div>
            <p className="eyebrow" style={{ margin: '0 0 6px' }}>Clinical Progress File</p>
            <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', color: '#133f43' }}>{patient.name}</h1>
            <p style={{ color: '#59787a', margin: '0 0 8px', fontSize: '0.92rem' }}>
              {patient.email} &bull; Connected since{' '}
              {patient.connected_at ? new Date(patient.connected_at).toLocaleDateString() : 'Active'}
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="status-pill status-accepted">Active Relationship</span>
              {aiAnalysis?.trend && (
                <span className={`trend-pill ${getTrendClass(aiAnalysis.trend)}`}>
                  Trend: {aiAnalysis.trend}
                </span>
              )}
            </div>
          </div>

          {/* Date Filter Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#567577' }}>
              TIMEFRAME FILTER
            </span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  className={`filter-tab ${daysFilter === d ? 'active' : ''}`}
                  onClick={() => setDaysFilter(d)}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stat Averages Grid */}
        <div className="overview-stats">
          <div className="overview-stat-box">
            <small>Avg Mood</small>
            <strong>{aiAnalysis?.average_mood != null ? `${aiAnalysis.average_mood}/10` : '—'}</strong>
            <span>{aiAnalysis?.mood_direction || 'Traj: N/A'}</span>
          </div>
          <div className="overview-stat-box">
            <small>Avg Stress</small>
            <strong>{aiAnalysis?.average_stress != null ? `${aiAnalysis.average_stress}/10` : '—'}</strong>
            <span>{aiAnalysis?.stress_direction || 'Traj: N/A'}</span>
          </div>
          <div className="overview-stat-box">
            <small>Avg Energy</small>
            <strong>{aiAnalysis?.average_energy != null ? `${aiAnalysis.average_energy}/10` : '—'}</strong>
            <span>{aiAnalysis?.energy_direction || 'Traj: N/A'}</span>
          </div>
          <div className="overview-stat-box">
            <small>Check-ins</small>
            <strong>{data?.total_checkins || 0}</strong>
            <span>{data?.filtered_checkins || 0} in {daysFilter}d window</span>
          </div>
          <div className="overview-stat-box">
            <small>Latest Assessment</small>
            <strong style={{ fontSize: '1.05rem', marginTop: 4 }}>
              {latestAssessment ? latestAssessment.result_category : 'None'}
            </strong>
            <span>
              {latestAssessment ? `Score ${latestAssessment.total_score}` : 'No assessment'}
            </span>
          </div>
        </div>
      </section>

      {/* Visual Trends Section */}
      <div className="dashboard-grid" style={{ marginTop: 0, marginBottom: 24 }}>
        {/* Mood Trend Chart */}
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Mood Trajectory ({daysFilter} days)</h2>
              <p>Self-reported emotional mood score over time (1–10).</p>
            </div>
            {aiAnalysis?.mood_direction && (
              <span className={`trend-pill ${getTrendClass(aiAnalysis.mood_direction)}`}>
                {aiAnalysis.mood_direction}
              </span>
            )}
          </div>

          {hasMoodData ? (
            <div className="chart-container-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1eeeb" vertical={false} />
                  <XAxis dataKey="date" stroke="#688789" tickLine={false} fontSize={12} />
                  <YAxis domain={[1, 10]} ticks={[2, 4, 6, 8, 10]} stroke="#688789" tickLine={false} fontSize={12} />
                  <Tooltip
                    formatter={(val) => [`${val} / 10`, 'Mood Score']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #dcece8', background: '#fff' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="mood_score"
                    name="Mood Score"
                    stroke="#087b70"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#087b70' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <div className="chart-grid" aria-hidden="true" />
              <EmptyState
                title="Insufficient mood data"
                message="Not enough historical data to calculate a meaningful trend."
              />
            </div>
          )}
        </section>

        {/* Stress & Energy Dual Chart */}
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Stress & Energy Trajectory ({daysFilter} days)</h2>
              <p>Correlation between stress levels and energetic capacity (1–10).</p>
            </div>
          </div>

          {hasMoodData ? (
            <div className="chart-container-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1eeeb" vertical={false} />
                  <XAxis dataKey="date" stroke="#688789" tickLine={false} fontSize={12} />
                  <YAxis domain={[1, 10]} ticks={[2, 4, 6, 8, 10]} stroke="#688789" tickLine={false} fontSize={12} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #dcece8', background: '#fff' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="stress_level"
                    name="Stress (1-10)"
                    stroke="#b56317"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#b56317' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="energy_level"
                    name="Energy (1-10)"
                    stroke="#1e7399"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#1e7399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <div className="chart-grid" aria-hidden="true" />
              <EmptyState
                title="Insufficient stress/energy data"
                message="Not enough historical data to calculate a meaningful trend."
              />
            </div>
          )}
        </section>
      </div>

      {/* AI Pattern Insights & Evidence-based Analysis */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Clinical AI Pattern Insights</h2>
            <p>Non-diagnostic behavioural synthesis derived from verified patient check-in entries.</p>
          </div>
          {aiAnalysis?.sentiment && (
            <span className={`sentiment-pill sentiment-${aiAnalysis.sentiment.toLowerCase()}`}>
              Sentiment: {aiAnalysis.sentiment}
            </span>
          )}
        </div>

        {aiAnalysis ? (
          <div>
            <div className="insight-summary-box">
              <h3>Synthesized Clinical Overview</h3>
              <p>{aiAnalysis.summary}</p>
            </div>

            {aiAnalysis.key_patterns && aiAnalysis.key_patterns.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: '1rem', color: '#163f42', margin: '0 0 10px' }}>
                  Observed Trajectory Patterns
                </h3>
                <div className="patterns-container">
                  {aiAnalysis.key_patterns.map((pat, idx) => (
                    <div key={idx} className="pattern-item">
                      <span className="pattern-bullet">{idx + 1}</span>
                      <p className="pattern-text">{pat}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: '1rem', color: '#163f42', margin: '0 0 10px' }}>
                  Suggested Wellness & Coping Focus Areas
                </h3>
                <div className="recommendations-container">
                  {aiAnalysis.recommendations.map((rec, idx) => (
                    <div key={idx} className="recommendation-card">
                      <div className="recommendation-header">
                        <span className="recommendation-badge">Recommendation {idx + 1}</span>
                      </div>
                      <p>{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No insights available"
            message="Not enough historical data to calculate a meaningful trend."
          />
        )}
      </section>

      {/* Symptoms & Assessment Records */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {/* Physical / Cognitive Symptoms History */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Reported Symptoms ({symptoms.length})</h2>
              <p>Symptom entries recorded by the patient.</p>
            </div>
          </div>

          {symptoms.length === 0 ? (
            <EmptyState
              title="No symptoms reported"
              message="The patient has not logged any physical or cognitive symptoms yet."
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symptom</th>
                    <th>Severity</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {symptoms.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <strong>{s.symptom_name}</strong>
                      </td>
                      <td>
                        <span
                          className={`severity-pill ${
                            s.severity >= 7
                              ? 'severity-high'
                              : s.severity >= 4
                              ? 'severity-med'
                              : 'severity-low'
                          }`}
                        >
                          {s.severity}/10
                        </span>
                      </td>
                      <td style={{ color: '#577577', fontSize: '0.86rem' }}>
                        {s.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Clinical Assessment History */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Standardized Assessments ({assessments.length})</h2>
              <p>Periodic mental health questionnaire evaluations.</p>
            </div>
          </div>

          {assessments.length === 0 ? (
            <EmptyState
              title="No assessments taken"
              message="The patient has not submitted any standardized assessments yet."
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>
                        <strong>{a.total_score} pts</strong>
                      </td>
                      <td>
                        <span className="status-pill status-accepted">
                          {a.result_category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Recent Check-ins Table */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Recent Check-in Logs</h2>
            <p>Chronological record of patient self-evaluations.</p>
          </div>
        </div>

        {recentCheckins.length === 0 ? (
          <EmptyState
            title="No check-ins available"
            message="Check-in records will appear here as the patient completes daily logs."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Mood</th>
                  <th>Stress</th>
                  <th>Energy</th>
                  <th>State</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentCheckins.slice(0, 15).map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <strong style={{ color: '#087b70' }}>{entry.mood_score}/10</strong>
                    </td>
                    <td>
                      <strong style={{ color: '#b56317' }}>{entry.stress_level}/10</strong>
                    </td>
                    <td>
                      <strong style={{ color: '#1e7399' }}>{entry.energy_level}/10</strong>
                    </td>
                    <td>
                      <span className="chip-button" style={{ padding: '2px 10px', fontSize: '0.78rem', cursor: 'default' }}>
                        {entry.emotional_state || 'Recorded'}
                      </span>
                    </td>
                    <td style={{ color: '#557577', maxWidth: 280 }}>
                      {entry.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Non-diagnostic clinical safety disclaimer */}
      <aside className="safety-note">
        <strong>Clinical Advisory Notice:</strong> AI pattern summaries, mood trajectory calculations,
        and algorithmic insights are designed to support reflective dialogue and practice organization.
        They do not constitute psychiatric or medical diagnosis, prescriptive treatment plans, or emergency intervention.
      </aside>
    </div>
  )
}
