import { API_BASE_URL } from '@/constants'

const ACCESS_KEY = 'calificador-access-token'
const REFRESH_KEY = 'calificador-refresh-token'

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Intentar refrescar el access token usando el refresh token
async function tryRefresh() {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return false

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) {
      tokenStorage.clear()
      return false
    }
    const data = await res.json()
    tokenStorage.set(data.access, null)
    return true
  } catch {
    tokenStorage.clear()
    return false
  }
}

// Callback para cuando la sesión expira (lo setea useAuth)
let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

/**
 * Wrapper de fetch con autenticación JWT automática.
 * - Agrega header Authorization en cada request.
 * - Si recibe 401, intenta refrescar el token una vez.
 * - Si el refresh falla, llama onUnauthorized (redirige al login).
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    ...options.headers,
    ...(tokenStorage.getAccess()
      ? { Authorization: `Bearer ${tokenStorage.getAccess()}` }
      : {}),
  })

  let res = await fetch(url, { ...options, headers: buildHeaders() })

  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      res = await fetch(url, { ...options, headers: buildHeaders() })
    } else {
      onUnauthorized?.()
      throw new Error('Sesión expirada. Inicia sesión nuevamente.')
    }
  }

  return res
}
