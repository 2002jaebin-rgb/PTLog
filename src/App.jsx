import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import ErrorBoundary from './ErrorBoundary'

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
import TrainerLog from './pages/TrainerLog'
import ClientHistory from './pages/ClientHistory'
import ClientLog from './pages/ClientLog'
import MemberList from './pages/MemberList'

import './styles/theme.css'

// 보호 라우트
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ✅ 항상 유효한 엘리먼트를 반환하도록 한 로그인 라우트 가드
function LoginRoute({ user }) {
  // user 판별 중(초기 undefined)에도 null을 반환하지 않도록 안전 가드
  if (user === undefined) {
    return <div className="text-center mt-10">Loading...</div>
  }
  return user ? <Navigate to="/dashboard" replace /> : <Login />
}

export default function App() {
  // ✅ 초기값을 undefined로 두어 '판별 중' 상태를 구분
  const [user, setUser] = useState(undefined)
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
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col">
          {/* 전역 user 상태를 Header에 전달 */}
          <Header user={user} />

          <main className="flex-1 p-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-8 max-w-3xl w-full mx-auto">
            <Routes>
              {/* ✅ 항상 유효한 엘리먼트를 반환하도록 래퍼 사용 */}
              <Route path="/login" element={<LoginRoute user={user} />} />

              <Route path="/dashboard" element={<ProtectedRoute user={user}><Dashboard /></ProtectedRoute>} />
              <Route path="/member/:id" element={<ProtectedRoute user={user}><MemberDetail /></ProtectedRoute>} />
              <Route path="/trainer-reservation" element={<ProtectedRoute user={user}><TrainerReservation /></ProtectedRoute>} />
              <Route path="/client-reservation" element={<ProtectedRoute user={user}><ClientReservation /></ProtectedRoute>} />
              <Route path="/client" element={<ProtectedRoute user={user}><ClientPage /></ProtectedRoute>} />
              <Route path="/trainer-schedule" element={<ProtectedRoute user={user}><TrainerSchedule /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute user={user}><Settings /></ProtectedRoute>} />
              <Route path="/trainer-log" element={<ProtectedRoute user={user}><TrainerLog /></ProtectedRoute>} />
              <Route path="/client-history" element={<ProtectedRoute user={user}><ClientHistory /></ProtectedRoute>} />
              <Route path="/client-log" element={<ProtectedRoute user={user}><ClientLog /></ProtectedRoute>} />
              <Route path="/member-list" element={<ProtectedRoute user={user}><MemberList /></ProtectedRoute>} />

              <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
