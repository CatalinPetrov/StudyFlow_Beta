import { useState, type FormEvent } from 'react'
import { DialogSurface } from './components/ui/DialogSurface'
import { useNavigate } from 'react-router-dom'
import {
  localDateKey, mondayOf, priorityLabel, statusOf, taskTypeLabels, taskTypeIcons,
  type Priority, type StudyTask, type Subtask, type TaskDraft, type TaskStatus, type TaskType,
} from './taskModel'

type Callback = (id: number) => void

type Props = {
  tasks: StudyTask[]
  reference: Date
  onAdd: () => void
  onOpen: Callback
  onToggle: Callback
}

const groupNames = ['Restante', 'Astăzi', 'Mâine', 'Restul săptămânii', 'Mai târziu', 'Fără termen'] as const
type Group = typeof groupNames[number]

function isOverdue(task: StudyTask, now: Date): boolean {
  if (task.done || !task.dueDate) return false
  const today = localDateKey(now)
  if (task.dueDate < today) return true
  if (task.dueDate > today || !task.dueTime) return false
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return task.dueTime < current
}

function taskGroup(task: StudyTask, now: Date): Group {
  if (!task.dueDate) return 'Fără termen'
  const today = localDateKey(now)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const sunday = mondayOf(now)
  sunday.setDate(sunday.getDate() + 6)
  if (isOverdue(task, now)) return 'Restante'
  if (task.dueDate === today) return 'Astăzi'
  if (task.dueDate === localDateKey(tomorrow)) return 'Mâine'
  if (task.dueDate <= localDateKey(sunday)) return 'Restul săptămânii'
  return 'Mai târziu'
}

const priorityOrder: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

