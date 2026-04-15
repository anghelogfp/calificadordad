import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export function useHistory() {
  const historyList = ref([])
  const loading = ref(false)

  async function fetchHistory() {
    loading.value = true
    try {
      const res = await apiFetch('/procesos/')
      if (!res.ok) return
      const data = await res.json()
      // Normalizar al shape que espera el frontend
      historyList.value = data.map(p => ({
        id: p.local_id,
        dbId: p.id,
        name: p.name,
        savedAt: p.updated_at,
        areaNames: p.area_names || [],
        totalCandidates: p.total_candidates || 0,
        createdByUsername: p.created_by_username,
        // areas vacío — se carga al abrir el proceso con loadProcess
        areas: {},
      }))
    } catch { /* silencioso */ }
    finally { loading.value = false }
  }

  async function saveProcess(process, customName) {
    if (!process?.id || !Object.keys(process.areas || {}).length) return false
    try {
      await apiFetch('/procesos/', {
        method: 'POST',
        body: JSON.stringify({
          local_id: process.id,
          name: customName || process.name,
          areas: process.areas,
        }),
      })
      await fetchHistory()
      return true
    } catch {
      return false
    }
  }

  async function deleteProcess(id) {
    // id puede ser local_id (string) o dbId (number)
    const item = historyList.value.find(p => p.id === id || p.dbId === id)
    if (!item?.dbId) {
      historyList.value = historyList.value.filter(p => p.id !== id)
      return
    }
    try {
      await apiFetch(`/procesos/${item.dbId}/`, { method: 'DELETE' })
      historyList.value = historyList.value.filter(p => p.dbId !== item.dbId)
    } catch { /* silencioso */ }
  }

  async function loadProcessFromApi(dbId) {
    try {
      const res = await apiFetch(`/procesos/${dbId}/full/`)
      if (!res.ok) return null
      return await res.json()
    } catch { return null }
  }

  return {
    historyList,
    loading,
    fetchHistory,
    saveProcess,
    deleteProcess,
    loadProcessFromApi,
  }
}
