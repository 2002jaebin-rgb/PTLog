import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'

const formatTime = (timeStr) => (timeStr ? timeStr.slice(0, 5) : '')

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
        .maybeSingle()

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

      const sessionIds = [...new Set((reqs || []).map((req) => req.session_id).filter(Boolean))]
      let sessionsMap = {}

      if (sessionIds.length) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('session_id, date, start_time, end_time')
          .in('session_id', sessionIds)

        if (sessionsError) {
          console.error(sessionsError)
        } else {
          sessionsMap = (sessions || []).reduce((acc, cur) => {
            acc[cur.session_id] = cur
            return acc
          }, {})
        }
      }

      const enhancedRequests = (reqs || []).map((req) => ({
        ...req,
        session: req.session_id ? sessionsMap[req.session_id] || null : null,
      }))

      setRequests(enhancedRequests)
    }

    fetchRequests()
  }, [])

  const handleAccept = async (id) => {
    await supabase
      .from('session_requests')
      .update({ status: 'accepted' })
      .eq('id', id)
    setRequests(requests.filter((r) => r.id !== id))
  }

  if (!requests.length) return <p className="p-6">대기중인 요청이 없습니다.</p>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">오늘 수업 확인</h1>
      {requests.map((req) => (
        <div key={req.id} className="border p-4 mb-4 rounded">
          {req.session && (
            <p className="text-sm text-gray-500 mb-1">
              {req.session.date}{' '}
              {formatTime(req.session.start_time)}
              {req.session.end_time ? ` ~ ${formatTime(req.session.end_time)}` : ''}
            </p>
          )}
          <p className="font-semibold mb-2">{req.notes}</p>
          <ul className="mb-2">
            {req.exercises?.map((ex, i) => (
              <li key={i}>
                • {ex.name} {ex.sets}세트 × {ex.reps}회 ({ex.weight}kg)
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleAccept(req.id)}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            승인 및 회차 차감
          </button>
        </div>
      ))}
    </div>
  )
}
