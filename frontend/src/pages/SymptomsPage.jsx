import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

const COMMON_SYMPTOMS = [
  'Headache',
  'Fatigue',
  'Insomnia / Sleep disruption',
  'Anxiety / Racing thoughts',
  'Muscle tension',
  'Brain fog',
  'Restlessness',
  'Low motivation',
  'Irritability',
  'Nausea',
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

export default function SymptomsPage() {
  const token = sessionStorage.getItem('access_token')
  const navigate = useNavigate()

  // Form state
  const [symptomName, setSymptomName] = useState('')
  const [severity, setSeverity] = useState(5)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')
  const [formError, setFormError] = useState('')

  // List state
  const [symptoms, setSymptoms] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const loadSymptoms = async () => {
    try {
      const data = await api('/api/symptoms/history', token)
      setSymptoms(data)
    } catch (err) {
      console.error('Failed to load symptoms:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSymptoms()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!symptomName.trim()) {
      setFormError('Please choose or enter a symptom name.')
      return
    }

    setSubmitting(true)
    try {
      await api('/api/symptoms', token, {
        method: 'POST',
        body: JSON.stringify({
          symptom_name: symptomName.trim(),
          severity: Number(severity),
          notes: notes.trim() || null,
        }),
      })

      setFormSuccess('Symptom entry logged successfully.')
      setSymptomName('')
      setSeverity(5)
      setNotes('')
      await loadSymptoms()
    } catch (err) {
      setFormError(err.message || 'Failed to save symptom.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this symptom log entry?')) {
      return
    }

    setDeletingId(id)
    try {
      await api(`/api/symptoms/${id}`, token, { method: 'DELETE' })
      setSymptoms((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete symptom.')
    } finally {
      setDeletingId(null)
    }
  }

  const getSeverityBadgeClass = (score) => {
    if (score <= 3) return 'severity-pill severity-low'
    if (score <= 6) return 'severity-pill severity-med'
    return 'severity-pill severity-high'
  }

  return (
    <>
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
          className="nav-subtab active"
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
        <p className="eyebrow">Physical & Cognitive Symptoms</p>
        <h1>Symptom Tracker</h1>
        <p>
          Log physical and cognitive symptoms to notice patterns alongside your mood and daily
          routine.
        </p>
      </section>

      <div className="dashboard-grid">
        {/* Track a Symptom Form */}
        <section className="panel span-two">
          <div className="panel-heading">
            <div>
              <h2>Track a Symptom</h2>
              <p>Record what you are experiencing and its current intensity.</p>
            </div>
          </div>

          {formSuccess && (
            <div id="symptom-success-alert" className="success-banner" role="status">
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
            <div id="symptom-error-alert" className="error" role="alert">
              {formError}
            </div>
          )}

          <form id="symptom-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="symptom-name-input">Symptom Name</label>
              <input
                id="symptom-name-input"
                type="text"
                placeholder="e.g. Headache, Muscle tension, Fatigue..."
                value={symptomName}
                onChange={(e) => setSymptomName(e.target.value)}
                maxLength={100}
                required
              />

              <div style={{ marginTop: '8px' }}>
                <small style={{ color: '#688283', fontWeight: 600 }}>Quick suggestions:</small>
                <div className="chips-grid" style={{ marginTop: '6px' }}>
                  {COMMON_SYMPTOMS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`chip-button ${symptomName === name ? 'active' : ''}`}
                      onClick={() => setSymptomName(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Severity Slider */}
            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="symptom-severity-slider">Severity (1 to 10)</label>
                <span className={getSeverityBadgeClass(severity)}>{severity} / 10</span>
              </div>
              <input
                id="symptom-severity-slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="slider-control"
              />
              <div className="slider-labels">
                <span>1 - Mild / Barely noticeable</span>
                <span>5 - Moderate / Noticeable</span>
                <span>10 - Severe / Disabling</span>
              </div>
            </div>

            {/* Notes */}
            <div className="form-field">
              <label htmlFor="symptom-notes">Notes (optional)</label>
              <textarea
                id="symptom-notes"
                className="form-textarea"
                placeholder="Triggers, context, time of day, or actions taken..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
              />
            </div>

            <button
              id="save-symptom-btn"
              type="submit"
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? 'Saving Symptom…' : 'Save Symptom'}
            </button>
          </form>
        </section>
      </div>

      {/* Symptoms List / Table */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-heading">
          <div>
            <h2>Recent Tracked Symptoms</h2>
            <p>List of symptoms you have reported.</p>
          </div>
        </div>

        {symptoms.length === 0 ? (
          <EmptyState
            title="No symptoms tracked yet"
            message="Use the form above to log any symptoms you experience throughout your day."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table" aria-label="Symptom History">
              <thead>
                <tr>
                  <th>Symptom Name</th>
                  <th>Severity</th>
                  <th>Date & Time</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {symptoms.map((item) => (
                  <tr key={item.id} id={`symptom-row-${item.id}`}>
                    <td>
                      <strong>{item.symptom_name}</strong>
                    </td>
                    <td>
                      <span className={getSeverityBadgeClass(item.severity)}>
                        {item.severity} / 10
                      </span>
                    </td>
                    <td>
                      <span>
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <br />
                      <small style={{ color: '#7c9697' }}>
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </td>
                    <td style={{ maxWidth: '280px', color: item.notes ? '#345254' : '#8fa2a3' }}>
                      {item.notes || '—'}
                    </td>
                    <td>
                      <button
                        id={`delete-symptom-${item.id}`}
                        className="delete-btn"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Delete ${item.symptom_name}`}
                      >
                        {deletingId === item.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="safety-note">
        <strong>Important Safety Notice:</strong> Symptom tracking is for personal awareness and
        convenient self-reporting. It is not an automated medical diagnosis or a substitute for
        medical advice. If you experience severe, acute, or sudden symptoms, please contact your
        physician or local emergency services immediately.
      </aside>
    </>
  )
}
