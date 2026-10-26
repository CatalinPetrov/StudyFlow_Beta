import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function RegisterPage({ onNavigate }: { onNavigate?: (p:string)=>void } = {}) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('Parolele nu coincid')
      return
    }
    if (password.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere')
      return
    }
    setLoading(true)
    try {
      await register(email, password, passwordConfirm, name)
      if (onNavigate) onNavigate('/'); else navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Înregistrare eșuată')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Creare cont</h1>
          <p className="mt-2 text-sm text-ink-soft">Sincronizează datele automat pe toate dispozitivele</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Nume (opțional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Parolă</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Confirmă parola</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required minLength={8} className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {loading ? 'Se creează...' : 'Creează cont'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Ai deja cont? <Link to="/auth/login" className="font-medium text-brand-text hover:underline">Conectare</Link>
        </p>
      </div>
    </div>
  )
}
