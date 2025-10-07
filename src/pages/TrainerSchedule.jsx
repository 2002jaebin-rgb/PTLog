import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'
import AddSessionModal from '../components/AddSessionModal'

// 유틸
const hm = (t) => (t || '').slice(0, 5)
const toMin = (t) => {
  const [h, m] = hm(t).split(':').map(Number)
  return h * 60 + m
}
const ymdLocal = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TrainerSchedule() {
  const [trainerId, setTrainerId] = useState(null)

  const [existingSessions, setExistingSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([]) // status=pending만
  const [allReservationsBySession, setAllReservationsBySession] = useState({}) // 세션별 모든 예약(pending/approved)
  const [membersMap, setMembersMap] = useState({})

  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // 셀 클릭 → 세션 상세 모달
  const [inspectedSession, setInspectedSession] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // 이번 주 월요일
  const getMonday = (d = new Date()) => {
    const date = new Date(d)
    const day = date.getDay() || 7
    if (day !== 1) date.setDate(date.getDate() - (day - 1))
    date.setHours(0, 0, 0, 0)
    return date
  }
  const [monday, setMonday] = useState(getMonday())

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return {
          label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`,
          key: dayNames[d.getDay()],
          date: ymdLocal(d),
        }
      }),
    [monday]
  )

  const startHour = 6
  const endHour = 23

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // 트레이너 인증이 auth_user_id인 경우, trainerId로 그대로 사용
      setTrainerId(user.id)
      await fetchWeek(user.id)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday])

  // 세션/예약 로딩
  const fetchWeek = async (id) => {
    setLoading(true)
    const start = days[0].date
    const end = days[6].date

    // 1) 세션
    const { data: sessions, error: sErr } = await supabase
      .from('sessions')
      .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
      .eq('trainer_id', id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (sErr) {
      console.error(sErr)
      setLoading(false)
      return
    }
    setExistingSessions(sessions || [])

    const sessionIds = (sessions || []).map((s) => s.session_id)
    let allRes = []
    let pendings = []
    let memMap = {}

    if (sessionIds.length) {
      // 2) 해당 세션들의 예약 전체(pending + approved)
      const { data: resAll, error: rErr } = await supabase
        .from('reservations')
        .select('reservation_id, session_id, member_id, status, reservation_time')
        .in('session_id', sessionIds)
      if (rErr) console.error(rErr)
      allRes = resAll || []
      pendings = allRes.filter((r) => r.status === 'pending')

      // 3) 예약자 정보
      const memberIds = [...new Set(allRes.map((r) => r.member_id))].filter(Boolean)
      if (memberIds.length) {
        const { data: members, error: mErr } = await supabase
          .from('members')
          .select('id, name, email')
          .in('id', memberIds)
        if (!mErr && members) {
          const map = {}
          members.forEach((m) => {
            map[m.id] = m
          })
          memMap = map
        }
      }
    }

    // 세션ID → 예약들 맵
    const mapBySession = {}
    for (const r of allRes) {
      if (!mapBySession[r.session_id]) mapBySession[r.session_id] = []
      mapBySession[r.session_id].push(r)
    }

    setAllReservationsBySession(mapBySession)
    setPendingReservations(pendings)
    setMembersMap(memMap)
    setLoading(false)
  }

  // 셀 클릭 시 포함된 세션 찾기 → 모달
  const onCellClick = (dayKey, hhmm) => {
    const dateKey = days.find((d) => d.key === dayKey)?.date
    if (!dateKey) return
    const cellStart = toMin(hhmm)
    const cellEnd = cellStart + 30
    const s = existingSessions.find((sess) => {
      if (sess.date !== dateKey) return false
      const sStart = toMin(sess.start_time)
      const sEnd = toMin(sess.end_time)
      return sStart < cellEnd && sEnd > cellStart
    })
    if (!s) return
    setInspectedSession(s)
    setShowInfoModal(true)
  }

  // 수락/거절(경합 안전: 조건부 업데이트)
  const acceptReservation = async (reservationId, sessionId) => {
    // 1) 예약 pending → approved
    const { error: rErr } = await supabase
      .from('reservations')
      .update({ status: 'approved' })
      .eq('reservation_id', reservationId)
      .eq('status', 'pending')
    if (rErr) {
      alert('예약 승인 실패(1): ' + rErr.message)
      return
    }

    // 2) 세션 available → booked
    const { error: sErr } = await supabase
      .from('sessions')
      .update({ status: 'booked' })
      .eq('session_id', sessionId)
      .eq('status', 'available')
    if (sErr) {
      alert('예약 승인 실패(2): ' + sErr.message)
      return
    }

    // 3) 같은 세션의 나머지 pending → rejected
    const { error: r2Err } = await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('session_id', sessionId)
      .eq('status', 'pending')
    if (r2Err) console.warn('다른 예약 거절 실패:', r2Err.message)

    await fetchWeek(trainerId)
    // 모달 재동기화
    if (inspectedSession && inspectedSession.session_id === sessionId) {
      const refreshed = (existingSessions || []).find((s) => s.session_id === sessionId)
      setInspectedSession(refreshed || null)
    }
  }

  const rejectReservation = async (reservationId) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('reservation_id', reservationId)
      .eq('status', 'pending')
    if (error) {
      alert('예약 거절 실패: ' + error.message)
      return
    }
    await fetchWeek(trainerId)
  }

  // pending 목록: 세션ID → pending 배열
  const pendingBySession = useMemo(() => {
    const map = {}
    for (const r of pendingReservations) {
      if (!map[r.session_id]) map[r.session_id] = []
      map[r.session_id].push(r)
    }
    return map
  }, [pendingReservations])

  // UI
  if (!trainerId) return <div className="p-6">불러오는 중…</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">트레이너 스케줄</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() =>
              setMonday((prev) => {
                const d = new Date(prev)
                d.setDate(prev.getDate() - 7)
                return getMonday(d)
              })
            }
          >
            ◀ 지난 주
          </Button>
          <span className="text-sm text-[var(--text-secondary)]">
            {days[0]?.date} ~ {days[6]?.date}
          </span>
          <Button
            onClick={() =>
              setMonday((prev) => {
                const d = new Date(prev)
                d.setDate(prev.getDate() + 7)
                return getMonday(d)
              })
            }
          >
            다음 주 ▶
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowAddModal(true)}>+ 수업 시간 추가</Button>
      </div>

      <Card className="p-4">
        <ScheduleGrid
          days={days}
          sessions={existingSessions}
          reservations={pendingReservations} // 노랑(pending)
          selectedSlots={{}} // 생성은 모달에서, 여기서는 선택 하이라이트 불필요
          selectable={true}
          onToggleSlot={onCellClick} // ← 클릭 시 세션 상세 모달
          startHour={startHour}
          endHour={endHour}
          allowSelectingExisting={true}
          selectionMode="single"
          showStatusColors={{ available: true, pending: true, booked: true }}
        />
      </Card>

      {/* 아래: pending 전용 리스트(빠른 수락/거절) */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">대기 중인 예약</h2>
        {Object.keys(pendingBySession).length === 0 ? (
          <Card className="p-3 text-[var(--text-secondary)]">대기 중인 예약이 없습니다.</Card>
        ) : (
          Object.entries(pendingBySession).map(([sessionId, rs]) => {
            const s = existingSessions.find((x) => String(x.session_id) === String(sessionId))
            if (!s) return null
            return (
              <Card key={sessionId} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white font-medium">
                    {s.date} {hm(s.start_time)}–{hm(s.end_time)}{' '}
                    <span className="ml-2 text-xs text-[var(--text-secondary)]">({s.status})</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setInspectedSession(s)
                      setShowInfoModal(true)
                    }}
                  >
                    상세 보기
                  </Button>
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
                          <Button size="sm" onClick={() => acceptReservation(r.reservation_id, s.session_id)}>
                            수락
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => rejectReservation(r.reservation_id)}>
                            거절
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })
        )}
      </section>

      {/* 수업 시간 추가 모달 */}
      {showAddModal && (
        <AddSessionModal
          trainerId={trainerId}
          monday={monday}
          onClose={() => setShowAddModal(false)}
          onSaved={() => fetchWeek(trainerId)}
        />
      )}

      {/* 세션 정보 모달 */}
      {showInfoModal && inspectedSession && (
        <SessionInfoModal
          session={inspectedSession}
          reservations={allReservationsBySession[inspectedSession.session_id] || []}
          membersMap={membersMap}
          onClose={() => setShowInfoModal(false)}
          onAccept={(reservationId) => acceptReservation(reservationId, inspectedSession.session_id)}
          onReject={(reservationId) => rejectReservation(reservationId)}
        />
      )}
    </div>
  )
}

/** 세션 상세 모달: pending이면 수락/거절, booked/available이면 정보만 */
function SessionInfoModal({ session, reservations, membersMap, onClose, onAccept, onReject }) {
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
