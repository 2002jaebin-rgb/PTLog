import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'

import Header from './components/Header'

// 페이지들
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberDetail from './pages/MemberDetail'
import ClientPage from './pages/ClientPage'
import Settings from './pages/Settings'
import TrainerReservation from './pages/TrainerReservation'
import ClientReservation from './pages/ClientReservation'
import TrainerSchedule from './pages/TrainerSchedule'

import './styles/theme.css'

// 보호 라우트
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user ?? null)
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[PTLog] Auth event:', event)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="text-center mt-10">Loading...</div>

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
        {/* 전역 user 상태를 Header에 전달 */}
        <Header user={user} />

        <main className="p-4 max-w-3xl mx-auto">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />

            <Route path="/dashboard" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
            <Route path="/member/:id" element={<ProtectedRoute user={user}><MemberDetail /></ProtectedRoute>} />
            <Route path="/trainer-reservation" element={<ProtectedRoute user={user}><TrainerReservation /></ProtectedRoute>} />
            <Route path="/client-reservation" element={<ProtectedRoute user={user}><ClientReservation /></ProtectedRoute>} />
            <Route path="/client" element={<ProtectedRoute user={user}><ClientPage /></ProtectedRoute>} />
            <Route path="/trainer-schedule" element={<ProtectedRoute user={user}><TrainerSchedule /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute user={user}><Settings /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
