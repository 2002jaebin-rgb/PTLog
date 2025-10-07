import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabaseClient'
import ScheduleGrid from './ScheduleGrid'
import Button from './ui/Button'
import Card from './ui/Card'

export default function AddSessionModal({ trainerId, monday, onClose, onSaved }) {
  const [sessionLength, setSessionLength] = useState(1) // 시간 단위(0.5,1,1.5,2)
  const [selectedSlots, setSelectedSlots] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingSessions, setExistingSessions] = useState([])

  // ===== 유틸 =====
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const toHm = (m) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
  }
  const toHms = (m) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`
  }
  // 로컬 기준 YYYY-MM-DD
  const ymdLocal = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // ===== 기존 세션 불러오기 =====
  useEffect(() => {
    if (!trainerId) return
    const fetchSessions = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', trainerId)
      if (!error && data) setExistingSessions(data)
    }
    fetchSessions()
  }, [trainerId])

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`,
      key: dayNames[d.getDay()],
      date: ymdLocal(d),
    }
  })

  const startHour = 6
  const endHour = 23
  const dayIndex = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }

  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`
    setSelectedSlots((prev) => {
      const copy = { ...prev }
      if (copy[key]) delete copy[key]
      else copy[key] = true
      return copy
    })
  }

  // ===== 저장(중복 방지) =====
  const saveSessions = async () => {
    if (!trainerId) return alert('트레이너 정보가 없습니다.')
    if (Object.keys(selectedSlots).length === 0) return alert('시간대를 선택해주세요.')

    setLoading(true)

    // 기존 세션 키(YYYY-MM-DD_HH:MM:SS_HH:MM:SS) set
    const existingKeys = new Set(
      existingSessions.map(
        (s) => `${s.date}_${s.start_time}_${s.end_time}`
      )
    )

    // day별로 선택된 슬롯 묶기
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

          // 해당 요일의 날짜(로컬 YYYY-MM-DD)
          const date = new Date(monday)
          date.setDate(monday.getDate() + dayIndex[day])
          const dateStr = ymdLocal(date)

          for (let j = 0; j < numSessions; j++) {
            const sStart = start + j * sessionLength * 60   // 분
            const sEnd = sStart + sessionLength * 60        // 분

            // 중복 비교/저장 모두 HH:MM:SS 로 통일
            const startHms = toHms(sStart)
            const endHms = toHms(sEnd)
            const newKey = `${dateStr}_${startHms}_${endHms}`

            if (!existingKeys.has(newKey)) {
              sessionsToInsert.push({
                trainer_id: trainerId,
                date: dateStr,
                start_time: startHms,     // time 타입과 일치
                end_time: endHms,         // time 타입과 일치
                session_length: sessionLength,
                status: 'available',
              })
            }
          }

          start = curr
        }
      }
    })

    if (sessionsToInsert.length === 0) {
      setLoading(false)
      alert('이미 등록된 시간대입니다.')
      return
    }

    const { error } = await supabase.from('sessions').insert(sessionsToInsert)
    setLoading(false)

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      alert('수업 시간 등록 완료!')
      setSelectedSlots({})
      onSaved?.()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-6 z-50">
      <Card className="bg-[var(--bg-dark)] text-white w-[900px] max-w-[95%] max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
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

        {/* 시간표 (모달 안에서도 기존 세션 표시) */}
        <div className="border border-gray-700 rounded-md overflow-hidden">
          <ScheduleGrid
            days={days}
            sessions={existingSessions}    // ✅ 기존 DB 세션을 함께 그려서 중복 입력 방지
            reservations={[]}              // 모달에선 예약 표시 불필요
            selectedSlots={selectedSlots}  // 새 선택은 시안색으로 표시
            selectable={true}
            onToggleSlot={toggleSlot}
            startHour={startHour}
            endHour={endHour}
            showStatusColors={{
              available: true,
              pending: false,
              booked: false,
            }}
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
