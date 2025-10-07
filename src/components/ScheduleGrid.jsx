import React, { useState } from 'react'

const timeToMinutes = (t) => {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
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
  allowSelectingExisting = false,
  // NEW: 'single' | 'range' (기본 range)
  selectionMode = 'range',
}) {
  const [firstClick, setFirstClick] = useState(null)
  const [secondClick, setSecondClick] = useState(null)
  const pendingSet = new Set(reservations.map((r) => r.session_id))

  const selectRangeSameDay = (day, startTime, endTime) => {
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)
    const [min, max] = [Math.min(startMin, endMin), Math.max(startMin, endMin)]
    for (let t = min; t <= max; t += 30) onToggleSlot(day, toTimeString(t))
  }
  const selectRangeAcrossDays = (first, second) => {
    const idx1 = days.findIndex((d) => d.key === first.day)
    const idx2 = days.findIndex((d) => d.key === second.day)
    if (idx1 === -1 || idx2 === -1) return
    const [diStart, diEnd] = [Math.min(idx1, idx2), Math.max(idx1, idx2)]
    const [minTime, maxTime] = [
      Math.min(timeToMinutes(first.time), timeToMinutes(second.time)),
      Math.max(timeToMinutes(first.time), timeToMinutes(second.time)),
    ]
    for (let di = diStart; di <= diEnd; di++) {
      const dayKey = days[di].key
      for (let t = minTime; t <= maxTime; t += 30) onToggleSlot(dayKey, toTimeString(t))
    }
  }
  const hasExisting = (dayKey, time) => {
    const dateKey = days.find((d) => d.key === dayKey)?.date
    if (!dateKey) return false
    const cellStart = timeToMinutes(time)
    const cellEnd = cellStart + 30
    return sessions.some((s) => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes((s.start_time || '').slice(0, 5))
      const sEnd = timeToMinutes((s.end_time || '').slice(0, 5))
      return sStart < cellEnd && sEnd > cellStart
    })
  }

  const handleClick = (day, time) => {
    if (!selectable) return
    if (!allowSelectingExisting && hasExisting(day, time)) return

    // NEW: 단일 클릭 모드
    if (selectionMode === 'single') {
      onToggleSlot(day, time)
      return
    }

    // 기존 범위(직사각형) 선택 모드
    if (!firstClick) {
      setFirstClick({ day, time })
      setSecondClick(null)
      return
    }
    if (firstClick && !secondClick) {
      const sameDay = firstClick.day === day
      if (sameDay) selectRangeSameDay(day, firstClick.time, time)
      else selectRangeAcrossDays(firstClick, { day, time })
      setFirstClick(null)
      setSecondClick(null)
    }
  }

  const getCellClass = (dayKey, time) => {
    const dateKey = days.find((d) => d.key === dayKey)?.date
    if (!dateKey) return 'bg-[rgba(255,255,255,0.07)]'
    const cellStart = timeToMinutes(time)
    const cellEnd = cellStart + 30
    const session = sessions.find((s) => {
      if (s.date !== dateKey) return false
      const sStart = timeToMinutes((s.start_time || '').slice(0, 5))
      const sEnd = timeToMinutes((s.end_time || '').slice(0, 5))
      return sStart < cellEnd && sEnd > cellStart
    })
    const key = `${dayKey}-${time}`
    let baseColor = 'bg-[rgba(255,255,255,0.07)]'
    if (selectedSlots[key]) baseColor = 'bg-cyan-400'
    else if (session) {
      if (showStatusColors.pending && pendingSet.has(session.session_id)) baseColor = 'bg-yellow-400 animate-pulse'
      else if (session.status === 'booked' && showStatusColors.booked) baseColor = 'bg-green-500'
      else if (session.status === 'available' && showStatusColors.available) baseColor = 'bg-blue-600 hover:bg-blue-500'
    }
    if (firstClick && firstClick.day === dayKey && firstClick.time === time)
      return `${baseColor} border-2 border-[#3b82f6] ring-2 ring-[#60a5fa] z-10`
    if (secondClick && secondClick.day === dayKey && secondClick.time === time)
      return `${baseColor} border-2 border-[#22c55e] ring-2 ring-[#4ade80] z-10`
    return `${baseColor}`
  }

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <div className="overflow-x-auto select-none">
      <table className="min-w-full border border-gray-600 text-sm">
        <thead>
          <tr>
            <th className="border border-gray-600 p-1 bg-gray-800 w-16">시간</th>
            {days.map((d) => (
              <th key={d.key} className="border border-gray-600 p-1 bg-gray-800">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => {
            const h0 = `${String(hour).padStart(2, '0')}:00`
            const h30 = `${String(hour).padStart(2, '0')}:30`
            return (
              <React.Fragment key={hour}>
                <tr>
                  <td className="border border-gray-600 text-center bg-[#0f172a] w-16" rowSpan={2}>{h0}</td>
                  {days.map((d) => (
                    <td
                      key={`${d.key}-${h0}`}
                      className={`border border-gray-600 h-6 transition-all duration-150 ${selectable ? 'cursor-pointer' : ''} ${getCellClass(d.key, h0)} hover:brightness-125`}
                      onClick={() => handleClick(d.key, h0)}
                    />
                  ))}
                </tr>
                <tr>
                  {days.map((d) => (
                    <td
                      key={`${d.key}-${h30}`}
                      className={`border border-gray-600 h-6 transition-all duration-150 ${selectable ? 'cursor-pointer' : ''} ${getCellClass(d.key, h30)} hover:brightness-125`}
                      onClick={() => handleClick(d.key, h30)}
                    />
                  ))}
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
