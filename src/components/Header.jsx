import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header({ user }) {
  const [role, setRole] = useState(null)        // 'trainer' | 'member' | null
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setRole(null)
      setUserData(null)
      return
    }

    ;(async () => {
      try {
        // ✅ 트레이너 판별
        const { data: trainer } = await supabase
          .from('trainers')
          .select('id,name,auth_user_id')
          .eq('auth_user_id', user.id)
          .single()

        if (cancelled) return
        if (trainer) {
          setRole('trainer')
          setUserData(trainer)
          return
        }

        // ✅ 회원 판별
        const { data: member } = await supabase
          .from('members')
          .select('id,name,auth_user_id')
          .eq('auth_user_id', user.id)
          .single()

        if (cancelled) return
        if (member) {
          setRole('member')
          setUserData(member)
          return
        }

        // 어떤 테이블에도 없으면 null
        setRole(null)
        setUserData(null)
      } catch (e) {
        console.error('[PTLog] Header role fetch error:', e?.message || e)
        setRole(null)
        setUserData(null)
      }
    })()

    return () => { cancelled = true }
  }, [user])

  // ✅ 로그아웃
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) {
      console.error('[PTLog] logout error:', error.message)
      return
    }
    navigate('/login', { replace: true })
  }

  // ✅ 로그인 페이지면 간단 헤더
  const isLoginPage = location.pathname === '/login'
  if (isLoginPage) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  // ✅ 비로그인 또는 역할 미확정 상태
  if (!user || !role) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  // ✅ 역할별 헤더
  if (role === 'trainer') return <TrainerHeader trainer={userData} onLogout={handleLogout} />
  if (role === 'member')  return <ClientHeader  member={userData} onLogout={handleLogout} />

  // ✅ fallback
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
      <button onClick={handleLogout} className="text-[var(--text-secondary)] hover:text-white text-sm">
        로그아웃
      </button>
    </header>
  )
}
