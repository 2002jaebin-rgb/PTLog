import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const MIN_PASSWORD_LENGTH = 6

export default function Dashboard() {
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    sessions_total: 0,
    password: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('members')
      .select('id, name, sessions_total, sessions_used')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) setMembers(data)
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const trimmedName = newMember.name.trim()
    const trimmedEmail = newMember.email.trim()
    const trimmedPassword = newMember.password.trim()
    const totalSessions = parseInt(newMember.sessions_total, 10)

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      alert('이름, 이메일, 비밀번호를 모두 입력해 주세요.')
      setLoading(false)
      return
    }

    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      alert(`비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 입력해 주세요.`)
      setLoading(false)
      return
    }

    if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
      alert('총 PT 회차를 1 이상으로 입력해 주세요.')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('add-member', {
        body: {
          trainer_id: user.id,
          name: trimmedName,
          email: trimmedEmail,
          sessions_total: totalSessions,
          password: trimmedPassword
        }
      })

      if (error) throw new Error(error.message || '등록 실패')
      if (data?.error) throw new Error(data.error)

      alert(`회원 "${trimmedName}" 등록 완료!\n${trimmedEmail} / ${trimmedPassword}`)
      setShowForm(false)
      setNewMember({ name: '', email: '', sessions_total: 0, password: '' })
      fetchMembers()
    } catch (err) {
      alert('회원 추가 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">트레이너 대시보드</h1>
        <Button onClick={() => setShowForm(true)}>+ 회원 추가</Button>
      </div>

      {showForm && (
        <Card className="max-w-md mb-6">
          <h2 className="text-lg font-semibold mb-3">새 회원 등록</h2>
          <form onSubmit={handleAddMember}>
            <Input
              label="이름"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="회원 이름"
              required
            />
            <Input
              type="email"
              label="이메일"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              placeholder="member@email.com"
              required
            />
            <Input
              type="password"
              label="비밀번호"
              value={newMember.password}
              onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
              placeholder="회원 로그인용 비밀번호 (최소 6자)"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <Input
              type="number"
              label="총 회차"
              value={newMember.sessions_total}
              onChange={(e) => setNewMember({ ...newMember, sessions_total: e.target.value })}
              placeholder="예: 10"
              min={1}
              required
            />
            <div className="flex gap-2 mt-4">
              <Button type="submit" disabled={loading}>
                {loading ? '등록 중...' : '등록하기'}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {members.map((m) => (
          <Card key={m.id} className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-white">{m.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {m.sessions_used} / {m.sessions_total}회
              </p>
            </div>
            <Link
              to={`/member/${m.id}`}
              className="text-[var(--accent-blue)] hover:underline"
            >
              상세보기
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
