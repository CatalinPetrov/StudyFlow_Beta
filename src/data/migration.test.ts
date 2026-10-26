import { describe, expect, it } from 'vitest'
import { academicStorageKey, type AcademicState } from '../academicModel'
import { blankSemester } from '../scheduleModel'
import type { StudyTask } from '../taskModel'
import { db, META_KEYS, saveTasks } from './db'
import { loadSnapshot, migrateLegacyData } from './migration'

const academic: AcademicState = {
  version: 1,
  academicYear: '2026–2027',
  activeSemesterId: 'semester-1',
  semesters: [
    { id: 'semester-1', number: 1, settings: { ...blankSemester, name: 'Semestrul I · 2026–2027' } },
    { id: 'semester-2', number: 2, settings: { ...blankSemester, name: 'Semestrul II · 2026–2027' } },
  ],
  subjects: [
    {
      id: 'subject-algorithms',
      semesterId: 'semester-1',
      name: 'Algoritmi',
      professor: 'Prof. Popescu',
      color: '#0071e3',
      notes: '',
      archived: false,
    },
  ],
}

const tasks: StudyTask[] = [
  {
    id: 7,
    title: 'Laborator 3',
    subject: 'Algoritmi',
    subjectId: 'subject-algorithms',
    semesterId: 'semester-1',
    dueDate: '2026-11-02',
    done: false,
    priority: 'high',
    status: 'todo',
  },
]

function seedLegacyStorage() {
  localStorage.setItem(academicStorageKey, JSON.stringify(academic))
  localStorage.setItem('studyflow-tasks-v1', JSON.stringify(tasks))
  localStorage.setItem('studyflow-schedule-v1', JSON.stringify([
    {
      id: 'class-1',
      subject: 'Algoritmi',
      subjectId: 'subject-algorithms',
      semesterId: 'semester-1',
      kind: 'Curs',
      weekday: 1,
      startTime: '08:00',
      endTime: '10:00',
      room: 'A101',
      professor: 'Prof. Popescu',
      recurrence: 'weekly',
    },
  ]))
  localStorage.setItem('studyflow-exams-v1', JSON.stringify([
    {
      id: 'exam-1',
      subject: 'Algoritmi',
      subjectId: 'subject-algorithms',
      semesterId: 'semester-1',
      title: 'Examen final',
      date: '2027-01-20',
      time: '10:00',
      room: 'A101',
      kind: 'Scris',
      notes: '',
    },
  ]))
  localStorage.setItem('studyflow-events-v1', JSON.stringify([
    { id: 'event-1', title: 'Întâlnire proiect', date: '2026-11-05', time: '18:00', location: 'Online', notes: '' },
  ]))
  localStorage.setItem('studyflow-library-v1', JSON.stringify([
    {
      id: 'material-1',
      kind: 'note',
      title: 'Notițe curs',
      semesterId: 'semester-1',
      subjectId: 'subject-algorithms',
      category: 'Curs',
      tags: ['sortare'],
      favorite: false,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      content: 'Merge sort',
    },
  ]))
  localStorage.setItem('studyflow-library-folders-v1', JSON.stringify([
    {
      id: 'folder-1',
      name: 'Cursuri',
      semesterId: 'semester-1',
      subjectId: 'subject-algorithms',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
  ]))
  localStorage.setItem('studyflow-user-settings-v1', JSON.stringify({
    profile: { name: 'Ana', university: 'UBB', faculty: 'Informatică', specialization: 'Info', studyYear: 2 },
    notifications: { taskDeadlines: true, exams: false },
  }))
  localStorage.setItem('studyflow-notifications-read-v1', JSON.stringify(['task:7:2026-11-02']))
  localStorage.setItem('studyflow-notifications-read-v1-extra', 'păstrat')
}

describe('migrarea datelor StudyFlow v1 -> v2', () => {
  it('mută datele în Dexie fără să șteargă cheile vechi', async () => {
    seedLegacyStorage()
    const result = await migrateLegacyData()

    expect(result.migrated).toBe(true)
    expect(await db.tasks.count()).toBe(1)
    expect(await db.schedule.count()).toBe(1)
    expect(await db.exams.count()).toBe(1)
    expect(await db.events.count()).toBe(1)
    expect(await db.libraryItems.count()).toBe(1)
    expect(await db.libraryFolders.count()).toBe(1)

    const snapshot = await loadSnapshot()
    expect(snapshot.academics.activeSemesterId).toBe('semester-1')
    expect(snapshot.tasks[0]?.title).toBe('Laborator 3')
    expect(snapshot.libraryItems[0]?.content).toBe('Merge sort')
    expect(snapshot.userSettings.profile.name).toBe('Ana')
    expect(snapshot.userSettings.notifications.exams).toBe(false)
    expect(snapshot.readNotificationIds).toEqual(['task:7:2026-11-02'])

    expect(localStorage.getItem('studyflow-tasks-v1')).toBeTruthy()
    expect(localStorage.getItem(academicStorageKey)).toBeTruthy()
    expect(localStorage.getItem('studyflow-notifications-read-v1')).toBeTruthy()
    expect(localStorage.getItem('studyflow-notifications-read-v1-extra')).toBe('păstrat')
    expect(await db.meta.get(META_KEYS.migration)).toBeTruthy()
  })

  it('este idempotentă și nu suprascrie datele după prima rulare', async () => {
    seedLegacyStorage()
    await migrateLegacyData()
    localStorage.setItem('studyflow-tasks-v1', JSON.stringify([]))

    const second = await migrateLegacyData()
    expect(second.migrated).toBe(false)
    expect(await db.tasks.count()).toBe(1)
  })

  it('creează o stare academică implicită pentru o instalare nouă', async () => {
    const result = await migrateLegacyData()
    expect(result.migrated).toBe(true)
    const snapshot = await loadSnapshot()
    expect(snapshot.academics.version).toBe(1)
    expect(snapshot.academics.semesters.length).toBeGreaterThanOrEqual(2)
    expect(snapshot.tasks).toEqual([])
    expect(snapshot.libraryItems).toEqual([])
    expect(snapshot.userSettings.profile.name).toBe('Student')
  })

  it('înlocuiește integral un tabel la salvare', async () => {
    await saveTasks(tasks)
    await saveTasks([{ ...tasks[0]!, id: 8, title: 'Temă nouă' }])
    const saved = await db.tasks.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.id).toBe(8)
  })

  it('ignoră înregistrările invalide din stocarea veche', async () => {
    seedLegacyStorage()
    localStorage.setItem('studyflow-tasks-v1', JSON.stringify([...tasks, { id: 'invalid', title: 'X' }, null]))
    await migrateLegacyData()
    expect(await db.tasks.count()).toBe(1)
  })
})
