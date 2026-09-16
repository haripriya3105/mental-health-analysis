import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
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

export default function TherapistReportsPage() {
  const navigate = useNavigate()
  const [practiceData, setPracticeData] = useState(null)
  const [loadingPractice, setLoadingPractice] = useState(true)
  const [practiceError, setPracticeError] = useState(null)

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientReport, setPatientReport] = useState(null)
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [patientError, setPatientError] = useState(null)
  const [daysFilter, setDaysFilter] = useState(30)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const token = sessionStorage.getItem('access_token')

  // Fetch practice overview
  const fetchPracticeReports = async () => {
    if (!token) return
    setLoadingPractice(true)
    setPracticeError(null)
    try {
      const res = await fetch(`${API_URL}/api/therapist/reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.detail || 'Unable to load therapist reports.')
      }
      setPracticeData(json)

      // Automatically select first patient if none selected
      if (!selectedPatientId && json.patients && json.patients.length > 0) {
        setSelectedPatientId(String(json.patients[0].id))
      }
    } catch (err) {
      setPracticeError(err.message || 'Unable to load therapist reports.')
    } finally {
      setLoadingPractice(false)
    }
  }

  // Fetch detailed report for selected patient
  const fetchPatientReport = async (patientId, days) => {
    if (!token || !patientId) return
    setLoadingPatient(true)
    setPatientError(null)
    try {
      const res = await fetch(`${API_URL}/api/therapist/reports/${patientId}?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.detail || 'Unable to load the report. Please try again.')
      }
      setPatientReport(json)
    } catch (err) {
      setPatientError(err.message || 'Unable to load the report. Please try again.')
    } finally {
      setLoadingPatient(false)
    }
  }

  useEffect(() => {
    fetchPracticeReports()
  }, [])

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientReport(selectedPatientId, daysFilter)
    } else {
      setPatientReport(null)
    }
  }, [selectedPatientId, daysFilter])

  const getTrendBadgeClass = (trend) => {
    if (!trend) return 'trend-insufficient'
    const lower = String(trend).toLowerCase()
    if (lower.includes('improv')) return 'trend-improving'
    if (lower.includes('worsen')) return 'trend-worsening'
    if (lower.includes('stable')) return 'trend-stable'
    if (lower.includes('mixed')) return 'trend-mixed'
    return 'trend-insufficient'
  }

  const handlePrint = () => {
    window.print()
  }

  if (loadingPractice && !practiceData) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#57787a' }}>
        <h2>Loading your progress...</h2>
        <p style={{ marginTop: 8 }}>Retrieving practice analytics and connected patient records.</p>
      </div>
    )
  }

  if (practiceError) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2 style={{ color: '#9f2a1b' }}>Unable to load the report. Please try again.</h2>
        <p style={{ color: '#688486', margin: '12px 0 20px' }}>{practiceError}</p>
        <button className="primary-button compact-button" onClick={fetchPracticeReports}>
          Retry
        </button>
      </section>
    )
  }

  const connectedPatients = practiceData?.patients || []
  const recentActivity = practiceData?.recent_activity || []
  const trendSignals = patientReport?.trend_signals || []
  const moodTrends = patientReport?.mood_trends || []
  const symptomData = patientReport?.symptom_severity_over_time || []
  const frequentSymptoms = patientReport?.frequent_symptoms || []
  const emotionalDistribution = patientReport?.emotional_state_distribution || []
  const assessments = patientReport?.assessment_history || []
  const recentCheckins = patientReport?.recent_checkins || []

  return (
    <div className="reports-container">
      {/* Printable Report View (Active when showPrintModal is true and in print media) */}
      <div className={`printable-report-wrapper ${showPrintModal ? 'print-modal-active' : 'screen-hidden'}`}>
        <div className="printable-report-card">
          <div className="print-controls screen-only" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="text-button" style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowPrintModal(false)}>
              ← Back to Reports Console
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button id="btn-do-print-therapist" className="primary-button compact-button" onClick={handlePrint}>
                🖨️ Print / Save as PDF
              </button>
              <button className="secondary-button compact-button" onClick={() => setShowPrintModal(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="formal-report-header">
            <div className="report-brand">
              <span className="brand-mark">M</span>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#123f43' }}>Mindful Care</h1>
                <p style={{ margin: '2px 0 0', color: '#57787a', fontSize: '0.88rem' }}>Clinical Practice Progress & Care Summary</p>
              </div>
            </div>
            <div className="report-meta" style={{ textAlign: 'right' }}>
              <span className="status-pill status-accepted" style={{ fontSize: '0.82rem' }}>Clinical Progress Report</span>
              <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#688486' }}>
                Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#688486' }}>
                Date Range: <strong>Last {patientReport?.filter_days || daysFilter} Days</strong>
              </p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #dce8e7', margin: '20px 0' }} />

          {/* Patient Overview */}
          <div className="report-section">
            <h3 style={{ color: '#163e41', marginBottom: 8 }}>Patient Identification & Clinical Relationship</h3>
            <p style={{ margin: 0, color: '#385b5e' }}>
              Patient Name: <strong>{patientReport?.patient?.name}</strong> &nbsp;|&nbsp;
              ID: <strong>#{patientReport?.patient?.id}</strong> &nbsp;|&nbsp;
              Email: <strong>{patientReport?.patient?.email}</strong> &nbsp;|&nbsp;
              Connected: <strong>{patientReport?.patient?.connected_at ? new Date(patientReport.patient.connected_at).toLocaleDateString() : 'Active'}</strong>
            </p>
          </div>

          {/* AI Progress Summary */}
          <div className="report-section" style={{ marginTop: 18 }}>
            <h3 style={{ color: '#163e41', marginBottom: 8 }}>AI Progress Summary</h3>
            <p style={{ margin: 0, color: '#2d4d50', lineHeight: 1.6, background: '#f5faf9', padding: 14, borderRadius: 8, border: '1px solid #e1eeeb' }}>
              {patientReport?.ai_progress_summary || 'No summary available.'}
            </p>
          </div>

          {/* Trend Signals */}
          <div className="report-section" style={{ marginTop: 20 }}>
            <h3 style={{ color: '#163e41', marginBottom: 8 }}>Multi-Point Trend Signals</h3>
            {trendSignals.map((sig, i) => (
              <div key={i} style={{ padding: '8px 14px', background: sig.type === 'warning' ? '#fff6f4' : '#f5faf9', borderLeft: sig.type === 'warning' ? '4px solid #ba4836' : '4px solid #087b70', borderRadius: 4, marginBottom: 8 }}>
                <strong style={{ color: sig.type === 'warning' ? '#983824' : '#087b70' }}>{sig.title}:</strong>{' '}
                <span style={{ color: '#335558' }}>{sig.message}</span>
              </div>
            ))}
          </div>

          {/* Key Metrics Table */}
          <div className="report-section" style={{ marginTop: 20 }}>
            <h3 style={{ color: '#163e41', marginBottom: 12 }}>Metrics & Trajectories</h3>
            <table className="data-table" style={{ border: '1px solid #e1ebea' }}>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th>Average Score</th>
                  <th>Observed Trajectory</th>
                  <th>Directional Logic</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Mood</strong></td>
                  <td>{patientReport?.average_mood != null ? `${patientReport.average_mood} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(patientReport?.mood_direction)}`}>{patientReport?.mood_direction}</span></td>
                  <td>Increasing = Improving, Decreasing = Worsening</td>
                </tr>
                <tr>
                  <td><strong>Stress</strong></td>
                  <td>{patientReport?.average_stress != null ? `${patientReport.average_stress} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(patientReport?.stress_direction)}`}>{patientReport?.stress_direction}</span></td>
                  <td>Decreasing = Improving, Increasing = Worsening</td>
                </tr>
                <tr>
                  <td><strong>Energy</strong></td>
                  <td>{patientReport?.average_energy != null ? `${patientReport.average_energy} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(patientReport?.energy_direction)}`}>{patientReport?.energy_direction}</span></td>
                  <td>Increasing = Improving, Decreasing = Worsening</td>
                </tr>
                <tr>
                  <td><strong>Symptoms</strong></td>
                  <td>{patientReport?.symptom_history?.length || 0} recorded logs</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(patientReport?.symptom_trend)}`}>{patientReport?.symptom_trend}</span></td>
                  <td>Severity reduction = Improving</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assessment History */}
          {assessments.length > 0 && (
            <div className="report-section" style={{ marginTop: 20 }}>
              <h3 style={{ color: '#163e41', marginBottom: 8 }}>Standardized Clinical Assessment History</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#2d4d50', lineHeight: 1.6 }}>
                {assessments.map((a) => (
                  <li key={a.id}>
                    {new Date(a.created_at).toLocaleDateString()}: <strong>{a.result_category}</strong> (Score {a.total_score} / 27)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {patientReport?.recommendations?.length > 0 && (
            <div className="report-section" style={{ marginTop: 20 }}>
              <h3 style={{ color: '#163e41', marginBottom: 8 }}>Active Wellness & Lifestyle Guidance</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#2d4d50', lineHeight: 1.6 }}>
                {patientReport.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety Disclaimer */}
          <div className="report-section" style={{ marginTop: 24, padding: 14, background: '#fff9ed', borderLeft: '4px solid #c88a20', borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#66512e', lineHeight: 1.5 }}>
              <strong>Clinical Advisory:</strong> {patientReport?.safety_disclaimer || 'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Screen */}
      <div className={showPrintModal ? 'screen-hidden' : ''}>
        {/* Therapist Hero */}
        <section className="hero">
          <p className="eyebrow">Practice Intelligence</p>
          <h1>Clinical Reports & Analytics</h1>
          <p>Multi-point longitudinal trajectories, trend signals, and standardized reports for connected patients.</p>
        </section>

        {/* Practice-Level Analytics Cards */}
        <section className="metric-grid">
          <article id="card-connected-patients" className="metric-card">
            <p>Total connected patients</p>
            <strong>{practiceData?.total_connected_patients || 0}</strong>
            <span>Active clinical relationships</span>
          </article>

          <article id="card-active-patients" className="metric-card">
            <p>Active patients</p>
            <strong>{practiceData?.active_patients || 0}</strong>
            <span>Check-in activity in last 30 days</span>
          </article>

          <article id="card-recent-checkins" className="metric-card">
            <p>Patients with recent check-ins</p>
            <strong>{practiceData?.patients_with_recent_checkins || 0}</strong>
            <span>Active in last 7 days</span>
          </article>

          <article id="card-upcoming-sessions" className="metric-card">
            <p>Upcoming sessions</p>
            <strong>{practiceData?.upcoming_sessions || 0}</strong>
            <span>Direct consultation schedule</span>
          </article>
        </section>

        {connectedPatients.length === 0 ? (
          <section className="panel" style={{ marginTop: 20 }}>
            <EmptyState
              title="No connected patients"
              message="When patients send connection requests and you approve them, their progress reports and analytics will appear here."
            />
          </section>
        ) : (
          <>
            {/* Patient Selector and Range Controls */}
            <section className="panel" style={{ marginBottom: 20, background: '#fcfdfd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label htmlFor="patient-select-dropdown" style={{ fontWeight: 700, color: '#173f43' }}>
                    Select Patient:
                  </label>
                  <select
                    id="patient-select-dropdown"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    style={{ minWidth: 240, padding: '10px 14px', borderRadius: 8, borderColor: '#bdd0cf', fontWeight: 600 }}
                  >
                    {connectedPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email}) — {p.total_checkins} check-ins
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="filter-tabs" style={{ margin: 0 }}>
                    <button
                      className={`filter-tab ${daysFilter === 7 ? 'active' : ''}`}
                      onClick={() => setDaysFilter(7)}
                    >
                      Last 7 days
                    </button>
                    <button
                      className={`filter-tab ${daysFilter === 30 ? 'active' : ''}`}
                      onClick={() => setDaysFilter(30)}
                    >
                      Last 30 days
                    </button>
                    <button
                      className={`filter-tab ${daysFilter === 90 ? 'active' : ''}`}
                      onClick={() => setDaysFilter(90)}
                    >
                      Last 90 days
                    </button>
                  </div>

                  <button
                    id="btn-generate-therapist-report"
                    className="primary-button compact-button"
                    onClick={() => setShowPrintModal(true)}
                  >
                    📄 Generate Report / Print View
                  </button>
                </div>
              </div>
            </section>

            {loadingPatient ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#57787a' }}>
                <h2>Loading your progress...</h2>
              </div>
            ) : patientError ? (
              <section className="panel" style={{ textAlign: 'center', padding: '30px 20px' }}>
                <h3 style={{ color: '#9f2a1b' }}>Unable to load the report. Please try again.</h3>
                <p style={{ color: '#688486' }}>{patientError}</p>
              </section>
            ) : !patientReport ? (
              <section className="panel">
                <EmptyState title="No progress data available yet." message="Select a connected patient to review their report." />
              </section>
            ) : (
              <>
                {/* Selected Patient Overview Header */}
                <section className="patient-overview-card">
                  <div className="overview-top">
                    <div>
                      <span className="status-pill status-accepted">Connected Patient File</span>
                      <h2 style={{ margin: '8px 0 4px', color: '#123f43' }}>{patientReport.patient.name}</h2>
                      <p style={{ margin: 0, color: '#5b787a', fontSize: '0.9rem' }}>
                        {patientReport.patient.email} &nbsp;•&nbsp; Connected on {patientReport.patient.connected_at ? new Date(patientReport.patient.connected_at).toLocaleDateString() : 'Active'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        className="secondary-button compact-button"
                        onClick={() => navigate(`/therapist/patients/${patientReport.patient.id}`)}
                      >
                        Open Progress Trajectory →
                      </button>
                    </div>
                  </div>

                  {/* Patient Directional Indicators (Phase 6 Logic) */}
                  <div className="overview-stats">
                    <div className="overview-stat-box">
                      <small>Mood Direction</small>
                      <strong>{patientReport.average_mood != null ? `${patientReport.average_mood} / 10` : '—'}</strong>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.mood_direction)}`} style={{ marginTop: 4 }}>
                        {patientReport.mood_direction}
                      </span>
                    </div>

                    <div className="overview-stat-box">
                      <small>Stress Direction</small>
                      <strong>{patientReport.average_stress != null ? `${patientReport.average_stress} / 10` : '—'}</strong>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.stress_direction)}`} style={{ marginTop: 4 }}>
                        {patientReport.stress_direction}
                      </span>
                    </div>

                    <div className="overview-stat-box">
                      <small>Energy Direction</small>
                      <strong>{patientReport.average_energy != null ? `${patientReport.average_energy} / 10` : '—'}</strong>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.energy_direction)}`} style={{ marginTop: 4 }}>
                        {patientReport.energy_direction}
                      </span>
                    </div>

                    <div className="overview-stat-box">
                      <small>Symptom Trend</small>
                      <strong>{patientReport.symptom_history?.length || 0} logs</strong>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.symptom_trend)}`} style={{ marginTop: 4 }}>
                        {patientReport.symptom_trend}
                      </span>
                    </div>

                    <div className="overview-stat-box">
                      <small>AI Wellbeing Trend</small>
                      <strong>{patientReport.total_checkins} check-ins</strong>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.ai_wellbeing_trend)}`} style={{ marginTop: 4 }}>
                        {patientReport.ai_wellbeing_trend}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Section 5: TREND SIGNALS */}
                <section className="panel" style={{ marginBottom: 20 }}>
                  <div className="panel-heading">
                    <div>
                      <h2>Trend Signals</h2>
                      <p>Multi-point pattern detections across consecutive check-in entries.</p>
                    </div>
                  </div>
                  {trendSignals.length === 0 ? (
                    <p style={{ color: '#688486' }}>Insufficient data for a reliable trend signal.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {trendSignals.map((sig, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            background: sig.type === 'warning' ? '#fff6f4' : sig.type === 'positive' ? '#eaf8f4' : '#f5faf9',
                            borderLeft: sig.type === 'warning' ? '4px solid #ba4836' : sig.type === 'positive' ? '4px solid #087b70' : '4px solid #85a2a4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: sig.type === 'warning' ? '#ba4836' : '#087b70',
                                marginBottom: 2,
                              }}
                            >
                              {sig.title}
                            </span>
                            <p style={{ margin: 0, color: '#24484b', fontSize: '0.94rem' }}>{sig.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* AI Progress Summary Box */}
                <section className="panel insight-summary-box">
                  <h3>AI Progress Summary</h3>
                  <p>{patientReport.ai_progress_summary}</p>
                </section>

                {/* Charts */}
                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Mood Over Time</h2>
                        <p>Self-reported scores (1-10).</p>
                      </div>
                    </div>
                    {moodTrends.length > 0 ? (
                      <div className="chart-container-box">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={moodTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <Tooltip formatter={(v) => [`${v} / 10`, 'Mood']} />
                            <Line type="monotone" dataKey="mood_score" name="Mood" stroke="#087b70" strokeWidth={2.5} dot={{ r: 3, fill: '#087b70' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <EmptyState title="No mood trends" message="Not enough check-in data in this window." />
                    )}
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Stress & Energy Trajectory</h2>
                        <p>Stress (low is better) vs. Energy.</p>
                      </div>
                    </div>
                    {moodTrends.length > 0 ? (
                      <div className="chart-container-box">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={moodTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <Tooltip formatter={(v, name) => [`${v} / 10`, name]} />
                            <Legend verticalAlign="top" height={30} />
                            <Line type="monotone" dataKey="stress_level" name="Stress" stroke="#b56317" strokeWidth={2} dot={{ r: 3, fill: '#b56317' }} />
                            <Line type="monotone" dataKey="energy_level" name="Energy" stroke="#1e7399" strokeWidth={2} dot={{ r: 3, fill: '#1e7399' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <EmptyState title="No stress/energy data" message="Not enough check-in data in this window." />
                    )}
                  </section>
                </div>

                {/* Symptom History & Emotional State Patterns */}
                <div className="dashboard-grid" style={{ marginTop: 20 }}>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Symptom History</h2>
                        <p>Reported physical & cognitive signals.</p>
                      </div>
                      <span className={`trend-pill ${getTrendBadgeClass(patientReport.symptom_trend)}`}>
                        {patientReport.symptom_trend}
                      </span>
                    </div>
                    {symptomData.length === 0 ? (
                      <EmptyState title="No symptoms logged" message="Patient has not logged symptoms in this window." />
                    ) : (
                      <div className="chart-container-box">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={symptomData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                            <Tooltip formatter={(v, name, item) => [`${v} / 10 (${item.payload.name})`, 'Severity']} />
                            <Bar dataKey="severity" name="Severity" fill="#ba4836" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Emotional-State Patterns</h2>
                        <p>Distribution of self-identified feelings.</p>
                      </div>
                    </div>
                    {emotionalDistribution.length === 0 ? (
                      <EmptyState title="No state distribution" message="Patient has not recorded emotional states yet." />
                    ) : (
                      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                        {emotionalDistribution.map((item) => (
                          <div key={item.state}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, color: '#24484b', marginBottom: 4 }}>
                              <span>{item.state}</span>
                              <span>{item.count} time{item.count === 1 ? '' : 's'} ({item.percentage}%)</span>
                            </div>
                            <div style={{ height: 8, background: '#e5eeee', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${item.percentage}%`, height: '100%', background: '#087b70', borderRadius: 4 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Assessment History & Recent Check-ins */}
                <div className="dashboard-grid" style={{ marginTop: 20 }}>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Assessment History</h2>
                        <p>Standardized clinical screenings.</p>
                      </div>
                    </div>
                    {assessments.length === 0 ? (
                      <EmptyState title="No assessments completed" message="Patient has not completed a screening yet." />
                    ) : (
                      <div className="history-list">
                        {assessments.map((a) => (
                          <article key={a.id}>
                            <span>{new Date(a.created_at).toLocaleDateString()}</span>
                            <strong>{a.result_category}</strong>
                            <em>Score {a.total_score}</em>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recent Check-ins</h2>
                        <p>Chronological patient check-ins.</p>
                      </div>
                    </div>
                    {recentCheckins.length === 0 ? (
                      <EmptyState title="No recent check-ins" message="Check-in entries will appear here." />
                    ) : (
                      <div className="history-list">
                        {recentCheckins.slice(0, 5).map((m) => (
                          <article key={m.id}>
                            <span>{new Date(m.created_at).toLocaleDateString()}</span>
                            <strong>Mood {m.mood_score}/10, Stress {m.stress_level}/10</strong>
                            <em>{m.emotional_state || 'Check-in'}</em>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Safety Disclaimer */}
                <aside className="safety-note" style={{ marginTop: 24 }}>
                  <strong>Important:</strong> {patientReport.safety_disclaimer || 'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'}
                </aside>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
