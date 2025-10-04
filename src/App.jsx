import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/ui/Header'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberDetail from './pages/MemberDetail'
import ClientPage from './pages/ClientPage'
import Settings from './pages/Settings'  // ✅ 대문자 폴더명으로 교정
import './styles/theme.css'               // ✅ 다크테마 변수 import

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
        {/* ✅ Header를 항상 표시 */}
        <Header />

        {/* ✅ 중앙 정렬 + 여백 */}
        <main className="p-4 max-w-3xl mx-auto">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/member/:id" element={<MemberDetail />} />
            <Route path="/client" element={<ClientPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
