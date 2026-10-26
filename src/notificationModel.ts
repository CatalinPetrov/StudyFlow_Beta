import type { StudyTask } from './taskModel'
import type { StudyExam } from './calendarModel'
import type { NotificationPreferences } from './profileModel'
export type StudyNotification={id:string;title:string;description:string;kind:'task'|'exam';relatedId:string|number;date:string;priority:'urgent'|'soon'}
const day=(value:string):Date|null=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null
  const [y,m,d]=value.split('-').map(Number)
  const date=new Date(y,m-1,d)
  return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null
}
export function daysUntil(when:string,now:Date):number|null {
  const target=day(when);if(!target)return null
  const start=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())
  return Math.round((Date.UTC(target.getFullYear(),target.getMonth(),target.getDate())-start)/86400000)
}
export function buildNotifications(tasks:StudyTask[],exams:StudyExam[],prefs:NotificationPreferences,now:Date):StudyNotification[] {
  const entries:StudyNotification[]=[]
  if(prefs.taskDeadlines)for(const task of tasks){
    if(task.done||!task.dueDate)continue
    const left=daysUntil(task.dueDate,now)
    if(left===null||left < -30||left>7)continue
    entries.push({id:`task:${task.id}:${task.dueDate}`,kind:'task',relatedId:task.id,date:task.dueDate,
      title:task.title,
      description:left<0?`Task restant de ${-left} ${-left===1?'zi':'zile'}`:left===0?'Deadline astăzi':left===1?'Deadline mâine':`Deadline în ${left} zile`,
      priority:left<=1?'urgent':'soon'})
  }
  if(prefs.exams)for(const exam of exams){
    const left=daysUntil(exam.date,now)
    if(left===null||left<0||left>14)continue
    entries.push({id:`exam:${exam.id}:${exam.date}`,kind:'exam',relatedId:exam.id,date:exam.date,
      title:`Examen: ${exam.subject}`,
      description:left===0?`Astăzi${exam.time?`, ora ${exam.time}`:''}`:left===1?`Mâine${exam.time?`, ora ${exam.time}`:''}`:`În ${left} zile${exam.time?`, ora ${exam.time}`:''}`,
      priority:left<=2?'urgent':'soon'})
  }
  return entries.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))
}
export const readNotificationsKey='studyflow-notifications-read-v1'
export function loadReadIds():string[]{
  try {const value:unknown=JSON.parse(localStorage.getItem(readNotificationsKey)||'[]');return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string').slice(-1000):[]}
  catch{return []}
}
