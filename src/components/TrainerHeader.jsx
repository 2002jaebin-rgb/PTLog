import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'

export default function TrainerHeader({ trainer }) {
    console.log('[DEBUG] TrainerHeader rendered with props:', trainer)
  const navigate = useNavigate()
  const t = (label, extra = {}) =>
    console.log(`[PTLOG][${performance.now().toFixed(1)}ms] ${label}`, extra)

  const handleLogout = async () => {
    t('Logout(Trainer): click -> signOut start', { path: window.location.pathname })
    const t0 = performance.now()
  
    const { error } = await supabase.auth.signOut()
    t('Logout(Trainer): signOut resolved', { error, dt: `${(performance.now() - t0).toFixed(1)}ms` })
  
    if (error) {
      console.error('Logout error', error)
      return
    }
  
    // ✅ signOut 이후 실제 세션이 없어졌는지 확인 후 navigate
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        t('Logout(Trainer): session cleared after signOut', { check: i })
        navigate('/login', { replace: true })
        t('Logout(Trainer): navigate("/login") called after session clear')
        return
      }
      t('Logout(Trainer): session still present', { check: i })
      await new Promise((r) => setTimeout(r, 100))
    }
  
    // ✅ 1초 기다려도 세션이 남아있다면, navigate는 하되 로그 표시
    t('Logout(Trainer): session not cleared after 1s → fallback navigate')
    navigate('/login', { replace: true })
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
