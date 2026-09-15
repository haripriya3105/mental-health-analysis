import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'

function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/patient/*" element={<ProtectedRoute role="patient"><DashboardPage role="patient" /></ProtectedRoute>} /><Route path="/therapist/*" element={<ProtectedRoute role="therapist"><DashboardPage role="therapist" /></ProtectedRoute>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
}

export default App
