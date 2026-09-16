import { useMemo, useState } from 'react'
import type { Dataset, DatasetFormat } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { COLUMN_TEMPLATES, resolveDatasetFormat } from './datasetFormat'
import { ColumnTemplateExample } from './ColumnTemplateExample'
import { GridEntry } from './GridEntry'
import { CsvUpload } from './CsvUpload'
import { DatasetPreview } from './DatasetPreview'
import { buildDataset } from './buildDataset'
import { parseCsvText } from './csvParsing'

export interface DataImportFlowProps {
  design: ExperimentDesign
  onExit: () => void
  /** Called once the student confirms their validated dataset, handing it to Milestone 6's analysis flow. */
  onDataImported: (dataset: Dataset) => void
}

type EntryMode = 'paste' | 'upload'

const INITIAL_GRID_ROW_COUNT = 3

function blankRows(columns: string[], count: number): Record<string, string>[] {
  return Array.from({ length: count }, () => {
    const row: Record<string, string> = {}
    for (const column of columns) row[column] = ''
    return row
  })
}

function isRowBlank(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => value.trim().length === 0)
}

export function DataImportFlow({ design, onExit, onDataImported }: DataImportFlowProps) {
  const resolution = useMemo(() => resolveDatasetFormat(design), [design])
  const [chosenFormat, setChosenFormat] = useState<DatasetFormat | undefined>(
    resolution.kind === 'determined' ? resolution.format : undefined,
  )

  const format = chosenFormat
  const template = format ? COLUMN_TEMPLATES[format] : undefined

  const [mode, setMode] = useState<EntryMode>('paste')
  const [gridRows, setGridRows] = useState<Record<string, string>[]>(() =>
    template ? blankRows(template.columns, INITIAL_GRID_ROW_COUNT) : [],
  )

  const [csvFileName, setCsvFileName] = useState<string | undefined>(undefined)
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([])
  const [csvStructuralIssues, setCsvStructuralIssues] = useState<
    ReturnType<typeof parseCsvText>['issues']
  >([])

  function handleChooseFormat(next: DatasetFormat) {
    setChosenFormat(next)
    setGridRows(
      blankRows(COLUMN_TEMPLATES[next].columns, INITIAL_GRID_ROW_COUNT),
    )
    setCsvFileName(undefined)
    setCsvColumns([])
    setCsvRawRows([])
    setCsvStructuralIssues([])
  }

  function handleFileParsed(text: string, fileName: string) {
    const parsed = parseCsvText(text)
    setCsvFileName(fileName)
    setCsvColumns(parsed.columns)
    setCsvRawRows(parsed.rawRows)
    setCsvStructuralIssues(parsed.issues)
  }

  const dataset: Dataset | undefined = useMemo(() => {
    if (!format) return undefined

    if (mode === 'paste') {
      const nonBlankRows = gridRows.filter((row) => !isRowBlank(row))
      return buildDataset({
        format,
        columns: COLUMN_TEMPLATES[format].columns,
        rawRows: nonBlankRows,
        design,
      })
    }

    if (!csvFileName) return undefined

    return buildDataset({
      format,
      columns: csvColumns,
      rawRows: csvRawRows,
      design,
      structuralIssues: csvStructuralIssues,
    })
  }, [
    format,
    mode,
    gridRows,
    csvFileName,
    csvColumns,
    csvRawRows,
    csvStructuralIssues,
    design,
  ])

  if (!format) {
    return (
      <section aria-labelledby="data-import-format-title">
        <h2 id="data-import-format-title">What does your data look like?</h2>
        {resolution.kind === 'ask' && resolution.reason === 'unsure' && (
          <p>
            Earlier, you told us you weren't sure whether your measurements were
            independent, paired, or repeated - so Rigor can't automatically pick
            a data layout for you. Pick the one that matches your data below.
          </p>
        )}
        {resolution.kind === 'ask' && resolution.reason === 'ambiguous' && (
          <p>
            Your design doesn't map cleanly onto a single data layout
            automatically. Pick the one that matches your data below.
          </p>
        )}
        <div className="format-options">
          {Object.values(COLUMN_TEMPLATES).map((option) => (
            <div className="format-option" key={option.format}>
              <h3>{option.label}</h3>
              <ColumnTemplateExample template={option} />
              <button
                type="button"
                onClick={() => handleChooseFormat(option.format)}
              >
                Use the {option.label.toLowerCase()} format
              </button>
            </div>
          ))}
        </div>
        <div className="wizard-nav">
          <button type="button" onClick={onExit} className="wizard-back">
            Back
          </button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="data-import-title">
      <h2 id="data-import-title">Enter your data</h2>
      {resolution.kind === 'determined' && (
        <p className="wizard-note">
          Based on your experimental design, Rigor expects the{' '}
          {template?.label.toLowerCase()} column layout.
        </p>
      )}
      {template && <ColumnTemplateExample template={template} />}

      <fieldset>
        <legend>How do you want to enter your data?</legend>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="entry-mode"
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
              name="entry-mode"
              checked={mode === 'upload'}
              onChange={() => setMode('upload')}
            />
            Upload a CSV file
          </label>
        </div>
      </fieldset>

      {mode === 'paste' && (
        <GridEntry
          columns={template!.columns}
          rows={gridRows}
          onChange={setGridRows}
        />
      )}

      {mode === 'upload' && (
        <>
          <CsvUpload onFileParsed={handleFileParsed} />
          {csvFileName && <p>Loaded file: {csvFileName}</p>}
        </>
      )}

      {dataset && <DatasetPreview dataset={dataset} />}

      <div className="wizard-nav">
        <button type="button" onClick={onExit} className="wizard-back">
          Back
        </button>
        <button
          type="button"
          className="wizard-next"
          disabled={!dataset || dataset.rows.length === 0}
          onClick={() => dataset && onDataImported(dataset)}
        >
          This looks right - import this data
        </button>
      </div>
    </section>
  )
}
