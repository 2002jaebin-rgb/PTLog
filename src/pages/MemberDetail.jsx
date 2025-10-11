import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'
import { useParams } from 'react-router-dom'
import {
  createEmptyExercise,
  createEmptySet,
  ensureExerciseHasAtLeastOneSet,
  sanitizeExercisesForSubmit,
} from '@/utils/exerciseForm'

export default function MemberDetail() {
  const { id } = useParams()
  const [member, setMember] = useState(null)
  const [exercises, setExercises] = useState([createEmptyExercise()])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const fetchMember = async () => {
      const { data } = await supabase.from('members').select('*').eq('id', id).single()
      setMember(data)
    }
    fetchMember()
  }, [id])

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

  const handleSend = async () => {
    const normalizedExercises = sanitizeExercisesForSubmit(exercises)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('session_requests').insert([
      {
        trainer_id: user.id,
        member_id: id,
        notes: note,
        exercises: normalizedExercises,
        status: 'pending',
      },
    ])
    if (!error) setSent(true)
  }

  if (!member) return <p>로딩중...</p>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">{member.name} 회원 기록</h1>
      {sent ? (
        <p className="text-green-600">회원에게 기록을 전송했습니다 ✅</p>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {exercises.map((ex, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    placeholder="운동명"
                    value={ex.name}
                    onChange={(e) => handleExerciseNameChange(i, e.target.value)}
                    className="flex-1 border rounded px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(i)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    삭제
                  </button>
                </div>
                <div className="space-y-2">
                  {ex.sets.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr,1fr,auto] sm:items-center">
                      <div className="text-sm text-gray-600 border rounded px-2 py-1">
                        세트 {setIndex + 1}
                      </div>
                      <input
                        placeholder="중량"
                        value={set.weight}
                        onChange={(e) => handleSetChange(i, setIndex, 'weight', e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                      <input
                        placeholder="횟수"
                        value={set.reps}
                        onChange={(e) => handleSetChange(i, setIndex, 'reps', e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSetFromExercise(i, setIndex)}
                          className="border rounded px-2 py-1 text-sm"
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
                  className="border rounded px-2 py-1 text-sm"
                >
                  + 세트 추가
                </button>
              </div>
            ))}
          </div>
          <button onClick={addExercise} className="bg-gray-200 px-2 py-1 rounded mb-4">+ 운동 추가</button>
          <textarea
            placeholder="메모 (예: 오늘은 하체 집중)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border w-full p-2 mb-4"
          />
          <button onClick={handleSend} className="bg-blue-500 text-white px-4 py-2 rounded">회원에게 기록 전송</button>
        </>
      )}
    </div>
  )
}
