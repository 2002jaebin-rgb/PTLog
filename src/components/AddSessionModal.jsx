import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ScheduleGrid from './ScheduleGrid'
import Button from './ui/Button'
import Card from './ui/Card'

export default function AddSessionModal({ trainerId, monday, onClose, onSaved }) {
  const [sessionLength, setSessionLength] = useState(1) // 0.5, 1, 1.5, 2
  const [selectedSlots, setSelectedSlots] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingSessions, setExistingSessions] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])

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
  // 로컬 YYYY-MM-DD
  const ymdLocal = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // ===== 데이터 불러오기 =====
  useEffect(() => {
    if (!trainerId) return
    const fetchAll = async () => {
      const { data: sess, error: e1 } = await supabase
        .from('sessions')
        .select('session_id, trainer_id, date, start_time, end_time, status, session_length')
        .eq('trainer_id', trainerId)

      if (!e1 && sess) setExistingSessions(sess)

      // pending 표시를 위해 reservations도 선택(옵션)
      const sessionIds = (sess || []).map(s => s.session_id)
      if (sessionIds.length) {
        const { data: resv, error: e2 } = await supabase
          .from('reservations')
          .select('session_id, status')
          .in('session_id', sessionIds)
          .eq('status', 'pending')
        if (!e2 && resv) setPendingReservations(resv)
      }
    }
    fetchAll()
  }, [trainerId])

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayIndex = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }
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

  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`
    setSelectedSlots((prev) => {
      const copy = { ...prev }
      if (copy[key]) delete copy[key]
      else copy[key] = true
      return copy
    })
  }

  // === 선택 범위를 날짜별 연속구간으로 정리 (겹침 검사/세션 생성 양쪽에서 사용) ===
  const buildSelectedRangesByDate = () => {
    const groupedByDay = {}
    Object.keys(selectedSlots).forEach((key) => {
      const [day, time] = key.split('-')
      if (!groupedByDay[day]) groupedByDay[day] = []
      groupedByDay[day].push(time)
    })

    const rangesByDate = {}
    Object.entries(groupedByDay).forEach(([day, times]) => {
      const sortedMins = times.map(toMinutes).sort((a, b) => a - b)
      if (sortedMins.length === 0) return
      let start = sortedMins[0]
      for (let i = 1; i <= sortedMins.length; i++) {
        const curr = sortedMins[i]
        const prev = sortedMins[i - 1]
        if (curr !== prev + 30 || i === sortedMins.length) {
          const end = prev + 30
          const date = new Date(monday)
          date.setDate(monday.getDate() + dayIndex[day])
          const dateStr = ymdLocal(date)
          if (!rangesByDate[dateStr]) rangesByDate[dateStr] = []
          rangesByDate[dateStr].push([start, end])
          start = curr
        }
      }
    })
    return rangesByDate
  }

  // === 저장(겹침 확인 → confirm → 삭제 후 삽입) ===
  const saveSessions = async () => {
    if (!trainerId) return alert('트레이너 정보가 없습니다.')
    if (Object.keys(selectedSlots).length === 0) return alert('시간대를 선택해주세요.')

    setLoading(true)

    const rangesByDate = buildSelectedRangesByDate()

    // 1) 선택 범위와 겹치는 기존 세션 탐지
    const overlaps = []
    const bookedOverlaps = []
    existingSessions.forEach((s) => {
      const ranges = rangesByDate[s.date]
      if (!ranges) return
      const sStart = toMinutes((s.start_time || '').slice(0, 5))
      const sEnd = toMinutes((s.end_time || '').slice(0, 5))
      const isOverlap = ranges.some(([rStart, rEnd]) => rStart < sEnd && rEnd > sStart)
      if (isOverlap) {
        if (s.status === 'booked') bookedOverlaps.push(s)
        else overlaps.push(s)
      }
    })

    // 2) 안내/확인: booked는 유지, non-booked는 삭제 옵션
    if (bookedOverlaps.length > 0) {
      // 안내만 (해당 구간은 새 세션 생성에서 자동 제외)
      console.warn(`확정(booked) 세션 ${bookedOverlaps.length}개와 겹쳐 생성에서 제외됩니다.`)
    }

    if (overlaps.length > 0) {
      const ok = window.confirm(
        `기존 세션 ${overlaps.length}개가 선택 범위와 겹칩니다.\n` +
        `덮어쓰기를 진행하면 겹치는 기존 세션(확정 제외)은 삭제됩니다.\n\n` +
        `진행할까요?`
      )
      if (!ok) {
        setLoading(false)
        return
      }

      // 2-1) non-booked 겹침 세션 삭제
      const idsToDelete = overlaps.map((s) => s.session_id)
      if (idsToDelete.length) {
        const { error: delErr } = await supabase
          .from('sessions')
          .delete()
          .in('session_id', idsToDelete)
        if (delErr) {
          setLoading(false)
          alert('기존 세션 삭제 중 오류: ' + delErr.message)
          return
        }
        // 로컬 상태에서도 제거
        setExistingSessions((prev) => prev.filter((s) => !idsToDelete.includes(s.session_id)))
      }
    }

    // 3) (삭제 후 최신 existingKeys 재계산)
    const existingKeys = new Set(
      (Array.isArray(existingSessions) ? existingSessions : []).map(
        (s) => `${s.date}_${s.start_time}_${s.end_time}`
      )
    )
    const bookedByDate = existingSessions
      .filter((s) => s.status === 'booked')
      .reduce((acc, s) => {
        if (!acc[s.date]) acc[s.date] = []
        acc[s.date].push([toMinutes(s.start_time.slice(0, 5)), toMinutes(s.end_time.slice(0, 5))])
        return acc
      }, {})

    // 4) 선택 범위를 session_length 단위로 쪼개어 삽입할 후보 생성
    const sessionsToInsert = []
    Object.entries(rangesByDate).forEach(([dateStr, ranges]) => {
      ranges.forEach(([blockStart, blockEnd]) => {
        const total = blockEnd - blockStart
        const num = Math.floor(total / (sessionLength * 60))
        for (let j = 0; j < num; j++) {
          const sStart = blockStart + j * sessionLength * 60
          const sEnd = sStart + sessionLength * 60

          // 4-1) booked와 겹치면 스킵
          const hasBookedOverlap = (bookedByDate[dateStr] || []).some(
            ([bStart, bEnd]) => sStart < bEnd && sEnd > bStart
          )
          if (hasBookedOverlap) continue

          const startHms = toHms(sStart)
          const endHms = toHms(sEnd)
          const key = `${dateStr}_${startHms}_${endHms}`
          if (!existingKeys.has(key)) {
            sessionsToInsert.push({
              trainer_id: trainerId,
              date: dateStr,
              start_time: startHms,
              end_time: endHms,
              session_length: sessionLength,
              status: 'available',
            })
          }
        }
      })
    })

    if (sessionsToInsert.length === 0) {
      setLoading(false)
      alert('추가할 새로운 세션이 없습니다. (확정 세션과 겹치거나 이미 존재)')
      return
    }

    // 5) insert
    const { error: insErr } = await supabase.from('sessions').insert(sessionsToInsert)
    setLoading(false)

    if (insErr) {
      alert('저장 실패: ' + insErr.message)
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

        {/* 시간표: 기존/확정/대기 모두 표시, 기존 위도 선택 가능 */}
        <div className="border border-gray-700 rounded-md overflow-hidden">
          <ScheduleGrid
            days={days}
            sessions={existingSessions}         // 기존 + 확정 세션 표시
            reservations={pendingReservations}  // pending도 노랑으로
            selectedSlots={selectedSlots}       // 새 선택은 시안
            selectable={true}
            onToggleSlot={toggleSlot}
            startHour={startHour}
            endHour={endHour}
            showStatusColors={{ available: true, pending: true, booked: true }}
            allowSelectingExisting={true}       // ← 기존 위도 선택 허용 (겹침 감지용)
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
