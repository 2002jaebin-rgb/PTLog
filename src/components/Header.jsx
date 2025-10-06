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

  // 계측용 로그
  const t = (label, extra = {}) =>
    console.log(`[PTLOG][${performance.now().toFixed(1)}ms] ${label}`, extra)

  // ✅ 로그인된 사용자 있을 때만 역할 불러오기
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
        console.error('Header role fetch error:', e.message)
      }
    }

    fetchRole()
  }, [user])

  // ✅ 로그인 페이지에서는 간단한 헤더만 표시
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
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">
          로그인
        </Link>
      </header>
    )
  }

  // ✅ 세션 없을 때 (비로그인)
  if (!user) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">
          PTLog
        </Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">
          로그인
        </Link>
      </header>
    )
  }

  // ✅ 로그아웃 처리
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('로그아웃 에러:', error.message)
    } else {
      console.log('로그아웃 성공')
      navigate('/login', { replace: true })
      window.location.reload()
    }
  }

  // ✅ 역할별 헤더 분기
  if (role === 'trainer') return <TrainerHeader trainer={userData} onLogout={handleLogout} />
  if (role === 'member') return <ClientHeader member={userData} onLogout={handleLogout} />

  // ✅ 역할 없을 때 기본 헤더
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">
        PTLog
      </Link>
      <button onClick={handleLogout} className="text-[var(--text-secondary)] hover:text-white text-sm">
        로그아웃
      </button>
    </header>
  )
}
