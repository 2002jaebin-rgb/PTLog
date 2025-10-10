import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

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
  const [exercises, setExercises] = useState([
    { name: '', sets: '', reps: '', weight: '' }
  ])
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
            .select('session_id, member_id, status')
            .in('session_id', sessionIds)
            .eq('status', 'approved')

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
              const reservation = (approvedReservations || []).find((r) => r.session_id === session.session_id)
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
                session_id: session.session_id,
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

  const handleExerciseChange = (index, field, value) => {
    const updated = [...exercises]
    updated[index][field] = value
    setExercises(updated)
  }

  const addExercise = () => {
    setExercises(prev => [...prev, { name: '', sets: '', reps: '', weight: '' }])
  }

  const removeExercise = (i) => {
    setExercises(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  const validate = () => {
    if (!me) return '로그인이 필요합니다.'
    if (!sessionId) return '세션을 선택해주세요.'
    if (!memberId) return '선택된 세션의 회원 정보를 찾을 수 없습니다.'
    // 최소 하나라도 이름이 채워진 운동이 있는지
    const hasContent = exercises.some(ex => ex.name?.trim())
    if (!hasContent) return '최소 1개 이상의 운동을 입력해주세요.'
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
      // session_requests에 pending으로 기록
      const payload = {
        trainer_id: me.id,          // 트레이너 auth.users.id
        member_id: memberId,        // 선택된 회원 PTLog id (members.id)
        notes: note || null,
        exercises,                  // JSON으로 저장
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
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">수업 로그</h1>

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
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-1">
                  <input
                    placeholder="운동명"
                    value={ex.name}
                    onChange={(e) => handleExerciseChange(i, 'name', e.target.value)}
                    className="w-full sm:flex-1 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:w-auto">
                    <input
                      placeholder="세트"
                      value={ex.sets}
                      onChange={(e) => handleExerciseChange(i, 'sets', e.target.value)}
                      className="w-full sm:w-20 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                    />
                    <input
                      placeholder="횟수"
                      value={ex.reps}
                      onChange={(e) => handleExerciseChange(i, 'reps', e.target.value)}
                      className="w-full sm:w-20 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                    />
                    <input
                      placeholder="중량"
                      value={ex.weight}
                      onChange={(e) => handleExerciseChange(i, 'weight', e.target.value)}
                      className="w-full sm:w-24 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeExercise(i)}
                  className="w-full sm:w-auto text-sm px-2 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--card)]"
                  title="항목 제거"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addExercise}
            className="mb-4 px-3 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--card)]"
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
          <div className="flex gap-2">
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
