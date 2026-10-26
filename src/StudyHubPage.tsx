import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Subject } from './academicModel'
import type { StudyTask } from './taskModel'
import {
  createFocusTimer, createId, defaultFocusSettings, isCards, isDecks,
  isDue, isSessions, isTimer, localDay, nextPhase, persist, readSaved,
  scheduleReview, secondsForPhase, studyHubStorage, validSettings,
  type Flashcard, type FocusPhase, type FocusSession, type FocusSettings,
  type FocusTimer, type ReviewGrade, type StudyDeck,
} from './studyHubModel'
import { DialogSurface } from './components/ui/DialogSurface'
import { initializeStudyHubData } from './data/migration'
import { getMeta, META_KEYS, saveCards, saveDecks, saveFocusSessions } from './data/db'

const tile='rounded-[26px] border border-line bg-surface shadow-[0_5px_24px_rgba(28,40,69,0.035)]'
const subtle='rounded-2xl bg-canvas'
function dateLabel(value:string){return new Date(`${value}T12:00:00`).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}
function clockText(seconds:number){const s=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function fmtMinutes(seconds:number){const m=Math.round(seconds/60);return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m} min`}
function PhaseIcon({phase}:{phase:FocusPhase}){return <span aria-hidden>{phase==='focus'?'✦':phase==='short'?'☕':'☁'}</span>}
function SettingNumber({label,value,onChange,min,max,suffix='min',hint}:{label:string;value:number;onChange:(n:number)=>void;min:number;max:number;suffix?:string;hint?:string}){
  return <label className={`${subtle} flex flex-col gap-1 p-3.5`}><span className="text-[12px] font-semibold text-ink-soft">{label}</span><span className="flex items-center gap-1.5"><input aria-label={label} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))} className="w-full min-w-0 bg-transparent text-lg font-bold tabular-nums outline-none"/><span className="text-xs text-ink-soft">{suffix}</span></span>{hint&&<span className="text-[11px] text-ink-soft">{hint}</span>}</label>
}

export function StudyHubPage({subjects,tasks,initialSubjectId,initialTaskId,onBack}:{subjects:Subject[];tasks:StudyTask[];initialSubjectId?:string;initialTaskId?:number|null;onBack:()=>void}){
  const [tab,setTab]=useState<'flashcards'|'focus'>('flashcards')
  const [decks,setDecks]=useState<StudyDeck[]>([])
  const [cards,setCards]=useState<Flashcard[]>([])
  const [ready,setReady]=useState(false)
  const [chosenDeck,setChosenDeck]=useState('')
  const [deckModal,setDeckModal]=useState(false)
  const [deckName,setDeckName]=useState('')
  const [deckSubject,setDeckSubject]=useState(initialSubjectId||'')
  const [cardModal,setCardModal]=useState(false)
  const [editingCardId,setEditingCardId]=useState<string|null>(null)
  const [front,setFront]=useState('')
  const [back,setBack]=useState('')
  const [flipped,setFlipped]=useState(false)
  const [sessionDeck,setSessionDeck]=useState<string|null>(null)
  const [sessionQueue,setSessionQueue]=useState<string[]>([])
  const [reviewed,setReviewed]=useState(0)
  const [settings,setSettings]=useState<FocusSettings>(defaultFocusSettings)
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [settingsDraft,setSettingsDraft]=useState(defaultFocusSettings)
  const [timer,setTimer]=useState<FocusTimer>(()=>createFocusTimer(defaultFocusSettings))
  const [sessions,setSessions]=useState<FocusSession[]>([])
  const [now,setNow]=useState(()=>Date.now())
  const [toast,setToast]=useState('')
  const completedRef=useRef<string>('')
  const subjectList=useMemo(()=>subjects.filter(s=>!s.archived),[subjects])
  const focusTasks=tasks.filter(t=>!t.done && (!timer.subjectId||t.subjectId===timer.subjectId))
  useEffect(()=>{let active=true;void initializeStudyHubData().then(data=>{if(!active)return;setDecks(data.decks);setCards(data.cards);setSessions(data.sessions);setSettings(data.settings);setTimer(data.timer);setSettingsDraft(data.settings);setReady(true)});return()=>{active=false}},[])
  useEffect(()=>{if(initialSubjectId){setDeckSubject(initialSubjectId);setTimer(t=>t.runningUntil?t:{...t,subjectId:initialSubjectId})}},[initialSubjectId])
  useEffect(()=>{if(initialTaskId){const task=tasks.find(t=>t.id===initialTaskId);const sub=task?subjects.find(s=>!s.archived&&s.name.toLowerCase()===task.subject.toLowerCase()):null;setTab('focus');setTimer(t=>t.runningUntil?t:{...t,subjectId:sub?.id||t.subjectId,taskId:initialTaskId});window.scrollTo({top:0})}},[initialTaskId,tasks,subjects])
  useEffect(()=>{if(ready)void saveDecks(decks)},[decks,ready])
  useEffect(()=>{if(ready)void saveCards(cards)},[cards,ready])
  useEffect(()=>{if(ready)void saveFocusSessions(sessions)},[sessions,ready])
  useEffect(()=>{if(ready)void import('./studyHubModel').then(m=>m.persist(studyHubStorage.focusSettings,settings))},[settings,ready])
  useEffect(()=>{if(ready)void import('./studyHubModel').then(m=>m.persist(studyHubStorage.focusTimer,timer))},[timer,ready])
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(id)},[])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),3800);return()=>clearTimeout(id)},[toast])

  const playSound=()=>{
    if(!settings.sound)return
    try {
      const AudioCtx=(window as typeof window & {webkitAudioContext?:typeof AudioContext}).AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext
      if(!AudioCtx)return
      const ctx=new AudioCtx();const tone=ctx.createOscillator();const gain=ctx.createGain()
      tone.type='sine';tone.frequency.value=740;gain.gain.setValueAtTime(.0001,ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.3)
      tone.connect(gain);gain.connect(ctx.destination);tone.start();tone.stop(ctx.currentTime+.32)
      tone.onended=()=>{void ctx.close()}
    }catch{ /* sunetele pot fi blocate de browser */ }
  }
  const remaining=timer.runningUntil===null?timer.remainingSeconds:Math.max(0,Math.ceil((timer.runningUntil-now)/1000))
  useEffect(()=>{
    if(timer.runningUntil===null||timer.runningUntil>now)return
    const endKey=`${timer.phase}-${timer.runningUntil}`
    if(completedRef.current===endKey)return
    completedRef.current=endKey
    const endedAt=new Date(timer.runningUntil)
    if(timer.phase==='focus'){
      const record:FocusSession={id:createId('focus'),endedAt:endedAt.toISOString(),seconds:timer.totalSeconds,subjectId:timer.subjectId,taskId:timer.taskId}
      setSessions(s=>s.some(x=>x.endedAt===record.endedAt&&x.seconds===record.seconds)?s:[...s,record])
    }
    playSound()
    const cycles=timer.completedFocusCycles+(timer.phase==='focus'?1:0)
    const upcoming=nextPhase(timer.phase,cycles,settings)
    const seconds=secondsForPhase(upcoming,settings)
    setTimer(t=>({...t,phase:upcoming,completedFocusCycles:cycles,remainingSeconds:seconds,totalSeconds:seconds,runningUntil:settings.autoStartNext?Date.now()+seconds*1000:null}))
    setToast(timer.phase==='focus'?'Sesiune completă! Meriți o pauză.':'Pauza s-a încheiat. Pregătit pentru Focus?')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[now,timer,settings])

  const selectedDeck=decks.find(d=>d.id===chosenDeck)
  const visibleCards=cards.filter(c=>c.deckId===chosenDeck)
  const dueCards=visibleCards.filter(c=>isDue(c))
  const allDue=cards.filter(c=>isDue(c)&&decks.some(d=>d.id===c.deckId))
  const studyCard=cards.find(c=>c.id===sessionQueue[0])
  const activeDeck=sessionDeck?decks.find(d=>d.id===sessionDeck):null
  const todaySeconds=sessions.filter(s=>localDay(new Date(s.endedAt))===localDay()).reduce((n,s)=>n+s.seconds,0)
  const completedToday=sessions.filter(s=>localDay(new Date(s.endedAt))===localDay()).length
  const startStudy=(id:string)=>{const due=cards.filter(c=>c.deckId===id&&isDue(c));if(!due.length){setToast('Nu ai carduri scadente în acest set.');return}setSessionQueue(due.map(c=>c.id));setSessionDeck(id);setReviewed(0);setFlipped(false)}
  const gradeCard=(grade:ReviewGrade)=>{
    if(!studyCard)return
    setCards(all=>all.map(c=>c.id===studyCard.id?scheduleReview(c,grade):c))
    setSessionQueue(list=>list.slice(1))
    setFlipped(false);setReviewed(n=>n+1)
  }
  const addDeck=(event:FormEvent)=>{
    event.preventDefault();const name=deckName.trim();if(!name)return
    const sub=subjects.find(s=>s.id===deckSubject)
    const newDeck:StudyDeck={id:createId('set'),title:name,subjectId:sub?.id||'',semesterId:sub?.semesterId||'',createdAt:new Date().toISOString()}
    setDecks(d=>[...d,newDeck]);setChosenDeck(newDeck.id);setDeckName('');setDeckModal(false)
  }
  const addCard=(event:FormEvent)=>{
    event.preventDefault();if(!chosenDeck||!front.trim()||!back.trim())return
    if(editingCardId) setCards(c=>c.map(x=>x.id===editingCardId?{...x,front:front.trim(),back:back.trim()}:x))
    else setCards(c=>[...c,{id:createId('card'),deckId:chosenDeck,front:front.trim(),back:back.trim(),createdAt:new Date().toISOString(),dueDate:localDay(),intervalDays:0,repetitions:0}])
    setFront('');setBack('');setEditingCardId(null);setCardModal(false)
  }
  const pickPhase=(phase:FocusPhase)=>{
    const seconds=secondsForPhase(phase,settings)
    setTimer(t=>({...t,phase,remainingSeconds:seconds,totalSeconds:seconds,runningUntil:null}))
  }
  const startOrPause=()=>{
    if(timer.runningUntil){setTimer(t=>({...t,remainingSeconds:Math.max(1,Math.ceil((t.runningUntil!-Date.now())/1000)),runningUntil:null}))}
    else{setTimer(t=>({...t,runningUntil:Date.now()+t.remainingSeconds*1000}))}
  }
  const saveFocusSettings=(event:FormEvent)=>{
    event.preventDefault()
    const valid=validSettings(settingsDraft)
    setSettings(valid);setSettingsOpen(false)
    if(!timer.runningUntil){setTimer(t=>({...t,totalSeconds:secondsForPhase(t.phase,valid),remainingSeconds:secondsForPhase(t.phase,valid)}))}
    setToast('Preferințele Focus au fost salvate.')
  }
  const circleProgress=timer.totalSeconds?Math.max(0,Math.min(1,remaining/timer.totalSeconds)):1
  return <section className="space-y-6 pb-8">
    <header className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><button onClick={onBack} aria-label="Înapoi" className="mt-1 grid size-9 place-items-center rounded-xl bg-surface text-lg shadow-sm hover:bg-ink/[0.05]">‹</button><div><span className="text-xs font-semibold tracking-[.17em] text-ink-faint">STUDYFLOW</span><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Study Hub</h1><p className="mt-1 text-sm text-ink-soft">Un spațiu liniștit pentru concentrare și învățare.</p></div></div><div className="grid size-11 place-items-center rounded-[17px] bg-brand-soft text-xl text-brand-text">✦</div></header>
    <div className="flex gap-1 rounded-2xl bg-surface-muted p-1 sm:max-w-md">{([{id:'flashcards',label:'Flashcards',symbol:'▤'},{id:'focus',label:'Focus',symbol:'◉'}] as const).map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex-1 rounded-[13px] px-4 py-2.5 text-sm font-semibold transition-all ${tab===t.id?'bg-surface text-ink shadow-sm':'text-ink-soft hover:text-ink'}`}>{t.symbol} &nbsp;{t.label}</button>)}</div>
    {tab==='flashcards'?<>
      {sessionDeck ? <div className={`${tile} space-y-5 p-5 sm:p-8`}>
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-ink-soft">SESIUNE DE REPETARE</p><h2 className="text-lg font-bold">{activeDeck?.title||'Flashcards'}</h2></div><button onClick={()=>{setSessionDeck(null);setSessionQueue([])}} className="rounded-xl bg-canvas px-3 py-2 text-sm font-semibold">Închide</button></div>
        {studyCard?<><p className="text-center text-xs font-medium text-ink-soft">{reviewed+1} / {reviewed+sessionQueue.length} · Întrebare</p>
          <button onClick={()=>setFlipped(f=>!f)} className="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-[27px] border border-brand/20 bg-gradient-to-br from-brand-soft to-surface px-6 py-10 text-center shadow-inner" aria-label="Întoarce cardul"><span className="text-[11px] font-semibold uppercase tracking-[.15em] text-brand-text">{flipped?'Răspuns':'Întrebare'}</span><span className="max-w-xl whitespace-pre-wrap text-xl font-semibold leading-relaxed text-ink sm:text-2xl">{flipped?studyCard.back:studyCard.front}</span><span className="text-xs text-ink-faint">Apasă pentru a întoarce</span></button>
          {flipped?<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([{id:'again',label:'Din nou',color:'#fbe8e8',fg:'#c95757'},{id:'hard',label:'Greu',color:'#fff1df',fg:'#bc8022'},{id:'good',label:'Bine',color:'#e8f3ff',fg:'#287de8'},{id:'easy',label:'Ușor',color:'#e5f7ed',fg:'#178453'}] as const).map(g=><button key={g.id} onClick={()=>gradeCard(g.id)} className="rounded-[15px] px-3 py-3 text-sm font-bold transition hover:brightness-95" style={{background:g.color,color:g.fg}}>{g.label}</button>)}</div>:<button onClick={()=>setFlipped(true)} className="w-full rounded-[16px] bg-brand px-4 py-3.5 text-sm font-bold text-white shadow-sm">Arată răspunsul</button>}</>:<div className="space-y-4 py-9 text-center"><div className="text-5xl">✦</div><h2 className="text-2xl font-bold">Sesiune încheiată!</h2><p className="text-sm text-ink-soft">Ai revizuit {reviewed} {reviewed===1?'card':'carduri'}.</p><button onClick={()=>{setSessionDeck(null);setSessionQueue([])}} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white">Înapoi la seturi</button></div>}
      </div> : <>
        <div className="grid gap-3 sm:grid-cols-3">{[{n:decks.length,label:'Seturi create'},{n:cards.length,label:'Carduri totale'},{n:allDue.length,label:'De repetat astăzi'}].map(m=><div key={m.label} className={`${tile} p-4`}><p className="text-2xl font-bold tabular-nums">{m.n}</p><p className="mt-1 text-xs text-ink-soft">{m.label}</p></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Seturile mele</h2><p className="text-xs text-ink-soft">Organizate pe materii, fără amestecarea semestrelor.</p></div><button onClick={()=>{setDeckSubject(initialSubjectId||'');setDeckModal(true)}} className="rounded-[14px] bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-deep">+ Set nou</button></div>
        {decks.length ? <div className="grid gap-3 sm:grid-cols-2">{decks.map(d=>{const n=cards.filter(c=>c.deckId===d.id);const due=n.filter(c=>isDue(c)).length;const sub=subjects.find(s=>s.id===d.subjectId);return <button key={d.id} onClick={()=>setChosenDeck(d.id)} className={`${tile} relative space-y-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${chosenDeck===d.id?'ring-2 ring-brand/30':''}`}><span className="grid size-10 place-items-center rounded-[13px] bg-brand-soft text-xl text-brand-text">▤</span><div><p className="font-bold">{d.title}</p><p className="mt-1 text-xs text-ink-soft">{sub?.name||'General'} · {n.length} carduri</p></div><span className="text-xs font-semibold text-brand-text">{due?`${due} de repetat`:n.length?'La zi':'Set nou'} →</span></button>})}</div>:<div className={`${tile} p-9 text-center`}><div className="mb-2 text-4xl">▤</div><h3 className="font-bold">Primul tău set de flashcarduri</h3><p className="mt-1 text-sm text-ink-soft">Creează un set pentru o materie, apoi adaugă întrebări și răspunsuri.</p><button onClick={()=>setDeckModal(true)} className="mt-5 rounded-xl bg-brand-soft px-5 py-3 text-sm font-semibold text-brand-text">Creează set</button></div>}
        {selectedDeck&&<div className={`${tile} space-y-4 p-5 sm:p-6`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{selectedDeck.title}</h2><p className="text-xs text-ink-soft">{visibleCards.length} carduri · {dueCards.length} pentru repetat</p></div><div className="flex gap-2"><button onClick={()=>{setEditingCardId(null);setFront('');setBack('');setCardModal(true)}} className="rounded-[13px] bg-surface-muted px-3.5 py-2.5 text-xs font-bold">+ Card</button><button disabled={!dueCards.length} onClick={()=>startStudy(chosenDeck)} className="rounded-[13px] bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Repetă acum</button></div></div>
          {visibleCards.length?<div className="space-y-2">{visibleCards.map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-[15px] bg-canvas p-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{c.front}</p><p className="mt-0.5 truncate text-xs text-ink-soft">{isDue(c)?'De repetat':`Revizuire: ${dateLabel(c.dueDate)}`}</p></div><div className="flex shrink-0 items-center gap-1"><button onClick={()=>{setEditingCardId(c.id);setFront(c.front);setBack(c.back);setCardModal(true)}} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-text hover:bg-brand-soft">Editează</button><button aria-label={`Șterge cardul ${c.front}`} onClick={()=>{if(window.confirm('Ștergi acest card?'))setCards(a=>a.filter(x=>x.id!==c.id))}} className="shrink-0 rounded-lg px-2 py-1 text-xs text-danger hover:bg-surface-hover">Șterge</button></div></div>)}</div>:<p className="rounded-xl bg-canvas p-4 text-sm text-ink-soft">Acest set nu conține carduri. Apasă „+ Card”.</p>}
          <button onClick={()=>{if(window.confirm('Ștergi setul și toate cardurile lui?')){setDecks(a=>a.filter(d=>d.id!==chosenDeck));setCards(a=>a.filter(c=>c.deckId!==chosenDeck));setChosenDeck('')}}} className="text-xs font-semibold text-danger">Șterge setul</button>
        </div>}
        <p className="text-xs text-ink-soft">Repetare spațiată simplificată, calculată local după răspunsurile tale. Cardurile și progresul rămân salvate în browser.</p>
      </>}
    </>:<>
      <div className={`${tile} relative overflow-hidden p-5 sm:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-ink-faint">Focus Mode</p><h2 className="mt-1 text-xl font-bold">Timp pentru ce contează.</h2><p className="mt-1 text-xs text-ink-soft">Fără aglomerație. Doar tu și lucrul tău.</p></div><button onClick={()=>{setSettingsDraft(settings);setSettingsOpen(true)}} className="flex items-center gap-2 rounded-[14px] bg-surface-muted px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface-hover">⚙ Setări</button></div>
        <div className="my-5 flex flex-wrap justify-center gap-2">{([{phase:'focus',label:'Focus'},{phase:'short',label:'Pauză scurtă'},{phase:'long',label:'Pauză lungă'}] as const).map(p=><button key={p.phase} onClick={()=>{if(timer.runningUntil){setToast('Pune cronometrul pe pauză înainte de a schimba modul.');return}pickPhase(p.phase)}} className={`rounded-full px-4 py-2 text-xs font-bold transition ${timer.phase===p.phase?'bg-brand-soft text-brand-text':'bg-canvas text-ink-soft'}`}>{p.label}</button>)}</div>
        <div className="flex justify-center"><div className="relative w-full max-w-[335px] aspect-square"><svg className="h-full w-full -rotate-90" viewBox="0 0 320 320" aria-hidden="true"><defs><linearGradient id="studyflow-focus-ring" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--color-brand)"/><stop offset="1" stopColor="#86d8f8"/></linearGradient></defs><circle cx="160" cy="160" r="139" stroke="var(--color-line)" strokeWidth="17" fill="var(--color-surface)"/><circle cx="160" cy="160" r="139" stroke="url(#studyflow-focus-ring)" strokeWidth="17" strokeLinecap="round" fill="none" strokeDasharray={`${2*Math.PI*139}`} strokeDashoffset={`${2*Math.PI*139*(1-circleProgress)}`} style={{transition:'stroke-dashoffset 400ms linear'}}/></svg><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-sm font-medium text-ink-soft"><PhaseIcon phase={timer.phase}/> {timer.phase==='focus'?'Concentrare':timer.phase==='short'?'Pauză scurtă':'Pauză lungă'}</span><span className="mt-1 text-[clamp(3rem,11vw,4.9rem)] font-semibold tracking-[-.06em] tabular-nums text-brand-text">{clockText(remaining)}</span><span className="mt-2 text-xs text-ink-faint">Sesiunea {timer.completedFocusCycles+1}</span></div></div></div>
        <div className="mt-1 flex items-center justify-center gap-3"><button onClick={()=>{if(timer.runningUntil&& !window.confirm('Resetezi sesiunea? Progresul curent nu va fi înregistrat.'))return;setTimer(t=>({...t,runningUntil:null,remainingSeconds:t.totalSeconds}))}} className="grid size-12 place-items-center rounded-full bg-surface-muted text-lg text-ink-soft transition hover:bg-surface-hover" aria-label="Resetează" title="Resetează">↺</button><button onClick={startOrPause} className="grid size-[76px] place-items-center rounded-full bg-brand text-3xl text-white shadow-[0_10px_30px_rgba(0,122,255,0.24)] transition hover:scale-105 hover:bg-brand-deep" aria-label={timer.runningUntil?'Pauză':'Pornește'}>{timer.runningUntil?'Ⅱ':'▶'}</button><button onClick={()=>{if(timer.runningUntil && !window.confirm('Treci la faza următoare? Sesiunea curentă nu va fi contabilizată.'))return;const phase=nextPhase(timer.phase,timer.completedFocusCycles,settings);pickPhase(phase)}} className="grid size-12 place-items-center rounded-full bg-surface-muted text-lg text-ink-soft transition hover:bg-surface-hover" aria-label="Sari peste faza curentă" title="Sari peste">⇥</button></div>
        <p className="mt-3 text-center text-xs text-ink-soft">{timer.runningUntil?'Sesiunea rulează. Poți lăsa aplicația în fundal.':'Când ești pregătit, apasă Start.'}</p>
        <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-semibold text-ink-soft">Materia</span><select disabled={!!timer.runningUntil} value={timer.subjectId} onChange={e=>setTimer(t=>({...t,subjectId:e.target.value,taskId:null}))} className="w-full rounded-[14px] bg-canvas px-3 py-3 text-sm font-medium outline-none disabled:opacity-60"><option value="">Fără materie</option>{subjectList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-semibold text-ink-soft">Task asociat (opțional)</span><select disabled={!!timer.runningUntil} value={timer.taskId??''} onChange={e=>setTimer(t=>({...t,taskId:e.target.value?Number(e.target.value):null}))} className="w-full rounded-[14px] bg-canvas px-3 py-3 text-sm font-medium outline-none disabled:opacity-60"><option value="">Fără task</option>{focusTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">{[{label:'Concentrare azi',value:fmtMinutes(todaySeconds)},{label:'Sesiuni azi',value:String(completedToday)},{label:'Cicluri',value:String(timer.completedFocusCycles)}].map(s=><div key={s.label} className={`${tile} p-3 text-center sm:p-4`}><p className="text-lg font-bold tabular-nums sm:text-xl">{s.value}</p><p className="mt-1 text-[11px] text-ink-soft">{s.label}</p></div>)}</div>
      <p className="px-2 text-xs leading-relaxed text-ink-soft">Doar sesiunile Focus încheiate natural intră în statistici; pauzele și sesiunile sărite nu sunt contabilizate. Cronometrul folosește ora reală, așa că nu pierde timpul când schimbi fila.</p>
    </>}
    {toast&&<div role="status" aria-live="polite" className="fixed bottom-28 left-1/2 z-[100] w-[min(90vw,380px)] -translate-x-1/2 rounded-[17px] bg-[#1b2c43] px-5 py-3 text-center text-sm font-semibold text-white shadow-xl">{toast}</div>}
    {deckModal&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setDeckModal(false)}}><DialogSurface as="form" onSubmit={addDeck} label="Creează set flashcards" onClose={()=>setDeckModal(false)} className="w-full max-w-md space-y-4 rounded-t-[30px] bg-surface p-6 shadow-2xl sm:rounded-[28px]"><h2 className="text-xl font-bold">Set nou de flashcarduri</h2><label className="block space-y-1.5"><span className="text-xs font-semibold text-ink-soft">Denumirea setului</span><input autoFocus required maxLength={100} value={deckName} onChange={e=>setDeckName(e.target.value)} placeholder="Ex.: Java · Clase și obiecte" className="w-full rounded-xl bg-canvas px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"/></label><label className="block space-y-1.5"><span className="text-xs font-semibold text-ink-soft">Materie</span><select value={deckSubject} onChange={e=>setDeckSubject(e.target.value)} className="w-full rounded-xl bg-canvas px-3 py-3 text-sm outline-none"><option value="">General</option>{subjectList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="flex gap-2"><button type="button" onClick={()=>setDeckModal(false)} className="flex-1 rounded-xl bg-canvas px-4 py-3 text-sm font-bold">Anulează</button><button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white">Creează</button></div></DialogSurface></div>}
    {cardModal&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setCardModal(false)}}><DialogSurface as="form" onSubmit={addCard} label="Creează flashcard" onClose={()=>setCardModal(false)} className="w-full max-w-lg space-y-4 rounded-t-[30px] bg-surface p-6 shadow-2xl sm:rounded-[28px]"><h2 className="text-xl font-bold">{editingCardId?'Editează flashcard':'Adaugă flashcard'}</h2><label className="block space-y-1"><span className="text-xs font-semibold text-ink-soft">Întrebare (față)</span><textarea autoFocus required rows={3} maxLength={1500} value={front} onChange={e=>setFront(e.target.value)} placeholder="Ce este o clasă în Java?" className="w-full rounded-xl bg-canvas p-3.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"/></label><label className="block space-y-1"><span className="text-xs font-semibold text-ink-soft">Răspuns (verso)</span><textarea required rows={4} maxLength={4000} value={back} onChange={e=>setBack(e.target.value)} placeholder="O clasă este ..." className="w-full rounded-xl bg-canvas p-3.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"/></label><div className="flex gap-2"><button type="button" onClick={()=>setCardModal(false)} className="flex-1 rounded-xl bg-canvas px-4 py-3 text-sm font-bold">Anulează</button><button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white">{editingCardId?'Salvează modificările':'Salvează card'}</button></div></DialogSurface></div>}
    {settingsOpen&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false)}}><DialogSurface as="form" onSubmit={saveFocusSettings} label="Setări Focus" onClose={()=>setSettingsOpen(false)} className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-[30px] bg-surface p-6 shadow-2xl sm:rounded-[28px]"><div><h2 className="text-xl font-bold">Setări Focus</h2><p className="mt-1 text-xs text-ink-soft">Ajustează ritmul învățării exact cum îți place.</p></div><div className="grid grid-cols-2 gap-2.5"><SettingNumber label="Concentrare" value={settingsDraft.focusMinutes} onChange={n=>setSettingsDraft(s=>({...s,focusMinutes:n}))} min={1} max={180}/><SettingNumber label="Pauză scurtă" value={settingsDraft.shortBreakMinutes} onChange={n=>setSettingsDraft(s=>({...s,shortBreakMinutes:n}))} min={1} max={60}/><SettingNumber label="Pauză lungă" value={settingsDraft.longBreakMinutes} onChange={n=>setSettingsDraft(s=>({...s,longBreakMinutes:n}))} min={1} max={90}/><SettingNumber label="Pauză lungă după" value={settingsDraft.longBreakEvery} onChange={n=>setSettingsDraft(s=>({...s,longBreakEvery:n}))} min={1} max={12} suffix="sesiuni"/></div><label className="flex items-center justify-between gap-3 rounded-2xl bg-canvas p-4"><span><strong className="block text-sm">Sunet la final</strong><span className="text-xs text-ink-soft">Un semnal discret (dacă browserul permite)</span></span><input type="checkbox" className="size-5 accent-brand" checked={settingsDraft.sound} onChange={e=>setSettingsDraft(s=>({...s,sound:e.target.checked}))}/></label><label className="flex items-center justify-between gap-3 rounded-2xl bg-canvas p-4"><span><strong className="block text-sm">Pornește automat următoarea etapă</strong><span className="text-xs text-ink-soft">Alternare automată Focus / Pauză</span></span><input type="checkbox" className="size-5 accent-brand" checked={settingsDraft.autoStartNext} onChange={e=>setSettingsDraft(s=>({...s,autoStartNext:e.target.checked}))}/></label><p className="text-xs text-ink-faint">Duratele noi se aplică imediat dacă timerul e oprit. În timpul unei sesiuni, se vor aplica la următoarea etapă.</p><div className="flex gap-2"><button type="button" onClick={()=>setSettingsOpen(false)} className="flex-1 rounded-xl bg-canvas px-4 py-3 text-sm font-bold">Anulează</button><button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white">Salvează</button></div></DialogSurface></div>}
  </section>
}
