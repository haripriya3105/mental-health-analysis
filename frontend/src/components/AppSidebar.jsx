import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || ''

const navigation = {
  patient: ['Dashboard', 'Profile', 'Assessment', 'Mood Tracker', 'Symptoms', 'Journal', 'AI Insights', 'Recommendations', 'Progress Reports', 'Therapy', 'Notifications'],
  therapist: ['Dashboard', 'Profile', 'Patients', 'Sessions', 'Reports', 'Recommendations', 'Therapy Notes', 'Notifications'],
}

const toPath = (label) => label === 'Dashboard' ? '' : `/${label.toLowerCase().replaceAll(' ', '-')}`

export default function AppSidebar({ role, isOpen, onClose, onLogout, unreadCount: propUnreadCount }) {
  const [unreadCount, setUnreadCount] = useState(propUnreadCount ?? 0)
  const basePath = `/${role}`

  useEffect(() => {
    if (propUnreadCount !== undefined) {
      setUnreadCount(propUnreadCount)
      return
    }

    let isMounted = true
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (isMounted) setUnreadCount(data.count ?? data.unread_count ?? 0)
        }
      } catch {
        // quiet fail
      }
    }

    fetchCount()
    const timer = setInterval(fetchCount, 20000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [propUnreadCount])

  return <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
    <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">M</span><span>Mindful Care</span><button className="mobile-close" aria-label="Close navigation" onClick={onClose}>×</button></div>
    <p className="sidebar-label">{role === 'patient' ? 'Your wellbeing' : 'Practice workspace'}</p>
    <nav>{navigation[role].map((item) => (
      <NavLink key={item} end={item === 'Dashboard'} to={`${basePath}${toPath(item)}`} onClick={onClose}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>{item}</span>
          {item === 'Notifications' && unreadCount > 0 && (
            <span className="sidebar-badge">{unreadCount}</span>
          )}
        </span>
      </NavLink>
    ))}</nav>
    <button className="logout-button" onClick={onLogout}>Log out</button>
  </aside>
}
