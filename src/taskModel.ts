// Un singur model Task este folosit în Home, Plan și, mai târziu, Calendar/Materii.
export type Priority = 'low' | 'normal' | 'high'
export type TaskStatus = 'todo' | 'doing' | 'done'

// Clasificarea unui task este separată de status și prioritate.
export type TaskType = 'assignment' | 'laboratory' | 'project' | 'revision' | 'essay' | 'reading' | 'reminder' | 'other'

export const taskTypeLabels: Record<TaskType, string> = {
  assignment: 'Temă', laboratory: 'Laborator', project: 'Proiect', revision: 'Recapitulare',
  essay: 'Referat', reading: 'Lectură', reminder: 'Reminder', other: 'Altul',
}

export const taskTypeIcons: Record<TaskType, string> = {
  assignment: '✎', laboratory: '⚗', project: '▤', revision: '◎',
  essay: '▤', reading: '▣', reminder: '◷', other: '⋯',
}

export type Subtask = {
  id: number
  title: string
  done: boolean
}

export type StudyTask = {
  id: number
  title: string
  subject: string
  subjectId?: string // legătură stabilă spre Materii
  semesterId?: string // semestrul în care aparține taskul
  taskType?: TaskType // optional pentru compatibilitate cu taskurile v1.0 salvate deja
  dueDate: string // YYYY-MM-DD sau '' pentru „Fără termen”
  done: boolean
  dueTime?: string // HH:mm, opțional
  priority?: Priority
  status?: TaskStatus
  description?: string
  subtasks?: Subtask[]
  createdAt?: string
  completedAt?: string | null
}

export type TaskDraft = Pick<StudyTask,
  'title' | 'subject' | 'taskType' | 'dueDate' | 'dueTime' | 'priority' | 'status' | 'description' | 'subtasks'
>

export const statusOf = (task: StudyTask): TaskStatus =>
  task.done ? 'done' : task.status === 'doing' ? 'doing' : 'todo'

export const priorityLabel: Record<Priority, string> = {
  low: 'Scăzută', normal: 'Normală', high: 'Ridicată',
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

export function weekTasks(tasks: StudyTask[], reference: Date) {
  const monday = mondayOf(reference)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const start = localDateKey(monday)
  const end = localDateKey(sunday)
  return tasks.filter(t => t.dueDate !== '' && t.dueDate >= start && t.dueDate <= end)
}
