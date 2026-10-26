/** Study Hub v1: date noi, independente de Taskuri/Orar/Library. */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'
export type StudyDeck = { id: string; title: string; subjectId: string; semesterId: string; createdAt: string }
export type Flashcard = {
  id: string; deckId: string; front: string; back: string; createdAt: string
  dueDate: string; intervalDays: number; repetitions: number; lastReviewedAt?: string
}
export type FocusSettings = {
  focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number
  longBreakEvery: number; sound: boolean; autoStartNext: boolean
}
export type FocusPhase = 'focus' | 'short' | 'long'
export type FocusTimer = {
  phase: FocusPhase; remainingSeconds: number; totalSeconds: number
  runningUntil: number | null; completedFocusCycles: number
  subjectId: string; taskId: number | null
}
export type FocusSession = {
  id: string; endedAt: string; seconds: number; subjectId: string; taskId: number | null
}
export const studyHubStorage = {
  decks: 'studyflow-study-decks-v1', cards: 'studyflow-study-cards-v1',
  focusSettings: 'studyflow-focus-settings-v1', focusTimer: 'studyflow-focus-timer-v1',
  focusSessions: 'studyflow-focus-sessions-v1',
} as const
export const defaultFocusSettings: FocusSettings = {
  focusMinutes:25, shortBreakMinutes:5, longBreakMinutes:20,
  longBreakEvery:4, sound:false, autoStartNext:false,
}
export function createId(prefix: string): string {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function addCalendarDays(when: Date, days: number): string {
  const date = new Date(when.getFullYear(), when.getMonth(), when.getDate())
  date.setDate(date.getDate() + days)
  return localDay(date)
}
export function scheduleReview(card: Flashcard, grade: ReviewGrade, when = new Date()): Flashcard {
  // Algoritm local transparent: nu pretindem că este SM-2/FSRS.
  const nextInterval = grade==='again' ? 0 : grade==='hard'
    ? Math.max(1,Math.ceil(card.intervalDays*1.25))
    : grade==='good' ? (card.intervalDays ? Math.max(2,Math.ceil(card.intervalDays*2.2)) : 1)
    : (card.intervalDays ? Math.max(3,Math.ceil(card.intervalDays*3.1)) : 3)
  return {
    ...card, dueDate:addCalendarDays(when,nextInterval),intervalDays:nextInterval,
    repetitions:grade==='again'?0:card.repetitions+1, lastReviewedAt:when.toISOString(),
  }
}
export function isDue(card: Flashcard, today=localDay()): boolean {return card.dueDate<=today}
export function clampMinutes(value: number, min: number, max: number): number {
  return Number.isFinite(value)?Math.max(min,Math.min(max,Math.floor(value))):min
}
export function validSettings(source: unknown): FocusSettings {
  const s = source && typeof source==='object' ? source as Partial<FocusSettings> : {}
  return {
    focusMinutes:clampMinutes(Number(s.focusMinutes ?? 25),1,180),
    shortBreakMinutes:clampMinutes(Number(s.shortBreakMinutes ?? 5),1,60),
    longBreakMinutes:clampMinutes(Number(s.longBreakMinutes ?? 20),1,90),
    longBreakEvery:clampMinutes(Number(s.longBreakEvery ?? 4),1,12),
    sound:s.sound===true, autoStartNext:s.autoStartNext===true,
  }
}
export function secondsForPhase(phase: FocusPhase, settings: FocusSettings): number {
  return (phase==='focus'?settings.focusMinutes:phase==='short'?settings.shortBreakMinutes:settings.longBreakMinutes)*60
}
export function createFocusTimer(settings: FocusSettings):FocusTimer {
  const seconds=secondsForPhase('focus',settings)
  return {phase:'focus',remainingSeconds:seconds,totalSeconds:seconds,runningUntil:null,completedFocusCycles:0,subjectId:'',taskId:null}
}
export function nextPhase(phase: FocusPhase, completedCycles: number, settings:FocusSettings):FocusPhase {
  if (phase!=='focus') return 'focus'
  return completedCycles>0&&completedCycles%settings.longBreakEvery===0?'long':'short'
}
export function readSaved<T>(key:string,fallback:T,validate:(value:unknown)=>value is T):T {
  try {const raw=localStorage.getItem(key);const value=raw?JSON.parse(raw):null;return validate(value)?value:fallback}
  catch{return fallback}
}
export function persist(key:string,value:unknown):boolean {
  try {localStorage.setItem(key,JSON.stringify(value));return true} catch{return false}
}
export const isDecks=(value:unknown):value is StudyDeck[]=>Array.isArray(value)&&value.every(v=>v&&typeof v.id==='string'&&typeof v.title==='string'&&typeof v.subjectId==='string')
export const isCards=(value:unknown):value is Flashcard[]=>Array.isArray(value)&&value.every(v=>v&&typeof v.id==='string'&&typeof v.deckId==='string'&&typeof v.front==='string'&&typeof v.back==='string'&&typeof v.dueDate==='string')
export const isSessions=(value:unknown):value is FocusSession[]=>Array.isArray(value)&&value.every(v=>v&&typeof v.id==='string'&&typeof v.endedAt==='string'&&typeof v.seconds==='number')
export const isTimer=(value:unknown):value is FocusTimer=>!!value&&typeof value==='object'&&['focus','short','long'].includes((value as FocusTimer).phase)&&typeof (value as FocusTimer).remainingSeconds==='number'&&typeof (value as FocusTimer).totalSeconds==='number'&&typeof (value as FocusTimer).completedFocusCycles==='number'&&('runningUntil' in value)
