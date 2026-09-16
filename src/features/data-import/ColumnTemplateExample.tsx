import type { ColumnTemplate } from './datasetFormat'

export interface ColumnTemplateExampleProps {
  template: ColumnTemplate
}

/** Shows the expected column layout for a format, with a small worked example. */
export function ColumnTemplateExample({
  template,
}: ColumnTemplateExampleProps) {
  return (
    <div className="column-template">
      <p>{template.description}</p>
      <table>
        <caption className="visually-hidden">
          Example {template.label} columns
        </caption>
        <thead>
          <tr>
            {template.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {template.example.map((exampleRow, rowIndex) => (
            <tr key={rowIndex}>
              {exampleRow.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
