import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  accentFor, blankSemester, conflicts, dateFromKey, inVacation, isConfigured, keyOf, monday, occursOn,
  recurrenceLabels, romanianDays, shiftedDay, shortDays, weekday, weekInfo,
  type Recurrence, type ScheduleEntry, type ScheduleKind, type SemesterSettings, type Vacation,
} from './scheduleModel'
import { DialogSurface } from './components/ui/DialogSurface'

type Props = {
  settings: SemesterSettings
  entries: ScheduleEntry[]
  reference: Date
  newRequest: boolean
  subjects: string[]
  onRequestHandled: ()=>void
  onSettings: (settings: SemesterSettings)=>void
  onEntries: (entries: ScheduleEntry[])=>void
}
const field='w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10'
const label='mb-1 block text-xs font-semibold text-ink-soft'
const primary='rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50'
const secondary='rounded-xl bg-canvas px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover'
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function Overlay({ title, onClose, children }: {title:string; onClose:()=>void; children:ReactNode}) {
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[4px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <DialogSurface label={title} onClose={onClose} className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-surface px-5 pb-8 pt-5 shadow-2xl sm:max-h-[90vh] sm:rounded-[26px] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold tracking-tight">{title}</h2><button className="grid size-9 place-items-center rounded-full bg-ink/[0.05] text-lg" onClick={onClose} aria-label="Închide">×</button></div>
      {children}
    </DialogSurface>
  </div>
}

function SemesterEditor({ settings, onSave, onClose }: { settings:SemesterSettings;onSave:(s:SemesterSettings)=>void;onClose:()=>void}) {
  const [name,setName]=useState(settings.name)
  const [startDate,setStartDate]=useState(settings.startDate)
  const [endDate,setEndDate]=useState(settings.endDate)
  const [academicYearEndDate,setAcademicYearEndDate]=useState(settings.academicYearEndDate??'')
  const [vacations,setVacations]=useState<Vacation[]>(settings.vacations)
  const [newName,setNewName]=useState('Vacanță')
  const [newStart,setNewStart]=useState('')
  const [newEnd,setNewEnd]=useState('')
  const [error,setError]=useState('')
  const addVacation=()=>{
    if(!newStart||!newEnd||newStart>newEnd){setError('Alege un interval valid pentru vacanță.');return}
    setVacations(v=>[...v,{id:id(),name:newName.trim()||'Vacanță',startDate:newStart,endDate:newEnd}])
    setNewStart('');setNewEnd('');setNewName('Vacanță');setError('')
  }
  const submit=(event:FormEvent)=>{
    event.preventDefault()
    if(!startDate||!endDate||startDate>endDate){setError('Alege date valide pentru începutul și sfârșitul semestrului.');return}
    if(academicYearEndDate && academicYearEndDate<endDate){setError('Finalul anului universitar nu poate fi înaintea sfârșitului semestrului.');return}
    if(vacations.some(v=>v.startDate<v.endDate? v.startDate<startDate||v.endDate>endDate : v.startDate<startDate||v.endDate>endDate)){
      setError('Vacanțele trebuie să se afle în intervalul semestrului.');return
    }
    setError('');onSave({name:name.trim()||'Semestrul curent',startDate,endDate,academicYearEndDate,vacations});onClose()
  }
  return <Overlay title="Configurare semestru" onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">Prima săptămână de cursuri este săptămâna 1. Săptămânile de vacanță integrală nu se numără.</p>
      <div><label className={label}>Denumire semestru</label><input className={field} value={name} onChange={e=>setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Început cursuri *</label><input required type="date" className={field} value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
        <div><label className={label}>Sfârșit cursuri *</label><input required type="date" min={startDate||undefined} className={field} value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
      </div>
      <div>
        <label className={label}>Ultima zi a anului universitar (pentru numărătoare)</label>
        <input type="date" min={endDate||undefined} className={field} value={academicYearEndDate} onChange={e=>setAcademicYearEndDate(e.target.value)} />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">Este separată de sfârșitul semestrului. De aici calculăm lunile, săptămânile, zilele, orele, minutele și secundele rămase.</p>
      </div>
      <section className="rounded-2xl bg-canvas p-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Vacanțe și zile libere</h3><span className="text-[11px] text-ink-soft">{vacations.length} intervale</span></div>
        <p className="mb-3 text-xs leading-relaxed text-ink-soft">Orele nu se țin în zilele libere. Dacă toate zilele luni–vineri sunt în vacanță, săptămâna se sare din numerotare.</p>
        {vacations.map(v=><div key={v.id} className="mb-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs"><div className="min-w-0 flex-1"><strong className="block truncate">{v.name}</strong><span className="text-ink-soft">{v.startDate} – {v.endDate}</span></div><button type="button" onClick={()=>setVacations(all=>all.filter(x=>x.id!==v.id))} className="text-danger">Șterge</button></div>)}
        <div className="space-y-2"><input aria-label="Numele vacanței" className={field} placeholder="Nume: Vacanța de iarnă" value={newName} onChange={e=>setNewName(e.target.value)}/>
          <div className="grid grid-cols-2 gap-2"><input aria-label="Început vacanță" className={field} type="date" value={newStart} onChange={e=>setNewStart(e.target.value)}/><input aria-label="Sfârșit vacanță" className={field} type="date" min={newStart||undefined} value={newEnd} onChange={e=>setNewEnd(e.target.value)}/></div>
          <button type="button" className="text-sm font-semibold text-brand-text" onClick={addVacation}>+ Adaugă interval liber</button>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Anulează</button><button type="submit" className={primary}>Salvează semestrul</button></div>
    </form>
  </Overlay>
}

function ActivityEditor({ entry, entries, day, subjects, onSave, onDelete, onClose }: {
  entry?:ScheduleEntry;entries:ScheduleEntry[];day:Date;subjects:string[];
  onSave:(entry:ScheduleEntry)=>void;onDelete:(entry:ScheduleEntry)=>void;onClose:()=>void
}) {
  const [subject,setSubject]=useState(entry?.subject??'')
  const [kind,setKind]=useState<ScheduleKind>(entry?.kind??'Curs')
  const [dayIndex,setDayIndex]=useState(entry?.weekday??weekday(day))
  const [startTime,setStartTime]=useState(entry?.startTime??'10:00')
  const [endTime,setEndTime]=useState(entry?.endTime??'11:30')
  const [room,setRoom]=useState(entry?.room??'')
  const [professor,setProfessor]=useState(entry?.professor??'')
  const [recurrence,setRecurrence]=useState<Recurrence>(entry?.recurrence??'weekly')
  const [error,setError]=useState('')
  const candidate:ScheduleEntry={id:entry?.id??'new',subject,kind,weekday:dayIndex,startTime,endTime,room,professor,recurrence}
  const overlapping=entries.filter(other=>conflicts(candidate,other))
  const save=(event:FormEvent)=>{
    event.preventDefault()
    if(!subject.trim()) {setError('Introdu numele materiei.');return}
    if(startTime>=endTime) {setError('Ora de sfârșit trebuie să fie după ora de început.');return}
    setError('');onSave({...candidate,subject:subject.trim(),room:room.trim(),professor:professor.trim(),id:entry?.id??id()});onClose()
  }
  return <Overlay title={entry?'Editează activitatea':'Adaugă activitate'} onClose={onClose}>
    <form onSubmit={save} className="space-y-4">
      <div><label className={label}>Materie *</label><input list="studyflow-subject-options" autoFocus required className={field} placeholder="Ex. Programare Java" value={subject} onChange={e=>setSubject(e.target.value)} /><datalist id="studyflow-subject-options">{subjects.map(s=><option key={s} value={s}/>)}</datalist></div>
      <div><label className={label}>Tip activitate</label><div className="grid grid-cols-3 gap-2">{(['Curs','Seminar','Laborator'] as ScheduleKind[]).map(k=><button key={k} type="button" onClick={()=>setKind(k)} className={`rounded-xl px-2 py-2.5 text-xs font-semibold ${k===kind?'bg-brand/10 text-brand-text ring-1 ring-brand/30':'bg-canvas text-ink-soft'}`}>{k}</button>)}</div></div>
      <div><label className={label}>Ziua săptămânii</label><select className={field} value={dayIndex} onChange={e=>setDayIndex(Number(e.target.value))}>{romanianDays.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><div><label className={label}>De la *</label><input required type="time" className={field} value={startTime} onChange={e=>setStartTime(e.target.value)}/></div><div><label className={label}>Până la *</label><input required type="time" className={field} value={endTime} onChange={e=>setEndTime(e.target.value)}/></div></div>
      <div className="grid grid-cols-2 gap-3"><div><label className={label}>Sală (opțional)</label><input className={field} placeholder="Ex. Lab 204" value={room} onChange={e=>setRoom(e.target.value)}/></div><div><label className={label}>Profesor (opțional)</label><input className={field} placeholder="Ex. Prof. Ionescu" value={professor} onChange={e=>setProfessor(e.target.value)}/></div></div>
      <div><label className={label}>Repetare</label><select className={field} value={recurrence} onChange={e=>setRecurrence(e.target.value as Recurrence)}>{Object.entries(recurrenceLabels).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></div>
      {overlapping.length>0 && <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">Atenție: se suprapune cu {overlapping.map(e=>e.subject).join(', ')}. Poți salva dacă suprapunerea este intenționată.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {entry ? <button type="button" onClick={()=>{if(window.confirm('Ștergi această activitate din întregul orar?')) {onDelete(entry);onClose()}}} className="text-sm font-semibold text-danger">Șterge activitatea</button>:<span/>}
        <div className="flex gap-2"><button type="button" className={secondary} onClick={onClose}>Anulează</button><button type="submit" className={primary}>{overlapping.length?'Salvează oricum':'Salvează'}</button></div>
      </div>
    </form>
  </Overlay>
}

function ClassCard({ entry, active, onClick }: {entry:ScheduleEntry;active:boolean;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active?'border-line bg-surface':'border-dashed border-line bg-ink/[0.025] opacity-45'}`}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-soft"><span className="font-semibold tabular-nums">{entry.startTime} – {entry.endTime}</span><span>{entry.recurrence==='weekly'?'':'· '+recurrenceLabels[entry.recurrence]}</span></div>
    <div className="flex gap-2.5"><div className="w-[3px] shrink-0 rounded-full" style={{background:active?accentFor(entry.subject):'#b7b7bb'}}/><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-snug">{entry.subject}</p><p className="mt-1 text-xs text-ink-soft">{entry.kind}{entry.room?` · ${entry.room}`:''}</p>{entry.professor&&<p className="mt-0.5 truncate text-[11px] text-ink-soft">{entry.professor}</p>}{!active&&<p className="mt-1 text-[11px]">Nu se ține</p>}</div></div>
  </button>
}

/** Calcul exact pe luni calendaristice, apoi săptămâni, zile, ore, minute și secunde.
 * Numărătoarea se încheie la 23:59:59, ora locală, în ultima zi selectată.
 */
export function timeLeftUntilAcademicYearEnd(now:Date, endDate:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null
  const target = new Date(`${endDate}T23:59:59`)
  if (Number.isNaN(target.getTime())) return null
  if (now.getTime()>target.getTime()) return {months:0,weeks:0,days:0,hours:0,minutes:0,seconds:0,finished:true}
  let cursor = new Date(now)
  let months = 0
  // Număr de luni calendaristice complete; păstrăm ziua/luna de pornire.
  const plusMonths=(date:Date, num:number) => {
    const y=date.getFullYear(),m=date.getMonth()+num
    const monthLastDay=new Date(y,m+1,0).getDate()
    return new Date(y,m,Math.min(date.getDate(),monthLastDay),date.getHours(),date.getMinutes(),date.getSeconds(),date.getMilliseconds())
  }
  while (months<120) {
    const candidate=plusMonths(now,months+1)
    if(candidate>target) break
    months++;cursor=candidate
  }
  const plusDays=(date:Date, count:number)=>{
    const result=new Date(date)
    result.setDate(result.getDate()+count)
    return result
  }
  let weeks=0
  while (weeks<540 && plusDays(cursor,7)<=target) { cursor=plusDays(cursor,7);weeks++ }
  let days=0
  while (days<7 && plusDays(cursor,1)<=target) { cursor=plusDays(cursor,1);days++ }
  const restSeconds=Math.floor((target.getTime()-cursor.getTime())/1000)
  return {months,weeks,days,hours:Math.floor(restSeconds/3600),minutes:Math.floor(restSeconds%3600/60),seconds:restSeconds%60,finished:false}
}

function AcademicYearCountdown({ endDate, onConfigure }: {endDate?:string;onConfigure:()=>void}) {
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer)},[])
  const remaining=endDate ? timeLeftUntilAcademicYearEnd(now,endDate) : null
  return <section className="rounded-[26px] bg-gradient-to-br from-[#1d1d1f] via-[#232733] to-[#173c66] p-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.10)] sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Final de an universitar</p><h3 className="mt-1 text-lg font-semibold tracking-tight">{remaining?.finished?'Felicitări, ai încheiat anul!':'Mai este puțin până la vacanță'}</h3>{endDate&&<p className="mt-1 text-xs text-white/65">Ultima zi: {new Date(`${endDate}T12:00:00`).toLocaleDateString('ro-RO',{day:'numeric',month:'long',year:'numeric'})}</p>}</div><span className="text-xl" aria-hidden="true">🎓</span></div>
    {!remaining&&<div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-relaxed text-white/75">Adaugă data finalului de an în setările semestrului pentru a porni numărătoarea inversă.</p><button onClick={onConfigure} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25">Configurează data →</button></div>}
    {remaining&&!remaining.finished&&<div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Timp rămas până la finalul anului universitar">
      {([{n:remaining.months,l:'luni'},{n:remaining.weeks,l:'săptămâni'},{n:remaining.days,l:'zile'},{n:remaining.hours,l:'ore'},{n:remaining.minutes,l:'minute'},{n:remaining.seconds,l:'secunde'}]).map((part,i)=><div key={part.l} className="rounded-xl bg-white/10 px-2 py-2.5 text-center ring-1 ring-white/5"><div className="text-xl font-semibold tabular-nums tracking-tight">{String(part.n).padStart(2,'0')}</div><div className="mt-0.5 text-[10px] text-white/70">{part.l}</div></div>)}
    </div>}
    {remaining?.finished&&<p className="mt-3 text-xs text-white/80">Poți configura următorul an universitar din setări.</p>}
  </section>
}

export function PlanSchedule({ settings, entries, reference, newRequest, subjects, onSettings, onEntries, onRequestHandled }: Props) {
  const [weekStart,setWeekStart]=useState(()=>monday(reference))
  const [selectedDay,setSelectedDay]=useState(()=>weekday(reference))
  const [showInactive,setShowInactive]=useState(true)
  const [mode,setMode]=useState<'week'|'day'>('week')
  const [configOpen,setConfigOpen]=useState(false)
  const [editing,setEditing]=useState<ScheduleEntry|'new'|null>(null)
  useEffect(()=>{if(newRequest){setEditing('new');onRequestHandled()}},[newRequest,onRequestHandled])
  const weekDays=useMemo(()=>Array.from({length:7},(_,i)=>shiftedDay(weekStart,i)),[weekStart])
  const selectedDate=weekDays[selectedDay]
  const selectedInfo=weekInfo(selectedDate,settings)
  const todayKey=keyOf(reference)
  const infoLabel=selectedInfo.number?`Săptămâna ${selectedInfo.number} · ${selectedInfo.parity==='odd'?'Impară':'Pară'}`:
    selectedInfo.withinSemester?'Vacanță / pauză':'În afara semestrului'
  const changeWeek=(offset:number)=>setWeekStart(current=>shiftedDay(current,offset*7))
  const goToday=()=>{setWeekStart(monday(reference));setSelectedDay(weekday(reference))}
  const entriesFor=(date:Date)=>entries.filter(e=>e.weekday===weekday(date)).sort((a,b)=>a.startTime.localeCompare(b.startTime))
  const renderDay=(date:Date, compact=false)=>{
    const list=entriesFor(date).filter(e=>showInactive||occursOn(e,date,settings))
    const info=weekInfo(date,settings)
    const vacation=inVacation(keyOf(date),settings)
    return <div className={compact?'space-y-2':'space-y-3'}>
      {(vacation || (info.withinSemester&&!info.number))&&<p className="rounded-xl bg-canvas p-3 text-xs text-ink-soft">{vacation?.name??'Săptămână fără cursuri'} · activitățile sunt suspendate</p>}
      {list.map(e=><ClassCard key={e.id} entry={e} active={occursOn(e,date,settings)} onClick={()=>setEditing(e)}/>)}
      {list.length===0&&<div className="rounded-2xl border border-dashed border-line px-3 py-5 text-center text-xs text-ink-soft">Nicio activitate</div>}
    </div>
  }
  return <section className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Orarul meu</h2><p className="mt-1 text-xs text-ink-soft">{settings.name}</p></div>
      <div className="flex flex-wrap items-center gap-2"><button className={secondary} onClick={()=>setConfigOpen(true)}>⚙ Semestru</button><button className={primary} onClick={()=>setEditing('new')}>+ Adaugă activitate</button></div>
    </header>
    {!isConfigured(settings)&&<div className="rounded-2xl border border-brand/15 bg-brand/[0.055] p-4"><h3 className="font-semibold">Configurează mai întâi semestrul</h3><p className="mt-1 text-sm text-ink-soft">Alege datele cursurilor și eventualele vacanțe. StudyFlow va calcula automat săptămânile pare/impare.</p><button onClick={()=>setConfigOpen(true)} className="mt-3 text-sm font-semibold text-brand-text">Configurează semestrul →</button></div>}
    <section className="rounded-[26px] bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.03),0_8px_24px_rgba(0,0,0,.04)] ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">{weekDays[0].toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – {weekDays[6].toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}</p><p className={`mt-1 text-xs ${selectedInfo.number?'text-brand-text':'text-ink-soft'}`}>{infoLabel}</p></div>
        <div className="flex items-center gap-1.5"><button className={secondary+' !px-3 !py-2'} onClick={()=>changeWeek(-1)} aria-label="Săptămâna precedentă">‹</button><button className={secondary+' !px-3 !py-2'} onClick={goToday}>Astăzi</button><button className={secondary+' !px-3 !py-2'} onClick={()=>changeWeek(1)} aria-label="Săptămâna următoare">›</button></div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {weekDays.map((d,i)=>{
          const active=i===selectedDay
          const dots=entriesFor(d).filter(e=>occursOn(e,d,settings)).length
          return <button key={keyOf(d)} onClick={()=>{setSelectedDay(i);setMode('day')}} aria-pressed={active} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 transition ${active?'bg-brand/10 text-brand-text ring-1 ring-brand/20':'bg-canvas hover:bg-surface-hover'}`}><span className="text-[10px] font-semibold">{shortDays[i]}</span><span className="text-sm font-semibold tabular-nums">{d.getDate()}</span><span className={`size-1 rounded-full ${dots?'bg-brand':'bg-transparent'}`} /></button>
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">Atinge o zi pentru detalii sau alege „Săptămână” pentru toate zilele.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="inline-flex rounded-xl bg-canvas p-1"><button onClick={()=>setMode('week')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode==='week'?'bg-surface shadow-sm':'text-ink-soft'}`}>Săptămână</button><button onClick={()=>setMode('day')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode==='day'?'bg-surface shadow-sm':'text-ink-soft'}`}>Zi</button></div>
        <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} className="accent-[#0071e3]"/> Arată orele inactive</label>
      </div>
    </section>
    <AcademicYearCountdown endDate={settings.academicYearEndDate} onConfigure={()=>setConfigOpen(true)}/>
    {entries.length===0&&<div className="rounded-2xl border border-brand/15 bg-brand/[0.05] p-4"><p className="text-sm font-semibold">Orarul este gol</p><p className="mt-1 text-xs text-ink-soft">Schimbarea zilei și săptămânii funcționează, dar nu ai încă ore de afișat. Adaugă un curs sau un laborator pentru a vedea diferența.</p><button onClick={()=>setEditing('new')} className="mt-2 text-sm font-semibold text-brand-text">+ Adaugă prima activitate</button></div>}
    {/* Modul Zi: arată numai activitățile zilei selectate, pe toate ecranele. */}
    {mode==='day'&&<section className="rounded-[26px] bg-surface p-4 shadow-sm ring-1 ring-line sm:p-5">
      <div className="mb-4 flex justify-between gap-2"><h3 className="font-semibold">{romanianDays[selectedDay]}, {selectedDate.toLocaleDateString('ro-RO',{day:'numeric',month:'long'})}</h3><span className="text-xs text-ink-soft">{entriesFor(selectedDate).filter(e=>occursOn(e,selectedDate,settings)).length} activități</span></div>
      {renderDay(selectedDate)}
    </section>}
    {/* Modul Săptămână pe telefon: toate cele 7 zile, nu doar ziua selectată. */}
    {mode==='week'&&<section className="space-y-2 lg:hidden">
      {weekDays.map((date,i)=><div key={keyOf(date)} className={`rounded-2xl bg-surface p-3 shadow-sm ring-1 ${i===selectedDay?'ring-brand/20':'ring-line'}`}>
        <button type="button" onClick={()=>{setSelectedDay(i);setMode('day')}} className="mb-2 flex w-full items-center justify-between gap-3 text-left"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{romanianDays[i]}</span><span className="text-xs text-ink-soft">{date.toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}</span></div><span className="text-[11px] text-ink-soft">{entriesFor(date).filter(e=>occursOn(e,date,settings)).length} ore · Detalii ›</span></button>
        {entriesFor(date).length===0?<p className="py-1 text-xs text-ink-faint">Fără ore programate</p>:renderDay(date,true)}
      </div>)}
    </section>}
    {/* Desktop: grilă săptămânală cu toate zilele, compactă și responsivă. */}
    {mode==='week'&&<section className="hidden grid-cols-7 gap-3 lg:grid">
      {weekDays.map((date,i)=><div key={keyOf(date)} className="min-w-0 rounded-2xl bg-surface p-2.5 shadow-sm ring-1 ring-line"><div className="mb-3 text-center"><p className="text-xs font-semibold">{romanianDays[i]}</p><p className={`mt-0.5 text-xs ${todayKey===keyOf(date)?'font-bold text-brand-text':'text-ink-soft'}`}>{date.getDate()}</p></div>{renderDay(date,true)}</div>)}
    </section>}
    <p className="text-xs leading-relaxed text-ink-soft">Orele estompate nu se țin în săptămâna selectată. Poți apăsa pe orice activitate pentru editare. Datele sunt salvate momentan doar în browserul tău.</p>
    {configOpen&&<SemesterEditor settings={settings} onSave={onSettings} onClose={()=>setConfigOpen(false)}/>}
    {editing&&<ActivityEditor entry={editing==='new'?undefined:editing} entries={entries} subjects={subjects} day={selectedDate} onSave={e=>onEntries(editing==='new'?[...entries,e]:entries.map(old=>old.id===e.id?e:old))} onDelete={e=>onEntries(entries.filter(old=>old.id!==e.id))} onClose={()=>setEditing(null)}/>}
  </section>
}
