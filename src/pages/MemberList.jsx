import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/supabaseClient'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const MIN_PASSWORD_LENGTH = 6

const INITIAL_FORM = {
  name: '',
  email: '',
  sessions_total: '',
  password: ''
}

export default function MemberList() {
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth?.user) {
        setMembers([])
        throw new Error('로그인 정보를 확인할 수 없습니다.')
      }

      const { data, error: membersError } = await supabase
        .from('members')
        .select('id, name, email, sessions_total, sessions_used')
        .eq('trainer_id', auth.user.id)
        .order('created_at', { ascending: true })

      if (membersError) throw membersError
      setMembers(data ?? [])
    } catch (err) {
      console.error('[MemberList] fetch error:', err)
      setMembers([])
      setError(err.message || '회원 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      await fetchMembers()
      if (!active) return
    })()
    return () => {
      active = false
    }
  }, [fetchMembers])

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const resetForm = () => {
    setForm(INITIAL_FORM)
  }

  const handleCloseForm = () => {
    resetForm()
    setShowForm(false)
  }

  const handleAddMember = async (event) => {
    event.preventDefault()
    if (submitting) return

    const trimmedName = form.name.trim()
    const trimmedEmail = form.email.trim()
    const trimmedPassword = form.password.trim()
    const totalSessions = Number(form.sessions_total)

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      alert('이름, 이메일, 비밀번호를 모두 입력해 주세요.')
      return
    }

    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      alert(`비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 입력해 주세요.`)
      return
    }

    if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
      alert('총 PT 회차를 1 이상으로 입력해 주세요.')
      return
    }

    setSubmitting(true)

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth?.user) {
        throw authError || new Error('로그인 정보를 확인할 수 없습니다.')
      }

      const { data, error } = await supabase.functions.invoke('add-member', {
        body: {
          trainer_id: auth.user.id,
          name: trimmedName,
          email: trimmedEmail,
          sessions_total: totalSessions,
          password: trimmedPassword
        }
      })

      if (error) throw new Error(error.message || '회원 등록에 실패했습니다.')
      if (data?.error) throw new Error(data.error)

      alert(`회원 "${trimmedName}" 등록 완료!\n${trimmedEmail} / ${trimmedPassword}`)
      handleCloseForm()
      await fetchMembers()
    } catch (err) {
      console.error('[MemberList] add-member error:', err)
      alert('회원 추가 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setSubmitting(false)
    }
  }

  const memberRows = useMemo(() => {
    return members.map((member) => {
      const remainingSessions = Math.max(
        (member.sessions_total || 0) - (member.sessions_used || 0),
        0
      )

      return (
        <Card
          key={member.id}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-white">{member.name}</p>
            <p className="text-sm text-[var(--text-secondary)]">{member.email}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] sm:text-right">
            <span>남은 PT 횟수: <strong className="text-white">{remainingSessions}</strong>회</span>
            <Link
              to={`/member/${member.id}`}
              className="text-[var(--accent-blue)] hover:underline"
            >
              상세보기
            </Link>
          </div>
        </Card>
      )
    })
  }, [members])

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">회원 목록</h1>
        <Button onClick={() => setShowForm(true)} className="sm:w-auto">
          + 회원 추가
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">새 회원 등록</h2>
          <form onSubmit={handleAddMember} className="space-y-2">
            <Input
              label="이름"
              value={form.name}
              onChange={handleFieldChange('name')}
              placeholder="회원 이름"
              required
            />
            <Input
              type="email"
              label="이메일"
              value={form.email}
              onChange={handleFieldChange('email')}
              placeholder="member@email.com"
              required
            />
            <Input
              type="password"
              label="비밀번호"
              value={form.password}
              onChange={handleFieldChange('password')}
              placeholder="회원 로그인용 비밀번호 (최소 6자)"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <Input
              type="number"
              min={1}
              label="총 PT 회차"
              value={form.sessions_total}
              onChange={handleFieldChange('sessions_total')}
              placeholder="예: 10"
              required
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={submitting} className="sm:w-32">
                {submitting ? '등록 중…' : '등록하기'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseForm}
                className="sm:w-32"
              >
                취소
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Card className="text-center text-[var(--text-secondary)]">회원 정보를 불러오는 중…</Card>
      ) : error ? (
        <Card className="text-center text-red-400">
          회원 정보를 불러오지 못했습니다.<br />
          <span className="text-[var(--text-secondary)]">{error}</span>
        </Card>
      ) : members.length === 0 ? (
        <Card className="text-center text-[var(--text-secondary)]">
          아직 등록된 회원이 없습니다. 신규 회원을 추가해 보세요.
        </Card>
      ) : (
        <div className="space-y-3">
          {memberRows}
        </div>
      )}
    </div>
  )
}
