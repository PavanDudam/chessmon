/** API origin for production. Empty in local Vite (proxy handles /api and /audio). */
const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''

export const API_BASE = RAW.replace(/\/$/, '')

/** Resolve an API or audio path against VITE_API_URL when set. */
export function apiUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}
