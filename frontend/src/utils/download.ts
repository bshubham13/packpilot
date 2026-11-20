/**
 * PackPilot — Browser File Download Utility
 * Triggers client-side downloads for JSON payloads using Blob and Object URLs.
 * Handles resource cleanup and environment fallbacks safely.
 */

export interface DownloadJsonOptions {
  mimeType?: string
}

/**
 * Triggers a browser file download of the given text content as a Blob.
 * 
 * @param content Serialized JSON string to download
 * @param filename Default filename for the downloaded file
 * @param options Optional configuration (e.g. custom MIME type)
 * @returns boolean True if download was successfully triggered, false otherwise
 */
export function downloadJsonBlob(
  content: string,
  filename = 'packpilot-backup.json',
  options?: DownloadJsonOptions
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  let url: string | null = null
  let anchor: HTMLAnchorElement | null = null

  try {
    if (
      typeof Blob === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return false
    }

    const mimeType = options?.mimeType || 'application/json'
    const blob = new Blob([content], { type: mimeType })
    url = URL.createObjectURL(blob)

    anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'

    document.body.appendChild(anchor)
    anchor.click()
    return true
  } catch (err) {
    console.warn('PackPilot: Failed to trigger file download:', err)
    return false
  } finally {
    if (anchor && anchor.parentNode) {
      anchor.parentNode.removeChild(anchor)
    }
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url)
    }
  }
}
