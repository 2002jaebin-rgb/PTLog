import React, { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import TrainerHeader from './TrainerHeader'
import ClientHeader from './ClientHeader'

export default function Header() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [userData, setUserData] = useState(null)

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

  if (!session || !role) return null // 로그인 안된 경우 Header 숨김

  if (role === 'trainer') return <TrainerHeader trainer={userData} />
  if (role === 'member') return <ClientHeader member={userData} />

  return null
}
