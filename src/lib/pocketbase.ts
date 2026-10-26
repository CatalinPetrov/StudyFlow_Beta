import PocketBase from 'pocketbase'

const url = (import.meta.env.VITE_PB_URL as string) || 'http://127.0.0.1:8090'

export const pb = new PocketBase(url)
pb.autoCancellation(false)

export function getPbUrl() {
  return url
}
