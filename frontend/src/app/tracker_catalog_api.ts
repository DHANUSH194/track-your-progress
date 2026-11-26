import type { ActivityType } from './activity_types_api'

export type CatalogItem = { id: string; name: string }
export type MuscleGroup = CatalogItem & { bodyPartId: string }
type MuscleGroupRow = CatalogItem & { body_part_id: string }
export type TrackerCatalog = {
  activities: ActivityType[]
  bodyParts: CatalogItem[]
  muscleGroups: MuscleGroup[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isActivityType(value: unknown): value is ActivityType {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && (value.mode === 'strength' || value.mode === 'duration')
}

function isCatalogItem(value: unknown): value is CatalogItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
}

function isMuscleGroup(value: unknown): value is MuscleGroupRow {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.body_part_id === 'string'
}

export async function getTrackerCatalog(): Promise<TrackerCatalog> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  const catalogUrl = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/$/, '')}/tracker-catalog`
    : '/api/tracker-catalog'
  const response = await fetch(catalogUrl, { credentials: 'include' })
  const result: unknown = await response.json()

  if (!response.ok) {
    const detail = isRecord(result) && typeof result.detail === 'string'
      ? result.detail
      : 'Could not load your tracker catalog.'
    throw new Error(detail)
  }
  if (!isRecord(result)
    || !Array.isArray(result.activity_types)
    || !result.activity_types.every(isActivityType)
    || !Array.isArray(result.body_parts)
    || !result.body_parts.every(isCatalogItem)
    || !Array.isArray(result.muscle_groups)
    || !result.muscle_groups.every(isMuscleGroup)) {
    throw new Error('The tracker catalog response has an unexpected format.')
  }

  return {
    activities: result.activity_types,
    bodyParts: result.body_parts,
    muscleGroups: result.muscle_groups.map((group) => ({
      id: group.id,
      name: group.name,
      bodyPartId: group.body_part_id,
    })),
  }
}
