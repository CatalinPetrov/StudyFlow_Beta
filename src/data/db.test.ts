import { describe, expect, it } from 'vitest'
import { LAST_USER_ID_KEY, clearLocalData, db } from './db'

describe('clearLocalData', () => {
  it('clears tables and studyflow keys but keeps theme and last user', async () => {
    await db.tasks.put({ id: 1, title: 'x' } as never)
    await db.meta.put({ key: 'academics', value: {} })
    localStorage.setItem('studyflow-tasks-v1', '[]')
    localStorage.setItem('studyflow-theme', 'dark')
    localStorage.setItem(LAST_USER_ID_KEY, 'user-1')
    localStorage.setItem('unrelated', 'keep')

    await clearLocalData()

    expect(await db.tasks.count()).toBe(0)
    expect(await db.meta.count()).toBe(0)
    expect(localStorage.getItem('studyflow-tasks-v1')).toBeNull()
    expect(localStorage.getItem('studyflow-theme')).toBe('dark')
    expect(localStorage.getItem(LAST_USER_ID_KEY)).toBe('user-1')
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })
})
