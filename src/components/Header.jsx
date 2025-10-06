import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header({ user }) {
  const [role, setRole] = useState(null)
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // ✅ 역할 불러오기
  useEffect(() => {
    if (!user) {
      setRole(null)
      setUserData(null)
      return
    }

    const fetchRole = async () => {
      try {
        const { data: trainer } = await supabase
          .from('trainers')
          .select('id, name')
          .eq('id', user.id)
          .single()

        if (trainer) {
          setRole('trainer')
          setUserData(trainer)
          return
        }

        const { data: member } = await supabase
          .from('members')
          .select('id, name')
          .eq('id', user.id)
          .single()

        if (member) {
          setRole('member')
          setUserData(member)
          return
        }

        setRole(null)
      } catch (e) {
        console.error('[PTLog] Header role fetch error:', e.message)
      }
    }

    fetchRole()
  }, [user])

  // ✅ /login 라우트에서는 기본 헤더만 표시
  const isLoginPage =
    location.pathname === '/login' ||
    location.pathname === '/login/' ||
    location.hash.includes('/login') ||
    window.location.href.includes('/login')

  if (isLoginPage) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">
          PTLog
        </Link>
        <Link
          to="/login"
          className="text-[var(--text-secondary)] hover:text-white text-sm"
        >
          로그인
        </Link>
      </header>
    )
  }

  // ✅ 세션 없을 때
  if (!user) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">
          PTLog
        </Link>
        <Link
          to="/login"
          className="text-[var(--text-secondary)] hover:text-white text-sm"
        >
          로그인
        </Link>
      </header>
    )
  }

  // ✅ 로그아웃 함수
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      console.log('[PTLog] 로그아웃 성공')
      navigate('/login', { replace: true })
      window.location.reload() // ✅ 전체 새로고침으로 세션 초기화
    } catch (err) {
      console.error('[PTLog] 로그아웃 오류:', err.message)
    }
  }

  // ✅ 역할별 헤더
  if (role === 'trainer')
    return <TrainerHeader trainer={userData} onLogout={handleLogout} />

  if (role === 'member')
    return <ClientHeader member={userData} onLogout={handleLogout} />

  // ✅ 기본 헤더 (역할 정보 불명 시)
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">
        PTLog
      </Link>
      <button
        onClick={handleLogout}
        className="text-[var(--text-secondary)] hover:text-white text-sm"
      >
        로그아웃
      </button>
    </header>
  )
}
