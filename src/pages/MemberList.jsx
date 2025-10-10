import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function MemberList() {
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
      .select('id, name, email, sessions_total, sessions_used')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) setMembers(data)
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          trainer_id: user.id,
          name: newMember.name,
          email: newMember.email,
          sessions_total: parseInt(newMember.sessions_total, 10),
          password: newMember.password
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '등록 실패')

      alert(`회원 "${newMember.name}" 등록 완료!\n${newMember.email} / ${newMember.password}`)
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
        <h1 className="text-2xl font-bold text-white">회원 목록</h1>
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
            />
            <Input
              type="email"
              label="이메일"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              placeholder="member@email.com"
            />
            <Input
              type="password"
              label="비밀번호"
              value={newMember.password}
              onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
              placeholder="회원 로그인용 비밀번호"
            />
            <Input
              type="number"
              label="총 회차"
              value={newMember.sessions_total}
              onChange={(e) => setNewMember({ ...newMember, sessions_total: e.target.value })}
              placeholder="예: 10"
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
        {members.map((member) => {
          const remainingSessions = Math.max(
            (member.sessions_total || 0) - (member.sessions_used || 0),
            0
          )

          return (
            <Card key={member.id}>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-white">{member.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">{member.email}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  남은 PT 횟수: {remainingSessions}회
                </p>
              </div>
            </Card>
          )
        })}
        {members.length === 0 && (
          <Card className="text-center text-[var(--text-secondary)]">
            아직 등록된 회원이 없습니다. 신규 회원을 추가해 보세요.
          </Card>
        )}
      </div>
    </div>
  )
}
