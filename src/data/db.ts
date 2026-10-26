import Dexie, { type IndexableType, type Table } from 'dexie'
import type { AcademicState } from '../academicModel'
import type { PersonalEvent, StudyExam } from '../calendarModel'
import type { LibraryFolder, LibraryItem } from '../libraryModel'
import type { UserSettings } from '../profileModel'
import type { ScheduleEntry } from '../scheduleModel'
import type { StudyTask } from '../taskModel'
import type { Flashcard, FocusSession, FocusSettings, FocusTimer, StudyDeck } from '../studyHubModel'
import type { PdfStudyData } from '../pdfReaderModel'

export type MetaRecord = { key: string; value: unknown }
export type StoredFile = { id: string; blob: Blob }

export type CoreSnapshot = {
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

export const META_KEYS = {
  academics: 'academics',
  userSettings: 'userSettings',
  readNotificationIds: 'readNotificationIds',
  migration: 'migration:core:v1',
  studySettings: 'studyHub:settings',
  studyTimer: 'studyHub:timer',
} as const

class StudyFlowDatabase extends Dexie {
  meta!: Table<MetaRecord, string>
  tasks!: Table<StudyTask, number>
  schedule!: Table<ScheduleEntry, string>
  exams!: Table<StudyExam, string>
  events!: Table<PersonalEvent, string>
  libraryItems!: Table<LibraryItem, string>
  libraryFolders!: Table<LibraryFolder, string>
  files!: Table<StoredFile, string>
  decks!: Table<StudyDeck, string>
  cards!: Table<Flashcard, string>
  focusSessions!: Table<FocusSession, string>
  pdfNotes!: Table<PdfStudyData, string>

  constructor() {
    super('studyflow-v2')
    this.version(1).stores({
      meta: 'key',
      tasks: 'id, dueDate, done, status, semesterId, subjectId',
      schedule: 'id, semesterId, weekday',
      exams: 'id, date, semesterId',
      events: 'id, date',
      libraryItems: 'id, semesterId, subjectId, folderId, updatedAt',
      libraryFolders: 'id, semesterId, subjectId',
      files: 'id',
    })
    this.version(2)
      .stores({
        meta: 'key',
        tasks: 'id, dueDate, done, status, semesterId, subjectId',
        schedule: 'id, semesterId, weekday',
        exams: 'id, date, semesterId',
        events: 'id, date',
        libraryItems: 'id, semesterId, subjectId, folderId, updatedAt',
        libraryFolders: 'id, semesterId, subjectId',
        files: 'id',
        decks: 'id, subjectId, semesterId',
        cards: 'id, deckId, dueDate',
        focusSessions: 'id, endedAt, subjectId',
        pdfNotes: 'id',
      })
      .upgrade(async () => {
        // data migrated via initializeStudyFlowData/additive migration
      })
  }
}

export const db = new StudyFlowDatabase()

const writeQueues = new Map<Table<unknown, IndexableType>, Promise<void>>()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const record = await db.meta.get(key)
  return record ? (record.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export function replaceTable<T, K extends IndexableType>(table: Table<T, K>, rows: T[]): Promise<void> {
  const queueKey = table as unknown as Table<unknown, IndexableType>
  const queue = writeQueues.get(queueKey) ?? Promise.resolve()
  const next = queue
    .catch(() => undefined)
    .then(async () => {
      const copy = [...rows]
      await db.transaction('rw', table, async () => {
        await table.clear()
        if (copy.length) await table.bulkPut(copy)
      })
    })
  writeQueues.set(queueKey, next)
  return next
}

export function saveLibraryItems(items: LibraryItem[]): Promise<void> {
  return replaceTable(db.libraryItems, items)
}

export function saveLibraryFolders(folders: LibraryFolder[]): Promise<void> {
  return replaceTable(db.libraryFolders, folders)
}

export function saveTasks(tasks: StudyTask[]): Promise<void> {
  return replaceTable(db.tasks, tasks)
}

export function saveSchedule(entries: ScheduleEntry[]): Promise<void> {
  return replaceTable(db.schedule, entries)
}

export function saveExams(exams: StudyExam[]): Promise<void> {
  return replaceTable(db.exams, exams)
}

export function saveEvents(events: PersonalEvent[]): Promise<void> {
  return replaceTable(db.events, events)
}

export function saveDecks(decks: StudyDeck[]): Promise<void> {
  return replaceTable(db.decks, decks)
}

export function saveCards(cards: Flashcard[]): Promise<void> {
  return replaceTable(db.cards, cards)
}

export function saveFocusSessions(sessions: FocusSession[]): Promise<void> {
  return replaceTable(db.focusSessions, sessions)
}

export function savePdfNotes(data: PdfStudyData[]): Promise<void> {
  return replaceTable(db.pdfNotes, data)
}
