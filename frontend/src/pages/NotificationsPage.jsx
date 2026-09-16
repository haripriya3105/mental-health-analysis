import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || ''

function formatNotificationTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTypeBadge(type) {
  switch (type) {
    case 'SESSION_REMINDER':
      return { label: 'Session Reminder', className: 'notif-badge notif-badge-reminder' }
    case 'SESSION_REQUEST':
      return { label: 'Session Request', className: 'notif-badge notif-badge-info' }
    case 'SESSION_ACCEPTED':
    case 'SESSION_SCHEDULED':
      return { label: 'Confirmed', className: 'notif-badge notif-badge-success' }
    case 'SESSION_RESCHEDULED':
      return { label: 'Rescheduled', className: 'notif-badge notif-badge-warning' }
    case 'SESSION_CANCELLED':
    case 'SESSION_REJECTED':
      return { label: 'Cancelled', className: 'notif-badge notif-badge-danger' }
    case 'THERAPIST_REQUEST':
      return { label: 'Connection Request', className: 'notif-badge notif-badge-info' }
    case 'THERAPIST_REQUEST_ACCEPTED':
      return { label: 'Connected', className: 'notif-badge notif-badge-success' }
    case 'THERAPIST_REQUEST_REJECTED':
      return { label: 'Request Declined', className: 'notif-badge notif-badge-danger' }
    case 'TREND_SIGNAL':
      return { label: 'Trend signal', className: 'notif-badge notif-badge-warning' }
    case 'SAFETY_SIGNAL':
      return { label: 'Safety signal', className: 'notif-badge notif-badge-danger' }
    case 'REPORT_AVAILABLE':
      return { label: 'Report Available', className: 'notif-badge notif-badge-info' }
    default:
      return { label: type ? type.replace(/_/g, ' ') : 'Notice', className: 'notif-badge notif-badge-default' }
  }
}

export default function NotificationsPage({ role }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL') // 'ALL', 'UNREAD', 'SESSIONS', 'ALERTS'
  const [markingAll, setMarkingAll] = useState(false)
  const navigate = useNavigate()

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error('Unable to load notifications. Please try again.')
      }

      const data = await res.json()
      setNotifications(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Unable to load notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation()
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        )
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNotificationClick = (notif) => {
    // If unread, mark it as read
    if (!notif.read) {
      handleMarkAsRead(notif.id)
    }

    // Optional navigation based on related resource
    if (notif.related_type === 'session') {
      if (role === 'patient') {
        navigate('/patient/therapy')
      } else {
        navigate('/therapist/sessions')
      }
    } else if (notif.related_type === 'therapist_relationship') {
      if (role === 'patient') {
        navigate('/patient/therapy')
      } else {
        navigate('/therapist/patients')
      }
    } else if (notif.related_type === 'patient_progress') {
      if (role === 'therapist' && notif.related_id) {
        navigate(`/therapist/patients/${notif.related_id}`)
      }
    } else if (notif.related_type === 'report') {
      if (role === 'patient') {
        navigate('/patient/progress-reports')
      } else {
        navigate('/therapist/reports')
      }
    }
  }

  // Filter items
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.read
    if (activeFilter === 'SESSIONS') {
      return (
        n.type?.startsWith('SESSION_') ||
        n.related_type === 'session'
      )
    }
    if (activeFilter === 'ALERTS') {
      return (
        n.type === 'TREND_SIGNAL' ||
        n.type === 'SAFETY_SIGNAL' ||
        n.type?.startsWith('THERAPIST_')
      )
    }
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="notifications-container">
      <div className="panel-heading" style={{ alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', color: '#143e43' }}>Notifications</h1>
          <p style={{ margin: 0, color: '#5b7379', fontSize: '0.92rem' }}>
            Stay updated on therapy sessions, care coordination, and wellbeing trends.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            id="btn-mark-all-read"
            className="secondary-button compact-button"
            disabled={markingAll}
            onClick={handleMarkAllAsRead}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs" style={{ marginBottom: 18 }}>
        <button
          className={`filter-tab ${activeFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveFilter('ALL')}
        >
          All ({notifications.length})
        </button>
        <button
          className={`filter-tab ${activeFilter === 'UNREAD' ? 'active' : ''}`}
          onClick={() => setActiveFilter('UNREAD')}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          className={`filter-tab ${activeFilter === 'SESSIONS' ? 'active' : ''}`}
          onClick={() => setActiveFilter('SESSIONS')}
        >
          Sessions
        </button>
        <button
          className={`filter-tab ${activeFilter === 'ALERTS' ? 'active' : ''}`}
          onClick={() => setActiveFilter('ALERTS')}
        >
          Care & Alerts
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <section className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: '#5c787a', fontSize: '1rem' }}>Loading notifications...</p>
        </section>
      )}

      {/* Error state */}
      {!loading && error && (
        <section className="panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div className="error" style={{ display: 'inline-block', maxWidth: 440, margin: '0 0 16px' }}>
            {error}
          </div>
          <div>
            <button className="primary-button compact-button" onClick={fetchNotifications}>
              Retry
            </button>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && !error && filteredNotifications.length === 0 && (
        <section className="panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div className="empty-symbol" style={{ fontSize: '2rem', marginBottom: 10 }}>✓</div>
          <h2 style={{ color: '#163e41', margin: '0 0 8px' }}>You’re all caught up</h2>
          <p style={{ color: '#688486', margin: 0, fontSize: '0.94rem' }}>
            {activeFilter === 'ALL'
              ? 'New notifications will appear here.'
              : `No notifications found in the ${activeFilter.toLowerCase()} view.`}
          </p>
        </section>
      )}

      {/* Notifications list */}
      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="notifications-list">
          {filteredNotifications.map((notif) => {
            const badge = getTypeBadge(notif.type)
            const hasLink = Boolean(notif.related_type)

            return (
              <article
                key={notif.id}
                id={`notification-${notif.id}`}
                className={`notification-item ${notif.read ? 'notif-read' : 'notif-unread'} ${hasLink ? 'notif-clickable' : ''}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="notif-indicator-column">
                  {!notif.read ? (
                    <span className="notif-dot" title="Unread notification" />
                  ) : (
                    <span className="notif-dot-read" />
                  )}
                </div>

                <div className="notif-content-column">
                  <div className="notif-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={badge.className}>{badge.label}</span>
                      <strong className="notif-title">{notif.title}</strong>
                    </div>
                    <time className="notif-time">{formatNotificationTime(notif.created_at)}</time>
                  </div>

                  <p className="notif-message">{notif.message}</p>

                  <div className="notif-footer">
                    {hasLink && (
                      <span className="notif-action-hint">
                        Click to view details →
                      </span>
                    )}

                    {!notif.read && (
                      <button
                        className="text-button notif-mark-read-btn"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
