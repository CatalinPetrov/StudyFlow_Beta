export type StorageEstimate = {
  usage: number
  quota: number
  percent: number
}

export type PersistenceStatus = 'persisted' | 'available' | 'denied' | 'unsupported' | 'error'

export function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  }
  return error instanceof Error && /quota|storage.*full|not enough space/i.test(error.message)
}

export function storageErrorMessage(error: unknown, fallback = 'Operațiunea nu a putut fi salvată.'): string {
  if (isQuotaError(error)) {
    return 'Spațiul de stocare este plin. Șterge fișiere mari sau exportă datele, apoi încearcă din nou.'
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota, percent: quota > 0 ? Math.min(100, (usage / quota) * 100) : 0 }
  } catch {
    return null
  }
}

export async function getPersistenceStatus(): Promise<PersistenceStatus> {
  if (!navigator.storage?.persisted) return 'unsupported'
  try {
    return await navigator.storage.persisted() ? 'persisted' : 'available'
  } catch {
    return 'error'
  }
}

export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  if (!navigator.storage?.persist) return 'unsupported'
  try {
    if (await navigator.storage.persisted()) return 'persisted'
    return await navigator.storage.persist() ? 'persisted' : 'denied'
  } catch {
    return 'error'
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value.toLocaleString('ro-RO', { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${unit}`
}
