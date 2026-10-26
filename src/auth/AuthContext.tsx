import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { pb } from '../lib/pocketbase'

type AuthCtx = {
  user: any
  token: string
  isValid: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(pb.authStore.model)
  const [token, setToken] = useState<string>(pb.authStore.token)
  const [isValid, setIsValid] = useState<boolean>(pb.authStore.isValid)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(false)
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
      setToken(pb.authStore.token)
      setIsValid(pb.authStore.isValid)
    })
    return () => {
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

  function logout() {
    pb.authStore.clear()
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
