import { useState } from 'react'
import {
  createActivityType,
  deleteActivityType,
  updateActivityType,
  type ActivityMode,
  type ActivityType,
} from './activity_types_api'

type ActivityTypeManagerProps = {
  activities: ActivityType[]
  onActivitiesChange: (activities: ActivityType[]) => void
  onClose: () => void
}

function ActivityTypeRow({
  activity,
  disabled,
  onDelete,
  onUpdate,
}: {
  activity: ActivityType
  disabled: boolean
  onDelete: (activityId: string) => Promise<void>
  onUpdate: (activity: ActivityType) => Promise<void>
}) {
  const [name, setName] = useState(activity.name)
  const [mode, setMode] = useState<ActivityMode>(activity.mode)
  const hasChanges = name.trim() !== activity.name || mode !== activity.mode

  return (
    <div className="manager-row" key={activity.id}>
      <input
        aria-label={`Edit ${activity.name}`}
        disabled={disabled}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <select
        aria-label={`Tracking style for ${activity.name}`}
        disabled={disabled}
        onChange={(event) => setMode(event.target.value as ActivityMode)}
        value={mode}
      >
        <option value="strength">Strength metrics</option>
        <option value="duration">Duration metrics</option>
      </select>
      <div className="manager-row-actions">
        <button
          aria-label={`Save ${activity.name}`}
          className="manager-save"
          disabled={disabled || !hasChanges || !name.trim()}
          onClick={() => void onUpdate({ ...activity, name: name.trim(), mode })}
          type="button"
        >
          Save
        </button>
        <button
          aria-label={`Delete ${activity.name}`}
          className="manager-remove"
          disabled={disabled}
          onClick={() => void onDelete(activity.id)}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function ActivityTypeManager({
  activities,
  onActivitiesChange,
  onClose,
}: ActivityTypeManagerProps) {
  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState<ActivityMode>('duration')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function addActivityType() {
    const name = newName.trim()
    if (!name) {
      setError('Enter a name before adding an activity type.')
      return
    }
    if (activities.some((activity) => activity.name.toLowerCase() === name.toLowerCase())) {
      setError('That activity type already exists.')
      return
    }

    setBusyId('new')
    setError('')
    try {
      const activity = await createActivityType(name, newMode)
      onActivitiesChange([...activities, activity].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not add the activity type.')
    } finally {
      setBusyId('')
    }
  }

  async function updateActivity(activity: ActivityType) {
    if (activities.some((item) => item.id !== activity.id
      && item.name.toLowerCase() === activity.name.toLowerCase())) {
      setError('That activity type already exists.')
      return
    }

    setBusyId(activity.id)
    setError('')
    try {
      const updated = await updateActivityType(activity.id, {
        name: activity.name,
        mode: activity.mode,
      })
      onActivitiesChange(
        activities.map((item) => item.id === updated.id ? updated : item)
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the activity type.')
    } finally {
      setBusyId('')
    }
  }

  async function removeActivity(activityId: string) {
    setBusyId(activityId)
    setError('')
    try {
      await deleteActivityType(activityId)
      onActivitiesChange(activities.filter((activity) => activity.id !== activityId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete the activity type.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="manager-overlay" role="presentation">
      <section
        aria-labelledby="activity-manager-title"
        aria-modal="true"
        className="option-manager activity-type-manager"
        role="dialog"
      >
        <div className="manager-heading">
          <div>
            <p className="tracker-eyebrow">CUSTOMIZE YOUR TRACKER</p>
            <h2 id="activity-manager-title">Activity types</h2>
          </div>
          <button
            aria-label="Close activity types"
            className="close-tracker"
            disabled={Boolean(busyId)}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="manager-list">
          {activities.map((activity) => (
            <ActivityTypeRow
              activity={activity}
              disabled={Boolean(busyId)}
              key={activity.id}
              onDelete={removeActivity}
              onUpdate={updateActivity}
            />
          ))}
          {activities.length === 0 && (
            <p className="manager-empty">No activity types yet. Add one below.</p>
          )}
        </div>

        <div className="manager-add">
          <label htmlFor="new-activity-type">Add an activity type</label>
          <div className="manager-add-row">
            <input
              id="new-activity-type"
              disabled={Boolean(busyId)}
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void addActivityType()
                }
              }}
              placeholder="e.g. Mobility"
              value={newName}
            />
            <select
              aria-label="Tracking style for new activity"
              disabled={Boolean(busyId)}
              onChange={(event) => setNewMode(event.target.value as ActivityMode)}
              value={newMode}
            >
              <option value="strength">Strength</option>
              <option value="duration">Duration</option>
            </select>
            <button
              className="manager-add-button"
              disabled={Boolean(busyId)}
              onClick={() => void addActivityType()}
              type="button"
            >
              Add
            </button>
          </div>
        </div>

        {error && <p className="manager-error" role="alert">{error}</p>}
        <div className="manager-actions">
          <button
            className="manager-cancel"
            disabled={Boolean(busyId)}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

export default ActivityTypeManager
