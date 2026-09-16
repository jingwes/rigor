/**
 * Unit tests for `workerClient.ts`'s own plumbing: lazy worker/engine
 * creation, request/response id matching (including out-of-order
 * concurrent replies), progress reporting, and worker-level error handling.
 *
 * These tests stub the global `Worker` constructor with an in-memory fake
 * that just records `postMessage` calls and lets the test simulate replies
 * - they are NOT a substitute for `engine.realPyodide.test.ts`, which
 * drives a real Pyodide/SciPy interpreter through the real Python source.
 * jsdom (this project's default Vitest environment) has no real
 * `Worker`/dedicated-worker implementation, so a real end-to-end
 * "Worker + real Pyodide" test cannot run under Vitest in this repo; see
 * the Milestone 4 report for details. What's tested here is entirely
 * `workerClient.ts`'s own TypeScript logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerInboundMessage, WorkerOutboundMessage } from './types'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null =
    null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: WorkerInboundMessage[] = []
  url: string | URL
  options: WorkerOptions | undefined

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url
    this.options = options
    FakeWorker.instances.push(this)
  }

  postMessage(message: WorkerInboundMessage): void {
    this.posted.push(message)
  }

  terminate(): void {
    // no-op
  }

  /** Test helper: simulate the worker posting a message back. */
  emit(message: WorkerOutboundMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerOutboundMessage>)
  }

  /** Test helper: simulate an uncaught worker-level error. */
  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent)
  }
}

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
})

async function freshWorkerClient() {
  vi.resetModules()
  return import('./workerClient')
}

describe('runStatistics', () => {
  it('does not create a worker at import time, only on first call', async () => {
    await freshWorkerClient()
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('lazily creates exactly one worker and posts a typed "analyze" message', async () => {
    const { runStatistics } = await freshWorkerClient()

    const promise = runStatistics({
      analysisType: 'descriptives',
      payload: { values: [1, 2, 3] },
    })

    expect(FakeWorker.instances).toHaveLength(1)
    const worker = FakeWorker.instances[0]
    expect(worker.posted).toHaveLength(1)
    const posted = worker.posted[0]
    if (posted.kind !== 'analyze')
      throw new Error('expected an analyze message')
    expect(posted.request.analysisType).toBe('descriptives')

    worker.emit({
      type: 'result',
      response: {
        id: posted.request.id,
        success: true,
        result: { analysisType: 'descriptives', result: { n: 3 } as never },
      },
    })

    const response = await promise
    expect(response.success).toBe(true)
  })

  it('reuses the same worker across multiple calls', async () => {
    const { runStatistics } = await freshWorkerClient()
    runStatistics({ analysisType: 'descriptives', payload: { values: [1] } })
    runStatistics({ analysisType: 'descriptives', payload: { values: [2] } })
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('matches concurrent, out-of-order responses back to the right caller by id', async () => {
    const { runStatistics } = await freshWorkerClient()

    const first = runStatistics({
      analysisType: 'descriptives',
      payload: { values: [1] },
    })
    const second = runStatistics({
      analysisType: 'descriptives',
      payload: { values: [2] },
    })

    const worker = FakeWorker.instances[0]
    expect(worker.posted).toHaveLength(2)
    const [firstPosted, secondPosted] = worker.posted
    if (firstPosted.kind !== 'analyze' || secondPosted.kind !== 'analyze') {
      throw new Error('expected analyze messages')
    }
    expect(firstPosted.request.id).not.toBe(secondPosted.request.id)

    // Reply to the SECOND request first, to prove matching is by id, not order.
    worker.emit({
      type: 'result',
      response: {
        id: secondPosted.request.id,
        success: true,
        result: { analysisType: 'descriptives', result: { n: 2 } as never },
      },
    })
    worker.emit({
      type: 'result',
      response: {
        id: firstPosted.request.id,
        success: true,
        result: { analysisType: 'descriptives', result: { n: 1 } as never },
      },
    })

    const [firstResponse, secondResponse] = await Promise.all([first, second])
    if (!firstResponse.success || !secondResponse.success) {
      throw new Error('expected both responses to succeed')
    }
    expect(firstResponse.result.result).toEqual({ n: 1 })
    expect(secondResponse.result.result).toEqual({ n: 2 })
  })

  it('resolves (never rejects) every pending request if the worker errors', async () => {
    const { runStatistics } = await freshWorkerClient()
    const promise = runStatistics({
      analysisType: 'descriptives',
      payload: { values: [1] },
    })
    const worker = FakeWorker.instances[0]

    worker.emitError('the pyodide script failed to load')

    const response = await promise
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toContain('failed to load')
    }
  })
})

describe('warmUpStatisticsEngine / onStatisticsProgress', () => {
  it('posts a "warm-up" message and resolves once the "ready" stage is reported', async () => {
    const { warmUpStatisticsEngine, getStatisticsLoadingStage } =
      await freshWorkerClient()

    const ready = warmUpStatisticsEngine()
    const worker = FakeWorker.instances[0]
    expect(worker.posted).toEqual([{ kind: 'warm-up' }])

    worker.emit({ type: 'progress', stage: 'loading-pyodide' })
    expect(getStatisticsLoadingStage()).toBe('loading-pyodide')
    worker.emit({ type: 'progress', stage: 'loading-packages' })
    worker.emit({ type: 'progress', stage: 'installing-statistics-module' })
    worker.emit({ type: 'progress', stage: 'ready' })

    await ready
    expect(getStatisticsLoadingStage()).toBe('ready')
  })

  it('notifies subscribers of every stage change, and unsubscribe stops further notifications', async () => {
    const { onStatisticsProgress, warmUpStatisticsEngine } =
      await freshWorkerClient()
    const seen: string[] = []
    const unsubscribe = onStatisticsProgress((stage) => seen.push(stage))

    void warmUpStatisticsEngine()
    const worker = FakeWorker.instances[0]
    worker.emit({ type: 'progress', stage: 'loading-pyodide' })
    unsubscribe()
    worker.emit({ type: 'progress', stage: 'ready' })

    expect(seen).toEqual(['idle', 'loading-pyodide'])
  })
})
