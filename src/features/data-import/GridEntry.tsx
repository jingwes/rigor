import type { ChangeEvent } from 'react'

export interface GridEntryProps {
  columns: string[]
  rows: Record<string, string>[]
  onChange: (rows: Record<string, string>[]) => void
}

/**
 * A plain, accessible, editable spreadsheet-like grid built from a plain
 * HTML table + React state - no grid library dependency.
 */
export function GridEntry({ columns, rows, onChange }: GridEntryProps) {
  function updateCell(rowIndex: number, column: string, value: string) {
    onChange(
      rows.map((row, index) =>
        index === rowIndex ? { ...row, [column]: value } : row,
      ),
    )
  }

  function addRow() {
    const blank: Record<string, string> = {}
    for (const column of columns) blank[column] = ''
    onChange([...rows, blank])
  }

  function removeRow(rowIndex: number) {
    onChange(rows.filter((_, index) => index !== rowIndex))
  }

  return (
    <div className="grid-entry">
      <table>
        <caption className="visually-hidden">
          Enter your data, one row per measurement
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
            <th scope="col">
              <span className="visually-hidden">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column}>
                  <input
                    type="text"
                    aria-label={`${column}, row ${rowIndex + 1}`}
                    value={row[column] ?? ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateCell(rowIndex, column, event.target.value)
                    }
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  onClick={() => removeRow(rowIndex)}
                  aria-label={`Remove row ${rowIndex + 1}`}
                  disabled={rows.length <= 1}
                >
                  Remove row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="add-row-button">
        Add row
      </button>
    </div>
  )
}
