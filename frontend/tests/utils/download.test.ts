import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadJsonBlob } from '../../src/utils/download'

describe('downloadJsonBlob Utility', () => {
  let originalWindow: unknown
  let originalDocument: unknown
  let originalURL: unknown

  let mockAnchor: {
    href: string
    download: string
    style: Record<string, string>
    click: ReturnType<typeof vi.fn>
    parentNode: unknown
  }
  let mockBody: {
    appendChild: ReturnType<typeof vi.fn>
    removeChild: ReturnType<typeof vi.fn>
  }
  let mockDocument: {
    createElement: ReturnType<typeof vi.fn>
    body: typeof mockBody
  }
  let mockUrlApi: {
    createObjectURL: ReturnType<typeof vi.fn>
    revokeObjectURL: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    originalWindow = global.window
    originalDocument = global.document
    originalURL = global.URL

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
      parentNode: null,
    }
    mockBody = {
      appendChild: vi.fn((node) => {
        node.parentNode = mockBody
        return node
      }),
      removeChild: vi.fn((node) => {
        node.parentNode = null
        return node
      }),
    }
    mockDocument = {
      createElement: vi.fn(() => mockAnchor),
      body: mockBody,
    }
    mockUrlApi = {
      createObjectURL: vi.fn(() => 'blob:mock-uuid'),
      revokeObjectURL: vi.fn(),
    }

    // @ts-expect-error mock window
    global.window = {}
    // @ts-expect-error mock document
    global.document = mockDocument
    // @ts-expect-error mock URL
    global.URL = mockUrlApi
  })

  afterEach(() => {
    // @ts-expect-error restore window
    global.window = originalWindow
    // @ts-expect-error restore document
    global.document = originalDocument
    // @ts-expect-error restore URL
    global.URL = originalURL
  })

  it('triggers browser download and cleans up resources on success', () => {
    const payload = JSON.stringify({ app: 'packpilot', version: 1 })
    const success = downloadJsonBlob(payload, 'packpilot-backup.json')

    expect(success).toBe(true)
    expect(mockUrlApi.createObjectURL).toHaveBeenCalledTimes(1)
    expect(mockDocument.createElement).toHaveBeenCalledWith('a')
    expect(mockAnchor.download).toBe('packpilot-backup.json')
    expect(mockAnchor.href).toBe('blob:mock-uuid')
    expect(mockBody.appendChild).toHaveBeenCalledWith(mockAnchor)
    expect(mockAnchor.click).toHaveBeenCalledTimes(1)
    expect(mockBody.removeChild).toHaveBeenCalledWith(mockAnchor)
    expect(mockUrlApi.revokeObjectURL).toHaveBeenCalledWith('blob:mock-uuid')
  })

  it('uses custom MIME type when provided in options', () => {
    const payload = JSON.stringify({ key: 'value' })
    const success = downloadJsonBlob(payload, 'custom.json', { mimeType: 'application/custom+json' })

    expect(success).toBe(true)
    expect(mockUrlApi.revokeObjectURL).toHaveBeenCalledWith('blob:mock-uuid')
  })

  it('handles click failure safely without throwing and still cleans up resources', () => {
    mockAnchor.click = vi.fn(() => {
      throw new Error('Simulated browser click failure')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const success = downloadJsonBlob('{"test": true}', 'fail.json')

    expect(success).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
    // Object URL and DOM node must still be safely cleaned up in finally block
    expect(mockBody.removeChild).toHaveBeenCalledWith(mockAnchor)
    expect(mockUrlApi.revokeObjectURL).toHaveBeenCalledWith('blob:mock-uuid')

    warnSpy.mockRestore()
  })

  it('returns false safely when URL.createObjectURL is unavailable', () => {
    // @ts-expect-error simulating missing API
    delete global.URL.createObjectURL

    const success = downloadJsonBlob('{}', 'backup.json')
    expect(success).toBe(false)
  })

  it('returns false safely when window or document is undefined (Node environment)', () => {
    // @ts-expect-error simulate Node SSR
    delete global.window
    // @ts-expect-error simulate Node SSR
    delete global.document

    const success = downloadJsonBlob('{}', 'backup.json')
    expect(success).toBe(false)
  })
})
