import React from 'react'

export default function BottomNav({ role }) {
  const Item = ({ icon, label, disabled }) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="flex flex-col items-center gap-1 px-2 py-1 text-[11px] leading-none text-[hsl(var(--muted))] hover:text-[hsl(var(--text))] disabled:opacity-60"
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  )

  const items =
    role === 'trainer'
      ? [
          { icon: '📋', label: '대시보드' },
          { icon: '📅', label: '수업 관리' },
          { icon: '🧍', label: '회원' },
          { icon: '📝', label: '수업 로그' },
          { icon: '⚙️', label: '설정' },
        ]
      : [
          { icon: '🏠', label: '홈' },
          { icon: '📈', label: '운동 로그' },
          { icon: '📝', label: '내 로그' },
          { icon: '📅', label: '예약' },
          { icon: '⚙️', label: '설정' },
        ]

  return (
    <nav
      className="
        md:hidden
        fixed bottom-0 left-0 right-0
        bg-[hsl(var(--card))]
        border-t border-[color:var(--border-color)]
        flex items-center justify-around
        h-[64px] px-3
        [padding-bottom:env(safe-area-inset-bottom)]
        z-40
      "
      role="navigation"
      aria-label="하단 네비게이션"
    >
      {items.map((it, idx) => (
        <Item key={idx} icon={it.icon} label={it.label} disabled />
      ))}
    </nav>
  )
}
