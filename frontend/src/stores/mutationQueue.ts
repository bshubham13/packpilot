/**
 * PackPilot — Per-Trip Mutation Queue
 * Coordinates state and storage mutations per trip ID to prevent write races
 * between checklist actions, trip updates, and background context resolution.
 */

const tripQueues = new Map<string, Promise<unknown>>()

/**
 * Enqueues an asynchronous operation for a specific trip ID.
 * Operations for the same trip ID execute strictly sequentially in FIFO order.
 * Operations for different trip IDs execute concurrently without blocking.
 */
export function enqueueTripOperation<T>(tripId: string, operation: () => Promise<T>): Promise<T> {
  const currentQueue = tripQueues.get(tripId) ?? Promise.resolve()
  const nextPromise = currentQueue
    .catch(() => {
      // Ignore errors from previous operation so subsequent operations still execute
    })
    .then(operation)

  tripQueues.set(tripId, nextPromise)

  nextPromise.finally(() => {
    if (tripQueues.get(tripId) === nextPromise) {
      tripQueues.delete(tripId)
    }
  })

  return nextPromise
}

/**
 * Clears in-flight queue references (for testing and reset).
 */
export function clearTripQueue(tripId?: string): void {
  if (tripId) {
    tripQueues.delete(tripId)
  } else {
    tripQueues.clear()
  }
}
