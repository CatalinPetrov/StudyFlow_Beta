import { accentFor, blankSemester, type SemesterSettings } from './scheduleModel'
import type { StudyTask } from './taskModel'
import type { ScheduleEntry } from './scheduleModel'
import type { StudyExam } from './calendarModel'

export type Subject = {
  id: string
  semesterId: string
  name: string
  professor: string
  color: string
  notes: string
  archived: boolean
}
export type AcademicSemester = {
  id: string
  number: 1 | 2
  settings: SemesterSettings
}
export type AcademicState = {
  version: 1
  academicYear: string
  activeSemesterId: string
  semesters: AcademicSemester[]
  subjects: Subject[]
}

const storageKey = 'studyflow-academic-v1'
const simpleId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
export const makeSubjectId = () => `materie-${simpleId()}`
export const normalizedSubject = (text: string) => text.trim().toLocaleLowerCase('ro-RO')
export function subjectMatches(record: {subject?: string;subjectId?: string;semesterId?: string}, subject: Subject) {
  if (record.subjectId) return record.subjectId === subject.id
  // Compatibilitate pentru înregistrări vechi, când nu exista identificatorul materiei.
  return (!record.semesterId || record.semesterId === subject.semesterId)
    && normalizedSubject(record.subject || '') === normalizedSubject(subject.name)
}
export const semesterName = (number: 1|2, year: string) => `Semestrul ${number===1?'I':'II'} · ${year}`

function readJSON<T>(key:string, fallback:T):T {
  try {const stored=localStorage.getItem(key);return stored?JSON.parse(stored) as T:fallback} catch {return fallback}
}
function compatibleAcademic(value: unknown): value is AcademicState {
  if (!value || typeof value !== 'object') return false
  const x = value as Partial<AcademicState>
  return x.version===1 && typeof x.activeSemesterId==='string' && typeof x.academicYear==='string'
    && Array.isArray(x.semesters) && x.semesters.length>0 && Array.isArray(x.subjects)
}
export function loadAcademicState(): AcademicState {
  const saved = readJSON<unknown>(storageKey,null)
  if (compatibleAcademic(saved)) return saved
  // Copia de siguranță se face înainte de migrare, fără a șterge cheile vechi.
  try {
    if (!localStorage.getItem('studyflow-legacy-backup-before-materii-v1')) {
      const keys=['studyflow-tasks-v1','studyflow-semester-v1','studyflow-schedule-v1','studyflow-exams-v1','studyflow-events-v1']
      localStorage.setItem('studyflow-legacy-backup-before-materii-v1',JSON.stringify(
        Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))))
    }
  } catch { /* Browserul poate bloca stocarea; nu oprim aplicația. */ }
  const legacySettings=readJSON<SemesterSettings>('studyflow-semester-v1', blankSemester)
  const currentYear=new Date().getFullYear()
  const year=legacySettings.name?.match(/\d{4}\s*[–-]\s*\d{4}/)?.[0]?.replace(/\s*/g,'') || `${currentYear}–${currentYear+1}`
  const guessedNumber: 1|2 = /Semestrul\s+II\b/i.test(legacySettings.name)?2:1
  const first:AcademicSemester={id:'semester-1',number:1,settings:guessedNumber===1?{...blankSemester,...legacySettings,name:legacySettings.name||semesterName(1,year)}:{...blankSemester,name:semesterName(1,year),academicYearEndDate:legacySettings.academicYearEndDate||''}}
  const second:AcademicSemester={id:'semester-2',number:2,settings:guessedNumber===2?{...blankSemester,...legacySettings,name:legacySettings.name||semesterName(2,year)}:{...blankSemester,name:semesterName(2,year),academicYearEndDate:legacySettings.academicYearEndDate||''}}
  const semesterId=guessedNumber===1?first.id:second.id
  const tasks=readJSON<StudyTask[]>('studyflow-tasks-v1',[])
  const classes=readJSON<ScheduleEntry[]>('studyflow-schedule-v1',[])
  const exams=readJSON<StudyExam[]>('studyflow-exams-v1',[])
  const names = new Map<string,string>()
  for (const item of [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(classes)?classes:[]),...(Array.isArray(exams)?exams:[])]) {
    if (!item || typeof item.subject !== 'string') continue
    const name=item.subject.trim()
    if (!name || normalizedSubject(name)==='general') continue
    if (!names.has(normalizedSubject(name))) names.set(normalizedSubject(name),name)
  }
  const subjects=[...names.values()].map(name=>({
    id:makeSubjectId(),semesterId,name,professor:classes.find(e=>normalizedSubject(e.subject)===normalizedSubject(name))?.professor||'',color:accentFor(name),notes:'',archived:false,
  }))
  return {version:1,academicYear:year,activeSemesterId:semesterId,semesters:[first,second],subjects}
}
export function tagLegacyRecord<T extends {subject:string;semesterId?:string;subjectId?:string}>(record:T, state:AcademicState):T {
  if (record.semesterId && record.subjectId) return record
  const semesterId=record.semesterId||state.activeSemesterId
  const found=state.subjects.find(s=>s.semesterId===semesterId&&normalizedSubject(s.name)===normalizedSubject(record.subject))
  return {...record,semesterId,subjectId:record.subjectId||found?.id}
}
export const academicStorageKey=storageKey
export function currentSemester(state:AcademicState): AcademicSemester {
  return state.semesters.find(s=>s.id===state.activeSemesterId) || state.semesters[0]
}
