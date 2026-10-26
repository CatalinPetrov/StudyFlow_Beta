import type { StudyTask } from './taskModel'
import { localDateKey } from './taskModel'

export type TaskActivity = {
  pendingTotal: number
  upcomingSevenDays: number
  overdue: number
  completedSevenDays: number
  currentStreak: number
  bestStreak: number
}

/** Date locale; intervalul include ziua curentă și următoarele 6 zile. */
const dayOffset = (date: Date, days: number) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return localDateKey(result)
}

export function calculateTaskActivity(tasks: StudyTask[], now: Date = new Date()): TaskActivity {
  const today = localDateKey(now)
  const sevenDaysAhead = dayOffset(now, 6)
  const sevenDaysAgo = dayOffset(now, -6)
  const pending = tasks.filter(t => !t.done)
  const completedDays = new Set<string>()
  for (const task of tasks) {
    if (!task.done || !task.completedAt) continue
    const date = new Date(task.completedAt)
    if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime()) continue
    completedDays.add(localDateKey(date))
  }
  // Seria în curs poate începe ieri dacă azi nu s-a finalizat încă nimic.
  let start = completedDays.has(today) ? 0 : -1
  let currentStreak = 0
  while (completedDays.has(dayOffset(now, start))) { currentStreak++; start-- }

  const days = [...completedDays].sort()
  let bestStreak = 0, run = 0, previous = ''
  for (const key of days) {
    const date = new Date(`${key}T12:00:00`)
    const yesterday = dayOffset(date, -1)
    run = previous === yesterday ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = key
  }
  return {
    pendingTotal: pending.length,
    upcomingSevenDays: pending.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= sevenDaysAhead).length,
    overdue: pending.filter(t => t.dueDate && t.dueDate < today).length,
    completedSevenDays: tasks.filter(t => {
      if (!t.done || !t.completedAt) return false
      const date = new Date(t.completedAt)
      return Number.isFinite(date.getTime()) && date.getTime() <= now.getTime() && localDateKey(date) >= sevenDaysAgo
    }).length,
    currentStreak, bestStreak,
  }
}
