import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'
import { formatTimeLabel, matchSessionsToRequests, toLocalDateTime } from '@/utils/sessionUtils'

const coerceNumericId = (value) => {
  if (value === null || value === undefined || value === '') return value
  const numeric = Number(value)
  return Number.isNaN(numeric) ? value : numeric
}

export default function ClientPage() {
  const [requests, setRequests] = useState([])
  const [memberInfo, setMemberInfo] = useState(null)

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      // 먼저 회원의 member_id를 가져오기
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id, trainer_id')
        .eq('auth_user_id', user.id)
        .single()

      if (memberError || !member) {
        console.error('회원 정보 없음:', memberError)
        setRequests([])
        return
      }

      setMemberInfo(member)

      // 이제 session_requests 조회
      const { data: reqRows, error } = await supabase
        .from('session_requests')
        .select('*')
        .eq('member_id', member.id)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: true })

      if (error) {
        console.error(error)
        setRequests([])
        return
      }

      const pendingRequests = (reqRows || []).filter((req) => req.status === 'pending')
      if (!pendingRequests.length) {
        setRequests([])
        return
      }

      const requestsWithSessionInfo = await enrichRequestsWithSessionTimes(member, reqRows || [])
      setRequests(requestsWithSessionInfo.filter((req) => req.status === 'pending'))
    }

    const enrichRequestsWithSessionTimes = async (member, allRequests) => {
      const pending = allRequests.filter((req) => req.status === 'pending')
      if (!pending.length) return allRequests

      const { data: reservations, error: reservationError } = await supabase
        .from('reservations')
        .select('session_id, status')
        .eq('member_id', member.id)

      if (reservationError) {
        console.error(reservationError)
        return allRequests
      }

      const sessionIds = [...new Set((reservations || []).map((r) => r.session_id).filter((id) => id !== null && id !== undefined))]
      if (!sessionIds.length) return allRequests

      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('session_id, date, start_time, end_time, status, trainer_id')
        .in('session_id', sessionIds)

      if (sessionError) {
        console.error(sessionError)
        return allRequests
      }

      const now = new Date()
      const sessionEntries = (sessions || [])
        .filter((session) => session.trainer_id === member.trainer_id && session.status === 'booked')
        .map((session) => {
          const reference = toLocalDateTime(session.date, session.end_time || session.start_time)
          if (!reference) return null
          if (reference > now) return null

          return {
            sessionKey: String(session.session_id),
            session_id: session.session_id,
            member_id: String(member.id),
            date: session.date,
            startLabel: formatTimeLabel(session.start_time),
            endLabel: session.end_time ? formatTimeLabel(session.end_time) : '',
            referenceTime: reference.getTime(),
          }
        })
        .filter(Boolean)

      const { requestSessionMap } = matchSessionsToRequests(sessionEntries, allRequests)

      return allRequests.map((req) => ({
        ...req,
        sessionInfo: requestSessionMap[req.id] || null,
      }))
    }

    fetchRequests()
  }, [])

  const handleAccept = async (request) => {
    const { id, sessionInfo } = request

    const updates = [
      supabase
        .from('session_requests')
        .update({ status: 'accepted' })
        .eq('id', id),
    ]

    if (sessionInfo?.session_id && memberInfo?.id) {
      const coercedSessionId = coerceNumericId(sessionInfo.session_id)
      const coercedMemberId = coerceNumericId(memberInfo.id)
      updates.push(
        supabase
          .from('reservations')
          .update({ status: 'approved' })
          .eq('session_id', coercedSessionId)
          .eq('member_id', coercedMemberId),
      )
    }

    const results = await Promise.all(updates)
    results.forEach(({ error }) => {
      if (error) console.error('요청 처리 중 오류:', error)
    })

    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (!requests.length) return <p className="p-6">대기중인 요청이 없습니다.</p>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">오늘 수업 확인</h1>
      {requests.map((req) => (
        <div key={req.id} className="border p-4 mb-4 rounded">
          <p className="font-semibold mb-2">{req.notes}</p>
          <div className="text-sm text-[var(--text-secondary)] mb-2">
            {req.sessionInfo ? (
              <div className="space-y-0.5">
                <div>진행 날짜: {req.sessionInfo.date}</div>
                <div>
                  진행 시간: {req.sessionInfo.startLabel}
                  {req.sessionInfo.endLabel ? ` ~ ${req.sessionInfo.endLabel}` : ''}
                </div>
              </div>
            ) : (
              <div>세션 일정 정보를 불러올 수 없습니다.</div>
            )}
          </div>
          <ul className="mb-2">
            {req.exercises?.map((ex, i) => (
              <li key={i}>
                • {ex.name} {ex.sets}세트 × {ex.reps}회 ({ex.weight}kg)
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleAccept(req)}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            승인 및 회차 차감
          </button>
        </div>
      ))}
    </div>
  )
}
