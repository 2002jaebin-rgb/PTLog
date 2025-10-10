import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import AddSessionModal from '../components/AddSessionModal'
import Button from '../components/ui/Button'

const getMonday = (d = new Date()) => {
  const date = new Date(d)
  const day = date.getDay() || 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export default function TrainerAddSession() {
  const navigate = useNavigate()
  const location = useLocation()
  const [trainerId, setTrainerId] = useState(null)
  const initialMonday = useMemo(() => {
    const stateMonday = location.state?.monday
    if (stateMonday) {
      const parsed = new Date(stateMonday)
      if (!Number.isNaN(parsed.getTime())) {
        return getMonday(parsed)
      }
    }
    return getMonday()
  }, [location.state])
  const [monday, setMonday] = useState(initialMonday)

  useEffect(() => {
    setMonday(initialMonday)
  }, [initialMonday])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setTrainerId(user.id)
    }
    init()
  }, [])

  const handleBack = () => {
    navigate('/trainer-schedule')
  }

  if (!trainerId) {
    return <div className="p-6">불러오는 중…</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">수업 시간 추가</h1>
        <Button onClick={handleBack}>← 스케줄로 돌아가기</Button>
      </div>

      <AddSessionModal
        trainerId={trainerId}
        monday={monday}
        onClose={handleBack}
        onSaved={handleBack}
        layout="page"
      />
    </div>
  )
}
