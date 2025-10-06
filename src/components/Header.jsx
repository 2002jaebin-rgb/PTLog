import React, { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Link, useNavigate } from 'react-router-dom'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      if (!session?.user) {
        setRole(null)
        setUserData(null)
        return
      }

      // 트레이너인지 확인
      const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('id', session.user.id)
        .single()

      if (trainer) {
        setRole('trainer')
        setUserData(trainer)
      } else {
        const { data: member } = await supabase
          .from('members')
          .select('id, name')
          .eq('id', session.user.id)
          .single()
        if (member) {
          setRole('member')
          setUserData(member)
        }
      }
    }

    fetchRole()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session?.user) {
        setRole(null)
        setUserData(null)
      } else {
        fetchRole()
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (!session) {
    return (
      <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
        <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
        <Link
          to="/login"
          className="text-[var(--text-secondary)] hover:text-white text-sm"
        >
          로그인
        </Link>
      </header>
    )
  }

  // ✅ 로그인 상태 → 역할에 따라 분기
  if (role === 'trainer') return <TrainerHeader trainer={userData} />
  if (role === 'member') return <ClientHeader member={userData} />

  // (로딩 중이면 일단 기본 헤더 표시)
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg text-white">PTLog</Link>
    </header>
  )
}
