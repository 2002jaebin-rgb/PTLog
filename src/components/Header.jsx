import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'
import BottomNav from './BottomNav' // ✅ 추가

export default function Header({ user }) {
  const [role, setRole] = useState(null)        // 'trainer' | 'member' | null
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // 역할 조회 (auth_user_id 기준)
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
          .select('id,name,auth_user_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (trainer) {
          setRole('trainer')
          setUserData(trainer)
          return
        }

        const { data: member } = await supabase
          .from('members')
          .select('id,name,auth_user_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

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

  // 로그아웃
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) {
      console.error('[PTLog] logout error:', error.message)
      return
    }
    navigate('/login', { replace: true })
  }

  const isLoginPage = location.pathname === '/login'

  // 로그인 페이지: 상단 심플 헤더만 (모바일 하단 네비 없음)
  if (isLoginPage) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  // 비로그인 또는 역할 미확정: 상단 심플 헤더만
  if (!user || !role) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">로그인</Link>
      </header>
    )
  }

  // 역할별 렌더링
  return (
    <>
      {/* 데스크톱/태블릿에선 기존 상단 헤더 표시, 모바일에선 숨김 */}
      <div className="hidden md:block">
        {role === 'trainer' ? (
          <TrainerHeader trainer={userData} onLogout={handleLogout} />
        ) : (
          <ClientHeader member={userData} onLogout={handleLogout} />
        )}
      </div>

      {/* 모바일 전용 하단 네비게이션 (자동 라벨링) */}
      <BottomNav role={role} />
    </>
  )
}
