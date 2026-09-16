import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GridEntry } from './GridEntry'

describe('GridEntry', () => {
  it('renders one input per column per row', () => {
    render(
      <GridEntry
        columns={['sample_id', 'group', 'value']}
        rows={[{ sample_id: '', group: '', value: '' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('sample_id, row 1')).toBeInTheDocument()
    expect(screen.getByLabelText('group, row 1')).toBeInTheDocument()
    expect(screen.getByLabelText('value, row 1')).toBeInTheDocument()
  })

  it('calls onChange with an edited cell value, leaving other cells untouched', () => {
    const onChange = vi.fn()
    render(
      <GridEntry
        columns={['sample_id', 'group', 'value']}
        rows={[{ sample_id: '1', group: 'Control', value: '' }]}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByLabelText('value, row 1'), {
      target: { value: '12.5' },
    })
    expect(onChange).toHaveBeenCalledWith([
      { sample_id: '1', group: 'Control', value: '12.5' },
    ])
  })

  it('adds a new blank row', () => {
    const onChange = vi.fn()
    render(
      <GridEntry
        columns={['sample_id', 'group', 'value']}
        rows={[{ sample_id: '1', group: 'Control', value: '10' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    expect(onChange).toHaveBeenCalledWith([
      { sample_id: '1', group: 'Control', value: '10' },
      { sample_id: '', group: '', value: '' },
    ])
  })

  it('removes a row', () => {
    const onChange = vi.fn()
    render(
      <GridEntry
        columns={['sample_id', 'group', 'value']}
        rows={[
          { sample_id: '1', group: 'Control', value: '10' },
          { sample_id: '2', group: 'Control', value: '11' },
        ]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }))
    expect(onChange).toHaveBeenCalledWith([
      { sample_id: '2', group: 'Control', value: '11' },
    ])
  })

  it('disables removing the last remaining row', () => {
    render(
      <GridEntry
        columns={['sample_id', 'group', 'value']}
        rows={[{ sample_id: '1', group: 'Control', value: '10' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Remove row 1' })).toBeDisabled()
  })
})
