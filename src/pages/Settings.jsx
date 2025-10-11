import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'

export default function Settings() {
  const [trainer, setTrainer] = useState({ name: '', email: '' })
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

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

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage('로그아웃 실패')
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-4">계정 설정</h1>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="이름"
            value={trainer?.name ?? ''}
            onChange={(e) => setTrainer({ ...trainer, name: e.target.value })}
            className="w-full rounded border border-[color:var(--border-color)] bg-[hsl(var(--card))] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="이메일"
            value={trainer?.email ?? ''}
            onChange={(e) => setTrainer({ ...trainer, email: e.target.value })}
            className="w-full rounded border border-[color:var(--border-color)] bg-[hsl(var(--card))] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            className="w-full rounded bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            저장
          </button>
          {message && <p className="text-sm text-[hsl(var(--muted))]">{message}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--border-color)] bg-[hsl(var(--card))] p-4">
        <h2 className="mb-3 text-base font-semibold">보안</h2>
        <p className="mb-4 text-sm text-[hsl(var(--muted))]">
          모바일에서 안전하게 계정을 종료하려면 아래의 로그아웃 버튼을 눌러주세요.
        </p>
        <button
          onClick={handleLogout}
          className="w-full rounded border border-red-500 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
