import { useState } from 'react'
import type { DragEvent } from 'react'

export interface OpenProjectFileControlProps {
  onFileSelected: (file: File) => void
}

/**
 * Milestone 12: drag-and-drop (+ file-input fallback) picker for a saved
 * `.rigor.json` project file, reusing the same interaction pattern as
 * `CsvUpload.tsx`. Reading the file's contents is the caller's job (it hands
 * back the raw `File`); nothing here parses JSON or touches the network.
 */
export function OpenProjectFileControl({ onFileSelected }: OpenProjectFileControlProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    const file = event.dataTransfer.files[0]
    if (file) onFileSelected(file)
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
        <p>
          Drag and drop a saved <code>.rigor.json</code> project file here, or choose one below.
        </p>
        <div className="field">
          <label htmlFor="project-file-input">Choose a saved project file</label>
          <input
            id="project-file-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onFileSelected(file)
              event.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}
