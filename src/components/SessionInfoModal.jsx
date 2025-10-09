import React from 'react'
import Button from './ui/Button'

const hm = (t) => (t || '').slice(0, 5)

export default function SessionInfoModal({ session, reservations, membersMap, onClose, onAccept, onReject }) {
  const isBooked = session.status === 'booked'
  const pendings = reservations.filter((r) => r.status === 'pending')
  const approved = reservations.find((r) => r.status === 'approved')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0b1220] text-white shadow-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10">
          <h3 className="text-lg font-semibold">세션 정보</h3>
        </div>
        <div className="p-5 space-y-3">
          <Row label="날짜" value={session.date} />
          <Row label="시간" value={`${hm(session.start_time)} ~ ${hm(session.end_time)}`} />
          <Row
            label="세션 길이"
            value={session.session_length >= 1 ? `${session.session_length}시간` : `${session.session_length * 60}분`}
          />
          <Row
            label="상태"
            value={session.status}
            valueClass={
              session.status === 'available'
                ? 'text-blue-300'
                : session.status === 'booked'
                ? 'text-green-400'
                : 'text-yellow-300'
            }
          />

          {isBooked && approved && (
            <div className="mt-2 text-sm">
              <div className="font-medium mb-1">예약자</div>
              <div className="text-[var(--text-secondary)]">
                {membersMap[approved.member_id]?.name || '알 수 없음'} ({membersMap[approved.member_id]?.email || approved.member_id})
              </div>
            </div>
          )}

          {pendings.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="font-medium">대기 중 요청</div>
              {pendings.map((r) => {
                const m = membersMap[r.member_id]
                return (
                  <div
                    key={r.reservation_id}
                    className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        {m?.name || '알 수 없음'}{' '}
                        <span className="text-[var(--text-secondary)]">({m?.email || r.member_id})</span>
                      </div>
                      <div className="text-[var(--text-secondary)]">
                        요청시간: {new Date(r.reservation_time).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => onAccept(r.reservation_id)}>수락</Button>
                      <Button size="sm" variant="secondary" onClick={() => onReject(r.reservation_id)}>거절</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {session.status === 'available' && pendings.length === 0 && (
            <div className="text-sm text-[var(--text-secondary)]">대기 중인 예약이 없습니다.</div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          <Button onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}
