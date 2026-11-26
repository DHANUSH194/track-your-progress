import { useState } from 'react'
import {
  createExercise,
  deleteExercise,
  getExercises,
  updateExercise,
  type Exercise,
} from './exercises_api'
import { type ActivityType } from './activity_types_api'
import { type CatalogItem } from './tracker_catalog_api'

type ExerciseManagerProps = {
  activity: ActivityType
  muscleGroup: CatalogItem | undefined
  exercises: Exercise[]
  initialOffset: number
  initialHasMore: boolean
  onExercisesChange: (exercises: Exercise[], offset: number, hasMore: boolean) => void
  onClose: () => void
}

function ExerciseManager({
  activity,
  muscleGroup,
  exercises: initialExercises,
  initialOffset,
  initialHasMore,
  onExercisesChange,
  onClose,
}: ExerciseManagerProps) {
  const [exercises, setExercises] = useState(initialExercises)
  const [offset, setOffset] = useState(initialOffset)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [busyId, setBusyId] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [error, setError] = useState('')

  function applyExercises(nextExercises: Exercise[]) {
    const sorted = [...nextExercises].sort((a, b) => a.name.localeCompare(b.name))
    setExercises(sorted)
    onExercisesChange(sorted, offset, hasMore)
  }

  async function loadMore() {
    setBusyId('more')
    setError('')
    try {
      const page = await getExercises({
        activityTypeId: activity.id,
        ...(activity.mode === 'strength' && muscleGroup
          ? { muscleGroupId: muscleGroup.id }
          : {}),
      }, offset)
      const nextExercises = [...exercises, ...page.exercises]
        .sort((a, b) => a.name.localeCompare(b.name))
      const nextOffset = page.offset + page.exercises.length
      setExercises(nextExercises)
      setOffset(nextOffset)
      setHasMore(page.hasMore)
      onExercisesChange(nextExercises, nextOffset, page.hasMore)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load more exercises.')
    } finally {
      setBusyId('')
    }
  }

  async function addExercise() {
    const name = newName.trim()
    if (!name) {
      setError('Enter an exercise name.')
      return
    }
    if (exercises.some((exercise) => exercise.name.toLowerCase() === name.toLowerCase())) {
      setError('That exercise already exists in this list.')
      return
    }
    if (activity.mode === 'strength' && !muscleGroup) {
      setError('Choose a muscle group before adding a strength exercise.')
      return
    }

    setBusyId('new')
    setError('')
    try {
      const exercise = await createExercise({
        name,
        description: newDescription.trim(),
        activityTypeId: activity.id,
        muscleGroupId: activity.mode === 'strength' ? muscleGroup?.id ?? null : null,
      })
      const nextExercises = [...exercises, exercise].sort((a, b) => a.name.localeCompare(b.name))
      const nextOffset = offset + 1
      setExercises(nextExercises)
      setOffset(nextOffset)
      onExercisesChange(nextExercises, nextOffset, hasMore)
      setNewName('')
      setNewDescription('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not add the exercise.')
    } finally {
      setBusyId('')
    }
  }

  async function saveExercise(exercise: Exercise) {
    const name = exercise.name.trim()
    if (!name) {
      setError('Exercise names cannot be empty.')
      return
    }
    if (exercises.some((item) => item.id !== exercise.id
      && item.name.toLowerCase() === name.toLowerCase())) {
      setError('That exercise already exists in this list.')
      return
    }

    setBusyId(exercise.id)
    setError('')
    try {
      const updated = await updateExercise(exercise.id, {
        name,
        description: exercise.description,
      })
      applyExercises(exercises.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the exercise.')
    } finally {
      setBusyId('')
    }
  }

  async function removeExercise(exercise: Exercise) {
    setBusyId(exercise.id)
    setError('')
    try {
      await deleteExercise(exercise.id)
      const nextExercises = exercises.filter((item) => item.id !== exercise.id)
      const nextOffset = Math.max(0, offset - 1)
      setExercises(nextExercises)
      setOffset(nextOffset)
      onExercisesChange(nextExercises, nextOffset, hasMore)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete the exercise.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="manager-overlay" role="presentation">
      <section
        aria-labelledby="exercise-manager-title"
        aria-modal="true"
        className="option-manager activity-type-manager exercise-manager"
        role="dialog"
      >
        <div className="manager-heading">
          <div>
            <p className="tracker-eyebrow">{activity.name}{muscleGroup ? ` · ${muscleGroup.name}` : ''}</p>
            <h2 id="exercise-manager-title">Exercises</h2>
          </div>
          <button
            aria-label="Close exercises"
            className="close-tracker"
            disabled={Boolean(busyId)}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="manager-list">
          {exercises.map((exercise) => (
            <ExerciseRow
              disabled={Boolean(busyId)}
              exercise={exercise}
              key={exercise.id}
              onDelete={removeExercise}
              onSave={saveExercise}
            />
          ))}
          {exercises.length === 0 && (
            <p className="manager-empty">No exercises yet. Add one below.</p>
          )}
          {hasMore && (
            <button
              className="manager-add-button manager-load-more"
              disabled={Boolean(busyId)}
              onClick={() => void loadMore()}
              type="button"
            >
              Load more
            </button>
          )}
        </div>

        <div className="manager-add">
          <label htmlFor="new-exercise-name">Add an exercise</label>
          <div className="manager-add-form">
            <input
              id="new-exercise-name"
              disabled={Boolean(busyId)}
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void addExercise()
                }
              }}
              placeholder="e.g. Barbell squat"
              value={newName}
            />
            <textarea
              aria-label="Exercise description"
              disabled={Boolean(busyId)}
              maxLength={2000}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Description (optional)"
              value={newDescription}
            />
            <button
              className="manager-add-button"
              disabled={Boolean(busyId)}
              onClick={() => void addExercise()}
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

function ExerciseRow({
  disabled,
  exercise,
  onDelete,
  onSave,
}: {
  disabled: boolean
  exercise: Exercise
  onDelete: (exercise: Exercise) => Promise<void>
  onSave: (exercise: Exercise) => Promise<void>
}) {
  const [name, setName] = useState(exercise.name)
  const [description, setDescription] = useState(exercise.description ?? '')
  const hasChanges = name.trim() !== exercise.name || description !== (exercise.description ?? '')

  return (
    <div className="exercise-manager-row">
      <input
        aria-label={`Edit ${exercise.name}`}
        disabled={disabled}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <textarea
        aria-label={`Description for ${exercise.name}`}
        disabled={disabled}
        maxLength={2000}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description (optional)"
        value={description}
      />
      <div className="manager-row-actions">
        <button
          aria-label={`Save ${exercise.name}`}
          className="manager-save"
          disabled={disabled || !hasChanges || !name.trim()}
          onClick={() => void onSave({ ...exercise, name: name.trim(), description })}
          type="button"
        >
          Save
        </button>
        <button
          aria-label={`Delete ${exercise.name}`}
          className="manager-remove"
          disabled={disabled}
          onClick={() => void onDelete(exercise)}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default ExerciseManager
