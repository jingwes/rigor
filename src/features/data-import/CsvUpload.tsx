import { useState } from 'react'
import type { DragEvent } from 'react'

export interface CsvUploadProps {
  onFileParsed: (text: string, fileName: string) => void
}

/**
 * Drag-and-drop CSV upload with a fully functional non-drag fallback (the
 * file input). Reads the file client-side with `FileReader` - the file's
 * contents never leave the browser, and nothing here makes a network call.
 */
export function CsvUpload({ onFileParsed }: CsvUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [readError, setReadError] = useState<string | undefined>(undefined)

  function readFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setReadError(
        `'${file.name}' doesn't look like a .csv file. Please choose a .csv file.`,
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setReadError(undefined)
      onFileParsed(text, file.name)
    }
    reader.onerror = () => {
      setReadError(`'${file.name}' couldn't be read. Please try again.`)
    }
    reader.readAsText(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    const file = event.dataTransfer.files[0]
    if (file) readFile(file)
  }

  return (
    <div className="csv-upload">
      <div
        className={`drop-zone${isDragActive ? ' drop-zone-active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragActive(true)
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <p>Drag and drop a .csv file here, or choose one below.</p>
        <div className="field">
          <label htmlFor="csv-file-input">Choose a CSV file to upload</label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) readFile(file)
            }}
          />
        </div>
      </div>
      {readError && (
        <p role="alert" className="field-error">
          {readError}
        </p>
      )}
    </div>
  )
}
