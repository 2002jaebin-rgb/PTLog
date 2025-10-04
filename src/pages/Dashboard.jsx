import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', email: '', sessions_total: 0, password: '' })
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
  
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
            trainer_id: user.id,
            name: newMember.name,
            email: newMember.email,
            sessions_total: parseInt(newMember.sessions_total, 10),
            password: newMember.password
          }),          
      })
  
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
  
      alert(`회원 "${newMember.name}" 등록 완료!\n 비밀번호: ${data.password}`)
      setShowForm(false)
      setNewMember({ name: '', email: '', sessions_total: 0 })
      fetchMembers()
    } catch (err) {
      alert('회원 추가 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }  

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">트레이너 대시보드</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          + 회원 추가
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddMember}
          className="border p-4 mb-6 rounded bg-gray-50 max-w-md"
        >
          <h2 className="font-semibold mb-2">새 회원 등록</h2>
          <input
            required
            type="text"
            placeholder="이름"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            required
            type="email"
            placeholder="이메일"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            required
            type="password"
            placeholder="비밀번호 (회원 로그인용)"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <input
            required
            type="number"
            placeholder="총 회차"
            value={newMember.sessions_total}
            onChange={(e) => setNewMember({ ...newMember, sessions_total: e.target.value })}
            className="border p-2 w-full mb-2"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 text-white px-3 py-2 rounded"
            >
              {loading ? '등록 중...' : '등록하기'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-300 px-3 py-2 rounded"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <ul>
        {members.map((m) => (
          <li key={m.id} className="border-b py-2 flex justify-between items-center">
            <span>{m.name} ({m.sessions_used}/{m.sessions_total}회)</span>
            <Link to={`/member/${m.id}`} className="text-blue-500">상세보기</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
