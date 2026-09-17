import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HomePage } from './HomePage'

function renderHomePage(overrides: Partial<Parameters<typeof HomePage>[0]> = {}) {
  return render(
    <HomePage
      onStartAnalysis={vi.fn()}
      onOpenProjectFile={vi.fn()}
      hasAutosavedProject={false}
      onContinueLastProject={vi.fn()}
      onDeleteLocalProjects={vi.fn()}
      {...overrides}
    />,
  )
}

describe('HomePage', () => {
  it('has one dominant, functional action', () => {
    const onStartAnalysis = vi.fn()
    renderHomePage({ onStartAnalysis })

    fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))
    expect(onStartAnalysis).toHaveBeenCalledTimes(1)
  })

  it('still shows the not-yet-built actions as visibly disabled, not fake-functional', () => {
    renderHomePage()

    for (const label of ['Try example', 'Learn how this works']) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toBeDisabled()
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(2)
  })

  it('never displays a statistical-test name', () => {
    renderHomePage()
    const bodyText = (document.body.textContent ?? '').toLowerCase()
    expect(bodyText).not.toContain('t-test')
    expect(bodyText).not.toContain('anova')
  })

  describe('Milestone 12: open saved project', () => {
    it('has a real (non-disabled) file picker for opening a saved project', () => {
      renderHomePage()
      expect(screen.getByLabelText('Choose a saved project file')).toBeEnabled()
    })

    it('hands the chosen file back to the caller', () => {
      const onOpenProjectFile = vi.fn()
      renderHomePage({ onOpenProjectFile })

      const file = new File(['{}'], 'project.rigor.json', { type: 'application/json' })
      const input = screen.getByLabelText('Choose a saved project file') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      expect(onOpenProjectFile).toHaveBeenCalledWith(file)
    })

    it('shows a specific error message when one is passed', () => {
      renderHomePage({ openProjectError: "This file isn't a valid Rigor project." })
      expect(screen.getByRole('alert')).toHaveTextContent("This file isn't a valid Rigor project.")
    })
  })

  describe('Milestone 12: continue last project', () => {
    it('is hidden when no autosaved project exists', () => {
      renderHomePage({ hasAutosavedProject: false })
      expect(screen.queryByRole('button', { name: 'Continue last project' })).not.toBeInTheDocument()
    })

    it('is shown, with a "saved only in this browser" note, when an autosave exists', () => {
      renderHomePage({ hasAutosavedProject: true })
      expect(screen.getByRole('button', { name: 'Continue last project' })).toBeEnabled()
      expect(screen.getByText(/Saved only in this browser/)).toBeInTheDocument()
    })

    it('calls onContinueLastProject when clicked', () => {
      const onContinueLastProject = vi.fn()
      renderHomePage({ hasAutosavedProject: true, onContinueLastProject })
      fireEvent.click(screen.getByRole('button', { name: 'Continue last project' }))
      expect(onContinueLastProject).toHaveBeenCalledTimes(1)
    })

    it('asks for confirmation before deleting, and only deletes after confirming', () => {
      const onDeleteLocalProjects = vi.fn()
      renderHomePage({ hasAutosavedProject: true, onDeleteLocalProjects })

      fireEvent.click(screen.getByRole('button', { name: 'Delete local projects' }))
      expect(onDeleteLocalProjects).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/can't be undone/)

      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
      expect(onDeleteLocalProjects).toHaveBeenCalledTimes(1)
    })

    it('cancels the delete confirmation without deleting', () => {
      const onDeleteLocalProjects = vi.fn()
      renderHomePage({ hasAutosavedProject: true, onDeleteLocalProjects })

      fireEvent.click(screen.getByRole('button', { name: 'Delete local projects' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onDeleteLocalProjects).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Delete local projects' })).toBeInTheDocument()
    })
  })
})
