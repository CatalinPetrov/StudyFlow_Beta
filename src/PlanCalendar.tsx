import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { StudyTask } from './taskModel'
import type { ScheduleEntry, SemesterSettings } from './scheduleModel'
import { calendarColors, calendarLabels, daysInMonth, eventsForMonth, makeId, parseLocalDate, toDateKey,
  type CalendarCategory, type CalendarItem, type ExamKind, type PersonalEvent, type StudyExam } from './calendarModel'
import { DialogSurface } from './components/ui/DialogSurface'

type CalendarProps = {
  tasks: StudyTask[]
  exams: StudyExam[]
  events: PersonalEvent[]
  schedule: ScheduleEntry[]
  semester: SemesterSettings
  semesterSettingsById?: Record<string,SemesterSettings>
  reference: Date
  subjects: string[]
  onSaveExam: (exam: StudyExam) => void
  onDeleteExam: (id: string) => void
  onSaveEvent: (event: PersonalEvent) => void
  onDeleteEvent: (id: string) => void
  onOpenTask: (id: number) => void
  onOpenSchedule: () => void
  externalAdd?: { kind: 'exam' | 'event'; token: number } | null
  externalOpenExam?: { id: string; token: number } | null
  onExternalAddHandled: () => void
  onExternalExamHandled: () => void
}

const weekdays = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15'
const fieldLabel = 'block text-xs font-semibold text-ink-soft'
const examTypes: ExamKind[] = ['Scris', 'Oral', 'Practic', 'Colocviu', 'Altul']
const blankExam = (date: string): StudyExam => ({ id: makeId(), subject: '', title: 'Examen', date, time: '', room: '', kind: 'Scris', notes: '' })
const blankEvent = (date: string): PersonalEvent => ({ id: makeId(), title: '', date, time: '', location: '', notes: '' })

