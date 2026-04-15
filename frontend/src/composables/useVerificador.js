import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export function useVerificador() {
  const sesiones = ref([])
  const loading = ref(false)
  const saving = ref(false)

  // ── Historial ────────────────────────────────────────────────────────────────

  async function fetchSesiones() {
    loading.value = true
    try {
      const res = await apiFetch('/verificador/')
      if (!res.ok) return
      sesiones.value = await res.json()
    } catch { /* silencioso */ }
    finally { loading.value = false }
  }

  async function saveSesion(payload) {
    saving.value = true
    try {
      const res = await apiFetch('/verificador/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) return null
      const created = await res.json()
      sesiones.value.unshift(created)
      return created
    } catch { return null }
    finally { saving.value = false }
  }

  async function updateSesion(id, payload) {
    saving.value = true
    try {
      const res = await apiFetch(`/verificador/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) return null
      const updated = await res.json()
      const idx = sesiones.value.findIndex(s => s.id === id)
      if (idx !== -1) sesiones.value[idx] = updated
      return updated
    } catch { return null }
    finally { saving.value = false }
  }

  async function deleteSesion(id) {
    try {
      await apiFetch(`/verificador/${id}/`, { method: 'DELETE' })
      sesiones.value = sesiones.value.filter(s => s.id !== id)
    } catch { /* silencioso */ }
  }

  return {
    sesiones,
    loading,
    saving,
    fetchSesiones,
    saveSesion,
    updateSesion,
    deleteSesion,
  }
}
