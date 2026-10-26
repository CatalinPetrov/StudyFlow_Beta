/** Logica Orarului StudyFlow v1.0, independentă de React.
 * Săptămâna 1 începe în săptămâna (luni-duminică) care conține prima zi de cursuri.
 * O săptămână fără nicio zi de curs luni-vineri (vacanță integrală) nu se numără.
 * O vacanță parțială suspendă orele pe acele date, dar nu oprește numerotarea întregii săptămâni.
 */
export type ScheduleKind = 'Curs' | 'Seminar' | 'Laborator'
export type Recurrence = 'weekly' | 'odd' | 'even'
export type Vacation = { id: string; name: string; startDate: string; endDate: string }
export type SemesterSettings = {
  name: string
  startDate: string
  endDate: string
  /** Ultima zi a anului universitar, separată de sfârșitul semestrului. */
  academicYearEndDate?: string
  vacations: Vacation[]
}
export type ScheduleEntry = {
  id: string
  subject: string
  subjectId?: string
  semesterId?: string
  kind: ScheduleKind
  weekday: number // 0 = luni, 6 = duminică
  startTime: string
  endTime: string
  room: string
  professor: string
  recurrence: Recurrence
}

export const blankSemester: SemesterSettings = { name: 'Semestrul I · 2026–2027', startDate: '', endDate: '', academicYearEndDate: '', vacations: [] }
export const romanianDays = ['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică']
export const shortDays = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
export const recurrenceLabels: Record<Recurrence, string> = { weekly: 'Săptămânal', odd: 'Săpt. impară', even: 'Săpt. pară' }

export function dateFromKey(key: string): Date {
  const [y,m,d] = key.split('-').map(Number)
  return new Date(y, (m || 1)-1, d || 1)
}
export function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function monday(date: Date): Date {
  const value = new Date(date.getFullYear(),date.getMonth(),date.getDate())
  value.setDate(value.getDate() - ((value.getDay()+6)%7))
  return value
}
export function shiftedDay(date: Date, offset: number): Date {
  return new Date(date.getFullYear(),date.getMonth(),date.getDate()+offset)
}
export function weekday(date: Date): number { return (date.getDay()+6)%7 }
export function isConfigured(settings: SemesterSettings): boolean {
  return !!settings.startDate && !!settings.endDate && settings.startDate <= settings.endDate
}
export function inVacation(key: string, settings: SemesterSettings): Vacation | undefined {
  return settings.vacations.find(v=>v.startDate<=key && key<=v.endDate)
}
function teachingDaysInWeek(weekStart: Date, settings: SemesterSettings): boolean {
  for (let day=0; day<5;day++) {
    const key = keyOf(shiftedDay(weekStart,day))
    if (key>=settings.startDate && key<=settings.endDate && !inVacation(key,settings)) return true
  }
  return false
}
export type WeekInfo = { number: number | null; parity: 'odd'|'even'|null; vacation: boolean; withinSemester: boolean; teachingDay: boolean }
export function weekInfo(date: Date, settings: SemesterSettings): WeekInfo {
  const key = keyOf(date)
  const withinSemester = isConfigured(settings) && key>=settings.startDate && key<=settings.endDate
  const vacation = !!inVacation(key,settings)
  if (!withinSemester) return {number:null,parity:null,vacation:false,withinSemester:false,teachingDay:false}
  const firstMonday = monday(dateFromKey(settings.startDate))
  const currentMonday = monday(date)
  let count=0
  let currentWeekCounts=false
  // Prevent invalid inputs from causing an unbounded computation.
  for (let cursor=new Date(firstMonday), i=0;cursor<=currentMonday && i<540;i++,cursor=shiftedDay(cursor,7)) {
    const active = teachingDaysInWeek(cursor,settings)
    if (active) count++
    if (keyOf(cursor)===keyOf(currentMonday)) currentWeekCounts=active
  }
  const number = currentWeekCounts ? count : null
  return { number, parity:number ? (number%2?'odd':'even') : null, vacation, withinSemester, teachingDay:currentWeekCounts && !vacation }
}
export function occursOn(entry: ScheduleEntry, day: Date, settings: SemesterSettings): boolean {
  const info = weekInfo(day,settings)
  if (!info.teachingDay || weekday(day)!==entry.weekday) return false
  return entry.recurrence==='weekly' || (entry.recurrence==='odd' && info.parity==='odd') || (entry.recurrence==='even' && info.parity==='even')
}
export function todayEntries(entries: ScheduleEntry[], day: Date, settings: SemesterSettings): ScheduleEntry[] {
  return entries.filter(entry=>occursOn(entry,day,settings)).sort((a,b)=>a.startTime.localeCompare(b.startTime))
}
export function accentFor(subject: string): string {
  const colors=['#0071e3','#8b5cf6','#16a085','#ed8936','#e26d89','#4386b8']
  let seed=0
  for (let i=0;i<subject.length;i++) seed=(seed*31+subject.charCodeAt(i))|0
  return colors[Math.abs(seed)%colors.length]
}
export function conflicts(candidate: ScheduleEntry, other: ScheduleEntry): boolean {
  if (candidate.id===other.id || candidate.weekday!==other.weekday) return false
  if (candidate.startTime>=other.endTime || candidate.endTime<=other.startTime) return false
  if (candidate.recurrence==='weekly' || other.recurrence==='weekly') return true
  return candidate.recurrence===other.recurrence
}
