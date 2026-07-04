import { ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { apiFetch } from '@/utils/apiFetch'

/**
 * Composable para gestionar vacantes por programa de estudios.
 * Usa API como fuente principal; conserva cambios en memoria mientras la app está abierta.
 */
export function useVacantesPrograma() {
  const vacantesPrograma = ref({})
  const apiLoading = ref(false)
  const apiSyncing = ref(false)
  const apiReady = ref(false)
  let skipNextApiSync = false

  async function initializeVacantesPrograma() {
    apiLoading.value = true
    try {
      const res = await apiFetch('/programa-vacantes/')
      if (!res.ok) throw new Error('No se pudieron cargar las vacantes.')
      const data = await res.json()
      apiReady.value = true

      if (data.length > 0) {
        skipNextApiSync = true
        vacantesPrograma.value = Object.fromEntries(
          data.map((row) => [row.programa, Number(row.vacantes) || 0])
        )
      } else {
        skipNextApiSync = true
        vacantesPrograma.value = {}
      }
    } catch (error) {
      console.warn('[vacantesPrograma] API no disponible, manteniendo estado local en memoria:', error)
      apiReady.value = false
    } finally {
      apiLoading.value = false
    }
  }

  async function syncVacantesProgramaToApi() {
    if (!apiReady.value) return
    apiSyncing.value = true
    try {
      const res = await apiFetch('/programa-vacantes/bulk_replace/', {
        method: 'POST',
        body: JSON.stringify({ vacantes: vacantesPrograma.value || {} }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar las vacantes.')
    } catch (error) {
      console.warn('[vacantesPrograma] No se pudo sincronizar con API:', error)
    } finally {
      apiSyncing.value = false
    }
  }

  watchDebounced(
    vacantesPrograma,
    () => {
      if (skipNextApiSync) {
        skipNextApiSync = false
        return
      }
      syncVacantesProgramaToApi()
    },
    { debounce: 800, deep: true },
  )

  function getVacantes(programa) {
    return Number(vacantesPrograma.value[programa]) || 0
  }

  function setVacantes(programa, n) {
    vacantesPrograma.value = {
      ...vacantesPrograma.value,
      [programa]: Number(n) || 0,
    }
  }

  return {
    vacantesPrograma,
    apiLoading,
    apiSyncing,
    apiReady,
    initializeVacantesPrograma,
    syncVacantesProgramaToApi,
    getVacantes,
    setVacantes,
  }
}
