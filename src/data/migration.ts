import Dexie from 'dexie'
import { db, META_KEYS } from './db'
import type { AcademicState } from '../academicModel'
import { tagLegacyRecord } from '../academicModel'
import type { PersonalEvent, StudyExam } from '../calendarModel'
import type { LibraryFolder, LibraryItem } from '../libraryModel'
import { loadLibraryFolders, loadLibraryItems } from '../libraryModel'
import type { UserSettings } from '../profileModel'
import { loadUserSettings } from '../profileModel'
import type { ScheduleEntry } from '../scheduleModel'
import type { StudyTask } from '../taskModel'
import { buildNotifications, loadReadIds } from '../notificationModel'
import type { Flashcard, FocusSession, FocusSettings, FocusTimer, StudyDeck } from '../studyHubModel'
import { defaultFocusSettings, isCards, isDecks, isSessions, isTimer, readSaved, studyHubStorage, validSettings } from '../studyHubModel'
import type { PdfStudyData } from '../pdfReaderModel'
import { studyPrefix } from '../pdfReaderModel'
// studyPrefix defined in pdfReaderModel

const coreMigrationKey = META_KEYS.migration
export const studyMigrationKey = 'migration:study:v1'
export const pdfMigrationKey = 'migration:pdf:v1'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readLegacyExtras(prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        const value = localStorage.getItem(key)
        if (value !== null) out[key] = value
      }
    }
  } catch { /* ignore */ }
  return out
}

export type StudyFlowSnapshot = {
  tasks: StudyTask[]
  academics: AcademicState
  schedule: ScheduleEntry[]
  exams: StudyExam[]
  events: PersonalEvent[]
  libraryItems: LibraryItem[]
  libraryFolders: LibraryFolder[]
  userSettings: UserSettings
  readNotificationIds: string[]
}

export async function initializeStudyFlowData(): Promise<{ snapshot: StudyFlowSnapshot; fallback: boolean }> {
  const alreadyMigrated = await db.meta.get(coreMigrationKey)

  if (alreadyMigrated) {
    const [tasks, academics, schedule, exams, events, libraryItems, libraryFolders, userSettings, readNotificationIds] = await Promise.all([
      db.tasks.toArray(),
      db.meta.get(META_KEYS.academics).then(r => r?.value as AcademicState),
      db.schedule.toArray(),
      db.exams.toArray(),
      db.events.toArray(),
      db.libraryItems.toArray(),
      db.libraryFolders.toArray(),
      db.meta.get(META_KEYS.userSettings).then(r => r?.value as UserSettings),
      db.meta.get(META_KEYS.readNotificationIds).then(r => (r?.value as string[]) || []),
    ])

    return {
      snapshot: {
        tasks: tasks.length ? tasks : [],
        academics,
        schedule,
        exams,
        events,
        libraryItems,
        libraryFolders,
        userSettings,
        readNotificationIds,
      },
      fallback: false,
    }
  }

  let fallback = false
  const tasks: StudyTask[] = []
  let academics: any = safeParse(localStorage.getItem('studyflow-academics-v1'), null)
  const schedule: ScheduleEntry[] = []
  const exams: StudyExam[] = []
  const events: PersonalEvent[] = []
  const libraryItems: LibraryItem[] = loadLibraryItems()
  const libraryFolders: LibraryFolder[] = loadLibraryFolders()
  const userSettings: UserSettings = loadUserSettings()
  const readNotificationIds: string[] = loadReadIds()
  if (!academics) {
    academics = { version: 1, academicYear: '2026–2027', activeSemesterId: 'semester-1', semesters: [
      { id: 'semester-1', number: 1, settings: { name: 'Semestrul I · 2026–2027', startDate: '', endDate: '', academicYearEndDate: '', vacations: [] } },
      { id: 'semester-2', number: 2, settings: { name: 'Semestrul II · 2026–2027', startDate: '', endDate: '', academicYearEndDate: '', vacations: [] } },
    ], subjects: [] }
  }

  try {
    const savedTasks = safeParse<unknown>(localStorage.getItem('studyflow-tasks-v1'), [])
    if (Array.isArray(savedTasks)) {
      for (const t of savedTasks) {
        if (t && typeof t === 'object' && typeof (t as StudyTask).id === 'number' && typeof (t as StudyTask).title === 'string') {
          tasks.push(tagLegacyRecord(t as StudyTask, academics))
        }
      }
    }
  } catch { fallback = true }

  try {
    const savedSchedule = safeParse<unknown>(localStorage.getItem('studyflow-schedule-v1'), [])
    if (Array.isArray(savedSchedule)) {
      for (const e of savedSchedule) {
        if (e && typeof e === 'object' && typeof (e as ScheduleEntry).id === 'string' && typeof (e as ScheduleEntry).startTime === 'string') {
          schedule.push(tagLegacyRecord(e as ScheduleEntry, academics))
        }
      }
    }
  } catch { fallback = true }

  try {
    const savedExams = safeParse<unknown>(localStorage.getItem('studyflow-exams-v1'), [])
    if (Array.isArray(savedExams)) {
      for (const x of savedExams) {
        if (x && typeof x === 'object' && typeof (x as StudyExam).id === 'string' && typeof (x as StudyExam).subject === 'string' && typeof (x as StudyExam).date === 'string') {
          exams.push(tagLegacyRecord(x as StudyExam, academics))
        }
      }
    }
  } catch { fallback = true }

  try {
    const savedEvents = safeParse<unknown>(localStorage.getItem('studyflow-events-v1'), [])
    if (Array.isArray(savedEvents)) {
      for (const ev of savedEvents) {
        if (ev && typeof ev === 'object' && typeof (ev as PersonalEvent).id === 'string' && typeof (ev as PersonalEvent).title === 'string' && typeof (ev as PersonalEvent).date === 'string') {
          events.push(ev as PersonalEvent)
        }
      }
    }
  } catch { fallback = true }

  await (db as any).transaction('rw', db.tasks, db.schedule, db.exams, db.events, db.libraryItems, db.libraryFolders, db.meta, async () => {
    if (tasks.length) await db.tasks.bulkPut(tasks as any)
    if (schedule.length) await db.schedule.bulkPut(schedule as any)
    if (exams.length) await db.exams.bulkPut(exams as any)
    if (events.length) await db.events.bulkPut(events as any)
    if (libraryItems.length) await db.libraryItems.bulkPut(libraryItems as any)
    if (libraryFolders.length) await db.libraryFolders.bulkPut(libraryFolders as any)
    await db.meta.put({ key: META_KEYS.academics, value: academics as any })
    await db.meta.put({ key: META_KEYS.userSettings, value: userSettings as any })
    await db.meta.put({ key: META_KEYS.readNotificationIds, value: readNotificationIds.slice(-1000) as any })
    await db.meta.put({ key: coreMigrationKey, value: { version: 1, migratedAt: new Date().toISOString() } as any })
  })

  return {
    snapshot: { tasks, academics, schedule, exams, events, libraryItems, libraryFolders, userSettings, readNotificationIds },
    fallback,
  }
}

