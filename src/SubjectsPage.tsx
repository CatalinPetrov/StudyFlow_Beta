import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { normalizedSubject, subjectMatches, type AcademicState, type Subject } from './academicModel'
import type { StudyTask } from './taskModel'
import type { StudyExam } from './calendarModel'
import type { ScheduleEntry } from './scheduleModel'
import { librarySections, sectionForCategory, type LibraryFolder, type LibraryItem, type LibrarySection } from './libraryModel'
import { occursOn, shiftedDay } from './scheduleModel'
import { DialogSurface } from './components/ui/DialogSurface'

const colors=['#0071e3','#8b5cf6','#16a085','#ed8936','#d66a89','#516a97','#e25c56','#2b8fb9']
const dateDisplay=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})
const btn='rounded-xl px-4 py-2.5 text-sm font-semibold transition'

type Props={
  academics:AcademicState
  tasks:StudyTask[]
  exams:StudyExam[]
  schedule:ScheduleEntry[]
  reference:Date
  onSaveSubject:(subject:Subject)=>boolean
  onCopySubjects:(fromSemesterId:string,toSemesterId:string,subjectIds:string[])=>void
  onArchiveSubject:(id:string, archived:boolean)=>void
  onActivateSemester:(id:string)=>void
  onNavigatePlan:(tab:'Taskuri'|'Orar'|'Calendar')=>void
  onOpenTask:(id:number)=>void
  onOpenExam:(id:string)=>void
  addRequest:number
  onAddRequestHandled:()=>void
  libraryItems:LibraryItem[]
  libraryFolders:LibraryFolder[]
  onOpenLibrary:(subjectId?:string,itemId?:string,section?:LibrarySection)=>void
  onOpenStudy:(subjectId?:string)=>void
}
function SubjectEditor({initial,semesterId,existing,onSave,onClose}:{
  initial?:Subject;semesterId:string;existing:Subject[];onSave:(s:Subject)=>boolean;onClose:()=>void
}){
  const [name,setName]=useState(initial?.name||'')
  const [professor,setProfessor]=useState(initial?.professor||'')
  const [notes,setNotes]=useState(initial?.notes||'')
  const [color,setColor]=useState(initial?.color||colors[0])
  const [error,setError]=useState('')
  const submit=(e:FormEvent)=>{
    e.preventDefault()
    if(!name.trim()) {setError('Introdu denumirea materiei.');return}
    if(existing.some(s=>s.semesterId===semesterId&&s.id!==initial?.id&&normalizedSubject(s.name)===normalizedSubject(name))){
      setError('Această materie există deja în semestrul ales.');return
    }
    const candidate:Subject={id:initial?.id||`materie-${Date.now()}-${Math.random().toString(36).slice(2)}`,semesterId,name:name.trim(),professor:professor.trim(),color,notes:notes.trim(),archived:initial?.archived??false}
    if(onSave(candidate))onClose();else setError('Nu am putut salva materia.')
  }
  const field='mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15'
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <DialogSurface label={initial?'Editează materie':'Adaugă materie'} onClose={onClose} className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px] sm:p-6">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold tracking-tight">{initial?'Editează materia':'Adaugă materie'}</h2><button onClick={onClose} aria-label="Închide" className="grid size-9 place-items-center rounded-full bg-ink/[0.05] text-xl">×</button></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Denumirea materiei *<input autoFocus required maxLength={100} className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Programare Java"/></label>
        <label className="block text-sm font-medium">Profesor <span className="font-normal text-ink-soft">(opțional)</span><input maxLength={100} className={field} value={professor} onChange={e=>setProfessor(e.target.value)} placeholder="Ex. Prof. Popescu"/></label>
        <div><p className="text-sm font-medium">Culoarea materiei</p><div className="mt-3 flex flex-wrap gap-3">{colors.map(c=><button key={c} type="button" aria-label={`Alege culoarea ${c}`} aria-pressed={color===c} onClick={()=>setColor(c)} className={`grid size-10 place-items-center rounded-full transition ${color===c?'ring-2 ring-offset-2 ring-[#1d1d1f]':''}`} style={{backgroundColor:c}}>{color===c&&<span className="text-lg font-bold text-white">✓</span>}</button>)}</div></div>
        <label className="block text-sm font-medium">Notițe despre materie <span className="font-normal text-ink-soft">(opțional)</span><textarea rows={3} maxLength={1200} className={field} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalii pe care vrei să le păstrezi..."/></label>
        {error&&<p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} className={`${btn} flex-1 bg-canvas`}>Renunță</button><button className={`${btn} flex-[1.6] bg-brand text-white`}>{initial?'Salvează modificările':'Adaugă materia'}</button></div>
      </form>
    </DialogSurface>
  </div>
}

