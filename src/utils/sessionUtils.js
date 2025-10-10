const parseDateParts = (dateStr) => {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  if ([year, month, day].some((part) => Number.isNaN(part))) return null
  return { year, month, day }
}

const parseTimeParts = (timeStr) => {
  if (!timeStr) return null
  const trimmed = timeStr.slice(0, 5)
  const [hour, minute] = trimmed.split(':').map(Number)
  if ([hour, minute].some((part) => Number.isNaN(part))) return null
  return { hour, minute }
}

export const toLocalDateTime = (dateStr, timeStr) => {
  const dateParts = parseDateParts(dateStr)
  if (!dateParts) return null

  const timeParts = parseTimeParts(timeStr)
  const hour = timeParts?.hour ?? 0
  const minute = timeParts?.minute ?? 0

  return new Date(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, 0, 0)
}

export const formatTimeLabel = (timeStr) => {
  const parts = parseTimeParts(timeStr)
  if (!parts) return ''
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

const toTimestamp = (value) => {
  if (!value) return Number.POSITIVE_INFINITY
  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

export const matchSessionsToRequests = (sessions = [], requests = []) => {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { consumedSessionKeys: new Set(), requestSessionMap: {} }
  }

  const normalizedSessions = sessions
    .map((session, index) => ({
      originalIndex: index,
      referenceTime: typeof session.referenceTime === 'number'
        ? session.referenceTime
        : toTimestamp(session.referenceTime),
      key: session.sessionKey
        || (session.session_id !== undefined ? String(session.session_id) : `session-${index}`),
      session,
    }))
    .sort((a, b) => a.referenceTime - b.referenceTime)

  const normalizedRequests = (Array.isArray(requests) ? requests : [])
    .filter((req) => req && req.status && req.status !== 'rejected')
    .map((req) => ({
      id: req.id,
      createdTime: toTimestamp(req.created_at),
      request: req,
    }))
    .sort((a, b) => a.createdTime - b.createdTime)

  const assignedIndices = new Set()
  const consumedSessionKeys = new Set()
  const requestSessionMap = {}

  normalizedRequests.forEach(({ id, createdTime }) => {
    const eligible = normalizedSessions.filter(
      (entry) => !assignedIndices.has(entry.originalIndex) && entry.referenceTime <= createdTime,
    )

    let chosen = null
    if (eligible.length > 0) {
      chosen = eligible[eligible.length - 1]
    } else {
      chosen = normalizedSessions.find((entry) => !assignedIndices.has(entry.originalIndex)) || null
    }

    if (chosen) {
      assignedIndices.add(chosen.originalIndex)
      consumedSessionKeys.add(chosen.key)
      requestSessionMap[id] = chosen.session
    } else {
      requestSessionMap[id] = null
    }
  })

  return { consumedSessionKeys, requestSessionMap }
}
