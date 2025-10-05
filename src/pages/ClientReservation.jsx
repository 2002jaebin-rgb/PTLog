import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function ClientReservation() {
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [myReservations, setMyReservations] = useState([])

  useEffect(() => {
    const init = async () => {
      setLoading(true)

      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) {
        console.error('auth.getUser 실패', userErr)
        setLoading(false)
        return
      }

      const { data: memberRow, error: memberErr } = await supabase
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (memberErr || !memberRow) {
        console.error('회원 정보 없음:', memberErr)
        setLoading(false)
        return
      }

      setMemberId(memberRow.id)

      const { data: availableSessions } = await supabase
        .from('sessions')
        .select('session_id, date, start_time, end_time, status')
        .eq('status', 'available')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      setSessions(availableSessions || [])

      const { data: reservations } = await supabase
        .from('reservations')
        .select('reservation_id, session_id, status')
        .eq('member_id', memberRow.id)
        .order('reservation_time', { ascending: false })
      setMyReservations(reservations || [])

      setLoading(false)
    }

    init()
  }, [])

  const handleReserve = async (sessionId) => {
    if (!memberId) return alert('회원 정보가 없습니다.')
    const exists = myReservations.find(r => r.session_id === sessionId && r.status === 'pending')
    if (exists) return alert('이미 대기 중인 예약이 있습니다.')

    const { error } = await supabase.from('reservations').insert([
      { session_id: sessionId, member_id: memberId, status: 'pending' }
    ])
    if (error) return alert('예약 실패: ' + error.message)

    alert('예약 요청이 전송되었습니다!')
    setMyReservations(prev => [...prev, { session_id: sessionId, status: 'pending' }])
  }

  if (loading) return <div className="p-6">불러오는 중...</div>

  const mySessionMap = new Map(myReservations.map(r => [r.session_id, r.status]))

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">세션 예약</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">예약 가능한 세션</h2>
        {sessions.length === 0 ? (
          <Card className="p-4 text-[var(--text-secondary)]">현재 예약 가능한 세션이 없습니다.</Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const status = mySessionMap.get(s.session_id)
              return (
                <Card key={s.session_id} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">
                      {s.date} {s.start_time}–{s.end_time}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">상태: {s.status}</div>
                  </div>
                  {status ? (
                    <span className={`text-sm ${
                      status === 'pending'
                        ? 'text-yellow-400'
                        : status === 'approved'
                        ? 'text-green-400'
                        : 'text-gray-400'
                    }`}>
                      {status === 'pending' ? '승인 대기' :
                       status === 'approved' ? '승인됨' : '거절됨'}
                    </span>
                  ) : (
                    <Button onClick={() => handleReserve(s.session_id)}>예약하기</Button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
