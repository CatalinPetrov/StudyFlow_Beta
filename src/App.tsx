import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlanTasks, TaskDetails, TaskEditor } from './PlanTasks'
import { weekTasks, type StudyTask, type TaskDraft, type TaskStatus } from './taskModel'
import { PlanSchedule } from './PlanSchedule'
import { PlanCalendar } from './PlanCalendar'
import { upcomingExam, type PersonalEvent, type StudyExam } from './calendarModel'
import { todayEntries, accentFor, type ScheduleEntry, type SemesterSettings } from './scheduleModel'
const SubjectsPage = lazy(() => import('./SubjectsPage').then(module => ({ default: module.SubjectsPage })))
const LibraryPage = lazy(() => import('./LibraryPage').then(module => ({ default: module.LibraryPage })))
const StudyHubPage = lazy(() => import('./StudyHubPage').then(module => ({ default: module.StudyHubPage })))
const ProfileSettingsPage = lazy(() => import('./ProfileSettingsPage').then(module => ({ default: module.ProfileSettingsPage })))
const NotificationsPage = lazy(() => import('./NotificationsPage').then(module => ({ default: module.NotificationsPage })))
import { loadUserSettings, cleanSettings, initialsFor, firstName, type UserSettings } from './profileModel'
import { buildNotifications, loadReadIds, type StudyNotification } from './notificationModel'
import { loadLibraryItems, loadLibraryFolders, type LibraryItem, type LibraryFolder, type LibrarySection } from './libraryModel'
import { currentSemester, loadAcademicState, normalizedSubject, tagLegacyRecord, type Subject } from './academicModel'
import { LAST_USER_ID_KEY, META_KEYS, clearLocalData, saveEvents, saveExams, saveLibraryFolders, saveLibraryItems, saveSchedule, saveTasks, setMeta } from './data/db'
import { initializePdfNotesData, initializeStudyFlowData, initializeStudyHubData, pdfMigrationKey, studyMigrationKey } from './data/migration'
import { primePdfNotes } from './pdfReaderModelDexie'
import { db } from './data/db'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DialogSurface } from './components/ui/DialogSurface'
import { pageFromPath, pagePaths, type PageId } from './lib/navigation'
import { applyTheme, getThemePreference, saveThemePreference, type ThemePreference } from './lib/theme'
import { requestPersistentStorage, storageErrorMessage } from './lib/storage'
import { useAuth } from './auth/AuthContext'
import { syncAll, syncPushAll } from './data/sync'

type IconProps = { className?: string }
const svg = (children: ReactNode) =>
  function Icon({ className = 'size-5' }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {children}
      </svg>
    )
  }

const IconSubjects = svg(
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 5.5v16M9 8h7" />
  </>,
)
const IconTasks = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.8 2.7L16 9.5" />
  </>,
)
const IconSchedule = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </>,
)
const IconLocation = svg(
  <>
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </>,
)
const IconProfessor = svg(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20v-1.5a7 7 0 0 1 14 0V20" />
  </>,
)
const IconCalendar = svg(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
)
const IconLibrary = svg(
  <>
    <path d="M5 4v16M10 4v16" />
    <path d="m14.5 5.5 4-1 2.5 14.5-4 1z" />
  </>,
)
const IconBell = svg(
  <>
    <path d="M6 16.500V11a6 6 0 1 1 12 0v5.500l1.500 2h-15z" />
    <path d="M10 21h4" />
  </>,
)

const quickActions = [
  { label: 'Task / Temă', hint: 'Cu deadline și materie', icon: IconTasks, color: '#0071e3' },
  { label: 'Materie', hint: 'Adaugă o disciplină nouă', icon: IconSubjects, color: '#af52de' },
  { label: 'Examen', hint: 'Dată, oră, tip și sală', icon: IconCalendar, color: '#ff3b30' },
  { label: 'Eveniment', hint: 'Întâlniri și activități', icon: IconCalendar, color: '#ed9a33' },
  { label: 'Curs / Laborator', hint: 'În orarul săptămânal', icon: IconSchedule, color: '#34c759' },
  { label: 'Material', hint: 'Notițe, PDF-uri, link-uri', icon: IconLibrary, color: '#ff9f0a' },
]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const minutesOfDay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatDue(dueDate: string, reference: Date): string {
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const due = new Date(`${dueDate}T00:00:00`)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (!dueDate) return 'Fără termen'
  if (diff < 0) return 'Restant'
  if (diff === 0) return 'Astăzi'
  if (diff === 1) return 'Mâine'
  return due.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' })
}


type PlanTab = 'Taskuri' | 'Orar' | 'Calendar'
type DetailModal = { title: string; body: ReactNode } | null
const pageTitles: any = {
  home: 'Acasă',
  plan: 'Plan',
  subjects: 'Materii',
  library: 'Library',
  study: 'Study Hub',
  profile: 'Profil',
  notifications: 'Notificări',
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`rounded-card border border-line bg-surface p-6 shadow-card ${className}`}
    >
      {children}
    </section>
  )
}

function AddSheet({ open, onClose, onTaskClick, onScheduleClick, onExamClick, onEventClick, onSubjectClick, onMaterialClick }: { open: boolean; onClose: () => void; onTaskClick: () => void; onScheduleClick: () => void; onExamClick: () => void; onEventClick: () => void; onSubjectClick: () => void; onMaterialClick: () => void }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <DialogSurface
        label="Adaugă"
        onClose={onClose}
        active={open}
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[32px] bg-surface/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] backdrop-blur-2xl transition-transform duration-300 ease-out lg:bottom-auto lg:top-1/2 lg:rounded-[32px] lg:pb-6 ${
          open ? 'translate-y-0 lg:-translate-y-1/2' : 'translate-y-full lg:translate-y-[120%]'
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/[0.15]" />
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xl font-semibold tracking-tight">Adaugă</h2>
          <button onClick={onClose} className="rounded-full bg-ink/[0.05] px-3 py-1 text-sm font-medium text-ink-soft hover:bg-ink/[0.1]">
            Închide
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {quickActions.map(({ label, hint, icon: Icon, color }) => (
            <li key={label}>
              <button
                onClick={label === 'Task / Temă' ? onTaskClick : label === 'Curs / Laborator' ? onScheduleClick : label === 'Examen' ? onExamClick : label === 'Eveniment' ? onEventClick : label === 'Materie' ? onSubjectClick : onMaterialClick}
                className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:bg-ink/[0.04] active:bg-ink/[0.07]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
                  <Icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-ink-soft">{hint}</span>
                </span>
                <svg viewBox="0 0 24 24" className="size-4 text-ink-soft/60" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </DialogSurface>
    </div>
  )
}

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <section>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1 text-ink-soft">{subtitle}</p>
      </header>
      {children}
    </section>
  )
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <Card className="grid min-h-48 place-content-center text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{text}</p>
    </Card>
  )
}

