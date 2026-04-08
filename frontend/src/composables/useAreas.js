import { ref, computed, watch } from 'vue'
import { API_BASE_URL, ANSWER_KEY_AREAS } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'

/**
 * Composable para áreas dinámicas desde la API
 */
export function useAreas(activeConvocatoria) {
  // Fallback: áreas como objetos ligeros con defaults
  const defaultAreas = ANSWER_KEY_AREAS.map((name, i) => ({
    id: null,
    name,
    question_count: 60,
    vacantes: 0,
    order: i + 1,
    convocatoria: null,
  }))

  const areas = ref([...defaultAreas])
  const loading = ref(false)
  const error = ref('')

  const areaNames = computed(() => areas.value.map((a) => a.name))

  const areaByName = computed(() => {
    const map = new Map()
    areas.value.forEach((a) => map.set(a.name, a))
    return map
  })

  function getQuestionCount(areaName) {
    return areaByName.value.get(areaName)?.question_count ?? 60
  }

  function getVacantes(areaName) {
    return areaByName.value.get(areaName)?.vacantes ?? 0
  }

  async function fetchAreas(convocatoriaId) {
    if (!convocatoriaId) return
    try {
      loading.value = true
      error.value = ''
      const res = await apiFetch(`/areas/?convocatoria=${convocatoriaId}`)
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      if (data.length > 0) {
        areas.value = data
      } else {
        // Usar defaults si el servidor no tiene áreas para esta convocatoria
        areas.value = [...defaultAreas]
      }
    } catch (e) {
      error.value = e.message
      areas.value = [...defaultAreas]
    } finally {
      loading.value = false
    }
  }

  async function createArea(data) {
    const res = await apiFetch(`/areas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(res.statusText)
    const created = await res.json()
    areas.value.push(created)
    return created
  }

  async function updateArea(id, data) {
    const res = await apiFetch(`/areas/${id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(res.statusText)
    const updated = await res.json()
    const idx = areas.value.findIndex((a) => a.id === id)
    if (idx >= 0) areas.value[idx] = updated
    return updated
  }

  async function updateVacantes(areaName, vacantes) {
    const area = areas.value.find((a) => a.name === areaName)
    if (!area?.id) {
      // Fallback local
      const idx = areas.value.findIndex((a) => a.name === areaName)
      if (idx >= 0) areas.value[idx] = { ...areas.value[idx], vacantes }
      return
    }
    try {
      const res = await apiFetch(`/areas/${area.id}/set_vacantes/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacantes }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const updated = await res.json()
      const idx = areas.value.findIndex((a) => a.id === area.id)
      if (idx >= 0) areas.value[idx] = updated
    } catch (e) {
      // Actualizar localmente aunque falle la API
      const idx = areas.value.findIndex((a) => a.name === areaName)
      if (idx >= 0) areas.value[idx] = { ...areas.value[idx], vacantes }
    }
  }

  async function deleteArea(id) {
    const res = await apiFetch(`/areas/${id}/`, { method: 'DELETE' })
    if (!res.ok) throw new Error(res.statusText)
    areas.value = areas.value.filter((a) => a.id !== id)
  }

  // Recargar áreas cuando cambia la convocatoria
  if (activeConvocatoria) {
    watch(
      activeConvocatoria,
      (conv) => {
        if (conv?.id) {
          fetchAreas(conv.id)
        } else {
          areas.value = [...defaultAreas]
        }
      },
      { immediate: true }
    )
  }

  return {
    areas,
    areaNames,
    areaByName,
    loading,
    error,
    getQuestionCount,
    getVacantes,
    fetchAreas,
    createArea,
    updateArea,
    updateVacantes,
    deleteArea,
  }
}
