import { ref, computed } from 'vue'
import { API_BASE_URL } from '@/constants'
import { tokenStorage, setUnauthorizedHandler } from '@/utils/apiFetch'

const user = ref(null)
const loading = ref(false)
const error = ref('')
const initialized = ref(false)
const initializing = ref(true)

// Estado global reactivo compartido entre todas las instancias
export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)

  async function initialize() {
    if (initialized.value) { initializing.value = false; return }
    initialized.value = true

    const access = tokenStorage.getAccess()
    if (!access) { initializing.value = false; return }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${access}` },
      })

      if (res.ok) {
        user.value = await res.json()
      } else {
        // Token inválido — intentar refresh
        const refresh = tokenStorage.getRefresh()
        if (!refresh) { tokenStorage.clear(); return }

        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        })

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          tokenStorage.set(data.access, null)

          const meRes = await fetch(`${API_BASE_URL}/auth/me/`, {
            headers: { Authorization: `Bearer ${data.access}` },
          })
          if (meRes.ok) user.value = await meRes.json()
          else tokenStorage.clear()
        } else {
          tokenStorage.clear()
        }
      }
    } catch {
      // Si el servidor no responde, limpiar tokens
      tokenStorage.clear()
    } finally {
      initializing.value = false
    }
  }

  async function login(username, password) {
    loading.value = true
    error.value = ''

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        error.value = data.detail || 'Error al iniciar sesión.'
        return false
      }

      tokenStorage.set(data.access, data.refresh)
      user.value = data.user
      return true
    } catch {
      error.value = 'No se pudo conectar al servidor.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      const access = tokenStorage.getAccess()
      if (access) {
        await fetch(`${API_BASE_URL}/auth/logout/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${access}` },
        })
      }
    } catch { /* silencioso */ }

    tokenStorage.clear()
    user.value = null
    initialized.value = false
  }

  // Registrar el handler de sesión expirada.
  // Guard: si el usuario ya no está autenticado, ignorar (evita que 401s de fondo
  // antes del login reseteen el estado de inicialización).
  setUnauthorizedHandler(() => {
    if (!user.value) return
    tokenStorage.clear()
    user.value = null
    initialized.value = false
  })

  return {
    user,
    loading,
    error,
    isAuthenticated,
    initializing,
    initialize,
    login,
    logout,
  }
}
