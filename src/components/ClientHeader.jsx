import React from 'react'
import { Link } from 'react-router-dom'

export default function ClientHeader({ member, onLogout }) {
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/client" className="font-bold text-lg text-white">PTLog</Link>
      <div className="flex items-center gap-4">
        {member && <span className="text-[var(--text-secondary)]">{member.name}</span>}
        <Link to="/client" className="text-[var(--text-secondary)] hover:text-white text-sm">내 운동</Link>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
          로그아웃
        </button>
      </div>
    </header>
  )
}
