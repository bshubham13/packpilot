/**
 * PackPilot — Pure IndexedDB Health Probe
 * Detects whether IndexedDB is functional or blocked (e.g. private browsing in Firefox/Safari, or disabled).
 */

export async function probeIndexedDB(timeoutMs = 5000): Promise<boolean> {
  // Check if indexedDB API is present in global scope
  const idb = typeof indexedDB !== 'undefined'
    ? indexedDB
    : typeof window !== 'undefined'
    ? window.indexedDB
    : null

  if (!idb) {
    return false
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false
    const probeDbName = '__packpilot_health_probe__'

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(false)
      }
    }, timeoutMs)

    try {
      const request = idb.open(probeDbName, 1)

      request.onsuccess = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          try {
            const db = request.result
            db.close()
          } catch {
            // Cleanup error ignored
          }
          resolve(true)
        }
      }

      request.onerror = (e) => {
        try {
          e.preventDefault?.()
        } catch {
          // Ignore
        }
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve(false)
        }
      }

      request.onblocked = (e) => {
        try {
          e.preventDefault?.()
        } catch {
          // Ignore
        }
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          resolve(false)
        }
      }
    } catch {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(false)
      }
    }
  })
}
