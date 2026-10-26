import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { subjectMatches, type AcademicState } from './academicModel'
import { removePdfStudyData } from './pdfReaderModel'
import { removePdfStudyData as removePdfStudyDataDexie } from './pdfReaderModelDexie'
import { DialogSurface } from './components/ui/DialogSurface'
import { storageErrorMessage } from './lib/storage'
import type { StudyTask } from './taskModel'
import {
  deleteLibraryBlob, fileSizeLabel, folderPath, getLibraryBlob, libraryCategories, libraryId,
  librarySections, maxLibraryFileBytes, saveLibraryBlob, sectionForCategory, suggestCategory,
  tagsFromText, validWebUrl, type LibraryCategory, type LibraryFolder, type LibraryItem,
  type LibraryKind, type LibrarySection,
} from './libraryModel'

type Props = {
  academics:AcademicState; items:LibraryItem[]; folders:LibraryFolder[]; tasks:StudyTask[]
  onUpsert:(item:LibraryItem)=>void; onDelete:(id:string)=>void
  onSaveFolder:(folder:LibraryFolder)=>void; onRemoveFolder:(id:string)=>void
  onOpenTask:(id:number)=>void
  initialSubjectId?:string; initialOpenId?:string; initialSection?:LibrarySection
  addRequest:number; onAddRequestHandled:()=>void
}
type Composer='file'|'note'|'link'
type View={kind:'home'|'subject'|'section'|'folder'|'all'|'favorites'|'recent'|'unassigned';subjectId?:string;section?:LibrarySection;folderId?:string}
const box='rounded-[24px] bg-surface shadow-sm ring-1 ring-line'
const field='mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand/40 focus:bg-surface focus:ring-2 focus:ring-brand/10'
const ghost='rounded-xl bg-canvas px-3.5 py-2.5 text-xs font-semibold transition hover:bg-ink/[0.08]'
const primary='rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:opacity-50'
const PdfReader = lazy(() => import('./PdfReader').then(module => ({ default: module.PdfReader })))
function I({name,size=20}: {name:string;size?:number}){
  const shape:Record<string,ReactNode>={
    search:<><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 4 4"/></>, plus:<path d="M12 4v16M4 12h16"/>,
    folder:<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
    book:<><path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zM12 6v15"/></>,
    lab:<><path d="M9 3h6M10 3v7l-6 8a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-8V3M7 16h10"/></>,
    seminar:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></>,
    tasks:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m7.5 9 1.5 1.5 2.5-3M13 9h4M8 16h9"/></>,
    archive:<><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 13h4"/></>,
    doc:<><path d="M7 2h8l4 4v15H5V4a2 2 0 0 1 2-2zM15 2v5h4M9 12h6M9 16h6"/></>,
    note:<><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    link:<><path d="M10 13.6a5 5 0 0 0 7.2 0l2-2A5 5 0 0 0 12 4.5L10.5 6M14 10.4a5 5 0 0 0-7.2 0l-2 2A5 5 0 0 0 12 19.5l1.5-1.5"/></>,
    star:<path d="m12 2.7 2.9 6.05 6.7.97-4.85 4.74 1.15 6.7L12 18.05l-5.9 3.1 1.13-6.7L2.4 9.72l6.7-.97z"/>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    all:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    arrow:<path d="m9 5 7 7-7 7"/>, back:<path d="m15 5-7 7 7 7"/>,
    more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close:<path d="M5 5 19 19M19 5 5 19"/>,
    upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/></>,
    download:<><path d="M12 3v13m-5-5 5 5 5-5M4 18v2h16v-2"/></>,
    edit:<><path d="m15 5 4 4M3 21l5-1 11-11a3 3 0 0 0-4-4L4 16z"/></>,
    trash:<><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></>,
    check:<path d="m4 12 5 5L20 6"/>,
    external:<><path d="M12 5h7v7m0-7-9 9M19 15v4H5V5h5"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/></>,
    layers:<><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" fill="none">{shape[name]||shape.doc}</svg>
}
const dateLabel=(iso:string)=>new Date(iso).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})
const sectionInfo=(id:LibrarySection)=>librarySections.find(x=>x.id===id)!
function ItemIcon({kind}:{kind:LibraryKind}){const c=kind==='file'?'#e85d64':kind==='note'?'#9067df':'#16a085';return <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{backgroundColor:`${c}15`,color:c}}><I name={kind==='file'?'doc':kind} size={22}/></span>}
export function LibraryPage({academics,items,folders,tasks,onUpsert,onDelete,onSaveFolder,onRemoveFolder,onOpenTask,initialSubjectId,initialOpenId,initialSection,addRequest,onAddRequestHandled}:Props){
  const [view,setView]=useState<View>(()=>initialSubjectId?initialSection?{kind:'section',subjectId:initialSubjectId,section:initialSection}:{kind:'subject',subjectId:initialSubjectId}:{kind:'home'})
  const [semesterFilter,setSemesterFilter]=useState(academics.activeSemesterId)
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState<'new'|'name'|'old'>('new')
  const [createMenu,setCreateMenu]=useState(false)
  const [composer,setComposer]=useState<Composer|null>(null)
  const [editing,setEditing]=useState<LibraryItem|null>(null)
  const [opened,setOpened]=useState<LibraryItem|null>(null)
  const [blobUrl,setBlobUrl]=useState<string|null>(null)
  const [previewError,setPreviewError]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [title,setTitle]=useState('')
  const [semesterId,setSemesterId]=useState(academics.activeSemesterId)
  const [subjectId,setSubjectId]=useState(initialSubjectId||'')
  const [category,setCategory]=useState<LibraryCategory>('General')
  const [folderId,setFolderId]=useState('')
  const [taskId,setTaskId]=useState('')
  const [tagsText,setTagsText]=useState('')
  const [content,setContent]=useState('')
  const [webUrl,setWebUrl]=useState('')
  const [files,setFiles]=useState<File[]>([])
  const [suggested,setSuggested]=useState<LibraryCategory|null>(null)
  const [dropActive,setDropActive]=useState(false)
  const fileRef=useRef<HTMLInputElement>(null)
  const [folderDialog,setFolderDialog]=useState<'new'|'edit'|null>(null)
  const [folderEditing,setFolderEditing]=useState<LibraryFolder|null>(null)
  const [folderName,setFolderName]=useState('')
  const [folderSubject,setFolderSubject]=useState('')
  const [folderSemester,setFolderSemester]=useState(academics.activeSemesterId)
  const [folderParent,setFolderParent]=useState('')
  const [folderError,setFolderError]=useState('')

  const subjectsById=useMemo(()=>new Map(academics.subjects.map(s=>[s.id,s])),[academics.subjects])
  const selectedSubject=view.subjectId?subjectsById.get(view.subjectId):undefined
  const currentFolder=view.folderId?folders.find(f=>f.id===view.folderId):undefined
  const subjectFolders=selectedSubject?folders.filter(f=>f.subjectId===selectedSubject.id):[]
  const subjectItems=selectedSubject?items.filter(i=>i.subjectId===selectedSubject.id):[]
  const chosenSemSubjects=academics.subjects.filter(s=>s.semesterId===semesterId)
  const chosenSubjectFolders=folders.filter(f=>f.subjectId===subjectId)
  const semNumber=(id:string)=>academics.semesters.find(s=>s.id===id)?.number===2?'II':'I'
  const chooseView=(route:View)=>{setQuery('');setView(route);setCreateMenu(false)}
  const routeSubject=(id:string):View=>({kind:'subject',subjectId:id})
  const rootFolders=subjectFolders.filter(f=>!f.parentId)
  const subFolders=subjectFolders.filter(f=>f.parentId===view.folderId)
  const childrenOf=(id:string)=>items.filter(i=>i.folderId===id).length
  const itemInSection=(item:LibraryItem,section:LibrarySection)=>!item.folderId&&sectionForCategory(item.category)===section
  const routeLabel= view.kind==='home'?'Biblioteca mea':view.kind==='all'?'Toate materialele':view.kind==='recent'?'Recente':view.kind==='favorites'?'Favorite':view.kind==='unassigned'?'Fără materie':view.kind==='section'&&view.section?sectionInfo(view.section).label:view.kind==='folder'?currentFolder?.name||'Folder':selectedSubject?.name||'Library'

  useEffect(()=>{if(addRequest){startCreate('file');onAddRequestHandled()}},[addRequest])
  useEffect(()=>{if(initialSubjectId){setView(initialSection?{kind:'section',subjectId:initialSubjectId,section:initialSection}:{kind:'subject',subjectId:initialSubjectId})}},[initialSubjectId,initialSection])
  useEffect(()=>{if(initialOpenId){const found=items.find(i=>i.id===initialOpenId);if(found)void viewItem(found)}},[initialOpenId])
  useEffect(()=>()=>{if(blobUrl)URL.revokeObjectURL(blobUrl)},[blobUrl])
  useEffect(()=>{if(view.kind==='folder'&&!currentFolder&&view.subjectId)setView(routeSubject(view.subjectId))},[view,currentFolder])

  function startCreate(mode:Composer,record?:LibraryItem){
    const recordSubject=record?.subjectId||view.subjectId||''
    const sem=record?.semesterId||subjectsById.get(recordSubject)?.semesterId||academics.activeSemesterId
    setComposer(mode);setCreateMenu(false);setEditing(record||null);setError('');setBusy(false)
    setSemesterId(sem);setSubjectId(recordSubject)
    setTitle(record?.title||'');setCategory(record?.category|| (view.kind==='section'&&view.section?sectionInfo(view.section).singular:mode==='note'?'General':'General'))
    setFolderId(record?.folderId|| (view.kind==='folder'?view.folderId||'':''))
    setTaskId(record?.taskId!==undefined?String(record.taskId):'')
    setTagsText(record?.tags.join(', ')||'');setContent(record?.content||'');setWebUrl(record?.url||'')
    setSuggested(null);setFiles([])
  }
  function setChosenFiles(list:FileList|File[]|null){
    if(!list)return
    const selection=Array.from(list).slice(0,20)
    setFiles(selection)
    if(selection.length===1&&!editing){setTitle(selection[0].name.replace(/\.[^/.]+$/,''));setSuggested(suggestCategory(selection[0].name))}
    else setSuggested(null)
    setError(selection.some(f=>f.size>maxLibraryFileBytes)?'Un fișier depășește limita de 50 MB.':'')
  }
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!composer||busy)return
    const name=title.trim()
    if(!name&&!(composer==='file'&&files.length>1)){setError('Completează titlul.');return}
    if(composer==='file'&&!editing&&!files.length){setError('Alege cel puțin un fișier.');return}
    if(composer==='file'&&files.some(f=>f.size>maxLibraryFileBytes)){setError('Un fișier depășește 50 MB.');return}
    if(composer==='note'&&!content.trim()){setError('Scrie conținutul notiței.');return}
    const url=composer==='link'?validWebUrl(webUrl):null
    if(composer==='link'&&!url){setError('Linkul trebuie să înceapă cu https:// sau http://.');return}
    const destination=folders.find(f=>f.id===folderId)
    if(destination&&(destination.subjectId!==subjectId||destination.semesterId!==semesterId)){setError('Folderul nu aparține materiei alese.');return}
    if(taskId&&(!tasks.some(t=>t.id===Number(taskId)&&subjectId&&subjectsById.get(subjectId)&&subjectMatches(t,subjectsById.get(subjectId)!)))){setError('Taskul selectat nu corespunde materiei.');return}
    const now=new Date().toISOString()
    const common={semesterId,subjectId:subjectId||undefined,folderId:folderId||undefined,taskId:taskId?Number(taskId):undefined,category,tags:tagsFromText(tagsText),updatedAt:now}
    setError('');setBusy(true)
    try{
      if(composer==='file'&&!editing){
        for(const file of files){
          const id=libraryId();await saveLibraryBlob(id,file)
          const fileTitle=files.length===1?name:file.name.replace(/\.[^/.]+$/,'')||file.name
          onUpsert({id,kind:'file',title:fileTitle,createdAt:now,favorite:false,...common,fileName:file.name,fileType:file.type,fileSize:file.size})
        }
      }else if(editing){
        onUpsert({...editing,...common,title:name,content:composer==='note'?content:undefined,url:composer==='link'?url||undefined:undefined})
      }else{
        onUpsert({id:libraryId(),kind:composer,title:name,createdAt:now,favorite:false,...common,content:composer==='note'?content:undefined,url:composer==='link'?url||undefined:undefined})
      }
      setComposer(null);setEditing(null);setFiles([])
    }catch(ex){setError(storageErrorMessage(ex, 'Nu s-a putut salva fișierul. Verifică spațiul disponibil.'))}
    finally{setBusy(false)}
  }
  function startFolder(record?:LibraryFolder){
    const dest=selectedSubject?.id||academics.subjects.find(s=>s.semesterId===academics.activeSemesterId)?.id||academics.subjects[0]?.id||''
    if(!record&&!dest){setFolderError('Creează mai întâi o materie în pagina Materii.');setFolderDialog('new');setFolderEditing(null);setFolderSubject('');setFolderName('');return}
    setFolderDialog(record?'edit':'new');setFolderEditing(record||null);setFolderError('')
    setFolderName(record?.name||'');setFolderSubject(record?.subjectId||dest)
    setFolderSemester(record?.semesterId||subjectsById.get(dest)?.semesterId||academics.activeSemesterId)
    setFolderParent(record?.parentId||(view.kind==='folder'?view.folderId||'':'')||'')
    setCreateMenu(false)
  }
  function submitFolder(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const name=folderName.trim()
    if(!name||name.length>60){setFolderError('Alege un nume între 1 și 60 de caractere.');return}
    if(!folderSubject){setFolderError('Selectează o materie pentru folder.');return}
    const s=subjectsById.get(folderSubject)
    if(!s||s.semesterId!==folderSemester){setFolderError('Materia nu aparține semestrului ales.');return}
    const parent=folders.find(f=>f.id===folderParent)
    if(folderParent&&(!parent||parent.subjectId!==folderSubject)){setFolderError('Folderul părinte nu aparține materiei.');return}
    if(folders.some(f=>f.id!==folderEditing?.id&&f.subjectId===folderSubject&&(f.parentId||'')===folderParent&&f.name.toLocaleLowerCase('ro-RO')===name.toLocaleLowerCase('ro-RO'))){setFolderError('Există deja un folder cu acest nume în această locație.');return}
    const now=new Date().toISOString()
    const saved:LibraryFolder={id:folderEditing?.id||libraryId(),name,subjectId:folderSubject,semesterId:folderSemester,parentId:folderParent||undefined,createdAt:folderEditing?.createdAt||now,updatedAt:now}
    onSaveFolder(saved);setFolderDialog(null);setFolderEditing(null)
    if(!folderEditing)setView({kind:'folder',subjectId:folderSubject,folderId:saved.id})
  }
  function removeFolder(folder:LibraryFolder){
    const count=items.filter(i=>i.folderId===folder.id).length
    const subCount=folders.filter(f=>f.parentId===folder.id).length
    if(!window.confirm(`Ștergi folderul „${folder.name}”? ${count} materiale și ${subCount} subfoldere vor fi mutate un nivel mai sus. Fișierele NU se șterg.`))return
    onRemoveFolder(folder.id);if(view.folderId===folder.id)setView(folder.parentId?{kind:'folder',subjectId:folder.subjectId,folderId:folder.parentId}:routeSubject(folder.subjectId))
  }
  async function viewItem(item:LibraryItem){
    setOpened(item);setPreviewError('');setBlobUrl(null)
    if(item.kind!=='file')return
    try{
      const data=await getLibraryBlob(item.id)
      if(!data){setPreviewError('Fișierul nu se mai află în acest browser. Informațiile despre el au rămas salvate.');return}
      setBlobUrl(URL.createObjectURL(data))
    }catch(ex){setPreviewError(ex instanceof Error?ex.message:'Nu am putut citi fișierul.')}
  }
  async function download(item:LibraryItem){
    try{
      const data=await getLibraryBlob(item.id)
      if(!data){setPreviewError('Fișierul nu mai este disponibil în acest browser.');return}
      const url=URL.createObjectURL(data)
      const element=document.createElement('a');element.href=url;element.download=item.fileName||item.title;element.click()
      window.setTimeout(()=>URL.revokeObjectURL(url),60000)
    }catch(ex){setPreviewError(ex instanceof Error?ex.message:'Nu am putut descărca fișierul.')}
  }
  async function remove(item:LibraryItem){
    if(!window.confirm(`Ștergi definitiv „${item.title}”? Această operațiune nu poate fi anulată.`))return
    setBusy(true)
    try{if(item.kind==='file'){await deleteLibraryBlob(item.id);removePdfStudyData(item.id)}onDelete(item.id);setOpened(null);setBlobUrl(null)}
    catch(ex){setPreviewError(ex instanceof Error?ex.message:'Ștergerea a eșuat.')}
    finally{setBusy(false)}
  }
  const queryText=query.trim().toLocaleLowerCase('ro-RO')
  const filtered=useMemo(()=>items.filter(item=>{
    if(queryText){const subject=subjectsById.get(item.subjectId||'')?.name||'';const folder=folders.find(f=>f.id===item.folderId)?.name||'';return [item.title,item.fileName,item.category,item.content,subject,folder,...(item.tags||[])].join(' ').toLocaleLowerCase('ro-RO').includes(queryText)}
    if(view.kind==='all')return true
    if(view.kind==='favorites')return item.favorite
    if(view.kind==='recent')return true
    if(view.kind==='unassigned')return !item.subjectId
    if(view.kind==='section')return item.subjectId===view.subjectId && !!view.section && !item.folderId && sectionForCategory(item.category)===view.section
    if(view.kind==='folder')return item.folderId===view.folderId
    if(view.kind==='subject')return item.subjectId===view.subjectId
    return false
  }).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'ro-RO'):sort==='old'?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt)),[items,view,sort,queryText,subjectsById,folders])
  const list= (view.kind==='recent'&&!queryText?filtered.slice(0,30):view.kind==='subject'&&!queryText?filtered.slice(0,5):filtered)
  const semSubjects=academics.subjects.filter(s=>semesterFilter==='all'||s.semesterId===semesterFilter)
  const getCount=(subject:string)=>items.filter(i=>i.subjectId===subject).length
  const subjectLabel=(item:LibraryItem)=>subjectsById.get(item.subjectId||'')?.name||'Fără materie'
  const namedLocation=(item:LibraryItem)=>folders.find(f=>f.id===item.folderId)?.name || sectionInfo(sectionForCategory(item.category)).label
  const canAddFolder=Boolean(academics.subjects.length)
  const candidateTasks=tasks.filter(t=>subjectId&&subjectsById.get(subjectId)&&subjectMatches(t,subjectsById.get(subjectId)!))
  const previewType=(item:LibraryItem)=>item.fileType==='application/pdf'||item.fileName?.toLowerCase().endsWith('.pdf')?'pdf':/^image\/(png|jpeg|gif|webp)$/.test(item.fileType||'')?'image':'other'
  const back=()=>view.kind==='folder'&&currentFolder?.parentId?chooseView({kind:'folder',subjectId:view.subjectId,folderId:currentFolder.parentId}):view.subjectId&&view.kind!=='subject'?chooseView(routeSubject(view.subjectId)):chooseView({kind:'home'})

  const docRow=(item:LibraryItem)=> <div key={item.id} className="group flex min-w-0 items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 shadow-sm ring-1 ring-line transition hover:shadow-md sm:px-4">
    <button onClick={()=>void viewItem(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><ItemIcon kind={item.kind}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{item.title}</span><span className="mt-0.5 block truncate text-xs text-ink-soft">{subjectLabel(item)} · {namedLocation(item)}</span><span className="mt-0.5 block truncate text-[11px] text-ink-faint">{dateLabel(item.updatedAt)}{item.kind==='file'?` · ${fileSizeLabel(item.fileSize)}`:''}{item.tags.length?' · #'+item.tags.slice(0,2).join(' #'):''}</span></span></button>
    <button onClick={()=>onUpsert({...item,favorite:!item.favorite,updatedAt:new Date().toISOString()})} aria-label={item.favorite?'Scoate din favorite':'Adaugă la favorite'} aria-pressed={item.favorite} className={`grid size-9 shrink-0 place-items-center rounded-xl hover:bg-surface-hover ${item.favorite?'text-[#eda82f]':'text-ink-faint'}`}><I name="star" size={18}/></button>
    <button onClick={()=>void viewItem(item)} aria-label={`Deschide ${item.title}`} className="grid size-8 shrink-0 place-items-center rounded-xl text-ink-faint hover:bg-surface-hover"><I name="arrow" size={18}/></button>
  </div>
  const folderCard=(folder:LibraryFolder)=> <div key={folder.id} className="flex min-w-0 items-center gap-2 rounded-[19px] bg-surface p-3 shadow-sm ring-1 ring-line hover:shadow-md transition">
    <button onClick={()=>chooseView({kind:'folder',subjectId:folder.subjectId,folderId:folder.id})} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid size-12 shrink-0 place-items-center rounded-[15px] bg-brand-soft text-brand-text"><I name="folder" size={23}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{folder.name}</span><span className="text-[11px] text-ink-soft">{childrenOf(folder.id)} materiale · {folders.filter(f=>f.parentId===folder.id).length} subfoldere</span></span></button>
    <button onClick={()=>startFolder(folder)} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-hover" aria-label={`Redenumește ${folder.name}`} title="Redenumește"><I name="edit" size={16}/></button>
    <button onClick={()=>removeFolder(folder)} className="grid size-8 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger/10" aria-label={`Șterge folderul ${folder.name}`} title="Șterge fără a șterge fișierele"><I name="trash" size={16}/></button>
  </div>

  return <section className="space-y-5 pb-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-brand-text"><I name="layers" size={15}/>StudyFlow · Spațiul de studiu</div><h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Library</h1><p className="mt-1 text-sm text-ink-soft">Totul la locul lui. Găsești orice, fără să cauți prin foldere nesfârșite.</p></div>
      <div className="relative shrink-0"><button onClick={()=>setCreateMenu(v=>!v)} aria-expanded={createMenu} aria-label="Adaugă în Library" className="grid size-11 place-items-center rounded-2xl bg-brand text-white shadow-[0_6px_20px_#0071e333] hover:bg-brand-deep"><I name="plus" size={23}/></button>
        {createMenu&&<div className="absolute right-0 top-13 z-30 w-60 rounded-[20px] border border-line bg-surface p-2 shadow-2xl">{([{id:'file',title:'Încarcă fișiere',icon:'upload'},{id:'note',title:'Notiță nouă',icon:'note'},{id:'link',title:'Salvează link',icon:'link'}] as const).map(x=><button key={x.id} onClick={()=>startCreate(x.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-hover"><I name={x.icon}/>{x.title}</button>)}<div className="my-1 border-t border-line"/><button onClick={()=>startFolder()} disabled={!canAddFolder} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-hover disabled:opacity-50"><I name="folder"/>Folder personal</button></div>}
      </div>
    </header>
    <div className={`${box} p-3.5 sm:p-4`}><label className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5 text-ink-soft"><I name="search" size={19}/><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft" placeholder="Caută în toate materialele, inclusiv foldere..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="Golește căutarea"><I name="close" size={16}/></button>}</label></div>

    {view.kind!=='home'&&<nav aria-label="Cale în bibliotecă" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold"><button onClick={()=>chooseView({kind:'home'})} className="text-brand-text hover:underline">Library</button>{selectedSubject&&<><I name="arrow" size={13}/><button onClick={()=>chooseView(routeSubject(selectedSubject.id))} className={view.kind==='subject'?'text-ink':'text-brand-text hover:underline'}>{selectedSubject.name}</button></>}{view.kind==='folder'&&currentFolder&&folderPath(currentFolder,folders).map(f=><span key={f.id} className="flex min-w-0 items-center gap-1"><I name="arrow" size={13}/><button onClick={()=>chooseView({kind:'folder',subjectId:f.subjectId,folderId:f.id})} className="max-w-40 truncate text-brand-text hover:underline">{f.name}</button></span>)}{view.kind!=='subject'&&view.kind!=='folder'&&<><I name="arrow" size={13}/><span className="text-ink">{routeLabel}</span></>}</nav>}

    {view.kind==='home'&&!queryText&&<>
      <div className="grid grid-cols-3 gap-2">{[{n:items.length,t:'Materiale'},{n:academics.subjects.length,t:'Materii'},{n:items.filter(x=>x.favorite).length,t:'Favorite'}].map(x=><div key={x.t} className={`${box} px-2 py-3 text-center`}><p className="text-2xl font-bold tracking-tight tabular-nums">{x.n}</p><p className="mt-0.5 text-[11px] text-ink-soft">{x.t}</p></div>)}</div>
      <div className="grid grid-cols-3 gap-2">{[{kind:'all',label:'Toate',icon:'all',color:'#337ee9'},{kind:'favorites',label:'Favorite',icon:'star',color:'#dba339'},{kind:'recent',label:'Recente',icon:'clock',color:'#7d6bba'}].map(x=><button key={x.kind} onClick={()=>chooseView({kind:x.kind as View['kind']})} className={`${box} flex flex-col items-center gap-2 px-2 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-md`}><span className="grid size-11 place-items-center rounded-2xl" style={{backgroundColor:`${x.color}15`,color:x.color}}><I name={x.icon} size={22}/></span><span className="text-xs font-semibold">{x.label}</span></button>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold tracking-tight">Materiile tale</h2><p className="text-xs text-ink-soft">Foldere organizate automat după disciplină</p></div><select value={semesterFilter} onChange={e=>setSemesterFilter(e.target.value)} aria-label="Afișează semestrul" className="max-w-full rounded-xl bg-surface px-3 py-2.5 text-xs font-semibold shadow-sm outline-none ring-1 ring-line"><option value="all">Toate semestrele</option>{academics.semesters.map(s=><option key={s.id} value={s.id}>Semestrul {s.number===1?'I':'II'}</option>)}</select></div>
      {semSubjects.length?<div className="grid gap-2.5 sm:grid-cols-2">{semSubjects.map(s=><button key={s.id} onClick={()=>chooseView(routeSubject(s.id))} className={`${box} group flex min-w-0 items-center gap-3 px-3.5 py-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md`}><span className="grid size-12 shrink-0 place-items-center rounded-[16px]" style={{backgroundColor:`${s.color}15`,color:s.color}}><I name="folder" size={25}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="mt-0.5 block text-[11px] text-ink-soft">{getCount(s.id)} materiale · Semestrul {semNumber(s.semesterId)}{s.archived?' · Arhivată':''}</span></span><span className="text-ink-faint transition group-hover:translate-x-0.5"><I name="arrow"/></span></button>)}</div>:<div className={`${box} p-8 text-center`}><I name="folder" size={32}/><p className="mt-3 font-semibold">Nu sunt materii în acest semestru</p><p className="mt-1 text-xs text-ink-soft">Creează-le în pagina Materii pentru a le organiza aici.</p></div>}
      {items.some(x=>!x.subjectId)&&<button onClick={()=>chooseView({kind:'unassigned'})} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left text-xs font-semibold text-ink-soft shadow-sm"><span>Materiale fără materie ({items.filter(x=>!x.subjectId).length})</span><I name="arrow" size={17}/></button>}
    </>}

    {view.kind==='subject'&&!queryText&&selectedSubject&&<>
      <div className={`${box} flex items-center gap-3 p-4 sm:p-5`}><span className="grid size-14 shrink-0 place-items-center rounded-[19px]" style={{backgroundColor:`${selectedSubject.color}15`,color:selectedSubject.color}}><I name="book" size={28}/></span><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold tracking-tight">{selectedSubject.name}</h2><p className="mt-1 text-xs text-ink-soft">Semestrul {semNumber(selectedSubject.semesterId)} · {subjectItems.length} materiale</p></div><button onClick={()=>startFolder()} className={`${ghost} hidden items-center gap-1.5 sm:inline-flex`}><I name="plus" size={15}/>Folder</button></div>
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Foldere inteligente</h3><span className="text-[11px] text-ink-soft">Organizate automat</span></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{librarySections.map(s=>{const count=subjectItems.filter(i=>itemInSection(i,s.id)).length;return <button key={s.id} onClick={()=>chooseView({kind:'section',subjectId:selectedSubject.id,section:s.id})} className={`${box} flex min-h-29 flex-col items-start justify-between gap-3 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md`}><span className="grid size-11 place-items-center rounded-2xl" style={{color:s.color,backgroundColor:`${s.color}15`}}><I name={s.id==='curs'?'book':s.id==='seminar'?'seminar':s.id==='laborator'?'lab':s.id==='teme'?'tasks':'archive'} size={23}/></span><span><span className="block text-sm font-semibold">{s.label}</span><span className="text-[11px] text-ink-soft">{count} {count===1?'material':'materiale'}</span></span></button>})}</div>
      <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Foldere personale</h3><p className="text-[11px] text-ink-soft">Organizează exact cum vrei tu</p></div><button onClick={()=>startFolder()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text"><I name="plus" size={16}/>Folder nou</button></div>
      {rootFolders.length?<div className="grid gap-2 sm:grid-cols-2">{rootFolders.map(folderCard)}</div>:<div className="rounded-2xl border border-dashed border-line bg-surface/65 p-4 text-xs text-ink-soft">Nu ai încă foldere personale. Poți crea „Proiect final”, „Bibliografie”, „Fișe de examen” sau orice altceva.</div>}
      {subjectItems.length>0&&<div className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Ultimele materiale</h3><button onClick={()=>chooseView({kind:'all'})} className="text-xs font-semibold text-brand-text">Vezi toate ›</button></div>{list.map(docRow)}</div>}
    </>}

    {view.kind==='folder'&&!queryText&&currentFolder&&<>
      <div className={`${box} flex items-center gap-3 p-4`}><span className="grid size-13 place-items-center rounded-2xl bg-brand-soft text-brand-text"><I name="folder" size={27}/></span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{currentFolder.name}</h2><p className="text-[11px] text-ink-soft">Folder personal · {list.length} materiale</p></div><button aria-label="Redenumește folderul" className={ghost} onClick={()=>startFolder(currentFolder)}><I name="edit" size={17}/></button></div>
      <div className="flex justify-between gap-2"><h3 className="text-sm font-bold">Subfoldere</h3><button onClick={()=>startFolder()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text"><I name="plus" size={16}/>Subfolder nou</button></div>
      {subFolders.length?<div className="grid gap-2 sm:grid-cols-2">{subFolders.map(folderCard)}</div>:<p className="text-xs text-ink-soft">Nu sunt subfoldere aici.</p>}
    </>}

    {(view.kind==='section'||view.kind==='folder'||view.kind==='all'||view.kind==='favorites'||view.kind==='recent'||view.kind==='unassigned'||queryText)&&<>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold tracking-tight">{queryText?`Căutare: „${query.trim()}”`:routeLabel}</h2><p className="mt-0.5 text-xs text-ink-soft">{list.length} {list.length===1?'material':'materiale'}{queryText?' în întreaga bibliotecă':''}</p></div><div className="flex items-center gap-2"><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} aria-label="Sortează" className="rounded-xl bg-surface px-3 py-2 text-xs font-semibold ring-1 ring-line"><option value="new">Cele mai noi</option><option value="name">Nume A–Z</option><option value="old">Cele mai vechi</option></select>{!queryText&&<button className={primary} onClick={()=>startCreate('file')}>+ Fișier</button>}</div></div>
      {list.length?<div className="space-y-2.5">{list.map(docRow)}</div>:<div className={`${box} px-5 py-10 text-center`}><span className="mx-auto grid size-14 place-items-center rounded-[22px] bg-canvas text-ink-soft"><I name="folder" size={27}/></span><p className="mt-3 text-sm font-semibold">{queryText?'Nu am găsit materiale':'Folderul este gol'}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-soft">{queryText?'Încearcă alt cuvânt sau etichetă.':'Încarcă fișiere, salvează linkuri sau scrie notițe. Ele vor apărea automat aici.'}</p>{!queryText&&<button className={`${primary} mt-4`} onClick={()=>startCreate('file')}>Încarcă primul fișier</button>}</div>}
    </>}

    <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-soft"><I name="info" size={13}/> Fișierele sunt salvate local în browser (IndexedDB), nu în cloud. Păstrează originalele: ștergerea datelor site-ului poate elimina materialele.</p>

    {composer&&<div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-[4px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setComposer(null)}}><DialogSurface label="Adaugă material" onClose={()=>{if(!busy)setComposer(null)}} className="max-h-[95dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-surface p-5 shadow-2xl sm:rounded-[30px] sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight">{editing?'Editează material':composer==='file'?'Încarcă materiale':composer==='note'?'Notiță nouă':'Salvează link'}</h2><p className="mt-1 text-xs text-ink-soft">Alege locul potrivit, apoi materialul va fi mereu ușor de găsit.</p></div><button aria-label="Închide" disabled={busy} onClick={()=>setComposer(null)} className="grid size-9 place-items-center rounded-full bg-canvas"><I name="close"/></button></header>
      <form onSubmit={e=>void save(e)} className="space-y-3.5">
        {composer==='file'&&!editing&&<div onDragOver={e=>{e.preventDefault();setDropActive(true)}} onDragLeave={e=>{e.preventDefault();setDropActive(false)}} onDrop={(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();setDropActive(false);setChosenFiles(e.dataTransfer.files)}} className={`rounded-[22px] border-2 border-dashed p-5 text-center ${dropActive?'border-brand bg-brand-soft':'border-line bg-canvas'}`}><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-brand-text"><I name="upload" size={25}/></span><p className="mt-2 text-sm font-semibold">Trage fișierele aici</p><p className="mt-1 text-[11px] text-ink-soft">PDF, imagini, documente, arhive · max. 50 MB/fișier</p><input ref={fileRef} type="file" multiple className="sr-only" onChange={(e:ChangeEvent<HTMLInputElement>)=>setChosenFiles(e.target.files)}/><button type="button" onClick={()=>fileRef.current?.click()} className={`${ghost} mt-3 bg-surface`}>Alege fișiere</button>{files.length>0&&<div className="mt-3 max-h-24 space-y-1 overflow-auto text-left">{files.map((f,i)=><p key={i} className="truncate text-[11px] text-ink-soft">{f.name} · {fileSizeLabel(f.size)}</p>)}</div>}</div>}
        <label className="block text-xs font-semibold">Titlu {composer==='file'&&files.length>1&&<span className="font-normal text-ink-soft">· se folosesc numele fișierelor</span>}<input className={field} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex: Tema 04 — Moștenire"/></label>
        <div className="grid grid-cols-2 gap-2.5"><label className="text-xs font-semibold">Semestru<select className={field} value={semesterId} onChange={e=>{setSemesterId(e.target.value);setSubjectId('');setFolderId('');setTaskId('')}}>{academics.semesters.map(s=><option key={s.id} value={s.id}>Semestrul {s.number===1?'I':'II'}</option>)}</select></label><label className="text-xs font-semibold">Materie<select className={field} value={subjectId} onChange={e=>{setSubjectId(e.target.value);setFolderId('');setTaskId('')}}><option value="">Fără materie</option>{chosenSemSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
        <div className="grid grid-cols-2 gap-2.5"><label className="text-xs font-semibold">Categorie<select className={field} value={category} onChange={e=>{setCategory(e.target.value as LibraryCategory);setSuggested(null)}}>{!libraryCategories.includes(category)&&<option value={category}>{category} (vechi)</option>}{libraryCategories.map(c=><option key={c} value={c}>{c==='Temă'?'Teme':c==='General'?'Materiale generale':c==='Curs'?'Cursuri':c==='Laborator'?'Laboratoare':'Seminare'}</option>)}</select></label><label className="text-xs font-semibold">Folder personal (opțional)<select className={field} value={folderId} onChange={e=>setFolderId(e.target.value)} disabled={!subjectId}><option value="">Folder automat</option>{chosenSubjectFolders.map(f=><option key={f.id} value={f.id}>{'↳ '.repeat(Math.min(folderPath(f,folders).length-1,4))}{f.name}</option>)}</select></label></div>
        {suggested&&suggested!==category&&<button type="button" onClick={()=>{setCategory(suggested);setSuggested(null)}} className="flex w-full items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-left text-xs font-semibold text-brand-text"><I name="layers" size={16}/>Sugestie pentru numele fișierului: {suggested==='Temă'?'Teme':suggested}. Aplică ›</button>}
        {subjectId&&candidateTasks.length>0&&<label className="block text-xs font-semibold">Asociază unui task (opțional)<select className={field} value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">Fără task asociat</option>{candidateTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
        <label className="block text-xs font-semibold">Etichete <span className="font-normal text-ink-soft">· separate prin virgulă</span><input className={field} value={tagsText} onChange={e=>setTagsText(e.target.value)} maxLength={180} placeholder="important, examen, proiect"/></label>
        {composer==='note'&&<label className="block text-xs font-semibold">Conținut<textarea className={`${field} resize-y`} rows={6} maxLength={20000} value={content} onChange={e=>setContent(e.target.value)} placeholder="Scrie notițele tale..."/></label>}
        {composer==='link'&&<label className="block text-xs font-semibold">Adresă web<input type="url" className={field} value={webUrl} onChange={e=>setWebUrl(e.target.value)} placeholder="https://..."/></label>}
        {error&&<p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-xs font-semibold text-danger">{error}</p>}
        <div className="flex gap-2 border-t border-line pt-4"><button type="button" onClick={()=>setComposer(null)} disabled={busy} className={`${ghost} flex-1`}>Renunță</button><button type="submit" disabled={busy} className={`${primary} flex-[1.6]`}>{busy?'Se salvează...':editing?'Salvează modificările':composer==='file'&&files.length>1?`Încarcă ${files.length} fișiere`:'Salvează'}</button></div>
      </form>
    </DialogSurface></div>}

    {folderDialog&&<div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 backdrop-blur-[4px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setFolderDialog(null)}}><DialogSurface label={folderDialog==='edit'?'Redenumește folder':'Folder personal nou'} onClose={()=>setFolderDialog(null)} className="w-full max-w-md rounded-t-[30px] bg-surface p-5 shadow-2xl sm:rounded-[30px] sm:p-6"><header className="mb-5 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text"><I name="folder" size={25}/></span><div className="flex-1"><h2 className="text-lg font-bold">{folderDialog==='edit'?'Redenumește folderul':'Folder personal nou'}</h2><p className="text-xs text-ink-soft">Organizare proprie, fără copii ale fișierelor.</p></div><button aria-label="Închide" onClick={()=>setFolderDialog(null)}><I name="close"/></button></header>
      <form onSubmit={submitFolder} className="space-y-4"><label className="block text-xs font-semibold">Nume folder<input autoFocus maxLength={60} className={field} value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="Ex: Proiect de semestru"/></label>
        {!folderEditing&&<><label className="block text-xs font-semibold">Semestru<select className={field} value={folderSemester} onChange={e=>{setFolderSemester(e.target.value);setFolderSubject('');setFolderParent('')}}>{academics.semesters.map(s=><option key={s.id} value={s.id}>Semestrul {s.number===1?'I':'II'}</option>)}</select></label><label className="block text-xs font-semibold">Materie<select className={field} value={folderSubject} onChange={e=>{setFolderSubject(e.target.value);setFolderParent('')}}><option value="">Selectează materia</option>{academics.subjects.filter(s=>s.semesterId===folderSemester).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="block text-xs font-semibold">În interiorul (opțional)<select className={field} value={folderParent} onChange={e=>setFolderParent(e.target.value)}><option value="">Rădăcina materiei</option>{folders.filter(f=>f.subjectId===folderSubject).map(f=><option key={f.id} value={f.id}>{folderPath(f,folders).map(x=>x.name).join(' / ')}</option>)}</select></label></>}
        {folderError&&<p role="alert" className="rounded-xl bg-danger/10 p-3 text-xs font-semibold text-danger">{folderError}</p>}
        <div className="flex gap-2 border-t border-line pt-4"><button type="button" onClick={()=>setFolderDialog(null)} className={`${ghost} flex-1`}>Renunță</button><button className={`${primary} flex-[1.5]`}>{folderDialog==='edit'?'Salvează numele':'Creează folderul'}</button></div></form></DialogSurface></div>}

    {opened&&!composer&&<div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 backdrop-blur-[4px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setOpened(null)}}><DialogSurface label={opened.title} onClose={()=>setOpened(null)} className={`flex max-h-[96dvh] w-full ${previewType(opened)==='pdf'?'max-w-6xl':'max-w-3xl'} flex-col rounded-t-[30px] bg-surface shadow-2xl sm:rounded-[30px]`}><header className="flex items-start gap-3 border-b border-line p-4 sm:p-5"><ItemIcon kind={opened.kind}/><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-bold">{opened.title}</h2><p className="mt-1 text-xs text-ink-soft">{subjectLabel(opened)} / {namedLocation(opened)} · {dateLabel(opened.updatedAt)}</p></div><button onClick={()=>setOpened(null)} aria-label="Închide" className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas"><I name="close"/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{opened.kind==='note'?<p className="min-h-36 whitespace-pre-wrap break-words rounded-2xl bg-canvas p-4 text-sm leading-7">{opened.content}</p>:opened.kind==='link'?<div className="rounded-2xl bg-canvas p-5"><p className="break-all text-sm text-ink-soft">{opened.url}</p><button onClick={()=>{const u=validWebUrl(opened.url||'');if(u)window.open(u,'_blank','noopener,noreferrer')}} className={`${primary} mt-4 inline-flex items-center gap-2`}><I name="external" size={17}/>Deschide site-ul</button></div>:previewError?<p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{previewError}</p>:!blobUrl?<p className="py-10 text-center text-sm text-ink-soft">Se deschide documentul...</p>:previewType(opened)==='pdf'?<Suspense fallback={<p className="py-10 text-center text-sm text-ink-soft">Se încarcă vizualizatorul PDF...</p>}><PdfReader key={opened.id} id={opened.id} src={blobUrl} title={opened.title}/></Suspense>:previewType(opened)==='image'?<img alt={opened.title} src={blobUrl} className="mx-auto max-h-[65vh] w-auto rounded-2xl object-contain"/>:<div className="rounded-2xl bg-canvas p-8 text-center text-sm text-ink-soft">Previzualizarea nu este disponibilă pentru acest format. Poți descărca fișierul.</div>}
        {opened.tags.length>0&&<div className="mt-3 flex flex-wrap gap-1.5">{opened.tags.map(t=><span key={t} className="rounded-lg bg-brand-soft px-2 py-1 text-xs text-brand-text">#{t}</span>)}</div>}
        {opened.taskId!==undefined&&<button onClick={()=>{setOpened(null);onOpenTask(opened.taskId!)}} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-text"><I name="tasks" size={16}/>Deschide taskul asociat ›</button>}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5"><button className={`${ghost} inline-flex items-center gap-2`} onClick={()=>{setOpened(null);startCreate(opened.kind,opened)}}><I name="edit" size={16}/>Editează / Mută</button>{opened.kind==='file'&&<button className={`${ghost} inline-flex items-center gap-2`} onClick={()=>void download(opened)}><I name="download" size={16}/>Descarcă</button>}<button disabled={busy} onClick={()=>void remove(opened)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-danger hover:bg-danger/10"><I name="trash" size={16}/>Șterge</button></footer>
    </DialogSurface></div>}
  </section>
}
