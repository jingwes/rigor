/**
 * Milestone 6: "Save project" - a client-side, download-only export of a
 * `RigorProject` to `project.rigor.json`. Plain `Blob` + anchor download, no
 * new dependency. Reopening a saved project is Milestone 12's job; this only
 * ever writes a file, never reads one back in.
 */
import type { RigorProject } from '../../models/ProjectFile'

export function serializeProject(project: RigorProject): string {
  return JSON.stringify(project, null, 2)
}

export function downloadProjectFile(
  project: RigorProject,
  filename = 'project.rigor.json',
): void {
  const blob = new Blob([serializeProject(project)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}
