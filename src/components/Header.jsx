import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link, useNavigate } from 'react-router-dom'

export default function Header() {
  const [trainer, setTrainer] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchTrainer = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('trainers').select('name, email').eq('id', user.id).single()
      setTrainer(data)
    }
    fetchTrainer()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="bg-gray-800 text-white flex justify-between items-center px-4 py-3">
      <Link to="/dashboard" className="font-bold text-lg">PTLog</Link>
      <div className="flex items-center gap-4">
        {trainer && <span>{trainer.name}</span>}
        <Link to="/settings" className="text-gray-300 hover:text-white">설정</Link>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">로그아웃</button>
      </div>
    </header>
  )
}
