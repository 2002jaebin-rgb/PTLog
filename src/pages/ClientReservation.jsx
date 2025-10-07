import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'

const getMonday = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay() || 7
  if (day !== 1) d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}
const hmsToHm = (s) => (s || '').slice(0, 5)
const hmToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const toHm = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const renderLength = (len) => (len >= 1 ? `${len}시간` : `${len * 60}분`)

export default function ClientReservation() {
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState(null)
  const [trainerId, setTrainerId] = useState(null)
  const [trainerName, setTrainerName] = useState('')

  const [monday, setMonday] = useState(getMonday())
  const [sessions, setSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])

  // 블럭 하이라이트용
  const [selectedSlots, setSelectedSlots] = useState({})
  // 모달에 띄울 세션
  const [pickedSession, setPickedSession] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return { label: `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`, key: dayNames[d.getDay()], date: ymdLocal(d) }
  }), [monday])

  // 로그인 → member → trainer
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: memberRow } = await supabase
        .from('members').select('id, trainer_id').eq('auth_user_id', user.id).maybeSingle()

      if (!memberRow) { setLoading(false); alert('회원 정보를 찾을 수 없습니다.'); return }

      setMemberId(memberRow.id)
      setTrainerId(memberRow.trainer_id || null)

      if (memberRow.trainer_id) {
        const { data: t } = await supabase
          .from('trainers').select('id, name').eq('id', memberRow.trainer_id).maybeSingle()
        if (t?.name) setTrainerName(t.name)
      }
      setLoading(false)
    }
    init()
  }, [])

  // 주간 데이터
  useEffect(() => {
    const fetchWeek = async () => {
      if (!trainerId) return
      setLoading(true)
      const start = days[0].date, end = days[6].date

      const { data: sessRows } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', trainerId).gte('date', start).lte('date', end)
      setSessions(sessRows || [])

      const sids = (sessRows || []).map(s => s.session_id)
      let pending = []
      if (sids.length) {
        const { data: resv } = await supabase
          .from('reservations').select('reservation_id, session_id, status')
          .in('session_id', sids).eq('status', 'pending')
        pending = resv || []
      }
      setPendingReservations(pending)

      const { data: myRes } = await supabase
        .from('reservations').select('reservation_id, session_id, status')
        .eq('member_id', memberId).order('reservation_time', { ascending: false })
      setMyReservations(myRes || [])

      setSelectedSlots({})
      setPickedSession(null)
      setModalOpen(false)
      setLoading(false)
    }
    if (trainerId && days.length === 7 && memberId) fetchWeek()
  }, [trainerId, monday, days, memberId])

  // ──────────────── 클릭: 한 번 클릭 → 그 셀을 포함하는 "세션 블럭" 하이라이트 & 모달 ────────────────
  const onToggleSlot = (dayKey, hhmm) => {
    const dateKey = days.find(d => d.key === dayKey)?.date
    if (!dateKey) return
    const cellStart = hmToMin(hhmm)
    const cellEnd = cellStart + 30

    // 이 셀을 포함하는 세션 찾기
    const s = sessions.find(sess => {
      if (sess.date !== dateKey) return false
      const sStart = hmToMin(hmsToHm(sess.start_time))
      const sEnd   = hmToMin(hmsToHm(sess.end_time))
      return sStart < cellEnd && sEnd > cellStart
    })
    if (!s) return

    // 블럭 전체(30분 단위로) 시각화
    const startM = hmToMin(hmsToHm(s.start_time))
    const endM   = hmToMin(hmsToHm(s.end_time))
    const newSel = {}
    for (let t = startM; t < endM; t += 30) newSel[`${dayKey}-${toHm(t)}`] = true
    setSelectedSlots(newSel)

    setPickedSession(s)
    setModalOpen(true)
  }

  // 예약 요청 (모달에서만 호출)
  const requestReservation = async () => {
    if (!memberId || !pickedSession) return

    // 상태 체크: available + 타회원 pending 없음 + 내 pending 중복 없음
    const hasPending = pendingReservations.some(r => r.session_id === pickedSession.session_id)
    const myDup = myReservations.find(r => r.session_id === pickedSession.session_id && r.status === 'pending')
    if (pickedSession.status !== 'available' || hasPending || myDup) return

    const { error } = await supabase
      .from('reservations')
      .insert([{ session_id: pickedSession.session_id, member_id: memberId, status: 'pending' }])
    if (error) { alert('예약 실패: ' + error.message); return }

    setPendingReservations(prev => [{ session_id: pickedSession.session_id, status: 'pending' }, ...prev])
    setMyReservations(prev => [{ session_id: pickedSession.session_id, status: 'pending' }, ...prev])

    alert('예약 요청이 전송되었습니다!')
    setModalOpen(false)
  }

  const startHour = 6, endHour = 23
  if (loading && !memberId) return <div className="p-6">불러오는 중...</div>

  // 모달 상태 도출
  const modalStatus = (() => {
    if (!pickedSession) return { text: '-', reservable: false }
    const isPending = pendingReservations.some(r => r.session_id === pickedSession.session_id)
    const reservable = pickedSession.status === 'available' && !isPending
    return { text: reservable ? '예약 가능' : '예약 불가능', reservable }
  })()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">세션 예약</h1>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">내 트레이너</span>
          <span className="px-2 py-1 rounded bg-[rgba(59,130,246,0.2)] text-blue-300">
            {trainerName || ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setMonday(prev => { const d = new Date(prev); d.setDate(prev.getDate() - 7); return getMonday(d) })}>◀ 지난 주</Button>
          <div className="text-sm text-[var(--text-secondary)]">{days[0]?.date} ~ {days[6]?.date}</div>
          <Button onClick={() => setMonday(prev => { const d = new Date(prev); d.setDate(prev.getDate() + 7); return getMonday(d) })}>다음 주 ▶</Button>
        </div>
      </Card>

      <div className="border border-gray-700 rounded-md overflow-hidden">
        {trainerId ? (
          <ScheduleGrid
            days={days}
            sessions={sessions}
            reservations={pendingReservations}
            selectedSlots={selectedSlots}
            selectable={true}
            onToggleSlot={onToggleSlot}
            startHour={startHour}
            endHour={endHour}
            allowSelectingExisting={true}
            showStatusColors={{ available: true, pending: true, booked: true }}
            selectionMode="single"
          />
        ) : (
          <div className="p-6 text-[var(--text-secondary)]">연결된 트레이너가 없습니다.</div>
        )}
      </div>

      {/* ⬇️ 모달 */}
      {modalOpen && pickedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0b1220] text-white shadow-xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold">세션 정보</h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label="날짜" value={pickedSession.date} />
              <Row label="시작" value={hmsToHm(pickedSession.start_time)} />
              <Row label="종료" value={hmsToHm(pickedSession.end_time)} />
              <Row label="세션 길이" value={renderLength(pickedSession.session_length || 1)} />
              <Row
                label="상태"
                value={modalStatus.text}
                valueClass={modalStatus.reservable ? 'text-green-400' : 'text-yellow-300'}
              />
              {!modalStatus.reservable && (
                <p className="text-xs text-[var(--text-secondary)]">
                  * 예약 대기(pending) 또는 이미 예약됨(booked) 상태에서는 예약이 불가합니다.
                </p>
              )}
            </div>
            <div className="p-4 flex gap-2 justify-end border-t border-white/10">
              <Button onClick={() => setModalOpen(false)}>닫기</Button>
              <Button
                onClick={requestReservation}
                disabled={!modalStatus.reservable}
                className={!modalStatus.reservable ? 'opacity-50 cursor-not-allowed' : ''}
              >
                예약 요청
              </Button>
            </div>
          </div>
        </div>
      )}
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
