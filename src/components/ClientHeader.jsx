import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'

export default function ClientHeader({ member }) {
  const navigate = useNavigate()
  const t = (label, extra = {}) =>
    console.log(`[PTLOG][${performance.now().toFixed(1)}ms] ${label}`, extra)

  const handleLogout = async () => {
    t('Logout(Client): click -> signOut start', { path: window.location.pathname })
    const t0 = performance.now()
    const { error } = await supabase.auth.signOut()
    t('Logout(Client): signOut resolved', { error, dt: `${(performance.now() - t0).toFixed(1)}ms` })

    navigate('/login', { replace: true })
    t('Logout(Client): navigate("/login") called')

    setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      t('Logout(Client): T+100ms getSession()', { hasSession: !!data.session })
    }, 100)
    setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      t('Logout(Client): T+300ms getSession()', { hasSession: !!data.session })
    }, 300)
  }

  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/client" className="font-bold text-lg text-white">PTLog</Link>
      <div className="flex items-center gap-4">
        {member && <span className="text-[var(--text-secondary)]">{member.name}</span>}
        <Link to="/client" className="text-[var(--text-secondary)] hover:text-white text-sm">
          내 운동
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
