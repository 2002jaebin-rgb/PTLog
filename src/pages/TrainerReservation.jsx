import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function TrainerReservation() {
  const [loading, setLoading] = useState(true)
  const [trainerId, setTrainerId] = useState(null)
  const [sessions, setSessions] = useState([])        // 트레이너 소유 세션
  const [reservations, setReservations] = useState([]) // 위 세션들에 대한 예약
  const [membersMap, setMembersMap] = useState({})     // member_id → {name,email}

  useEffect(() => {
    const init = async () => {
      setLoading(true)

      // ✅ v2 방식: 현재 사용자(트레이너) 가져오기
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) {
        console.error('auth.getUser 실패', userErr)
        setLoading(false)
        return
      }
      setTrainerId(user.id)

      // 1) 이 트레이너의 세션들 가져오기
      const { data: mySessions, error: sErr } = await supabase
        .from('sessions')
        .select('session_id, date, start_time, end_time, status')
        .eq('trainer_id', user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (sErr) {
        console.error('세션 로드 실패', sErr)
        setLoading(false)
        return
      }
      setSessions(mySessions || [])

      // 세션이 없으면 바로 종료
      if (!mySessions || mySessions.length === 0) {
        setReservations([])
        setMembersMap({})
        setLoading(false)
        return
      }

      const sessionIds = mySessions.map(s => s.session_id)

      // 2) 해당 세션들에 걸린 "대기(pending)" 예약 가져오기
      const { data: myReservations, error: rErr } = await supabase
        .from('reservations')
        .select('reservation_id, session_id, member_id, status, reservation_time')
        .in('session_id', sessionIds)
        .eq('status', 'pending')
        .order('reservation_time', { ascending: false })

      if (rErr) {
        console.error('예약 로드 실패', rErr)
        setLoading(false)
        return
      }
      setReservations(myReservations || [])

      // 3) 예약한 회원 프로필 한번에 조회하여 map 구성(이름 표시용)
      const uniqueMemberIds = [...new Set((myReservations || []).map(r => r.member_id))]
      if (uniqueMemberIds.length > 0) {
        const { data: members, error: mErr } = await supabase
          .from('members')
          .select('id, name, email')
          .in('id', uniqueMemberIds)
        if (mErr) {
          console.error('멤버 로드 실패', mErr)
          setMembersMap({})
        } else {
          const map = {}
          members.forEach(m => { map[m.id] = m })
          setMembersMap(map)
        }
      } else {
        setMembersMap({})
      }

      setLoading(false)
    }

    init()
  }, [])

  // 세션ID → 해당 세션의 pending 예약들
  const reservationsBySession = useMemo(() => {
    const map = {}
    for (const r of reservations) {
      if (!map[r.session_id]) map[r.session_id] = []
      map[r.session_id].push(r)
    }
    return map
  }, [reservations])

  // ✅ 수락(동시성 고려)
  // - reservations: 해당 예약이 아직 pending일 때만 approved로
  // - sessions: 해당 세션이 아직 available일 때만 booked로
  // - 같은 세션의 다른 pending 예약은 일괄 rejected 처리
  const acceptReservation = async (reservationId, sessionId) => {
    // 1) 예약 상태 전이(pending → approved)
    const { error: rErr } = await supabase
      .from('reservations')
      .update({ status: 'approved' })
      .eq('reservation_id', reservationId)
      .eq('status', 'pending') // 조건부 업데이트

    if (rErr) {
      alert('예약 승인 실패(1): ' + rErr.message)
      return
    }

    // 2) 세션 상태 전이(available → booked)
    const { error: sErr } = await supabase
      .from('sessions')
      .update({ status: 'booked' })
      .eq('session_id', sessionId)
      .eq('status', 'available') // 조건부 업데이트

    if (sErr) {
      alert('예약 승인 실패(2): ' + sErr.message)
      return
    }

    // 3) 같은 세션의 다른 pending 예약은 전부 rejected
    const { error: r2Err } = await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('session_id', sessionId)
      .eq('status', 'pending')

    if (r2Err) {
      // 실패하더라도 핵심 플로우는 진행되었으므로 경고만
      console.warn('다른 예약 거절 처리 실패:', r2Err.message)
    }

    // 뷰 갱신
    await refreshLists()
  }

  const rejectReservation = async (reservationId) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('reservation_id', reservationId)
      .eq('status', 'pending') // 중복클릭 방지
    if (error) {
      alert('예약 거절 실패: ' + error.message)
      return
    }
    await refreshLists()
  }

  // 목록 재조회 유틸
  const refreshLists = async () => {
    if (!trainerId) return

    const { data: mySessions } = await supabase
      .from('sessions')
      .select('session_id, date, start_time, end_time, status')
      .eq('trainer_id', trainerId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    setSessions(mySessions || [])

    const ids = (mySessions || []).map(s => s.session_id)
    if (ids.length === 0) {
      setReservations([])
      setMembersMap({})
      return
    }

    const { data: myReservations } = await supabase
      .from('reservations')
      .select('reservation_id, session_id, member_id, status, reservation_time')
      .in('session_id', ids)
      .eq('status', 'pending')
      .order('reservation_time', { ascending: false })
    setReservations(myReservations || [])

    const uniqueMemberIds = [...new Set((myReservations || []).map(r => r.member_id))]
    if (uniqueMemberIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('id, name, email')
        .in('id', uniqueMemberIds)
      const map = {}
      ;(members || []).forEach(m => { map[m.id] = m })
      setMembersMap(map)
    } else {
      setMembersMap({})
    }
  }

  if (loading) return <div className="p-4">불러오는 중…</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">예약 관리</h1>

      {sessions.length === 0 ? (
        <Card className="p-4">아직 등록된 세션이 없습니다.</Card>
      ) : (
        <div className="space-y-4">
          {sessions.map(session => {
            const rs = reservationsBySession[session.session_id] || []
            return (
              <Card key={session.session_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      {session.date} {session.start_time}–{session.end_time}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      상태: {session.status}
                    </div>
                  </div>
                </div>

                {rs.length === 0 ? (
                  <div className="mt-3 text-sm text-[var(--text-secondary)]">
                    대기 중인 예약이 없습니다.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {rs.map(r => {
                      const member = membersMap[r.member_id]
                      return (
                        <div key={r.reservation_id} className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                          <div className="text-sm">
                            <div className="font-medium">
                              {member?.name || '알 수 없음'} <span className="text-[var(--text-secondary)]">({member?.email || r.member_id})</span>
                            </div>
                            <div className="text-[var(--text-secondary)]">요청시간: {new Date(r.reservation_time).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button onClick={() => acceptReservation(r.reservation_id, session.session_id)}>수락</Button>
                            <Button variant="secondary" onClick={() => rejectReservation(r.reservation_id)}>거절</Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
