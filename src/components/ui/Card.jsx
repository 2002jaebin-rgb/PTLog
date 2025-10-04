import React from 'react'

export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-[var(--card-dark)] border border-[var(--border-color)] rounded-2xl p-4 shadow ${className}`}>
      {children}
    </div>
  )
}
