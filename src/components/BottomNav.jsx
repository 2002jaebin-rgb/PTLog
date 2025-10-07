import React from 'react'
import { Home, Calendar, User, ClipboardList, Settings, LayoutDashboard, NotebookText } from 'lucide-react'

/**
 * 모바일 전용 하단 네비게이션
 * - role: 'member' | 'trainer'
 * - 아직 네비게이션 동작(redirect)은 넣지 않음 — UI/라벨만 표시
 */
export default function BottomNav({ role }) {
  // 공통 버튼 프리셋
  const Item = ({ icon, label, disabled }) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="flex flex-col items-center gap-1 px-2 py-1 text-[11px] leading-none text-[hsl(var(--muted))] hover:text-[hsl(var(--text))] disabled:opacity-60"
    >
      {icon}
      <span className="mt-0.5">{label}</span>
    </button>
  )

  // 역할별 항목(라벨 자동 전환)
  const items =
    role === 'trainer'
      ? [
          { icon: <LayoutDashboard size={20} />, label: '대시보드' },
          { icon: <Calendar size={20} />, label: '수업 관리' },  // 일정 → 수업 관리
          { icon: <User size={20} />, label: '회원' },
          { icon: <NotebookText size={20} />, label: '수업 로그' }, // 수업 일지 → 수업 로그
          { icon: <Settings size={20} />, label: '설정' },
        ]
      : [
          { icon: <Home size={20} />, label: '홈' },
          { icon: <ClipboardList size={20} />, label: '운동 로그' }, // 지난 수업 보기
          { icon: <NotebookText size={20} />, label: '내 로그' },   // 운동 일지 → 내 로그
          { icon: <Calendar size={20} />, label: '예약' },
          { icon: <Settings size={20} />, label: '설정' },
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
