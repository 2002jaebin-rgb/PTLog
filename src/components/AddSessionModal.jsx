import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import ScheduleGrid from './ScheduleGrid'
import Button from './ui/Button'
import Card from './ui/Card'

export default function AddSessionModal({ trainerId, monday, onClose, onSaved }) {
  const [sessionLength, setSessionLength] = useState(1)
  const [selectedSlots, setSelectedSlots] = useState({})
  const [loading, setLoading] = useState(false)

  // 시간 문자열 변환
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const toTimeString = (m) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  // 요일 / 날짜 계산 (TrainerSchedule과 동일)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`,
      key: dayNames[d.getDay()],
      date: d.toISOString().split('T')[0],
    }
  })
  const startHour = 6
  const endHour = 23
  const dayIndex = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }

  // 시간 클릭
  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`
    setSelectedSlots(prev => {
      const copy = { ...prev }
      if (copy[key]) delete copy[key]
      else copy[key] = true
      return copy
    })
  }

  // 세션 저장
  const saveSessions = async () => {
    if (!trainerId) return alert('트레이너 정보가 없습니다.')
    if (Object.keys(selectedSlots).length === 0) return alert('시간대를 선택해주세요.')
    setLoading(true)

    const groupedByDay = {}
    Object.keys(selectedSlots).forEach((key) => {
      const [day, time] = key.split('-')
      if (!groupedByDay[day]) groupedByDay[day] = []
      groupedByDay[day].push(time)
    })

    const sessionsToInsert = []

    Object.entries(groupedByDay).forEach(([day, times]) => {
      const sorted = times.map(toMinutes).sort((a, b) => a - b)
      let start = sorted[0]
      for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i]
        const prev = sorted[i - 1]
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

    const { error } = await supabase.from('sessions').insert(sessionsToInsert)
    setLoading(false)
    if (error) alert('저장 실패: ' + error.message)
    else {
      alert('수업 시간 등록 완료!')
      setSelectedSlots({})
      onSaved?.() // TrainerSchedule에서 fetchSessions 실행
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <Card className="bg-[var(--bg-dark)] text-white max-w-2xl w-full p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-4">수업 시간 추가</h2>

        {/* 세션 길이 설정 */}
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
        </div>

        {/* 시간표 */}
        <div className="border border-gray-700 rounded-md overflow-hidden">
          <ScheduleGrid
            days={days}
            sessions={[]} // 새 세션 추가니까 기존 표시 X
            reservations={[]} // 모달은 예약표시 불필요
            selectedSlots={selectedSlots}
            selectable={true}
            onToggleSlot={toggleSlot}
            startHour={startHour}
            endHour={endHour}
            showStatusColors={{ available: false, pending: false, booked: false }}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-600">
            취소
          </Button>
          <Button onClick={saveSessions} disabled={loading}>
            {loading ? '저장 중...' : '등록하기'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