export async function initializeStudyHubData(): Promise<{
  decks: StudyDeck[]
  cards: Flashcard[]
  sessions: FocusSession[]
  settings: FocusSettings
  timer: FocusTimer
  migrated: boolean
}> {
  const migrated = await db.meta.get(studyMigrationKey)
  if (migrated) {
    const [decks, cards, sessions, settings, timer] = await Promise.all([
      db.decks.toArray(),
      db.cards.toArray(),
      db.focusSessions.toArray(),
      db.meta.get(META_KEYS.studySettings).then(r => r?.value as FocusSettings | undefined),
      db.meta.get(META_KEYS.studyTimer).then(r => r?.value as FocusTimer | undefined),
    ])
    return {
      decks,
      cards,
      sessions,
      settings: settings ? validSettings(settings) : defaultFocusSettings,
      timer: timer && isTimer(timer) ? timer : (await import('../studyHubModel')).createFocusTimer(settings ? validSettings(settings) : defaultFocusSettings),
      migrated: false,
    }
  }

  const decks = readSaved(studyHubStorage.decks, [], isDecks)
  const cards = readSaved(studyHubStorage.cards, [], isCards)
  const sessions = readSaved(studyHubStorage.focusSessions, [], isSessions)
  const settings = validSettings(readSaved(studyHubStorage.focusSettings, defaultFocusSettings, (v): v is FocusSettings => !!v && typeof v === 'object'))
  const timer = readSaved(studyHubStorage.focusTimer, (await import('../studyHubModel')).createFocusTimer(settings), isTimer)

  await db.transaction('rw', db.decks, db.cards, db.focusSessions, db.meta, async () => {
    if (decks.length) await db.decks.bulkPut(decks)
    if (cards.length) await db.cards.bulkPut(cards)
    if (sessions.length) await db.focusSessions.bulkPut(sessions)
    await db.meta.put({ key: META_KEYS.studySettings, value: settings })
    await db.meta.put({ key: META_KEYS.studyTimer, value: timer })
    await db.meta.put({ key: studyMigrationKey, value: { version: 1, migratedAt: new Date().toISOString() } })
  })

  return { decks, cards, sessions, settings, timer, migrated: true }
}

export async function initializePdfNotesData(): Promise<{ notes: PdfStudyData[]; migrated: boolean }> {
  const migrated = await db.meta.get(pdfMigrationKey)
  if (migrated) {
    const notes = await db.pdfNotes.toArray() as any[]
    return { notes: notes as PdfStudyData[], migrated: false }
  }

  const extras = readLegacyExtras(studyPrefix)
  const notes: any[] = []
  for (const [key, value] of Object.entries(extras)) {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        const id = (parsed as any).id || key.replace(studyPrefix, '')
        notes.push({ ...parsed, id })
      }
    } catch { /* ignore */ }
  }

  await db.transaction('rw', db.pdfNotes, db.meta, async () => {
    if (notes.length) await db.pdfNotes.bulkPut(notes as any)
    await db.meta.put({ key: pdfMigrationKey, value: { version: 1, migratedAt: new Date().toISOString() } as any })
  })

  return { notes: notes as PdfStudyData[], migrated: true }
}

export async function loadSnapshot() {
  const { snapshot } = await initializeStudyFlowData()
  return snapshot
}

export async function migrateLegacyData(force = false) {
  if (force) {
    try { await db.delete() } catch {}
    try { await db.open() } catch {}
    await db.open()
  }
  const already = await db.meta.get(coreMigrationKey)
  const result = await initializeStudyFlowData()
  try { await initializeStudyHubData() } catch {}
  try { await initializePdfNotesData() } catch {}
  if (already) {
    const snapshot = await loadSnapshot()
    return { migrated: false, fallback: result.fallback, snapshot }
  }
  return { migrated: true, fallback: result.fallback, snapshot: result.snapshot }
}
