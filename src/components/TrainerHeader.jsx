import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'

export default function TrainerHeader({ trainer }) {
  const navigate = useNavigate()
  const t = (label, extra = {}) =>
    console.log(`[PTLOG][${performance.now().toFixed(1)}ms] ${label}`, extra)

  const handleLogout = async () => {
    t('Logout(Trainer): click -> signOut start', { path: window.location.pathname })
    const t0 = performance.now()
    const { error } = await supabase.auth.signOut()
    t('Logout(Trainer): signOut resolved', { error, dt: `${(performance.now() - t0).toFixed(1)}ms` })

    navigate('/login', { replace: true })
    t('Logout(Trainer): navigate("/login") called')

    // 세션 스냅샷을 지연 확인해서 타이밍 이슈 판별
    setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      t('Logout(Trainer): T+100ms getSession()', { hasSession: !!data.session })
    }, 100)
    setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      t('Logout(Trainer): T+300ms getSession()', { hasSession: !!data.session })
    }, 300)
  }

  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/dashboard" className="font-bold text-lg text-white">PTLog</Link>
      <div className="flex items-center gap-4">
        {trainer && <span className="text-[var(--text-secondary)]">{trainer.name}</span>}
        <Link to="/settings" className="text-[var(--text-secondary)] hover:text-white text-sm">
          설정
        </Link>
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
