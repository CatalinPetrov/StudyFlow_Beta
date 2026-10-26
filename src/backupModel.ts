import type { AcademicState } from './academicModel'
import type { PersonalEvent, StudyExam } from './calendarModel'
import { db, META_KEYS, saveEvents, saveExams, saveLibraryFolders, saveLibraryItems, saveSchedule, saveTasks, setMeta, type CoreSnapshot } from './data/db'
import { loadSnapshot, migrateLegacyData } from './data/migration'
import { getLibraryBlob, saveLibraryBlob, type LibraryFolder, type LibraryItem } from './libraryModel'
import { cleanSettings } from './profileModel'
import type { ScheduleEntry } from './scheduleModel'
import type { StudyTask } from './taskModel'

type StoredFile={id:string;type:string;chunks:string[]}
type LegacyBackup={format:'studyflow-prototype-backup';version:1;createdAt:string;storage:Record<string,string>;files:StoredFile[]}
type StudyBackup={format:'studyflow-backup';version:2;createdAt:string;core:CoreSnapshot;extras:Record<string,string>;files:StoredFile[]}
const prefix='studyflow-'
const segmentSize=12288
const maxBytes=80*1024*1024
const coreKeys=new Set([
  'studyflow-tasks-v1','studyflow-academic-v1','studyflow-semester-v1','studyflow-schedule-v1',
  'studyflow-exams-v1','studyflow-events-v1','studyflow-library-v1','studyflow-library-folders-v1',
  'studyflow-user-settings-v1','studyflow-notifications-read-v1',
])

