import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header({ user }) {
  // ✅ 모든 훅은 최상단에서 “항상” 호출
  const [role, setRole] = useState(null)        // 'trainer' | 'member' | null
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // ✅ 역할 조회 훅도 최상단에서 무조건 호출 (조기 return 금지)
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setRole(null)
      setUserData(null)
      return
    }

    ;(async () => {
      try {
        const { data: trainer } = await supabase
          .from('trainers')
          .select('id,name')
          .eq('id', user.id)
          .single()

        if (cancelled) return
        if (trainer) {
          setRole('trainer')
          setUserData(trainer)
          return
        }

        const { data: member } = await supabase
          .from('members')
          .select('id,name')
          .eq('id', user.id)
          .single()

        if (cancelled) return
        if (member) {
          setRole('member')
          setUserData(member)
          return
        }

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

  // ✅ 로그아웃은 부모에서만 처리 → 자식은 onLogout만 호출
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) {
      console.error('[PTLog] logout error:', error.message)
      return
    }
    navigate('/login', { replace: true })
  }

  // ✅ 이제부터 분기 (훅 호출 이후)
  const isLoginPage = location.pathname === '/login'

  if (isLoginPage) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  if (!user || !role) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  if (role === 'trainer') return <TrainerHeader trainer={userData} onLogout={handleLogout} />
  if (role === 'member')  return <ClientHeader  member={userData} onLogout={handleLogout} />

  // role 판단 중 기본 헤더
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
      <button onClick={handleLogout} className="text-[var(--text-secondary)] hover:text-white text-sm">
        로그아웃
      </button>
    </header>
  )
}
