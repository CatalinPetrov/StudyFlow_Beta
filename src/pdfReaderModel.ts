/** Date de studiu asociate unui PDF. PDF-ul original rămâne neatins în IndexedDB. */
export type PdfMarkColor = 'yellow' | 'mint' | 'rose' | 'blue'
export type PdfRect = { x:number; y:number; width:number; height:number }
export type PdfHighlight = {
  id:string; page:number; quote:string; color:PdfMarkColor; rects:PdfRect[]; createdAt:string
}
export type PdfPageNote = {id:string;page:number;text:string;createdAt:string;updatedAt:string}
export type PdfStudyData = {
  version:1; lastPage:number; bookmarks:number[]; notes:PdfPageNote[]; highlights:PdfHighlight[]
}
export const studyPrefix='studyflow-pdf-study-v1:'
const prefix=studyPrefix
export const defaultPdfStudyData=():PdfStudyData=>({version:1,lastPage:1,bookmarks:[],notes:[],highlights:[]})
export const pdfMarkColors:Record<PdfMarkColor,string>={
  yellow:'#ffe16a',mint:'#8ce3c4',rose:'#ffacc2',blue:'#a6c8ff'
}
const positivePage=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=1&&n<=100000
export function loadPdfStudyData(id:string):PdfStudyData{
  try{
    const d=JSON.parse(localStorage.getItem(prefix+id)||'null')
    if(!d||typeof d!=='object')return defaultPdfStudyData()
    return {
      version:1,
      lastPage:positivePage(d.lastPage)?d.lastPage:1,
      bookmarks:Array.isArray(d.bookmarks)?Array.from(new Set<number>(d.bookmarks.filter(positivePage))).slice(0,2000).sort((a,b)=>a-b):[],
      notes:Array.isArray(d.notes)?d.notes.filter((n:PdfPageNote)=>n&&typeof n.id==='string'&&positivePage(n.page)&&typeof n.text==='string').map((n:PdfPageNote)=>({...n,text:n.text.slice(0,4000)})).slice(0,500):[],
      highlights:Array.isArray(d.highlights)?d.highlights.filter((h:PdfHighlight)=>h&&typeof h.id==='string'&&positivePage(h.page)&&typeof h.quote==='string'&&Object.keys(pdfMarkColors).includes(h.color)&&Array.isArray(h.rects)).slice(0,1500):[],
    }
  }catch{return defaultPdfStudyData()}
}
export function saveStudyData(id:string,data:PdfStudyData):boolean{ return savePdfStudyData(id,data) }
export function loadStudyData(id:string):PdfStudyData|null{ try { const r = loadPdfStudyData(id); return r as any } catch { return null } }
export function savePdfStudyData(id:string,data:PdfStudyData):boolean{
  try{localStorage.setItem(prefix+id,JSON.stringify(data));return true}catch{return false}
}
export function removePdfStudyData(id:string):void{
  try{localStorage.removeItem(prefix+id)}catch{/* Browser storage blocked */}
}
export function safePdfPage(page:number,total:number):number{
  return Math.min(Math.max(1,Math.floor(page)||1),Math.max(1,total))
}
export function normalizedHighlightRects(rects:DOMRectList|DOMRect[],container:DOMRect):PdfRect[]{
  if(container.width<=0||container.height<=0)return []
  return Array.from(rects).filter(r=>r.width>1&&r.height>1&&r.right>container.left&&r.left<container.right&&r.bottom>container.top&&r.top<container.bottom).slice(0,80).map(r=>({
    x:Math.max(0,(Math.max(r.left,container.left)-container.left)/container.width),
    y:Math.max(0,(Math.max(r.top,container.top)-container.top)/container.height),
    width:Math.min(1,(Math.min(r.right,container.right)-Math.max(r.left,container.left))/container.width),
    height:Math.min(1,(Math.min(r.bottom,container.bottom)-Math.max(r.top,container.top))/container.height),
  })).filter(r=>r.width>0&&r.height>0)
}
