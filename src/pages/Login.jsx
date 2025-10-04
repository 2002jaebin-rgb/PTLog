import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setError(error.message)

    // 로그인 후 트레이너 페이지로 리다이렉트
    const { data: trainer } = await supabase
      .from('trainers')
      .select('id')
      .eq('id', data.user.id)
      .single()

    if (trainer) navigate('/dashboard')
    else navigate('/client')
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-dark)]">
      <div className="bg-[var(--card-dark)] p-6 rounded-lg shadow-md w-full sm:max-w-md">
        <h2 className="text-2xl font-semibold text-white mb-6">PTLog 로그인</h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <form onSubmit={handleLogin}>
          <Input
            type="email"
            label="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="mb-4"
          />
          <Input
            type="password"
            label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mb-6"
          />
          <Button type="submit" className="w-full py-3 text-lg font-semibold">
            로그인
          </Button>
        </form>
      </div>
    </div>
  )
}
