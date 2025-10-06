import React, { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // 계측 유틸
  const t = (label, extra = {}) =>
    console.log(`[PTLOG][${performance.now().toFixed(1)}ms] ${label}`, extra)

  useEffect(() => {
    t('Header:mount', { path: location.pathname })

    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      t('Header:getSession()', { hasSession: !!session, uid: session?.user?.id })
      setSession(session)

      if (!session?.user) {
        t('Header:session is null -> clear role')
        setRole(null)
        setUserData(null)
        return
      }

      // 트레이너/회원 역할 조회
      try {
        t('Header:role lookup start')
        const { data: trainer } = await supabase
          .from('trainers')
          .select('id, name')
          .eq('id', session.user.id)
          .single()

        if (trainer) {
          t('Header:role=trainer', trainer)
          setRole('trainer')
          setUserData(trainer)
          return
        }

        const { data: member } = await supabase
          .from('members')
          .select('id, name')
          .eq('id', session.user.id)
          .single()

        if (member) {
          t('Header:role=member', member)
          setRole('member')
          setUserData(member)
          return
        }

        t('Header:role not found (edge case)')
      } catch (e) {
        t('Header:role lookup error', { message: e?.message })
      }
    }

    fetchRole()

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      t(`Header:onAuthStateChange:${_event}`, { hasSession: !!session })
      setSession(session)

      if (!session?.user) {
        t('Header:onAuthStateChange -> clear state (no session)')
        setRole(null)
        setUserData(null)
      } else {
        fetchRole()
      }
    })

    return () => {
      t('Header:unmount', { path: location.pathname })
      subscription.unsubscribe()
    }
    // 의존성은 고정: 동작 영향 최소화 (경로 변경마다 재조회하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

    if (location.pathname === '/login') {
        t('Header:render -> login route guard')
        return (
          <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
            <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
            <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">
              로그인
            </Link>
          </header>
        )
      }

  // 세션 없음 → 기본 헤더 (로그인 버튼만)
  if (!session) {
    t('Header:render -> base (no session)')
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link to="/login" className="text-[var(--text-secondary)] hover:text-white text-sm">
          로그인
        </Link>
      </header>
    )
  }

  // 세션 있음 → 역할 분기
  if (role === 'trainer') {
    t('Header:render -> TrainerHeader')
    return <TrainerHeader trainer={userData} />
  }
  if (role === 'member') {
    t('Header:render -> ClientHeader')
    return <ClientHeader member={userData} />
  }

  // 세션은 있는데 역할 조회 중/실패 → 기본 헤더(로고만)
  t('Header:render -> pending role (logo only)')
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
    </header>
  )
}
