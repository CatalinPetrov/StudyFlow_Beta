import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Plus } from 'lucide-react'
import { initialsFor, type UserSettings } from '../../profileModel'
import { primaryNav, type PageId } from '../../lib/navigation'
import { cn } from '../../lib/cn'

type Props = {
  page: PageId
  user: UserSettings['profile']
  onNavigate: (page: PageId) => void
  onAdd: () => void
  onProfile: () => void
  onLogout: () => void
}

export function AppSidebar({ page, user, onNavigate, onAdd, onProfile, onLogout }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-line bg-surface/70 px-4 py-5 backdrop-blur-2xl lg:flex">
      <Link
        to="/"
        onClick={() => onNavigate('home')}
        className="flex items-center gap-3 rounded-2xl px-2 py-2 outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
        aria-label="StudyFlow, mergi la Acasă"
      >
        <span className="grid size-10 place-items-center rounded-[13px] bg-gradient-to-b from-[#3b9bff] to-brand text-white shadow-sm shadow-brand/25">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M3 8c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-semibold tracking-[-0.025em]">StudyFlow</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-faint">Planner universitar</span>
        </span>
      </Link>

      <nav aria-label="Navigare principală" className="mt-7 flex flex-col gap-1">
        {primaryNav.map(({ id, label, path, icon: Icon }) => {
          const active = page === id
          return (
            <Link
              key={id}
              to={path}
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'pressable flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-[15px] font-medium outline-none',
                active
                  ? 'bg-brand text-white shadow-sm shadow-brand/20'
                  : 'text-ink-soft hover:bg-ink/[0.045] hover:text-ink',
              )}
            >
              <Icon className={cn('size-[19px]', active ? 'text-white' : 'text-ink-faint')} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onAdd}
        className="pressable mt-3 flex h-11 items-center justify-center gap-2 rounded-[13px] border border-brand/20 bg-brand/[0.07] px-3 text-sm font-semibold text-brand-text hover:bg-brand/[0.11]"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        Adaugă
      </button>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={onProfile}
          className="pressable flex w-full items-center gap-3 rounded-2xl bg-ink/[0.035] p-3 text-left hover:bg-ink/[0.055]"
          aria-label="Deschide profilul și setările"
        >
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#5ac8fa] to-brand text-sm font-semibold text-white">
            {user.avatarDataUrl ? <img src={user.avatarDataUrl} alt="" className="size-full object-cover" /> : initialsFor(user.name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-ink-soft">
              Anul {user.studyYear}
              {user.specialization ? ` · ${user.specialization}` : ''}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (!loggingOut) { setLoggingOut(true); onLogout() } }}
          disabled={loggingOut}
          aria-label="Deconectare"
          className="pressable mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-ink/[0.045] hover:text-ink disabled:opacity-60"
        >
          <LogOut className="size-[17px] text-ink-faint" strokeWidth={1.9} />
          {loggingOut ? 'Se deconectează…' : 'Deconectare'}
        </button>
      </div>
    </aside>
  )
}
