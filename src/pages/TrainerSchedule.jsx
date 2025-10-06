import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScheduleGrid from '../components/ScheduleGrid'
import AddSessionModal from '../components/AddSessionModal'

export default function TrainerSchedule() {
  const [sessionLength, setSessionLength] = useState(1)
  const [selectedSlots, setSelectedSlots] = useState({})
  const [existingSessions, setExistingSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [loading, setLoading] = useState(false)
  const [trainerId, setTrainerId] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // --- 이번 주 월요일 계산 ---
  const getMonday = (d = new Date()) => {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(date.setDate(diff))
  }
  const monday = getMonday()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`,
      key: dayNames[d.getDay()],
      date: d.toISOString().split('T')[0],
    }
  })

  const startHour = 6
  const endHour = 23

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setTrainerId(user.id)
      await fetchSessions(user.id)
    }
    init()
  }, [])

  // --- 세션 / 예약 불러오기 ---
  const fetchSessions = async (id) => {
    const startDate = monday.toISOString().split('T')[0]
    const endDate = new Date(monday)
    endDate.setDate(monday.getDate() + 6)
    const endStr = endDate.toISOString().split('T')[0]

    const { data: sessions, error: sErr } = await supabase
      .from('sessions')
      .select('session_id, date, start_time, end_time, status')
      .eq('trainer_id', id)
      .gte('date', startDate)
      .lte('date', endStr)

    if (sErr) {
      console.error('세션 불러오기 실패:', sErr)
      return
    }

    const sessionIds = (sessions || []).map(s => s.session_id)
    const { data: reservations, error: rErr } = await supabase
      .from('reservations')
      .select('session_id, status')
      .in('session_id', sessionIds)
      .eq('status', 'pending')

    if (rErr) console.error('예약 불러오기 실패:', rErr)

    setExistingSessions(sessions || [])
    setPendingReservations(reservations || [])

    console.log('--- sessions ---'); console.table(sessions)
    console.log('--- reservations ---'); console.table(reservations)
  }

  // --- 셀 클릭 시 선택/해제 ---
  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`
    setSelectedSlots(prev => {
      const copy = { ...prev }
      if (copy[key]) delete copy[key]
      else copy[key] = true
      return copy
    })
  }

  // --- 시간 문자열 ↔ 분 단위 변환 ---
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const toTimeString = (m) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  // --- 세션 저장 로직 ---
  const saveSessions = async () => {
    if (!trainerId) return alert('트레이너 정보가 없습니다.')
    if (Object.keys(selectedSlots).length === 0)
      return alert('시간대를 선택해주세요.')

    setLoading(true)

    // 1️⃣ 선택된 슬롯을 요일별로 그룹화
    const groupedByDay = {}
    Object.keys(selectedSlots).forEach((key) => {
      const [day, time] = key.split('-')
      if (!groupedByDay[day]) groupedByDay[day] = []
      groupedByDay[day].push(time)
    })

    const dayIndex = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }
    const sessionsToInsert = []

    // 2️⃣ 각 요일별로 연속된 구간 묶고, session_length 단위로 분할
    Object.entries(groupedByDay).forEach(([day, times]) => {
      const sorted = times.map(toMinutes).sort((a, b) => a - b)
      let start = sorted[0]

      for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i]
        const prev = sorted[i - 1]

        // 연속 구간 종료 시점
        if (curr !== prev + 30 || i === sorted.length) {
          const end = prev + 30
          const totalRange = end - start
          const numSessions = Math.floor(totalRange / (sessionLength * 60))

          const date = new Date(monday)
          date.setDate(monday.getDate() + dayIndex[day])

          for (let j = 0; j < numSessions; j++) {
            const sStart = start + j * sessionLength * 60
            const sEnd = sStart + sessionLength * 60
            sessionsToInsert.push({
              trainer_id: trainerId,
              date: date.toISOString().split('T')[0],
              start_time: toTimeString(sStart),
              end_time: toTimeString(sEnd),
              session_length: sessionLength,
              status: 'available',
            })
          }
          start = curr
        }
      }
    })

    console.log('🧩 생성 예정 세션:', sessionsToInsert)

    const { error } = await supabase.from('sessions').insert(sessionsToInsert)
    setLoading(false)
    if (error) alert('저장 실패: ' + error.message)
    else {
      alert('수업 시간 등록 완료!')
      setSelectedSlots({})
      await fetchSessions(trainerId)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">주간 스케줄 등록</h1>

      <div className="flex justify-end mb-2">
        <Button onClick={() => setShowModal(true)}>+ 수업 시간 추가</Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <label>세션 길이:</label>
          <select
            className="text-black rounded px-2 py-1"
            value={sessionLength}
            onChange={(e) => setSessionLength(Number(e.target.value))}
          >
            <option value={0.5}>30분</option>
            <option value={1}>1시간</option>
            <option value={1.5}>1시간 30분</option>
            <option value={2}>2시간</option>
          </select>
          <Button onClick={saveSessions} disabled={loading}>
            {loading ? '저장 중...' : '수업 시간 등록'}
          </Button>
        </div>

        <ScheduleGrid
          days={days}
          sessions={existingSessions}
          reservations={pendingReservations}
          selectedSlots={selectedSlots}
          selectable={true}
          onToggleSlot={toggleSlot}
          startHour={startHour}
          endHour={endHour}
          showStatusColors={{ available: true, pending: true, booked: true }}
        />
      </Card>

      {showModal && (
        <AddSessionModal
            trainerId={trainerId}
            monday={monday}
            onClose={() => setShowModal(false)}
            onSaved={() => fetchSessions(trainerId)}
        />
    )}
  </div>
)
}
