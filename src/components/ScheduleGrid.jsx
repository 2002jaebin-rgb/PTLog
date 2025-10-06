import React from 'react'

// "HH:MM" 또는 "HH:MM:SS" -> 분 단위
const timeToMinutes = (t) => {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleGrid({
  days,                            // [{ label, key, date }]
  sessions = [],                   // [{ session_id, date, start_time, end_time, status }]
  reservations = [],               // [{ session_id, status='pending' }, ...]
  selectedSlots = {},              // { "월-10:00": true, ... }
  selectable = true,               // 클릭 선택 가능 여부
  onToggleSlot = () => {},         // (dayKey, "HH:MM")
  startHour = 6,
  endHour = 23,
  showStatusColors = { available: true, pending: true, booked: true },
}) {
  const pendingSet = new Set(reservations.map(r => r.session_id))

  const getCellClass = (dayKey, time) => {
    const dateKey = days.find(d => d.key === dayKey)?.date
    if (!dateKey) return 'bg-gray-800'

    const cellStart = timeToMinutes(time)
    const cellEnd = cellStart + 30

    // 이 셀과 겹치는 세션 찾기
    const session = sessions.find(s => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes(s.start_time)
      const sEnd = timeToMinutes(s.end_time)
      return sStart < cellEnd && sEnd > cellStart
    })

    // 선택(임시) 표시가 최우선
    const key = `${dayKey}-${time}`
    if (selectedSlots[key]) return 'bg-blue-400'

    if (!session) return 'bg-gray-800'

    // pending(예약 대기) 표시
    if (showStatusColors.pending && pendingSet.has(session.session_id)) {
      return 'bg-yellow-400'
    }

    // 세션 상태 색상
    switch (session.status) {
      case 'booked':
        return showStatusColors.booked ? 'bg-green-500' : 'bg-gray-800'
      case 'available':
        return showStatusColors.available ? 'bg-blue-500' : 'bg-gray-800'
      default:
        return 'bg-gray-800'
    }
  }

  const hours = Array.from({ length: (endHour - startHour) }, (_, i) => startHour + i)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-700 text-sm">
        <thead>
          <tr>
            <th className="border border-gray-700 p-1 bg-gray-800 w-16">시간</th>
            {days.map(d => (
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
                {/* 상단 30분 (:00) */}
                <tr>
                  <td className="border border-gray-700 text-center bg-gray-900 w-16" rowSpan={2}>
                    {hourLabel}
                  </td>
                  {days.map(d => {
                    const key = `${d.key}-${hourLabel}`
                    const color = getCellClass(d.key, hourLabel)
                    return (
                      <td
                        key={key}
                        className={`border border-gray-700 h-6 ${selectable ? 'cursor-pointer' : ''} ${color}`}
                        onClick={selectable ? () => onToggleSlot(d.key, hourLabel) : undefined}
                      />
                    )
                  })}
                </tr>
                {/* 하단 30분 (:30) */}
                <tr>
                  {days.map(d => {
                    const key = `${d.key}-${halfLabel}`
                    const color = getCellClass(d.key, halfLabel)
                    return (
                      <td
                        key={key}
                        className={`border border-gray-700 h-6 ${selectable ? 'cursor-pointer' : ''} ${color}`}
                        onClick={selectable ? () => onToggleSlot(d.key, halfLabel) : undefined}
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
