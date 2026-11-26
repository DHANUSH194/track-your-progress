import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ActivityTypeManager from './activity_type_manager'
import CatalogOptionManager from './catalog_option_manager'
import ExerciseManager from './exercise_manager'
import { getExercises, type Exercise } from './exercises_api'
import { type ActivityType } from './activity_types_api'
import {
  type CatalogItem,
  type MuscleGroup,
  getTrackerCatalog,
} from './tracker_catalog_api'

type ActivityMode = ActivityType['mode']
type Catalog = {
  activities: ActivityType[]
  bodyParts: CatalogItem[]
  muscleGroups: MuscleGroup[]
}
type WorkoutExercise = {
  id: string
  exerciseId?: string
  activityId?: string
  activityName?: string
  mode?: ActivityMode
  bodyPart?: string
  muscleGroup?: string
  name: string
  weight?: number
  reps?: number
  sets?: number
  durationMinutes?: number
  distanceKm?: number
}
type Workout = {
  id: string
  createdAt: string
  exercises: WorkoutExercise[]
}
type PersonalRecordMetric = 'weight' | 'reps'
type PersonalRecord = {
  value: number
  performedOn: string
}
type PersonalRecords = Record<string, Partial<Record<PersonalRecordMetric, PersonalRecord>>>
type StrengthHistoryEntry = {
  mode: 'strength'
  weight: number
  repCount: number
  setNumber: number
}
type DurationHistoryEntry = {
  mode: 'duration'
  durationMinutes: number
  distanceKm: number | null
}
type HistoryEntry = StrengthHistoryEntry | DurationHistoryEntry
type HistoryExercise = {
  id: string
  name: string
  activityName: string | null
  mode: ActivityMode
  entries: HistoryEntry[]
}
type HistoryDay = {
  performedOn: string
  exercises: HistoryExercise[]
}
type ManagerTarget =
  | { kind: 'bodyPart' }
  | { kind: 'muscleGroup'; bodyPartId: string }

const defaultCatalog: Catalog = {
  activities: [],
  bodyParts: [],
  muscleGroups: [],
}

type TrackingDashboardProps = {
  email: string
  onLogout: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWorkoutList(value: unknown): value is Workout[] {
  return Array.isArray(value) && value.every((item) => (
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && Array.isArray(item.exercises)
    && item.exercises.every((exercise) => (
      isRecord(exercise) && typeof exercise.id === 'string' && typeof exercise.name === 'string'
    ))
  ))
}

function isStrengthExercise(exercise: WorkoutExercise) {
  return exercise.mode === 'strength' || (!exercise.mode && exercise.weight !== undefined)
}

function getLocalDateKey(dateValue: string | Date) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getMonthKey(date: Date) {
  return getLocalDateKey(date).slice(0, 7)
}

function getMonthDateRange(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return {
    startDate: `${monthKey}-01`,
    endDate: getLocalDateKey(new Date(year, month, 0)),
  }
}

function getMonthTitle(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number)
  return getMonthKey(new Date(year, month - 1 + offset, 1))
}

function getApiUrl(path: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '/api'
  return `${baseUrl}/${path}`
}

function parsePersonalRecords(value: unknown): PersonalRecords {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    throw new Error('The personal records response has an unexpected format.')
  }

  const records: PersonalRecords = {}
  for (const record of value.records) {
    if (!isRecord(record)
      || !(typeof record.user_exercise_id === 'string' || typeof record.user_exercise_id === 'number')
      || (record.metric !== 'weight' && record.metric !== 'reps')
      || typeof record.value !== 'number'
      || !Number.isFinite(record.value)
      || typeof record.performed_on !== 'string') {
      throw new Error('The personal records response has an unexpected format.')
    }

    const exerciseId = String(record.user_exercise_id)
    records[exerciseId] = {
      ...records[exerciseId],
      [record.metric]: {
        value: record.value,
        performedOn: record.performed_on,
      },
    }
  }
  return records
}

async function getPersonalRecords(): Promise<PersonalRecords> {
  const response = await fetch(getApiUrl('workouts/prs'), { credentials: 'include' })
  const result: unknown = await response.json()
  if (!response.ok) {
    const detail = isRecord(result) && typeof result.detail === 'string'
      ? result.detail
      : 'Could not load personal records.'
    throw new Error(detail)
  }
  return parsePersonalRecords(result)
}

