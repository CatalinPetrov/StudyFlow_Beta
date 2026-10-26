import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function LoginPage({ onNavigate }: { onNavigate?: (p:string)=>void } = {}) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      if (onNavigate) onNavigate('/'); else navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Autentificare eșuată')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Conectare</h1>
          <p className="mt-2 text-sm text-ink-soft">Intră în cont pentru a sincroniza datele între dispozitive</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Parolă</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10" />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {loading ? 'Se conectează...' : 'Conectare'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Nu ai cont? <Link to="/auth/register" className="font-medium text-brand-text hover:underline">Înregistrează-te</Link>
        </p>
      </div>
    </div>
  )
}
