import React, { useState } from 'react'
import { supabase } from '@/supabaseClient'
import Button from './ui/Button'
import Card from './ui/Card'

export default function DeleteSessionModal({ trainerId, sessions, onClose, onDeleted }) {
  const [selected, setSelected] = useState([])

  const toggleSelect = (sid) =>
    setSelected((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]))

  const handleDelete = async () => {
    if (!selected.length) return alert('삭제할 세션을 선택하세요.')
    if (!confirm(`${selected.length}개의 세션을 삭제하시겠습니까?`)) return

    const { error } = await supabase
      .from('sessions')
      .delete()
      .in('session_id', selected)
      .eq('trainer_id', trainerId)
      .eq('status', 'available') // pending/booked 보호
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    alert('삭제 완료!')
    onDeleted?.()
    onClose?.()
  }

  const available = sessions.filter((s) => s.status === 'available')
  const locked = sessions.filter((s) => s.status !== 'available')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#0b1220] rounded-2xl text-white shadow-xl border border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">수업 시간 삭제</h2>

        {available.length === 0 ? (
          <p className="text-[var(--text-secondary)]">삭제 가능한 세션이 없습니다.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
            {available.map((s) => (
              <label
                key={s.session_id}
                className="flex items-center gap-3 border border-white/10 rounded p-2 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.session_id)}
                  onChange={() => toggleSelect(s.session_id)}
                />
                <span>
                  {s.date} {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)} ({s.session_length}h)
                </span>
              </label>
            ))}
          </div>
        )}

        {locked.length > 0 && (
          <Card className="p-3 bg-[#1a2238] text-xs text-[var(--text-secondary)] mb-3">
            예약 대기 중(pending) 또는 확정(booked)된 세션은 삭제할 수 없습니다.
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="danger" onClick={handleDelete}>선택 삭제</Button>
        </div>
      </div>
    </div>
  )
}
