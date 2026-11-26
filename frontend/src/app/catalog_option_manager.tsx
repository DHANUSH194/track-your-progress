import { useState } from 'react'
import {
  createBodyPart,
  createMuscleGroup,
  deleteBodyPart,
  deleteMuscleGroup,
  updateBodyPart,
  updateMuscleGroup,
} from './body_muscle_groups_api'
import { type CatalogItem } from './tracker_catalog_api'

type CatalogOptionManagerProps = {
  kind: 'bodyPart' | 'muscleGroup'
  bodyPartId?: string
  entries: CatalogItem[]
  onEntriesChange: (entries: CatalogItem[]) => void
  onClose: () => void
}

function CatalogOptionManager({
  kind,
  bodyPartId,
  entries,
  onEntriesChange,
  onClose,
}: CatalogOptionManagerProps) {
  const [newName, setNewName] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const isBodyPart = kind === 'bodyPart'
  const title = isBodyPart ? 'Body parts' : 'Muscle groups'
  const addLabel = isBodyPart ? 'Add a body part' : 'Add a muscle group'

  async function addEntry() {
    const name = newName.trim()
    if (!name) {
      setError('Enter a name before adding an option.')
      return
    }
    if (!isBodyPart && !bodyPartId) {
      setError('Select a body part first.')
      return
    }
    if (entries.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
      setError('That option already exists.')
      return
    }

    setBusyId('new')
    setError('')
    try {
      let entry: CatalogItem
      if (isBodyPart) {
        entry = await createBodyPart(name)
      } else {
        if (!bodyPartId) throw new Error('Select a body part first.')
        entry = await createMuscleGroup(name, bodyPartId)
      }
      onEntriesChange([...entries, entry].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not add this option.')
    } finally {
      setBusyId('')
    }
  }

  async function updateEntry(entry: CatalogItem) {
    const name = entry.name.trim()
    if (!name) {
      setError('Option names cannot be empty.')
      return
    }
    if (entries.some((item) => item.id !== entry.id
      && item.name.toLowerCase() === name.toLowerCase())) {
      setError('That option already exists.')
      return
    }

    setBusyId(entry.id)
    setError('')
    try {
      const updated = isBodyPart
        ? await updateBodyPart(entry.id, name)
        : await updateMuscleGroup(entry.id, { name })
      onEntriesChange(
        entries.map((item) => item.id === updated.id ? updated : item)
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this option.')
    } finally {
      setBusyId('')
    }
  }

  async function removeEntry(entry: CatalogItem) {
    setBusyId(entry.id)
    setError('')
    try {
      if (isBodyPart) {
        await deleteBodyPart(entry.id)
      } else {
        await deleteMuscleGroup(entry.id)
      }
      onEntriesChange(entries.filter((item) => item.id !== entry.id))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete this option.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="manager-overlay" role="presentation">
      <section
        aria-labelledby="catalog-option-title"
        aria-modal="true"
        className="option-manager activity-type-manager"
        role="dialog"
      >
        <div className="manager-heading">
          <div>
            <p className="tracker-eyebrow">CUSTOMIZE YOUR TRACKER</p>
            <h2 id="catalog-option-title">{title}</h2>
          </div>
          <button
            aria-label={`Close ${title.toLowerCase()}`}
            className="close-tracker"
            disabled={Boolean(busyId)}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="manager-list">
          {entries.map((entry) => (
            <CatalogOptionRow
              disabled={Boolean(busyId)}
              entry={entry}
              key={entry.id}
              onDelete={removeEntry}
              onSave={updateEntry}
            />
          ))}
          {entries.length === 0 && <p className="manager-empty">No options yet. Add one below.</p>}
        </div>

        <div className="manager-add">
          <label htmlFor="new-catalog-option">{addLabel}</label>
          <div className="manager-add-row">
            <input
              id="new-catalog-option"
              disabled={Boolean(busyId)}
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void addEntry()
                }
              }}
              placeholder="Enter a name"
              value={newName}
            />
            <button
              className="manager-add-button"
              disabled={Boolean(busyId)}
              onClick={() => void addEntry()}
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

function CatalogOptionRow({
  disabled,
  entry,
  onDelete,
  onSave,
}: {
  disabled: boolean
  entry: CatalogItem
  onDelete: (entry: CatalogItem) => Promise<void>
  onSave: (entry: CatalogItem) => Promise<void>
}) {
  const [name, setName] = useState(entry.name)
  const hasChanges = name.trim() !== entry.name

  return (
    <div className="manager-row">
      <input
        aria-label={`Edit ${entry.name}`}
        disabled={disabled}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <div className="manager-row-actions">
        <button
          aria-label={`Save ${entry.name}`}
          className="manager-save"
          disabled={disabled || !hasChanges || !name.trim()}
          onClick={() => void onSave({ ...entry, name: name.trim() })}
          type="button"
        >
          Save
        </button>
        <button
          aria-label={`Delete ${entry.name}`}
          className="manager-remove"
          disabled={disabled}
          onClick={() => void onDelete(entry)}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default CatalogOptionManager
