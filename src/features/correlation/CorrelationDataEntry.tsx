import { useMemo, useState } from 'react'
import type { CorrelationDesign } from '../../models/CorrelationDesign'
import { GridEntry } from '../data-import/GridEntry'
import { CsvUpload } from '../data-import/CsvUpload'
import { parseCsvText } from '../data-import/csvParsing'
import { validateCorrelationData } from './correlationValidation'

export interface CorrelationDataReady {
  x: number[]
  y: number[]
}

export interface CorrelationDataEntryProps {
  design: CorrelationDesign
  onExit: () => void
  onDataReady: (data: CorrelationDataReady) => void
}

type EntryMode = 'paste' | 'upload'

const GRID_COLUMNS = ['unit_id', 'x', 'y']
const INITIAL_GRID_ROW_COUNT = 3

function blankRows(count: number): Record<string, string>[] {
  return Array.from({ length: count }, () => ({ unit_id: '', x: '', y: '' }))
}

/**
 * Milestone 10's small, dedicated two-column (X, Y) data entry - reuses the
 * existing `GridEntry`/`CsvUpload`/`parseCsvText` building blocks from
 * `src/features/data-import/` (genuinely shared, format-agnostic pieces),
 * but validates with `validateCorrelationData` rather than the
 * group-comparison `Dataset`/`buildDataset` pipeline, since there is no
 * group/subject/condition structure here at all - just paired X/Y values,
 * one row per independent unit.
 */
export function CorrelationDataEntry({ design, onExit, onDataReady }: CorrelationDataEntryProps) {
  const [mode, setMode] = useState<EntryMode>('paste')
  const [gridRows, setGridRows] = useState<Record<string, string>[]>(() =>
    blankRows(INITIAL_GRID_ROW_COUNT),
  )

  const [csvFileName, setCsvFileName] = useState<string | undefined>(undefined)
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([])

  function handleFileParsed(text: string, fileName: string) {
    const parsed = parseCsvText(text)
    setCsvFileName(fileName)
    setCsvColumns(parsed.columns)
    setCsvRawRows(parsed.rawRows)
  }

  const outcome = useMemo(() => {
    if (mode === 'paste') {
      const nonBlank = gridRows.filter(
        (row) => (row.x ?? '').trim().length > 0 || (row.y ?? '').trim().length > 0,
      )
      return validateCorrelationData(GRID_COLUMNS, nonBlank)
    }
    if (!csvFileName) return undefined
    return validateCorrelationData(csvColumns, csvRawRows)
  }, [mode, gridRows, csvFileName, csvColumns, csvRawRows])

  const xLabel = design.xVariable.name || 'X'
  const yLabel = design.yVariable.name || 'Y'

  return (
    <section aria-labelledby="correlation-data-entry-title">
      <h2 id="correlation-data-entry-title">Enter your data</h2>
      <p>
        One row per independent {design.experimentalUnitLabel?.trim() || 'unit'}: its{' '}
        {xLabel} value and its {yLabel} value. A <code>unit_id</code> column is optional. When
        uploading a CSV, columns must be named <code>x</code> and <code>y</code> (optionally with{' '}
        <code>unit_id</code>).
      </p>

      <fieldset>
        <legend>How do you want to enter your data?</legend>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="correlation-entry-mode"
              checked={mode === 'paste'}
              onChange={() => setMode('paste')}
            />
            Type or paste it into a grid
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="correlation-entry-mode"
              checked={mode === 'upload'}
              onChange={() => setMode('upload')}
            />
            Upload a CSV file
          </label>
        </div>
      </fieldset>

      {mode === 'paste' && (
        <GridEntry columns={GRID_COLUMNS} rows={gridRows} onChange={setGridRows} />
      )}

      {mode === 'upload' && (
        <>
          <CsvUpload onFileParsed={handleFileParsed} />
          {csvFileName && <p>Loaded file: {csvFileName}</p>}
        </>
      )}

      {outcome && (
        <div className="dataset-preview">
          <h3>Preview ({outcome.rows.length} row{outcome.rows.length === 1 ? '' : 's'})</h3>

          {outcome.issues.length > 0 && (
            <ul className="parsing-issues">
              {outcome.issues.map((issue, index) => (
                <li key={`${issue.rowId ?? 'general'}-${index}`} className={`issue-${issue.severity}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          {outcome.blockingMessage ? (
            <p role="alert" className="field-error">
              {outcome.blockingMessage}
            </p>
          ) : (
            outcome.usable && (
              <p>
                {outcome.usable.n} usable row{outcome.usable.n === 1 ? '' : 's'} will be analyzed.
              </p>
            )
          )}
        </div>
      )}

      <div className="wizard-nav">
        <button type="button" onClick={onExit} className="wizard-back">
          Back
        </button>
        <button
          type="button"
          className="wizard-next"
          disabled={!outcome?.usable}
          onClick={() => outcome?.usable && onDataReady(outcome.usable)}
        >
          This looks right - analyze this data
        </button>
      </div>
    </section>
  )
}
