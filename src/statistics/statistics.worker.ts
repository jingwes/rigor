/// <reference lib="webworker" />

/**
 * The dedicated Web Worker that runs all statistics computation for Rigor.
 *
 * Nothing heavy ever runs on the main thread: this worker lazily loads
 * Pyodide (only on its first request, never at import/startup time),
 * loads `numpy`/`scipy` from Pyodide's own package repository (never
 * micropip, never a different/arbitrary source), installs Rigor's fixed
 * Python analysis source (`src/statistics/python/*.py`, bundled at build
 * time), and then answers one `StatisticsRequest` at a time.
 *
 * There is no way to reach arbitrary Python execution through this worker:
 * the only message shape it accepts is `StatisticsRequest`, whose
 * `analysisType` selects one of a fixed set of predefined Python entry
 * points (see `engine.ts`). A caller can never supply Python source.
 *
 * `src/statistics/workerClient.ts` is the only thing anything else should
 * ever import to talk to this worker.
 */
import type { PyodideInterface } from 'pyodide'

import { installStatisticsPython, runAnalysis } from './engine'
import type {
  LoadingStage,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './types'

// Pinned, exact Pyodide release (see README/PR description for why this
// version): NOT a `latest`/dev alias - a versioned, immutable CDN path.
// Ships NumPy 2.4.6 and SciPy 1.18.0 (see pyodide-lock.json for that
// release), loaded below via Pyodide's own `loadPackage`, never micropip.
const PYODIDE_VERSION = '314.0.7'
const PYODIDE_CDN_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
const PYODIDE_ENTRYPOINT_URL = `${PYODIDE_CDN_BASE_URL}pyodide.mjs`

type LoadPyodideModule = {
  loadPyodide: (options?: { indexURL: string }) => Promise<PyodideInterface>
}

function postOutbound(message: WorkerOutboundMessage): void {
  self.postMessage(message)
}

function postProgress(stage: LoadingStage): void {
  postOutbound({ type: 'progress', stage })
}

let pyodideReadyPromise: Promise<PyodideInterface> | null = null

async function loadPyodideRuntime(): Promise<PyodideInterface> {
  postProgress('loading-pyodide')
  // Dynamic import of the pinned CDN URL - the only network dependency
  // this worker has. `@vite-ignore` is required because this specifier is
  // an absolute runtime URL, not something Vite should try to bundle.
  const { loadPyodide } = (await import(
    /* @vite-ignore */ PYODIDE_ENTRYPOINT_URL
  )) as LoadPyodideModule
  const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN_BASE_URL })

  postProgress('loading-packages')
  await pyodide.loadPackage(['numpy', 'scipy'])

  postProgress('installing-statistics-module')
  installStatisticsPython(pyodide)

  postProgress('ready')
  return pyodide
}

/** Lazily creates (on first call) and thereafter reuses one Pyodide instance. */
function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodideRuntime()
  }
  return pyodideReadyPromise
}

// Pyodide's interpreter is not re-entrant, and multiple `StatisticsRequest`s
// can legitimately arrive concurrently (e.g. several results computed at
// once for a UI, in a future milestone). Requests are queued and processed
// strictly one at a time, in arrival order; a failure in one request never
// blocks the ones queued behind it.
let queueTail: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<void>): void {
  queueTail = queueTail.then(task, task)
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data

  if (message.kind === 'warm-up') {
    enqueue(async () => {
      await getPyodide()
    })
    return
  }

  const { request } = message
  enqueue(async () => {
    try {
      const pyodide = await getPyodide()
      const response = runAnalysis(pyodide, request)
      postOutbound({ type: 'result', response })
    } catch (error) {
      postOutbound({
        type: 'result',
        response: {
          id: request.id,
          success: false,
          error: {
            message:
              error instanceof Error
                ? error.message
                : 'Failed to load the statistics engine',
          },
        },
      })
    }
  })
}
