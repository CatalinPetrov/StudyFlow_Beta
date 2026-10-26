import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../data/db'

async function deleteDatabase(name: string) {
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
  db.close()
  await db.delete().catch(() => undefined)
  await deleteDatabase('studyflow-library-files-v1')
  await db.open()
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  db.close()
  await db.delete().catch(() => undefined)
  await deleteDatabase('studyflow-library-files-v1')
})
