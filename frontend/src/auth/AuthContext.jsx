import { createContext, useContext, useEffect, useState } from 'react'
const AuthContext = createContext(null)
const API_URL = import.meta.env.VITE_API_URL || ''
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true)
  const fetchCurrentUser = async (token) => { const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Your session has expired. Please sign in again.'); const currentUser = await response.json(); setUser(currentUser); return currentUser }
  useEffect(() => { const token = sessionStorage.getItem('access_token'); if (!token) { setLoading(false); return } fetchCurrentUser(token).catch(() => sessionStorage.removeItem('access_token')).finally(() => setLoading(false)) }, [])
  const authenticate = async (endpoint, payload) => { const response = await fetch(`${API_URL}/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Something went wrong. Please try again.'); sessionStorage.setItem('access_token', body.access_token); return fetchCurrentUser(body.access_token) }
  const logout = () => { sessionStorage.removeItem('access_token'); setUser(null) }
  return <AuthContext.Provider value={{ user, loading, authenticate, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
