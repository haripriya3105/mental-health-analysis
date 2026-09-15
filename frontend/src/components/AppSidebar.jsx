import { NavLink } from 'react-router-dom'

const navigation = {
  patient: ['Dashboard', 'Profile', 'Assessment', 'Mood Tracker', 'Symptoms', 'Journal', 'AI Insights', 'Recommendations', 'Progress Reports', 'Therapy', 'Notifications'],
  therapist: ['Dashboard', 'Profile', 'Patients', 'Reports', 'Recommendations', 'Therapy Notes', 'Notifications'],
}

const toPath = (label) => label === 'Dashboard' ? '' : `/${label.toLowerCase().replaceAll(' ', '-')}`

export default function AppSidebar({ role, isOpen, onClose, onLogout }) {
  const basePath = `/${role}`
  return <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
    <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">M</span><span>Mindful Care</span><button className="mobile-close" aria-label="Close navigation" onClick={onClose}>×</button></div>
    <p className="sidebar-label">{role === 'patient' ? 'Your wellbeing' : 'Practice workspace'}</p>
    <nav>{navigation[role].map((item) => <NavLink key={item} end={item === 'Dashboard'} to={`${basePath}${toPath(item)}`} onClick={onClose}>{item}</NavLink>)}</nav>
    <button className="logout-button" onClick={onLogout}>Log out</button>
  </aside>
}
