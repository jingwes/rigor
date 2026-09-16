import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { DataImportFlow } from './DataImportFlow'

function baseDesign(
  overrides: Partial<ExperimentDesign> = {},
): ExperimentDesign {
  return {
    outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

describe('DataImportFlow', () => {
  it('uses the independent-groups template directly when the design says so', () => {
    render(<DataImportFlow design={baseDesign()} onExit={vi.fn()} />)
    expect(screen.getByText(/Rigor expects the/)).toBeInTheDocument()
    expect(screen.getByText(/independent groups/)).toBeInTheDocument()
    expect(screen.getAllByText('sample_id').length).toBeGreaterThan(0)
  })

  it('asks the student to choose a format, without guessing, when relationship is unknown', () => {
    render(
      <DataImportFlow
        design={baseDesign({ relationship: 'unknown' })}
        onExit={vi.fn()}
      />,
    )
    expect(
      screen.getByText(
        /weren't sure whether your measurements were independent/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Use the independent groups format/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Use the paired/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Use the nested/i }),
    ).toBeInTheDocument()
  })

  it('lets a student type data into the grid and shows a live preview with flagged issues', () => {
    render(<DataImportFlow design={baseDesign()} onExit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('sample_id, row 1'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('group, row 1'), {
      target: { value: 'Control' },
    })
    fireEvent.change(screen.getByLabelText('value, row 1'), {
      target: { value: 'not a number' },
    })

    expect(screen.getByText('Preview (1 row)')).toBeInTheDocument()
    expect(screen.getByText(/could not be used/)).toBeInTheDocument()
    expect(
      screen.getByText(/Excluded: Value 'not a number' is not a number\./),
    ).toBeInTheDocument()
  })

  it('never silently drops a row with issues from the preview', () => {
    render(<DataImportFlow design={baseDesign()} onExit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('sample_id, row 1'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('value, row 1'), {
      target: { value: '10' },
    })
    // group left blank on purpose

    expect(screen.getByText('Preview (1 row)')).toBeInTheDocument()
    expect(screen.getByText(/missing a group label/)).toBeInTheDocument()
  })

  it('parses an uploaded CSV and shows a clean preview when the data is valid', async () => {
    render(<DataImportFlow design={baseDesign()} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))

    const csv =
      'sample_id,group,value\n' +
      '1,Control,10\n2,Control,11\n3,Control,9\n' +
      '4,Treatment,12\n5,Treatment,13\n6,Treatment,14\n'
    const file = new File([csv], 'data.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByText('Preview (6 rows)')).toBeInTheDocument(),
    )
    expect(
      screen.getByText('No issues found in this data.'),
    ).toBeInTheDocument()
  })

  it("shows a malformed CSV's issues clearly instead of swallowing them", async () => {
    render(<DataImportFlow design={baseDesign()} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))

    const file = new File(['sample_id,group,value\n1,Control\n'], 'data.csv', {
      type: 'text/csv',
    })
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.queryByText(/Preview \(/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/row 2 of the file/i)).toBeInTheDocument()
  })

  it('ends with an honest message that no analysis has run, after the student confirms import', () => {
    const onExit = vi.fn()
    render(<DataImportFlow design={baseDesign()} onExit={onExit} />)

    fireEvent.change(screen.getByLabelText('sample_id, row 1'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('group, row 1'), {
      target: { value: 'Control' },
    })
    fireEvent.change(screen.getByLabelText('value, row 1'), {
      target: { value: '10' },
    })

    fireEvent.click(screen.getByRole('button', { name: /import this data/i }))

    expect(
      screen.getByText(
        "Your data has been imported and validated. Running the actual analysis isn't available in this version yet.",
      ),
    ).toBeInTheDocument()
  })
})
