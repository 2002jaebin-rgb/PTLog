import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'

export default function Header({ trainer }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()  // 로그아웃 처리
    navigate('/login')  // 로그아웃 후 로그인 페이지로 이동
  }

  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/dashboard" className="font-bold text-lg text-white">PTLog</Link>
      <div className="flex items-center gap-3">
        {trainer && <span className="text-[var(--text-secondary)]">{trainer.name}</span>}
        <Link to="/settings" className="text-[var(--text-secondary)] hover:text-white text-sm">설정</Link>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
