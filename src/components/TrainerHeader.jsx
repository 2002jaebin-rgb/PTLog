import React from 'react'
import { Link } from 'react-router-dom'

// 부모(Header)에서 onLogout을 넘겨받아 호출만 함
export default function TrainerHeader({ trainer, onLogout }) {
  return (
    <header className="bg-[var(--card-dark)] border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center">
      <Link to="/dashboard" className="font-bold text-lg text-white">PTLog</Link>
      <div className="flex items-center gap-4">
        {trainer && <span className="text-[var(--text-secondary)]">{trainer.name}</span>}
        <Link to="/settings" className="text-[var(--text-secondary)] hover:text-white text-sm">설정</Link>
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
