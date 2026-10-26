import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { syncAll, syncPushAll } from '../../data/sync'

export default function SyncStatus() {
  const { isValid } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem('studyflow-sync-last'))

  async function runSync() {
    if (!isValid || syncing) return
    setSyncing(true)
    try {
      await syncPushAll()
      await syncAll()
      const now = new Date().toISOString()
      localStorage.setItem('studyflow-sync-last', now)
      setLastSync(now)
    } catch {
      // ignore sync errors
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!isValid) return
    runSync()
    const interval = setInterval(runSync, 120000)
    return () => clearInterval(interval)
  }, [isValid])

  if (!isValid) return null

  return (
    <button onClick={runSync} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:text-ink">
      <span className={`size-1.5 rounded-full ${syncing ? 'animate-pulse bg-brand' : 'bg-[#34c759]'}`} />
      {syncing ? 'Se sincronizează' : 'Sincronizat'}
      {lastSync && !syncing ? (
        <span className="text-ink-faint">· {new Date(lastSync).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
      ) : null}
    </button>
  )
}
