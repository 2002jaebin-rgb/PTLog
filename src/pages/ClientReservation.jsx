import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'

// 로컬 기준 가장 가까운 월요일
const getMonday = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay() || 7 // Sun=0 -> 7
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

  // 로그인 회원과 연결된 트레이너
  const [memberId, setMemberId] = useState(null)
  const [trainerId, setTrainerId] = useState(null)
  const [trainerName, setTrainerName] = useState('')

  // 달력/세션/예약
  const [monday, setMonday] = useState(getMonday())
  const [sessions, setSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSlots, setSelectedSlots] = useState({}) // 한 칸만 선택

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

  // ─────────────────────────────────────────────────────────────
  // 1) 로그인 → 회원 → trainer_id & 트레이너 이름
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // members에서 trainer_id 포함 조회
      const { data: memberRow, error: mErr } = await supabase
        .from('members')
        .select('id, trainer_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (mErr || !memberRow) {
        setLoading(false)
        alert('회원 정보를 찾을 수 없습니다.')
        return
      }
      setMemberId(memberRow.id)
      setTrainerId(memberRow.trainer_id || null)

      if (memberRow.trainer_id) {
        const { data: t, error: tErr } = await supabase
          .from('trainers')
          .select('id, name')
          .eq('id', memberRow.trainer_id)
          .maybeSingle()
        if (!tErr && t) setTrainerName(t.name || '')
      }

      setLoading(false)
    }
    init()
  }, [])
  // ─────────────────────────────────────────────────────────────

  // 2) 주간 데이터 로드 (trainerId, monday가 정해지면)
  useEffect(() => {
    const fetchWeekData = async () => {
      if (!trainerId) return
      setLoading(true)

      const start = days[0].date
      const end = days[6].date

      // 트레이너의 주간 세션 (available/pending/booked)
      const { data: sessRows } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', trainerId)
        .gte('date', start)
        .lte('date', end)

      setSessions(sessRows || [])

      // 해당 세션들의 pending (누구의 것이든)
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

      // 나의 예약 현황
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

  // 3) 셀 클릭 → available & 타회원 pending 없음일 때만 한 칸 선택
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
    if (someonePending) {
      alert('다른 회원의 예약 대기 중인 시간입니다.')
      return
    }

    const key = `${dayKey}-${hhmm}`
    setSelectedSlots(prev => (prev[key] ? {} : { [key]: true }))
  }

  // 4) 선택된 세션 id
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

  // 5) 예약 요청
  const requestReservation = async () => {
    if (!memberId || !selectedSessionId) return

    // 내 중복 요청 방지
    const myDup = myReservations.find(r => r.session_id === selectedSessionId && r.status === 'pending')
    if (myDup) {
      alert('이미 대기 중인 예약이 있습니다.')
      return
    }
    // 타회원 pending 차단
    const someonePending = pendingReservations.some(r => r.session_id === selectedSessionId)
    if (someonePending) {
      alert('다른 회원의 예약 대기 중인 시간입니다.')
      return
    }

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

      {/* 상단 정보: 내 트레이너 + 주간 이동 */}
      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">내 트레이너</span>
          <span className="px-2 py-1 rounded bg-[rgba(59,130,246,0.2)] text-blue-300">
            {trainerName || (trainerId ? trainerId : '지정되지 않음')}
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

      {/* 주간 그리드 */}
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
            allowSelectingExisting={false}
            showStatusColors={{ available: true, pending: true, booked: true }}
          />
        ) : (
          <div className="p-6 text-[var(--text-secondary)]">
            아직 연결된 트레이너가 없습니다. 관리자에게 문의해 주세요.
          </div>
        )}
      </div>

      {/* 하단 액션 */}
      <div className="flex justify-end">
        <Button
          onClick={requestReservation}
          disabled={!selectedSessionId}
          className={!selectedSessionId ? 'opacity-50 cursor-not-allowed' : ''}
        >
          {selectedSessionId ? '예약 요청 보내기' : '시간을 선택하세요'}
        </Button>
      </div>

      {/* 내 예약 현황 (간단 리스트) */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold mt-6">내 예약 현황</h2>
        {myReservations.length === 0 ? (
          <Card className="p-3 text-[var(--text-secondary)]">아직 예약 요청이 없습니다.</Card>
        ) : (
          myReservations.slice(0, 10).map((r, idx) => {
            const s = sessions.find(ss => ss.session_id === r.session_id)
            const when = s ? `${s.date} ${hmsToHm(s.start_time)}~${hmsToHm(s.end_time)}` : `(세션 ${r.session_id})`
            return (
              <Card key={idx} className="p-3 flex items-center justify-between">
                <span className="text-white">{when}</span>
                <span className={`text-sm ${
                  r.status === 'pending' ? 'text-yellow-400'
                  : r.status === 'approved' ? 'text-green-400'
                  : 'text-gray-400'
                }`}>
                  {r.status === 'pending' ? '승인 대기'
                    : r.status === 'approved' ? '승인됨'
                    : '거절됨'}
                </span>
              </Card>
            )
          })
        )}
      </section>
    </div>
  )
}
