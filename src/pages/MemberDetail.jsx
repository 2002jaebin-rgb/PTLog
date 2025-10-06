import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'
import { useParams } from 'react-router-dom'

export default function MemberDetail() {
  const { id } = useParams()
  const [member, setMember] = useState(null)
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', weight: '' }])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const fetchMember = async () => {
      const { data } = await supabase.from('members').select('*').eq('id', id).single()
      setMember(data)
    }
    fetchMember()
  }, [id])

  const handleChange = (index, field, value) => {
    const updated = [...exercises]
    updated[index][field] = value
    setExercises(updated)
  }

  const addExercise = () => setExercises([...exercises, { name: '', sets: '', reps: '', weight: '' }])

  const handleSend = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('session_requests').insert([
      {
        trainer_id: user.id,
        member_id: id,
        notes: note,
        exercises,
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
          {exercises.map((ex, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input placeholder="운동명" value={ex.name} onChange={(e) => handleChange(i, 'name', e.target.value)} className="border p-1" />
              <input placeholder="세트" value={ex.sets} onChange={(e) => handleChange(i, 'sets', e.target.value)} className="border p-1 w-16" />
              <input placeholder="횟수" value={ex.reps} onChange={(e) => handleChange(i, 'reps', e.target.value)} className="border p-1 w-16" />
              <input placeholder="중량" value={ex.weight} onChange={(e) => handleChange(i, 'weight', e.target.value)} className="border p-1 w-16" />
            </div>
          ))}
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
