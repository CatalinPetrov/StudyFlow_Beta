import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { primaryNav, type PageId } from '../../lib/navigation'
import { cn } from '../../lib/cn'

const tabs = primaryNav.filter(item => item.id !== 'study')

type Props = {
  page: PageId
  onNavigate: (page: PageId) => void
  onAdd: () => void
}

export function MobileTabBar({ page, onNavigate, onAdd }: Props) {
  const tab = (id: PageId) => {
    const item = tabs.find(entry => entry.id === id)
    if (!item) return null
    const active = page === id
    const Icon = item.icon
    return (
      <Link
        key={id}
        to={item.path}
        onClick={() => onNavigate(id)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium outline-none transition-colors',
          active ? 'text-brand-text' : 'text-ink-soft',
        )}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} />
        {item.label}
        {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-brand" />}
      </Link>
    )
  }

  return (
    <nav
      aria-label="Navigare principală"
      className="glass-nav fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-0.5 rounded-[26px] px-2 py-1.5 shadow-float lg:hidden"
    >
      {tab('home')}
      {tab('plan')}
      <div className="flex w-16 shrink-0 justify-center">
        <button
          type="button"
          onClick={onAdd}
          aria-label="Adaugă"
          aria-haspopup="dialog"
          className="pressable -mt-7 grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#3b9bff] to-brand text-white shadow-brand ring-4 ring-canvas"
        >
          <Plus className="size-7" strokeWidth={2.2} />
        </button>
      </div>
      {tab('subjects')}
      {tab('library')}
    </nav>
  )
}
