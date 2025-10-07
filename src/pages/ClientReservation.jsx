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
const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const ymdLocal = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ClientReservation() {
  const [loading, setLoading] = useState(true)

  const [memberId, setMemberId] = useState(null)
  const [trainerId, setTrainerId] = useState(null)
  const [trainerName, setTrainerName] = useState('')

  const [monday, setMonday] = useState(getMonday())
  const [sessions, setSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSlots, setSelectedSlots] = useState({})

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return {
        label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`,
        key: dayNames[d.getDay()],
        date: ymdLocal(d),
      }
    })
  }, [monday])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: memberRow } = await supabase
        .from('members')
        .select('id, trainer_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!memberRow) { setLoading(false); alert('회원 정보를 찾을 수 없습니다.'); return }

      setMemberId(memberRow.id)
      setTrainerId(memberRow.trainer_id || null)

      if (memberRow.trainer_id) {
        const { data: t } = await supabase
          .from('trainers')
          .select('id, name')
          .eq('id', memberRow.trainer_id)
          .maybeSingle()
        if (t) setTrainerName(t.name || '')
      }

      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    const fetchWeekData = async () => {
      if (!trainerId) return
      setLoading(true)

      const start = days[0].date
      const end = days[6].date

      const { data: sessRows } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', trainerId)
        .gte('date', start)
        .lte('date', end)

      setSessions(sessRows || [])

      const sessionIds = (sessRows || []).map(s => s.session_id)
      let pending = []
      if (sessionIds.length) {
        const { data: resvRows } = await supabase
          .from('reservations')
          .select('reservation_id, session_id, status')
          .in('session_id', sessionIds)
          .eq('status', 'pending')
        pending = resvRows || []
      }
      setPendingReservations(pending)

      const { data: myRes } = await supabase
        .from('reservations')
        .select('reservation_id, session_id, status')
        .eq('member_id', memberId)
        .order('reservation_time', { ascending: false })

      setMyReservations(myRes || [])
      setSelectedSlots({})
      setLoading(false)
    }
    if (trainerId && days.length === 7 && memberId) fetchWeekData()
  }, [trainerId, monday, days, memberId])

  const onToggleSlot = (dayKey, hhmm) => {
    const dateKey = days.find(d => d.key === dayKey)?.date
    if (!dateKey) return

    const cellStart = timeToMinutes(hhmm)
    const cellEnd = cellStart + 30

    const found = sessions.find(s => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes(hmsToHm(s.start_time))
      const sEnd   = timeToMinutes(hmsToHm(s.end_time))
      return sStart < cellEnd && sEnd > cellStart
    })
    if (!found) return
    if (found.status !== 'available') return

    const someonePending = pendingReservations.some(r => r.session_id === found.session_id)
    if (someonePending) { alert('다른 회원의 예약 대기 중인 시간입니다.'); return }

    const key = `${dayKey}-${hhmm}`
    setSelectedSlots(prev => (prev[key] ? {} : { [key]: true }))
  }

  const selectedSessionId = useMemo(() => {
    const key = Object.keys(selectedSlots)[0]
    if (!key) return null
    const [dayKey, hhmm] = key.split('-')
    const dateKey = days.find(d => d.key === dayKey)?.date
    if (!dateKey) return null

    const cellStart = timeToMinutes(hhmm)
    const cellEnd = cellStart + 30
    const s = sessions.find(ss => {
      if (ss.date !== dateKey) return false
      const sStart = timeToMinutes(hmsToHm(ss.start_time))
      const sEnd   = timeToMinutes(hmsToHm(ss.end_time))
      return sStart < cellEnd && sEnd > cellStart && ss.status === 'available'
    })
    return s?.session_id ?? null
  }, [selectedSlots, days, sessions])

  const requestReservation = async () => {
    if (!memberId || !selectedSessionId) return

    const myDup = myReservations.find(r => r.session_id === selectedSessionId && r.status === 'pending')
    if (myDup) { alert('이미 대기 중인 예약이 있습니다.'); return }

    const someonePending = pendingReservations.some(r => r.session_id === selectedSessionId)
    if (someonePending) { alert('다른 회원의 예약 대기 중인 시간입니다.'); return }

    const { error } = await supabase
      .from('reservations')
      .insert([{ session_id: selectedSessionId, member_id: memberId, status: 'pending' }])
    if (error) return alert('예약 실패: ' + error.message)

    setMyReservations(prev => [{ session_id: selectedSessionId, status: 'pending' }, ...prev])
    setPendingReservations(prev => [{ session_id: selectedSessionId, status: 'pending' }, ...prev])
    alert('예약 요청이 전송되었습니다!')
    setSelectedSlots({})
  }

  const startHour = 6
  const endHour = 23

  if (loading && !memberId) return <div className="p-6">불러오는 중...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">세션 예약</h1>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">내 트레이너</span>
          <span className="px-2 py-1 rounded bg-[rgba(59,130,246,0.2)] text-blue-300">
            {trainerName || '지정되지 않음'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setMonday(prev => {
            const d = new Date(prev); d.setDate(prev.getDate() - 7); return getMonday(d)
          })}>
            ◀ 지난 주
          </Button>
          <div className="text-sm text-[var(--text-secondary)]">
            {days[0]?.date} ~ {days[6]?.date}
          </div>
          <Button onClick={() => setMonday(prev => {
            const d = new Date(prev); d.setDate(prev.getDate() + 7); return getMonday(d)
          })}>
            다음 주 ▶
          </Button>
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
            // ✅ 기존 세션 위 클릭 허용 (available만 onToggleSlot에서 필터링)
            allowSelectingExisting={true}
            showStatusColors={{ available: true, pending: true, booked: true }}
          />
        ) : (
          <div className="p-6 text-[var(--text-secondary)]">
            아직 연결된 트레이너가 없습니다. 관리자에게 문의해 주세요.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={requestReservation}
          disabled={!selectedSessionId}
          className={!selectedSessionId ? 'opacity-50 cursor-not-allowed' : ''}
        >
          {selectedSessionId ? '예약 요청 보내기' : '시간을 선택하세요'}
        </Button>
      </div>
    </div>
  )
}