export function SubjectsPage({academics,tasks,exams,schedule,reference,onSaveSubject,onCopySubjects,onArchiveSubject,onActivateSemester,onNavigatePlan,onOpenTask,onOpenExam,addRequest,onAddRequestHandled,libraryItems,libraryFolders,onOpenLibrary,onOpenStudy}:Props){
  const [viewId,setViewId]=useState(academics.activeSemesterId)
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const [editing,setEditing]=useState<Subject|'new'|null>(null)
  const [showArchive,setShowArchive]=useState(false)
  const [copyOpen,setCopyOpen]=useState(false)
  const [copyIds,setCopyIds]=useState<string[]>([])
  useEffect(()=>{if(addRequest){setViewId(academics.activeSemesterId);setSelectedId(null);setEditing('new');onAddRequestHandled()}},[addRequest])
  const sem=academics.semesters.find(s=>s.id===viewId)||academics.semesters[0]
  const subjects=academics.subjects.filter(s=>s.semesterId===sem.id)
  const visible=subjects.filter(s=>showArchive||!s.archived)
  const selected=selectedId?subjects.find(s=>s.id===selectedId):undefined
  const semIsActive=sem.id===academics.activeSemesterId
  const linked=(s:Subject)=>({
    tasks:tasks.filter(t=>subjectMatches(t,s)),
    exams:exams.filter(e=>subjectMatches(e,s)),
    schedule:schedule.filter(e=>subjectMatches(e,s)),
  })
  const activeTaskTotal=subjects.reduce((n,s)=>n+linked(s).tasks.filter(t=>!t.done).length,0)
  const examTotal=subjects.reduce((n,s)=>n+linked(s).exams.length,0)
  const confirmActivate=()=>{
    if(!window.confirm(`Setezi „${sem.settings.name}” ca semestru curent? Home și Orarul vor folosi programul acestui semestru. Informațiile vechi rămân salvate.`))return
    onActivateSemester(sem.id)
  }
  const firstSemester=academics.semesters.find(s=>s.number===1)
  const copyCandidates=academics.subjects.filter(s=>s.semesterId===firstSemester?.id&&!s.archived&&!subjects.some(there=>normalizedSubject(there.name)===normalizedSubject(s.name)))
  const groups=useMemo(()=>academics.semesters.map(s=>({id:s.id,name:s.settings.name,number:s.number})),[academics.semesters])

  if(selected){
    const items=linked(selected)
    const materials=libraryItems.filter(m=>m.subjectId===selected.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
    const upcoming=items.exams.filter(e=>new Date(`${e.date}T${e.time||'23:59'}:00`).getTime()>=reference.getTime()).sort((a,b)=>a.date.localeCompare(b.date))
    const nextMeeting=(()=>{
      for(let i=0;i<130;i++){
        const day=shiftedDay(reference,i)
        const matches=items.schedule.filter(entry=>occursOn(entry,day,sem.settings)&&(!i || entry.endTime>`${String(reference.getHours()).padStart(2,'0')}:${String(reference.getMinutes()).padStart(2,'0')}`)).sort((a,b)=>a.startTime.localeCompare(b.startTime))
        if(matches.length)return {date:day,entry:matches[0]}
      }
      return null
    })()
    return <section className="space-y-5">
      <button className="text-sm font-semibold text-brand-text" onClick={()=>setSelectedId(null)}>‹ Înapoi la Materii</button>
      <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
        <div className="flex items-start gap-3"><div className="grid size-14 shrink-0 place-items-center rounded-2xl text-2xl font-semibold" style={{backgroundColor:`${selected.color}1a`,color:selected.color}}>{selected.name[0]?.toUpperCase()}</div><div className="min-w-0 flex-1"><h1 className="text-2xl font-bold tracking-tight">{selected.name}</h1><p className="mt-1 text-xs text-ink-soft">{sem.settings.name}{selected.professor?` · ${selected.professor}`:''}</p></div><button className={`${btn} bg-canvas`} onClick={()=>setEditing(selected)}>Editează</button></div>
        {selected.notes&&<p className="mt-4 whitespace-pre-wrap text-sm text-ink-soft">{selected.notes}</p>}
        <div className="mt-5 grid grid-cols-3 gap-2">{[{number:items.tasks.filter(t=>!t.done).length,label:'Taskuri active'},{number:items.schedule.length,label:'Activități'},{number:items.exams.length,label:'Examene'}].map(m=><div key={m.label} className="rounded-2xl bg-canvas p-3 text-center"><p className="text-xl font-bold tabular-nums">{m.number}</p><p className="mt-1 text-[11px] text-ink-soft">{m.label}</p></div>)}</div>
      </div>
      <button onClick={()=>onOpenStudy(selected.id)} className="flex w-full items-center gap-3 rounded-3xl border border-brand/20 bg-gradient-to-r from-brand-soft to-surface px-5 py-4 text-left transition hover:shadow-md"><span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-xl text-brand-text">✦</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Învață pentru {selected.name}</span><span className="mt-1 block text-xs text-ink-soft">Flashcards și Focus, conectate cu materia</span></span><span className="text-lg font-semibold text-brand-text">›</span></button>
      <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Taskuri active</h2><button className="text-xs font-semibold text-brand-text" onClick={()=>onNavigatePlan('Taskuri')}>Vezi toate ›</button></div>
        {items.tasks.filter(t=>!t.done).length?items.tasks.filter(t=>!t.done).slice(0,3).map(t=><button key={t.id} onClick={()=>onOpenTask(t.id)} className="mb-2 flex w-full items-center justify-between gap-3 rounded-2xl bg-canvas px-3 py-3 text-left text-sm"><span className="font-medium">{t.title}</span><span className="shrink-0 text-xs text-ink-soft">{t.dueDate?dateDisplay(t.dueDate):'Fără termen'}</span></button>):<p className="text-sm text-ink-soft">Nu există taskuri active pentru această materie.</p>}
      </div>
      <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Următoarea activitate</h2><button className="text-xs font-semibold text-brand-text" onClick={()=>onNavigatePlan('Orar')}>Vezi orarul ›</button></div>
        {nextMeeting?<div className="rounded-2xl bg-canvas p-3"><p className="font-semibold">{nextMeeting.entry.kind} · {nextMeeting.entry.startTime}–{nextMeeting.entry.endTime}</p><p className="mt-1 text-xs text-ink-soft">{nextMeeting.date.toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}{nextMeeting.entry.room?` · ${nextMeeting.entry.room}`:''}</p></div>:<p className="text-sm text-ink-soft">Nu există o activitate viitoare în orarul configurat.</p>}
      </div>
      <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Examene</h2><button className="text-xs font-semibold text-brand-text" onClick={()=>onNavigatePlan('Calendar')}>Vezi calendarul ›</button></div>
        {upcoming.length?upcoming.slice(0,2).map(e=><button key={e.id} onClick={()=>onOpenExam(e.id)} className="mb-2 flex w-full justify-between gap-3 rounded-2xl bg-canvas p-3 text-left text-sm"><span className="font-medium">{e.title||'Examen'}</span><span className="shrink-0 text-xs text-ink-soft">{dateDisplay(e.date)}</span></button>):<p className="text-sm text-ink-soft">Nu ai examene viitoare pentru această materie.</p>}
      </div>
      <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">Biblioteca materiei <span className="text-xs font-normal text-ink-soft">({materials.length})</span></h2><button onClick={()=>onOpenLibrary(selected.id)} className="text-xs font-semibold text-brand-text">Deschide Library ›</button></div>
        <p className="mb-3 text-xs text-ink-soft">Cursuri, seminare, laboratoare și teme — fiecare la locul lui.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {librarySections.map(section=>{const count=materials.filter(m=>!m.folderId&&sectionForCategory(m.category)===section.id).length;return <button key={section.id} onClick={()=>onOpenLibrary(selected.id,undefined,section.id)} className="flex items-center gap-2 rounded-2xl bg-canvas px-3 py-3 text-left transition hover:bg-ink/[0.07]"><span className="grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{color:section.color,backgroundColor:`${section.color}13`}}>{section.id==='curs'?'C':section.id==='seminar'?'S':section.id==='laborator'?'L':section.id==='teme'?'T':'G'}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{section.label}</span><span className="text-[11px] text-ink-soft">{count} materiale</span></span></button>})}
        </div>
        {libraryFolders.some(f=>f.subjectId===selected.id)&&<div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink-soft">Foldere personale:</span>{libraryFolders.filter(f=>f.subjectId===selected.id&&!f.parentId).slice(0,4).map(f=><button key={f.id} onClick={()=>onOpenLibrary(selected.id)} className="rounded-xl bg-brand/5 px-2.5 py-1.5 text-xs font-semibold text-brand-text">▣ {f.name}</button>)}</div>}
        <div className="mt-4 border-t border-line pt-3"><p className="mb-2 text-xs font-semibold">Materiale recente</p>{materials.length?materials.slice(0,3).map(m=><button key={m.id} onClick={()=>onOpenLibrary(selected.id,m.id)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-canvas px-3 py-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg text-brand-text">{m.kind==='file'?'▤':m.kind==='note'?'✎':'↗'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{m.title}</span><span className="block truncate text-xs text-ink-soft">{libraryFolders.find(f=>f.id===m.folderId)?.name||librarySections.find(s=>s.id===sectionForCategory(m.category))?.label}</span></span><span className="text-ink-soft">›</span></button>):<p className="text-sm text-ink-soft">Nu există materiale încă. Încarcă prima temă sau primul curs.</p>}</div>
        <button onClick={()=>onOpenLibrary(selected.id)} className="mt-2 rounded-xl bg-brand/10 px-3.5 py-2.5 text-xs font-semibold text-brand-text">+ Adaugă material sau folder</button></div>
      <button onClick={()=>onArchiveSubject(selected.id,!selected.archived)} className="text-sm font-semibold text-ink-soft">{selected.archived?'Reactivează materia':'Arhivează materia'}</button>
      {editing&&<SubjectEditor initial={editing==='new'?undefined:editing} semesterId={sem.id} existing={academics.subjects} onSave={onSaveSubject} onClose={()=>setEditing(null)}/>}
    </section>
  }
  return <section className="space-y-5">
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Materiile mele</h1><p className="mt-1 text-sm text-ink-soft">An universitar {academics.academicYear}</p></div><button onClick={()=>setEditing('new')} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-2xl font-light text-white shadow-sm" aria-label="Adaugă materie">+</button></header>
    <div className="flex gap-1 rounded-2xl bg-ink/[0.05] p-1">{groups.map(g=><button key={g.id} onClick={()=>{setViewId(g.id);setSelectedId(null);setShowArchive(false)}} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${viewId===g.id?'bg-surface text-ink shadow-sm':'text-ink-soft'}`}>Semestrul {g.number===1?'I':'II'}</button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{sem.settings.name}</p><p className="text-xs text-ink-soft">{semIsActive?'Semestrul curent':'Vizualizezi un alt semestru — Home nu se schimbă'}</p></div>{!semIsActive&&<button className="rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-text" onClick={confirmActivate}>Activează semestrul</button>}</div>
    <div className="grid grid-cols-3 gap-2">{[{number:subjects.filter(s=>!s.archived).length,label:'Materii'},{number:activeTaskTotal,label:'Taskuri active'},{number:examTotal,label:'Examene'}].map(metric=><div key={metric.label} className="rounded-2xl bg-surface p-3 text-center shadow-sm ring-1 ring-line"><p className="text-xl font-bold tabular-nums">{metric.number}</p><p className="mt-1 text-[11px] text-ink-soft">{metric.label}</p></div>)}</div>
    <div className="flex items-center justify-between"><h2 className="font-semibold">Discipline</h2><button onClick={()=>setShowArchive(v=>!v)} className="text-xs font-semibold text-ink-soft">{showArchive?'Ascunde arhivatele':'Arată arhivatele'}</button></div>
    {visible.length?<div className="grid gap-3 sm:grid-cols-2">{visible.map(s=>{const related=linked(s);return <button key={s.id} onClick={()=>setSelectedId(s.id)} className={`flex items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-line transition hover:shadow-md ${s.archived?'opacity-60':''}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-[15px] text-xl font-semibold" style={{backgroundColor:`${s.color}18`,color:s.color}}>{s.name[0]?.toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="mt-0.5 block truncate text-xs text-ink-soft">{s.professor||'Profesor nespecificat'}</span><span className="mt-1 block text-[11px] text-ink-soft">{related.tasks.filter(t=>!t.done).length} taskuri active{s.archived?' · Arhivată':''}</span></span><span className="text-ink-soft">›</span>
    </button>})}</div>:<div className="rounded-3xl border border-dashed border-line bg-surface/70 p-8 text-center"><p className="font-semibold">Încă nu ai materii aici</p><p className="mt-1 text-sm text-ink-soft">Adaugă prima disciplină pentru semestrul selectat.</p><button onClick={()=>setEditing('new')} className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ Adaugă materie</button></div>}
    {sem.number===2&&copyCandidates.length>0&&<button onClick={()=>{setCopyIds([]);setCopyOpen(true)}} className="w-full rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-left text-sm font-semibold text-brand-text">Copiază selectiv materii din Semestrul I ›</button>}
    <p className="text-xs leading-relaxed text-ink-soft">Datele din semestrul anterior rămân salvate. Un semestru nou are propriul orar, care începe de la săptămâna 1 (impară).</p>
    {copyOpen&&firstSemester&&<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setCopyOpen(false)}}>
      <DialogSurface label="Copiază materii" onClose={()=>setCopyOpen(false)} className="w-full max-w-md rounded-t-[30px] bg-surface p-6 shadow-2xl sm:rounded-[30px]">
        <h2 className="text-xl font-bold">Copiază materii</h2><p className="mt-2 text-sm text-ink-soft">Alege disciplinele care continuă în Semestrul II. Se copiază numele, profesorul, culoarea și notițele; orarul, taskurile și examenele NU se copiază.</p>
        <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">{copyCandidates.map(item=><label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-canvas p-3 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={copyIds.includes(item.id)} onChange={e=>setCopyIds(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/><span>{item.name}</span></label>)}</div>
        <div className="mt-5 flex gap-2"><button className={`${btn} flex-1 bg-canvas`} onClick={()=>setCopyOpen(false)}>Renunță</button><button disabled={!copyIds.length} className={`${btn} flex-[1.7] bg-brand text-white disabled:opacity-50`} onClick={()=>{onCopySubjects(firstSemester.id,sem.id,copyIds);setCopyOpen(false);setCopyIds([])}}>Copiază {copyIds.length} {copyIds.length===1?'materie':'materii'}</button></div>
      </DialogSurface>
    </div>}
    {editing&&<SubjectEditor initial={editing==='new'?undefined:editing} semesterId={sem.id} existing={academics.subjects} onSave={onSaveSubject} onClose={()=>setEditing(null)}/>}
  </section>
}
