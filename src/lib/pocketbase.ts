import PocketBase from 'pocketbase'

const envUrl = import.meta.env.VITE_PB_URL as string | undefined
// Fără VITE_PB_URL, același origin ca pagina (Vite proxiază /api spre PocketBase).
// Niciun port separat, niciun CORS, nicio regulă de firewall pentru telefoanele din LAN.
const url = envUrl || window.location.origin

export const pb = new PocketBase(url)
pb.autoCancellation(false)

export function getPbUrl() {
  return url
}
