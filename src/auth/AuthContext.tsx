import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { pb } from '../lib/pocketbase'
import { clearLocalData } from '../data/db'
import { syncPushAll } from '../data/sync'

type AuthCtx = {
  user: any
  token: string
  isValid: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(pb.authStore.model)
  const [token, setToken] = useState<string>(pb.authStore.token)
  const [isValid, setIsValid] = useState<boolean>(pb.authStore.isValid)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
      setToken(pb.authStore.token)
      setIsValid(pb.authStore.isValid)
    })
    let active = true
    void (async () => {
      // Revalidăm sesiunea salvată la pornire, altfel un token expirat pare valid.
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh()
        } catch {}
      }
      if (active) setIsLoading(false)
    })()
    return () => {
      active = false
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  async function login(email: string, password: string) {
    await pb.collection('users').authWithPassword(email, password)
  }

  async function register(email: string, password: string, passwordConfirm: string, name?: string) {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      name: name?.trim() || email.split('@')[0],
    })
    await pb.collection('users').authWithPassword(email, password)
  }

  async function logout() {
    // Împinge datele contului curent înainte să ștergem localul, ca să nu piardă nimic.
    try { await syncPushAll() } catch {}
    pb.authStore.clear()
    await clearLocalData()
    window.location.reload()
  }

  async function refresh() {
    if (pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh()
      } catch {}
    }
  }

  return <Ctx.Provider value={{ user, token, isValid, isLoading, login, register, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
