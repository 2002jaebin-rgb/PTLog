import React from 'react'

export default function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-[var(--card-dark)] border border-[var(--border-color)] 
      rounded-2xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.4)] 
      transition hover:border-[var(--accent-blue)] ${className}`}
    >
      {children}
    </div>
  )
}


