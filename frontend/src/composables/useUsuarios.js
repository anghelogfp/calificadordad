import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

const users = ref([])
const loading = ref(false)
const error = ref('')

export function useUsuarios() {
  async function fetchUsuarios() {
    loading.value = true
    error.value = ''
    try {
      const res = await apiFetch('/usuarios/')
      if (!res.ok) throw new Error('Error al cargar usuarios')
      users.value = await res.json()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createUsuario(data) {
    const res = await apiFetch('/usuarios/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.detail || 'Error al crear usuario')
    users.value.push(body)
    return body
  }

  async function updateUsuario(id, data) {
    const res = await apiFetch(`/usuarios/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.detail || 'Error al actualizar usuario')
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx !== -1) users.value[idx] = body
    return body
  }

  async function setPassword(id, password) {
    const res = await apiFetch(`/usuarios/${id}/set-password/`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.detail || 'Error al cambiar contraseña')
    return body
  }

  async function toggleActivo(id, isActive) {
    return updateUsuario(id, { is_active: isActive })
  }

  return {
    users,
    loading,
    error,
    fetchUsuarios,
    createUsuario,
    updateUsuario,
    setPassword,
    toggleActivo,
  }
}
