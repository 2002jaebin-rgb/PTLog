import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [members, setMembers] = useState([])

  useEffect(() => {
    const fetchMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('members')
        .select('id, name, sessions_total, sessions_used')
        .eq('trainer_id', user.id)
      if (!error) setMembers(data)
    }
    fetchMembers()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">트레이너 대시보드</h1>
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
