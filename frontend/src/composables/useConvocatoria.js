import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { API_BASE_URL, STORAGE_KEYS } from '@/constants'

/**
 * Composable para gestionar convocatorias (sesiones de examen)
 */
export function useConvocatoria() {
  const convocatoriaList = ref([])
  const activeConvocatoria = useStorage(STORAGE_KEYS.CONVOCATORIA, null)
  const loading = ref(false)
  const error = ref('')
  const showPanel = ref(false)
  const newConvocatoriaForm = ref({ name: '', year: new Date().getFullYear() })
  const formError = ref('')

  const activeConvocatoriaId = computed(() => activeConvocatoria.value?.id ?? null)
  const activeConvocatoriaName = computed(() =>
    activeConvocatoria.value?.name ?? 'Sin convocatoria'
  )
  const isActive = computed(() => activeConvocatoria.value?.status === 'active')

  async function fetchConvocatorias() {
    try {
      loading.value = true
      error.value = ''
      const res = await fetch(`${API_BASE_URL}/convocatorias/`)
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      convocatoriaList.value = data

      // Si no hay activa seleccionada, seleccionar la primera activa
      if (!activeConvocatoria.value && data.length > 0) {
        const active = data.find((c) => c.status === 'active') || data[0]
        activeConvocatoria.value = active
      } else if (activeConvocatoria.value) {
        // Refrescar datos desde la lista
        const updated = data.find((c) => c.id === activeConvocatoria.value.id)
        if (updated) activeConvocatoria.value = updated
      }
    } catch (e) {
      error.value = `No se pudo conectar al servidor: ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function createConvocatoria() {
    formError.value = ''
    const name = (newConvocatoriaForm.value.name || '').trim()
    const year = Number(newConvocatoriaForm.value.year)

    if (!name) {
      formError.value = 'Ingresa un nombre para la convocatoria.'
      return
    }
    if (!year || year < 2000 || year > 2100) {
      formError.value = 'Ingresa un año válido.'
      return
    }

    try {
      loading.value = true
      const res = await fetch(`${API_BASE_URL}/convocatorias/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, year, status: 'active' }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(JSON.stringify(errData) || res.statusText)
      }
      const created = await res.json()

      // Inicializar áreas y formato DAT por defecto
      await fetch(`${API_BASE_URL}/convocatorias/${created.id}/init_defaults/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      convocatoriaList.value.unshift(created)
      activeConvocatoria.value = created
      newConvocatoriaForm.value = { name: '', year: new Date().getFullYear() }
      showPanel.value = false
    } catch (e) {
      formError.value = `Error al crear: ${e.message}`
    } finally {
      loading.value = false
    }
  }

  async function closeConvocatoria(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/convocatorias/${id}/close/`, { method: 'POST' })
      if (!res.ok) throw new Error(res.statusText)
      await fetchConvocatorias()
    } catch (e) {
      error.value = e.message
    }
  }

  async function reopenConvocatoria(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/convocatorias/${id}/reopen/`, { method: 'POST' })
      if (!res.ok) throw new Error(res.statusText)
      await fetchConvocatorias()
    } catch (e) {
      error.value = e.message
    }
  }

  function setActiveConvocatoria(conv) {
    activeConvocatoria.value = conv
  }

  return {
    convocatoriaList,
    activeConvocatoria,
    activeConvocatoriaId,
    activeConvocatoriaName,
    isActive,
    loading,
    error,
    showPanel,
    newConvocatoriaForm,
    formError,
    fetchConvocatorias,
    createConvocatoria,
    closeConvocatoria,
    reopenConvocatoria,
    setActiveConvocatoria,
  }
}
