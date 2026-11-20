/**
 * PackPilot — Per-Trip Mutation Queue & Coordination Barrier
 * Coordinates state and storage mutations per trip ID to prevent write races
 * between checklist actions, trip updates, background context resolution,
 * and whole-database operations like backup restoration.
 */

const tripQueues = new Map<string, Promise<unknown>>()

let activeBarrierPromise: Promise<unknown> | null = null

/**
 * Checks whether an exclusive mutation barrier (e.g. backup restore) is currently active.
 */
export function isMutationBarrierActive(): boolean {
  return activeBarrierPromise !== null
}

/**
 * Enqueues an asynchronous operation for a specific trip ID.
 * Operations for the same trip ID execute strictly sequentially in FIFO order.
 * Operations for different trip IDs execute concurrently without blocking.
 * If a global mutation barrier is active or in-flight, newly enqueued operations
 * chain behind the barrier to execute only after the barrier completes.
 */
export function enqueueTripOperation<T>(tripId: string, operation: () => Promise<T>): Promise<T> {
  const existingQueue = tripQueues.get(tripId) ?? Promise.resolve()
  const barrierWait = activeBarrierPromise

  // If a mutation barrier is active, newly enqueued operations must chain behind:
  // 1. The active barrier (so it does not execute while restore is running).
  // 2. Any prior operation already queued for this trip (preserving strict FIFO order).
  const gatePromise = barrierWait
    ? Promise.allSettled([existingQueue.catch(() => {}), barrierWait.catch(() => {})])
    : existingQueue.catch(() => {})

  const nextPromise = gatePromise
    .catch(() => {
      // Ignore errors from previous operation so subsequent operations still execute
    })
    .then(operation)

  tripQueues.set(tripId, nextPromise)

  nextPromise
    .finally(() => {
      if (tripQueues.get(tripId) === nextPromise) {
        tripQueues.delete(tripId)
      }
    })
    .catch(() => {
      // Prevent detached unhandled rejection warning from the .finally() promise chain
    })

  return nextPromise
}

/**
 * Executes a whole-system operation with an exclusive mutation barrier.
 * 1. Captures all currently in-flight operations across all trip queues.
 * 2. Sets the active barrier so any newly enqueued operations chain behind it.
 * 3. Waits for all pre-existing in-flight operations to settle.
 * 4. Executes the critical barrier operation (e.g. atomic restore + store sync).
 * 5. Clears the active barrier in a finally block, releasing all newly queued operations.
 */
export async function executeMutationBarrier<T>(operation: () => Promise<T>): Promise<T> {
  // If another barrier is already running, wait for it first
  while (activeBarrierPromise) {
    await activeBarrierPromise.catch(() => {})
  }

  // Snapshot currently in-flight operations that started BEFORE this barrier
  const preExistingOperations = Array.from(tripQueues.values())

  let releaseBarrier!: () => void
  const barrierWaitPromise = new Promise<void>((resolve) => {
    releaseBarrier = resolve
  })

  activeBarrierPromise = barrierWaitPromise

  try {
    // Wait for all pre-existing in-flight operations to complete before executing barrier
    if (preExistingOperations.length > 0) {
      await Promise.allSettled(preExistingOperations)
    }

    return await operation()
  } finally {
    activeBarrierPromise = null
    releaseBarrier()
  }
}

/**
 * Clears in-flight queue references for a trip or all idle queues.
 * NOTE: Does NOT clear or nullify an active mutation barrier.
 * An active production barrier must never be broken by queue clearing.
 */
export function clearTripQueue(tripId?: string): void {
  if (tripId) {
    tripQueues.delete(tripId)
  } else {
    tripQueues.clear()
    // Do NOT clear activeBarrierPromise here.
  }
}

/**
 * For test harness teardown ONLY. Resets all queues and barrier state.
 * Must NOT be called in production code.
 */
export function _resetMutationQueueForTests(): void {
  tripQueues.clear()
  activeBarrierPromise = null
}