function serializeBlob(blob:Blob):Promise<string[]> {
  return blob.arrayBuffer().then(buffer=>{
    const bytes=new Uint8Array(buffer),chunks:string[]=[]
    for(let pos=0;pos<bytes.length;pos+=segmentSize)
      chunks.push(btoa(String.fromCharCode(...bytes.subarray(pos,pos+segmentSize))))
    return chunks
  })
}
function download(content:string,name:string){
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}))
  const link=document.createElement('a');link.href=url;link.download=name
  document.body.appendChild(link);link.click();link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),60000)
}
export async function exportStudyBackup():Promise<number>{
  const core=await loadSnapshot()
  const extras:Record<string,string>={}
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i)
    if(key?.startsWith(prefix)&&!coreKeys.has(key)){const value=localStorage.getItem(key);if(value!==null)extras[key]=value}
  }
  const files:StoredFile[]=[]
  let totalBytes=0
  for(const item of core.libraryItems.filter(item=>item.kind==='file')){
    const blob=await getLibraryBlob(item.id)
    if(!blob)throw new Error(`Fișierul „${item.title}” nu se mai află în stocarea browserului. Backupul complet nu a fost creat.`)
    totalBytes+=blob.size
    if(totalBytes>maxBytes)throw new Error('Fișierele depășesc 80 MB. Păstrează originalele și împarte biblioteca în backupuri mai mici înainte de export.')
    files.push({id:item.id,type:blob.type,chunks:await serializeBlob(blob)})
  }
  const payload:StudyBackup={format:'studyflow-backup',version:2,createdAt:new Date().toISOString(),core,extras,files}
  const stamp=new Date().toISOString().slice(0,10)
  download(JSON.stringify(payload),`StudyFlow-backup-${stamp}.json`)
  return files.length
}
function validLegacyBackup(value:unknown):value is LegacyBackup {
  if(!value||typeof value!=='object')return false
  const b=value as Partial<LegacyBackup>
  if(b.format!=='studyflow-prototype-backup'||b.version!==1||!b.storage||typeof b.storage!=='object'||Array.isArray(b.storage)||!Array.isArray(b.files))return false
  if(Object.entries(b.storage).some(([k,v])=>!k.startsWith(prefix)||typeof v!=='string'))return false
  return b.files.every(f=>f&&typeof f.id==='string'&&typeof f.type==='string'&&Array.isArray(f.chunks)&&f.chunks.every(x=>typeof x==='string'&&/^[a-zA-Z0-9+/]*={0,2}$/.test(x)))
}
function isRecord(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value)
}
function isTask(value:unknown):value is StudyTask {
  const x=value as Partial<StudyTask>|null
  return isRecord(value)&&typeof x?.id==='number'&&typeof x.title==='string'&&typeof x.done==='boolean'
}
function isSchedule(value:unknown):value is ScheduleEntry {
  const x=value as Partial<ScheduleEntry>|null
  return isRecord(value)&&typeof x?.id==='string'&&typeof x.subject==='string'&&typeof x.startTime==='string'
}
function isExam(value:unknown):value is StudyExam {
  const x=value as Partial<StudyExam>|null
  return isRecord(value)&&typeof x?.id==='string'&&typeof x.subject==='string'&&typeof x.date==='string'
}
function isEvent(value:unknown):value is PersonalEvent {
  const x=value as Partial<PersonalEvent>|null
  return isRecord(value)&&typeof x?.id==='string'&&typeof x.title==='string'&&typeof x.date==='string'
}
function isLibraryItem(value:unknown):value is LibraryItem {
  const x=value as Partial<LibraryItem>|null
  return isRecord(value)&&typeof x?.id==='string'&&typeof x.title==='string'&&typeof x.kind==='string'
}
function isLibraryFolder(value:unknown):value is LibraryFolder {
  const x=value as Partial<LibraryFolder>|null
  return isRecord(value)&&typeof x?.id==='string'&&typeof x.name==='string'&&typeof x.subjectId==='string'
}
function validCore(value:unknown):value is CoreSnapshot {
  if(!isRecord(value))return false
  const core=value as Partial<CoreSnapshot>
  const academics=core.academics as Partial<AcademicState>|undefined
  if(!academics||academics.version!==1||!Array.isArray(academics.semesters)||!Array.isArray(academics.subjects))return false
  return Array.isArray(core.tasks)&&core.tasks.every(isTask)
    &&Array.isArray(core.schedule)&&core.schedule.every(isSchedule)
    &&Array.isArray(core.exams)&&core.exams.every(isExam)
    &&Array.isArray(core.events)&&core.events.every(isEvent)
    &&Array.isArray(core.libraryItems)&&core.libraryItems.every(isLibraryItem)
    &&Array.isArray(core.libraryFolders)&&core.libraryFolders.every(isLibraryFolder)
    &&Array.isArray(core.readNotificationIds)&&core.readNotificationIds.every(x=>typeof x==='string')
    &&isRecord(core.userSettings)
}
function validBackup(value:unknown):value is StudyBackup {
  if(!value||typeof value!=='object')return false
  const b=value as Partial<StudyBackup>
  if(b.format!=='studyflow-backup'||b.version!==2||!validCore(b.core)||!isRecord(b.extras)||!Array.isArray(b.files))return false
  if(Object.entries(b.extras).some(([k,v])=>!k.startsWith(prefix)||typeof v!=='string'))return false
  return b.files.every(f=>f&&typeof f.id==='string'&&typeof f.type==='string'&&Array.isArray(f.chunks)&&f.chunks.every(x=>typeof x==='string'&&/^[a-zA-Z0-9+/]*={0,2}$/.test(x)))
}
function decodeFile(file:StoredFile):Blob{
  const chunks=file.chunks.map(x=>Uint8Array.from(atob(x),char=>char.charCodeAt(0)))
  return new Blob(chunks,{type:file.type})
}
async function writeCore(core:CoreSnapshot):Promise<void>{
  await Promise.all([
    saveTasks(core.tasks),saveSchedule(core.schedule),saveExams(core.exams),saveEvents(core.events),
    saveLibraryItems(core.libraryItems),saveLibraryFolders(core.libraryFolders),
    setMeta(META_KEYS.academics,core.academics),
    setMeta(META_KEYS.userSettings,cleanSettings(core.userSettings)),
    setMeta(META_KEYS.readNotificationIds,core.readNotificationIds.slice(-1000)),
    setMeta(META_KEYS.migration,{version:1,restoredAt:new Date().toISOString()}),
  ])
}
async function restoreLegacy(raw:LegacyBackup):Promise<number>{
  const expectedFiles:unknown=JSON.parse(raw.storage['studyflow-library-v1']||'[]')
  if(!Array.isArray(expectedFiles))throw new Error('Backupul nu conține o bibliotecă validă.')
  const requiredIds=expectedFiles.filter(x=>x&&x.kind==='file').map(x=>x.id)
  if(requiredIds.some(id=>typeof id!=='string'||!raw.files.some(f=>f.id===id)))throw new Error('Lipsesc fișierele din backup. Datele existente nu au fost schimbate.')
  const decoded=raw.files.map(f=>({id:f.id,blob:decodeFile(f)}))
  for(const [key,val] of Object.entries(raw.storage))localStorage.setItem(key,val)
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i)
    if(k?.startsWith(prefix)&&!(k in raw.storage))localStorage.removeItem(k)
  }
  await migrateLegacyData(true)
  for(const f of decoded)await saveLibraryBlob(f.id,f.blob)
  return decoded.length
}
export async function restoreStudyBackup(file:File):Promise<number>{
  if(file.size>maxBytes*1.5)throw new Error('Arhiva depășește dimensiunea acceptată.')
  let raw:unknown
  try{raw=JSON.parse(await file.text())}catch{throw new Error('Fișier JSON invalid.')}
  if(validLegacyBackup(raw))return restoreLegacy(raw)
  if(!validBackup(raw))throw new Error('Acesta nu este un backup StudyFlow compatibil.')
  const expectedFiles=raw.core.libraryItems.filter(item=>item.kind==='file')
  if(expectedFiles.some(item=>!raw.files.some(f=>f.id===item.id)))throw new Error('Lipsesc fișierele din backup. Datele existente nu au fost schimbate.')
  const decoded=raw.files.map(f=>({id:f.id,blob:decodeFile(f)}))
  await db.files.bulkPut(decoded)
  await writeCore(raw.core)
  const extras=raw.extras
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i)
    if(k?.startsWith(prefix)&&!coreKeys.has(k)&&!(k in extras))localStorage.removeItem(k)
  }
  for(const [key,val] of Object.entries(extras))localStorage.setItem(key,val)
  return decoded.length
}
