import { useState } from 'react'
import { OpenProjectFileControl } from './OpenProjectFileControl'

export interface HomePageProps {
  onStartAnalysis: () => void
  /** Milestone 12: hand back the raw dropped/chosen `.rigor.json` file for the caller to parse. */
  onOpenProjectFile: (file: File) => void
  /** A specific, human-readable error from the last attempt to open/continue a project, if any. */
  openProjectError?: string
  /** Whether an autosaved project currently exists in this browser's IndexedDB. */
  hasAutosavedProject: boolean
  onContinueLastProject: () => void
  onDeleteLocalProjects: () => void
}

interface StubAction {
  label: string
  description: string
}

const STUB_ACTIONS: StubAction[] = [
  {
    label: 'Try example',
    description: "Worked examples aren't built yet.",
  },
  {
    label: 'Learn how this works',
    description: "A walkthrough of how Rigor works isn't written yet.",
  },
]

/**
 * Milestone 12: "Open saved project" and "Continue last project" are real
 * now (previously both were disabled stubs - "Continue last project" was
 * never even built as a stub). "Try example" and "Learn how this works"
 * remain disabled stubs; they're still out of scope.
 */
export function HomePage({
  onStartAnalysis,
  onOpenProjectFile,
  openProjectError,
  hasAutosavedProject,
  onContinueLastProject,
  onDeleteLocalProjects,
}: HomePageProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div>
      <p>
        Rigor helps you describe an experiment in plain language before you think about how to
        analyze it. This early version covers describing your design - entering data and running
        an analysis come later.
      </p>

      <button type="button" className="primary-action" onClick={onStartAnalysis}>
        Start an analysis
      </button>

      {hasAutosavedProject && (
        <section aria-labelledby="continue-last-project-title" className="continue-last-project">
          <h2 id="continue-last-project-title">Continue where you left off</h2>
          <button type="button" onClick={onContinueLastProject}>
            Continue last project
          </button>
          <p className="storage-note">
            Saved only in this browser - not backed up anywhere else, no account, no cloud sync.
          </p>
          {confirmingDelete ? (
            <div role="alert" className="confirm-delete">
              <p>
                This removes the project autosaved in this browser. This can&apos;t be undone, but
                you can always start over.
              </p>
              <button
                type="button"
                onClick={() => {
                  onDeleteLocalProjects()
                  setConfirmingDelete(false)
                }}
              >
                Yes, delete it
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="danger-action" onClick={() => setConfirmingDelete(true)}>
              Delete local projects
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="open-saved-project-title">
        <h2 id="open-saved-project-title">Open saved project</h2>
        <OpenProjectFileControl onFileSelected={onOpenProjectFile} />
        {openProjectError && (
          <p role="alert" className="field-error">
            {openProjectError}
          </p>
        )}
      </section>

      <ul className="stub-actions">
        {STUB_ACTIONS.map((action) => (
          <li key={action.label}>
            <button type="button" disabled aria-disabled="true">
              {action.label}
            </button>
            <span className="coming-soon">Coming soon</span>
            <p className="option-examples">{action.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
