import { ref, reactive, computed } from 'vue'
import {
  DEFAULT_PONDERATIONS,
  DEFAULT_DAT_FORMAT,
  ANSWER_KEY_AREAS,
} from '@/constants'
import { apiFetch } from '@/utils/apiFetch'
import { normalizeArea } from '@/utils/helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Normalización API ↔ frontend
// API usa snake_case; el frontend usa camelCase
// ─────────────────────────────────────────────────────────────────────────────

function itemFromApi(i) {
  return {
    id: i.id,
    subject: i.subject,
    questionCount: Number(i.question_count),
    ponderation: Number(i.ponderation),
    order: i.order,
  }
}

function plantillaFromApi(p) {
  return {
    id: p.id,
    name: p.name,
    area: p.area || null,
    convocatoriaId: p.convocatoria || null,
    questionTotal: p.question_total,
    items: (p.items || []).map(itemFromApi),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function usePonderations(areaNames, activeConvocatoriaId) {
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )

  // ── Estado principal ──────────────────────────────────────────────────────

  const plantillas = ref([])
  const loading = ref(false)
  const selectedPlantillaId = ref(null)
  const editorError = ref('')
  const newItem = reactive({ subject: '', questionCount: 1, ponderation: 1 })
  const editingItems = ref(new Set())

  const showNewPlantillaForm = ref(false)
  const newPlantillaName = ref('')
  const newPlantillaArea = ref('')

  // ── Computed ──────────────────────────────────────────────────────────────

  const selectedPlantilla = computed(() =>
    plantillas.value.find(p => p.id === selectedPlantillaId.value) || null
  )

  const selectedPlantillaItems = computed(() =>
    (selectedPlantilla.value?.items || [])
      .slice()
      .sort((a, b) => a.order - b.order || String(a.subject).localeCompare(String(b.subject)))
  )

  const selectedPlantillaTotal = computed(() => {
    const items = selectedPlantilla.value?.items || []
    return {
      questions: items.reduce((a, i) => a + (Number(i.questionCount) || 0), 0),
      weight: items.reduce((a, i) => a + (Number(i.ponderation) || 0), 0),
    }
  })

  const sidebarSections = computed(() => {
    const sections = []
    const areaMap = new Map()

    plantillas.value.forEach(p => {
      const key = p.area || '__global__'
      if (!areaMap.has(key)) areaMap.set(key, [])
      areaMap.get(key).push(p)
    })

    effectiveAreaNames.value.forEach(area => {
      const list = areaMap.get(area)
      if (list?.length) sections.push({ area, label: area, plantillas: list })
    })

    areaMap.forEach((list, key) => {
      if (key !== '__global__' && !effectiveAreaNames.value.includes(key))
        sections.push({ area: key, label: key, plantillas: list })
    })

    const globals = areaMap.get('__global__')
    if (globals?.length) sections.push({ area: null, label: 'General', plantillas: globals })

    return sections
  })

  // Compat con App.vue getStepStatus
  const ponderationRows = computed(() => plantillas.value.flatMap(p => p.items || []))

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _updatePlantillaLocal(updated) {
    const idx = plantillas.value.findIndex(p => p.id === updated.id)
    if (idx >= 0) plantillas.value[idx] = updated
    else plantillas.value.push(updated)
  }

  // ── CRUD Plantillas ───────────────────────────────────────────────────────

  function getPlantillaById(id) {
    return plantillas.value.find(p => p.id === id) || null
  }

  function getPlantillasForCalification(area) {
    const normalized = normalizeArea(area, effectiveAreaNames.value)
    return plantillas.value.filter(p => !p.area || p.area === normalized)
  }

  function selectPlantilla(id) {
    selectedPlantillaId.value = id
    editorError.value = ''
    newItem.subject = ''
    newItem.questionCount = 1
    newItem.ponderation = 1
    editingItems.value = new Set()
  }

  async function createPlantilla({ name, area = null } = {}) {
    editorError.value = ''
    const trimmed = String(name ?? '').trim()
    if (!trimmed) { editorError.value = 'El nombre de la plantilla es requerido.'; return null }

    try {
      const res = await apiFetch('/plantillas/', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          area: area || null,
          convocatoria: activeConvocatoriaId?.value || null,
        }),
      })
      if (!res.ok) { editorError.value = 'Error al crear la plantilla.'; return null }
      const data = await res.json()
      const plantilla = plantillaFromApi(data)
      plantillas.value = [...plantillas.value, plantilla]
      selectPlantilla(plantilla.id)
      return plantilla
    } catch {
      editorError.value = 'Error de conexión.'
      return null
    }
  }

  async function deletePlantilla(id) {
    try {
      await apiFetch(`/plantillas/${id}/`, { method: 'DELETE' })
    } catch { /* continuar aunque falle */ }

    plantillas.value = plantillas.value.filter(p => p.id !== id)
    if (selectedPlantillaId.value === id) {
      selectedPlantillaId.value = plantillas.value[0]?.id || null
    }
  }

  async function renamePlantilla(id, name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return

    // Optimista
    plantillas.value = plantillas.value.map(p => p.id === id ? { ...p, name: trimmed } : p)

    try {
      await apiFetch(`/plantillas/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      })
    } catch { /* ya actualizado localmente */ }
  }

  // ── CRUD Items ────────────────────────────────────────────────────────────

  async function addItem() {
    editorError.value = ''
    if (!selectedPlantilla.value) { editorError.value = 'Selecciona una plantilla primero.'; return }

    const subject = String(newItem.subject ?? '').trim()
    const questionCount = Math.max(0, Math.round(Number(newItem.questionCount ?? 0)))
    const ponderation = Number(newItem.ponderation ?? 0)

    if (!subject) { editorError.value = 'Ingresa la asignatura.'; return }
    if (questionCount <= 0) { editorError.value = 'La cantidad de preguntas debe ser mayor a cero.'; return }
    if (!Number.isFinite(ponderation) || ponderation <= 0) {
      editorError.value = 'La ponderación debe ser un número positivo.'
      return
    }

    const plantillaId = selectedPlantillaId.value
    const items = selectedPlantilla.value.items || []
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0

    try {
      const res = await apiFetch(`/plantillas/${plantillaId}/items/`, {
        method: 'POST',
        body: JSON.stringify({ subject, question_count: questionCount, ponderation, order: maxOrder + 1 }),
      })
      if (!res.ok) { editorError.value = 'Error al agregar el item.'; return }
      const data = await res.json()
      const newItemData = itemFromApi(data)

      plantillas.value = plantillas.value.map(p => {
        if (p.id !== plantillaId) return p
        const updatedItems = [...(p.items || []), newItemData]
        return { ...p, items: updatedItems, questionTotal: updatedItems.reduce((a, i) => a + i.questionCount, 0) }
      })

      newItem.subject = ''
      newItem.questionCount = 1
      newItem.ponderation = 1
    } catch {
      editorError.value = 'Error de conexión al agregar item.'
    }
  }

  async function removeItem(itemId) {
    const plantillaId = selectedPlantillaId.value
    if (!plantillaId) return

    // Optimista
    plantillas.value = plantillas.value.map(p => {
      if (p.id !== plantillaId) return p
      const updatedItems = (p.items || []).filter(i => i.id !== itemId)
      return { ...p, items: updatedItems, questionTotal: updatedItems.reduce((a, i) => a + i.questionCount, 0) }
    })
    const next = new Set(editingItems.value)
    next.delete(itemId)
    editingItems.value = next

    try {
      await apiFetch(`/plantillas/${plantillaId}/items/${itemId}/`, { method: 'DELETE' })
    } catch { /* ya eliminado localmente */ }
  }

  async function toggleEditItem(itemId) {
    const next = new Set(editingItems.value)
    if (next.has(itemId)) {
      // Guardando edición — sincronizar con API
      next.delete(itemId)
      editingItems.value = next

      const plantillaId = selectedPlantillaId.value
      const item = selectedPlantilla.value?.items?.find(i => i.id === itemId)
      if (!item || !plantillaId) return

      // Recalcular total local
      plantillas.value = plantillas.value.map(p => {
        if (p.id !== plantillaId) return p
        return { ...p, questionTotal: (p.items || []).reduce((a, i) => a + i.questionCount, 0) }
      })

      try {
        await apiFetch(`/plantillas/${plantillaId}/items/${itemId}/`, {
          method: 'PUT',
          body: JSON.stringify({
            subject: item.subject,
            question_count: item.questionCount,
            ponderation: item.ponderation,
            order: item.order,
          }),
        })
      } catch { /* ya actualizado localmente */ }
    } else {
      next.add(itemId)
      editingItems.value = next
    }
  }

  function isEditingItem(itemId) {
    return editingItems.value.has(itemId)
  }

  // ── Formulario nueva plantilla ────────────────────────────────────────────

  function openNewPlantillaForm(defaultArea = '') {
    newPlantillaName.value = ''
    newPlantillaArea.value = defaultArea
    showNewPlantillaForm.value = true
    editorError.value = ''
  }

  function cancelNewPlantillaForm() {
    showNewPlantillaForm.value = false
    newPlantillaName.value = ''
    newPlantillaArea.value = ''
  }

  async function confirmNewPlantilla() {
    const created = await createPlantilla({
      name: newPlantillaName.value,
      area: newPlantillaArea.value || null,
    })
    if (created) {
      showNewPlantillaForm.value = false
      newPlantillaName.value = ''
      newPlantillaArea.value = ''
    }
  }

  // ── Inicialización y seed ─────────────────────────────────────────────────

  async function _seedDefaultsToApi() {
    const areas = effectiveAreaNames.value.length ? effectiveAreaNames.value : ANSWER_KEY_AREAS
    const convocatoriaId = activeConvocatoriaId?.value || null

    const toCreate = []

    areas.forEach(area => {
      const items = DEFAULT_PONDERATIONS
        .filter(d => d.area === area)
        .map(d => ({
          subject: d.subject,
          question_count: d.questionCount,
          ponderation: String(d.ponderation),
          order: d.order,
        }))
      if (items.length) {
        toCreate.push({ name: `UNAP \u2014 ${area}`, area, convocatoria: convocatoriaId, items })
      }
    })

    // Modo Simple global
    toCreate.push({
      name: 'Modo Simple',
      area: null,
      convocatoria: null,
      items: [{ subject: 'General', question_count: DEFAULT_DAT_FORMAT.answersLength, ponderation: '1', order: 1 }],
    })

    const results = []
    for (const payload of toCreate) {
      try {
        const res = await apiFetch('/plantillas/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          results.push(plantillaFromApi(await res.json()))
        } else {
          console.warn('[seed] Error creando plantilla', payload.name, res.status, await res.text())
        }
      } catch (e) {
        console.warn('[seed] Excepción creando plantilla', payload.name, e)
      }
    }
    return results
  }

  async function initializePlantillas() {
    loading.value = true
    try {
      const res = await apiFetch('/plantillas/')
      if (!res.ok) throw new Error()
      const data = await res.json()
      plantillas.value = data.map(plantillaFromApi)

      if (plantillas.value.length === 0) {
        const seeded = await _seedDefaultsToApi()
        plantillas.value = seeded
      }
    } catch {
      // Si la API falla, trabajar con lista vacía
      plantillas.value = []
    } finally {
      loading.value = false
    }

    if (!selectedPlantillaId.value || !plantillas.value.find(p => p.id === selectedPlantillaId.value)) {
      selectedPlantillaId.value = plantillas.value[0]?.id || null
    }
  }

  const initializePonderations = initializePlantillas

  // ── Export / Import ───────────────────────────────────────────────────────

  function exportPlantillas() {
    const data = plantillas.value.map(p => ({
      name: p.name,
      area: p.area || null,
      items: (p.items || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(i => ({ subject: i.subject, questionCount: i.questionCount, ponderation: i.ponderation, order: i.order })),
    }))
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantillas_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importError = ref('')
  const importLoading = ref(false)

  async function importPlantillas(file) {
    importError.value = ''
    importLoading.value = true
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('El archivo no contiene una lista de plantillas.')

      let created = 0
      for (const p of parsed) {
        if (!p.name) continue
        const payload = {
          name: p.name,
          area: p.area || null,
          convocatoria: activeConvocatoriaId?.value || null,
          items: (p.items || []).map((i, idx) => ({
            subject: i.subject,
            question_count: i.questionCount,
            ponderation: String(i.ponderation),
            order: i.order ?? idx + 1,
          })),
        }
        const res = await apiFetch('/plantillas/', { method: 'POST', body: JSON.stringify(payload) })
        if (res.ok) {
          plantillas.value = [...plantillas.value, plantillaFromApi(await res.json())]
          created++
        }
      }
      if (created === 0) importError.value = 'No se importó ninguna plantilla. Verifica el formato del archivo.'
    } catch (e) {
      importError.value = e.message || 'Error al importar el archivo.'
    } finally {
      importLoading.value = false
    }
  }

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    plantillas,
    loading,
    selectedPlantillaId,
    selectedPlantilla,
    selectedPlantillaItems,
    selectedPlantillaTotal,
    sidebarSections,
    editorError,
    newItem,
    editingItems,
    showNewPlantillaForm,
    newPlantillaName,
    newPlantillaArea,
    getPlantillaById,
    getPlantillasForCalification,
    selectPlantilla,
    createPlantilla,
    deletePlantilla,
    renamePlantilla,
    addItem,
    removeItem,
    toggleEditItem,
    isEditingItem,
    openNewPlantillaForm,
    cancelNewPlantillaForm,
    confirmNewPlantilla,
    initializePlantillas,
    initializePonderations,
    ponderationRows,
    ponderationCurrentTotals: selectedPlantillaTotal,
    exportPlantillas,
    importPlantillas,
    importError,
    importLoading,
  }
}
