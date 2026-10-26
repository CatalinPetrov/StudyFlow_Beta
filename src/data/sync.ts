import { pb } from '../lib/pocketbase'
import { db } from './db'
import { loadSnapshot } from './migration'

function getUserId(): string | null {
  const model: any = pb.authStore.model
  return model?.id || null
}

// Id la distanță determinist (15 chars, format valid PB) derivat din id-ul local.
// Evită duplicatele la push repetat și pe dispozitive multiple; id-urile locale
// numerice sau cu caractere speciale nu sunt acceptate direct de PocketBase.
function remoteId(collection: string, localId: unknown): string {
  const s = `${collection}:${String(localId)}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ s.charCodeAt(s.length - 1 - i), 0x811c9dc5) >>> 0
  }
  const raw = (BigInt(h1) << 32n) | BigInt(h2)
  return raw.toString(36).padStart(15, '0').slice(-15)
}

async function upsertToCollection(collection: string, record: any) {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return
  const localId = record?.id
  if (localId === undefined || localId === null || localId === '') return
  const rid = remoteId(collection, localId)
  // shortcut: colecțiile PB au doar coloanele id/user/payload; tot rândul local merge în payload.
  const body: any = { user: userId, payload: { ...record } }
  try {
    await pb.collection(collection).update(rid, body)
    return
  } catch {}
  try {
    await pb.collection(collection).create({ ...body, id: rid })
  } catch {}
}

async function upsertMeta(key: string, value: any) {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return
  const rid = remoteId('sf_meta', `${userId}:${key}`)
  const body: any = { key, user: userId, payload: value }
  try {
    await pb.collection('sf_meta').update(rid, body)
    return
  } catch {}
  try {
    await pb.collection('sf_meta').create({ ...body, id: rid })
  } catch {}
}

export async function syncPushAll() {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return
  try {
    const snapshot = await loadSnapshot()
    const deckItems = await db.decks.toArray()
    const cardItems = await db.cards.toArray()
    const focusItems = await db.focusSessions.toArray()
    const pdfItems = await db.pdfNotes.toArray()

    const mappings: Array<[string, any[]]> = [
      ['sf_tasks', snapshot.tasks || []],
      ['sf_schedule', snapshot.schedule || []],
      ['sf_exams', snapshot.exams || []],
      ['sf_events', snapshot.events || []],
      ['sf_library_items', snapshot.libraryItems || []],
      ['sf_library_folders', snapshot.libraryFolders || []],
      ['sf_decks', deckItems],
      ['sf_cards', cardItems],
      ['sf_focus_sessions', focusItems],
      ['sf_pdf_notes', pdfItems],
    ]

    for (const [collection, items] of mappings) {
      if (!Array.isArray(items)) continue
      for (const item of items) {
        await upsertToCollection(collection, item)
      }
    }

    await upsertMeta('academics', snapshot.academics)
    await upsertMeta('userSettings', snapshot.userSettings)
    await upsertMeta('readNotificationIds', snapshot.readNotificationIds)
  } catch {}
}

export async function syncAll() {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return

  const mappings: Array<[string, any]> = [
    ['sf_tasks', db.tasks],
    ['sf_schedule', db.schedule],
    ['sf_exams', db.exams],
    ['sf_events', db.events],
    ['sf_library_items', db.libraryItems],
    ['sf_library_folders', db.libraryFolders],
    ['sf_decks', db.decks],
    ['sf_cards', db.cards],
    ['sf_focus_sessions', db.focusSessions],
    ['sf_pdf_notes', db.pdfNotes],
  ]

  for (const [collection, table] of mappings) {
    try {
      const records: any[] = await pb.collection(collection).getFullList({ filter: `user = "${userId}"`, sort: '-created' })
      for (const record of records) {
        // Rândurile vechi fără payload (schema inițială) se sar: nu au date locale.
        const data: any = record?.payload
        if (!data || typeof data !== 'object' || data.id === undefined || data.id === null) continue
        try {
          await (table as any).put(data)
        } catch {}
      }
    } catch {}
  }

  try {
    const metaRecords: any[] = await pb.collection('sf_meta').getFullList({ filter: `user = "${userId}"` })
    for (const record of metaRecords) {
      const key = record.key
      const value = record?.payload
      if ((key === 'academics' || key === 'userSettings' || key === 'readNotificationIds') && value !== undefined) {
        try {
          await db.meta.put({ key, value } as any)
        } catch {}
      }
    }
  } catch {}
}

export async function forceSyncNow() {
  await syncPushAll()
  await syncAll()
}
