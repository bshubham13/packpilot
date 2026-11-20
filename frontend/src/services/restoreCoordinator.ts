/**
 * PackPilot — Restore Lifecycle Coordinator
 * Coordinates backup restoration with the existing mutation queue and ensures
 * safe post-restore synchronization across Zustand stores (tripStore, checklistStore, and templateStore).
 * Prevents in-flight mutations from overwriting restored data and silences stale resolutions.
 *
 * Outcome Guarantees:
 * 1. Storage Restoration Failure:
 *    - `success: false, storageCommitted: false`.
 *    - Storage transaction was rolled back; existing database state is preserved intact.
 * 2. Post-Restore Synchronization Failure:
 *    - `success: false, storageCommitted: true, syncError: string`.
 *    - Persistent storage successfully committed the restored data, but the in-memory
 *      Zustand stores failed to reload.
 *    - UI Recovery: The UI should inform the user that the restore succeeded in storage,
 *      and prompt the user to reload the page or re-select their trip to reload state
 *      from persistent storage without needing to re-import the backup file.
 * 3. Complete Success:
 *    - `success: true, storageCommitted: true`.
 *    - Both persistent storage and in-memory stores are fully synchronized.
 */

import type { RestoreResult, RestoreOptions } from '../types/backup'
import { restoreBackup } from './backupService'
import { executeMutationBarrier } from '../stores/mutationQueue'
import { useTripStore, invalidateAllTripResolutionTokens } from '../stores/tripStore'
import { useChecklistStore } from '../stores/checklistStore'
import { useTemplateStore } from '../stores/templateStore'

/**
 * Executes a full backup restore behind an exclusive mutation barrier.
 * 1. Waits for in-flight mutations to settle and blocks newly incoming mutations.
 * 2. Invalidates background context resolutions so stale network callbacks cannot commit.
 * 3. Restores persistent storage using the existing atomic restore engine.
 * 4. On success, reloads trips and safely reconciles the active trip and checklist store.
 * 5. On failure, preserves existing state according to atomic engine guarantees.
 * 6. Always releases the mutation barrier in a finally block.
 */
export async function coordinateRestore(
  backupData: string | unknown,
  options: RestoreOptions
): Promise<RestoreResult> {
  return await executeMutationBarrier(async () => {
    // 1. Invalidate all pending or running context resolutions so they cannot commit writes
    invalidateAllTripResolutionTokens()

    // 2. Perform atomic storage restoration through the Milestone 8A restore engine
    const result = await restoreBackup(backupData, options)

    // 3. If storage restoration failed, do not synchronize stores; preserve existing state and return
    if (!result.success) {
      return {
        ...result,
        storageCommitted: false,
      }
    }

    // 4. On successful storage restoration, synchronize persistent storage with Zustand stores
    try {
      const tripStore = useTripStore.getState()
      const checklistStore = useChecklistStore.getState()

      // Reload all trips from persistent storage
      await tripStore.loadTrips()

      // Check if tripStore internally caught an error and recorded it
      const tripStoreError = useTripStore.getState().error
      if (tripStoreError) {
        return {
          ...result,
          success: false,
          storageCommitted: true,
          syncError: `Failed to reload trips: ${tripStoreError}`,
          errors: [
            ...result.errors,
            `Post-restore synchronization failed: Failed to reload trips: ${tripStoreError}. Restored data was successfully committed to storage, but in-memory state could not be refreshed. Please reload the application to view restored trips.`,
          ],
        }
      }

      const refreshedTrips = useTripStore.getState().trips
      const currentActiveTrip = useTripStore.getState().activeTrip

      // Reconcile active trip
      if (currentActiveTrip) {
        const matchingTrip = refreshedTrips.find((t) => t.id === currentActiveTrip.id)
        if (matchingTrip) {
          // Active trip still exists: update its reference in tripStore and reload checklist items
          useTripStore.setState({ activeTrip: matchingTrip })
          if (checklistStore.tripId === matchingTrip.id) {
            await checklistStore.loadItems(matchingTrip.id)

            const checklistError = useChecklistStore.getState().error
            if (checklistError) {
              return {
                ...result,
                success: false,
                storageCommitted: true,
                syncError: `Failed to reload checklist: ${checklistError}`,
                errors: [
                  ...result.errors,
                  `Post-restore synchronization failed: Failed to reload checklist: ${checklistError}. Restored data was successfully committed to storage. Please re-select the trip to view its checklist.`,
                ],
              }
            }
          }
        } else {
          // Active trip was removed (e.g. by replace mode): clear active trip and checklist store safely
          useTripStore.setState({ activeTrip: null })
          useChecklistStore.setState({
            tripId: null,
            items: [],
            dismissedRecords: [],
            error: null,
          })
        }
      } else if (checklistStore.tripId) {
        const matchingTrip = refreshedTrips.find((t) => t.id === checklistStore.tripId)
        if (matchingTrip) {
          await checklistStore.loadItems(matchingTrip.id)

          const checklistError = useChecklistStore.getState().error
          if (checklistError) {
            return {
              ...result,
              success: false,
              storageCommitted: true,
              syncError: `Failed to reload checklist: ${checklistError}`,
              errors: [
                ...result.errors,
                `Post-restore synchronization failed: Failed to reload checklist: ${checklistError}. Restored data was successfully committed to storage. Please re-select the trip to view its checklist.`,
              ],
            }
          }
        } else {
          useChecklistStore.setState({
            tripId: null,
            items: [],
            dismissedRecords: [],
            error: null,
          })
        }
      }

      // Reload all packing templates from persistent storage
      try {
        await useTemplateStore.getState().loadTemplates()
      } catch {
        // templateStore.loadTemplates rethrows, but also populates store.error
      }

      const templateStoreError = useTemplateStore.getState().error
      if (templateStoreError) {
        return {
          ...result,
          success: false,
          storageCommitted: true,
          syncError: `Failed to reload templates: ${templateStoreError}`,
          errors: [
            ...result.errors,
            `Post-restore synchronization failed: Failed to reload templates: ${templateStoreError}. Restored data was successfully committed to storage, but in-memory state could not be refreshed. Please reload the application to view restored templates.`,
          ],
        }
      }

      return {
        ...result,
        storageCommitted: true,
      }
    } catch (syncErr) {
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr)
      return {
        ...result,
        success: false,
        storageCommitted: true,
        syncError: msg,
        errors: [
          ...result.errors,
          `Post-restore synchronization exception: ${msg}. Restored data was successfully committed to storage. Please reload the application to refresh application state.`,
        ],
      }
    }
  })
}
