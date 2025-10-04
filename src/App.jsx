import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Header from './components/ui/Header'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberDetail from './pages/MemberDetail'
import ReservationsPage from './pages/ReservationsPage';  // 예약 관리 페이지
import ClientPage from './pages/ClientPage'
import Settings from './pages/Settings'
import { supabase } from './supabaseClient' // supabase client import
import './styles/theme.css'

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        navigate('/login') // 로그인 안 된 상태라면 로그인 페이지로 리다이렉트
      } else {
        setSession(data.session)
      }
      setLoading(false)
    }
    fetchSession()
  }, [navigate])

  if (loading) {
    return <div>Loading...</div> // 로딩 중이라면 대기 화면 표시
  }

  return children // 세션이 있을 경우 자식 컴포넌트 보여주기
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
        <Header />
        <main className="p-4 max-w-3xl mx-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/member/:id"
              element={
                <ProtectedRoute>
                  <MemberDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client"
              element={
                <ProtectedRoute>
                  <ClientPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
