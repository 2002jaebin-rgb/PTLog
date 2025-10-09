import React from 'react'
import Card from './ui/Card'
import Button from './ui/Button'

const hm = (t) => (t || '').slice(0, 5)

export default function PendingList({
  pendingBySession = {},
  sessions = [],
  membersMap = {},
  onAccept = () => {},
  onReject = () => {},
  onOpenSession = () => {},
}) {
  const entries = Object.entries(pendingBySession)

  if (entries.length === 0) {
    return <Card className="p-3 text-[var(--text-secondary)]">대기 중인 예약이 없습니다.</Card>
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">대기 중인 예약</h2>
      {entries.map(([sessionId, rs]) => {
        const s = sessions.find((x) => String(x.session_id) === String(sessionId))
        if (!s) return null
        return (
          <Card key={sessionId} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-white font-medium">
                {s.date} {hm(s.start_time)}–{hm(s.end_time)}{' '}
                <span className="ml-2 text-xs text-[var(--text-secondary)]">({s.status})</span>
              </div>
              <Button size="sm" onClick={() => onOpenSession(s)}>상세 보기</Button>
            </div>
            <div className="space-y-2">
              {rs.map((r) => {
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
                      <Button size="sm" onClick={() => onAccept(r.reservation_id, s.session_id)}>수락</Button>
                      <Button size="sm" variant="secondary" onClick={() => onReject(r.reservation_id)}>거절</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </section>
  )
}
