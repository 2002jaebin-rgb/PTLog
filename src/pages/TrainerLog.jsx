import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import {
  createEmptyExercise,
  createEmptySet,
  ensureExerciseHasAtLeastOneSet,
  sanitizeExercisesForSubmit,
} from '@/utils/exerciseForm'

const toLocalDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.slice(0, 5).split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const toTodayString = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatTime = (timeStr) => (timeStr ? timeStr.slice(0, 5) : '')

export default function TrainerLog() {
  const [me, setMe] = useState(null)                // 로그인한 트레이너 (auth user)
  const [sessionOptions, setSessionOptions] = useState([]) // 선택 가능한 완료 세션 목록
  const [sessionId, setSessionId] = useState('')    // 선택된 세션 id
  const [memberId, setMemberId] = useState('')      // 세션에 연결된 회원 id
  const [exercises, setExercises] = useState([createEmptyExercise()])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        // 1) 트레이너(현재 유저) 확인
        const { data: { user } } = await supabase.auth.getUser()
        setMe(user ?? null)
        if (!user) {
          setLoading(false)
          return
        }

        // 2) 완료된 booked 세션 로드
        const today = toTodayString()
        const { data: bookedSessions, error: sErr } = await supabase
          .from('sessions')
          .select('session_id, date, start_time, end_time, status')
          .eq('trainer_id', user.id)
          .eq('status', 'booked')
          .lte('date', today)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false })

        if (sErr) throw sErr

        let normalizedSessions = []
        if (bookedSessions && bookedSessions.length > 0) {
          const sessionIds = bookedSessions.map((s) => s.session_id)

          const { data: approvedReservations, error: rErr } = await supabase
            .from('reservations')
            .select('session_id, member_id, status, reservation_time')
            .in('session_id', sessionIds)
            .in('status', ['approved', 'completed'])

          if (rErr) throw rErr

          const memberIds = [...new Set((approvedReservations || []).map((r) => r.member_id).filter(Boolean))]
          let membersMap = {}

          if (memberIds.length > 0) {
            const { data: memberRows, error: mErr } = await supabase
              .from('members')
              .select('id, name, email')
              .in('id', memberIds)

            if (mErr) throw mErr
            membersMap = (memberRows || []).reduce((acc, cur) => {
              acc[cur.id] = cur
              return acc
            }, {})
          }

          const now = new Date()
          normalizedSessions = (bookedSessions || [])
            .map((session) => {
              const sessionId = String(session.session_id)
              const reservation = (approvedReservations || []).find((r) => String(r.session_id) === sessionId)
              if (!reservation) return null

              const referenceTime = toLocalDateTime(session.date, session.end_time || session.start_time)
              if (!referenceTime) return null
              if (referenceTime > now) return null

              const member = membersMap[reservation.member_id]
              const startLabel = formatTime(session.start_time)
              const endLabel = session.end_time ? formatTime(session.end_time) : ''
              const memberName = member?.name || `회원 ${reservation.member_id}`
              const memberEmail = member?.email || ''
              const label = `${session.date} ${startLabel}${endLabel ? ` ~ ${endLabel}` : ''} · ${memberName}`

              return {
                session_id: sessionId,
                member_id: reservation.member_id,
                label,
                startLabel,
                endLabel,
                memberName,
                memberEmail,
                date: session.date,
                referenceTime: referenceTime.getTime(),
              }
            })
            .filter(Boolean)
            .sort((a, b) => b.referenceTime - a.referenceTime)
        }

        setSessionOptions(normalizedSessions)
        setSessionId((prev) => (normalizedSessions.some((opt) => opt.session_id === prev) ? prev : ''))
      } catch (e) {
        console.error('[TrainerLog] init error:', e?.message || e)
        setError('초기 데이터를 불러오는 중 문제가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const matched = sessionOptions.find((opt) => opt.session_id === sessionId)
    const nextMemberId = matched?.member_id || ''
    setMemberId((prev) => (prev === nextMemberId ? prev : nextMemberId))
  }, [sessionOptions, sessionId])

  const handleExerciseNameChange = (exerciseIndex, value) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = ensureExerciseHasAtLeastOneSet(next[exerciseIndex])
      target.name = value
      next[exerciseIndex] = target
      return next
    })
  }

  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = ensureExerciseHasAtLeastOneSet(next[exerciseIndex])
      const sets = [...target.sets]
      const currentSet = sets[setIndex] || createEmptySet()
      sets[setIndex] = {
        ...currentSet,
        [field]: value,
      }
      target.sets = sets
      next[exerciseIndex] = target
      return next
    })
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, createEmptyExercise()])
  }

  const removeExercise = (exerciseIndex) => {
    setExercises((prev) => {
      if (prev.length <= 1) {
        return [createEmptyExercise()]
      }
      return prev.filter((_, idx) => idx !== exerciseIndex)
    })
  }

  const addSetToExercise = (exerciseIndex) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = ensureExerciseHasAtLeastOneSet(next[exerciseIndex])
      target.sets = [...target.sets, createEmptySet()]
      next[exerciseIndex] = target
      return next
    })
  }

  const removeSetFromExercise = (exerciseIndex, setIndex) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = ensureExerciseHasAtLeastOneSet(next[exerciseIndex])
      if (target.sets.length <= 1) {
        target.sets = [createEmptySet()]
      } else {
        target.sets = target.sets.filter((_, idx) => idx !== setIndex)
      }
      next[exerciseIndex] = target
      return next
    })
  }

  const sanitizedExercises = () => {
    const sanitized = sanitizeExercisesForSubmit(exercises)
    return sanitized.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.length ? exercise.sets : [],
    }))
  }

  const validate = () => {
    if (!me) return '로그인이 필요합니다.'
    if (!sessionId) return '세션을 선택해주세요.'
    const sanitized = sanitizedExercises()
    if (!sanitized.length) return '최소 1개 이상의 운동을 입력해주세요.'
    const hasSetData = sanitized.some((exercise) => exercise.sets.length)
    if (!hasSetData) return '각 운동에 최소 1개 이상의 세트를 추가해주세요.'
    return ''
  }

  const handleSave = async () => {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError('')
    setSaving(true)
    try {
      const selected = sessionOptions.find((opt) => opt.session_id === sessionId) || null
      if (!selected) {
        setError('선택한 세션 정보를 찾을 수 없습니다.')
        return
      }

      let targetMemberId = selected.member_id || memberId

      if (!targetMemberId) {
        const { data: fallbackReservations, error: fallbackErr } = await supabase
          .from('reservations')
          .select('member_id, reservation_time')
          .eq('session_id', sessionId)
          .in('status', ['approved', 'completed'])
          .order('reservation_time', { ascending: false })
          .limit(1)

        if (fallbackErr) throw fallbackErr

        targetMemberId = fallbackReservations?.[0]?.member_id || ''
        if (targetMemberId) {
          setMemberId(targetMemberId)
        }
      }

      if (!targetMemberId) {
        setError('선택된 세션의 회원 정보를 찾을 수 없습니다.')
        return
      }

      const normalizedExercises = sanitizedExercises()

      // session_requests에 pending으로 기록
      const payload = {
        trainer_id: me.id,               // 트레이너 auth.users.id
        member_id: targetMemberId,       // 선택된 회원 PTLog id (members.id)
        session_id: selected.session_id, // 연결된 세션 (sessions.session_id)
        notes: note || null,
        exercises: normalizedExercises,   // JSON으로 저장
        status: 'pending',
      }
      const { error: insErr } = await supabase
        .from('session_requests')
        .insert([payload])

      if (insErr) throw insErr
      setSent(true)
    } catch (e) {
      console.error('[TrainerLog] save error:', e?.message || e)
      setError('저장 중 문제가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const selectedSession = sessionOptions.find((opt) => opt.session_id === sessionId)

  if (loading) {
    return <div className="text-center mt-10">불러오는 중...</div>
  }

  if (!me) {
    return (
      <div className="text-center mt-10">
        <p>로그인이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 md:py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4 md:text-2xl">수업 로그</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {sent ? (
        <div className="text-green-400 bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
          세션 기록을 저장하고 요청을 전송했습니다 ✅
        </div>
      ) : (
        <>
          {/* 세션 선택 */}
          <div className="mb-4">
            <label className="block text-sm mb-1 text-[var(--text-secondary)]">세션 선택</label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
            >
              <option value="">— 세션을 선택하세요 —</option>
              {sessionOptions.map((opt) => (
                <option key={opt.session_id} value={opt.session_id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!sessionOptions.length && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                선택 가능한 완료된 세션이 없습니다.
              </p>
            )}
            {selectedSession && (
              <div className="mt-2 rounded-xl border border-[var(--border-color)] bg-[var(--card)] px-3 py-2 text-sm">
                <div className="font-medium text-white">{selectedSession.memberName}</div>
                {selectedSession.memberEmail && (
                  <div className="text-[var(--text-secondary)]">{selectedSession.memberEmail}</div>
                )}
                <div className="mt-1 text-[var(--text-secondary)]">
                  {selectedSession.date} {selectedSession.startLabel}
                  {selectedSession.endLabel ? ` ~ ${selectedSession.endLabel}` : ''}
                </div>
              </div>
            )}
          </div>

          {/* 운동 입력 리스트 */}
          <div className="space-y-3 mb-4">
            {exercises.map((ex, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--card)]/60 p-3 md:p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
                  <div className="flex-1 min-w-0">
                    <input
                      placeholder="운동명"
                      value={ex.name}
                      onChange={(e) => handleExerciseNameChange(i, e.target.value)}
                      className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(i)}
                    className="text-sm px-3 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--card)] self-end md:self-center"
                    title="항목 제거"
                  >
                    삭제
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {ex.sets.map((set, setIndex) => (
                    <div
                      key={setIndex}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr,1fr,auto] sm:items-center"
                    >
                      <div className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                        세트 {setIndex + 1}
                      </div>
                      <input
                        placeholder="중량"
                        value={set.weight}
                        onChange={(e) => handleSetChange(i, setIndex, 'weight', e.target.value)}
                        className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                      />
                      <input
                        placeholder="횟수"
                        value={set.reps}
                        onChange={(e) => handleSetChange(i, setIndex, 'reps', e.target.value)}
                        className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                      />
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSetFromExercise(i, setIndex)}
                          className="text-sm px-3 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--card)]"
                        >
                          세트 삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addSetToExercise(i)}
                  className="mt-3 w-full sm:w-auto px-3 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--card)]"
                >
                  + 세트 추가
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addExercise}
            className="mb-4 w-full md:w-auto px-3 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--card)]"
          >
            + 운동 추가
          </button>

          {/* 메모 */}
          <textarea
            placeholder="메모 (예: 오늘은 하체 위주, 통증 호소 등)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2 mb-4"
          />

          {/* 저장/전송 */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl"
            >
              {saving ? '저장 중...' : '세션 기록 저장 & 요청 전송'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