function parseWorkoutHistory(value: unknown): HistoryDay[] {
  if (!isRecord(value) || !Array.isArray(value.days)) {
    throw new Error('The workout history response has an unexpected format.')
  }

  return value.days.map((day) => {
    if (!isRecord(day)
      || typeof day.performed_on !== 'string'
      || !Array.isArray(day.exercises)) {
      throw new Error('The workout history response has an unexpected format.')
    }

    const exercises = day.exercises.map((exercise) => {
      if (!isRecord(exercise)
        || typeof exercise.user_exercise_id !== 'string'
        || typeof exercise.name !== 'string'
        || !(typeof exercise.activity_name === 'string' || exercise.activity_name === null)
        || (exercise.mode !== 'strength' && exercise.mode !== 'duration')
        || !Array.isArray(exercise.entries)) {
        throw new Error('The workout history response has an unexpected format.')
      }
      const mode: ActivityMode = exercise.mode === 'strength' ? 'strength' : 'duration'

      const entries = exercise.entries.map((entry): HistoryEntry => {
        if (!isRecord(entry) || (entry.mode !== 'strength' && entry.mode !== 'duration')) {
          throw new Error('The workout history response has an unexpected format.')
        }
        if (entry.mode === 'strength') {
          if (typeof entry.weight !== 'number'
            || !Number.isFinite(entry.weight)
            || typeof entry.rep_count !== 'number'
            || !Number.isInteger(entry.rep_count)
            || typeof entry.set_number !== 'number'
            || !Number.isInteger(entry.set_number)) {
            throw new Error('The workout history response has an unexpected format.')
          }
          return {
            mode: 'strength',
            weight: entry.weight,
            repCount: entry.rep_count,
            setNumber: entry.set_number,
          }
        }

        if (typeof entry.duration_minutes !== 'number'
          || !Number.isInteger(entry.duration_minutes)
          || !(entry.distance_km === null
            || (typeof entry.distance_km === 'number' && Number.isFinite(entry.distance_km)))) {
          throw new Error('The workout history response has an unexpected format.')
        }
        return {
          mode: 'duration',
          durationMinutes: entry.duration_minutes,
          distanceKm: entry.distance_km,
        }
      })

      return {
        id: exercise.user_exercise_id,
        name: exercise.name,
        activityName: exercise.activity_name,
        mode,
        entries,
      }
    })

    return {
      performedOn: day.performed_on,
      exercises,
    }
  })
}

async function getWorkoutHistory(monthKey: string): Promise<HistoryDay[]> {
  const { startDate, endDate } = getMonthDateRange(monthKey)
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetch(getApiUrl(`workouts?${params}`), { credentials: 'include' })
  const result: unknown = await response.json()
  if (!response.ok) {
    const detail = isRecord(result) && typeof result.detail === 'string'
      ? result.detail
      : 'Could not load workout history.'
    throw new Error(detail)
  }
  return parseWorkoutHistory(result)
}

function getHistoryPersonalRecordLabel(
  exercise: HistoryExercise,
  personalRecords: PersonalRecords,
): string | undefined {
  if (exercise.mode !== 'strength') return undefined
  const metric: PersonalRecordMetric = exercise.entries.some(
    (entry) => entry.mode === 'strength' && entry.weight > 0,
  )
    ? 'weight'
    : 'reps'
  const record = personalRecords[exercise.id]?.[metric]
  if (!record) return undefined

  const unit = metric === 'weight' ? 'kg' : 'reps'
  const recordDate = new Date(`${record.performedOn}T00:00:00`).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric' },
  )
  return `PR: ${record.value} ${unit} · ${recordDate}`
}

