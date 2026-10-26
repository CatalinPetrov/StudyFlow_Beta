import { useState } from 'react'
import type { StudyNotification } from './notificationModel'

type Props={items:StudyNotification[];readIds:string[];onRead:(id:string)=>void;onReadAll:()=>void;onOpen:(item:StudyNotification)=>void;onBack:()=>void;onSettings:()=>void}
export function NotificationsPage({items,readIds,onRead,onReadAll,onOpen,onBack,onSettings}:Props){
  const [filter,setFilter]=useState<'all'|'unread'>('all')
  const read=new Set(readIds)
  const visible=filter==='all'?items:items.filter(x=>!read.has(x.id))
  return <div className="mx-auto max-w-3xl space-y-5 pb-4">
    <header className="flex items-center gap-3">
      <button onClick={onBack} aria-label="Înapoi la Acasă" className="grid size-10 place-items-center rounded-full bg-surface text-brand-text shadow-sm ring-1 ring-line hover:bg-brand-soft">←</button>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">STUDYFLOW</p><h1 className="text-3xl font-bold tracking-tight">Notificări</h1></div>
      <button onClick={onSettings} className="rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-brand-text shadow-sm">Setări</button>
    </header>
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex rounded-2xl bg-surface p-1 shadow-sm ring-1 ring-line">
        <button onClick={()=>setFilter('all')} className={`rounded-xl px-4 py-2 text-xs font-semibold ${filter==='all'?'bg-brand text-white':'text-ink-soft'}`}>Toate</button>
        <button onClick={()=>setFilter('unread')} className={`rounded-xl px-4 py-2 text-xs font-semibold ${filter==='unread'?'bg-brand text-white':'text-ink-soft'}`}>Necitite ({items.filter(i=>!read.has(i.id)).length})</button>
      </div>
      <button onClick={onReadAll} disabled={items.every(i=>read.has(i.id))} className="text-xs font-semibold text-brand-text disabled:text-ink-faint">Marchează toate citite</button>
    </div>
    {visible.length===0?<section className="rounded-[28px] bg-surface px-5 py-14 text-center shadow-sm ring-1 ring-line"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-2xl">✓</div><h2 className="mt-4 text-lg font-semibold">Totul este la zi</h2><p className="mt-2 text-sm text-ink-soft">{filter==='unread'?'Nu ai notificări necitite.':'Nu ai taskuri sau examene apropiate în acest moment.'}</p></section>:
      <div className="space-y-3">{visible.map(item=><div key={item.id} className={`flex gap-3 rounded-[22px] p-4 shadow-sm ring-1 ring-line ${read.has(item.id)?'bg-surface':'bg-brand-soft'}`}>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg ${item.kind==='exam'?'bg-surface-muted text-danger':'bg-brand-soft text-brand-text'}`}>{item.kind==='exam'?'◆':'✓'}</span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{item.title}</p>{!read.has(item.id)&&<span className="size-2 shrink-0 rounded-full bg-brand"/>}</div><p className="mt-1 text-xs text-ink-soft">{item.description}</p><div className="mt-3 flex gap-4"><button className="text-xs font-semibold text-brand-text" onClick={()=>onOpen(item)}>Vezi {item.kind==='exam'?'examenul':'taskul'} →</button>{!read.has(item.id)&&<button className="text-xs text-ink-soft" onClick={()=>onRead(item.id)}>Marchează citită</button>}</div></div>
      </div>)}</div>}
    <p className="text-center text-xs text-ink-faint">Acestea sunt notificări în aplicație, nu alerte push pe telefon.</p>
  </div>
}
