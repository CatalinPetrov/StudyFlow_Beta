/** Modelele pentru Calendar. Taskurile și orele provin direct din modelele existente. */
import type { StudyTask } from './taskModel'
import type { ScheduleEntry, SemesterSettings } from './scheduleModel'
import { dateFromKey, keyOf, occursOn } from './scheduleModel'

export type ExamKind = 'Scris' | 'Oral' | 'Practic' | 'Colocviu' | 'Altul'
export type StudyExam = {
  id: string
  subject: string
  subjectId?: string
  semesterId?: string
  title: string
  date: string // YYYY-MM-DD
  time: string // HH:mm sau ''
  room: string
  kind: ExamKind
  notes: string
}
export type PersonalEvent = {
  id: string
  title: string
  date: string
  time: string
  location: string
  notes: string
}
export type CalendarCategory = 'task' | 'exam' | 'class' | 'event'
export type CalendarItem = {
  id: string
  sourceId: string | number
  category: CalendarCategory
  date: string
  time: string
  title: string
  subtitle: string
  completed?: boolean
}
export const calendarColors: Record<CalendarCategory, string> = {
  task: '#2378e8', exam: '#e35359', class: '#13a58d', event: '#ed9a33',
}
export const calendarLabels: Record<CalendarCategory, string> = {
  task: 'Taskuri', exam: 'Examene', class: 'Cursuri', event: 'Evenimente',
}
export function daysInMonth(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))
}
export function eventsForMonth(
  month: Date,
  tasks: StudyTask[],
  exams: StudyExam[],
  events: PersonalEvent[],
  schedule: ScheduleEntry[],
  settings: SemesterSettings,
  settingsBySemester?: Record<string,SemesterSettings>,
): CalendarItem[] {
  const firstKey = keyOf(new Date(month.getFullYear(), month.getMonth(), 1))
  const lastKey = keyOf(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const result: CalendarItem[] = []
  for (const t of tasks) {
    if (!t.dueDate || t.dueDate < firstKey || t.dueDate > lastKey) continue
    result.push({ id: `task-${t.id}`, sourceId: t.id, category: 'task', date: t.dueDate,
      time: t.dueTime || '', title: t.title, subtitle: t.subject || 'General', completed: t.done })
  }
  for (const x of exams) {
    if (x.date < firstKey || x.date > lastKey) continue
    result.push({ id: `exam-${x.id}`, sourceId: x.id, category: 'exam', date: x.date,
      time: x.time, title: x.subject, subtitle: `${x.title || 'Examen'}${x.room ? ' · ' + x.room : ''}` })
  }
  for (const e of events) {
    if (e.date < firstKey || e.date > lastKey) continue
    result.push({ id: `event-${e.id}`, sourceId: e.id, category: 'event', date: e.date,
      time: e.time, title: e.title, subtitle: e.location || 'Eveniment' })
  }
  for (const day of daysInMonth(month)) {
    for (const c of schedule) {
      if (!occursOn(c, day, c.semesterId ? (settingsBySemester?.[c.semesterId] ?? settings) : settings)) continue
      result.push({ id: `class-${c.id}-${keyOf(day)}`, sourceId: c.id, category: 'class',
        date: keyOf(day), time: c.startTime, title: c.subject, subtitle: `${c.kind} · ${c.room || 'Sală nespecificată'}` })
    }
  }
  return result.sort((a,b) => a.date.localeCompare(b.date)
    || (a.time || '23:59').localeCompare(b.time || '23:59')
    || a.title.localeCompare(b.title, 'ro'))
}
export function upcomingExam(exams: StudyExam[], reference: Date): StudyExam | undefined {
  const now = reference.getTime()
  return exams.filter(x => {
    // Dacă ora nu este cunoscută, examenul rămâne „viitor” până la sfârșitul datei respective.
    const end = x.time ? new Date(`${x.date}T${x.time}:00`).getTime() : new Date(`${x.date}T23:59:59`).getTime()
    return Number.isFinite(end) && end >= now
  }).sort((a,b) => `${a.date}T${a.time || '23:59'}`.localeCompare(`${b.date}T${b.time || '23:59'}`))[0]
}
export const parseLocalDate = dateFromKey
export const toDateKey = keyOf
export const makeId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
