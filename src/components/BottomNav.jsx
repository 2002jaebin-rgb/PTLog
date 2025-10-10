import React from 'react'
import { NavLink } from 'react-router-dom'

export default function BottomNav({ role }) {
  if (!role) return null

  const items =
    role === 'trainer'
      ? [
          { icon: '📋', label: '대시보드', to: '/dashboard' },
          { icon: '📅', label: '수업 관리', to: '/trainer-schedule' },
          { icon: '🧍', label: '회원', to: '/member-list' },
          { icon: '📝', label: '수업 로그', to: '/trainer-log' },
          { icon: '⚙️', label: '설정', to: '/settings' }
        ]
      : [
          { icon: '🏠', label: '홈', to: '/client' },
          { icon: '📈', label: '운동 로그', to: '/client-history' },
          { icon: '📝', label: '내 로그', to: '/client-log' },
          { icon: '📅', label: '예약', to: '/client-reservation' },
          { icon: '⚙️', label: '설정', to: '/settings' }
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
      {items.map(({ icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            [
              'flex flex-col items-center gap-1 px-2 py-1 text-[11px] leading-none transition-colors',
              isActive
                ? 'text-[hsl(var(--text))]'
                : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--text))]'
            ].join(' ')
          }
        >
          <span className="text-lg">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
