import {useCallback,useEffect,useMemo,useRef,useState, type KeyboardEvent as ReactKeyboardEvent} from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  defaultPdfStudyData, loadPdfStudyData, normalizedHighlightRects, pdfMarkColors,
  safePdfPage, savePdfStudyData, type PdfMarkColor, type PdfRect, type PdfStudyData,
} from './pdfReaderModel'
import 'pdfjs-dist/web/pdf_viewer.css'
import './pdfReader.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

type LoadedPdf = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
type Panel='notes'|'bookmarks'|'highlights'
type Candidate={quote:string;rects:PdfRect[]}
type PdfReaderProps={id:string;src:string;title:string}

const btn='rounded-xl bg-surface-muted px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-35'
const accent='rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-deep disabled:opacity-40'
const iconButton='grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-soft transition hover:bg-surface-hover disabled:opacity-35'
const iconPaths:Record<string,string>={
  left:'M15 18 9 12l6-6',right:'m9 18 6-6-6-6',star:'m12 2.5 3 6.3 7 .9-5 4.9 1.2 7-6.2-3.3L5.8 22 7 15l-5-4.9 7-.9z',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm6-2 4 4',minus:'M4 12h16',plus:'M4 12h16M12 4v16',
  note:'M5 3h14v18l-5-3-4 3-5-3V3z',x:'M5 5l14 14M19 5 5 19',pen:'M12 20h9M4 17l12-12a3 3 0 0 1 4 4L8 21H4z',
  list:'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
}
function Glyph({name,size=17}:{name:string;size?:number}){
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]||iconPaths.note}/></svg>
}
const makeId=()=>`pdf-note-${typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`}`
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e)

export function PdfReader({id,src,title}:PdfReaderProps){
  const [study,setStudy]=useState<PdfStudyData>(()=>loadPdfStudyData(id))
  const [page,setPage]=useState(()=>loadPdfStudyData(id).lastPage)
  const [total,setTotal]=useState(0)
  const [zoom,setZoom]=useState(1)
  const [containerWidth,setContainerWidth]=useState(750)
  const [pageDims,setPageDims]=useState({width:700,height:900})
  const [loading,setLoading]=useState(true)
  const [rendering,setRendering]=useState(false)
  const [error,setError]=useState('')
  const [storageError,setStorageError]=useState(false)
  const [panel,setPanel]=useState<Panel>('bookmarks')
  const [showPanel,setShowPanel]=useState(false)
  const [draft,setDraft]=useState('')
  const [selected,setSelected]=useState<Candidate|null>(null)
  const [search,setSearch]=useState('')
  const [searchBusy,setSearchBusy]=useState(false)
  const [matches,setMatches]=useState<{page:number;count:number}[]>([])
  const [scannedPages,setScannedPages]=useState(0)
  const [isSearchOpen,setSearchOpen]=useState(false)
  const docRef=useRef<LoadedPdf|null>(null)
  const stageRef=useRef<HTMLDivElement>(null)
  const scrollRef=useRef<HTMLDivElement>(null)
  const sheetRef=useRef<HTMLDivElement>(null)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const textRef=useRef<HTMLDivElement>(null)

  // Salvăm adnotările sub ID-ul materialului, nu în PDF. Dacă browserul refuză
  // localStorage, informăm utilizatorul în loc să pretindem că datele există.
  useEffect(()=>{if(!savePdfStudyData(id,study))setStorageError(true)},[id,study])
  useEffect(()=>{setStudy(s=>s.lastPage===page?s:{...s,lastPage:page})},[page])

  useEffect(()=>{
    let cancelled=false
    const task=pdfjs.getDocument({url:src})
    setLoading(true);setError('')
    task.promise.then(doc=>{
      if(cancelled){void doc.destroy();return}
      docRef.current=doc;setTotal(doc.numPages);setPage(p=>safePdfPage(p,doc.numPages));setLoading(false)
    }).catch(e=>{if(!cancelled){setError(`PDF-ul nu poate fi deschis: ${errorText(e)}`);setLoading(false)}})
    return ()=>{cancelled=true;docRef.current=null;void task.destroy()}
  },[src])

  useEffect(()=>{
    const el=stageRef.current
    if(!el)return
    const observer=new ResizeObserver(entries=>{
      const width=entries[0]?.contentRect.width
      if(width&&width>100)setContainerWidth(width)
    })
    observer.observe(el)
    return ()=>observer.disconnect()
  },[])

  // Fiecare schimbare de pagină/zoom primește un canvas nou (key pe DOM),
  // prevenind desenarea simultană pe același canvas.
  useEffect(()=>{
    const doc=docRef.current
    const canvas=canvasRef.current
    const textElement=textRef.current
    if(!doc||!canvas||!textElement||!total)return
    let cancelled=false
    let renderTask:ReturnType<Awaited<ReturnType<LoadedPdf['getPage']>>['render']>|undefined
    let layer:InstanceType<typeof pdfjs.TextLayer>|undefined
    setRendering(true);setSelected(null)
    const render=async()=>{
      try{
        const pdfPage=await doc.getPage(page)
        if(cancelled)return
        const baseViewport=pdfPage.getViewport({scale:1})
        const fitScale=Math.min(1.6,Math.max(.2,(containerWidth-36)/baseViewport.width))
        const viewport=pdfPage.getViewport({scale:fitScale*zoom})
        const ratio=Math.min(window.devicePixelRatio||1,2)
        // Avoid allocating enormous bitmap buffers on high-resolution documents.
        const pxRatio=Math.min(ratio,Math.sqrt(16_000_000/(viewport.width*viewport.height)))
        canvas.width=Math.floor(viewport.width*pxRatio)
        canvas.height=Math.floor(viewport.height*pxRatio)
        canvas.style.width=`${viewport.width}px`
        canvas.style.height=`${viewport.height}px`
        textElement.style.width=`${viewport.width}px`
        textElement.style.height=`${viewport.height}px`
        textElement.style.setProperty('--scale-factor',String(viewport.scale))
        textElement.style.setProperty('--total-scale-factor',String(viewport.scale))
        textElement.replaceChildren()
        setPageDims({width:viewport.width,height:viewport.height})
        const context=canvas.getContext('2d',{alpha:false})
        if(!context)throw new Error('Canvas 2D nu este disponibil.')
        renderTask=pdfPage.render({canvas,canvasContext:context,viewport,transform:[pxRatio,0,0,pxRatio,0,0]})
        await renderTask.promise
        if(cancelled)return
        layer=new pdfjs.TextLayer({
          textContentSource:pdfPage.streamTextContent(),container:textElement,viewport,
        })
        await layer.render()
        if(!cancelled)setRendering(false)
      }catch(e){
        if(cancelled||String(e).includes('RenderingCancelledException'))return
        setError(`Nu se poate reda pagina ${page}: ${errorText(e)}`);setRendering(false)
      }
    }
    void render()
    return ()=>{cancelled=true;renderTask?.cancel();layer?.cancel()}
  },[page,total,zoom,containerWidth])

  // PDF.js extrage textul paginilor. Documentele scanate fără strat text
  // nu pot fi căutate fără OCR (lăsat pentru o versiune viitoare).
  useEffect(()=>{
    let cancelled=false
    setMatches([]);setScannedPages(0)
    const needle=search.trim().toLocaleLowerCase('ro-RO')
    if(!needle||!docRef.current){setSearchBusy(false);return}
    const doc=docRef.current
    const timer=window.setTimeout(async()=>{
      setSearchBusy(true)
      const found:{page:number;count:number}[]=[]
      for(let i=1;i<=doc.numPages;i++){
        if(cancelled)break
        try{
          const pdfPage=await doc.getPage(i)
          const content=await pdfPage.getTextContent()
          if(cancelled)break
          const line=content.items.map(item=>'str'in item?item.str:'').join(' ').toLocaleLowerCase('ro-RO')
          const chunks=line.split(needle).length-1
          if(chunks>0)found.push({page:i,count:chunks})
          if(i%10===0||i===doc.numPages){setScannedPages(i);setMatches([...found])}
        }catch{/* A bad page must not break search through other pages. */}
      }
      if(!cancelled)setSearchBusy(false)
    },250)
    return ()=>{cancelled=true;window.clearTimeout(timer)}
  },[search,total])

  const bookmark=study.bookmarks.includes(page)
  const pageNotes=useMemo(()=>study.notes.filter(n=>n.page===page).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[study.notes,page])
  const pageMarks=useMemo(()=>study.highlights.filter(h=>h.page===page),[study.highlights,page])
  const goTo=useCallback((target:number)=>{
    setPage(safePdfPage(target,total||1));setSelected(null)
    scrollRef.current?.scrollTo({top:0,behavior:'smooth'})
  },[total])
  const toggleBookmark=()=>setStudy(s=>({...s,bookmarks:bookmark?s.bookmarks.filter(p=>p!==page):[...s.bookmarks,page].sort((a,b)=>a-b)}))
  const addNote=()=>{
    const text=draft.trim().slice(0,4000)
    if(!text)return
    const now=new Date().toISOString()
    setStudy(s=>({...s,notes:[...s.notes,{id:makeId(),page,text,createdAt:now,updatedAt:now}]}))
    setDraft('');setPanel('notes');setShowPanel(true)
  }
  const captureSelection=()=>{
    const sel=window.getSelection()
    const pageNode=sheetRef.current
    const textNode=textRef.current
    if(!sel||sel.isCollapsed||!pageNode||!textNode||!sel.anchorNode||!sel.focusNode)return
    if(!textNode.contains(sel.anchorNode)||!textNode.contains(sel.focusNode))return
    const quote=sel.toString().trim().slice(0,500)
    const rects=normalizedHighlightRects(sel.getRangeAt(0).getClientRects(),pageNode.getBoundingClientRect())
    if(quote&&rects.length)setSelected({quote,rects})
  }
  const addHighlight=(color:PdfMarkColor)=>{
    if(!selected)return
    const current=selected
    setStudy(s=>({...s,highlights:[...s.highlights,{id:makeId(),page,quote:current.quote,color,rects:current.rects,createdAt:new Date().toISOString()}]}))
    setSelected(null);window.getSelection()?.removeAllRanges()
  }
  const onReaderKey=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
    const tag=(e.target as HTMLElement).tagName
    if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag)||e.altKey||e.ctrlKey||e.metaKey)return
    if(e.key==='ArrowRight'){e.preventDefault();goTo(page+1)}
    if(e.key==='ArrowLeft'){e.preventDefault();goTo(page-1)}
  }

  return <div className="sf-reader flex h-[min(73dvh,850px)] min-h-[360px] flex-col overflow-hidden rounded-[20px] bg-canvas" onKeyDown={onReaderKey} tabIndex={0} aria-label={`Cititor PDF: ${title}`}>
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-2.5 py-2 sm:px-4">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Pagina anterioară" className={iconButton} onClick={()=>goTo(page-1)} disabled={page<=1||!total}><Glyph name="left"/></button>
        <label className="flex items-center gap-1 text-xs font-semibold text-ink-soft"><span className="sr-only">Pagina PDF</span><input aria-label="Pagina curentă" type="number" min={1} max={total||1} value={page} onChange={e=>{if(e.target.value)goTo(Number(e.target.value))}} className="w-11 rounded-lg border border-line bg-canvas px-1 py-2 text-center outline-none focus:border-brand"/> / {total||'–'}</label>
        <button type="button" aria-label="Pagina următoare" className={iconButton} onClick={()=>goTo(page+1)} disabled={page>=total||!total}><Glyph name="right"/></button>
      </div>
      <div className="h-6 w-px bg-ink/[0.1]"/>
      <button type="button" aria-label="Micșorează" className={iconButton} onClick={()=>setZoom(z=>Math.max(.65,Math.round((z-.15)*100)/100))} disabled={zoom<=.65}><Glyph name="minus"/></button>
      <button type="button" title="Resetare zoom" className="min-w-12 text-xs font-semibold tabular-nums text-ink-soft" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button>
      <button type="button" aria-label="Mărește" className={iconButton} onClick={()=>setZoom(z=>Math.min(2.5,Math.round((z+.15)*100)/100))} disabled={zoom>=2.5}><Glyph name="plus"/></button>
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" title={bookmark?'Elimină semnul de carte':'Adaugă semn de carte'} aria-pressed={bookmark} aria-label={bookmark?'Elimină marcajul paginii':'Marchează pagina'} className={`${iconButton} ${bookmark?'!bg-warning/15 !text-warning':''}`} onClick={toggleBookmark}><Glyph name="star"/></button>
        <button type="button" title="Caută text" aria-label="Caută în PDF" aria-pressed={isSearchOpen} className={`${iconButton} ${isSearchOpen?'!bg-brand-soft !text-brand-text':''}`} onClick={()=>setSearchOpen(v=>!v)}><Glyph name="search"/></button>
        <button type="button" title="Notițe și marcaje" aria-label="Deschide panoul de studiu" aria-pressed={showPanel} className={`${iconButton} ${showPanel?'!bg-brand-soft !text-brand-text':''}`} onClick={()=>setShowPanel(v=>!v)}><Glyph name="list"/></button>
      </div>
    </div>
    {isSearchOpen&&<div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2.5">
      <Glyph name="search" size={16}/><input autoFocus type="search" aria-label="Text de căutat în PDF" className="min-w-24 flex-1 rounded-lg bg-canvas px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand/20" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Caută în toate paginile..."/>
      {search.trim()&&<span className="text-[11px] text-ink-soft">{searchBusy?`Caut... ${scannedPages}/${total}`:`${matches.reduce((n,m)=>n+m.count,0)} rezultate`}</span>}
      <button type="button" className={iconButton} aria-label="Închide căutarea" onClick={()=>{setSearchOpen(false);setSearch('')}}><Glyph name="x" size={15}/></button>
      {matches.length>0&&<div className="flex w-full gap-1.5 overflow-x-auto pb-0.5">{matches.slice(0,80).map(m=><button type="button" key={m.page} className={`${btn} shrink-0 !px-2.5 !py-1.5`} onClick={()=>goTo(m.page)}>p. {m.page} · {m.count}</button>)}</div>}
    </div>}
    {storageError&&<div role="alert" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">Spațiul local nu permite salvarea marcajelor. Păstrează originalul și verifică setările browserului.</div>}
    <div className="relative flex min-h-0 flex-1">
      <div ref={stageRef} className="relative min-w-0 flex-1 overflow-hidden">
        <div ref={scrollRef} className="sf-reader-scroll h-full overflow-auto px-3 py-4 sm:px-5" aria-live="polite">
          {error&&<div role="alert" className="mx-auto max-w-lg rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">{error}</div>}
          {loading&&<p className="py-16 text-center text-sm text-ink-soft">Se încarcă documentul...</p>}
          {!loading&&total>0&&<div className="mx-auto w-max max-w-none pb-5">
            <div ref={sheetRef} key={`${page}-${zoom}-${containerWidth}`} className="sf-pdf-sheet relative isolate overflow-hidden bg-surface shadow-[0_8px_32px_rgba(0,0,0,.16)]" style={{width:pageDims.width,height:pageDims.height}}>
              <canvas ref={canvasRef} className="absolute left-0 top-0" aria-label={`Pagina ${page} din ${total}`}/>
              <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
                {pageMarks.map(mark=>mark.rects.map((r,i)=><div key={`${mark.id}-${i}`} className="absolute mix-blend-multiply" style={{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`,backgroundColor:pdfMarkColors[mark.color],opacity:.62}}/>))}
              </div>
              <div ref={textRef} className="textLayer sf-pdf-text-layer absolute left-0 top-0 z-[2]" onMouseUp={captureSelection} onTouchEnd={()=>window.setTimeout(captureSelection,40)}/>
              {rendering&&<div className="pointer-events-none absolute inset-0 z-[3] grid place-items-center bg-surface/65 text-xs text-ink-soft">Se pregătește pagina...</div>}
            </div>
          </div>}
          {!loading&&total>0&&<p className="py-1 text-center text-[11px] text-ink-soft">Pagina {page} din {total} · Documentul original nu este modificat</p>}
        </div>
        {selected&&<div className="absolute bottom-3 left-1/2 z-10 w-max max-w-[calc(100%-20px)] -translate-x-1/2 rounded-[18px] border border-line bg-surface p-2.5 shadow-xl">
          <p className="mb-2 max-w-64 truncate text-[11px] font-semibold text-ink-soft">Evidențiază: „{selected.quote}”</p>
          <div className="flex items-center justify-center gap-2">{(Object.keys(pdfMarkColors) as PdfMarkColor[]).map(color=><button type="button" key={color} aria-label={`Evidențiază ${color}`} onClick={()=>addHighlight(color)} className="size-9 rounded-xl border border-line transition hover:scale-110" style={{backgroundColor:pdfMarkColors[color]}}/>)}<button type="button" aria-label="Anulează selecția" className={iconButton} onClick={()=>{setSelected(null);window.getSelection()?.removeAllRanges()}}><Glyph name="x" size={16}/></button></div>
        </div>}
      </div>
      {showPanel&&<aside className="sf-reader-panel absolute inset-y-0 right-0 z-20 w-[min(84vw,310px)] shrink-0 overflow-y-auto border-l border-line bg-surface px-3 py-3 shadow-2xl sm:static sm:w-[270px] sm:shadow-none sm:px-4" aria-label="Notițe și semne de carte">
        <div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold">Spațiul de studiu</span><button onClick={()=>setShowPanel(false)} aria-label="Închide panoul" className={iconButton}><Glyph name="x" size={15}/></button></div>
        <div className="mb-3 flex gap-1 rounded-xl bg-canvas p-1">{([{id:'bookmarks',text:'Pagini'},{id:'notes',text:'Notițe'},{id:'highlights',text:'Culori'}] as const).map(x=><button key={x.id} type="button" className={`min-w-0 flex-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${panel===x.id?'bg-surface text-brand-text shadow-sm':'text-ink-soft'}`} onClick={()=>setPanel(x.id)}>{x.text}</button>)}</div>
        {panel==='bookmarks'&&<div className="space-y-2">{study.bookmarks.length===0?<p className="py-6 text-center text-xs text-ink-soft">Marchează paginile importante cu steluța din bara de sus.</p>:study.bookmarks.map(p=><div key={p} className="flex items-center gap-2 rounded-xl bg-canvas p-2"><button className="min-w-0 flex-1 text-left text-xs font-semibold" onClick={()=>goTo(p)}>Pagina {p}</button><button aria-label={`Elimină marcajul paginii ${p}`} onClick={()=>setStudy(s=>({...s,bookmarks:s.bookmarks.filter(a=>a!==p)}))} className="text-ink-faint"><Glyph name="x" size={15}/></button></div>)}</div>}
        {panel==='notes'&&<div className="space-y-3"><label className="block text-xs font-semibold text-ink-soft">Notiță pentru pagina {page}<textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} rows={4} placeholder="Scrie o idee, o formulă sau ce trebuie repetat..." className="mt-2 w-full resize-y rounded-xl border border-line bg-canvas p-2.5 text-xs leading-5 outline-none focus:border-brand"/></label><button type="button" className={`${accent} w-full`} disabled={!draft.trim()} onClick={addNote}>Salvează notița</button>{pageNotes.length===0?<p className="py-3 text-xs text-ink-soft">Nu ai notițe pe această pagină.</p>:pageNotes.map(n=><article key={n.id} className="rounded-xl bg-canvas p-3"><p className="whitespace-pre-wrap break-words text-xs leading-5">{n.text}</p><button className="mt-2 text-[11px] font-semibold text-danger" onClick={()=>setStudy(s=>({...s,notes:s.notes.filter(a=>a.id!==n.id)}))}>Șterge notița</button></article>)}{study.notes.length>pageNotes.length&&<div className="border-t border-line pt-3"><p className="mb-2 text-[11px] font-semibold text-ink-soft">Alte pagini cu notițe</p>{Array.from(new Set(study.notes.map(n=>n.page))).filter(p=>p!==page).sort((a,b)=>a-b).map(p=><button type="button" key={p} className={`${btn} mb-1 mr-1`} onClick={()=>goTo(p)}>p. {p}</button>)}</div>}</div>}
        {panel==='highlights'&&<div className="space-y-2">{study.highlights.length===0?<p className="py-6 text-center text-xs leading-5 text-ink-soft">Selectează textul în PDF, apoi alege culoarea. Evidențierile vor apărea aici.</p>:study.highlights.slice().sort((a,b)=>a.page-b.page).map(mark=><div key={mark.id} className="rounded-xl bg-canvas p-3"><button className="block w-full border-l-4 pl-2 text-left" style={{borderColor:pdfMarkColors[mark.color]}} onClick={()=>goTo(mark.page)}><span className="block text-[10px] font-semibold text-ink-soft">Pagina {mark.page}</span><span className="mt-1 line-clamp-3 break-words text-xs text-ink">{mark.quote}</span></button><button type="button" className="mt-2 text-[11px] font-semibold text-danger" onClick={()=>setStudy(s=>({...s,highlights:s.highlights.filter(a=>a.id!==mark.id)}))}>Elimină evidențierea</button></div>)}</div>}
      </aside>}
    </div>
    <div className="border-t border-line bg-surface px-3 py-1.5 text-center text-[10px] text-ink-soft">Selectează text pentru evidențiere · ← / → pentru pagini · Notițele se salvează local</div>
  </div>
}
