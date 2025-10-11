import React from 'react'

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  ...inputProps
}) {
  return (
    <div className={`mb-3 ${className}`}>
      {label && <label className="block text-sm text-[var(--text-secondary)] mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="bg-[var(--card-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 w-full text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] outline-none"
        {...inputProps}
      />
    </div>
  )
}