function CalendarDialog({ mode, date, selected, onClose, onSaveExam, onDeleteExam, onSaveEvent, onDeleteEvent, subjects }: {
  mode: 'exam' | 'event'
  date: string
  selected?: StudyExam | PersonalEvent
  subjects: string[]
  onClose: () => void
  onSaveExam: (exam: StudyExam) => void
  onDeleteExam: (id: string) => void
  onSaveEvent: (event: PersonalEvent) => void
  onDeleteEvent: (id: string) => void
}) {
  const editing = !!selected
  const [exam, setExam] = useState<StudyExam>(() => mode === 'exam' && selected ? selected as StudyExam : blankExam(date))
  const [event, setEvent] = useState<PersonalEvent>(() => mode === 'event' && selected ? selected as PersonalEvent : blankEvent(date))
  const [error, setError] = useState('')
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mode === 'exam') {
      if (!exam.subject.trim() || !exam.date) return setError('Materia și data examenului sunt obligatorii.')
      onSaveExam({ ...exam, subject: exam.subject.trim(), title: exam.title.trim() || 'Examen', room: exam.room.trim(), notes: exam.notes.trim() })
    } else {
      if (!event.title.trim() || !event.date) return setError('Titlul și data evenimentului sunt obligatorii.')
      onSaveEvent({ ...event, title: event.title.trim(), location: event.location.trim(), notes: event.notes.trim() })
    }
    onClose()
  }
  const onDelete = () => {
    if (!selected || !window.confirm('Ștergi definitiv această înregistrare?')) return
    if (mode === 'exam') onDeleteExam(selected.id)
    else onDeleteEvent(selected.id)
    onClose()
  }
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <DialogSurface label={editing?'Editează înregistrarea':'Adaugă în Calendar'} onClose={onClose} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold tracking-tight">{editing?'Editează':'Adaugă'} {mode==='exam'?'examen':'eveniment'}</h2>
        <button type="button" onClick={onClose} className="rounded-full bg-canvas px-3 py-1.5 text-sm text-ink-soft">Închide</button></div>
      <form onSubmit={submit} className="space-y-4">
        {mode==='exam'?<>
          <label className={fieldLabel}>Materie *
            <input className={inputClass} list="studyflow-calendar-subjects" required value={exam.subject} onChange={e=>setExam(x=>({...x,subject:e.target.value}))} placeholder="Ex. Programare Java" />
            <datalist id="studyflow-calendar-subjects">{subjects.map(s=><option value={s} key={s}/>)}</datalist>
          </label>
          <label className={fieldLabel}>Denumire evaluare
            <input className={inputClass} value={exam.title} onChange={e=>setExam(x=>({...x,title:e.target.value}))} placeholder="Ex. Examen final" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>Data *<input required type="date" className={inputClass} value={exam.date} onChange={e=>setExam(x=>({...x,date:e.target.value}))}/></label>
            <label className={fieldLabel}>Ora (opțional)<input type="time" className={inputClass} value={exam.time} onChange={e=>setExam(x=>({...x,time:e.target.value}))}/></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>Tip evaluare<select className={inputClass} value={exam.kind} onChange={e=>setExam(x=>({...x,kind:e.target.value as ExamKind}))}>{examTypes.map(kind=><option key={kind}>{kind}</option>)}</select></label>
            <label className={fieldLabel}>Sală / Locație<input className={inputClass} value={exam.room} onChange={e=>setExam(x=>({...x,room:e.target.value}))} placeholder="Ex. Sala A1"/></label>
          </div>
          <label className={fieldLabel}>Notițe (opțional)<textarea rows={3} className={inputClass} value={exam.notes} onChange={e=>setExam(x=>({...x,notes:e.target.value}))} placeholder="Materie de învățat, indicații etc."/></label>
        </>:<>
          <label className={fieldLabel}>Titlul evenimentului *<input required className={inputClass} value={event.title} onChange={e=>setEvent(x=>({...x,title:e.target.value}))} placeholder="Ex. Întâlnire pentru proiect"/></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldLabel}>Data *<input required type="date" className={inputClass} value={event.date} onChange={e=>setEvent(x=>({...x,date:e.target.value}))}/></label>
            <label className={fieldLabel}>Ora (opțional)<input type="time" className={inputClass} value={event.time} onChange={e=>setEvent(x=>({...x,time:e.target.value}))}/></label>
          </div>
          <label className={fieldLabel}>Locație<input className={inputClass} value={event.location} onChange={e=>setEvent(x=>({...x,location:e.target.value}))} placeholder="Opțional"/></label>
          <label className={fieldLabel}>Detalii<textarea rows={3} className={inputClass} value={event.notes} onChange={e=>setEvent(x=>({...x,notes:e.target.value}))} placeholder="Detalii opționale"/></label>
        </>}
        {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div>{editing&&<button type="button" onClick={onDelete} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10">Șterge</button>}</div>
          <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep">{editing?'Salvează modificările':'Salvează'}</button>
        </div>
      </form>
    </DialogSurface>
  </div>
}

export function PlanCalendar({ tasks, exams, events, schedule, semester, semesterSettingsById, reference, subjects, onSaveExam, onDeleteExam, onSaveEvent, onDeleteEvent, onOpenTask, onOpenSchedule, externalAdd, externalOpenExam, onExternalAddHandled, onExternalExamHandled }: CalendarProps) {
  const [month,setMonth] = useState(() => new Date(reference.getFullYear(),reference.getMonth(),1))
  const [selectedDate,setSelectedDate] = useState(() => toDateKey(reference))
  const [category,setCategory] = useState<CalendarCategory|'all'>('all')
  const [editing,setEditing] = useState<{mode:'exam'|'event'; id?:string}|null>(null)
  useEffect(()=>{if(externalAdd){setSelectedDate(toDateKey(reference));setMonth(new Date(reference.getFullYear(),reference.getMonth(),1));setEditing({mode:externalAdd.kind});onExternalAddHandled()}},[externalAdd?.token])
  useEffect(()=>{if(externalOpenExam){const x=exams.find(e=>e.id===externalOpenExam.id);if(x){setMonth(new Date(Number(x.date.slice(0,4)),Number(x.date.slice(5,7))-1,1));setSelectedDate(x.date);setEditing({mode:'exam',id:x.id})}onExternalExamHandled()}},[externalOpenExam?.token])
  const allItems = useMemo(()=>eventsForMonth(month,tasks,exams,events,schedule,semester,semesterSettingsById),[month,tasks,exams,events,schedule,semester,semesterSettingsById])
  const shown = category==='all'?allItems:allItems.filter(e=>e.category===category)
  const counts = useMemo(()=>shown.reduce<Record<string,CalendarItem[]>>((acc,e)=>{
    ;(acc[e.date]??=[]).push(e);return acc
  },{}),[shown])
  const monthDays = daysInMonth(month)
  const leading = (monthDays[0].getDay()+6)%7
  const calendarCells:(Date|null)[] = [...Array.from({length:leading},()=>null),...monthDays]
  while(calendarCells.length%7) calendarCells.push(null)
  const selectedItems = counts[selectedDate] ?? []
  const changeMonth = (delta:number) => {
    const next=new Date(month.getFullYear(),month.getMonth()+delta,1)
    setMonth(next);setSelectedDate(toDateKey(next))
  }
  const today=toDateKey(reference)
  const goToday=()=>{setMonth(new Date(reference.getFullYear(),reference.getMonth(),1));setSelectedDate(today)}
  const openItem=(item:CalendarItem)=>{
    if(item.category==='task'){onOpenTask(Number(item.sourceId));return}
    if(item.category==='class'){onOpenSchedule();return}
    setEditing({mode:item.category==='exam'?'exam':'event',id:String(item.sourceId)})
  }
  const focused=editing?.mode==='exam' ? exams.find(e=>e.id===editing.id) : events.find(e=>e.id===editing?.id)
  const saveExamAndReveal = (exam:StudyExam) => {onSaveExam(exam);setCategory('all');setMonth(new Date(Number(exam.date.slice(0,4)),Number(exam.date.slice(5,7))-1,1));setSelectedDate(exam.date)}
  const saveEventAndReveal = (event:PersonalEvent) => {onSaveEvent(event);setCategory('all');setMonth(new Date(Number(event.date.slice(0,4)),Number(event.date.slice(5,7))-1,1));setSelectedDate(event.date)}
  return <div className="max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold tracking-tight">Calendarul meu</h2><p className="mt-1 text-sm text-ink-soft">Cursuri, taskuri, examene și evenimente.</p></div>
      <div className="flex gap-2">
        <button onClick={()=>setEditing({mode:'exam'})} className="rounded-xl bg-brand px-3 py-2.5 text-xs font-semibold text-white shadow-sm sm:px-4 sm:text-sm">+ Examen</button>
        <button onClick={()=>setEditing({mode:'event'})} className="rounded-xl bg-surface px-3 py-2.5 text-xs font-semibold text-ink ring-1 ring-line sm:px-4 sm:text-sm">+ Eveniment</button>
      </div>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <section className="rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-line sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="font-bold capitalize tracking-tight sm:text-lg">{month.toLocaleDateString('ro-RO',{month:'long',year:'numeric'})}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={goToday} className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold">Astăzi</button>
            <button aria-label="Luna anterioară" onClick={()=>changeMonth(-1)} className="grid size-9 place-items-center rounded-full bg-canvas text-lg">‹</button>
            <button aria-label="Luna următoare" onClick={()=>changeMonth(1)} className="grid size-9 place-items-center rounded-full bg-canvas text-lg">›</button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {([{id:'all',label:'Toate'},{id:'exam',label:'Examene'},{id:'task',label:'Taskuri'},{id:'class',label:'Cursuri'},{id:'event',label:'Evenimente'}] as const).map(filter=><button key={filter.id} onClick={()=>setCategory(filter.id)} aria-pressed={category===filter.id}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition sm:text-xs ${category===filter.id?'bg-brand/10 text-brand-text':'bg-canvas text-ink-soft hover:text-ink'}`}>{filter.label}</button>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map(day=><div key={day} className="pb-2 text-center text-xs font-medium text-ink-soft">{day}</div>)}
          {calendarCells.map((day,i)=>{
            if(!day) return <span aria-hidden key={`gap-${i}`}/>
            const key=toDateKey(day), items=counts[key]||[], active=selectedDate===key, current=today===key
            const dots=[...new Set(items.map(e=>e.category))].slice(0,3) as CalendarCategory[]
            return <button key={key} type="button" onClick={()=>setSelectedDate(key)} aria-label={`${day.toLocaleDateString('ro-RO',{dateStyle:'long'})}, ${items.length} evenimente`} aria-pressed={active}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm transition sm:min-h-14 ${active?'bg-brand/10 text-brand-text ring-1 ring-brand/30':'hover:bg-surface-hover'} ${current&&!active?'font-semibold text-brand-text':''}`}>
              <span>{day.getDate()}</span><span className="flex h-1.5 gap-0.5">{dots.map(c=><span key={c} className="size-[5px] rounded-full" style={{background:calendarColors[c]}}/>)}</span>
            </button>
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4">
          {(Object.keys(calendarLabels) as CalendarCategory[]).map(c=><span key={c} className="flex items-center gap-1.5 text-[11px] text-ink-soft"><span className="size-2 rounded-full" style={{background:calendarColors[c]}}/>{calendarLabels[c]}</span>)}
        </div>
      </section>
      <section className="rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-line sm:p-6">
        <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold capitalize tracking-tight">{parseLocalDate(selectedDate).toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</h3><span className="text-xs text-ink-soft">{selectedItems.length} activități</span></div>
        <div className="mt-4 space-y-2.5">
          {!selectedItems.length&&<div className="rounded-2xl bg-canvas px-4 py-6 text-center text-sm text-ink-soft">Nicio activitate în această zi pentru filtrul ales.</div>}
          {selectedItems.map(item=><button key={item.id} onClick={()=>openItem(item)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-hover">
            <span className="h-10 w-1 shrink-0 rounded-full" style={{background:calendarColors[item.category]}}/>
            <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${item.completed?'text-ink-soft line-through':''}`}>{item.title}</span><span className="block truncate text-xs text-ink-soft">{calendarLabels[item.category].replace(/i$/,'')} · {item.subtitle}</span></span>
            {item.time&&<span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-soft">{item.time}</span>}
            <span className="text-ink-soft">›</span>
          </button>)}
        </div>
        <p className="mt-4 text-xs text-ink-soft">Apasă o activitate pentru detalii. Taskurile se editează în Plan → Taskuri, iar orele în Plan → Orar.</p>
      </section>
    </div>
    {editing&&<CalendarDialog key={`${editing.mode}-${editing.id||'new'}-${selectedDate}`} mode={editing.mode} date={selectedDate} selected={focused} onClose={()=>setEditing(null)} subjects={subjects} onSaveExam={saveExamAndReveal} onDeleteExam={onDeleteExam} onSaveEvent={saveEventAndReveal} onDeleteEvent={onDeleteEvent}/>}
  </div>
}
