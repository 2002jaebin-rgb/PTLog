import React, { useState } from 'react'

// 시간 문자열 → 분
const timeToMinutes = (t) => {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// 분 → HH:MM
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
  const [firstClick, setFirstClick] = useState(null) // 시작점
  const [secondClick, setSecondClick] = useState(null) // 끝점
  const pendingSet = new Set(reservations.map((r) => r.session_id))

  // ✅ 범위 자동 선택
  const selectRange = (day, startTime, endTime) => {
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const [min, max] = [Math.min(startMin, endMin), Math.max(startMin, endMin)]
    for (let t = min; t <= max; t += 30) {
      onToggleSlot(day, toTimeString(t))
    }
  }

  // ✅ 클릭 처리
  const handleClick = (day, time) => {
    if (!selectable) return

    if (!firstClick) {
      // 첫 클릭 → 시작점 저장
      setFirstClick({ day, time })
      setSecondClick(null)
    } else if (firstClick && !secondClick) {
      // 두 번째 클릭 → 범위 지정 후 초기화
      if (firstClick.day === day) {
        selectRange(day, firstClick.time, time)
      }
      setFirstClick(null)
      setSecondClick(null)
    }
  }

  // ✅ 셀 색상 계산 + 시각 피드백
  const getCellClass = (dayKey, time) => {
    const dateKey = days.find((d) => d.key === dayKey)?.date
    if (!dateKey) return 'bg-[rgba(255,255,255,0.04)]'

    const cellStart = timeToMinutes(time)
    const cellEnd = cellStart + 30
    const session = sessions.find((s) => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes(s.start_time)
      const sEnd = timeToMinutes(s.end_time)
      return sStart < cellEnd && sEnd > cellStart
    })

    const key = `${dayKey}-${time}`
    let baseColor = 'bg-[rgba(255,255,255,0.07)]' // 비활성 영역 기본색 (약한 대비)

    if (selectedSlots[key]) baseColor = 'bg-blue-400'
    else if (session) {
      if (showStatusColors.pending && pendingSet.has(session.session_id))
        baseColor = 'bg-yellow-400 animate-pulse'
      else if (session.status === 'booked' && showStatusColors.booked)
        baseColor = 'bg-green-500'
      else if (session.status === 'available' && showStatusColors.available)
        baseColor = 'bg-blue-500 hover:bg-blue-400'
    }

    // ✅ 시작점 / 끝점 강조 (격자 유지 + 두꺼운 테두리)
    if (firstClick && firstClick.day === dayKey && firstClick.time === time) {
      return `${baseColor} border-2 border-[#3b82f6] ring-2 ring-[#60a5fa] z-10`
    }
    if (secondClick && secondClick.day === dayKey && secondClick.time === time) {
      return `${baseColor} border-2 border-[#22c55e] ring-2 ring-[#4ade80] z-10`
    }

    return `${baseColor}`
  }

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <div className="overflow-x-auto select-none">
      <table className="min-w-full border border-gray-600 text-sm">
        <thead>
          <tr>
            <th className="border border-gray-800 p-1 bg-gray-800 w-16">시간</th>
            {days.map((d) => (
              <th key={d.key} className="border border-gray-800 p-1 bg-gray-800">
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
                    className="border border-gray-600 text-center bg-[#0f172a] w-16"
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
                        data-day={d.key}
                        data-time={hourLabel}
                        className={`border border-gray-600 h-6 relative transition-all duration-150 ${
                          selectable ? 'cursor-pointer' : ''
                        } ${color} hover:brightness-125`}
                        onClick={() => handleClick(d.key, hourLabel)}
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
                        data-day={d.key}
                        data-time={halfLabel}
                        className={`border border-gray-600 h-6 relative transition-all duration-150 ${
                          selectable ? 'cursor-pointer' : ''
                        } ${color} hover:brightness-125`}
                        onClick={() => handleClick(d.key, halfLabel)}
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
