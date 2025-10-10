import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'

const coerceNumericId = (value) => {
  if (value === null || value === undefined || value === '') return value
  const numeric = Number(value)
  return Number.isNaN(numeric) ? value : numeric
}

export default function ClientPage() {
  const [requests, setRequests] = useState([])

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      // 먼저 회원의 member_id를 가져오기
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (memberError || !member) {
        console.error('회원 정보 없음:', memberError)
        setRequests([])
        return
      }

      // 이제 session_requests 조회
      const { data: reqs, error } = await supabase
        .from('session_requests')
        .select('*')
        .eq('member_id', member.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setRequests([])
        return
      }

      const requestsWithSessionInfo = await enrichRequestsWithSessionTimes(reqs || [])
      setRequests(requestsWithSessionInfo)
    }

    const enrichRequestsWithSessionTimes = async (list) => {
      const sessionIds = [...new Set(list.map((req) => req.session_id).filter(Boolean))]
      if (!sessionIds.length) return list

      const queryIds = sessionIds.map((id) => {
        const numeric = Number(id)
        return Number.isNaN(numeric) ? id : numeric
      })

      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('session_id, date, start_time, end_time')
        .in('session_id', queryIds)

      if (sessionError) {
        console.error(sessionError)
        return list
      }

      const sessionMap = (sessions || []).reduce((acc, cur) => {
        const startLabel = cur.start_time ? cur.start_time.slice(0, 5) : ''
        const endLabel = cur.end_time ? cur.end_time.slice(0, 5) : ''
        acc[String(cur.session_id)] = {
          ...cur,
          startLabel,
          endLabel,
        }
        return acc
      }, {})

      return list.map((req) => ({
        ...req,
        sessionInfo: sessionMap[String(req.session_id)] || null,
      }))
    }

    fetchRequests()
  }, [])

  const handleAccept = async (request) => {
    const { id, session_id, member_id } = request

    const updates = []
    updates.push(
      supabase
        .from('session_requests')
        .update({ status: 'accepted' })
        .eq('id', id)
    )

    if (session_id && member_id) {
      const coercedSessionId = coerceNumericId(session_id)
      const coercedMemberId = coerceNumericId(member_id)
      updates.push(
        supabase
          .from('reservations')
          .update({ status: 'approved' })
          .eq('session_id', coercedSessionId)
          .eq('member_id', coercedMemberId)
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
