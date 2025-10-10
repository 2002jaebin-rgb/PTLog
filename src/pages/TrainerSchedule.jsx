import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'
import AddSessionModal from '../components/AddSessionModal'
import DeleteSessionModal from '../components/DeleteSessionModal'
import SessionInfoModal from '../components/SessionInfoModal'
import PendingList from '../components/PendingList'

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
  const navigate = useNavigate()
  const [trainerId, setTrainerId] = useState(null)

  const [existingSessions, setExistingSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([]) // status=pending만
  const [allReservationsBySession, setAllReservationsBySession] = useState({}) // 세션별 모든 예약(pending/approved)
  const [membersMap, setMembersMap] = useState({})

  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
    const checkIsMobile = () => {
      if (typeof window === 'undefined') return
      setIsMobile(window.innerWidth <= 768)
    }
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
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
          members.forEach((m) => { map[m.id] = m })
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
    if (rErr) { alert('예약 승인 실패(1): ' + rErr.message); return }

    // 2) 세션 available → booked
    const { error: sErr } = await supabase
      .from('sessions')
      .update({ status: 'booked' })
      .eq('session_id', sessionId)
      .eq('status', 'available')
    if (sErr) { alert('예약 승인 실패(2): ' + sErr.message); return }

    // 3) 같은 세션의 나머지 pending → rejected
    const { error: r2Err } = await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('session_id', sessionId)
      .eq('status', 'pending')
    if (r2Err) console.warn('다른 예약 거절 실패:', r2Err.message)

    await fetchWeek(trainerId)
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
    if (error) { alert('예약 거절 실패: ' + error.message); return }
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

  if (!trainerId) return <div className="p-6">불러오는 중…</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">트레이너 스케줄</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setMonday(prev => { const d = new Date(prev); d.setDate(prev.getDate()-7); return getMonday(d) })}>◀ 지난 주</Button>
          <span className="text-sm text-[var(--text-secondary)]">{days[0]?.date} ~ {days[6]?.date}</span>
          <Button onClick={() => setMonday(prev => { const d = new Date(prev); d.setDate(prev.getDate()+7); return getMonday(d) })}>다음 주 ▶</Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (isMobile) {
              navigate('/trainer-schedule/add', { state: { monday: monday.toISOString() } })
            } else {
              setShowAddModal(true)
            }
          }}
        >
          + 수업 시간 추가
        </Button>
        <Button onClick={() => setShowDeleteModal(true)} className="ml-2 bg-red-600 hover:bg-red-700">🗑 수업 시간 삭제</Button>
      </div>

      <Card className="p-4">
        <ScheduleGrid
          days={days}
          sessions={existingSessions}
          reservations={pendingReservations}
          selectedSlots={{}}
          selectable={true}
          onToggleSlot={onCellClick}
          startHour={startHour}
          endHour={endHour}
          allowSelectingExisting={true}
          selectionMode="single"
          showStatusColors={{ available: true, pending: true, booked: true }}
        />
      </Card>

      {/* 대기 중 예약 리스트 */}
      <PendingList
        pendingBySession={pendingBySession}
        sessions={existingSessions}
        membersMap={membersMap}
        onAccept={acceptReservation}
        onReject={rejectReservation}
        onOpenSession={(s) => { setInspectedSession(s); setShowInfoModal(true) }}
      />

      {/* 모달들 */}
      {showAddModal && (
        <AddSessionModal
          trainerId={trainerId}
          monday={monday}
          onClose={() => setShowAddModal(false)}
          onSaved={() => fetchWeek(trainerId)}
        />
      )}

      {showDeleteModal && (
        <DeleteSessionModal
          trainerId={trainerId}
          sessions={existingSessions}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => fetchWeek(trainerId)}
        />
      )}

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
