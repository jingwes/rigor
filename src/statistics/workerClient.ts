/**
 * The only module anything outside `src/statistics/` should ever import to
 * run statistics.
 *
 * - The worker (and Pyodide inside it) is created lazily: nothing happens
 *   until the first call to `runStatistics` or `warmUpStatisticsEngine`.
 * - Multiple concurrent `runStatistics` calls are supported: each request
 *   gets its own id, responses are matched back to the right caller, and
 *   the worker itself processes them one at a time in arrival order.
 * - `onStatisticsProgress` reports coarse-grained load progress (a real UI
 *   for this is a later milestone; a stage callback is enough for now).
 *
 * This module never imports anything from `src/rules/` or
 * `src/features/data-import/` - it has no opinion on which analysis is
 * appropriate for a dataset, and no idea how a `Dataset` is shaped. It only
 * runs whichever fixed analysis its caller already decided on.
 */
import type {
  LoadingStage,
  StatisticsRequest,
  StatisticsResponse,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './types'

export type {
  AnalysisResult,
  AnalysisType,
  ChiSquareTestResult,
  ContingencyTablePayload,
  DescriptivesPayload,
  DescriptivesResult,
  FishersExactTestResult,
  LoadingStage,
  NormalityDiagnosticsPayload,
  NormalityDiagnosticsResult,
  OneWayAnovaGroupPayload,
  OneWayAnovaGroupSummary,
  OneWayAnovaOmnibusResult,
  OneWayAnovaPairwiseComparison,
  OneWayAnovaPayload,
  OneWayAnovaResult,
  PairedTTestPayload,
  PairedTTestResult,
  StatisticsErrorInfo,
  StatisticsRequest,
  StatisticsResponse,
  WelchTwoSampleTTestPayload,
  WelchTwoSampleTTestResult,
} from './types'

export type ProgressListener = (stage: LoadingStage) => void

/** Distributes `id` to optional across every member of the `StatisticsRequest` union. */
type WithOptionalId<T> = T extends { id: string }
  ? Omit<T, 'id'> & { id?: string }
  : never
export type StatisticsRequestInput = WithOptionalId<StatisticsRequest>

let worker: Worker | null = null
let currentStage: LoadingStage = 'idle'
let nextRequestSequence = 0

const progressListeners = new Set<ProgressListener>()
const pendingRequests = new Map<
  string,
  (response: StatisticsResponse) => void
>()

function generateRequestId(): string {
  nextRequestSequence += 1
  return `stats-${nextRequestSequence}-${Date.now()}`
}

function notifyProgress(stage: LoadingStage): void {
  currentStage = stage
  for (const listener of progressListeners) {
    listener(stage)
  }
}

function failAllPending(message: string): void {
  for (const [id, resolve] of pendingRequests) {
    pendingRequests.delete(id)
    resolve({ id, success: false, error: { message } })
  }
}

function handleOutboundMessage(message: WorkerOutboundMessage): void {
  if (message.type === 'progress') {
    notifyProgress(message.stage)
    return
  }
  const resolve = pendingRequests.get(message.response.id)
  if (resolve) {
    pendingRequests.delete(message.response.id)
    resolve(message.response)
  }
}

function createWorker(): Worker {
  // `new URL(..., import.meta.url)` + `{ type: 'module' }` is the pattern
  // Vite recognizes to bundle `statistics.worker.ts` as its own worker
  // chunk. The worker itself lazily loads Pyodide from a pinned CDN URL -
  // nothing worker-related happens merely by constructing this `Worker`.
  const instance = new Worker(
    new URL('./statistics.worker.ts', import.meta.url),
    {
      type: 'module',
    },
  )
  instance.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
    handleOutboundMessage(event.data)
  }
  instance.onerror = (event: ErrorEvent) => {
    failAllPending(event.message || 'The statistics worker failed unexpectedly')
  }
  return instance
}

function getWorker(): Worker {
  if (!worker) {
    worker = createWorker()
  }
  return worker
}

function postToWorker(message: WorkerInboundMessage): void {
  getWorker().postMessage(message)
}

/**
 * Subscribes to coarse-grained loading-stage updates (e.g. to show a
 * "loading statistics engine..." indicator). Immediately invoked once with
 * the current stage. Returns an unsubscribe function.
 */
export function onStatisticsProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  listener(currentStage)
  return () => {
    progressListeners.delete(listener)
  }
}

export function getStatisticsLoadingStage(): LoadingStage {
  return currentStage
}

/**
 * Triggers the worker + Pyodide + package load without running any
 * analysis, and resolves once the engine reaches the `'ready'` stage. Safe
 * to call more than once (later calls just await the same load). Not
 * required before calling `runStatistics` - it will trigger the same load
 * itself - this is only useful for pre-warming the engine ahead of time.
 */
export function warmUpStatisticsEngine(): Promise<void> {
  return new Promise((resolve) => {
    if (currentStage === 'ready') {
      resolve()
      return
    }
    const unsubscribe = onStatisticsProgress((stage) => {
      if (stage === 'ready') {
        unsubscribe()
        resolve()
      }
    })
    postToWorker({ kind: 'warm-up' })
  })
}

/**
 * Runs one predefined statistical analysis in the worker and resolves with
 * its typed response (never rejects - failures come back as
 * `{ success: false, error }`). Lazily creates the worker and triggers the
 * one-time Pyodide+package load on the very first call made anywhere in
 * the app. Concurrent calls are supported: each gets a unique id and its
 * own response, regardless of how many are in flight at once.
 */
export function runStatistics(
  request: StatisticsRequestInput,
): Promise<StatisticsResponse> {
  const id = request.id ?? generateRequestId()
  const fullRequest = { ...request, id } as StatisticsRequest

  return new Promise((resolve) => {
    pendingRequests.set(id, resolve)
    postToWorker({ kind: 'analyze', request: fullRequest })
  })
}
