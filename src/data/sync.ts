import { pb } from '../lib/pocketbase'
import { db } from './db'
import { loadSnapshot } from './migration'

function getUserId(): string | null {
  const model: any = pb.authStore.model
  return model?.id || null
}

async function upsertToCollection(collection: string, record: any) {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return
  const id = String(record?.id)
  if (!id) return
  try {
    const data: any = { ...record }
    delete data.collectionId
    delete data.collectionName
    delete data.expand
    data.user = userId
    try {
      const existing = await pb.collection(collection).getOne(id)
      if (existing) {
        await pb.collection(collection).update(id, data)
        return
      }
    } catch {}
    try {
      await pb.collection(collection).create({ ...data, id })
      return
    } catch {}
    try {
      await pb.collection(collection).create(data)
    } catch {}
  } catch {}
}

async function upsertMeta(key: string, value: any) {
  const userId = getUserId()
  if (!userId || !pb.authStore.isValid) return
  try {
    const list: any[] = await pb.collection('sf_meta').getFullList({ filter: `user = "${userId}" && key = "${key}"` }).catch(() => [])
    const data: any = { key, value, user: userId }
    if (list.length > 0 && list[0]?.id) {
      await pb.collection('sf_meta').update(list[0].id, data)
    } else {
      try {
        await pb.collection('sf_meta').create({ ...data, id: `${userId}_${key}` })
      } catch {
        await pb.collection('sf_meta').create(data)
      }
    }
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
        const data: any = { ...record }
        delete data.collectionId
        delete data.collectionName
        delete data.user
        delete data.expand
        delete data.created
        delete data.updated
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
      const value = record.value
      if (key === 'academics' || key === 'userSettings' || key === 'readNotificationIds') {
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
