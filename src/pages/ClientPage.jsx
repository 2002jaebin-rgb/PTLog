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

const normalizeValue = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const coerceExercises = (rawExercises) => {
  let list = []

  if (Array.isArray(rawExercises)) {
    list = rawExercises
  } else if (typeof rawExercises === 'string') {
    try {
      const parsed = JSON.parse(rawExercises)
      if (Array.isArray(parsed)) {
        list = parsed
      }
    } catch (e) {
      console.warn('[ClientPage] 운동 목록 파싱 실패:', e)
    }
  }

  if (!Array.isArray(list)) return []

  return list
    .map((exercise) => {
      if (!exercise || typeof exercise !== 'object') return null

      const name = typeof exercise.name === 'string' ? exercise.name : ''
      const rawSets = Array.isArray(exercise.sets) ? exercise.sets : []

      const normalizedSets = rawSets
        .map((set) => {
          const weight = normalizeValue(set?.weight)
          const reps = normalizeValue(set?.reps)
          if (!weight && !reps) return null
          return { weight, reps }
        })
        .filter(Boolean)

      const legacySetCount = !Array.isArray(exercise.sets) ? normalizeValue(exercise.sets) : ''
      const legacyWeight = !Array.isArray(exercise.sets) ? normalizeValue(exercise.weight) : ''
      const legacyReps = !Array.isArray(exercise.sets) ? normalizeValue(exercise.reps) : ''

      const fallbackSets = !normalizedSets.length && (legacyWeight || legacyReps)
        ? [{ weight: legacyWeight, reps: legacyReps }]
        : []

      const sets = normalizedSets.length ? normalizedSets : fallbackSets
      const hasLegacyInfo = Boolean(legacySetCount || legacyWeight || legacyReps)

      if (!name && !sets.length && !hasLegacyInfo) return null

      return {
        name,
        sets,
        legacy: hasLegacyInfo
          ? {
              setCount: legacySetCount,
              weight: legacyWeight,
              reps: legacyReps,
            }
          : null,
      }
    })
    .filter(Boolean)
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
          {req.notes && <p className="font-semibold mb-2">{req.notes}</p>}
          {req.exercises?.length ? (
            <div className="mb-3 space-y-2">
              {req.exercises.map((ex, i) => (
                <div key={i}>
                  <p className="font-medium text-white">
                    {ex.name || `운동 ${i + 1}`}
                  </p>
                  {ex.sets?.length ? (
                    <ul className="ml-4 mt-1 space-y-1 text-sm text-[var(--text-secondary)]">
                      {ex.sets.map((set, setIndex) => {
                        const weightLabel = set.weight ? `${set.weight}kg` : ''
                        const repsLabel = set.reps ? `${set.reps}회` : ''
                        const detail = weightLabel && repsLabel
                          ? `${weightLabel} · ${repsLabel}`
                          : weightLabel || repsLabel || '기록 없음'
                        return (
                          <li key={setIndex}>
                            세트 {setIndex + 1}: {detail}
                          </li>
                        )
                      })}
                    </ul>
                  ) : ex.legacy ? (
                    <p className="ml-4 mt-1 text-sm text-[var(--text-secondary)]">
                      {[
                        ex.legacy.setCount ? `${ex.legacy.setCount}세트` : '',
                        ex.legacy.weight && ex.legacy.reps
                          ? `${ex.legacy.weight}kg × ${ex.legacy.reps}회`
                          : ex.legacy.weight
                            ? `${ex.legacy.weight}kg`
                            : ex.legacy.reps
                              ? `${ex.legacy.reps}회`
                              : '',
                      ].filter(Boolean).join(' · ') || '기록 없음'}
                    </p>
                  ) : (
                    <p className="ml-4 mt-1 text-sm text-[var(--text-secondary)]">기록 없음</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-[var(--text-secondary)]">등록된 운동 기록이 없습니다.</p>
          )}
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
