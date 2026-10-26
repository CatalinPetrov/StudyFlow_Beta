/** StudyFlow Library v1: metadata in localStorage, binary attachments in IndexedDB.
 * No files are uploaded to a server. The two stores are intentionally separate.
 */
export type LibraryKind = 'file' | 'note' | 'link'
export type LibraryCategory = 'Curs' | 'Laborator' | 'Seminar' | 'Temă' | 'General' | 'Notițe' | 'Exerciții' | 'Altele'
export const libraryCategories: LibraryCategory[] = ['Curs','Seminar','Laborator','Temă','General']
export type LibraryItem = {
  id: string
  kind: LibraryKind
  title: string
  semesterId: string
  subjectId?: string
  category: LibraryCategory
  folderId?: string
  taskId?: number
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  fileName?: string
  fileType?: string
  fileSize?: number
  url?: string
  content?: string
}
import { db } from './data/db'

const storageKey='studyflow-library-v1'
export const maxLibraryFileBytes=50*1024*1024 // A practical per-file guard; storage quota varies by browser.
export const libraryId=()=>`material-${typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}`
export const fileSizeLabel=(bytes=0)=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:bytes>=1024?`${Math.round(bytes/1024)} KB`:`${bytes} B`
export function validWebUrl(value:string):string|null {
  try {const link=new URL(value.trim());return ['http:','https:'].includes(link.protocol)?link.toString():null} catch {return null}
}
export function loadLibraryItems():LibraryItem[] {
  try {
    const data=JSON.parse(localStorage.getItem(storageKey)||'[]') as unknown
    if(!Array.isArray(data))return []
    return data.filter((v):v is LibraryItem=>Boolean(v&&typeof v==='object'&&typeof v.id==='string'&&typeof v.title==='string'&&['file','note','link'].includes(v.kind)&&typeof v.semesterId==='string'))
  }catch{return []}
}
export function persistLibraryItems(items:LibraryItem[]):boolean {
  try{localStorage.setItem(storageKey,JSON.stringify(items));return true}catch{return false}
}
export async function saveLibraryBlob(id:string,blob:Blob):Promise<void>{
  if(blob.size>maxLibraryFileBytes)throw new Error('Fișierul depășește limita de 50 MB pentru această versiune.')
  await db.files.put({id,blob})
}
export async function getLibraryBlob(id:string):Promise<Blob|undefined>{
  const file=await db.files.get(id)
  return file?.blob instanceof Blob ? file.blob : undefined
}
export async function deleteLibraryBlob(id:string):Promise<void>{
  await db.files.delete(id)
}
export function tagsFromText(raw:string):string[]{
  const seen=new Set<string>()
  const tags:string[]=[]
  for(const value of raw.split(',')){
    const tag=value.trim().slice(0,26)
    const key=tag.toLocaleLowerCase('ro-RO')
    if(!tag||seen.has(key))continue
    seen.add(key);tags.push(tag)
    if(tags.length===10)break
  }
  return tags
}

/** Library v1.1: a virtual hierarchy. Files remain keyed by id in IndexedDB.
 * Existing library-v1 items remain compatible; no destructive migration.
 */
export type LibrarySection = 'curs' | 'seminar' | 'laborator' | 'teme' | 'general'
export const librarySections: { id: LibrarySection; label: string; singular: LibraryCategory; color: string }[] = [
  { id:'curs', label:'Cursuri', singular:'Curs', color:'#3478ed' },
  { id:'seminar', label:'Seminare', singular:'Seminar', color:'#9067df' },
  { id:'laborator', label:'Laboratoare', singular:'Laborator', color:'#16a085' },
  { id:'teme', label:'Teme', singular:'Temă', color:'#eb9a35' },
  { id:'general', label:'Generale', singular:'General', color:'#77859b' },
]
export function sectionForCategory(category:LibraryCategory):LibrarySection {
  if(category==='Curs')return 'curs'
  if(category==='Seminar')return 'seminar'
  if(category==='Laborator')return 'laborator'
  if(category==='Temă')return 'teme'
  return 'general' // v1: Notițe, Exerciții, Altele -> Generale; none are removed.
}
export function suggestCategory(filename:string):LibraryCategory|null {
  const cleaned=filename.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO')
  if(/(^|[^a-z])(tema|teme|homework|assignment)(?=[^a-z]|$)/.test(cleaned))return 'Temă'
  if(/(^|[^a-z])(lab|laborator|laboratoare)(?=[^a-z]|$)/.test(cleaned))return 'Laborator'
  if(/(^|[^a-z])(sem|seminar|seminare)(?=[^a-z]|$)/.test(cleaned))return 'Seminar'
  if(/(^|[^a-z])(curs|lecture|lectie)(?=[^a-z]|$)/.test(cleaned))return 'Curs'
  return null
}
export type LibraryFolder = {
  id: string
  name: string
  semesterId: string
  subjectId: string
  parentId?: string
  createdAt: string
  updatedAt: string
}
const folderStorageKey='studyflow-library-folders-v1'
export function loadLibraryFolders(): LibraryFolder[] {
  try {
    const data:unknown=JSON.parse(localStorage.getItem(folderStorageKey)||'[]')
    if(!Array.isArray(data))return []
    return data.filter((x):x is LibraryFolder=>Boolean(x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.subjectId==='string'&&typeof x.semesterId==='string'))
  }catch{return []}
}
export function persistLibraryFolders(folders:LibraryFolder[]):boolean{
  try{localStorage.setItem(folderStorageKey,JSON.stringify(folders));return true}catch{return false}
}
export function folderLocation(item: Pick<LibraryItem,'folderId'|'category'>):string {
  return item.folderId ? `folder:${item.folderId}` : `section:${sectionForCategory(item.category)}`
}
export function folderPath(folder:LibraryFolder, all:LibraryFolder[]):LibraryFolder[] {
  const path:LibraryFolder[]=[]
  const visited=new Set<string>()
  let node:LibraryFolder|undefined=folder
  while(node&&!visited.has(node.id)){
    visited.add(node.id);path.unshift(node)
    node=all.find(f=>f.id===node?.parentId && f.subjectId===folder.subjectId)
  }
  return path
}
