import { ref, reactive, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  STORAGE_KEYS,
  DEFAULT_PONDERATIONS,
  DEFAULT_DAT_FORMAT,
  ANSWER_KEY_AREAS,
} from '@/constants'
import { generateId, normalizeArea } from '@/utils/helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Estructura de una plantilla en localStorage:
//   { id, name, area (null=global), convocatoriaId, questionTotal, createdAt, items[] }
//
// Estructura de un item:
//   { id, subject, questionCount, ponderation, order }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composable para gestión de plantillas de ponderación.
 *
 * @param {import('vue').Ref} [areaNames]             - Lista reactiva de áreas disponibles
 * @param {import('vue').Ref} [activeConvocatoriaId]  - ID de la convocatoria activa
 */
export function usePonderations(areaNames, activeConvocatoriaId) {
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )

  // ──────────────────────────────────────────────
  // ESTADO PRINCIPAL
  // ──────────────────────────────────────────────

  const plantillas = useStorage(STORAGE_KEYS.PLANTILLAS, [])
  const selectedPlantillaId = ref(null)
  const editorError = ref('')
  const newItem = reactive({ subject: '', questionCount: 1, ponderation: 1 })
  const editingItems = ref(new Set())

  // Formulario inline "nueva plantilla" del sidebar
  const showNewPlantillaForm = ref(false)
  const newPlantillaName = ref('')
  const newPlantillaArea = ref('')

  // ──────────────────────────────────────────────
  // COMPUTED
  // ──────────────────────────────────────────────

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

  // Secciones del sidebar: áreas específicas primero, "General" (null) al final
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

    // Áreas que no están en el sistema (por si acaso)
    areaMap.forEach((list, key) => {
      if (key !== '__global__' && !effectiveAreaNames.value.includes(key)) {
        sections.push({ area: key, label: key, plantillas: list })
      }
    })

    const globals = areaMap.get('__global__')
    if (globals?.length) sections.push({ area: null, label: 'General', plantillas: globals })

    return sections
  })

  // Compatibilidad con App.vue (getStepStatus/Description del Paso 5)
  const ponderationRows = computed(() =>
    plantillas.value.flatMap(p => p.items || [])
  )

  // ──────────────────────────────────────────────
  // HELPERS INTERNOS
  // ──────────────────────────────────────────────

  function _recalcTotal(plantillaId) {
    plantillas.value = plantillas.value.map(p => {
      if (p.id !== plantillaId) return p
      const total = (p.items || []).reduce((a, i) => a + (Number(i.questionCount) || 0), 0)
      return { ...p, questionTotal: total }
    })
  }

  // ──────────────────────────────────────────────
  // API PÚBLICA — PLANTILLAS
  // ──────────────────────────────────────────────

  function getPlantillaById(id) {
    return plantillas.value.find(p => p.id === id) || null
  }

  /**
   * Plantillas aplicables para calificar un área:
   * las específicas de esa área + las globales (area=null).
   */
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

  function createPlantilla({ name, area = null } = {}) {
    editorError.value = ''
    const trimmed = String(name ?? '').trim()
    if (!trimmed) {
      editorError.value = 'El nombre de la plantilla es requerido.'
      return null
    }
    const id = generateId()
    const plantilla = {
      id,
      name: trimmed,
      area: area || null,
      convocatoriaId: activeConvocatoriaId?.value || null,
      questionTotal: 0,
      createdAt: new Date().toISOString(),
      items: [],
    }
    plantillas.value = [...plantillas.value, plantilla]
    selectPlantilla(id)
    return plantilla
  }

  function deletePlantilla(id) {
    plantillas.value = plantillas.value.filter(p => p.id !== id)
    if (selectedPlantillaId.value === id) {
      selectedPlantillaId.value = plantillas.value[0]?.id || null
    }
  }

  function renamePlantilla(id, name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return
    plantillas.value = plantillas.value.map(p =>
      p.id === id ? { ...p, name: trimmed } : p
    )
  }

  // ──────────────────────────────────────────────
  // API PÚBLICA — ITEMS DE LA PLANTILLA SELECCIONADA
  // ──────────────────────────────────────────────

  function addItem() {
    editorError.value = ''
    if (!selectedPlantilla.value) {
      editorError.value = 'Selecciona una plantilla primero.'
      return
    }

    const subject = String(newItem.subject ?? '').trim()
    const questionCount = Math.max(0, Math.round(Number(newItem.questionCount ?? 0)))
    const ponderation = Number(newItem.ponderation ?? 0)

    if (!subject) { editorError.value = 'Ingresa la asignatura.'; return }
    if (questionCount <= 0) { editorError.value = 'La cantidad de preguntas debe ser mayor a cero.'; return }
    if (!Number.isFinite(ponderation) || ponderation <= 0) {
      editorError.value = 'La ponderación debe ser un número positivo.'
      return
    }

    const id = selectedPlantillaId.value
    const items = selectedPlantilla.value.items || []
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0
    const newItemData = {
      id: generateId(),
      subject,
      questionCount,
      ponderation,
      order: maxOrder + 1,
    }

    plantillas.value = plantillas.value.map(p =>
      p.id === id ? { ...p, items: [...(p.items || []), newItemData] } : p
    )
    _recalcTotal(id)

    newItem.subject = ''
    newItem.questionCount = 1
    newItem.ponderation = 1
  }

  function removeItem(itemId) {
    const id = selectedPlantillaId.value
    if (!id) return
    plantillas.value = plantillas.value.map(p =>
      p.id === id ? { ...p, items: (p.items || []).filter(i => i.id !== itemId) } : p
    )
    _recalcTotal(id)
    const next = new Set(editingItems.value)
    next.delete(itemId)
    editingItems.value = next
  }

  function toggleEditItem(itemId) {
    const next = new Set(editingItems.value)
    if (next.has(itemId)) {
      next.delete(itemId)
      _recalcTotal(selectedPlantillaId.value)
    } else {
      next.add(itemId)
    }
    editingItems.value = next
  }

  function isEditingItem(itemId) {
    return editingItems.value.has(itemId)
  }

  // ──────────────────────────────────────────────
  // FORMULARIO "NUEVA PLANTILLA" EN SIDEBAR
  // ──────────────────────────────────────────────

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

  function confirmNewPlantilla() {
    const created = createPlantilla({
      name: newPlantillaName.value,
      area: newPlantillaArea.value || null,
    })
    if (created) {
      showNewPlantillaForm.value = false
      newPlantillaName.value = ''
      newPlantillaArea.value = ''
    }
  }

  // ──────────────────────────────────────────────
  // INICIALIZACIÓN
  // ──────────────────────────────────────────────

  function _seedDefaultPlantillas() {
    const areas = effectiveAreaNames.value.length > 0 ? effectiveAreaNames.value : ANSWER_KEY_AREAS
    const defaults = []

    areas.forEach(area => {
      const areaItems = DEFAULT_PONDERATIONS
        .filter(d => d.area === area)
        .map(d => ({
          id: generateId(),
          subject: d.subject,
          questionCount: d.questionCount,
          ponderation: d.ponderation,
          order: d.order,
        }))
      if (areaItems.length) {
        defaults.push({
          id: generateId(),
          name: `UNAP — ${area}`,
          area,
          convocatoriaId: activeConvocatoriaId?.value || null,
          questionTotal: areaItems.reduce((a, i) => a + i.questionCount, 0),
          createdAt: new Date().toISOString(),
          items: areaItems,
        })
      }
    })

    // Modo Simple — global (area=null)
    defaults.push({
      id: generateId(),
      name: 'Modo Simple',
      area: null,
      convocatoriaId: null,
      questionTotal: DEFAULT_DAT_FORMAT.answersLength,
      createdAt: new Date().toISOString(),
      items: [{
        id: generateId(),
        subject: 'General',
        questionCount: DEFAULT_DAT_FORMAT.answersLength,
        ponderation: 1,
        order: 1,
      }],
    })

    return defaults
  }

  async function initializePlantillas() {
    if (plantillas.value.length === 0) {
      plantillas.value = _seedDefaultPlantillas()
    }
    if (!selectedPlantillaId.value || !plantillas.value.find(p => p.id === selectedPlantillaId.value)) {
      selectedPlantillaId.value = plantillas.value[0]?.id || null
    }
  }

  // Alias — App.vue llama initializePonderations()
  const initializePonderations = initializePlantillas

  // ──────────────────────────────────────────────
  // RETURN
  // ──────────────────────────────────────────────

  return {
    // State
    plantillas,
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
    // Plantilla CRUD
    getPlantillaById,
    getPlantillasForCalification,
    selectPlantilla,
    createPlantilla,
    deletePlantilla,
    renamePlantilla,
    // Item CRUD
    addItem,
    removeItem,
    toggleEditItem,
    isEditingItem,
    // New plantilla form
    openNewPlantillaForm,
    cancelNewPlantillaForm,
    confirmNewPlantilla,
    // Init
    initializePlantillas,
    initializePonderations,
    // Backwards compat
    ponderationRows,
    ponderationCurrentTotals: selectedPlantillaTotal,
  }
}
