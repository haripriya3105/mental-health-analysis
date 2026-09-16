import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || ''

async function fetchAnalysis(token) {
  const response = await fetch(`${API_URL}/api/analysis`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.detail || 'Unable to load analysis.')
  }
  return body
}

export default function AIInsightsPage() {
  const token = sessionStorage.getItem('access_token')
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchAnalysis(token)
      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to load AI insights.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const getTrendClass = (trend) => {
    const t = (trend || '').toLowerCase()
    if (t.includes('improving')) return 'trend-improving'
    if (t.includes('worsening')) return 'trend-worsening'
    if (t.includes('mixed')) return 'trend-mixed'
    if (t.includes('insufficient')) return 'trend-insufficient'
    return 'trend-stable'
  }

  const getSentimentClass = (sentiment) => {
    const s = (sentiment || '').toLowerCase()
    if (s === 'positive') return 'sentiment-positive'
    if (s === 'negative') return 'sentiment-negative'
    if (s === 'mixed') return 'sentiment-mixed'
    return 'sentiment-neutral'
  }

  const chartMetrics = data?.has_sufficient_data
    ? [
        { name: 'Avg Mood', value: data.average_mood, color: '#087b70' },
        { name: 'Avg Stress', value: data.average_stress, color: '#dd6b20' },
        { name: 'Avg Energy', value: data.average_energy, color: '#2b6cb0' },
      ]
    : []

  return (
    <div id="ai-insights-page" className="page-shell">
      {/* Sub-navigation tabs */}
      <div className="nav-subtabs">
        <button
          id="tab-mood-tracker"
          className="nav-subtab"
          onClick={() => navigate('/patient/mood-tracker')}
        >
          Daily Check-in & Mood Tracker
        </button>
        <button
          id="tab-symptoms"
          className="nav-subtab"
          onClick={() => navigate('/patient/symptoms')}
        >
          Symptom Log
        </button>
        <button
          id="tab-ai-insights"
          className="nav-subtab active"
          onClick={() => navigate('/patient/ai-insights')}
        >
          ✦ AI Insights
        </button>
      </div>

      {/* Page Header */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow-tag">AI Wellbeing Analysis</span>
          <h1 style={{ margin: '6px 0 4px', fontSize: '1.75rem', color: '#10393b' }}>
            Pattern Analysis & Supportive Insights
          </h1>
          <p style={{ color: '#567577', margin: 0 }}>
            Supportive, non-diagnostic reflections grounded strictly in your recorded check-in metrics.
          </p>
        </div>
        <button
          id="refresh-insights-btn"
          className="button button-outline"
          onClick={loadData}
          disabled={loading}
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? 'Analyzing...' : 'Refresh Insights'}
        </button>
      </div>

      {/* Safety Alert Box (if triggered) */}
      {data?.safety_message && (
        <div id="safety-alert-card" className="crisis-box" role="alert">
          <h3>
            <span aria-hidden="true">⚠️</span> Urgent Wellness & Safety Notice
          </h3>
          <p>{data.safety_message}</p>
          <div className="crisis-links">
            <a
              href="tel:988"
              className="crisis-btn"
              aria-label="Call 988 Suicide & Crisis Lifeline"
            >
              📞 Call or Text 988 Lifeline
            </a>
            <a
              href="https://988lifeline.org"
              target="_blank"
              rel="noopener noreferrer"
              className="crisis-btn"
              style={{ background: '#742a2a' }}
            >
              988 Online Chat & Resources
            </a>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: '#087b70', fontWeight: 600, fontSize: '1.05rem', margin: 0 }}>
            Analyzing your wellbeing patterns and check-in history...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="card" style={{ borderColor: '#f8b4b4', background: '#fff5f5' }}>
          <p style={{ color: '#9b2c2c', margin: 0 }}>{error}</p>
          <button
            className="button button-primary"
            style={{ marginTop: 12 }}
            onClick={loadData}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Insufficient data state */}
      {data && !data.has_sufficient_data && !loading && (
        <div id="insufficient-data-card" className="card" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#e4f3f1',
              color: '#087b70',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              margin: '0 auto 16px',
            }}
          >
            📊
          </div>
          <h2 style={{ fontSize: '1.3rem', color: '#163e41', margin: '0 0 10px' }}>
            Not Enough Data Yet
          </h2>
          <p
            style={{
              maxWidth: 580,
              margin: '0 auto 24px',
              color: '#496b6d',
              fontSize: '1rem',
              lineHeight: 1.6,
            }}
          >
            {data.summary}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/patient/mood-tracker" className="button button-primary">
              Log Today's Mood
            </Link>
            <Link to="/patient/symptoms" className="button button-outline">
              Log Symptoms
            </Link>
          </div>
        </div>
      )}

      {/* Active Analysis Results */}
      {data && data.has_sufficient_data && (
        <div id="insights-content-container" style={{ display: 'grid', gap: 24 }}>
          {/* Overall Summary Box */}
          <div id="insight-summary-card" className="insight-summary-box">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Overall Wellbeing Summary</h3>
              <span className={`trend-pill ${getTrendClass(data.trend)}`}>
                Trend: {data.trend}
              </span>
            </div>
            <p>{data.summary}</p>
          </div>

          {/* Metric Comparison Grid */}
          <div
            id="metrics-comparison-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <div id="stat-mood-card" className="stat-metric-card">
              <small>Average Mood</small>
              <strong>{data.average_mood} / 10</strong>
              <span className={`trend-pill ${getTrendClass(data.mood_direction)}`}>
                {data.mood_direction}
              </span>
            </div>

            <div id="stat-stress-card" className="stat-metric-card">
              <small>Average Stress</small>
              <strong style={{ color: '#dd6b20' }}>{data.average_stress} / 10</strong>
              <span className={`trend-pill ${getTrendClass(data.stress_direction)}`}>
                {data.stress_direction}
              </span>
            </div>

            <div id="stat-energy-card" className="stat-metric-card">
              <small>Average Energy</small>
              <strong style={{ color: '#2b6cb0' }}>{data.average_energy} / 10</strong>
              <span className={`trend-pill ${getTrendClass(data.energy_direction)}`}>
                {data.energy_direction}
              </span>
            </div>

            <div id="stat-emotion-card" className="stat-metric-card">
              <small>Dominant Emotion</small>
              <strong style={{ color: '#163e41', fontSize: '1.35rem', marginTop: 4 }}>
                {data.dominant_emotion}
              </strong>
              <span className={`sentiment-pill ${getSentimentClass(data.sentiment)}`}>
                Sentiment: {data.sentiment}
              </span>
            </div>
          </div>

          {/* Emotional Language & Visual Metrics in 2 columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {/* Visual Overview Chart */}
            <div id="averages-chart-card" className="card">
              <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', color: '#163e41' }}>
                Key Metric Comparison
              </h3>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMetrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#527072" fontSize={12} />
                    <YAxis domain={[0, 10]} stroke="#527072" fontSize={12} />
                    <Tooltip
                      formatter={(val) => [`${val} / 10`, 'Average']}
                      contentStyle={{ borderRadius: 8, borderColor: '#dcece8' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Emotional Signals & Symptoms */}
            <div id="signals-card" className="card">
              <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', color: '#163e41' }}>
                Observed Emotional Signals
              </h3>
              <div style={{ marginBottom: 16 }}>
                <small style={{ color: '#567577', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                  EMOTIONAL INDICATORS IDENTIFIED
                </small>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.emotional_indicators && data.emotional_indicators.length > 0 ? (
                    data.emotional_indicators.map((ind) => (
                      <span
                        key={ind}
                        style={{
                          background: '#e4f3f1',
                          color: '#087b70',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          padding: '4px 10px',
                          borderRadius: 14,
                        }}
                      >
                        {ind}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#688688', fontSize: '0.88rem' }}>
                      No prominent emotional keywords recorded.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <small style={{ color: '#567577', display: 'block', marginBottom: 6, fontWeight: 700 }}>
                  FREQUENTLY REPORTED SYMPTOMS
                </small>
                {data.frequent_symptoms && data.frequent_symptoms.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#254b4e', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {data.frequent_symptoms.map((s) => (
                      <li key={s.name}>
                        <strong>{s.name}</strong> — recorded {s.count} time{s.count === 1 ? '' : 's'} (avg severity: {s.average_severity}/10)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: '#688688', fontSize: '0.88rem' }}>
                    No symptoms logged in the analyzed timeframe.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Key Patterns Section */}
          <div id="key-patterns-card" className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.2rem' }}>🔍</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#163e41' }}>
                Identified Patterns
              </h3>
            </div>
            <p style={{ color: '#587779', fontSize: '0.9rem', margin: '0 0 12px' }}>
              Observations derived directly from your check-ins and symptom logs:
            </p>
            <div className="patterns-container">
              {data.key_patterns && data.key_patterns.map((pat, idx) => (
                <div key={idx} className="pattern-item">
                  <span className="pattern-bullet">{idx + 1}</span>
                  <p className="pattern-text">{pat}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Personalized Wellness Recommendations */}
          <div id="recommendations-card" className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.2rem' }}>🌿</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#163e41' }}>
                Personalized Wellness Recommendations
              </h3>
            </div>
            <p style={{ color: '#587779', fontSize: '0.9rem', margin: '0 0 14px' }}>
              Practical, non-clinical wellness habits recommended based on your recent stress and energy levels:
            </p>
            <div className="recommendations-container">
              {data.recommendations && data.recommendations.map((rec, idx) => (
                <div key={idx} className="recommendation-card">
                  <div className="recommendation-header">
                    <span className="recommendation-badge">Suggestion {idx + 1}</span>
                  </div>
                  <p>{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Safety & Non-Diagnostic Disclaimer */}
      <div
        id="medical-disclaimer-box"
        style={{
          marginTop: 32,
          padding: '16px 20px',
          borderRadius: 10,
          background: '#eef5f5',
          border: '1px solid #d0e4e2',
          color: '#3d6163',
          fontSize: '0.86rem',
          lineHeight: 1.5,
        }}
      >
        <strong>Medical & Crisis Disclaimer:</strong> AI insights are for informational and wellness purposes only and are not a medical diagnosis. If you are experiencing a mental health crisis or feel that you may be in immediate danger, contact a qualified mental health professional or local emergency/crisis service.
      </div>
    </div>
  )
}
