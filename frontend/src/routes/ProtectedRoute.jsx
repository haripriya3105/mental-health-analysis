import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
export default function ProtectedRoute({ children, role }) { const { user, loading } = useAuth(); if (loading) return <main className="auth-page">Loading your secure session…</main>; if (!user) return <Navigate to="/login" replace />; if (role && user.role !== role) return <Navigate to={`/${user.role}`} replace />; return children }
