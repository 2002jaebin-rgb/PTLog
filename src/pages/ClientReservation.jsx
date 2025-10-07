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

export default function ClientReservation() {
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState(null)
  const [trainerId, setTrainerId] = useState(null)
  const [trainerName, setTrainerName] = useState('')

  const [monday, setMonday] = useState(getMonday())
  const [sessions, setSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])

  // 선택된 세션 (블럭)
  const [selectedSlots, setSelectedSlots] = useState({})
  const [pickedSessionId, setPickedSessionId] = useState(null) // ← 블럭의 session_id 저장

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

      const { data: memberRow, error: mErr } = await supabase
        .from('members').select('id, trainer_id').eq('auth_user_id', user.id).maybeSingle()

      if (mErr || !memberRow) { setLoading(false); alert('회원 정보를 찾을 수 없습니다.'); return }

      setMemberId(memberRow.id)
      setTrainerId(memberRow.trainer_id || null)

      if (memberRow.trainer_id) {
        // 이름 조회 실패해도 조용히 무시 (UI만)
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

      setSelectedSlots({}); setPickedSessionId(null)
      setLoading(false)
    }
    if (trainerId && days.length === 7 && memberId) fetchWeek()
  }, [trainerId, monday, days, memberId])

  // ──────────────── 클릭: 한 번 클릭으로 "블럭(세션)" 선택 ────────────────
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
    if (s.status !== 'available') return
    if (pendingReservations.some(r => r.session_id === s.session_id)) {
      alert('다른 회원의 예약 대기 중인 시간입니다.')
      return
    }

    // 이미 같은 세션이 선택되어 있으면 해제
    if (pickedSessionId === s.session_id) {
      setPickedSessionId(null)
      setSelectedSlots({})
      return
    }

    // 블럭 전체(30분 단위로) 시각화
    const startM = hmToMin(hmsToHm(s.start_time))
    const endM   = hmToMin(hmsToHm(s.end_time))
    const newSel = {}
    for (let t = startM; t < endM; t += 30) {
      newSel[`${dayKey}-${toHm(t)}`] = true
    }
    setSelectedSlots(newSel)
    setPickedSessionId(s.session_id)
  }

  const requestReservation = async () => {
    if (!memberId || !pickedSessionId) return

    if (myReservations.find(r => r.session_id === pickedSessionId && r.status === 'pending')) {
      alert('이미 대기 중인 예약이 있습니다.'); return
    }
    if (pendingReservations.some(r => r.session_id === pickedSessionId)) {
      alert('다른 회원의 예약 대기 중인 시간입니다.'); return
    }

    const { error } = await supabase
      .from('reservations')
      .insert([{ session_id: pickedSessionId, member_id: memberId, status: 'pending' }])
    if (error) return alert('예약 실패: ' + error.message)

    setMyReservations(prev => [{ session_id: pickedSessionId, status: 'pending' }, ...prev])
    setPendingReservations(prev => [{ session_id: pickedSessionId, status: 'pending' }, ...prev])
    alert('예약 요청이 전송되었습니다!')
    setSelectedSlots({}); setPickedSessionId(null)
  }

  const startHour = 6, endHour = 23
  if (loading && !memberId) return <div className="p-6">불러오는 중...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">세션 예약</h1>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">내 트레이너</span>
          <span className="px-2 py-1 rounded bg-[rgba(59,130,246,0.2)] text-blue-300">
            {trainerName || '' /* 이름 로딩 실패 시 그냥 공백 처리 */}
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
            selectionMode="single"  // ← 한 번 클릭
          />
        ) : (
          <div className="p-6 text-[var(--text-secondary)]">연결된 트레이너가 없습니다.</div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={requestReservation} disabled={!pickedSessionId} className={!pickedSessionId ? 'opacity-50 cursor-not-allowed' : ''}>
          {pickedSessionId ? '예약 요청 보내기' : '시간을 선택하세요'}
        </Button>
      </div>
    </div>
  )
}
