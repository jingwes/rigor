import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CsvUpload } from './CsvUpload'

function makeCsvFile(content: string, name = 'data.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

describe('CsvUpload', () => {
  it('reads a valid CSV file chosen via the file input and reports its text', async () => {
    const onFileParsed = vi.fn()
    render(<CsvUpload onFileParsed={onFileParsed} />)

    const file = makeCsvFile('sample_id,group,value\n1,Control,10\n')
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1))
    expect(onFileParsed.mock.calls[0][0]).toContain('sample_id,group,value')
    expect(onFileParsed.mock.calls[0][1]).toBe('data.csv')
  })

  it('rejects a file that is not a .csv, with a visible error message', () => {
    const onFileParsed = vi.fn()
    render(<CsvUpload onFileParsed={onFileParsed} />)

    const file = makeCsvFile('not a csv', 'data.txt')
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })

    expect(onFileParsed).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      /doesn't look like a .csv file/,
    )
  })

  it('supports dropping a file onto the drop zone as well as the file picker', async () => {
    const onFileParsed = vi.fn()
    render(<CsvUpload onFileParsed={onFileParsed} />)

    const file = makeCsvFile('sample_id,group,value\n1,Control,10\n')
    const dropZone = screen
      .getByText(/Drag and drop a .csv file here/)
      .closest('div')!
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1))
  })
})
