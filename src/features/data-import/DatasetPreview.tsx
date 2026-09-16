import type { Dataset, ParsingIssue } from '../../models/Dataset'

export interface DatasetPreviewProps {
  dataset: Dataset
}

/**
 * A live preview of the parsed/entered data. Issues are always shown next
 * to the row/field they concern - never a silently "cleaned" table when
 * problems exist, and never color-only (every flag has explicit text).
 */
export function DatasetPreview({ dataset }: DatasetPreviewProps) {
  const issuesByRow = new Map<string, ParsingIssue[]>()
  const datasetWideIssues: ParsingIssue[] = []

  for (const issue of dataset.issues) {
    if (issue.rowId) {
      const list = issuesByRow.get(issue.rowId) ?? []
      list.push(issue)
      issuesByRow.set(issue.rowId, list)
    } else {
      datasetWideIssues.push(issue)
    }
  }

  const excludedCount = dataset.issues.filter(
    (issue) => issue.severity === 'excluded',
  ).length
  const warningCount = dataset.issues.filter(
    (issue) => issue.severity === 'warning',
  ).length

  return (
    <div className="dataset-preview">
      <h3>
        Preview ({dataset.rows.length} row{dataset.rows.length === 1 ? '' : 's'}
        )
      </h3>

      <div className="preview-issue-summary" role="status">
        {dataset.issues.length === 0 ? (
          <p className="preview-status-ok">No issues found in this data.</p>
        ) : (
          <p>
            {excludedCount > 0 &&
              `${excludedCount} value${excludedCount === 1 ? '' : 's'} could not be used. `}
            {warningCount > 0 &&
              `${warningCount} warning${warningCount === 1 ? '' : 's'} to review, but nothing was removed.`}
          </p>
        )}
        {datasetWideIssues.length > 0 && (
          <ul className="dataset-wide-issues">
            {datasetWideIssues.map((issue, index) => (
              <li key={index} className={`issue-${issue.severity}`}>
                {issue.severity === 'excluded' ? 'Excluded: ' : 'Warning: '}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dataset.rows.length > 0 && (
        <table>
          <caption className="visually-hidden">Preview of parsed data</caption>
          <thead>
            <tr>
              {dataset.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
              <th scope="col">Issues</th>
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((row, index) => {
              const rowIssues = issuesByRow.get(row.rowId) ?? []
              const hasExcluded = rowIssues.some(
                (issue) => issue.severity === 'excluded',
              )
              const rowClass = hasExcluded
                ? 'row-excluded'
                : rowIssues.length > 0
                  ? 'row-warning'
                  : undefined
              return (
                <tr key={row.rowId} className={rowClass}>
                  {dataset.columns.map((column) => (
                    <td key={column}>{row.raw[column] ?? ''}</td>
                  ))}
                  <td>
                    {rowIssues.length > 0 ? (
                      <ul
                        className="row-issue-list"
                        aria-label={`Issues for row ${index + 1}`}
                      >
                        {rowIssues.map((issue, issueIndex) => (
                          <li
                            key={issueIndex}
                            className={`issue-${issue.severity}`}
                          >
                            {issue.severity === 'excluded'
                              ? 'Excluded: '
                              : 'Warning: '}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="visually-hidden">No issues</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
