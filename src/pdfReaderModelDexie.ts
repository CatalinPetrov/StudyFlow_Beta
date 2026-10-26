import { db } from './data/db'
import { loadStudyData, saveStudyData, studyPrefix } from './pdfReaderModel'

const memory = new Map<string, any>()

export function loadAllPdfNotes(): any[] {
  return Array.from(memory.values())
}

export function loadPdfStudyData(id: string): any | null {
  const cached = memory.get(id)
  if (cached) return cached
  try { return (loadStudyData as any)(id) ?? null } catch { return null }
}

export function savePdfStudyData(data: any): boolean {
  const key = data?.id
  if (key) memory.set(key, data)
  void (db as any).pdfNotes.put({ id: key, ...data }).catch(() => undefined)
  try { if (key) return (saveStudyData as any)(key, data); return true } catch { return true }
}

export function removePdfStudyData(id: string): void {
  memory.delete(id)
  void (db as any).pdfNotes.delete(id).catch(() => undefined)
  try { localStorage.removeItem((studyPrefix as string) + id) } catch { /* ignore */ }
}

export function primePdfNotes(notes: any[]): void {
  memory.clear()
  for (const note of notes || []) {
    const key = (note as any)?.id
    if (key) memory.set(String(key), note)
  }
}

export { studyPrefix }
