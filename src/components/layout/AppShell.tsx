import type { ReactNode } from 'react'
import type { UserSettings } from '../../profileModel'
import type { PageId } from '../../lib/navigation'
import { AppSidebar } from './AppSidebar'
import { MobileTabBar } from './MobileTabBar'

type Props = {
  page: PageId
  user: UserSettings['profile']
  onNavigate: (page: PageId) => void
  onAdd: () => void
  onProfile: () => void
  onLogout: () => void
  children: ReactNode
}

export function AppShell({ page, user, onNavigate, onAdd, onProfile, onLogout, children }: Props) {
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main-content">
        Sari la conținut
      </a>
      <AppSidebar page={page} user={user} onNavigate={onNavigate} onAdd={onAdd} onProfile={onProfile} onLogout={onLogout} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1468px] px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-6 outline-none sm:px-8 sm:pt-8 lg:pl-[300px] lg:pr-10 lg:pb-14 lg:pt-10"
      >
        {children}
      </main>
      <MobileTabBar page={page} onNavigate={onNavigate} onAdd={onAdd} />
    </div>
  )
}