const formatDay = (date: string, time?: string) => {
  if (!date) return 'Fără termen'
  const pretty = new Date(`${date}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
  return time ? `${pretty} · ${time}` : pretty
}

function TaskTile({ task, reference, onOpen, onToggle }: {
  task: StudyTask; reference: Date; onOpen: Callback; onToggle: Callback
}) {
  const steps = task.subtasks ?? []
  const completed = steps.filter(s => s.done).length
  const percent = steps.length ? Math.round(completed / steps.length * 100) : 0
  const overdue = isOverdue(task, reference)
  const high = (task.priority ?? 'normal') === 'high'
  return <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-sm sm:px-5">
    <div className="flex items-start gap-3">
      <label className="mt-0.5 cursor-pointer" title="Marchează ca finalizat">
        <input className="peer sr-only" type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} aria-label={`Finalizează ${task.title}`} />
        <span className="grid size-6 place-items-center rounded-full border-2 border-line text-transparent peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/25">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m5 12 4 4 8-9" /></svg>
        </span>
      </label>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task.id)}>
        <span className={`block font-semibold ${task.done ? 'text-ink-soft line-through' : 'text-ink'}`}>{task.title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{task.subject || 'General'}</span>
      </button>
      <span className={`max-w-[110px] shrink-0 text-right text-[11px] font-semibold ${overdue ? 'text-danger' : 'text-ink-soft'}`}>
        {overdue ? 'Restant · ' : ''}{formatDay(task.dueDate, task.dueTime)}
      </span>
    </div>
    {(task.taskType && task.taskType !== 'other' || high || statusOf(task) === 'doing') && <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
      {task.taskType && task.taskType !== 'other' && <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.045] px-2 py-1 text-[11px] font-medium text-ink-soft"><span aria-hidden="true">{taskTypeIcons[task.taskType]}</span>{taskTypeLabels[task.taskType]}</span>}
      {high && <span className="rounded-full bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger">Prioritate ridicată</span>}
      {statusOf(task) === 'doing' && <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand-text">În lucru</span>}
    </div>}
    {steps.length > 0 && <div className="mt-3 pl-9">
      <div className="mb-1.5 flex justify-between text-xs text-ink-soft"><span>{completed} din {steps.length} subtaskuri</span><span>{percent}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.1]"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} /></div>
    </div>}
  </div>
}

export function PlanTasks({ tasks, reference, onAdd, onOpen, onToggle }: Props) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'active' | 'doing' | 'done'>('active')
  const [subject, setSubject] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | TaskType>('')
  const [priority, setPriority] = useState<'' | Priority>('')
  const [sort, setSort] = useState<'due' | 'priority'>('due')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const active = tasks.filter(t => !t.done).length
  const overdue = tasks.filter(t => isOverdue(t, reference)).length
  const subjects = [...new Set(tasks.map(t => t.subject || 'General'))].sort((a,b) => a.localeCompare(b, 'ro'))
  const filtered = tasks.filter(t => {
    if (view === 'active' && t.done) return false
    if (view === 'doing' && statusOf(t) !== 'doing') return false
    if (view === 'done' && !t.done) return false
    if (subject && (t.subject || 'General') !== subject) return false
    if (typeFilter && (t.taskType ?? 'other') !== typeFilter) return false
    if (priority && (t.priority ?? 'normal') !== priority) return false
    return `${t.title} ${t.subject} ${t.description ?? ''}`.toLocaleLowerCase('ro').includes(query.trim().toLocaleLowerCase('ro'))
  })
  const sorted = [...filtered].sort((a,b) => sort === 'priority'
    ? priorityOrder[a.priority ?? 'normal'] - priorityOrder[b.priority ?? 'normal'] || a.dueDate.localeCompare(b.dueDate)
    : (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') || (a.dueTime ?? '').localeCompare(b.dueTime ?? ''))

  return <div className="max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold tracking-tight">Taskurile mele</h2>
        <p className="mt-1 text-sm text-ink-soft">{active} active{overdue ? ` · ${overdue} restante` : ' · fără restanțe'}</p>
      </div>
      <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep">
        <span className="text-xl leading-none">+</span> Adaugă task
      </button>
    </div>
    <div className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
      <label className="sr-only" htmlFor="plan-task-search">Caută taskuri</label>
      <input id="plan-task-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Caută după titlu, descriere sau materie..." className="w-full rounded-xl bg-canvas px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/25" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {([{ id: 'active', label: 'Active' }, { id: 'doing', label: 'În lucru' }, { id: 'done', label: 'Finalizate' }] as const).map(item => <button
          key={item.id} onClick={() => setView(item.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === item.id ? 'bg-brand/10 text-brand-text' : 'bg-canvas text-ink-soft hover:text-ink'}`}>
          {item.label}
        </button>)}
        <button onClick={() => setFiltersOpen(v => !v)} className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-soft">Filtre {filtersOpen ? '▴' : '▾'}</button>
      </div>
      {filtersOpen && <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
        <label className="text-xs text-ink-soft">Materie
          <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full rounded-lg bg-canvas p-2 text-sm text-ink">
            <option value="">Toate materiile</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-soft">Tip task
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | TaskType)} className="mt-1 w-full rounded-lg bg-canvas p-2 text-sm text-ink">
            <option value="">Toate tipurile</option>{(Object.keys(taskTypeLabels) as TaskType[]).map(type => <option key={type} value={type}>{taskTypeLabels[type]}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-soft">Prioritate
          <select value={priority} onChange={e => setPriority(e.target.value as '' | Priority)} className="mt-1 w-full rounded-lg bg-canvas p-2 text-sm text-ink">
            <option value="">Toate prioritățile</option><option value="low">Scăzută</option><option value="normal">Normală</option><option value="high">Ridicată</option>
          </select>
        </label>
        <label className="text-xs text-ink-soft">Sortare în grup
          <select value={sort} onChange={e => setSort(e.target.value as 'due'|'priority')} className="mt-1 w-full rounded-lg bg-canvas p-2 text-sm text-ink">
            <option value="due">După deadline</option><option value="priority">După prioritate</option>
          </select>
        </label>
      </div>}
    </div>
    {sorted.length === 0 ? <div className="rounded-3xl bg-surface p-8 text-center shadow-sm">
      <p className="text-lg font-semibold">{tasks.length === 0 ? 'Primul tău task începe aici' : 'Niciun task găsit'}</p>
      <p className="mt-2 text-sm text-ink-soft">{tasks.length === 0 ? 'Adaugă un task pentru a-ți organiza săptămâna.' : 'Încearcă alte filtre sau o altă căutare.'}</p>
      {tasks.length === 0 && <button onClick={onAdd} className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Adaugă primul task</button>}
    </div> : view === 'done' ? <section className="space-y-2.5"><h3 className="font-semibold">Finalizate · {sorted.length}</h3>
      {sorted.map(t => <TaskTile key={t.id} task={t} reference={reference} onOpen={onOpen} onToggle={onToggle} />)}
    </section> : groupNames.map(group => {
      const items = sorted.filter(t => taskGroup(t, reference) === group)
      if (!items.length) return null
      return <section key={group} className="space-y-2.5">
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${group === 'Restante' ? 'text-danger' : 'text-ink'}`}>{group}<span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-xs font-normal text-ink-soft">{items.length}</span></h3>
        {items.map(t => <TaskTile key={t.id} task={t} reference={reference} onOpen={onOpen} onToggle={onToggle} />)}
      </section>
    })}
  </div>
}

type TaskEditorProps = {
  task?: StudyTask
  subjects: string[]
  onSave: (draft: TaskDraft) => void
  onClose: () => void
}

const defaultDraft = (): TaskDraft => ({
  title:'', subject:'General', taskType:'other', dueDate:'', dueTime:'', priority:'normal', status:'todo', description:'', subtasks:[],
})

export function TaskEditor({ task, subjects, onSave, onClose }: TaskEditorProps) {
  const [draft, setDraft] = useState<TaskDraft>(() => task ? {
    title:task.title, subject:task.subject || 'General', taskType:task.taskType ?? 'other', dueDate:task.dueDate,
    dueTime:task.dueTime ?? '', priority:task.priority ?? 'normal', status:statusOf(task),
    description:task.description ?? '',
    subtasks:(task.subtasks ?? []).map(s => ({ ...s })),
  } : defaultDraft())
  const [advanced, setAdvanced] = useState(!!task && (!!task.description || !!task.subtasks?.length))
  const [nextStep, setNextStep] = useState('')
  const [error, setError] = useState('')
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft(old => ({ ...old, [key]:value }))
  const addManualStep = () => {
    const title = nextStep.trim()
    if (!title) return
    const existing = draft.subtasks ?? []
    set('subtasks', [...existing, { id: Math.max(0, ...existing.map(s => s.id)) + 1, title, done: false }])
    setNextStep('')
  }
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim()) { setError('Introdu un titlu pentru task.'); return }
    if (draft.dueTime && !draft.dueDate) { setError('Selectează și data pentru ora-limită.'); return }
    onSave({ ...draft, title:draft.title.trim(), subject:draft.subject || 'General', description:draft.description?.trim() ?? '', subtasks:(draft.subtasks ?? []).filter(s => s.title.trim()).map(s => ({...s, title:s.title.trim()})) })
  }
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <DialogSurface as="form" onSubmit={onSubmit} label={task ? 'Editează task' : 'Adaugă task'} onClose={onClose} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:p-6">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{task ? 'Editează task' : 'Task nou'}</h2>
        <button type="button" onClick={onClose} className="rounded-full bg-canvas px-3 py-1.5 text-sm">Închide</button></div>
      <div className="space-y-4">
        <label className="block text-sm font-medium">Titlu task *
          <input value={draft.title} onChange={e => set('title', e.target.value)} autoFocus placeholder="Ex.: Proiect Java — Etapa 2" maxLength={120} className="mt-1.5 w-full rounded-xl bg-canvas px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/25" />
        </label>
        <label className="block text-sm font-medium">Materie
          <select value={draft.subject} onChange={e => set('subject',e.target.value)} className="mt-1.5 w-full rounded-xl bg-canvas px-4 py-3 text-sm">
            {[...new Set(['General',...subjects,draft.subject])].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Tip task <span className="font-normal text-ink-soft">(opțional)</span>
          <select value={draft.taskType ?? 'other'} onChange={e => set('taskType', e.target.value as TaskType)} className="mt-1.5 w-full rounded-xl bg-canvas px-4 py-3 text-sm">
            {(Object.keys(taskTypeLabels) as TaskType[]).map(type => <option key={type} value={type}>{taskTypeLabels[type]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Data-limită
            <input type="date" value={draft.dueDate} onChange={e => set('dueDate',e.target.value)} className="mt-1.5 w-full min-w-0 rounded-xl bg-canvas px-3 py-3 text-sm" />
          </label>
          <label className="block text-sm font-medium">Ora (opțional)
            <input type="time" value={draft.dueTime ?? ''} onChange={e => set('dueTime',e.target.value)} className="mt-1.5 w-full min-w-0 rounded-xl bg-canvas px-3 py-3 text-sm" />
          </label>
        </div>
        <div><p className="text-sm font-medium">Prioritate</p><div className="mt-2 grid grid-cols-3 gap-2">
          {(['low','normal','high'] as const).map(p => <button type="button" key={p} onClick={() => set('priority',p)} className={`rounded-xl border py-2.5 text-xs font-semibold ${draft.priority === p ? 'border-brand bg-brand/10 text-brand-text' : 'border-line text-ink-soft'}`}>{priorityLabel[p]}</button>)}
        </div></div>
        <button type="button" onClick={() => setAdvanced(v=>!v)} className="flex w-full items-center justify-between border-t border-line py-3 text-left text-sm font-semibold">Mai multe opțiuni <span>{advanced?'▴':'▾'}</span></button>
        {advanced && <div className="space-y-4">
          {task && <label className="block text-sm font-medium">Status
            <select value={draft.status} onChange={e => set('status',e.target.value as TaskStatus)} className="mt-1.5 w-full rounded-xl bg-canvas px-4 py-3 text-sm"><option value="todo">De făcut</option><option value="doing">În lucru</option><option value="done">Finalizat</option></select>
          </label>}
          <label className="block text-sm font-medium">Descriere
            <textarea value={draft.description ?? ''} onChange={e => set('description',e.target.value)} rows={3} maxLength={4000} placeholder="Detalii despre temă sau proiect..." className="mt-1.5 w-full resize-y rounded-xl bg-canvas px-4 py-3 text-sm" />
          </label>
          <div>
            <p className="text-sm font-medium">Subtaskuri</p>
            <p className="mt-1 text-xs text-ink-soft">Împarte taskul în pași creați de tine. Îi poți edita, bifa sau șterge.</p>
            <div className="mt-3 space-y-2">
              {(draft.subtasks ?? []).map(step => <div key={step.id} className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
                <input type="checkbox" aria-label={`Finalizează ${step.title}`} checked={step.done}
                  onChange={e => set('subtasks',(draft.subtasks ?? []).map(s => s.id === step.id ? { ...s, done: e.target.checked } : s))}
                  className="size-4 shrink-0 accent-brand" />
                <input aria-label="Denumire subtask" value={step.title} maxLength={160}
                  onChange={e => set('subtasks',(draft.subtasks ?? []).map(s => s.id === step.id ? { ...s, title: e.target.value } : s))}
                  className="min-w-0 flex-1 bg-transparent outline-none focus:ring-2 focus:ring-brand/25" />
                <button type="button" aria-label={`Șterge ${step.title}`} onClick={() => set('subtasks',(draft.subtasks ?? []).filter(s => s.id !== step.id))} className="text-xs font-medium text-danger">Șterge</button>
              </div>)}
              <div className="flex gap-2">
                <input value={nextStep} onChange={e=>setNextStep(e.target.value)} maxLength={160} onKeyDown={e=>{if(e.key === 'Enter'){ e.preventDefault(); addManualStep() }}}
                  placeholder="Scrie un pas nou..." className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-2 text-sm" />
                <button type="button" onClick={addManualStep} className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-text">Adaugă</button>
              </div>
              {(draft.subtasks ?? []).length > 0 && <p className="text-xs text-ink-soft">{(draft.subtasks ?? []).filter(s=>s.done).length}/{(draft.subtasks ?? []).length} pași completați. Taskul principal se finalizează separat.</p>}
            </div>
          </div>
        </div>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-canvas p-3 text-sm font-semibold">Renunță</button>
          <button type="submit" className="flex-[2] rounded-xl bg-brand p-3 text-sm font-semibold text-white">{task?'Salvează modificările':'Salvează taskul'}</button>
        </div>
      </div>
    </DialogSurface>
  </div>
}

type TaskDetailsProps = {
  task: StudyTask
  onClose: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onChangeStatus: (status: TaskStatus) => void
  onToggleStep: (subtaskId: number) => void
  onStartFocus?: (taskId: number, subject?: string) => void
}
export function TaskDetails({task,onClose,onEdit,onToggle,onDelete,onChangeStatus,onToggleStep,onStartFocus}: TaskDetailsProps) {
  const [confirmDelete,setConfirmDelete] = useState(false)
  const steps=task.subtasks??[]
  const completed=steps.filter(s=>s.done).length
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <DialogSurface label={`Detalii ${task.title}`} onClose={onClose} className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:p-6">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink-soft">Detalii task</p><button onClick={onClose} className="rounded-full bg-canvas px-3 py-1.5 text-sm">Închide</button></div>
      <h2 className="mt-4 text-2xl font-bold">{task.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{task.subject || 'General'}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Deadline</p><p className="mt-1 font-semibold">{formatDay(task.dueDate,task.dueTime)}</p></div>
        <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Tipul taskului</p><p className="mt-1 font-semibold">{taskTypeLabels[task.taskType ?? 'other']}</p></div>
        <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Prioritate</p><p className="mt-1 font-semibold">{priorityLabel[task.priority??'normal']}</p></div>
        <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-ink-soft">Status</p><select value={statusOf(task)} onChange={e=>onChangeStatus(e.target.value as TaskStatus)} className="mt-1 w-full bg-transparent font-semibold"><option value="todo">De făcut</option><option value="doing">În lucru</option><option value="done">Finalizat</option></select></div>
      </div>
      {task.description && <div className="mt-5"><h3 className="font-semibold">Descriere</h3><p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{task.description}</p></div>}
      {steps.length > 0 && <div className="mt-5"><div className="mb-2 flex justify-between text-sm"><h3 className="font-semibold">Subtaskuri</h3><span className="text-ink-soft">{completed}/{steps.length}</span></div><div className="space-y-2">
        {steps.map(s=><label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-canvas p-3 text-sm"><input checked={s.done} onChange={()=>onToggleStep(s.id)} type="checkbox" className="size-4 accent-brand" /><span className={s.done?'text-ink-soft line-through':''}>{s.title}</span></label>)}
      </div></div>}
      <div className="mt-6 flex flex-wrap gap-2"><button onClick={onEdit} className="flex-1 rounded-xl bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-text">Editează</button>
        {onStartFocus && !task.done && <button onClick={()=>{onStartFocus(task.id,task.subject);onClose()}} className="flex-1 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-text">Focus pentru task</button>}
        <button onClick={onToggle} className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">{task.done?'Redeschide taskul':'Marchează finalizat'}</button>
      </div>
      {confirmDelete ? <div className="mt-4 rounded-xl bg-danger/10 p-3"><p className="mb-3 text-sm text-danger">Sigur vrei să ștergi acest task?</p><div className="flex gap-2"><button onClick={()=>setConfirmDelete(false)} className="rounded-lg bg-surface px-3 py-2 text-sm">Anulează</button><button onClick={onDelete} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white">Șterge definitiv</button></div></div>
        : <button onClick={()=>setConfirmDelete(true)} className="mt-4 text-sm font-medium text-danger">Șterge taskul</button>}

    </DialogSurface>
  </div>
}
