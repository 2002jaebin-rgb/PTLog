import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

export default function TrainerLog() {
  const [me, setMe] = useState(null)                // 로그인한 트레이너 (auth user)
  const [members, setMembers] = useState([])        // 내 회원 목록
  const [memberId, setMemberId] = useState('')      // 선택된 회원 id
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

        // 2) 내 회원 목록 불러오기
        //    members.trainer_id 가 트레이너의 auth.users.id 인 구조를 가정
        const { data: myMembers, error: mErr } = await supabase
          .from('members')
          .select('id,name')
          .eq('trainer_id', user.id)
          .order('name', { ascending: true })

        if (mErr) throw mErr
        setMembers(myMembers || [])
      } catch (e) {
        console.error('[TrainerLog] init error:', e?.message || e)
        setError('초기 데이터를 불러오는 중 문제가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

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
    if (!memberId) return '회원을 선택해주세요.'
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
          {/* 회원 선택 */}
          <label className="block text-sm mb-1 text-[var(--text-secondary)]">회원 선택</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2 mb-4"
          >
            <option value="">— 회원을 선택하세요 —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* 운동 입력 리스트 */}
          <div className="space-y-3 mb-4">
            {exercises.map((ex, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  placeholder="운동명"
                  value={ex.name}
                  onChange={(e) => handleExerciseChange(i, 'name', e.target.value)}
                  className="flex-1 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                />
                <input
                  placeholder="세트"
                  value={ex.sets}
                  onChange={(e) => handleExerciseChange(i, 'sets', e.target.value)}
                  className="w-20 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                />
                <input
                  placeholder="횟수"
                  value={ex.reps}
                  onChange={(e) => handleExerciseChange(i, 'reps', e.target.value)}
                  className="w-20 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                />
                <input
                  placeholder="중량"
                  value={ex.weight}
                  onChange={(e) => handleExerciseChange(i, 'weight', e.target.value)}
                  className="w-24 bg-[var(--card)] border border-[var(--border-color)] rounded-xl px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => removeExercise(i)}
                  className="text-sm px-2 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--card)]"
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
