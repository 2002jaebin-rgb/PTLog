import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'

const formatTime = (timeStr) => (timeStr ? timeStr.slice(0, 5) : '')

const formatDateWithWeekday = (dateStr) => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  const date = new Date(year, month - 1, day)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}

const buildSessionLabel = (session) => {
  if (!session) return ''
  const dateLabel = formatDateWithWeekday(session.date)
  const startLabel = formatTime(session.start_time)
  const endLabel = formatTime(session.end_time)
  const timeLabel = startLabel
    ? endLabel
      ? `${startLabel} ~ ${endLabel}`
      : startLabel
    : ''

  return [dateLabel, timeLabel].filter(Boolean).join(' ')
}

const normalizeSessionId = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const coerceExercises = (rawExercises) => {
  if (Array.isArray(rawExercises)) return rawExercises
  if (typeof rawExercises === 'string') {
    try {
      const parsed = JSON.parse(rawExercises)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn('[ClientPage] 운동 목록 파싱 실패:', e)
      return []
    }
  }
  return []
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

      const sessionIds = [...new Set((reqs || [])
        .map((req) => normalizeSessionId(req.session_id))
        .filter(Boolean))]
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
            const sid = normalizeSessionId(cur.session_id)
            if (sid) acc[sid] = cur
            return acc
          }, {})
        }
      }

      const enhancedRequests = (reqs || []).map((req) => {
        const normalizedSessionId = normalizeSessionId(req.session_id)
        const session = normalizedSessionId ? sessionsMap[normalizedSessionId] || null : null
        return {
          ...req,
          session,
          session_id: normalizedSessionId,
          exercises: coerceExercises(req.exercises),
          sessionLabel: buildSessionLabel(session),
        }
      })

      setRequests(enhancedRequests)
    }

    fetchRequests()
  }, [])

  const handleAccept = async (id) => {
    await supabase
      .from('session_requests')
      .update({ status: 'accepted' })
      .eq('id', id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (!requests.length) return <p className="p-6">대기중인 요청이 없습니다.</p>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">오늘 수업 확인</h1>
      {requests.map((req) => (
        <div key={req.id} className="border p-4 mb-4 rounded">
          {req.sessionLabel ? (
            <p className="text-sm text-[var(--text-secondary)] mb-1">{req.sessionLabel}</p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] mb-1">연결된 세션 시간 정보를 찾을 수 없습니다.</p>
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
