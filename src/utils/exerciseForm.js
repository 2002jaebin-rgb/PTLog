export const createEmptySet = () => ({
  weight: '',
  reps: '',
})

export const createEmptyExercise = () => ({
  name: '',
  sets: [createEmptySet()],
})

const normalizeValue = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const sanitizeExercisesForSubmit = (exercises) => {
  if (!Array.isArray(exercises)) return []

  return exercises
    .map((exercise) => {
      if (!exercise || typeof exercise !== 'object') return null

      const name = typeof exercise.name === 'string' ? exercise.name.trim() : ''
      const rawSets = Array.isArray(exercise.sets) ? exercise.sets : []

      const sanitizedSets = rawSets
        .map((set) => {
          const weight = normalizeValue(set?.weight)
          const reps = normalizeValue(set?.reps)

          if (!weight || !reps) return null
          return { weight, reps }
        })
        .filter(Boolean)

      if (!name && !sanitizedSets.length) return null

      return {
        name,
        sets: sanitizedSets,
      }
    })
    .filter(Boolean)
}

export const ensureExerciseHasAtLeastOneSet = (exercise) => {
  if (!exercise || typeof exercise !== 'object') {
    return createEmptyExercise()
  }

  const name = typeof exercise.name === 'string' ? exercise.name : ''
  const sets = Array.isArray(exercise.sets) && exercise.sets.length
    ? exercise.sets.map((set) => ({
        weight: typeof set?.weight === 'string' || typeof set?.weight === 'number'
          ? String(set.weight)
          : '',
        reps: typeof set?.reps === 'string' || typeof set?.reps === 'number'
          ? String(set.reps)
          : '',
      }))
    : [createEmptySet()]

  return {
    name,
    sets,
  }
}
