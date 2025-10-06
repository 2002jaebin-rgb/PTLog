import React, { useState, useEffect } from 'react'

// 시간 문자열을 분 단위로 변환
const timeToMinutes = (t) => {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// 분 단위를 "HH:MM"으로 변환
const toTimeString = (m) => {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default function ScheduleGrid({
  days,
  sessions = [],
  reservations = [],
  selectedSlots = {},
  selectable = true,
  onToggleSlot = () => {},
  startHour = 6,
  endHour = 23,
  showStatusColors = { available: true, pending: true, booked: true },
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [touchStart, setTouchStart] = useState(null)
  const pendingSet = new Set(reservations.map((r) => r.session_id))

  // ✅ 장치 감지 (PC vs Mobile)
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  // ✅ 범위 자동 선택 (공용 함수)
  const selectRange = (day, startTime, endTime) => {
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const [min, max] = [Math.min(startMin, endMin), Math.max(startMin, endMin)]

    for (let t = min; t <= max; t += 30) {
      onToggleSlot(day, toTimeString(t))
    }
  }

  // === 🖱️ PC: 드래그 방식 ===
  const handleMouseDown = (day, time) => {
    if (!selectable || isTouchDevice) return
    setIsDragging(true)
    setDragStart({ day, time })
  }

  const handleMouseUp = (day, time) => {
    if (!selectable || isTouchDevice || !dragStart) return
    selectRange(day, dragStart.time, time)
    setIsDragging(false)
    setDragStart(null)
  }

  const handleMouseEnter = (day, time) => {
    if (!selectable || isTouchDevice || !isDragging || !dragStart) return
    // 드래그 중에도 연속 적용
    selectRange(day, dragStart.time, time)
  }

  // === 📱 모바일: 두 번 탭 방식 ===
  const handleTouchStart = (day, time) => {
    if (!selectable || !isTouchDevice) return
    if (!touchStart) {
      // 첫 번째 터치 → 시작점
      setTouchStart({ day, time })
    } else {
      // 두 번째 터치 → 종료점, 자동 선택
      if (touchStart.day === day) {
        selectRange(day, touchStart.time, time)
      }
      setTouchStart(null)
    }
  }

  // ✅ 색상 계산
  const getCellClass = (dayKey, time) => {
    const dateKey = days.find((d) => d.key === dayKey)?.date
    if (!dateKey) return 'bg-gray-800'

    const cellStart = timeToMinutes(time)
    const cellEnd = cellStart + 30
    const session = sessions.find((s) => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes(s.start_time)
      const sEnd = timeToMinutes(s.end_time)
      return sStart < cellEnd && sEnd > cellStart
    })

    const key = `${dayKey}-${time}`
    if (selectedSlots[key]) return 'bg-blue-400'
    if (!session) return 'bg-gray-800'
    if (showStatusColors.pending && pendingSet.has(session.session_id))
      return 'bg-yellow-400'

    switch (session.status) {
      case 'booked':
        return showStatusColors.booked ? 'bg-green-500' : 'bg-gray-800'
      case 'available':
        return showStatusColors.available ? 'bg-blue-500' : 'bg-gray-800'
      default:
        return 'bg-gray-800'
    }
  }

  // 시간 블록 생성
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <div
      className="overflow-x-auto select-none"
      onMouseLeave={() => setIsDragging(false)}
      onMouseUp={() => setIsDragging(false)}
    >
      <table className="min-w-full border border-gray-700 text-sm">
        <thead>
          <tr>
            <th className="border border-gray-700 p-1 bg-gray-800 w-16">시간</th>
            {days.map((d) => (
              <th key={d.key} className="border border-gray-700 p-1 bg-gray-800">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => {
            const hourLabel = `${String(hour).padStart(2, '0')}:00`
            const halfLabel = `${String(hour).padStart(2, '0')}:30`
            return (
              <React.Fragment key={hour}>
                {/* 상단 30분 */}
                <tr>
                  <td
                    className="border border-gray-700 text-center bg-gray-900 w-16"
                    rowSpan={2}
                  >
                    {hourLabel}
                  </td>
                  {days.map((d) => {
                    const key = `${d.key}-${hourLabel}`
                    const color = getCellClass(d.key, hourLabel)
                    return (
                      <td
                        key={key}
                        className={`border border-gray-700 h-6 ${
                          selectable ? 'cursor-pointer' : ''
                        } ${color}`}
                        onMouseDown={() => handleMouseDown(d.key, hourLabel)}
                        onMouseUp={() => handleMouseUp(d.key, hourLabel)}
                        onMouseEnter={() => handleMouseEnter(d.key, hourLabel)}
                        onTouchStart={() => handleTouchStart(d.key, hourLabel)}
                      />
                    )
                  })}
                </tr>

                {/* 하단 30분 */}
                <tr>
                  {days.map((d) => {
                    const key = `${d.key}-${halfLabel}`
                    const color = getCellClass(d.key, halfLabel)
                    return (
                      <td
                        key={key}
                        className={`border border-gray-700 h-6 ${
                          selectable ? 'cursor-pointer' : ''
                        } ${color}`}
                        onMouseDown={() => handleMouseDown(d.key, halfLabel)}
                        onMouseUp={() => handleMouseUp(d.key, halfLabel)}
                        onMouseEnter={() => handleMouseEnter(d.key, halfLabel)}
                        onTouchStart={() => handleTouchStart(d.key, halfLabel)}
                      />
                    )
                  })}
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
