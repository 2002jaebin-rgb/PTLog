import React from 'react'

export default function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button'
}) {
  const base = 'w-full py-3 font-semibold rounded-xl transition text-center'
  const styles = {
    primary: 'bg-[var(--accent-blue)] hover:bg-blue-700 text-white shadow',
    secondary: 'bg-[var(--card-dark)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}
