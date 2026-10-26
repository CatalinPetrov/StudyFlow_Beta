import { Link } from 'react-router-dom'
import SyncStatus from './components/auth/SyncStatus'
import { useAuth } from './auth/AuthContext'
import { useEffect, useRef, useState } from 'react'
import type { UserSettings, StudentProfile } from './profileModel'
import { initialsFor } from './profileModel'
import { exportStudyBackup, restoreStudyBackup } from './backupModel'
import { calculateTaskActivity } from './taskActivityModel'
import type { StudyTask } from './taskModel'
import type { ThemePreference } from './lib/theme'
import { formatBytes, getPersistenceStatus, requestPersistentStorage, storageEstimate, type PersistenceStatus, type StorageEstimate } from './lib/storage'


type Props={settings:UserSettings;tasks:StudyTask[];onSave:(value:UserSettings)=>boolean;onBack:()=>void;onNotifications:()=>void;themePreference:ThemePreference;onThemeChange:(value:ThemePreference)=>void;onNavigate?:(path:string)=>void}
const persistenceText: Record<PersistenceStatus,string> = {
  persisted:'Protejată de browser împotriva ștergerii automate.',
  available:'Browserul poate șterge datele dacă spațiul este redus.',
  denied:'Browserul nu a acordat încă protecția. Poți reîncerca.',
  unsupported:'Browserul nu oferă stocare persistentă.',
  error:'Starea stocării nu a putut fi verificată.',
}
const themeOptions=[{id:'light',label:'Luminoasă',hint:'Fundal alb'},{id:'dark',label:'Întunecată',hint:'Focus noaptea'},{id:'system',label:'Sistem',hint:'După dispozitiv'}] as const
const inputStyle='mt-1.5 w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10'
const panel='rounded-[26px] bg-surface p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] ring-1 ring-line sm:p-6'
/** Micșorăm imaginea înainte de a o salva, pentru a nu umple localStorage. */
async function prepareAvatar(file:File):Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Folosește o poză JPG, PNG sau WebP.')
  if (file.size > 5*1024*1024) throw new Error('Alege o imagine de maximum 5 MB.')
  const objectUrl=URL.createObjectURL(file)
  try {
    const img=new Image()
    await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Nu am putut citi imaginea.'));img.src=objectUrl})
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imaginea nu este validă.')
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Browserul nu poate procesa fotografia.')
    const side=Math.min(img.naturalWidth,img.naturalHeight)
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256)
    const data=canvas.toDataURL('image/jpeg',0.8)
    if(data.length>350000)throw new Error('Fotografia este prea mare pentru profilul local.')
    return data
  } finally {URL.revokeObjectURL(objectUrl)}
}