function PlanPage({ tab, onTabChange, tasks, onToggleTask, reference, onAddTask, onOpenTask, semester, semesterSettingsById, activeSemesterId, registeredSubjects, scheduleEntries, onSemester, onScheduleEntries, scheduleRequest, onScheduleRequestHandled, exams, events, onSaveExam, onDeleteExam, onSaveEvent, onDeleteEvent, calendarAdd, calendarOpenExam, onCalendarAddHandled, onCalendarExamHandled }: {
  tab: PlanTab
  onTabChange: (tab: PlanTab) => void
  tasks: StudyTask[]
  onToggleTask: (id: number) => void
  reference: Date
  onAddTask: () => void
  onOpenTask: (id: number) => void
  semester: SemesterSettings
  semesterSettingsById: Record<string,SemesterSettings>
  activeSemesterId: string
  registeredSubjects: string[]
  scheduleEntries: ScheduleEntry[]
  onSemester: (s:SemesterSettings)=>void
  onScheduleEntries: (e:ScheduleEntry[])=>void
  scheduleRequest: boolean
  onScheduleRequestHandled: ()=>void
  exams: StudyExam[]
  events: PersonalEvent[]
  onSaveExam: (exam:StudyExam)=>void
  onDeleteExam: (id:string)=>void
  onSaveEvent: (event:PersonalEvent)=>void
  onDeleteEvent: (id:string)=>void
  calendarAdd: {kind:'exam'|'event';token:number}|null
  calendarOpenExam: {id:string;token:number}|null
  onCalendarAddHandled: ()=>void
  onCalendarExamHandled: ()=>void
}) {
  const tabs: PlanTab[] = ['Taskuri', 'Orar', 'Calendar']
  return (
    <PageShell title="Plan" subtitle="Taskuri, orar și examene, într-un singur loc.">
      <div className="mb-6 inline-flex max-w-full rounded-xl bg-ink/[0.06] p-1" role="tablist" aria-label="Secțiuni Plan">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => onTabChange(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Taskuri' && <PlanTasks tasks={tasks} reference={reference} onAdd={onAddTask} onOpen={onOpenTask} onToggle={onToggleTask} />}
      {tab === 'Orar' && <PlanSchedule key={activeSemesterId} entries={scheduleEntries.filter(e=>e.semesterId===activeSemesterId)} settings={semester} reference={reference} subjects={registeredSubjects} onSettings={onSemester} onEntries={onScheduleEntries} newRequest={scheduleRequest} onRequestHandled={onScheduleRequestHandled} />}
      {tab === 'Calendar' && <PlanCalendar tasks={tasks} exams={exams} events={events} schedule={scheduleEntries} semester={semester} reference={reference} subjects={registeredSubjects} semesterSettingsById={semesterSettingsById} onSaveExam={onSaveExam} onDeleteExam={onDeleteExam} onSaveEvent={onSaveEvent} onDeleteEvent={onDeleteEvent} onOpenTask={onOpenTask} onOpenSchedule={()=>onTabChange('Orar')} externalAdd={calendarAdd} externalOpenExam={calendarOpenExam} onExternalAddHandled={onCalendarAddHandled} onExternalExamHandled={onCalendarExamHandled} />}
    </PageShell>
  )
}


function TodayClasses({ reference, items, onViewSchedule, onDetails }: {
  reference: Date
  items: ScheduleEntry[]
  onViewSchedule?: () => void
  onDetails: (title: string, body: ReactNode) => void
}) {
  const minute = reference.getHours() * 60 + reference.getMinutes()
  const activeIndex = items.findIndex(c => minute >= minutesOfDay(c.startTime) && minute < minutesOfDay(c.endTime))
  const nextIndex = items.findIndex(c => minute < minutesOfDay(c.startTime))
  const current = items[activeIndex]
  const next = items[nextIndex]
  const totalMinutes = items.reduce((sum, c) => sum + minutesOfDay(c.endTime) - minutesOfDay(c.startTime), 0)
  const duration = Number.isInteger(totalMinutes / 60) ? `${totalMinutes / 60} ore` : `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`
  const context = !items.length ? 'Nu ai activități programate astăzi.' : current
    ? `În desfășurare · ${current.kind.toLowerCase()}ul se termină la ${current.endTime}.`
    : next ? nextIndex === 0
      ? `Următoarea activitate începe la ${next.startTime}.`
      : `Ești în pauză. Următoarea activitate: ${next.subject}, la ${next.startTime}.`
    : 'Ai terminat toate activitățile de astăzi.'

  return <Card>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">Orele de astăzi</h2>
        <p className="text-sm text-ink-soft">{items.length} activități · {duration}</p>
      </div>
      {onViewSchedule && <button className="shrink-0 pt-1 text-xs font-semibold text-brand-text hover:underline" onClick={onViewSchedule}>Vezi orarul ›</button>}
    </div>

    <p className="mb-4 rounded-2xl bg-canvas px-4 py-3 text-sm text-ink-soft" role="status">{context}</p>
    <ul className="flex flex-col gap-3">{items.map(c => {
      const active = minute >= minutesOfDay(c.startTime) && minute < minutesOfDay(c.endTime)
      const ended = minute >= minutesOfDay(c.endTime)
      const status = ended ? 'Încheiat' : active ? 'În desfășurare' : 'Urmează'
      const metaColor = active ? 'text-white/80' : 'text-ink-soft'
      return <li key={c.id}>
        <button
          onClick={() => onDetails(c.subject, <>
            <p><strong>Tip:</strong> {c.kind}</p>
            <p><strong>Interval:</strong> {c.startTime} – {c.endTime}</p>
            <p><strong>Sală:</strong> {c.room || 'Nespecificată'}</p>
            <p><strong>Profesor:</strong> {c.professor || 'Nespecificat'}</p>
          </>)}
          className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors sm:gap-4 sm:p-4 ${active ? 'bg-brand text-white shadow-[0_10px_24px_rgba(0,113,227,0.28)]' : 'bg-canvas hover:bg-surface-hover'} ${ended && !active ? 'opacity-65' : ''}`}
        >
          <div className="w-12 shrink-0 pt-0.5 sm:w-14">
            <p className="text-[15px] font-semibold tabular-nums leading-none sm:text-lg">{c.startTime}</p>
            <p className={`mt-1 text-xs tabular-nums ${metaColor}`}>{c.endTime}</p>
          </div>
          <span className="h-12 w-1 shrink-0 rounded-full" style={{ background: active ? 'rgba(255,255,255,0.7)' : accentFor(c.subject) }} />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words text-sm font-semibold sm:text-base">{c.subject}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold leading-none sm:text-[11px] ${active ? 'bg-white/20 text-white' : ended ? 'bg-ink/[0.06] text-ink-soft' : 'bg-brand/10 text-brand-text'}`}>{status}</span>
            </span>
            <span className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${metaColor}`}>
              <span className={`rounded-md px-1.5 py-0.5 font-medium ${active ? 'bg-white/15 text-white' : 'bg-surface/80 text-ink-soft'}`}>{c.kind}</span>
              {c.room && <span className="inline-flex min-w-0 items-center gap-1"><IconLocation className="size-3.5 shrink-0" /><span className="break-words">{c.room}</span></span>}
              {c.professor && <span className="inline-flex min-w-0 items-center gap-1"><IconProfessor className="size-3.5 shrink-0" /><span className="break-words">{c.professor}</span></span>}
            </span>
          </span>
        </button>
      </li>
    })}</ul>
    {!items.length && <button onClick={onViewSchedule} className="mt-2 text-sm font-semibold text-brand-text">Configurează orarul →</button>}
  </Card>
}

function Tasks({ tasks, onToggle, reference, onViewAll, onDetails, onOpenTask, showAll = false }: {
  tasks: StudyTask[]
  onToggle: (id: number) => void
  reference: Date
  onViewAll?: () => void
  onDetails: (title: string, body: ReactNode) => void
  onOpenTask?: (id: number) => void
  showAll?: boolean
}) {
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))
  const visible = showAll ? sorted : sorted.slice(0, 4)
  const left = tasks.filter((t) => !t.done).length
  return (
    <Card className={showAll ? 'lg:col-span-2' : ''}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{showAll ? 'Toate taskurile' : 'Taskuri urgente'}</h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">{left} rămase</span>
          {onViewAll && <button onClick={onViewAll} className="text-xs font-semibold text-brand-text hover:underline">Vezi toate ›</button>}
        </div>
      </div>
      {left === 0 && !showAll ? (
        <div className="rounded-2xl bg-canvas p-4">
          <p className="text-sm text-ink-soft">{tasks.length === 0 ? 'Nu ai taskuri adăugate încă.' : 'Ești la zi cu taskurile tale! 🎉'}</p>
          {tasks.length === 0 && onViewAll && <button type="button" onClick={onViewAll} className="mt-2 text-sm font-semibold text-brand-text hover:underline">Deschide Taskuri →</button>}
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {visible.map((t) => {
            const overdue = !t.done && t.dueDate < dateKey(reference)
            const near = !t.done && !!t.dueDate && t.dueDate <= dateKey(new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + 1))
            return (
              <li key={t.id} className="flex items-center gap-3 py-3.5">
                <label className="relative cursor-pointer" aria-label={`Marchează ${t.title} ca ${t.done ? 'nefinalizat' : 'finalizat'}`}>
                  <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} className="peer sr-only" />
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-line text-transparent transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/25">
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                  </span>
                </label>
                <button onClick={() => onOpenTask ? onOpenTask(t.id) : onDetails(t.title, <><p><strong>Materie:</strong> {t.subject}</p><p><strong>Deadline:</strong> {formatDue(t.dueDate, reference)}</p><p><strong>Status:</strong> {t.done ? 'Finalizat' : 'De făcut'}</p></>)} className="min-w-0 flex-1 text-left">
                  <span className={`block truncate font-medium transition ${t.done ? 'text-ink-soft line-through' : ''}`}>{t.title}</span>
                  <span className="block truncate text-xs text-ink-soft">{t.subject}</span>
                </button>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${t.done ? 'bg-ink/[0.05] text-ink-soft' : overdue || near ? 'bg-danger/10 text-danger' : 'bg-ink/[0.05] text-ink-soft'}`}>{formatDue(t.dueDate, reference)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Exam({ reference, exams, onOpen, onAdd }: { reference: Date; exams:StudyExam[]; onOpen:(id:string)=>void; onAdd:()=>void }) {
  const exam = upcomingExam(exams, reference)
  const examDate = exam && new Date(`${exam.date}T${exam.time || '23:59'}:00`)
  const days = examDate ? Math.max(0, Math.round((Date.UTC(examDate.getFullYear(),examDate.getMonth(),examDate.getDate()) - Date.UTC(reference.getFullYear(),reference.getMonth(),reference.getDate()))/86400000)) : 0
  const r = 52
  const c = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, (30 - days) / 30))
  return (
    <Card className="relative overflow-hidden !bg-gradient-to-br from-[#1d1d1f] to-[#2c2c34] text-white">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Următorul examen</p>
        {exam && examDate ? <>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{exam.subject}</h2>
          <div className="my-6 flex items-center gap-5">
            <div className="relative size-28 shrink-0 sm:size-32">
              <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
                <circle cx="60" cy="60" r={r} fill="none" stroke="#2997ff" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center"><span className="text-4xl font-semibold leading-none tabular-nums">{days}</span><span className="mt-1 text-xs text-white/60">{days === 1 ? 'zi' : 'zile'}</span></div>
            </div>
            <dl className="min-w-0 space-y-2 text-sm">
              <div><dt className="text-white/50">Data</dt><dd className="font-medium">{examDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}{exam.time ? `, ${exam.time}` : ''}</dd></div>
              {exam.room && <div><dt className="text-white/50">Locație</dt><dd className="font-medium">{exam.room}</dd></div>}
              <div><dt className="text-white/50">Evaluare</dt><dd className="font-medium">{exam.kind}</dd></div>
            </dl>
          </div>
          <button onClick={() => onOpen(exam.id)} className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">Vezi examenul</button>
        </> : <>
          <p className="mt-4 text-sm text-white/75">Nu ai examene viitoare adăugate.</p>
          <button onClick={onAdd} className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/20">+ Adaugă examen</button>
        </>}
      </div>
    </Card>
  )
}

function WeeklyProgress({ tasks }: { tasks: StudyTask[] }) {
  const done = tasks.filter((t) => t.done).length
  const left = tasks.length - done
  const percentage = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">Progresul săptămânii</h2>
      {tasks.length ? <>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="pb-1 text-sm text-ink-soft"><strong className="text-ink">{done} din {tasks.length}</strong> taskuri finalizate</p>
          <span className="text-4xl font-bold tabular-nums tracking-tight">{percentage}%</span>
        </div>
        <div role="progressbar" aria-label="Progresul săptămânii" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/[0.1]">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percentage}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-soft">{left === 0 ? 'Toate taskurile săptămânii sunt finalizate! 🎉' : `Mai ai ${left} ${left === 1 ? 'task' : 'taskuri'} de finalizat.`}</p>
      </> : <p className="mt-4 text-sm text-ink-soft">Nu ai taskuri planificate săptămâna aceasta.</p>}
    </Card>
  )
}

function DetailsDialog({ details, onClose }: { details: DetailModal; onClose: () => void }) {
  if (!details) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-5 py-8" onMouseDown={(event: { target: EventTarget | null; currentTarget: EventTarget | null }) => { if (event.target === event.currentTarget) onClose() }}>
      <DialogSurface label={details.title} onClose={onClose} className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{details.title}</h2>
          <button onClick={onClose} aria-label="Închide detaliile" className="rounded-full bg-canvas px-3 py-1 text-sm">Închide</button>
        </div>
        <div className="mt-5 space-y-2 text-sm text-ink-soft">{details.body}</div>
      </DialogSurface>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Se încarcă pagina">
      <div className="flex items-center gap-3 text-sm font-medium text-ink-soft">
        <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />
        Se încarcă…
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const navigateTo = useNavigate()
  const page = pageFromPath(location.pathname)
  const goPage = useCallback((next: PageId) => {
    const path = (pagePaths as any)[next]
    if (location.pathname !== path) navigateTo(path)
    window.scrollTo({ top: 0 })
  }, [location.pathname, navigateTo])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [location.pathname])
  const { user: authUser, isValid: isLoggedIn, isLoading: authLoading, logout } = useAuth()
  const isAuthPage = page === 'auth-login' || page === 'auth-register'
  useEffect(() => {
    if (authLoading) return
    if (!isLoggedIn && !isAuthPage) navigateTo('/auth/login')
    else if (isLoggedIn && isAuthPage) navigateTo('/')
  }, [authLoading, isLoggedIn, isAuthPage, navigateTo])
  const [clock, setClock] = useState(() => new Date())
  const [themePreference,setThemePreference]=useState<ThemePreference>(getThemePreference)
  const [userSettings,setUserSettings]=useState(loadUserSettings)
  const [readNotificationIds,setReadNotificationIds]=useState<string[]>(loadReadIds)
  const [academics,setAcademics] = useState(loadAcademicState)
  const [subjectAddRequest,setSubjectAddRequest] = useState(0)
  const [libraryItems,setLibraryItems] = useState<LibraryItem[]>(loadLibraryItems)
  const [libraryFolders,setLibraryFolders] = useState<LibraryFolder[]>(loadLibraryFolders)
  const [libraryAddRequest,setLibraryAddRequest] = useState(0)
  const [libraryFocus,setLibraryFocus] = useState<{subjectId?:string;itemId?:string;section?:LibrarySection}|null>(null)
  const semester = currentSemester(academics).settings
  const semesterSettingsById = Object.fromEntries(academics.semesters.map(s=>[s.id,s.settings])) as Record<string,SemesterSettings>
  const activeSubjects = academics.subjects.filter(s=>s.semesterId===academics.activeSemesterId&&!s.archived)
  const registeredSubjects = [...new Set([...activeSubjects.map(s=>s.name)])]
  const [studySubjectId,setStudySubjectId]=useState<string|undefined>(undefined)
  const [studyTaskId,setStudyTaskId]=useState<number|null>(null)
  const [studyReturnPage,setStudyReturnPage]=useState<PageId>('home')
  const [planTab, setPlanTab] = useState<PlanTab>('Taskuri')
  const [scheduleRequest, setScheduleRequest] = useState(false)
  const [calendarAdd,setCalendarAdd] = useState<{kind:'exam'|'event';token:number}|null>(null)
  const [calendarOpenExam,setCalendarOpenExam] = useState<{id:string;token:number}|null>(null)
  const [exams,setExams] = useState<StudyExam[]>(()=>{
    try {const items:unknown=JSON.parse(localStorage.getItem('studyflow-exams-v1')||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.id==='string'&&typeof x.subject==='string'&&typeof x.date==='string'&&typeof x.time==='string').map(x=>tagLegacyRecord(x,academics)):[]}
    catch{return []}
  })
  const [events,setEvents] = useState<PersonalEvent[]>(()=>{
    try {const items:unknown=JSON.parse(localStorage.getItem('studyflow-events-v1')||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.date==='string'&&typeof x.time==='string'):[]}
    catch{return []}
  })
  const [scheduleEntries,setScheduleEntries] = useState<ScheduleEntry[]>(()=>{
    try {const saved=JSON.parse(localStorage.getItem('studyflow-schedule-v1')||'[]');return Array.isArray(saved)?saved.filter(e=>e&&typeof e.id==='string'&&typeof e.startTime==='string'&&typeof e.subject==='string').map(e=>tagLegacyRecord(e,academics)):[]}
    catch{return []}
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [details, setDetails] = useState<DetailModal>(null)
  const [taskForm, setTaskForm] = useState<'new' | number | null>(null)
  const [taskDetailsId, setTaskDetailsId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<StudyTask[]>(() => {
    // Datele vechi sunt folosite doar ca fallback până la hidratarea din Dexie.
    try {
      const saved = localStorage.getItem('studyflow-tasks-v1')
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.every(t => t && typeof t === 'object' && typeof t.id === 'number' && typeof t.title === 'string' && typeof t.done === 'boolean')) {
          return (parsed as StudyTask[]).map(t => tagLegacyRecord(t, academics))
        }
      }
    } catch { /* Browserul poate bloca accesul la stocarea locală. */ }
    return []
  })
  const [dataReady, setDataReady] = useState(false)
  const [dataWarning, setDataWarning] = useState('')
  useEffect(() => {
    let active = true
    initializeStudyFlowData().then(({ snapshot, fallback }) => {
      if (!active) return
      setTasks(snapshot.tasks)
      setAcademics(snapshot.academics)
      setScheduleEntries(snapshot.schedule)
      setExams(snapshot.exams)
      setEvents(snapshot.events)
      setLibraryItems(snapshot.libraryItems)
      setLibraryFolders(snapshot.libraryFolders)
      setUserSettings(snapshot.userSettings)
      setReadNotificationIds(snapshot.readNotificationIds)
      if (fallback) setDataWarning('Datele au fost încărcate din stocarea veche. Migrarea va fi reîncercată la următoarea pornire.')
      setDataReady(true)
    }).catch(error => {
      console.error('StudyFlow nu a putut inițializa baza de date.', error)
      if (!active) return
      setDataWarning('Baza de date locală nu a putut fi deschisă. Modificările pot să nu fie salvate.')
      setDataReady(true)
    })
    void initializePdfNotesData().then(({ notes }) => { primePdfNotes(notes) })
    return () => { active = false }
  }, [])

  const persist = useCallback((operation: Promise<void>) => {
    void operation.catch(error => {
      console.error('Salvarea datelor StudyFlow a eșuat.', error)
      setDataWarning(storageErrorMessage(error, 'Unele modificări nu au putut fi salvate în baza de date locală.'))
    })
  }, [])

  useEffect(() => {
    if (dataReady) void requestPersistentStorage()
  }, [dataReady])

  const lastSyncedUserId = useRef<string | null>(null)
  useEffect(() => {
    const userId = (authUser as any)?.id ?? null
    if (!dataReady || !isLoggedIn || !userId || lastSyncedUserId.current === userId) return
    lastSyncedUserId.current = userId
    void (async () => {
      try {
        let previousUserId: string | null = null
        try { previousUserId = localStorage.getItem(LAST_USER_ID_KEY) } catch {}
        // Cont diferit de ultimul de pe acest browser: pornim de la local gol,
        // ca datele vechiului cont să nu se unească cu cele noi.
        // shortcut: trecerea directă la alt cont fără logout pierde modificările locale nesincronizate ale vechiului cont.
        if (previousUserId && previousUserId !== userId) await clearLocalData()
        try { localStorage.setItem(LAST_USER_ID_KEY, userId) } catch {}
        // Mai întâi tragem din cloud: un dispozitiv nou nu trebuie să suprascrie serverul cu gol.
        await syncAll()
        // Marchează migrările ca făcute: init-urile trebuie să citească Dexie (proaspăt tras), nu localStorage.
        const stamp = { version: 1, migratedAt: new Date().toISOString() }
        await db.transaction('rw', db.meta, async () => {
          await db.meta.put({ key: META_KEYS.migration, value: stamp })
          await db.meta.put({ key: studyMigrationKey, value: stamp })
          await db.meta.put({ key: pdfMigrationKey, value: stamp })
        })
        let snapshot = (await initializeStudyFlowData()).snapshot
        if (!snapshot.academics || !snapshot.userSettings) {
          // Cont nou, fără nimic pe server: reconstruiește defaulturile via migrarea din localul gol.
          await db.transaction('rw', db.meta, async () => {
            await db.meta.delete(META_KEYS.migration)
            await db.meta.delete(studyMigrationKey)
            await db.meta.delete(pdfMigrationKey)
          })
          snapshot = (await initializeStudyFlowData()).snapshot
        }
        setTasks(snapshot.tasks)
        setAcademics(snapshot.academics)
        setScheduleEntries(snapshot.schedule)
        setExams(snapshot.exams)
        setEvents(snapshot.events)
        setLibraryItems(snapshot.libraryItems)
        setLibraryFolders(snapshot.libraryFolders)
        setUserSettings(snapshot.userSettings)
        setReadNotificationIds(snapshot.readNotificationIds)
        const { notes } = await initializePdfNotesData()
        primePdfNotes(notes)
        // Urmează push cu Dexie-ul reunit (local + cloud), ca datele pre-login să ajungă pe server.
        persist(syncPushAll())
      } catch (error) {
        console.error('Sincronizarea inițială StudyFlow a eșuat.', error)
      }
    })()
  }, [dataReady, isLoggedIn, authUser, persist])

  useEffect(() => {
    applyTheme(themePreference)
    if (themePreference !== 'system' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme('system')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [themePreference])
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 30000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => { if (dataReady) persist(saveTasks(tasks)) }, [tasks, dataReady, persist])
  useEffect(() => { if (dataReady) persist(setMeta(META_KEYS.academics, academics)) }, [academics, dataReady, persist])
  useEffect(() => { if (dataReady) persist(saveSchedule(scheduleEntries)) }, [scheduleEntries, dataReady, persist])
  useEffect(() => { if (dataReady) persist(saveExams(exams)) }, [exams, dataReady, persist])
  useEffect(() => { if (dataReady) persist(saveEvents(events)) }, [events, dataReady, persist])
  useEffect(() => { if (dataReady) persist(saveLibraryItems(libraryItems)) }, [libraryItems, dataReady, persist])
  useEffect(() => { if (dataReady) persist(saveLibraryFolders(libraryFolders)) }, [libraryFolders, dataReady, persist])
  useEffect(() => { if (dataReady) persist(setMeta(META_KEYS.userSettings, userSettings)) }, [userSettings, dataReady, persist])
  useEffect(() => { if (dataReady) persist(setMeta(META_KEYS.readNotificationIds, readNotificationIds.slice(-1000))) }, [readNotificationIds, dataReady, persist])
  const resolveSubject = (name:string,semesterId=academics.activeSemesterId) =>
    academics.subjects.find(x=>x.semesterId===semesterId&&normalizedSubject(x.name)===normalizedSubject(name))
  const saveSubject = (candidate:Subject):boolean => {
    const previous=academics.subjects.find(s=>s.id===candidate.id)
    setAcademics(current=>({...current,subjects:previous
      ? current.subjects.map(s=>s.id===candidate.id?candidate:s)
      : [...current.subjects,candidate]}))
    // Atașăm un ID stabil înregistrărilor anterioare care aveau doar numele materiei.
    const match = <T extends {subject:string;subjectId?:string;semesterId?:string}>(entry:T):T => {
      const linked=entry.subjectId===candidate.id || (!entry.subjectId &&
        entry.semesterId===candidate.semesterId &&
        normalizedSubject(entry.subject)===normalizedSubject(previous?.name||candidate.name))
      return linked?{...entry,subject:candidate.name,subjectId:candidate.id}:entry
    }
    setTasks(current=>current.map(match))
    setScheduleEntries(current=>current.map(match))
    setExams(current=>current.map(match))
    return true
  }
  const copySubjects = (fromSemesterId:string,toSemesterId:string,subjectIds:string[]) => setAcademics(current=>{
    const originals=current.subjects.filter(s=>s.semesterId===fromSemesterId&&subjectIds.includes(s.id))
    const additions=originals.filter(s=>!current.subjects.some(other=>other.semesterId===toSemesterId&&normalizedSubject(other.name)===normalizedSubject(s.name)))
      .map(s=>({...s,id:`materie-${Date.now()}-${Math.random().toString(36).slice(2)}`,semesterId:toSemesterId,archived:false}))
    return {...current,subjects:[...current.subjects,...additions]}
  })
  const saveSemesterSettings = (settings:SemesterSettings) => setAcademics(current=>{
    // Finalul anului aparține anului universitar, nu unui singur semestru.
    const academicYearEndDate=settings.academicYearEndDate || current.semesters.map(s=>s.settings.academicYearEndDate).find(Boolean) || ''
    return {...current,semesters:current.semesters.map(s=>({
      ...s,settings:s.id===current.activeSemesterId
        ? {...settings,academicYearEndDate}
        : {...s.settings,academicYearEndDate}
    }))}
  })
  const saveScheduleEntries = (updated:ScheduleEntry[]) => {
    const currentSemesterId=academics.activeSemesterId
    setScheduleEntries(current=>[
      ...current.filter(e=>e.semesterId && e.semesterId!==currentSemesterId),
      ...updated.map(e=>{
        const subject=resolveSubject(e.subject,currentSemesterId)
        return {...e,semesterId:currentSemesterId,subjectId:subject?.id}
      })
    ])
  }
  const activateSemester = (id:string) => setAcademics(current=>current.semesters.some(s=>s.id===id)?{...current,activeSemesterId:id}:current)
  const openSubjectForm = () => {setSheetOpen(false);goPage('subjects');setSubjectAddRequest(v=>v+1)}
  const openLibrary = (subjectId?:string,itemId?:string,section?:LibrarySection) => {setSheetOpen(false);setLibraryFocus(subjectId||itemId||section?{subjectId,itemId,section}:null);goPage('library');window.scrollTo({top:0})}
  const openLibraryForm = () => {openLibrary();setLibraryAddRequest(v=>v+1)}
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const closeDetails = useCallback(() => setDetails(null), [])
  const openDetails = (title: string, body: ReactNode) => setDetails({ title, body })
  const changeStatus = (id: number, status: TaskStatus) => setTasks(all => all.map(t => t.id === id
    ? { ...t, done: status === 'done', status, completedAt: status === 'done' ? new Date().toISOString() : null }
    : t))
  const toggleTask = (id: number) => {
    const current = tasks.find(t => t.id === id)
    if (current) changeStatus(id, current.done ? 'todo' : 'done')
  }
  const saveTask = (draft: TaskDraft) => {
    if (taskForm === null) return
    if (taskForm === 'new') {
      const subject = resolveSubject(draft.subject)
      setTasks(all => [...all, {
        ...draft, semesterId:academics.activeSemesterId,subjectId:subject?.id, id: Math.max(0, ...all.map(t => t.id)) + 1, done: draft.status === 'done',
        createdAt: new Date().toISOString(), completedAt: draft.status === 'done' ? new Date().toISOString() : null,
      }])
    } else {
      setTasks(all => all.map(t => t.id === taskForm ? {
        ...t, ...draft, subjectId:resolveSubject(draft.subject,t.semesterId||academics.activeSemesterId)?.id, done: draft.status === 'done',
        completedAt: draft.status === 'done' ? t.completedAt ?? new Date().toISOString() : null,
      } : t))
    }
    setTaskForm(null)
    goPage('plan'); setPlanTab('Taskuri')
  }
  const deleteTask = (id: number) => { setTasks(all => all.filter(t=>t.id !== id)); setTaskDetailsId(null) }
  const toggleSubtask = (taskId: number, stepId: number) => setTasks(all => all.map(t => t.id === taskId ? {
    ...t, subtasks: (t.subtasks ?? []).map(step => step.id === stepId ? { ...step, done: !step.done } : step),
  } : t))
  const openTaskForm = () => { setSheetOpen(false); setTaskDetailsId(null); setTaskForm('new') }
  const navigate = (p: PageId) => { if(p==='library')setLibraryFocus(null); goPage(p) }
  const openStudy = (subjectId?:string, taskId?:number|null) => {setStudyReturnPage(page);setStudySubjectId(subjectId);setStudyTaskId(taskId??null);goPage('study');window.scrollTo({top:0})}
  const navigatePlan = (tab: PlanTab) => { setPlanTab(tab); navigate('plan') }
  const openScheduleForm = () => { setSheetOpen(false); goPage('plan'); setPlanTab('Orar'); setScheduleRequest(true) }
  const openCalendarAdd = (kind:'exam'|'event') => {setSheetOpen(false); goPage('plan');setPlanTab('Calendar');setCalendarAdd({kind,token:Date.now()})}
  const openExam = (id:string) => {goPage('plan');setPlanTab('Calendar');setCalendarOpenExam({id,token:Date.now()})}
  const saveExam = (exam:StudyExam) => setExams(all=>{
    const old=all.find(x=>x.id===exam.id)
    const semesterId=old?.semesterId||academics.activeSemesterId
    const newExam={...exam,semesterId,subjectId:resolveSubject(exam.subject,semesterId)?.id}
    return old?all.map(x=>x.id===exam.id?newExam:x):[...all,newExam]
  })
  const saveEvent = (event:PersonalEvent) => setEvents(all=>all.some(x=>x.id===event.id)?all.map(x=>x.id===event.id?event:x):[...all,event])

  const notifications=buildNotifications(tasks,exams,userSettings.notifications,clock)
  const unreadNotifications=notifications.filter(item=>!readNotificationIds.includes(item.id))
  const markRead=(id:string)=>setReadNotificationIds(old=>old.includes(id)?old:[...old,id])
  const markAllRead=()=>setReadNotificationIds(old=>[...new Set([...old,...notifications.map(n=>n.id)])].slice(-1000))
  const savePersonalSettings=(value:UserSettings):boolean=>{const cleaned=cleanSettings(value);setUserSettings(cleaned);return true}
  const changeTheme=(value:ThemePreference)=>{saveThemePreference(value);setThemePreference(value)}
  const openNotification=(item:StudyNotification)=>{markRead(item.id);if(item.kind==='task'){goPage('plan');setPlanTab('Taskuri');setTaskDetailsId(Number(item.relatedId))}else openExam(String(item.relatedId))}
  const h = clock.getHours()
  const greeting = h < 5 ? 'Noapte bună' : h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : h < 22 ? 'Bună seara' : 'Noapte bună'
  const date = clock.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const activeSchedule = scheduleEntries.filter(e=>e.semesterId===academics.activeSemesterId)
  const visibleClasses = todayEntries(activeSchedule, clock, semester)
  const todayKey = dateKey(clock)
  const nearDate = dateKey(new Date(clock.getFullYear(), clock.getMonth(), clock.getDate() + 3))
  const upcoming = tasks.filter((t) => !t.done && t.dueDate >= todayKey && t.dueDate <= nearDate).length

  if (!dataReady || authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[18px] bg-gradient-to-b from-[#3b9bff] to-brand text-white shadow-lg shadow-brand/20">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M3 8c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-ink-soft">Se pregătesc datele StudyFlow…</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <Suspense fallback={<RouteFallback />}>
        {page === 'auth-register' ? <RegisterPage /> : <LoginPage />}
      </Suspense>
    )
  }

  return (
    <>
      <AppShell
        page={page}
        user={userSettings.profile}
        onNavigate={navigate}
        onAdd={() => setSheetOpen(true)}
        onProfile={() => navigate('profile')}
        onLogout={() => void logout()}
      >
        {dataWarning && <div role="status" className="mb-5 rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">{dataWarning}</div>}
        <ErrorBoundary key={location.pathname} label={pageTitles[page]}>
        <Suspense fallback={<RouteFallback />}>
        {page === 'profile' && <ProfileSettingsPage settings={userSettings} tasks={tasks} onSave={savePersonalSettings} onBack={()=>navigate('home')} onNotifications={()=>navigate('notifications')} themePreference={themePreference} onThemeChange={changeTheme}/>}
        {page === 'notifications' && <NotificationsPage items={notifications} readIds={readNotificationIds} onRead={markRead} onReadAll={markAllRead} onOpen={openNotification} onBack={()=>navigate('home')} onSettings={()=>navigate('profile')}/>}
        {page === 'plan' && <PlanPage tab={planTab} onTabChange={setPlanTab} tasks={tasks} onToggleTask={toggleTask} reference={clock} onAddTask={openTaskForm} onOpenTask={setTaskDetailsId} semester={semester} semesterSettingsById={semesterSettingsById} activeSemesterId={academics.activeSemesterId} registeredSubjects={registeredSubjects} scheduleEntries={scheduleEntries} onSemester={saveSemesterSettings} onScheduleEntries={saveScheduleEntries} scheduleRequest={scheduleRequest} onScheduleRequestHandled={()=>setScheduleRequest(false)} exams={exams} events={events} onSaveExam={saveExam} onDeleteExam={id=>setExams(all=>all.filter(x=>x.id!==id))} onSaveEvent={saveEvent} onDeleteEvent={id=>setEvents(all=>all.filter(x=>x.id!==id))} calendarAdd={calendarAdd} calendarOpenExam={calendarOpenExam} onCalendarAddHandled={()=>setCalendarAdd(null)} onCalendarExamHandled={()=>setCalendarOpenExam(null)} />}
        {page === 'subjects' && <SubjectsPage academics={academics} tasks={tasks} exams={exams} schedule={scheduleEntries} reference={clock} onSaveSubject={saveSubject} onCopySubjects={copySubjects} onArchiveSubject={(id,archived)=>setAcademics(current=>({...current,subjects:current.subjects.map(s=>s.id===id?{...s,archived}:s)}))} onActivateSemester={activateSemester} onNavigatePlan={navigatePlan} onOpenTask={setTaskDetailsId} onOpenExam={openExam} addRequest={subjectAddRequest} onAddRequestHandled={()=>setSubjectAddRequest(0)} libraryItems={libraryItems} libraryFolders={libraryFolders} onOpenLibrary={openLibrary} onOpenStudy={openStudy} />}
        {page === 'study' && <StudyHubPage key={`${studySubjectId||'general'}-${studyTaskId??'n'}`} subjects={academics.subjects} tasks={tasks} initialSubjectId={studySubjectId} initialTaskId={studyTaskId} onBack={()=>{setStudyTaskId(null);navigate(studyReturnPage==='study'?'home':studyReturnPage)}} />}
        {page === 'library' && <LibraryPage academics={academics} items={libraryItems} folders={libraryFolders} tasks={tasks} onUpsert={item=>setLibraryItems(old=>old.some(x=>x.id===item.id)?old.map(x=>x.id===item.id?item:x):[...old,item])} onDelete={id=>setLibraryItems(old=>old.filter(x=>x.id!==id))} onSaveFolder={folder=>setLibraryFolders(old=>old.some(f=>f.id===folder.id)?old.map(f=>f.id===folder.id?folder:f):[...old,folder])} onRemoveFolder={id=>{const removed=libraryFolders.find(f=>f.id===id);setLibraryFolders(old=>old.filter(f=>f.id!==id).map(f=>f.parentId===id?{...f,parentId:removed?.parentId}:f));setLibraryItems(old=>old.map(item=>item.folderId===id?{...item,folderId:removed?.parentId}:item))}} onOpenTask={setTaskDetailsId} initialSection={libraryFocus?.section} initialSubjectId={libraryFocus?.subjectId} initialOpenId={libraryFocus?.itemId} addRequest={libraryAddRequest} onAddRequestHandled={()=>setLibraryAddRequest(0)} />}
        {page === 'home' && <>
          <header className="mb-8 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium capitalize text-ink-soft">{date}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{greeting}, {firstName(userSettings.profile.name)}! 👋</h1>
              <p className="mt-1 text-ink-soft">Ai {visibleClasses.length} activități astăzi și {upcoming} {upcoming === 1 ? 'deadline apropiat' : 'deadline-uri apropiate'}.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => navigate('notifications')} aria-label={`Deschide notificările (${unreadNotifications.length} necitite)`} className="relative grid size-11 place-items-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-line transition hover:bg-surface/60">
                <IconBell />
                {unreadNotifications.length>0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger ring-2 ring-surface" />}
              </button>
              <button onClick={() => navigate('profile')} aria-label="Deschide profilul și setările" className="grid size-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#5ac8fa] to-brand text-sm font-semibold text-white shadow-sm ring-2 ring-surface transition hover:brightness-105">{userSettings.profile.avatarDataUrl?<img src={userSettings.profile.avatarDataUrl} alt="" className="size-full object-cover"/>:initialsFor(userSettings.profile.name)}</button>
            </div>
          </header>
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
              <TodayClasses reference={clock} items={visibleClasses} onViewSchedule={() => navigatePlan('Orar')} onDetails={openDetails} />
              <Tasks tasks={tasks} onToggle={toggleTask} reference={clock} onViewAll={() => navigatePlan('Taskuri')} onDetails={openDetails} onOpenTask={setTaskDetailsId} />
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <Exam reference={clock} exams={exams} onOpen={openExam} onAdd={()=>openCalendarAdd('exam')} />
              <WeeklyProgress tasks={weekTasks(tasks, clock)} />
              <button onClick={()=>openStudy()} className="w-full rounded-3xl border border-brand/20 bg-gradient-to-br from-surface to-brand-soft p-5 text-left shadow-[0_5px_24px_rgba(21,75,140,0.045)] transition hover:-translate-y-0.5 hover:shadow-md"><span className="mb-2 inline-flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-xl text-brand-text">✦</span><span className="block text-base font-bold text-ink">Continuă învățarea</span><span className="mt-1 block text-xs text-ink-soft">Flashcards inteligente și Focus Timer personalizabil</span><span className="mt-3 block text-xs font-bold text-brand-text">Deschide Study Hub →</span></button>
            </div>
          </div>
        </>}
        </Suspense>
        </ErrorBoundary>
      </AppShell>
      <AddSheet open={sheetOpen} onClose={closeSheet} onTaskClick={openTaskForm} onScheduleClick={openScheduleForm} onExamClick={()=>openCalendarAdd('exam')} onEventClick={()=>openCalendarAdd('event')} onSubjectClick={openSubjectForm} onMaterialClick={openLibraryForm} />
      {taskDetailsId !== null && tasks.find(t => t.id === taskDetailsId) && <TaskDetails
        task={tasks.find(t => t.id === taskDetailsId)!}
        onClose={() => setTaskDetailsId(null)}
        onEdit={() => { setTaskForm(taskDetailsId); setTaskDetailsId(null) }}
        onToggle={() => toggleTask(taskDetailsId)}
        onDelete={() => deleteTask(taskDetailsId)}
        onChangeStatus={status => changeStatus(taskDetailsId, status)}
        onToggleStep={stepId => toggleSubtask(taskDetailsId, stepId)}
        onStartFocus={(taskId, subject)=>{const sub=academics.subjects.find(x=>x.semesterId===academics.activeSemesterId&&normalizedSubject(x.name)===normalizedSubject(subject||''));openStudy(sub?.id, taskId)}}
      />}
      {taskForm !== null && <TaskEditor
        key={String(taskForm)}
        task={typeof taskForm === 'number' ? tasks.find(t => t.id === taskForm) : undefined}
        subjects={[...new Set(['General',...registeredSubjects,...tasks.filter(t=>t.semesterId===academics.activeSemesterId).map(t=>t.subject)])].filter(Boolean)}
        onSave={saveTask}
        onClose={() => setTaskForm(null)}
      />}
      <DetailsDialog details={details} onClose={closeDetails} />
    </>
  )
}