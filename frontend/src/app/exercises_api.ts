import { type CatalogItem } from './tracker_catalog_api'

export type Exercise = CatalogItem & {
  description: string | null
  activityTypeId: string
  muscleGroupId: string | null
}

export type ExercisePage = {
  exercises: Exercise[]
  limit: number
  offset: number
  hasMore: boolean
}

export type ExerciseFilters = {
  activityTypeId: string
  muscleGroupId?: string
}

export type ExerciseChanges = {
  name?: string
  description?: string | null
  activityTypeId?: string
  muscleGroupId?: string | null
}

const PAGE_SIZE = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getApiUrl(path: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '/api'
  return `${baseUrl}/${path}`
}

function parseExercise(value: unknown): Exercise {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || !(typeof value.description === 'string' || value.description === null)
    || typeof value.activity_type_id !== 'string'
    || !(typeof value.muscle_group_id === 'string' || value.muscle_group_id === null)) {
    throw new Error('The exercise response has an unexpected format.')
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    activityTypeId: value.activity_type_id,
    muscleGroupId: value.muscle_group_id,
  }
}

async function sendRequest(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
  if (!response.ok) {
    const result: unknown = await response.json()
    const detail = isRecord(result) && typeof result.detail === 'string'
      ? result.detail
      : 'Could not save this exercise.'
    throw new Error(detail)
  }
  return response.status === 204 ? undefined : await response.json()
}

function toApiChanges(changes: ExerciseChanges) {
  return {
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.activityTypeId !== undefined
      ? { activity_type_id: Number(changes.activityTypeId) }
      : {}),
    ...(changes.muscleGroupId !== undefined
      ? {
          muscle_group_id: changes.muscleGroupId === null
            ? null
            : Number(changes.muscleGroupId),
        }
      : {}),
  }
}

export async function getExercises(
  filters: ExerciseFilters,
  offset = 0,
): Promise<ExercisePage> {
  const params = new URLSearchParams({
    activity_type_id: filters.activityTypeId,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  })
  if (filters.muscleGroupId) params.set('muscle_group_id', filters.muscleGroupId)
  const response = await fetch(getApiUrl(`exercises?${params}`), { credentials: 'include' })
  const result: unknown = await response.json()
  if (!response.ok) {
    const detail = isRecord(result) && typeof result.detail === 'string'
      ? result.detail
      : 'Could not load exercises.'
    throw new Error(detail)
  }
  if (!isRecord(result)
    || !Array.isArray(result.exercises)
    || typeof result.limit !== 'number'
    || typeof result.offset !== 'number'
    || typeof result.has_more !== 'boolean') {
    throw new Error('The exercises response has an unexpected format.')
  }
  return {
    exercises: result.exercises.map(parseExercise),
    limit: result.limit,
    offset: result.offset,
    hasMore: result.has_more,
  }
}

export async function createExercise(
  values: {
    name: string
    description: string
    activityTypeId: string
    muscleGroupId: string | null
  },
): Promise<Exercise> {
  const result = await sendRequest('exercises', 'POST', {
    name: values.name,
    description: values.description || null,
    activity_type_id: Number(values.activityTypeId),
    muscle_group_id: values.muscleGroupId === null ? null : Number(values.muscleGroupId),
  })
  if (!isRecord(result)) throw new Error('The create-exercise response was empty.')
  return parseExercise(result.exercise)
}

export async function updateExercise(id: string, changes: ExerciseChanges): Promise<Exercise> {
  const result = await sendRequest(
    `exercises/${encodeURIComponent(id)}`,
    'PATCH',
    toApiChanges(changes),
  )
  if (!isRecord(result)) throw new Error('The update-exercise response was empty.')
  return parseExercise(result.exercise)
}

export async function deleteExercise(id: string): Promise<void> {
  await sendRequest(`exercises/${encodeURIComponent(id)}`, 'DELETE')
}
