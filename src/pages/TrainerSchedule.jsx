import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function TrainerSchedule() {
  const [sessionLength, setSessionLength] = useState(1)
  const [selectedSlots, setSelectedSlots] = useState({})
  const [existingSessions, setExistingSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [trainerId, setTrainerId] = useState(null)

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

  const fetchSessions = async (id) => {
    const startDate = monday.toISOString().split('T')[0]
    const endDate = new Date(monday)
    endDate.setDate(monday.getDate() + 6)
    const endStr = endDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('sessions')
      .select('date, start_time, status')
      .eq('trainer_id', id)
      .gte('date', startDate)
      .lte('date', endStr)

    if (error) {
      console.error('세션 불러오기 실패:', error)
      return
    }
    setExistingSessions(data || [])
  }

  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`
    setSelectedSlots((prev) => {
      const copy = { ...prev }
      if (copy[key]) delete copy[key]
      else copy[key] = true
      return copy
    })
  }

  const saveSessions = async () => {
    if (!trainerId) return alert('트레이너 정보가 없습니다.')
    if (Object.keys(selectedSlots).length === 0)
      return alert('시간대를 선택해주세요.')

    setLoading(true)

    const dayIndex = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }

    const sessionsToInsert = Object.keys(selectedSlots).map((key) => {
      const [day, time] = key.split('-')
      const date = new Date(monday)
      date.setDate(monday.getDate() + dayIndex[day])

      const [h, m] = time.split(':').map(Number)
      const start = new Date(date)
      start.setHours(h, m, 0, 0)

      const end = new Date(start.getTime() + sessionLength * 60 * 60 * 1000)
      const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`

      return {
        trainer_id: trainerId,
        date: date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
        session_length: sessionLength,
        status: 'available',
      }
    })

    const { error } = await supabase.from('sessions').insert(sessionsToInsert)
    setLoading(false)
    if (error) alert('저장 실패: ' + error.message)
    else {
      alert('수업 시간 등록 완료!')
      await fetchSessions(trainerId) // 새로고침 없이 바로 반영
    }
  }

  const getCellColor = (dayKey, time) => {
    const session = existingSessions.find(
      (s) => {
        const dateKey = days.find((d) => d.key === dayKey)?.date
        return s.date === dateKey && s.start_time === time
      }
    )
    if (!session) return 'bg-gray-800' // 비어있음

    switch (session.status) {
      case 'available':
        return 'bg-blue-500'
      case 'pending':
        return 'bg-yellow-400'
      case 'booked':
        return 'bg-green-500'
      default:
        return 'bg-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">주간 스케줄 등록</h1>

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

        {/* 주간 시간표 */}
        <div className="overflow-x-auto">
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
              {Array.from({ length: (endHour - startHour) }).map((_, i) => {
                const hour = startHour + i
                const hourLabel = `${String(hour).padStart(2, '0')}:00`
                const nextHalf = `${String(hour).padStart(2, '0')}:30`
                return (
                  <React.Fragment key={hour}>
                    {/* 첫 번째 30분 */}
                    <tr>
                      <td
                        className="border border-gray-700 text-center bg-gray-900 w-16"
                        rowSpan={2}
                      >
                        {hourLabel}
                      </td>
                      {days.map((d) => {
                        const key = `${d.key}-${hourLabel}`
                        const isSelected = selectedSlots[key]
                        const color = isSelected ? 'bg-blue-400' : getCellColor(d.key, hourLabel)
                        return (
                          <td
                            key={key}
                            className={`border border-gray-700 cursor-pointer h-6 ${color}`}
                            onClick={() => toggleSlot(d.key, hourLabel)}
                          />
                        )
                      })}
                    </tr>
                    {/* 두 번째 30분 */}
                    <tr>
                      {days.map((d) => {
                        const key = `${d.key}-${nextHalf}`
                        const isSelected = selectedSlots[key]
                        const color = isSelected ? 'bg-blue-400' : getCellColor(d.key, nextHalf)
                        return (
                          <td
                            key={key}
                            className={`border border-gray-700 cursor-pointer h-6 ${color}`}
                            onClick={() => toggleSlot(d.key, nextHalf)}
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
      </Card>
    </div>
  )
}
