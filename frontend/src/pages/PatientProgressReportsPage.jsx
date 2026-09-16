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

export default function PatientProgressReportsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [daysFilter, setDaysFilter] = useState(30)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const token = sessionStorage.getItem('access_token')

  const fetchReport = async (days) => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/patient/progress-report?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.detail || 'Unable to load the report. Please try again.')
      }
      setData(json)
    } catch (err) {
      setError(err.message || 'Unable to load the report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(daysFilter)
  }, [daysFilter])

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

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#57787a' }}>
        <h2>Loading your progress...</h2>
        <p style={{ marginTop: 8 }}>Retrieving verified historical check-ins and assessments.</p>
      </div>
    )
  }

  if (error) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2 style={{ color: '#9f2a1b' }}>Unable to load the report. Please try again.</h2>
        <p style={{ color: '#688486', margin: '12px 0 20px' }}>{error}</p>
        <button className="primary-button compact-button" onClick={() => fetchReport(daysFilter)}>
          Retry
        </button>
      </section>
    )
  }

  const hasData = data?.has_data !== false && (data?.total_checkins > 0 || data?.mood_over_time?.length > 0)
  const hasSufficientData = data?.has_sufficient_data && data?.filtered_checkins >= 2
  const moodData = data?.mood_over_time || []
  const symptomsData = data?.symptom_severity_over_time || []
  const frequentSymptoms = data?.frequent_symptoms || []
  const emotionalDistribution = data?.emotional_state_distribution || []
  const assessments = data?.assessments || []
  const latestAssessment = data?.latest_assessment
  const keyPatterns = data?.key_patterns || []
  const recommendations = data?.recommendations || []

  return (
    <div className="reports-container">
      {/* Printable Report View (active on screen when showPrintModal is true, and always in print media) */}
      <div className={`printable-report-wrapper ${showPrintModal ? 'print-modal-active' : 'screen-hidden'}`}>
        <div className="printable-report-card">
          <div className="print-controls screen-only" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="text-button" style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowPrintModal(false)}>
              ← Back to Interactive View
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button id="btn-do-print" className="primary-button compact-button" onClick={handlePrint}>
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
                <p style={{ margin: '2px 0 0', color: '#57787a', fontSize: '0.88rem' }}>Personal Mental Health & Wellbeing System</p>
              </div>
            </div>
            <div className="report-meta" style={{ textAlign: 'right' }}>
              <span className="status-pill status-accepted" style={{ fontSize: '0.82rem' }}>Patient Wellbeing Progress Report</span>
              <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#688486' }}>
                Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#688486' }}>
                Timeframe: <strong>Last {data?.filter_days || daysFilter} Days</strong>
              </p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #dce8e7', margin: '20px 0' }} />

          {/* Patient Overview */}
          <div className="report-section">
            <h3 style={{ color: '#163e41', marginBottom: 8 }}>Patient Identification</h3>
            <p style={{ margin: 0, color: '#385b5e' }}>
              Name: <strong>{data?.patient?.name || 'Patient'}</strong> &nbsp;|&nbsp;
              Identifier: <strong>#{data?.patient?.id}</strong> &nbsp;|&nbsp;
              Email: <strong>{data?.patient?.email}</strong>
            </p>
          </div>

          {/* Summary */}
          <div className="report-section" style={{ marginTop: 18 }}>
            <h3 style={{ color: '#163e41', marginBottom: 8 }}>Executive Wellbeing Summary</h3>
            <p style={{ margin: 0, color: '#2d4d50', lineHeight: 1.6, background: '#f5faf9', padding: 14, borderRadius: 8, border: '1px solid #e1eeeb' }}>
              {data?.summary || 'No summary available.'}
            </p>
          </div>

          {/* Key Metrics Table */}
          <div className="report-section" style={{ marginTop: 20 }}>
            <h3 style={{ color: '#163e41', marginBottom: 12 }}>Key Metrics & Trajectories</h3>
            <table className="data-table" style={{ border: '1px solid #e1ebea' }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Average Score</th>
                  <th>Directional Trajectory</th>
                  <th>Standard Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Mood Score</strong></td>
                  <td>{data?.average_mood != null ? `${data.average_mood} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(data?.mood_trend)}`}>{data?.mood_trend}</span></td>
                  <td>Scale 1 (lowest) to 10 (highest)</td>
                </tr>
                <tr>
                  <td><strong>Stress Level</strong></td>
                  <td>{data?.average_stress != null ? `${data.average_stress} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(data?.stress_trend)}`}>{data?.stress_trend}</span></td>
                  <td>Scale 1 (calm) to 10 (severe pressure)</td>
                </tr>
                <tr>
                  <td><strong>Energy Level</strong></td>
                  <td>{data?.average_energy != null ? `${data.average_energy} / 10` : '—'}</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(data?.energy_trend)}`}>{data?.energy_trend}</span></td>
                  <td>Scale 1 (exhausted) to 10 (energized)</td>
                </tr>
                <tr>
                  <td><strong>Overall Wellbeing</strong></td>
                  <td>{data?.filtered_checkins || 0} check-ins in window</td>
                  <td><span className={`trend-pill ${getTrendBadgeClass(data?.overall_trend)}`}>{data?.overall_trend}</span></td>
                  <td>Holistic multi-point evaluation</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assessment Summary */}
          {latestAssessment && (
            <div className="report-section" style={{ marginTop: 20 }}>
              <h3 style={{ color: '#163e41', marginBottom: 8 }}>Standardized Clinical Assessment</h3>
              <p style={{ margin: 0, color: '#385b5e' }}>
                Latest Assessment Category: <strong>{latestAssessment.result_category}</strong> (Score: {latestAssessment.total_score}) on {new Date(latestAssessment.created_at).toLocaleDateString()}.
              </p>
            </div>
          )}

          {/* Key Observations */}
          {keyPatterns.length > 0 && (
            <div className="report-section" style={{ marginTop: 20 }}>
              <h3 style={{ color: '#163e41', marginBottom: 10 }}>Key Observed Patterns</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#2d4d50', lineHeight: 1.6 }}>
                {keyPatterns.map((pat, i) => (
                  <li key={i}>{pat}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="report-section" style={{ marginTop: 20 }}>
              <h3 style={{ color: '#163e41', marginBottom: 10 }}>Wellness & Lifestyle Recommendations</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#2d4d50', lineHeight: 1.6 }}>
                {recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety Disclaimer */}
          <div className="report-section" style={{ marginTop: 24, padding: 14, background: '#fff9ed', borderLeft: '4px solid #c88a20', borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#66512e', lineHeight: 1.5 }}>
              <strong>Safety Notice:</strong> {data?.safety_disclaimer || 'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Screen */}
      <div className={showPrintModal ? 'screen-hidden' : ''}>
        {/* Header with Title & Date Filters */}
        <section className="hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="eyebrow">Analytics & Progress</p>
            <h1>Personal Progress Report</h1>
            <p>Evidence-based trends, multi-point trajectories, and wellness summaries computed strictly from your real check-ins.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div className="filter-tabs">
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
              id="btn-generate-report"
              className="primary-button compact-button"
              onClick={() => setShowPrintModal(true)}
            >
              📄 Generate Report / Print View
            </button>
          </div>
        </section>

        {!hasData ? (
          <section className="panel">
            <EmptyState
              title="No progress data available yet."
              message="Begin recording daily check-ins in the Mood Tracker to view your personal progress analytics, charts, and AI trend reports."
            />
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="primary-button compact-button" onClick={() => navigate('/patient/mood-tracker')}>
                Start Daily Check-in →
              </button>
            </div>
          </section>
        ) : (
          <>
            {!hasSufficientData && (
              <div className="safety-note" style={{ marginBottom: 20 }}>
                <strong>Note:</strong> Not enough historical data to calculate a meaningful report for this timeframe.
                At least two check-in entries are required for directional trend trajectory calculations.
              </div>
            )}

            {/* Metric Cards */}
            <section className="metric-grid">
              <article id="card-avg-mood" className="metric-card">
                <p>Average Mood</p>
                <strong>{data?.average_mood != null ? `${data.average_mood} / 10` : '—'}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Trend: <span className={`trend-pill ${getTrendBadgeClass(data?.mood_trend)}`}>{data?.mood_trend || 'Insufficient data'}</span>
                </span>
              </article>

              <article id="card-avg-stress" className="metric-card">
                <p>Average Stress</p>
                <strong>{data?.average_stress != null ? `${data.average_stress} / 10` : '—'}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Trend: <span className={`trend-pill ${getTrendBadgeClass(data?.stress_trend)}`}>{data?.stress_trend || 'Insufficient data'}</span>
                </span>
              </article>

              <article id="card-avg-energy" className="metric-card">
                <p>Average Energy</p>
                <strong>{data?.average_energy != null ? `${data.average_energy} / 10` : '—'}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Trend: <span className={`trend-pill ${getTrendBadgeClass(data?.energy_trend)}`}>{data?.energy_trend || 'Insufficient data'}</span>
                </span>
              </article>

              <article id="card-total-checkins" className="metric-card">
                <p>Total Check-ins</p>
                <strong>{data?.total_checkins || 0}</strong>
                <span>{data?.filtered_checkins || 0} in selected {daysFilter}-day timeframe</span>
              </article>
            </section>

            {/* Executive AI Progress Summary */}
            <section className="panel insight-summary-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>AI Wellbeing Trend</h3>
                  <p style={{ margin: '4px 0 0', color: '#688486', fontSize: '0.86rem' }}>Synthesized trajectory from all check-in logs and symptoms.</p>
                </div>
                <span className={`trend-pill ${getTrendBadgeClass(data?.overall_trend)}`} style={{ fontSize: '0.92rem', padding: '6px 14px' }}>
                  {data?.overall_trend || 'Insufficient data'}
                </span>
              </div>
              <p>{data?.summary}</p>
            </section>

            {/* Charts Section */}
            <div className="dashboard-grid">
              {/* 1. Mood Over Time */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Mood Over Time</h2>
                    <p>Daily emotional trajectory (1-10 scale).</p>
                  </div>
                </div>
                {moodData.length > 0 ? (
                  <div className="chart-container-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={moodData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <Tooltip formatter={(v) => [`${v} / 10`, 'Mood']} />
                        <Legend verticalAlign="top" height={30} />
                        <Line type="monotone" dataKey="mood_score" name="Mood" stroke="#087b70" strokeWidth={3} dot={{ r: 4, fill: '#087b70' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No mood entries" message="No check-ins recorded within this timeframe." />
                )}
              </section>

              {/* 2. Stress & Energy Over Time */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Stress & Energy Over Time</h2>
                    <p>Comparative physiological strain and stamina.</p>
                  </div>
                </div>
                {moodData.length > 0 ? (
                  <div className="chart-container-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={moodData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <Tooltip formatter={(v, name) => [`${v} / 10`, name]} />
                        <Legend verticalAlign="top" height={30} />
                        <Line type="monotone" dataKey="stress_level" name="Stress" stroke="#b56317" strokeWidth={2.5} dot={{ r: 3, fill: '#b56317' }} />
                        <Line type="monotone" dataKey="energy_level" name="Energy" stroke="#1e7399" strokeWidth={2.5} dot={{ r: 3, fill: '#1e7399' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No stress/energy data" message="No check-ins recorded within this timeframe." />
                )}
              </section>

              {/* 3. Tracked Symptoms & Severity Over Time */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Symptom Severity Patterns</h2>
                    <p>Recorded physical and cognitive symptoms.</p>
                  </div>
                  <span className={`trend-pill ${getTrendBadgeClass(data?.symptom_trend)}`}>
                    {data?.symptom_trend}
                  </span>
                </div>
                {symptomsData.length > 0 ? (
                  <div className="chart-container-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={symptomsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                        <Tooltip formatter={(v, name, item) => [`${v} / 10 (${item.payload.name})`, 'Severity']} />
                        <Legend verticalAlign="top" height={30} />
                        <Bar dataKey="severity" name="Severity" fill="#ba4836" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No symptoms recorded" message="No physical or emotional symptoms logged in this timeframe." />
                )}
              </section>

              {/* 4. Emotional State Distribution */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Emotional-State Distribution</h2>
                    <p>Frequency breakdown of self-reported emotional states.</p>
                  </div>
                </div>
                {emotionalDistribution.length > 0 ? (
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
                ) : (
                  <EmptyState title="No states recorded" message="Log your check-in emotional states to view distribution patterns." />
                )}
              </section>
            </div>

            {/* Frequently Recorded Symptoms & Clinical Assessments */}
            <div className="dashboard-grid" style={{ marginTop: 20 }}>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Frequently Recorded Symptoms</h2>
                    <p>Recurrent signals requiring awareness.</p>
                  </div>
                </div>
                {frequentSymptoms.length === 0 ? (
                  <EmptyState title="No recurrent symptoms" message="You have not logged frequent symptoms." />
                ) : (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Symptom Name</th>
                          <th>Frequency</th>
                          <th>Average Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frequentSymptoms.map((s) => (
                          <tr key={s.name}>
                            <td><strong>{s.name}</strong></td>
                            <td>{s.count} time{s.count === 1 ? '' : 's'}</td>
                            <td>
                              <span className={`severity-pill ${s.average_severity >= 7 ? 'severity-high' : s.average_severity >= 4 ? 'severity-med' : 'severity-low'}`}>
                                {s.average_severity} / 10
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Standardized Assessment Summary */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Assessment Summary</h2>
                    <p>Clinical questionnaire history.</p>
                  </div>
                  <button className="text-button" style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/patient/assessment')}>
                    New Assessment →
                  </button>
                </div>
                {assessments.length === 0 ? (
                  <EmptyState title="No assessments completed" message="Complete the standardized mental health questionnaire to establish clinical baseline scores." />
                ) : (
                  <div className="history-list">
                    {assessments.slice(0, 4).map((ass) => (
                      <article key={ass.id}>
                        <span>{new Date(ass.created_at).toLocaleDateString()}</span>
                        <strong>{ass.result_category}</strong>
                        <em>Score {ass.total_score}</em>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Key AI Patterns & Recommendations */}
            <div className="dashboard-grid" style={{ marginTop: 20 }}>
              <section className="panel">
                <h2>Key AI-Generated Patterns</h2>
                <p style={{ color: '#688486', fontSize: '0.86rem', margin: '4px 0 16px' }}>Statistical reflections grounded in your entries.</p>
                {keyPatterns.length === 0 ? (
                  <EmptyState title="No pattern insights" message="More check-ins will generate detailed pattern observations." />
                ) : (
                  <div className="patterns-container">
                    {keyPatterns.map((pat, idx) => (
                      <div key={idx} className="pattern-item">
                        <span className="pattern-bullet">{idx + 1}</span>
                        <p className="pattern-text">{pat}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <h2>Wellness Recommendations</h2>
                <p style={{ color: '#688486', fontSize: '0.86rem', margin: '4px 0 16px' }}>Supportive everyday self-care habits.</p>
                {recommendations.length === 0 ? (
                  <EmptyState title="No recommendations" message="Check back once further data points are recorded." />
                ) : (
                  <div className="recommendations-container" style={{ gridTemplateColumns: '1fr' }}>
                    {recommendations.map((rec, idx) => (
                      <article key={idx} className="recommendation-card">
                        <div className="recommendation-header">
                          <span className="recommendation-badge">Supportive Habit</span>
                        </div>
                        <p>{rec}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Safety Disclaimer */}
            <aside className="safety-note" style={{ marginTop: 24 }}>
              <strong>Important:</strong> {data?.safety_disclaimer || 'AI insights are for informational and wellness purposes only and are not a medical diagnosis.'}
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
