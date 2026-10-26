/** Profil local de prototip. Nu reprezintă un cont autentificat. */
export type StudentProfile = {
  name: string
  university: string
  faculty: string
  specialization: string
  studyYear: number
  /** Imagine micșorată local, nu este sincronizată online. */
  avatarDataUrl?: string
}
export type NotificationPreferences = { taskDeadlines: boolean; exams: boolean }
export type UserSettings = { profile: StudentProfile; notifications: NotificationPreferences }
export const userSettingsKey = 'studyflow-user-settings-v1'
export const defaultUserSettings = (): UserSettings => ({
  profile: { name: 'Student', university: '', faculty: '', specialization: '', studyYear: 1, avatarDataUrl: '' },
  notifications: { taskDeadlines: true, exams: true },
})
export function cleanSettings(data: unknown): UserSettings {
  const fallback=defaultUserSettings()
  if(!data || typeof data!=='object') return fallback
  const raw=data as Record<string, unknown>
  const p=raw.profile && typeof raw.profile==='object' ? raw.profile as Record<string,unknown> : {}
  const n=raw.notifications && typeof raw.notifications==='object' ? raw.notifications as Record<string,unknown> : {}
  const safe=(value:unknown,max:number)=>(typeof value==='string'?value.trim().slice(0,max):'')
  return {
    profile: {
      name:safe(p.name,80)||fallback.profile.name,
      university:safe(p.university,120),faculty:safe(p.faculty,120),
      specialization:safe(p.specialization,120),
      avatarDataUrl:typeof p.avatarDataUrl==='string' && p.avatarDataUrl.length < 600000 && /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(p.avatarDataUrl) ? p.avatarDataUrl : '',
      studyYear:typeof p.studyYear==='number'&&Number.isInteger(p.studyYear)&&p.studyYear>=1&&p.studyYear<=6?p.studyYear:1,
    },
    notifications: {
      taskDeadlines:typeof n.taskDeadlines==='boolean'?n.taskDeadlines:true,
      exams:typeof n.exams==='boolean'?n.exams:true,
    },
  }
}
export function loadUserSettings():UserSettings {
  try{return cleanSettings(JSON.parse(localStorage.getItem(userSettingsKey)||'null'))}
  catch{return defaultUserSettings()}
}
export function saveUserSettings(settings:UserSettings):boolean {
  try{localStorage.setItem(userSettingsKey,JSON.stringify(cleanSettings(settings)));return true}
  catch{return false}
}
export function initialsFor(name:string):string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toLocaleUpperCase('ro-RO')).join('')||'S'
}
export function firstName(name:string):string {return name.trim().split(/\s+/)[0]||'Student'}
