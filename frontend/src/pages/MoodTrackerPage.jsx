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

const EMOTIONAL_STATES = [
  'Happy',
  'Calm',
  'Neutral',
  'Sad',
  'Anxious',
  'Angry',
  'Tired',
  'Other',
]

async function api(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail || 'Unable to complete this request.')
  return body
}

export default function MoodTrackerPage() {
  const token = sessionStorage.getItem('access_token')
  const navigate = useNavigate()

  // Form State
  const [moodScore, setMoodScore] = useState(7)
  const [stressLevel, setStressLevel] = useState(4)
  const [energyLevel, setEnergyLevel] = useState(6)
  const [emotionalState, setEmotionalState] = useState('Calm')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')
  const [formError, setFormError] = useState('')

  // Data State
  const [history, setHistory] = useState([])
  const [trends, setTrends] = useState([])
  const [activeDays, setActiveDays] = useState(30)
  const [loading, setLoading] = useState(true)

  const loadData = async (days = activeDays) => {
    try {
      const [historyData, trendData] = await Promise.all([
        api('/api/mood/history', token),
        api(`/api/mood/trends?days=${days}`, token),
      ])
      setHistory(historyData)
      setTrends(trendData)
    } catch (err) {
      console.error('Failed to load mood data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(activeDays)
  }, [activeDays])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!emotionalState) {
      setFormError('Please select your current emotional state.')
      return
    }

    setSubmitting(true)
    try {
      await api('/api/mood', token, {
        method: 'POST',
        body: JSON.stringify({
          mood_score: Number(moodScore),
          stress_level: Number(stressLevel),
          energy_level: Number(energyLevel),
          emotional_state: emotionalState,
          notes: notes.trim() || null,
        }),
      })

      setFormSuccess('Daily check-in saved successfully! Your trends have been updated.')
      // Reset form
      setMoodScore(7)
      setStressLevel(4)
      setEnergyLevel(6)
      setEmotionalState('Calm')
      setNotes('')

      // Refresh data
      await loadData(activeDays)
    } catch (err) {
      setFormError(err.message || 'Failed to save check-in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="nav-subtabs">
        <button
          id="tab-mood-tracker"
          className="nav-subtab active"
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
          className="nav-subtab"
          onClick={() => navigate('/patient/ai-insights')}
        >
          ✦ AI Insights
        </button>
      </div>

      <section className="hero">
        <p className="eyebrow">Mindful Check-in</p>
        <h1>Mood & Wellbeing Tracker</h1>
        <p>
          Take a minute to observe your mood, stress, and energy today. Consistent check-ins help
          you notice your wellbeing patterns over time.
        </p>
      </section>

      <div className="dashboard-grid">
        {/* Daily Check-in Form */}
        <section className="panel span-two">
          <div className="panel-heading">
            <div>
              <h2>Daily Check-in</h2>
              <p>How are you feeling today?</p>
            </div>
          </div>

          {formSuccess && (
            <div id="checkin-success-alert" className="success-banner" role="status">
              <span>{formSuccess}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => setFormSuccess('')}
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {formError && (
            <div id="checkin-error-alert" className="error" role="alert">
              {formError}
            </div>
          )}

          <form id="daily-checkin-form" onSubmit={handleSubmit}>
            {/* Mood Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="mood-slider">Mood Score</label>
                <span className="score-indicator">{moodScore} / 10</span>
              </div>
              <input
                id="mood-slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                className="slider-control"
              />
              <div className="slider-labels">
                <span>1 - Very Low</span>
                <span>5 - Moderate</span>
                <span>10 - Very High</span>
              </div>
            </div>

            {/* Stress Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="stress-slider">Stress Level</label>
                <span className="score-indicator">{stressLevel} / 10</span>
              </div>
              <input
                id="stress-slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={stressLevel}
                onChange={(e) => setStressLevel(Number(e.target.value))}
                className="slider-control"
              />
              <div className="slider-labels">
                <span>1 - Very Relaxed</span>
                <span>5 - Moderate Pressure</span>
                <span>10 - High Stress</span>
              </div>
            </div>

            {/* Energy Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="energy-slider">Energy Level</label>
                <span className="score-indicator">{energyLevel} / 10</span>
              </div>
              <input
                id="energy-slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={energyLevel}
                onChange={(e) => setEnergyLevel(Number(e.target.value))}
                className="slider-control"
              />
              <div className="slider-labels">
                <span>1 - Exhausted</span>
                <span>5 - Steady</span>
                <span>10 - Fully Energized</span>
              </div>
            </div>

            {/* Emotional State Selection */}
            <div className="form-field" style={{ margin: '22px 0 10px' }}>
              <label>Emotional State</label>
              <div className="chips-grid" role="radiogroup" aria-label="Emotional State">
                {EMOTIONAL_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    role="radio"
                    aria-checked={emotionalState === state}
                    className={`chip-button ${emotionalState === state ? 'active' : ''}`}
                    onClick={() => setEmotionalState(state)}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="form-field">
              <label htmlFor="mood-notes">Notes (optional)</label>
              <textarea
                id="mood-notes"
                className="form-textarea"
                placeholder="Add any reflections, events, or self-care notes for today..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
              />
            </div>

            <button
              id="save-checkin-btn"
              type="submit"
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? 'Saving Check-in…' : 'Save Check-in'}
            </button>
          </form>
        </section>
      </div>

      {/* Visual Analytics */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-heading" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2>Visual Analytics & Trends</h2>
            <p>Track your score trends over time to identify what supports your wellbeing.</p>
          </div>
          <div className="filter-tabs" role="tablist" aria-label="Timeframe filter">
            <button
              id="filter-7-days"
              className={`filter-tab ${activeDays === 7 ? 'active' : ''}`}
              onClick={() => setActiveDays(7)}
            >
              Last 7 days
            </button>
            <button
              id="filter-30-days"
              className={`filter-tab ${activeDays === 30 ? 'active' : ''}`}
              onClick={() => setActiveDays(30)}
            >
              Last 30 days
            </button>
            <button
              id="filter-90-days"
              className={`filter-tab ${activeDays === 90 ? 'active' : ''}`}
              onClick={() => setActiveDays(90)}
            >
              Last 90 days
            </button>
          </div>
        </div>

        {trends.length === 0 ? (
          <EmptyState
            title="No trend data yet"
            message={`No check-in entries recorded within the last ${activeDays} days. Submit a check-in to see your chart trends.`}
          />
        ) : (
          <div className="dashboard-grid" style={{ marginTop: '12px' }}>
            {/* 1. Mood Trend */}
            <div className="panel" style={{ background: '#fafdfd' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '4px' }}>1. Mood Trend</h2>
              <p style={{ fontSize: '0.82rem', color: '#688283', margin: '0 0 12px' }}>
                Scale 1 (Low) to 10 (High)
              </p>
              <div className="chart-container-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <Tooltip
                      formatter={(val) => [`${val} / 10`, 'Mood Score']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.full_date || label}
                    />
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
            </div>

            {/* 2. Stress Trend */}
            <div className="panel" style={{ background: '#fafdfd' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '4px' }}>2. Stress Trend</h2>
              <p style={{ fontSize: '0.82rem', color: '#688283', margin: '0 0 12px' }}>
                Scale 1 (Relaxed) to 10 (High Stress)
              </p>
              <div className="chart-container-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <Tooltip
                      formatter={(val) => [`${val} / 10`, 'Stress Level']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.full_date || label}
                    />
                    <Line
                      type="monotone"
                      dataKey="stress_level"
                      name="Stress"
                      stroke="#b56317"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#b56317' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Energy Trend */}
            <div className="panel span-two" style={{ background: '#fafdfd' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '4px' }}>3. Energy Trend</h2>
              <p style={{ fontSize: '0.82rem', color: '#688283', margin: '0 0 12px' }}>
                Scale 1 (Exhausted) to 10 (Energized)
              </p>
              <div className="chart-container-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3eceb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} tick={{ fontSize: 11, fill: '#6c8789' }} />
                    <Tooltip
                      formatter={(val) => [`${val} / 10`, 'Energy Level']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.full_date || label}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy_level"
                      name="Energy"
                      stroke="#1e7399"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1e7399' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mood History List */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-heading">
          <div>
            <h2>Past Check-ins</h2>
            <p>Your logged daily check-in records.</p>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState
            title="No check-ins yet"
            message="Your daily check-ins will be logged here for easy review."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table" aria-label="Mood Check-in History">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Mood</th>
                  <th>Stress</th>
                  <th>Energy</th>
                  <th>State</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                      <br />
                      <small style={{ color: '#7c9697' }}>
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </td>
                    <td>
                      <span className="score-indicator">{item.mood_score} / 10</span>
                    </td>
                    <td>
                      <span>{item.stress_level} / 10</span>
                    </td>
                    <td>
                      <span>{item.energy_level} / 10</span>
                    </td>
                    <td>
                      <span className="chip-button" style={{ cursor: 'default', padding: '3px 10px', fontSize: '0.78rem' }}>
                        {item.emotional_state}
                      </span>
                    </td>
                    <td style={{ maxWidth: '280px', color: item.notes ? '#345254' : '#8fa2a3' }}>
                      {item.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="safety-note">
        <strong>Important Safety Notice:</strong> Mood and symptom tracking is designed for personal
        awareness and routine self-reflection only. It does not provide medical or mental health
        diagnosis, clinical evaluation, or treatment prescriptions. If you are experiencing a mental
        health crisis or severe distress, please reach out to a licensed healthcare professional or
        local emergency crisis services.
      </aside>
    </>
  )
}