function TrackingDashboard({ email, onLogout }: TrackingDashboardProps) {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [personalRecords, setPersonalRecords] = useState<PersonalRecords>({})
  const [historyDays, setHistoryDays] = useState<HistoryDay[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()))
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => getLocalDateKey(new Date()))
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [historyReloadToken, setHistoryReloadToken] = useState(0)
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog)
  const [isLoading, setIsLoading] = useState(true)
  const [referenceTime, setReferenceTime] = useState<number | null>(null)
  const [storageError, setStorageError] = useState('')
  const [exerciseLoadError, setExerciseLoadError] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [activityId, setActivityId] = useState('')
  const [bodyPartId, setBodyPartId] = useState('legs')
  const [muscleGroupId, setMuscleGroupId] = useState('quads')
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([])
  const [exerciseOffset, setExerciseOffset] = useState(0)
  const [hasMoreExercises, setHasMoreExercises] = useState(false)
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [draftExercises, setDraftExercises] = useState<WorkoutExercise[]>([])
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [managerTarget, setManagerTarget] = useState<ManagerTarget | null>(null)
  const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false)
  const [isExerciseManagerOpen, setIsExerciseManagerOpen] = useState(false)

  const storageKey = `repwise-workouts:${email.toLowerCase()}`
  const totalExercises = workouts.reduce((count, workout) => count + workout.exercises.length, 0)
  const greetingName = email.split('@')[0] || 'athlete'
  const selectedActivity = catalog.activities.find((activity) => activity.id === activityId)
  const selectedBodyPart = catalog.bodyParts.find((part) => part.id === bodyPartId)
  const muscleOptions = catalog.muscleGroups.filter((group) => group.bodyPartId === bodyPartId)
  const selectedMuscle = muscleOptions.find((group) => group.id === muscleGroupId)
  const exerciseActivityId = selectedActivity?.id ?? ''
  const exerciseActivityMode = selectedActivity?.mode
  const exerciseMuscleGroupId = selectedMuscle?.id ?? ''
  const selectedExercise = exerciseOptions.find((exercise) => exercise.id === exerciseId)
  const currentMonthKey = getMonthKey(new Date())

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const leadingDays = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    return [
      ...Array.from({ length: leadingDays }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
  }, [selectedMonth])
  const historyWorkoutDates = useMemo(
    () => new Set(historyDays.map((day) => day.performedOn)),
    [historyDays],
  )
  const selectedHistoryDay = historyDays.find(
    (day) => day.performedOn === selectedHistoryDate,
  )

  const groupedWorkouts = useMemo(() => {
    const groups = new Map<string, Workout>()
    for (const workout of workouts) {
      const dateKey = getLocalDateKey(workout.createdAt)
      const existing = groups.get(dateKey)
      if (existing) {
        existing.exercises.push(...workout.exercises)
        if (new Date(workout.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          existing.createdAt = workout.createdAt
        }
      } else {
        groups.set(dateKey, {
          ...workout,
          exercises: [...workout.exercises],
        })
      }
    }
    return [...groups.values()].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [workouts])

  const weeklyWorkoutCount = useMemo(() => {
    if (referenceTime === null) return 0
    const oneWeekAgo = referenceTime - 7 * 24 * 60 * 60 * 1000
    return groupedWorkouts.filter(
      (workout) => new Date(workout.createdAt).getTime() >= oneWeekAgo,
    ).length
  }, [referenceTime, groupedWorkouts])

  useEffect(() => {
    let isActive = true
    queueMicrotask(() => {
      if (!isActive) return
      void (async () => {
        let savedDataError = ''

        try {
          const savedWorkouts = localStorage.getItem(storageKey)
          if (savedWorkouts) {
            const parsed: unknown = JSON.parse(savedWorkouts)
            if (!isWorkoutList(parsed)) throw new Error('Saved workout data has an unexpected format.')
            setWorkouts(parsed)
          }
        } catch (error) {
          savedDataError = error instanceof Error
            ? `We couldn’t load your saved data: ${error.message}`
            : 'We couldn’t load your saved data.'
        }

        try {
          const records = await getPersonalRecords()
          if (isActive) setPersonalRecords(records)
        } catch (error) {
          const recordError = error instanceof Error
            ? `We couldn’t load your personal records: ${error.message}`
            : 'We couldn’t load your personal records.'
          savedDataError = [savedDataError, recordError].filter(Boolean).join(' ')
        }

        try {
          const trackerCatalog = await getTrackerCatalog()
          const activities = trackerCatalog.activities
          if (isActive) {
            setCatalog(trackerCatalog)
            setActivityId(activities[0]?.id ?? '')
            setBodyPartId(trackerCatalog.bodyParts[0]?.id ?? '')
            setMuscleGroupId(trackerCatalog.muscleGroups
              .find((group) => group.bodyPartId === trackerCatalog.bodyParts[0]?.id)?.id ?? '')
            setStorageError(savedDataError)
          }
        } catch (error) {
          if (isActive) {
            setStorageError([
              savedDataError,
              error instanceof Error
                ? `We couldn’t load your tracker catalog: ${error.message}`
                : 'We couldn’t load your tracker catalog.',
            ].filter(Boolean).join(' '))
          }
        } finally {
          if (isActive) {
            setReferenceTime(Date.now())
            setIsLoading(false)
          }
        }
      })()
    })
    return () => {
      isActive = false
    }
  }, [storageKey])

  useEffect(() => {
    let active = true
    void getWorkoutHistory(selectedMonth)
      .then((days) => {
        if (!active) return
        setHistoryDays(days)
        setSelectedHistoryDate((currentDate) => {
          if (currentDate.slice(0, 7) === selectedMonth
            && (days.length === 0 || days.some((day) => day.performedOn === currentDate))) {
            return currentDate
          }
          return days[0]?.performedOn ?? `${selectedMonth}-01`
        })
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryError(
            error instanceof Error ? error.message : 'Could not load workout history.',
          )
        }
      })
      .finally(() => {
        if (active) setIsLoadingHistory(false)
      })

    return () => {
      active = false
    }
  }, [selectedMonth, historyReloadToken])

  useEffect(() => {
    let active = true
      queueMicrotask(() => {
        if (!active) return
        setExerciseOptions([])
        setExerciseId('')
        setExerciseLoadError('')
        setExerciseOffset(0)
        setHasMoreExercises(false)

        if (!exerciseActivityId || (exerciseActivityMode === 'strength' && !exerciseMuscleGroupId)) {
          setIsLoadingExercises(false)
          return
        }

        const filters = {
          activityTypeId: exerciseActivityId,
          ...(exerciseActivityMode === 'strength' && exerciseMuscleGroupId
            ? { muscleGroupId: exerciseMuscleGroupId }
            : {}),
        }
        setIsLoadingExercises(true)
        void getExercises(filters)
          .then((page) => {
            if (!active) return
            setExerciseOptions(page.exercises)
            setExerciseOffset(page.offset + page.exercises.length)
            setHasMoreExercises(page.hasMore)
          })
          .catch((error: unknown) => {
            if (active) {
              setExerciseLoadError(
                error instanceof Error ? error.message : 'Could not load exercises.',
              )
            }
          })
          .finally(() => {
            if (active) setIsLoadingExercises(false)
          })
      })
      return () => {
        active = false
      }
  }, [exerciseActivityId, exerciseActivityMode, exerciseMuscleGroupId])

  function startTracking() {
    setDraftExercises([])
    setActivityId(catalog.activities[0]?.id ?? '')
    setBodyPartId(catalog.bodyParts[0]?.id ?? '')
    setMuscleGroupId(
      catalog.muscleGroups.find(
        (group) => group.bodyPartId === catalog.bodyParts[0]?.id,
      )?.id ?? '',
    )
    setExerciseId('')
    setWeight('')
    setReps('')
    setSets('')
    setDurationMinutes('')
    setDistanceKm('')
    setFormError('')
    setNotice('')
    setIsTracking(true)
  }

  function openManager(target: ManagerTarget) {
    setManagerTarget(target)
    setFormError('')
  }

  function handleBodyPartsChange(bodyParts: CatalogItem[]) {
    setCatalog((current) => ({ ...current, bodyParts }))
    if (!bodyParts.some((part) => part.id === bodyPartId)) {
      const nextBodyPartId = bodyParts[0]?.id ?? ''
      setBodyPartId(nextBodyPartId)
      setMuscleGroupId(
        catalog.muscleGroups.find((group) => group.bodyPartId === nextBodyPartId)?.id ?? '',
      )
      setExerciseId('')
    }
  }

  function handleMuscleGroupsChange(muscleGroups: CatalogItem[]) {
    if (managerTarget?.kind !== 'muscleGroup') return
    const targetBodyPartId = managerTarget.bodyPartId
    setCatalog((current) => ({
      ...current,
      muscleGroups: [
        ...current.muscleGroups.filter((group) => group.bodyPartId !== targetBodyPartId),
        ...muscleGroups.map((group) => ({ ...group, bodyPartId: targetBodyPartId })),
      ],
    }))
    if (targetBodyPartId === bodyPartId && !muscleGroups.some((group) => group.id === muscleGroupId)) {
      setMuscleGroupId(muscleGroups[0]?.id ?? '')
      setExerciseId('')
    }
  }

  function handleActivityTypesChange(activities: ActivityType[]) {
    setCatalog((current) => ({ ...current, activities }))
    if (!activities.some((activity) => activity.id === activityId)) {
      setActivityId(activities[0]?.id ?? '')
      setExerciseId('')
    }
  }

  function handleExercisesChange(
    exercises: Exercise[],
    offset: number,
    hasMore: boolean,
  ) {
    setExerciseOptions(exercises)
    setExerciseOffset(offset)
    setHasMoreExercises(hasMore)
    if (!exercises.some((exercise) => exercise.id === exerciseId)) setExerciseId('')
  }

  async function loadMoreExercises() {
    if (!selectedActivity || isLoadingExercises) return
    setIsLoadingExercises(true)
    setExerciseLoadError('')
    try {
      const page = await getExercises({
        activityTypeId: selectedActivity.id,
        ...(selectedActivity.mode === 'strength' && selectedMuscle
          ? { muscleGroupId: selectedMuscle.id }
          : {}),
      }, exerciseOffset)
      setExerciseOptions((current) => [...current, ...page.exercises])
      setExerciseOffset(page.offset + page.exercises.length)
      setHasMoreExercises(page.hasMore)
    } catch (error) {
      setExerciseLoadError(error instanceof Error ? error.message : 'Could not load more exercises.')
    } finally {
      setIsLoadingExercises(false)
    }
  }

  function handleAddExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedActivity || !selectedExercise) {
      setFormError('Choose an activity and exercise before adding it.')
      return
    }
    if (selectedActivity.mode === 'strength' && (!selectedBodyPart || !selectedMuscle)) {
      setFormError('Choose a body part and muscle group for this strength exercise.')
      return
    }

    const newExercise: WorkoutExercise = {
      id: crypto.randomUUID(),
      exerciseId: selectedExercise.id,
      activityId: selectedActivity.id,
      activityName: selectedActivity.name,
      mode: selectedActivity.mode,
      name: selectedExercise.name,
      ...(selectedActivity.mode === 'strength'
        ? {
            bodyPart: selectedBodyPart?.name,
            muscleGroup: selectedMuscle?.name,
            weight: Number(weight),
            reps: Number(reps),
            sets: Number(sets),
          }
        : {
            durationMinutes: Number(durationMinutes),
            ...((selectedActivity.id === 'cardio'
              || selectedActivity.name.toLowerCase().includes('cardio')) && distanceKm
              ? { distanceKm: Number(distanceKm) }
              : {}),
          }),
    }

    setDraftExercises((current) => [...current, newExercise])
    setExerciseId('')
    setWeight('')
    setReps('')
    setSets('')
    setDurationMinutes('')
    setDistanceKm('')
    setFormError('')
    setNotice(`${selectedExercise.name} added to this workout.`)
  }

  async function saveWorkout() {
    if (draftExercises.length === 0) {
      setFormError('Add at least one exercise before saving your workout.')
      return
    }

    const exerciseSets = new Map<number, Array<{ weight: number; rep_count: number; set_number: number }>>()
    const durationExercises: Array<{
      mode: 'duration'
      user_exercise_id: number
      duration_minutes: number
      distance_km?: number
    }> = []
    for (const exercise of draftExercises) {
      const exerciseId = Number(exercise.exerciseId)
      if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
        setFormError(`Could not save ${exercise.name}: its exercise ID is invalid.`)
        return
      }

      if (isStrengthExercise(exercise)) {
        const weightValue = exercise.weight
        const repsValue = exercise.reps
        const setsValue = exercise.sets
        if (weightValue === undefined
          || repsValue === undefined
          || setsValue === undefined
          || !Number.isFinite(weightValue)
          || !Number.isInteger(repsValue)
          || repsValue < 1
          || !Number.isInteger(setsValue)
          || setsValue < 1) {
          setFormError(`One or more sets for ${exercise.name} has invalid strength data.`)
          return
        }

        const sets = exerciseSets.get(exerciseId) ?? []
        for (let setNumber = 1; setNumber <= setsValue; setNumber += 1) {
          sets.push({
            weight: weightValue,
            rep_count: repsValue,
            set_number: sets.length + 1,
          })
        }
        exerciseSets.set(exerciseId, sets)
      } else {
        const durationValue = exercise.durationMinutes
        const distanceValue = exercise.distanceKm
        if (durationValue === undefined
          || !Number.isInteger(durationValue)
          || durationValue < 1
          || (distanceValue !== undefined
            && (!Number.isFinite(distanceValue) || distanceValue < 0))) {
          setFormError(`One or more duration entries for ${exercise.name} is invalid.`)
          return
        }

        durationExercises.push({
          mode: 'duration',
          user_exercise_id: exerciseId,
          duration_minutes: durationValue,
          ...(distanceValue !== undefined ? { distance_km: distanceValue } : {}),
        })
      }
    }
    const exercisePayload = [
      ...[...exerciseSets.entries()].map(([user_exercise_id, sets]) => ({
        mode: 'strength' as const,
        user_exercise_id,
        sets,
      })),
      ...durationExercises,
    ]

    const now = new Date()
    const performedOn = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    setIsSaving(true)
    setFormError('')
    setStorageError('')

    try {
      const response = await fetch(getApiUrl('workouts'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performed_on: performedOn,
          exercises: exercisePayload,
        }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const detail = isRecord(result) && typeof result.detail === 'string'
          ? result.detail
          : 'Could not save your workout.'
        throw new Error(detail)
      }

      const backendWorkoutId = isRecord(result) && typeof result.workout_id === 'string'
        ? result.workout_id
        : crypto.randomUUID()
      const workout: Workout = {
        id: backendWorkoutId,
        createdAt: new Date().toISOString(),
        exercises: draftExercises,
      }
      const workoutDateKey = getLocalDateKey(workout.createdAt)
      const sameDayWorkout = workouts.find(
        (existingWorkout) => getLocalDateKey(existingWorkout.createdAt) === workoutDateKey,
      )
      const nextWorkouts = sameDayWorkout
        ? workouts.map((existingWorkout) => existingWorkout.id === sameDayWorkout.id
          ? {
              ...existingWorkout,
              createdAt: workout.createdAt,
              exercises: [...existingWorkout.exercises, ...workout.exercises],
            }
          : existingWorkout)
        : [workout, ...workouts]
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextWorkouts))
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? `The workout was saved, but could not be cached locally: ${error.message}`
            : 'The workout was saved, but could not be cached locally.',
        )
      }
      setWorkouts(nextWorkouts)
      setIsTracking(false)
      setDraftExercises([])
      setNotice('Workout saved.')
      setIsLoadingHistory(true)
      setHistoryError('')
      setHistoryDays([])
      setSelectedMonth(performedOn.slice(0, 7))
      setSelectedHistoryDate(performedOn)
      setHistoryReloadToken((current) => current + 1)
      try {
        setPersonalRecords(await getPersonalRecords())
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? `Workout saved, but personal records could not be refreshed: ${error.message}`
            : 'Workout saved, but personal records could not be refreshed.',
        )
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your workout.')
    } finally {
      setIsSaving(false)
    }
  }

  function cancelTracking() {
    setIsTracking(false)
    setDraftExercises([])
    setFormError('')
    setNotice('')
  }

  function changeHistoryMonth(offset: number) {
    setIsLoadingHistory(true)
    setHistoryError('')
    setHistoryDays([])
    setSelectedMonth((month) => shiftMonth(month, offset))
  }

  function metricsFor(exercise: WorkoutExercise) {
    if (exercise.mode === 'strength' || (!exercise.mode && exercise.weight !== undefined)) {
      return `${exercise.weight ?? 0} kg · ${exercise.sets ?? 0} × ${exercise.reps ?? 0}`
    }
    const parts = [`${exercise.durationMinutes ?? 0} min`]
    if (exercise.distanceKm !== undefined) parts.push(`${exercise.distanceKm} km`)
    return parts.join(' · ')
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <a className="brand" href="/" aria-label="Repwise home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M5 11h4v10H5zM23 11h4v10h-4zM10 14h12v4H10z" fill="currentColor" />
              <path d="M3 13v6M29 13v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>repwise</span>
        </a>
        <div className="account-menu">
          <span className="account-email">{email}</span>
          <button className="logout-button" onClick={onLogout} type="button">Sign out</button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow"><span className="eyebrow-dot" /> YOUR TRAINING SPACE</p>
            <h1>Let’s get stronger, <span>{greetingName}.</span></h1>
            <p className="dashboard-subtitle">Every workout is a step forward. Keep your momentum going.</p>
          </div>
          {!isTracking && (
            <button className="track-button" onClick={startTracking} type="button">
              <span className="track-plus" aria-hidden="true">+</span>
              Track a workout
            </button>
          )}
        </section>

        {storageError && <p className="storage-message" role="status">{storageError}</p>}

        <section className="summary-grid" aria-label="Workout summary">
          <article className="summary-card">
            <span className="summary-icon" aria-hidden="true">↗</span>
            <div><p>Workouts this week</p><strong>{isLoading ? '—' : weeklyWorkoutCount}</strong></div>
            <span className="summary-caption">last 7 days</span>
          </article>
          <article className="summary-card">
            <span className="summary-icon dumbbell-summary" aria-hidden="true">▰</span>
            <div><p>Exercises logged</p><strong>{isLoading ? '—' : totalExercises}</strong></div>
            <span className="summary-caption">all time</span>
          </article>
        </section>

        {isTracking && (
          <section className="tracker-card" aria-labelledby="tracker-title">
            <div className="tracker-heading">
              <div>
                <p className="tracker-eyebrow">WORKOUT BUILDER</p>
                <h2 id="tracker-title">Build your session</h2>
                <p>Pick an activity and log the metrics that fit it.</p>
              </div>
              <button className="close-tracker" onClick={cancelTracking} type="button" aria-label="Cancel workout">×</button>
            </div>

            <form className="tracker-form activity-form" onSubmit={handleAddExercise}>
              <div className="tracker-field">
                <div className="field-heading">
                  <label htmlFor="activity-type">Activity type</label>
                  <button className="manage-options" onClick={() => setIsActivityManagerOpen(true)} type="button">Add / edit</button>
                </div>
                <select
                  id="activity-type"
                  onChange={(event) => {
                    setActivityId(event.target.value)
                    setExerciseId('')
                    setWeight('')
                    setReps('')
                    setSets('')
                    setDurationMinutes('')
                    setDistanceKm('')
                    setFormError('')
                  }}
                  required
                  value={activityId}
                >
                  {catalog.activities.length === 0 && <option value="">Add an activity type first</option>}
                  {catalog.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
                </select>
              </div>

              {selectedActivity?.mode === 'strength' && (
                <div className="tracker-category-grid">
                  <div className="tracker-field">
                    <div className="field-heading">
                      <label htmlFor="body-part">Body part</label>
                      <button className="manage-options" onClick={() => openManager({ kind: 'bodyPart' })} type="button">Add / edit</button>
                    </div>
                    <select
                      id="body-part"
                      onChange={(event) => {
                        const nextBodyPartId = event.target.value
                        setBodyPartId(nextBodyPartId)
                        setMuscleGroupId(
                          catalog.muscleGroups.find(
                            (group) => group.bodyPartId === nextBodyPartId,
                          )?.id ?? '',
                        )
                        setExerciseId('')
                      }}
                      required
                      value={bodyPartId}
                    >
                      {catalog.bodyParts.length === 0 && <option value="">Add a body part first</option>}
                      {catalog.bodyParts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
                    </select>
                  </div>
                  <div className="tracker-field">
                    <div className="field-heading">
                      <label htmlFor="muscle-group">Muscle group</label>
                      <button
                        className="manage-options"
                        disabled={!selectedBodyPart}
                        onClick={() => openManager({ kind: 'muscleGroup', bodyPartId })}
                        type="button"
                      >
                        Add / edit
                      </button>
                    </div>
                    <select
                      id="muscle-group"
                      onChange={(event) => {
                        setMuscleGroupId(event.target.value)
                        setExerciseId('')
                      }}
                      required
                      value={muscleGroupId}
                    >
                      {muscleOptions.length === 0 && <option value="">Add a muscle group first</option>}
                      {muscleOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="tracker-field">
                <div className="field-heading">
                  <label htmlFor="exercise-choice">Exercise</label>
                  <button
                    className="manage-options"
                    disabled={!selectedActivity
                      || isLoadingExercises
                      || (selectedActivity.mode === 'strength' && !selectedMuscle)}
                    onClick={() => setIsExerciseManagerOpen(true)}
                    type="button"
                  >
                    Add / edit exercises
                  </button>
                </div>
                <select
                  id="exercise-choice"
                  onChange={(event) => setExerciseId(event.target.value)}
                  required
                  value={exerciseId}
                >
                  <option value="">Choose an exercise</option>
                  {exerciseOptions.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                </select>
                {isLoadingExercises && <p className="field-hint">Loading exercises…</p>}
                {exerciseLoadError && <p className="form-feedback error" role="alert">{exerciseLoadError}</p>}
                {!isLoadingExercises && exerciseOptions.length === 0 && !exerciseLoadError && (
                  <p className="field-hint">Add your first exercise using “Add / edit exercises”.</p>
                )}
                {hasMoreExercises && (
                  <button
                    className="manage-options"
                    disabled={isLoadingExercises}
                    onClick={() => void loadMoreExercises()}
                    type="button"
                  >
                    {isLoadingExercises ? 'Loading…' : 'Load more exercises'}
                  </button>
                )}
              </div>

              {selectedActivity?.mode === 'strength' ? (
                <div className="exercise-metrics">
                  <div>
                    <label htmlFor="exercise-weight">Weight <span>(kg)</span></label>
                    <input
                      id="exercise-weight"
                      min="0"
                      onChange={(event) => setWeight(event.target.value)}
                      placeholder="0"
                      required
                      step="0.5"
                      type="number"
                      value={weight}
                    />
                  </div>
                  <div>
                    <label htmlFor="exercise-reps">Reps</label>
                    <input
                      id="exercise-reps"
                      min="1"
                      onChange={(event) => setReps(event.target.value)}
                      placeholder="0"
                      required
                      step="1"
                      type="number"
                      value={reps}
                    />
                  </div>
                  <div>
                    <label htmlFor="exercise-sets">Sets</label>
                    <input
                      id="exercise-sets"
                      min="1"
                      onChange={(event) => setSets(event.target.value)}
                      placeholder="0"
                      required
                      step="1"
                      type="number"
                      value={sets}
                    />
                  </div>
                </div>
              ) : (
                <div className="exercise-metrics duration-metrics">
                  <div>
                    <label htmlFor="exercise-duration">Duration <span>(minutes)</span></label>
                    <input
                      id="exercise-duration"
                      min="1"
                      onChange={(event) => setDurationMinutes(event.target.value)}
                      placeholder="e.g. 20"
                      required
                      step="1"
                      type="number"
                      value={durationMinutes}
                    />
                  </div>
                  {selectedActivity?.name.toLowerCase().includes('cardio') && (
                    <div>
                      <label htmlFor="exercise-distance">Distance <span>(km, optional)</span></label>
                      <input
                        id="exercise-distance"
                        min="0"
                        onChange={(event) => setDistanceKm(event.target.value)}
                        placeholder="e.g. 5"
                        step="0.1"
                        type="number"
                        value={distanceKm}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="tracker-actions">
                <span className="draft-count">
                  {draftExercises.length > 0
                    ? `${draftExercises.length} exercise${draftExercises.length === 1 ? '' : 's'} in this workout`
                    : 'Add one or more exercises, then save your workout.'}
                </span>
                <button
                  className="submit-button tracker-next"
                  disabled={!selectedExercise}
                  type="submit"
                >
                  Add exercise <span aria-hidden="true">+</span>
                </button>
              </div>
            </form>

            {formError && <p className="form-feedback error" role="alert">{formError}</p>}
            {notice && <p className="form-feedback success" role="status">{notice}</p>}

            {draftExercises.length > 0 && (
              <div className="workout-draft">
                <div className="draft-header">
                  <h3>This workout</h3>
                  <button className="save-workout-button" disabled={isSaving} onClick={() => void saveWorkout()} type="button">
                    {isSaving ? 'Saving…' : 'Save workout'}
                  </button>
                </div>
                {draftExercises.map((exercise) => (
                  <div className="draft-exercise" key={exercise.id}>
                    <div>
                      <strong>{exercise.name}</strong>
                      <span>
                        {exercise.activityName}
                        {exercise.bodyPart && exercise.muscleGroup
                          ? ` · ${exercise.bodyPart} · ${exercise.muscleGroup}`
                          : ''}
                      </span>
                    </div>
                    <p>{metricsFor(exercise)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="recent-section" aria-labelledby="recent-title">
          <div className="section-heading">
            <div>
              <p className="tracker-eyebrow">YOUR TRAINING HISTORY</p>
              <h2 id="recent-title">Workout history</h2>
            </div>
            <span className="history-count">{historyDays.length} training days</span>
          </div>

          <div className="history-browser">
            <div className="history-month-controls">
              <button
                aria-label="Previous month"
                className="history-month-arrow"
                onClick={() => changeHistoryMonth(-1)}
                type="button"
              >
                ‹
              </button>
              <h3>{getMonthTitle(selectedMonth)}</h3>
              <button
                aria-label="Next month"
                className="history-month-arrow"
                disabled={selectedMonth >= currentMonthKey}
                onClick={() => changeHistoryMonth(1)}
                type="button"
              >
                ›
              </button>
            </div>
            <div
              aria-label={`${getMonthTitle(selectedMonth)} workout calendar`}
              className="history-calendar"
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span className="history-calendar-weekday" key={day}>{day}</span>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return (
                    <span
                      aria-hidden="true"
                      className="history-calendar-empty"
                      key={`empty-${index}`}
                    />
                  )
                }
                const dayKey = `${selectedMonth}-${String(day).padStart(2, '0')}`
                const hasWorkout = historyWorkoutDates.has(dayKey)
                return (
                  <button
                    aria-label={`${new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}${hasWorkout ? ', workout logged' : ''}`}
                    aria-pressed={selectedHistoryDate === dayKey}
                    className={[
                      'history-calendar-day',
                      selectedHistoryDate === dayKey ? 'selected' : '',
                      hasWorkout ? 'has-workout' : '',
                      dayKey === getLocalDateKey(new Date()) ? 'today' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={isLoadingHistory}
                    key={dayKey}
                    onClick={() => setSelectedHistoryDate(dayKey)}
                    type="button"
                  >
                    <span>{day}</span>
                    {hasWorkout && <span aria-hidden="true" className="history-calendar-dot" />}
                  </button>
                )
              })}
            </div>
          </div>

          {historyError && <p className="form-feedback error" role="alert">{historyError}</p>}
          {isLoadingHistory ? (
            <div className="empty-workouts"><p>Loading workout history…</p></div>
          ) : historyError ? null : selectedHistoryDay ? (
            <article className="workout-history-card selected-day-card">
              <div className="history-card-heading">
                <div>
                  <p>{new Date(`${selectedHistoryDay.performedOn}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}</p>
                  <h3>
                    {selectedHistoryDay.exercises.length} exercise{selectedHistoryDay.exercises.length === 1 ? '' : 's'}
                  </h3>
                </div>
                <span className="history-volume">
                  {selectedHistoryDay.exercises.reduce(
                    (total, exercise) => total + exercise.entries.length,
                    0,
                  )} entries
                </span>
              </div>
              <div className="history-exercises">
                {selectedHistoryDay.exercises.map((exercise) => {
                  const personalRecord = getHistoryPersonalRecordLabel(exercise, personalRecords)
                  return (
                    <div className="history-exercise history-exercise-detail" key={exercise.id}>
                      <span className="history-exercise-mark" aria-hidden="true">↗</span>
                      <div>
                        <strong>{exercise.name}</strong>
                        <small>
                          {exercise.activityName
                            ?? (exercise.mode === 'strength' ? 'Strength training' : 'Duration activity')}
                        </small>
                        {personalRecord && <small className="history-pr">{personalRecord}</small>}
                      </div>
                      <p>
                        {exercise.entries.map((entry, index) => (
                          <span className="history-set" key={`${entry.mode}-${index}`}>
                            {entry.mode === 'strength'
                              ? `Set ${entry.setNumber}: ${entry.weight > 0 ? `${entry.weight} kg · ` : ''}${entry.repCount} reps`
                              : [
                                  `${entry.durationMinutes} min`,
                                  entry.distanceKm !== null ? `${entry.distanceKm} km` : '',
                                ].filter(Boolean).join(' · ')}
                          </span>
                        ))}
                      </p>
                    </div>
                  )
                })}
              </div>
            </article>
          ) : (
            <div className="empty-workouts">
              <h3>No workout on this date</h3>
              <p>Select a marked date to review that day’s exercises and sets.</p>
            </div>
          )}
        </section>
        <footer className="dashboard-footer">© 2026 Repwise <span>·</span> Progress, one rep at a time.</footer>
      </div>

      {managerTarget?.kind === 'bodyPart' && (
        <CatalogOptionManager
          entries={catalog.bodyParts}
          kind="bodyPart"
          onClose={() => setManagerTarget(null)}
          onEntriesChange={handleBodyPartsChange}
        />
      )}
      {managerTarget?.kind === 'muscleGroup' && (
        <CatalogOptionManager
          bodyPartId={managerTarget.bodyPartId}
          entries={catalog.muscleGroups
            .filter((group) => group.bodyPartId === managerTarget.bodyPartId)}
          kind="muscleGroup"
          onClose={() => setManagerTarget(null)}
          onEntriesChange={handleMuscleGroupsChange}
        />
      )}
      {isActivityManagerOpen && (
        <ActivityTypeManager
          activities={catalog.activities}
          onActivitiesChange={handleActivityTypesChange}
          onClose={() => setIsActivityManagerOpen(false)}
        />
      )}
      {isExerciseManagerOpen && selectedActivity && (
        <ExerciseManager
          activity={selectedActivity}
          exercises={exerciseOptions}
          initialHasMore={hasMoreExercises}
          initialOffset={exerciseOffset}
          muscleGroup={selectedActivity.mode === 'strength' ? selectedMuscle : undefined}
          onExercisesChange={handleExercisesChange}
          onClose={() => setIsExerciseManagerOpen(false)}
        />
      )}
    </main>
  )
}

export default TrackingDashboard
