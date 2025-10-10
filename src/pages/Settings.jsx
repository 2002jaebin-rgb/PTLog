import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'

export default function Settings() {
  const [trainer, setTrainer] = useState({ name: '', email: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchTrainer = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('trainers').select('name, email').eq('id', user.id).maybeSingle()
      setTrainer(data)
    }
    fetchTrainer()
  }, [])

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('trainers')
      .update({ name: trainer.name, email: trainer.email })
      .eq('id', user.id)
    setMessage(error ? '저장 실패' : '저장 완료 ✅')
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">계정 설정</h1>
      <input
        type="text"
        placeholder="이름"
        value={trainer.name}
        onChange={(e) => setTrainer({ ...trainer, name: e.target.value })}
        className="border p-2 mb-2 w-full"
      />
      <input
        type="email"
        placeholder="이메일"
        value={trainer.email}
        onChange={(e) => setTrainer({ ...trainer, email: e.target.value })}
        className="border p-2 mb-2 w-full"
      />
      <button onClick={handleSave} className="bg-blue-500 text-white px-4 py-2 rounded">저장</button>
      {message && <p className="mt-2">{message}</p>}
    </div>
  )
}
