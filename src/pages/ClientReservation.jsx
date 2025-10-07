import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'

// 유틸: 로컬 기준 월요일 시작 날짜
const getMonday = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay() || 7 // Sun=0 → 7
  if (day !== 1) d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

// "HH:MM:SS" → "HH:MM"
const hmsToHm = (s) => (s || '').slice(0, 5)

// "HH:MM" → 분
const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// "YYYY-MM-DD" (로컬)
const ymdLocal = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ClientReservation() {
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState(null)

  const [trainers, setTrainers] = useState([])
  const [selectedTrainerId, setSelectedTrainerId] = useState(null)

  const [monday, setMonday] = useState(getMonday())
  const [sessions, setSessions] = useState([])                  // 선택된 트레이너의 주간 sessions (모든 status)
  const [pendingReservations, setPendingReservations] = useState([]) // 이 트레이너 세션들의 pending 목록 (누구의 것이든)
  const [myReservations, setMyReservations] = useState([])      // 내가 만든 예약들

  // 그리드 선택 상태 (한 칸만 선택)
  const [selectedSlots, setSelectedSlots] = useState({})

  // 주간 day 메타
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
  // 초기화: auth → member → trainers
  useEffect(() => {
    const init = async () => {
      setLoading(true)

      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) {
        console.error('auth.getUser 실패', userErr)
        setLoading(false)
        return
      }
      const { data: memberRow } = await supabase
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (!memberRow) {
        alert('회원 정보가 없습니다.')
        setLoading(false)
        return
      }
      setMemberId(memberRow.id)

      const { data: trainerRows } = await supabase
        .from('trainers')
        .select('id, name')
        .order('created_at', { ascending: true })

      setTrainers(trainerRows || [])
      if (trainerRows?.length) setSelectedTrainerId(trainerRows[0].id)

      setLoading(false)
    }
    init()
  }, [])
  // ─────────────────────────────────────────────────────────────

  // 선택된 트레이너/주가 바뀌면 주간 세션 & pending & 내 예약 불러오기
  useEffect(() => {
    const fetchWeekData = async () => {
      if (!selectedTrainerId) return
      setLoading(true)

      const start = days[0].date
      const end = days[6].date

      // 1) 트레이너의 해당 주간 세션 전부 (available/pending/booked)
      const { data: sessRows } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', selectedTrainerId)
        .gte('date', start)
        .lte('date', end)

      setSessions(sessRows || [])

      // 2) 해당 세션 내 pending 예약 (누가 올린 것이든 표시용)
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

      // 3) 내가 만든 예약들 (상태 표시용)
      const { data: myRes } = await supabase
        .from('reservations')
        .select('reservation_id, session_id, status')
        .eq('member_id', memberId)
        .order('reservation_time', { ascending: false })

      setMyReservations(myRes || [])

      // 선택 초기화
      setSelectedSlots({})
      setLoading(false)
    }
    if (days.length === 7) fetchWeekData()
  }, [selectedTrainerId, monday, days, memberId])

  // 셀 클릭 → 한 칸만 선택되도록 토글
  const onToggleSlot = (dayKey, hhmm) => {
    // 어떤 세션이랑 매칭되는지 확인 (available인 경우만 선택 허용)
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

    if (!found) {
      // 빈 칸은 선택 무효
      return
    }
    if (found.status !== 'available') {
      // booked/pending 세션은 선택 불가
      return
    }

    // 다른 사람이 이미 pending 넣어둔 세션은 차단
    const someonePending = pendingReservations.some(r => r.session_id === found.session_id)
    if (someonePending) {
      alert('다른 회원의 예약 대기 중인 시간입니다.')
      return
    }

    // 한 칸만 선택되게
    const key = `${dayKey}-${hhmm}`
    setSelectedSlots(prev => {
      if (prev[key]) return {} // 다시 누르면 해제
      return { [key]: true }
    })
  }

  // 현재 선택된 칸 → session_id 추출
  const selectedSessionId = useMemo(() => {
    const key = Object.keys(selectedSlots)[0]
    if (!key) return null
    const [dayKey, hhmm] = key.split('-')
    const dateKey = days.find(d => d.key === dayKey)?.date
    if (!dateKey) return null
    const cellStart = timeToMinutes(hhmm)
    const cellEnd = cellStart + 30
    const found = sessions.find(s => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes(hmsToHm(s.start_time))
      const sEnd   = timeToMinutes(hmsToHm(s.end_time))
      return sStart < cellEnd && sEnd > cellStart && s.status === 'available'
    })
    return found?.session_id ?? null
  }, [selectedSlots, days, sessions])

  const requestReservation = async () => {
    if (!memberId || !selectedSessionId) return
    // 내 중복 요청 방지
    const myDup = myReservations.find(r => r.session_id === selectedSessionId && r.status === 'pending')
    if (myDup) {
      alert('이미 대기 중인 예약이 있습니다.')
      return
    }
    // 타회원 pending 차단 (이중)
    const someonePending = pendingReservations.some(r => r.session_id === selectedSessionId)
    if (someonePending) {
      alert('다른 회원의 예약 대기 중인 시간입니다.')
      return
    }
    // 서버 insert
    const { error } = await supabase.from('reservations').insert([
      { session_id: selectedSessionId, member_id: memberId, status: 'pending' }
    ])
    if (error) return alert('예약 실패: ' + error.message)
    // 로컬 업데이트
    setMyReservations(prev => [{ session_id: selectedSessionId, status: 'pending' }, ...prev])
    setPendingReservations(prev => [{ session_id: selectedSessionId, status: 'pending' }, ...prev])
    alert('예약 요청이 전송되었습니다!')
    setSelectedSlots({})
  }

  const startHour = 6
  const endHour = 23

  // UI
  if (loading && !memberId) return <div className="p-6">불러오는 중...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">세션 예약</h1>

      {/* 트레이너 선택 + 주간 이동 */}
      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)]">트레이너</label>
          <select
            className="text-black rounded px-2 py-1"
            value={selectedTrainerId || ''}
            onChange={(e) => setSelectedTrainerId(e.target.value)}
          >
            {trainers.map(t => (
              <option key={t.id} value={t.id}>{t.name || t.id}</option>
            ))}
          </select>
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
        <ScheduleGrid
          days={days}
          sessions={sessions}
          reservations={pendingReservations}     // 노란색으로 pending 표시
          selectedSlots={selectedSlots}
          selectable={true}
          onToggleSlot={onToggleSlot}
          startHour={startHour}
          endHour={endHour}
          // 클라이언트 화면에서는 기존 세션 위 선택 불가 (헷갈림 방지)
          allowSelectingExisting={false}
          showStatusColors={{ available: true, pending: true, booked: true }}
        />
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

      {/* 내 예약 상태 리스트 (참고용) */}
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
