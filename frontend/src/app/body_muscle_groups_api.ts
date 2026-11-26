import type { CatalogItem, MuscleGroup } from './tracker_catalog_api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getApiUrl(path: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '/api'
  return `${baseUrl}/${path}`
}

async function request<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T | undefined> {
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
      : 'Could not save this tracker option.'
    throw new Error(detail)
  }
  if (response.status === 204) return undefined
  return await response.json() as T
}

function parseBodyPart(value: unknown): CatalogItem {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string') {
    throw new Error('The body-part response has an unexpected format.')
  }
  return { id: value.id, name: value.name }
}

function parseMuscleGroup(value: unknown): MuscleGroup {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.body_part_id !== 'string') {
    throw new Error('The muscle-group response has an unexpected format.')
  }
  return { id: value.id, name: value.name, bodyPartId: value.body_part_id }
}

export async function createBodyPart(name: string): Promise<CatalogItem> {
  const result = await request<{ body_part?: unknown }>('body-parts', 'POST', { name })
  return parseBodyPart(result?.body_part)
}

export async function updateBodyPart(id: string, name: string): Promise<CatalogItem> {
  const result = await request<{ body_part?: unknown }>(
    `body-parts/${encodeURIComponent(id)}`,
    'PATCH',
    { name },
  )
  return parseBodyPart(result?.body_part)
}

export async function deleteBodyPart(id: string): Promise<void> {
  await request(`body-parts/${encodeURIComponent(id)}`, 'DELETE')
}

export async function createMuscleGroup(
  name: string,
  bodyPartId: string,
): Promise<MuscleGroup> {
  const result = await request<{ muscle_group?: unknown }>('muscle-groups', 'POST', {
    name,
    body_part_id: Number(bodyPartId),
  })
  return parseMuscleGroup(result?.muscle_group)
}

export async function updateMuscleGroup(
  id: string,
  changes: { name?: string; bodyPartId?: string },
): Promise<MuscleGroup> {
  const result = await request<{ muscle_group?: unknown }>(
    `muscle-groups/${encodeURIComponent(id)}`,
    'PATCH',
    {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.bodyPartId !== undefined
        ? { body_part_id: Number(changes.bodyPartId) }
        : {}),
    },
  )
  return parseMuscleGroup(result?.muscle_group)
}

export async function deleteMuscleGroup(id: string): Promise<void> {
  await request(`muscle-groups/${encodeURIComponent(id)}`, 'DELETE')
}
