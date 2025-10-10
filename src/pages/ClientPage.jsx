import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'

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
        acc[String(cur.session_id)] = cur
        return acc
      }, {})

      return list.map((req) => ({
        ...req,
        sessionInfo: sessionMap[String(req.session_id)] || null,
      }))
    }

    fetchRequests()
  }, [])

  const formatFallbackDate = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  }

  const formatSessionTiming = (req) => {
    const info = req.sessionInfo
    if (info?.date) {
      const start = info.start_time ? info.start_time.slice(0, 5) : ''
      const end = info.end_time ? info.end_time.slice(0, 5) : ''
      if (start && end) return `${info.date} ${start} ~ ${end}`
      if (start) return `${info.date} ${start}`
      return info.date
    }

    return formatFallbackDate(req.created_at)
  }

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
          <p className="font-semibold mb-2">{req.notes}</p>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            진행일시: {formatSessionTiming(req)}
          </p>
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
