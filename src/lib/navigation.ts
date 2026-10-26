import { BookOpen, CalendarDays, Home, Library, Sparkles, type LucideIcon } from 'lucide-react'

export type PageId = 'home' | 'plan' | 'subjects' | 'library' | 'study' | 'profile' | 'notifications' | 'auth-login' | 'auth-register'

export const pagePaths: Record<PageId, string> = {
  home: '/',
  'auth-login': '/auth/login',
  'auth-register': '/auth/register',
  plan: '/plan',
  subjects: '/subjects',
  library: '/library',
  study: '/study',
  profile: '/profile',
  notifications: '/notifications',
}

export type NavItem = {
  id: PageId
  label: string
  path: string
  icon: LucideIcon
}

export const primaryNav: NavItem[] = [
  { id: 'home', label: 'Acasă', path: '/', icon: Home },
  { id: 'plan', label: 'Plan', path: '/plan', icon: CalendarDays },
  { id: 'subjects', label: 'Materii', path: '/subjects', icon: BookOpen },
  { id: 'library', label: 'Library', path: '/library', icon: Library },
  { id: 'study', label: 'Study Hub', path: '/study', icon: Sparkles },
]

export function pageFromPath(pathname: string): PageId {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/plan') return 'plan'
  if (clean === '/subjects') return 'subjects'
  if (clean === '/library') return 'library'
  if (clean === '/study' || clean.startsWith('/study/')) return 'study'
  if (clean === '/profile') return 'profile'
  if (clean === '/notifications') return 'notifications'
  if (clean === '/auth/login') return 'auth-login'
  if (clean === '/auth/register') return 'auth-register'
  return 'home'
}
