import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  getPersistenceStatus,
  isQuotaError,
  requestPersistentStorage,
  storageErrorMessage,
  storageEstimate,
} from './storage'

const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')

function setStorage(value: StorageManager | undefined) {
  Object.defineProperty(navigator, 'storage', { configurable: true, value })
}

describe('storage helpers', () => {
  afterEach(() => {
    if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage)
    else Reflect.deleteProperty(navigator, 'storage')
  })

  it('detects quota errors and returns an actionable message', () => {
    const error = new DOMException('Full', 'QuotaExceededError')
    expect(isQuotaError(error)).toBe(true)
    expect(storageErrorMessage(error)).toContain('Spațiul de stocare este plin')
    expect(storageErrorMessage(new Error('Altă eroare'))).toBe('Altă eroare')
  })

  it('reports persistence availability and requests it', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const persisted = vi.fn().mockResolvedValue(false)
    setStorage({ persist, persisted } as unknown as StorageManager)

    expect(await getPersistenceStatus()).toBe('available')
    expect(await requestPersistentStorage()).toBe('persisted')
    expect(persist).toHaveBeenCalledOnce()
  })

  it('estimates usage and formats byte sizes', async () => {
    setStorage({
      estimate: vi.fn().mockResolvedValue({ usage: 1024 * 1024, quota: 4 * 1024 * 1024 }),
    } as unknown as StorageManager)

    expect(await storageEstimate()).toEqual({ usage: 1024 * 1024, quota: 4 * 1024 * 1024, percent: 25 })
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('handles environments without the Storage API', async () => {
    setStorage(undefined)
    expect(await getPersistenceStatus()).toBe('unsupported')
    expect(await requestPersistentStorage()).toBe('unsupported')
    expect(await storageEstimate()).toBeNull()
  })
})