export function ProfileSettingsPage({settings,tasks,onSave,onBack,onNotifications,themePreference,onThemeChange}:Props){
  const { user, isValid, logout } = useAuth() as any
  const [draft,setDraft]=useState<StudentProfile>({...settings.profile})
  const [loggingOut,setLoggingOut]=useState(false)
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const importRef=useRef<HTMLInputElement>(null)
  const avatarRef=useRef<HTMLInputElement>(null)
  const activity=calculateTaskActivity(tasks)
  const [persistence,setPersistence]=useState<PersistenceStatus>('available')
  const [estimate,setEstimate]=useState<StorageEstimate|null>(null)
  const [checkingStorage,setCheckingStorage]=useState(true)
  useEffect(()=>{
    let active=true
    void Promise.all([getPersistenceStatus(),storageEstimate()]).then(([status,usage])=>{
      if(!active)return
      setPersistence(status);setEstimate(usage);setCheckingStorage(false)
    })
    return ()=>{active=false}
  },[])
  const secureStorage=async()=>{
    setCheckingStorage(true)
    const status=await requestPersistentStorage()
    setPersistence(status);setEstimate(await storageEstimate());setCheckingStorage(false)
    setMessage(status==='persisted'?'Stocarea persistentă este activă. Browserul nu va șterge automat datele StudyFlow.':'Browserul nu a acordat stocarea persistentă. Încearcă din nou după ce folosești aplicația ceva timp.')
  }
  const onAvatarFile=async(file:File|undefined)=>{
    if(!file)return
    try {const avatarDataUrl=await prepareAvatar(file);setDraft(p=>({...p,avatarDataUrl}));setMessage('Fotografia este pregătită. Apasă „Salvează profilul” pentru a o păstra.')}
    catch(e){setMessage(e instanceof Error?e.message:'Nu am putut încărca fotografia.')}
    finally {if(avatarRef.current)avatarRef.current.value=''}
  }
  const update=(name:keyof StudentProfile,value:string|number)=>{setDraft(p=>({...p,[name]:value}));setMessage('')}
  const save=()=>{
    if(!draft.name.trim()){setMessage('Introdu un nume pentru profil.');return}
    const success=onSave({...settings,profile:draft})
    setMessage(success?'Profilul a fost salvat pe acest dispozitiv.':'Browserul nu a permis salvarea profilului.')
  }
  const exportNow=async()=>{
    setBusy(true);setMessage('')
    try{const count=await exportStudyBackup();setMessage(`Backup descărcat cu succes, inclusiv ${count} fișiere din Library. Păstrează-l într-un loc sigur.`)}
    catch(e){setMessage(e instanceof Error?e.message:'Nu am putut crea backupul.')}
    finally{setBusy(false)}
  }
  const importNow=async(file:File|undefined)=>{
    if(!file)return
    if(!window.confirm('Restaurarea va ÎNLOCUI datele StudyFlow salvate în acest browser, inclusiv cele din Library. Ai păstrat o copie de siguranță a datelor actuale?')){
      if(importRef.current)importRef.current.value='';return
    }
    setBusy(true);setMessage('')
    try{await restoreStudyBackup(file);window.location.reload()}
    catch(e){setMessage(e instanceof Error?e.message:'Restaurarea nu a reușit.');setBusy(false)}
    finally{if(importRef.current)importRef.current.value=''}
  }
  return <div className="mx-auto max-w-3xl space-y-5 pb-4">
    <div className="flex items-center gap-3">
      <button onClick={onBack} aria-label="Înapoi la Acasă" className="grid size-10 place-items-center rounded-full bg-surface text-brand-text shadow-sm ring-1 ring-line hover:bg-brand-soft">←</button>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">STUDYFLOW</p><h1 className="text-3xl font-bold tracking-tight">Profil și setări</h1></div>
    </div>
    <section className={`${panel} flex items-center gap-4`}>
      <div className="relative shrink-0">
        <div className="grid size-[76px] place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#5ac8fa] to-[#007aff] text-xl font-bold text-white shadow-[0_4px_20px_rgba(0,122,255,.2)]">
          {draft.avatarDataUrl?<img src={draft.avatarDataUrl} alt="Poza de profil" className="size-full object-cover"/>:initialsFor(draft.name)}
        </div>
        <button type="button" onClick={()=>avatarRef.current?.click()} aria-label="Schimbă fotografia de profil" title="Schimbă fotografia" className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-[3px] border-surface bg-brand text-sm text-white shadow-md transition hover:bg-brand-deep">✎</button>
        <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Alege fotografia de profil" onChange={e=>void onAvatarFile(e.target.files?.[0])}/>
      </div>
      <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-semibold">{draft.name||'Student'}</h2><p className="mt-1 text-sm text-ink-soft">{[draft.specialization,`Anul ${draft.studyYear}`].filter(Boolean).join(' · ')}</p><p className="mt-1 text-xs text-ink-faint">JPG, PNG sau WebP · Salvată local</p>
        {draft.avatarDataUrl&&<button type="button" className="mt-2 text-xs font-semibold text-brand-text hover:underline" onClick={()=>{setDraft(p=>({...p,avatarDataUrl:''}));setMessage('Fotografia va fi eliminată când salvezi profilul.')}}>Elimină fotografia</button>}
      </div>
    </section>
    <section className={panel}>
      <div className="mb-5"><h2 className="text-lg font-semibold">Informațiile mele</h2><p className="mt-1 text-sm text-ink-soft">Personalizează cum te întâmpină StudyFlow.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink-soft sm:col-span-2">Numele afișat
          <input className={inputStyle} value={draft.name} maxLength={80} onChange={e=>update('name',e.target.value)} placeholder="Nume și prenume" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">Universitate
          <input className={inputStyle} value={draft.university} maxLength={120} onChange={e=>update('university',e.target.value)} placeholder="Universitatea mea" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">Facultate
          <input className={inputStyle} value={draft.faculty} maxLength={120} onChange={e=>update('faculty',e.target.value)} placeholder="Facultatea mea" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">Specializare
          <input className={inputStyle} value={draft.specialization} maxLength={120} onChange={e=>update('specialization',e.target.value)} placeholder="Ex.: Informatică" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">An de studiu
          <select className={inputStyle} value={draft.studyYear} onChange={e=>update('studyYear',Number(e.target.value))}>{[1,2,3,4,5,6].map(y=><option value={y} key={y}>Anul {y}</option>)}</select>
        </label>
      </div>
      <button onClick={save} className="mt-5 w-full rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(0,122,255,.18)] transition hover:bg-brand-deep sm:w-auto">Salvează profilul</button>
    </section>
    <section className={panel}>
      <div className="mb-4"><h2 className="text-lg font-semibold">Aspect</h2><p className="mt-1 text-sm text-ink-soft">Alege tema potrivită pentru momentul zilei. Setarea rămâne pe acest dispozitiv.</p></div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema aplicației">
        {themeOptions.map(option=><button key={option.id} type="button" role="radio" aria-checked={themePreference===option.id} onClick={()=>onThemeChange(option.id)} className={`rounded-2xl border px-3 py-3 text-left transition ${themePreference===option.id?'border-brand bg-brand-soft text-brand-text':'border-line bg-canvas text-ink-soft hover:bg-surface-hover hover:text-ink'}`}><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-[10px] font-medium opacity-75">{option.hint}</span></button>)}
      </div>
    </section>
    <section className={panel}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-semibold">Activitatea mea</h2><p className="mt-1 text-sm text-ink-soft">Un rezumat real al taskurilor tale, din toate semestrele.</p></div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-text">Ultimele 7 zile</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {([
          {label:'Taskuri în așteptare',value:activity.pendingTotal,sub:'Total nefinalizate',tone:'text-ink'},
          {label:'Următoarele 7 zile',value:activity.upcomingSevenDays,sub:'Inclusiv azi',tone:'text-brand-text'},
          {label:'Restante',value:activity.overdue,sub:'Deadline depășit',tone:'text-danger'},
          {label:'Finalizate în 7 zile',value:activity.completedSevenDays,sub:'După data finalizării',tone:'text-[#16a183]'},
          {label:'Seria actuală',value:activity.currentStreak,sub:'Zile consecutive',tone:'text-[#e79a39]'},
          {label:'Cea mai lungă serie',value:activity.bestStreak,sub:'Record personal',tone:'text-[#8a64d6]'},
        ] as const).map(metric=><div key={metric.label} className="rounded-2xl bg-canvas p-3.5 ring-1 ring-line">
          <p className="text-[11px] font-medium leading-snug text-ink-soft">{metric.label}</p>
          <p className={`mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums ${metric.tone}`}>{metric.value}</p>
          <p className="mt-2 text-[10px] text-ink-faint">{metric.sub}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">O zi contribuie la serie dacă ai finalizat cel puțin un task. Seria rămâne activă și dacă ultima zi cu finalizare a fost ieri. Pentru taskurile finalizate înainte ca StudyFlow să înregistreze data, nu putem calcula retroactiv seria.</p>
    </section>
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand/10 text-sm font-semibold text-brand-text">SF</div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Cont și sincronizare</h2>
            <p className="mt-1 truncate text-sm text-ink-soft">{isValid && user?.email ? `Conectat ca ${user.email}` : 'Neconectat'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatus />
          {isValid && <button type="button" disabled={loggingOut} onClick={() => { setLoggingOut(true); void logout() }} className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-canvas hover:text-ink disabled:opacity-60">{loggingOut ? 'Se deconectează…' : 'Deconectare'}</button>}
        </div>
      </div>
    </section>
    <section className={panel}>
      <div className="mb-4"><h2 className="text-lg font-semibold">Notificări în aplicație</h2><p className="mt-1 text-sm text-ink-soft">Alerte pentru deadline-uri și examene, afișate în StudyFlow.</p></div>
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm"><span><span className="block font-semibold">Taskuri apropiate</span><span className="mt-1 block text-xs text-ink-soft">Restanțe și deadline-uri în următoarele 7 zile</span></span><input type="checkbox" className="size-5 accent-brand" checked={settings.notifications.taskDeadlines} onChange={e=>onSave({...settings,notifications:{...settings.notifications,taskDeadlines:e.target.checked}})} /></label>
        <div className="h-px bg-ink/[0.05]" />
        <label className="flex items-center justify-between gap-3 text-sm"><span><span className="block font-semibold">Examene viitoare</span><span className="mt-1 block text-xs text-ink-soft">Examene în următoarele 14 zile</span></span><input type="checkbox" className="size-5 accent-brand" checked={settings.notifications.exams} onChange={e=>onSave({...settings,notifications:{...settings.notifications,exams:e.target.checked}})} /></label>
      </div>
      <button onClick={onNotifications} className="mt-5 text-sm font-semibold text-brand-text hover:underline">Deschide centrul de notificări →</button>
    </section>
    <section className={panel}>
      <h2 className="text-lg font-semibold">Date și copie de siguranță</h2>
      <p className="mt-1 text-sm text-ink-soft">Descarcă un fișier JSON cu datele StudyFlow, inclusiv documentele din Library, notițele și evidențierile PDF. Sincronizarea în cloud rulează automat cât ești conectat.</p>
      <div className="mt-4 rounded-2xl bg-canvas p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Stocare persistentă</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{checkingStorage?'Se verifică starea stocării...':persistenceText[persistence]}</p>
          </div>
          {!checkingStorage&&persistence!=='persisted'&&persistence!=='unsupported'&&<button disabled={busy} onClick={()=>void secureStorage()} className="rounded-xl border border-brand/20 px-3 py-2 text-xs font-semibold text-brand-text hover:bg-brand-soft disabled:opacity-50">Activează</button>}
        </div>
        {estimate&&<p className="mt-3 text-xs text-ink-faint">Folosit {formatBytes(estimate.usage)} din {formatBytes(estimate.quota)} ({estimate.percent.toLocaleString('ro-RO',{maximumFractionDigits:1})}%).</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={busy} onClick={exportNow} className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-text hover:bg-brand-soft disabled:opacity-50">{busy?'Se procesează…':'Exportă backup complet'}</button>
        <button disabled={busy} onClick={()=>importRef.current?.click()} className="rounded-2xl border border-brand/20 px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-surface-hover disabled:opacity-50">Restaurează din backup</button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={e=>void importNow(e.target.files?.[0])}/>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">Restaurarea înlocuiește datele locale. Păstrează backupul separat de browser și nu îl distribui: conține informațiile și documentele tale.</p>
    </section>
    {message&&<p role="status" className="rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-text">{message}</p>}
    <p className="px-2 text-center text-xs text-ink-faint">StudyFlow · Prototip v1.0 · Stocare locală</p>
  </div>
}