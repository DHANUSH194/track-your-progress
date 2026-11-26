export type ActivityMode = 'strength' | 'duration'
export type ActivityType = { id: string; name: string; mode: ActivityMode }

type ActivityTypeResponse = { activity_type?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isActivityType(value: unknown): value is ActivityType {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && (value.mode === 'strength' || value.mode === 'duration')
}

function getActivityTypesUrl() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  return apiBaseUrl
    ? `${apiBaseUrl.replace(/\/$/, '')}/activity-types`
    : '/api/activity-types'
}

async function requestActivityTypes(
  method: 'POST' | 'PATCH' | 'DELETE',
  activityId?: string,
  body?: { name?: string; mode?: ActivityMode },
): Promise<Response> {
  const url = activityId
    ? `${getActivityTypesUrl()}/${encodeURIComponent(activityId)}`
    : getActivityTypesUrl()
  const response = await fetch(url, {
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
      : 'Could not save your activity type.'
    throw new Error(detail)
  }
  return response
}

function parseActivityType(result: ActivityTypeResponse): ActivityType {
  if (!isActivityType(result.activity_type)) {
    throw new Error('The activity type response has an unexpected format.')
  }
  return result.activity_type
}

export async function createActivityType(
  name: string,
  mode: ActivityMode,
): Promise<ActivityType> {
  const response = await requestActivityTypes('POST', undefined, { name, mode })
  return parseActivityType(await response.json() as ActivityTypeResponse)
}

export async function updateActivityType(
  activityId: string,
  changes: { name?: string; mode?: ActivityMode },
): Promise<ActivityType> {
  const response = await requestActivityTypes('PATCH', activityId, changes)
  return parseActivityType(await response.json() as ActivityTypeResponse)
}

export async function deleteActivityType(activityId: string): Promise<void> {
  await requestActivityTypes('DELETE', activityId)
}
