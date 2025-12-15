<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { useStorage } from '@vueuse/core'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Configuración de la API
const API_BASE_URL = 'http://localhost:8000/api'
const ponderationApiLoading = ref(false)
const ponderationApiError = ref('')

const TAB_KEYS = Object.freeze({
  ARCHIVES: 'archives',
  IDENTIFIERS: 'identifiers',
  RESPONSES: 'responses',
  ANSWER_KEYS: 'answer_keys',
  SCORES: 'scores',
})

const tabs = [
  { key: TAB_KEYS.ARCHIVES, label: 'Paso 1 · Padrón Excel' },
  { key: TAB_KEYS.IDENTIFIERS, label: 'Paso 2 · Identificadores (.dat)' },
  { key: TAB_KEYS.RESPONSES, label: 'Paso 3 · Respuestas (.dat)' },
  { key: TAB_KEYS.ANSWER_KEYS, label: 'Paso 4 · Claves de respuestas' },
  { key: TAB_KEYS.SCORES, label: 'Paso 5 · Calificación' },
]

const IDENTIFIER_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

const RESPONSES_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

const ANSWER_KEY_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

const activeTab = useStorage('calificador-active-tab', TAB_KEYS.ARCHIVES)
const identifierSubTab = useStorage('calificador-identificador-subtab', IDENTIFIER_SUBTABS.LIST)
const responsesSubTab = useStorage('calificador-respuestas-subtab', RESPONSES_SUBTABS.LIST)
const answerKeySubTab = useStorage('calificador-claves-subtab', ANSWER_KEY_SUBTABS.LIST)

const ARCHIVE_COLUMNS = [
  { key: 'dni', label: 'DNI', placeholder: '01234567' },
  { key: 'paterno', label: 'Apellido paterno', placeholder: 'Pérez' },
  { key: 'materno', label: 'Apellido materno', placeholder: 'García' },
  { key: 'nombres', label: 'Nombres', placeholder: 'María Fernanda' },
  { key: 'observaciones', label: 'Observaciones', placeholder: 'Sin observaciones' },
  { key: 'area', label: 'Área', placeholder: 'Ingeniería' },
]

const ARCHIVE_KEY_ALIASES = {
  dni: ['dni', 'documento', 'numdoc', 'número de documento'],
  paterno: ['paterno', 'apellido paterno', 'ape_pat'],
  materno: ['materno', 'apellido materno', 'ape_mat'],
  nombres: ['nombres', 'nombre', 'nombres completos'],
  observaciones: ['observaciones', 'observacione', 'obs'],
  area: ['area', 'área', 'especialidad'],
}

ARCHIVE_COLUMNS.forEach(({ key }) => {
  const aliases = ARCHIVE_KEY_ALIASES[key] || []
  ARCHIVE_KEY_ALIASES[key] = Array.from(new Set([key, ...aliases]))
})

const ARCHIVE_STORAGE_KEY = 'calificador-candidatos'
const IDENTIFIER_STORAGE_KEY = 'calificador-identificadores'
const RESPONSES_STORAGE_KEY = 'calificador-respuestas'
const ANSWER_KEYS_STORAGE_KEY = 'calificador-claves'

const RESPONSES_COLUMNS = [
  { key: 'lectura', label: 'N° lectura' },
  { key: 'dni', label: 'DNI' },
  { key: 'tipo', label: 'Tip' },
  { key: 'litho', label: 'Litho' },
  { key: 'answers', label: 'Respuestas' },
  { key: 'observaciones', label: 'Observaciones' },
]

const ANSWER_KEY_COLUMNS = [
  { key: 'area', label: 'Área' },
  { key: 'tipo', label: 'Tip' },
  { key: 'answers', label: 'Respuestas' },
  { key: 'observaciones', label: 'Observaciones' },
]

const ANSWER_KEY_AREAS = ['Biomédicas', 'Sociales', 'Ingeniería']
const ANSWER_KEY_AREA_ALIASES = Object.freeze({
  biomédica: 'Biomédicas',
  biomedica: 'Biomédicas',
  biomedicas: 'Biomédicas',
  socials: 'Sociales',
  social: 'Sociales',
  sociales: 'Sociales',
  ingenieria: 'Ingeniería',
  ingenierías: 'Ingeniería',
  ingenierias: 'Ingeniería',
  ingeniero: 'Ingeniería',
  ingenieros: 'Ingeniería',
})
const PONDERATION_STORAGE_KEY = 'calificador-ponderaciones'
const SCORE_RESULTS_STORAGE_KEY = 'calificador-calificaciones'

const DEFAULT_PONDERATIONS = [
  { area: 'Biomédicas', subject: 'Aritmética', questionCount: 3, ponderation: 3.331, order: 1 },
  { area: 'Biomédicas', subject: 'Álgebra', questionCount: 3, ponderation: 3.202, order: 2 },
  { area: 'Biomédicas', subject: 'Geometría', questionCount: 3, ponderation: 3.301, order: 3 },
  { area: 'Biomédicas', subject: 'Trigonometría', questionCount: 3, ponderation: 3.404, order: 4 },
  { area: 'Biomédicas', subject: 'Física', questionCount: 3, ponderation: 5.505, order: 5 },
  { area: 'Biomédicas', subject: 'Química', questionCount: 5, ponderation: 6.623, order: 6 },
  { area: 'Biomédicas', subject: 'Biología y Anatomía', questionCount: 6, ponderation: 7.816, order: 7 },
  { area: 'Biomédicas', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 4.006, order: 8 },
  { area: 'Biomédicas', subject: 'Geografía', questionCount: 2, ponderation: 2.8, order: 9 },
  { area: 'Biomédicas', subject: 'Historia', questionCount: 2, ponderation: 3.302, order: 10 },
  { area: 'Biomédicas', subject: 'Educación Cívica', questionCount: 2, ponderation: 3.571, order: 11 },
  { area: 'Biomédicas', subject: 'Economía', questionCount: 2, ponderation: 3.406, order: 12 },
  { area: 'Biomédicas', subject: 'Comunicación', questionCount: 4, ponderation: 3.302, order: 13 },
  { area: 'Biomédicas', subject: 'Literatura', questionCount: 2, ponderation: 2.805, order: 14 },
  { area: 'Biomédicas', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.201, order: 15 },
  { area: 'Biomédicas', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.201, order: 16 },
  { area: 'Biomédicas', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Biomédicas', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
  { area: 'Sociales', subject: 'Aritmética', questionCount: 3, ponderation: 3.331, order: 1 },
  { area: 'Sociales', subject: 'Álgebra', questionCount: 3, ponderation: 3.185, order: 2 },
  { area: 'Sociales', subject: 'Geometría', questionCount: 2, ponderation: 3.12, order: 3 },
  { area: 'Sociales', subject: 'Trigonometría', questionCount: 2, ponderation: 3.12, order: 4 },
  { area: 'Sociales', subject: 'Física', questionCount: 2, ponderation: 2.302, order: 5 },
  { area: 'Sociales', subject: 'Química', questionCount: 2, ponderation: 2.404, order: 6 },
  { area: 'Sociales', subject: 'Biología y Anatomía', questionCount: 2, ponderation: 2.504, order: 7 },
  { area: 'Sociales', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 4.807, order: 8 },
  { area: 'Sociales', subject: 'Geografía', questionCount: 4, ponderation: 4.907, order: 9 },
  { area: 'Sociales', subject: 'Historia', questionCount: 4, ponderation: 5.805, order: 10 },
  { area: 'Sociales', subject: 'Educación Cívica', questionCount: 4, ponderation: 6.576, order: 11 },
  { area: 'Sociales', subject: 'Economía', questionCount: 4, ponderation: 4.607, order: 12 },
  { area: 'Sociales', subject: 'Comunicación', questionCount: 4, ponderation: 6.09, order: 13 },
  { area: 'Sociales', subject: 'Literatura', questionCount: 4, ponderation: 4.3, order: 14 },
  { area: 'Sociales', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.203, order: 15 },
  { area: 'Sociales', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.603, order: 16 },
  { area: 'Sociales', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Sociales', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
  { area: 'Ingeniería', subject: 'Aritmética', questionCount: 4, ponderation: 5.201, order: 1 },
  { area: 'Ingeniería', subject: 'Álgebra', questionCount: 4, ponderation: 5.202, order: 2 },
  { area: 'Ingeniería', subject: 'Geometría', questionCount: 4, ponderation: 5.303, order: 3 },
  { area: 'Ingeniería', subject: 'Trigonometría', questionCount: 4, ponderation: 5.404, order: 4 },
  { area: 'Ingeniería', subject: 'Física', questionCount: 4, ponderation: 5.905, order: 5 },
  { area: 'Ingeniería', subject: 'Química', questionCount: 4, ponderation: 5.406, order: 6 },
  { area: 'Ingeniería', subject: 'Biología y Anatomía', questionCount: 2, ponderation: 3.177, order: 7 },
  { area: 'Ingeniería', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 3.802, order: 8 },
  { area: 'Ingeniería', subject: 'Geografía', questionCount: 2, ponderation: 2.576, order: 9 },
  { area: 'Ingeniería', subject: 'Historia', questionCount: 2, ponderation: 3.701, order: 10 },
  { area: 'Ingeniería', subject: 'Educación Cívica', questionCount: 2, ponderation: 3.101, order: 11 },
  { area: 'Ingeniería', subject: 'Economía', questionCount: 2, ponderation: 3.502, order: 12 },
  { area: 'Ingeniería', subject: 'Comunicación', questionCount: 4, ponderation: 3.352, order: 13 },
  { area: 'Ingeniería', subject: 'Literatura', questionCount: 2, ponderation: 2.501, order: 14 },
  { area: 'Ingeniería', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.603, order: 15 },
  { area: 'Ingeniería', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.103, order: 16 },
  { area: 'Ingeniería', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Ingeniería', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
]

const archiveRows = useStorage(ARCHIVE_STORAGE_KEY, [])
archiveRows.value = (archiveRows.value || []).map((row) => createArchiveRow(row))

const identifierRows = useStorage(IDENTIFIER_STORAGE_KEY, [])
identifierRows.value = (identifierRows.value || []).map((row) => createIdentifierRow(row))

const archiveSelection = ref(new Set())
const archiveEditing = ref(new Set())
const archiveSearch = ref('')
const archiveImportError = ref('')
const archiveIsDragging = ref(false)
const archivePendingRow = reactive(createEmptyArchiveRow())
const archiveSelectAllRef = ref(null)

const identifierSelection = ref(new Set())
const identifierEditing = ref(new Set())
const identifierSearch = ref('')
const identifierImportError = ref('')
const identifierIsDragging = ref(false)
const identifierSelectAllRef = ref(null)
const identifierSources = useStorage('calificador-identificador-sources', [])
identifierSources.value = Array.isArray(identifierSources.value) ? identifierSources.value : []
if (!Object.values(IDENTIFIER_SUBTABS).includes(identifierSubTab.value)) {
  identifierSubTab.value = IDENTIFIER_SUBTABS.LIST
}

const responsesRows = useStorage(RESPONSES_STORAGE_KEY, [])
responsesRows.value = (responsesRows.value || []).map((row) => createResponseRow(row))
const responsesSelection = ref(new Set())
const responsesEditing = ref(new Set())
const responsesSearch = ref('')
const responsesImportError = ref('')
const responsesIsDragging = ref(false)
const responsesSelectAllRef = ref(null)
const responsesSources = useStorage('calificador-respuestas-sources', [])
responsesSources.value = Array.isArray(responsesSources.value) ? responsesSources.value : []
if (!Object.values(RESPONSES_SUBTABS).includes(responsesSubTab.value)) {
  responsesSubTab.value = RESPONSES_SUBTABS.LIST
}

const answerKeyRows = useStorage(ANSWER_KEYS_STORAGE_KEY, [])
answerKeyRows.value = (answerKeyRows.value || []).map((row) => createAnswerKeyRow(row))
const answerKeySelection = ref(new Set())
const answerKeyEditing = ref(new Set())
const answerKeySearch = ref('')
const answerKeyImportError = ref('')
const answerKeyArea = ref(ANSWER_KEY_AREAS[0])
const answerKeyIdentificationFile = ref(null)
const answerKeyResponsesFile = ref(null)
const answerKeyIdentificationInputRef = ref(null)
const answerKeyResponsesInputRef = ref(null)
const answerKeySelectAllRef = ref(null)
const answerKeySources = useStorage('calificador-claves-sources', [])
answerKeySources.value = Array.isArray(answerKeySources.value) ? answerKeySources.value : []
if (!Object.values(ANSWER_KEY_SUBTABS).includes(answerKeySubTab.value)) {
  answerKeySubTab.value = ANSWER_KEY_SUBTABS.LIST
}

const ponderationRows = useStorage(PONDERATION_STORAGE_KEY, [])
// Cargar ponderaciones desde la API al iniciar
onMounted(async () => {
  const apiData = await fetchPonderacionesFromAPI()
  if (apiData && apiData.length > 0) {
    // Si hay datos en la API, usarlos y eliminar duplicados por ID
    const uniqueRows = new Map()
    apiData.forEach((row) => {
      const createdRow = createPonderationRow(row)
      const id = createdRow.id
      if (!uniqueRows.has(id)) {
        uniqueRows.set(id, createdRow)
      }
    })
    ponderationRows.value = Array.from(uniqueRows.values())
  } else if (ponderationRows.value.length === 0) {
    // Si no hay datos en API ni en localStorage, usar defaults
    ponderationRows.value = DEFAULT_PONDERATIONS.map((row) => createPonderationRow(row))
    // Guardar defaults en la API
    try {
      await fetch(`${API_BASE_URL}/ponderaciones/bulk_create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          ponderationRows.value.map((row) => ({
            area: row.area,
            subject: row.subject,
            question_count: row.questionCount,
            ponderation: row.ponderation,
            order: row.order,
          }))
        ),
      })
    } catch (error) {
      console.error('Error al guardar defaults en API:', error)
    }
  } else {
    // Usar datos de localStorage como fallback y eliminar duplicados
    const uniqueRows = new Map()
    ponderationRows.value.forEach((row) => {
      const createdRow = createPonderationRow(row)
      const id = createdRow.id
      if (!uniqueRows.has(id)) {
        uniqueRows.set(id, createdRow)
      }
    })
    ponderationRows.value = Array.from(uniqueRows.values())
  }
  // Solo inicializar orders si no existen, sin reordenar
  ponderationRows.value.forEach((row) => {
    if (!row.order || row.order === 0) {
      const areaRows = ponderationRows.value.filter((r) => r.area === row.area && r.order > 0)
      const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order)) : 0
      row.order = maxOrder + 1
    }
  })
  ensureDefaultPonderations()
})
const ponderationEditing = ref(new Set())
const ponderationModalArea = ref(ANSWER_KEY_AREAS[0])
const newPonderation = reactive({ subject: '', questionCount: 1, ponderation: 1 })
const ponderationError = ref('')

const showCalificationModal = ref(false)
const calificationModalTab = ref('calificar') // 'ponderaciones' o 'calificar'
const calificationArea = ref(ANSWER_KEY_AREAS[0])
const calificationPonderationArea = ref(ANSWER_KEY_AREAS[0])
const calificationCorrectValue = ref(10)
const calificationIncorrectValue = ref(0)
const calificationBlankValue = ref(2)
const calificationError = ref('')
const scoreStorage = useStorage(SCORE_RESULTS_STORAGE_KEY, { summary: null, rows: [] })
const calificationResults = ref(Array.isArray(scoreStorage.value?.rows) ? scoreStorage.value.rows : [])
const calificationSummary = ref(scoreStorage.value?.summary || null)

watch(
  [calificationResults, calificationSummary],
  () => {
    scoreStorage.value = {
      rows: calificationResults.value,
      summary: calificationSummary.value,
    }
  },
  { deep: true },
)


const archiveHasData = computed(() => archiveRows.value.length > 0)
const archiveTotalRows = computed(() => archiveRows.value.length)
const archiveTotalSelected = computed(() => archiveSelection.value.size)
const archiveFilteredRows = computed(() => filterArchiveRows())
const archiveVisibleIds = computed(() => archiveFilteredRows.value.map((row) => row.id))
const archiveIsAllVisibleSelected = computed(
  () =>
    archiveVisibleIds.value.length > 0 &&
    archiveVisibleIds.value.every((id) => archiveSelection.value.has(id)),
)
const archiveIsSomeVisibleSelected = computed(
  () =>
    !archiveIsAllVisibleSelected.value &&
    archiveVisibleIds.value.some((id) => archiveSelection.value.has(id)),
)
const archiveTotalFiltered = computed(() => archiveFilteredRows.value.length)

const identifierHasData = computed(() => identifierRows.value.length > 0)
const identifierTotalRows = computed(() => identifierRows.value.length)
const identifierTotalSelected = computed(() => identifierSelection.value.size)
const identifierFilteredRows = computed(() => filterIdentifierRows())
const identifierVisibleIds = computed(() => identifierFilteredRows.value.map((row) => row.id))
const identifierIsAllVisibleSelected = computed(
  () =>
    identifierVisibleIds.value.length > 0 &&
    identifierVisibleIds.value.every((id) => identifierSelection.value.has(id)),
)
const identifierIsSomeVisibleSelected = computed(
  () =>
    !identifierIsAllVisibleSelected.value &&
    identifierVisibleIds.value.some((id) => identifierSelection.value.has(id)),
)
const identifierTotalFiltered = computed(() => identifierFilteredRows.value.length)
const identifierObservations = computed(() =>
  identifierRows.value.filter((row) => row.observaciones && row.observaciones !== 'Sin observaciones'),
)
const identifierObservationCount = computed(() => identifierObservations.value.length)

const responsesHasData = computed(() => responsesRows.value.length > 0)
const responsesTotalRows = computed(() => responsesRows.value.length)
const responsesTotalSelected = computed(() => responsesSelection.value.size)
const responsesFilteredRows = computed(() => filterResponseRows())
const responsesVisibleIds = computed(() => responsesFilteredRows.value.map((row) => row.id))
const responsesIsAllVisibleSelected = computed(
  () =>
    responsesVisibleIds.value.length > 0 &&
    responsesVisibleIds.value.every((id) => responsesSelection.value.has(id)),
)
const responsesIsSomeVisibleSelected = computed(
  () =>
    !responsesIsAllVisibleSelected.value &&
    responsesVisibleIds.value.some((id) => responsesSelection.value.has(id)),
)
const responsesSourcesCount = computed(() => responsesSources.value.length)
const responsesObservations = computed(() =>
  responsesRows.value.filter((row) => row.observaciones && row.observaciones !== 'Sin observaciones'),
)
const responsesObservationCount = computed(() => responsesObservations.value.length)

const answerKeyHasData = computed(() => answerKeyRows.value.length > 0)
const answerKeyTotalRows = computed(() => answerKeyRows.value.length)
const answerKeyTotalSelected = computed(() => answerKeySelection.value.size)
const answerKeyFilteredRows = computed(() => filterAnswerKeyRows())
const answerKeyVisibleIds = computed(() => answerKeyFilteredRows.value.map((row) => row.id))
const answerKeyIsAllVisibleSelected = computed(
  () =>
    answerKeyVisibleIds.value.length > 0 &&
    answerKeyVisibleIds.value.every((id) => answerKeySelection.value.has(id)),
)
const answerKeyIsSomeVisibleSelected = computed(
  () =>
    !answerKeyIsAllVisibleSelected.value &&
    answerKeyVisibleIds.value.some((id) => answerKeySelection.value.has(id)),
)
const answerKeySourcesCount = computed(() => answerKeySources.value.length)
const answerKeyAreaOptions = computed(() => {
  const archiveAreas = archiveRows.value
    .map((row) => normalizeArea(row.area))
    .filter((area) => ANSWER_KEY_AREAS.includes(area))
  const unique = new Set([...ANSWER_KEY_AREAS, ...archiveAreas])
  return ANSWER_KEY_AREAS.filter((area) => unique.has(area))
})

const answerKeyObservations = computed(() =>
  answerKeyRows.value.filter((row) => row.observaciones && row.observaciones !== 'Sin observaciones'),
)
const ponderationAreaList = computed(() => {
  const areas = new Set(ANSWER_KEY_AREAS)
  ponderationRows.value.forEach((row) => areas.add(normalizeArea(row.area)))
  return Array.from(areas)
})

const ponderationEntriesByArea = computed(() => {
  const map = new Map()
  DEFAULT_PONDERATIONS.forEach((row) => {
    const area = normalizeArea(row.area)
    if (!map.has(area)) {
      map.set(area, [])
    }
    const list = map.get(area)
    if (!list.some((item) => normalize(item.subject) === normalize(row.subject))) {
      list.push(createPonderationRow(row))
    }
  })

  ponderationRows.value.forEach((row) => {
    const area = normalizeArea(row.area)
    if (!map.has(area)) {
      map.set(area, [])
    }
    const list = map.get(area)
    const existingIndex = list.findIndex((item) => normalize(item.subject) === normalize(row.subject))
    if (existingIndex >= 0) {
      list[existingIndex] = createPonderationRow({
        ...list[existingIndex],
        ...row,
      })
    } else {
      list.push(createPonderationRow(row))
    }
  })

  map.forEach((list, area) => {
    list.sort((a, b) => {
      if (a.order === b.order) {
        return normalize(a.subject).localeCompare(normalize(b.subject))
      }
      return a.order - b.order
    })
    // NO reasignar order automáticamente - mantener el order manual
  })

  return map
})

const ponderationCurrentAreaRows = computed(() => {
  return ponderationEntriesByArea.value.get(ponderationModalArea.value) || []
})

const ponderationPlanByArea = computed(() => {
  const planMap = new Map()
  ponderationEntriesByArea.value.forEach((rows, area) => {
    planMap.set(area, buildQuestionPlan(rows))
  })
  return planMap
})

const ponderationTotalsByArea = computed(() => {
  const totals = new Map()
  ponderationPlanByArea.value.forEach((plan, area) => {
    totals.set(area, {
      questions: plan.length,
      weight: plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0),
    })
  })
  return totals
})

const ponderationCurrentTotals = computed(() => {
  const entry = ponderationTotalsByArea.value.get(ponderationModalArea.value)
  return {
    questions: entry?.questions ?? 0,
    weight: entry?.weight ?? 0,
  }
})

// Slider eliminado - ahora mostramos todos los cursos en una lista

const selectedPonderationTotals = computed(() => {
  const area = normalizeArea(calificationPonderationArea.value)
  const entry = ponderationTotalsByArea.value.get(area)
  return {
    questions: entry?.questions ?? 0,
    weight: entry?.weight ?? 0,
  }
})

const selectedPonderationPlan = computed(() => {
  const area = normalizeArea(calificationPonderationArea.value)
  return ponderationPlanByArea.value.get(area) || []
})

const calificationAreaOptions = computed(() => ponderationAreaList.value)
const calificationHasResults = computed(() => calificationResults.value.length > 0)
const selectedPonderationIsReady = computed(() => selectedPonderationTotals.value.questions === 60)
const canCalify = computed(() =>
  responsesRows.value.length > 0 &&
  answerKeyRows.value.length > 0 &&
  ponderationRows.value.length > 0 &&
  selectedPonderationIsReady.value,
)

const answerKeyLookupByMatch = computed(() => {
  const map = new Map()
  answerKeyRows.value.forEach((row) => {
    map.set(buildResponseMatchKey(row), row)
  })
  return map
})

const answerKeyLookupByAreaTipo = computed(() => {
  const map = new Map()
  answerKeyRows.value.forEach((row) => {
    const key = buildAreaTipoKey(row.area, row.tipo)
    if (!key) return
    map.set(key, row)
  })
  return map
})

const responsesByDni = computed(() => {
  const map = new Map()
  responsesRows.value.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    if (!map.has(dni)) {
      map.set(dni, [])
    }
    map.get(dni).push(row)
  })
  return map
})

const archiveByDni = computed(() => {
  const map = new Map()
  archiveRows.value.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    map.set(dni, row)
  })
  return map
})

const answerKeyObservationCount = computed(() => answerKeyObservations.value.length)

const identifierLookup = computed(() => {
  const map = new Map()
  identifierRows.value.forEach((row) => {
    const key = buildResponseMatchKey(row)
    map.set(key, row)
  })
  return map
})

const identifierLookupByLitho = computed(() => {
  const map = new Map()
  identifierRows.value.forEach((row) => {
    const litho = stripDigits(row.litho)
    if (litho && !map.has(litho)) {
      map.set(litho, row)
    }
  })
  return map
})
watch([archiveIsAllVisibleSelected, archiveIsSomeVisibleSelected], ([all, some]) => {
  if (archiveSelectAllRef.value) {
    archiveSelectAllRef.value.indeterminate = some && !all
  }
})

watch(
  [identifierIsAllVisibleSelected, identifierIsSomeVisibleSelected],
  ([all, some]) => {
    if (identifierSelectAllRef.value) {
      identifierSelectAllRef.value.indeterminate = some && !all
    }
  }
)

watch(
  [responsesIsAllVisibleSelected, responsesIsSomeVisibleSelected],
  ([all, some]) => {
    if (responsesSelectAllRef.value) {
      responsesSelectAllRef.value.indeterminate = some && !all
    }
  }
)

watch(
  [answerKeyIsAllVisibleSelected, answerKeyIsSomeVisibleSelected],
  ([all, some]) => {
    if (answerKeySelectAllRef.value) {
      answerKeySelectAllRef.value.indeterminate = some && !all
    }
  }
)

watch(
  ponderationRows,
  (rows) => {
    rows.forEach((row) => {
      row.area = normalizeArea(row.area)
      row.subject = String(row.subject ?? '').trim()
      row.questionCount = Math.max(0, Math.round(Number(row.questionCount ?? 0)))
      row.ponderation = Number(row.ponderation ?? 0) || 0
      row.order = Math.max(0, Math.round(Number(row.order ?? 0)))
    })
  },
  { deep: true }
)

watch(ponderationModalArea, () => {
  resetNewPonderation()
  ponderationError.value = ''
  ponderationEditing.value = new Set()
})

watch(
  answerKeyRows,
  (rows) => {
    rows.forEach((row) => {
      if (!row.id) {
        row.id = generateId()
      }
      const normalizedArea = normalizeArea(row.area)
      if (row.area !== normalizedArea) {
        row.area = normalizedArea
      }
      row.tipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
      row.litho = stripDigits(row.litho || '')
      row.answers = String(row.answers || '').toUpperCase()
      row.indicator = (row.indicator || '').trim()
      row.folio = (row.folio || '').trim()

      const observation = buildAnswerKeyObservation(row)
      if (row.observaciones !== observation) {
        row.observaciones = observation
      }
    })
  },
  { deep: true }
)

watch(answerKeyArea, (value) => {
  const normalized = normalizeArea(value)
  if (answerKeyArea.value !== normalized) {
    answerKeyArea.value = normalized
  }
})

watch(
  answerKeyAreaOptions,
  (options) => {
    if (!options.includes(answerKeyArea.value)) {
      answerKeyArea.value = options[0] ?? ANSWER_KEY_AREAS[0]
    }
  },
  { immediate: true },
)

watch(calificationArea, (value) => {
  const normalized = normalizeArea(value)
  if (calificationArea.value !== normalized) {
    calificationArea.value = normalized
  }
  if (!ponderationEntriesByArea.value.has(calificationPonderationArea.value)) {
    calificationPonderationArea.value = normalized
  }
})

watch(
  identifierRows,
  (rows) => {
    rows.forEach((row) => {
      const sanitizedTipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
      if (row.tipo !== sanitizedTipo) {
        row.tipo = sanitizedTipo
      }

      const sanitizedDni = stripDigits(row.dni)
      if (row.dni !== sanitizedDni) {
        row.dni = sanitizedDni
      }

      const sanitizedAula = stripDigits(row.aula)
      if (row.aula !== sanitizedAula) {
        row.aula = sanitizedAula
      }

      const sanitizedLitho = stripDigits(row.litho)
      if (row.litho !== sanitizedLitho) {
        row.litho = sanitizedLitho
      }

      const obs = buildIdentifierObservation(row)
      if (row.observaciones !== obs) {
        row.observaciones = obs
      }
    })

    responsesRows.value.forEach((row) => {
      applyIdentifierDataToResponseRow(row)
    })
  },
  { deep: true }
)

watch(
  responsesRows,
  (rows) => {
    const lookup = identifierLookup.value
    rows.forEach((row) => {
      const sanitizedIndicator = (row.indicator || '').trim().toUpperCase().slice(0, 1)
      if (row.indicator !== sanitizedIndicator) {
        row.indicator = sanitizedIndicator
      }

      const sanitizedFolio = String(row.folio || '').trim()
      if (row.folio !== sanitizedFolio) {
        row.folio = sanitizedFolio
      }

      const sanitizedLitho = stripDigits(row.litho)
      if (row.litho !== sanitizedLitho) {
        row.litho = sanitizedLitho
      }

      row.answers = String(row.answers ?? '').toUpperCase()

      applyIdentifierDataToResponseRow(row, lookup)
    })
  },
  { deep: true }
)

function removeDiacritics(value) {
  return Array.from(String(value ?? '').normalize('NFD'))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < 0x300 || code > 0x036f
    })
    .join('')
}

function stripDigits(value) {
  const digits = String(value ?? '').match(/\d/g)
  return digits ? digits.join('') : ''
}

function removeWhitespace(value) {
  return Array.from(String(value ?? '')).filter((char) => !/\s/.test(char)).join('')
}

function normalizeArea(value) {
  const raw = String(value ?? '')
  const trimmedOriginal = raw.trim()
  if (!trimmedOriginal) {
    return ANSWER_KEY_AREAS[0]
  }

  const exactMatch = ANSWER_KEY_AREAS.find((area) => area === trimmedOriginal)
  if (exactMatch) {
    return exactMatch
  }

  const normalized = removeDiacritics(trimmedOriginal).toLowerCase()
  const aliasMatch = ANSWER_KEY_AREA_ALIASES[normalized]
  if (aliasMatch) {
    return aliasMatch
  }

  const matched = ANSWER_KEY_AREAS.find(
    (area) => removeDiacritics(area).trim().toLowerCase() === normalized,
  )
  return matched ?? ANSWER_KEY_AREAS[0]
}

function normalize(value) {
  return removeDiacritics(value).toLowerCase().trim()
}

function generateId() {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
  return crypto.randomUUID()
}

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function createArchiveRow(data = {}) {
  const normalized = ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    const raw = data[key]
    if (typeof raw === 'string') {
      acc[key] = raw
    } else if (raw === undefined || raw === null) {
      acc[key] = ''
    } else {
      acc[key] = String(raw)
    }
    return acc
  }, {})

  return {
    id: data.id ?? generateId(),
    ...normalized,
  }
}

function createEmptyArchiveRow() {
  return ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    acc[key] = ''
    return acc
  }, {})
}

function filterArchiveRows() {
  if (archiveSearch.value) {
    const needle = normalize(archiveSearch.value)
    return archiveRows.value.filter((row) =>
      ARCHIVE_COLUMNS.some(({ key }) => normalize(row[key]).includes(needle)),
    )
  }

  return archiveRows.value
}

function toggleArchiveSelection(id) {
  const next = new Set(archiveSelection.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  archiveSelection.value = next
}

function clearArchiveSelection() {
  archiveSelection.value = new Set()
}

function toggleArchiveEdit(id) {
  const next = new Set(archiveEditing.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  archiveEditing.value = next
}

function clearArchiveEditing() {
  archiveEditing.value = new Set()
}

function isArchiveEditing(id) {
  return archiveEditing.value.has(id)
}

function removeSelectedArchives() {
  if (!archiveSelection.value.size) return

  const toRemove = new Set(archiveSelection.value)
  archiveRows.value = archiveRows.value.filter((row) => !toRemove.has(row.id))
  archiveEditing.value = new Set(
    Array.from(archiveEditing.value).filter((id) => !toRemove.has(id)),
  )
  clearArchiveSelection()
}

function removeArchiveRow(id) {
  archiveRows.value = archiveRows.value.filter((row) => row.id !== id)
  const nextSelection = new Set(archiveSelection.value)
  nextSelection.delete(id)
  archiveSelection.value = nextSelection

  const nextEditing = new Set(archiveEditing.value)
  nextEditing.delete(id)
  archiveEditing.value = nextEditing
}

function addArchiveRow() {
  const empty = ARCHIVE_COLUMNS.every(({ key }) => !archivePendingRow[key].trim())
  if (empty) return

  const nextRow = createArchiveRow(
    ARCHIVE_COLUMNS.reduce((acc, { key }) => {
      acc[key] = archivePendingRow[key].trim()
      return acc
    }, {}),
  )

  archiveRows.value = [...archiveRows.value, nextRow]
  resetArchivePendingRow()
  toggleArchiveEdit(nextRow.id)
}

function resetArchivePendingRow() {
  Object.assign(archivePendingRow, createEmptyArchiveRow())
}

function clearAllArchives() {
  archiveRows.value = []
  clearArchiveSelection()
  clearArchiveEditing()
}

async function readArchiveWorkbook(file) {
  archiveImportError.value = ''
  try {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      archiveImportError.value = 'No se encontró ninguna hoja en el archivo.'
      return
    }

    const headers = []
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim()
    })

    if (!headers.some((header) => header.length)) {
      archiveImportError.value = 'No se identificaron encabezados en la primera fila.'
      return
    }

    const rawRows = []
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber === 1) return

      const record = {}
      headers.forEach((header, index) => {
        if (!header) return
        const cell = row.getCell(index + 1)
        const value = cell?.text ?? ''
        record[header] = value.trim()
      })

      if (Object.values(record).some((value) => value.length)) {
        rawRows.push(record)
      }
    })

    if (!rawRows.length) {
      archiveImportError.value = 'La hoja no contiene registros.'
      return
    }

    const mapped = rawRows.map(mapArchiveRowToSchema).filter(Boolean)
    if (!mapped.length) {
      archiveImportError.value =
        'No se pudieron mapear columnas válidas. Verifica los encabezados del archivo.'
      return
    }

    archiveRows.value = mapped
    clearArchiveSelection()
    clearArchiveEditing()
  } catch (error) {
    console.error(error)
    archiveImportError.value =
      'Ocurrió un problema al procesar el archivo. Asegúrate de que sea un Excel (.xlsx) válido.'
  }
}

function mapArchiveRowToSchema(row) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalize(key),
    String(value ?? '').trim(),
  ])

  const lookup = new Map(normalizedEntries)

  const mappedRow = ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    const aliases = ARCHIVE_KEY_ALIASES[key] || []
    const match = aliases.find((alias) => lookup.has(normalize(alias)))
    acc[key] = match ? lookup.get(normalize(match)) : ''
    return acc
  }, {})

  const hasContent = Object.values(mappedRow).some(Boolean)
  return hasContent ? createArchiveRow(mappedRow) : null
}

async function exportArchiveToExcel() {
  if (!archiveRows.value.length) return
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Postulantes')
  worksheet.columns = ARCHIVE_COLUMNS.map(({ key, label }) => ({
    header: label,
    key,
  }))

  archiveRows.value.forEach(({ id, ...rest }) => {
    worksheet.addRow(rest)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, 'postulantes.xlsx')
}

function toggleArchiveSelectAll(checked) {
  const next = new Set(archiveSelection.value)
  const visibleSet = new Set(archiveVisibleIds.value)

  if (checked) {
    archiveVisibleIds.value.forEach((id) => next.add(id))
  } else {
    visibleSet.forEach((id) => next.delete(id))
  }

  archiveSelection.value = next
}

function onArchiveDragOver(event) {
  event.preventDefault()
  archiveIsDragging.value = true
}

function onArchiveDragLeave(event) {
  event.preventDefault()
  archiveIsDragging.value = false
}

async function onArchiveDrop(event) {
  event.preventDefault()
  archiveIsDragging.value = false
  const file = Array.from(event.dataTransfer?.files || []).find(
    (item) => item && item.name && item.name.toLowerCase().endsWith('.xlsx'),
  )
  if (!file) return
  await readArchiveWorkbook(file)
}

async function onArchiveFileChange(event) {
  const [file] = Array.from(event.target.files || [])
  if (!file) return
  await readArchiveWorkbook(file)
  event.target.value = ''
}

function createIdentifierRow(data = {}) {
  return {
    id: data.id ?? generateId(),
    rawLine: data.rawLine ?? '',
    header: data.header ?? '',
    lectura: data.lectura ?? '',
    examCode: data.examCode ?? '',
    folio: data.folio ?? '',
    indicator: data.indicator ?? '',
    litho: data.litho ?? '',
    tipo: data.tipo ?? '',
    dni: data.dni ?? '',
    aula: data.aula ?? '',
    answers: data.answers ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }
}

function identifierKey(row) {
  return `${row.header}-${row.folio ?? ''}-${row.indicator ?? ''}`
}

function buildIdentifierObservation(row) {
  const issues = []

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo sin marcar')
  }

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI sin marcar')
  } else if (dniDigits.length !== 8) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const aulaDigits = stripDigits(row.aula)
  if (!aulaDigits) {
    issues.push('Aula sin marcar')
  } else if (aulaDigits.length !== 3) {
    issues.push(`Aula incompleta (${aulaDigits})`)
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

function createResponseRow(data = {}) {
  return {
    id: data.id ?? generateId(),
    header: data.header ?? '',
    lectura: data.lectura ?? '',
    examCode: data.examCode ?? '',
    folio: data.folio ?? '',
    indicator: data.indicator ?? '',
    litho: data.litho ?? '',
    tipo: data.tipo ?? '',
    dni: data.dni ?? '',
    answers: data.answers ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }
}

function createAnswerKeyRow(data = {}) {
  const row = {
    id: data.id ?? generateId(),
    area: normalizeArea(data.area),
    tipo: data.tipo ?? '',
    answers: data.answers ?? '',
    indicator: data.indicator ?? '',
    folio: data.folio ?? '',
    litho: data.litho ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }

  row.observaciones = buildAnswerKeyObservation(row)
  return row
}

// Funciones de API para ponderaciones
async function fetchPonderacionesFromAPI() {
  try {
    ponderationApiLoading.value = true
    ponderationApiError.value = ''
    const response = await fetch(`${API_BASE_URL}/ponderaciones/`)
    if (!response.ok) {
      throw new Error(`Error al cargar ponderaciones: ${response.statusText}`)
    }
    const data = await response.json()
    return data.map((item) => ({
      id: buildPonderationKey(item.area, item.subject),
      area: item.area,
      subject: item.subject,
      questionCount: item.question_count,
      ponderation: Number(item.ponderation),
      order: item.order,
    }))
  } catch (error) {
    console.error('Error al cargar ponderaciones desde API:', error)
    ponderationApiError.value = error.message
    return null
  } finally {
    ponderationApiLoading.value = false
  }
}

async function savePonderationToAPI(row) {
  try {
    const area = normalizeArea(row.area)
    const subject = String(row.subject ?? '').trim()
    const payload = {
      area,
      subject,
      question_count: Math.max(0, Math.round(Number(row.questionCount ?? 0))),
      ponderation: Number(row.ponderation ?? 0) || 0,
      order: Math.max(1, Math.round(Number(row.order ?? 1))),
    }

    // Verificar si existe
    const checkResponse = await fetch(
      `${API_BASE_URL}/ponderaciones/?area=${encodeURIComponent(area)}`
    )
    if (checkResponse.ok) {
      const existing = await checkResponse.json()
      const found = existing.find(
        (item) => normalize(item.subject) === normalize(subject)
      )

      let response
      if (found) {
        // Actualizar
        response = await fetch(`${API_BASE_URL}/ponderaciones/${found.id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      } else {
        // Crear
        response = await fetch(`${API_BASE_URL}/ponderaciones/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        throw new Error(`Error al guardar ponderación: ${response.statusText}`)
      }
      return await response.json()
    }
  } catch (error) {
    console.error('Error al guardar ponderación en API:', error)
    ponderationApiError.value = error.message
    throw error
  }
}

async function deletePonderationFromAPI(row) {
  try {
    const area = normalizeArea(row.area)
    const subject = String(row.subject ?? '').trim()

    // Buscar el ID en la API
    const response = await fetch(
      `${API_BASE_URL}/ponderaciones/?area=${encodeURIComponent(area)}`
    )
    if (!response.ok) {
      throw new Error(`Error al buscar ponderación: ${response.statusText}`)
    }
    const data = await response.json()
    const found = data.find((item) => normalize(item.subject) === normalize(subject))

    if (found) {
      const deleteResponse = await fetch(
        `${API_BASE_URL}/ponderaciones/${found.id}/`,
        {
          method: 'DELETE',
        }
      )
      if (!deleteResponse.ok) {
        throw new Error(`Error al eliminar ponderación: ${deleteResponse.statusText}`)
      }
      return true
    }
    return false
  } catch (error) {
    console.error('Error al eliminar ponderación de API:', error)
    ponderationApiError.value = error.message
    throw error
  }
}

function buildPonderationKey(area, subject) {
  return `${normalizeArea(area)}|${normalize(subject)}`
}

function createPonderationRow(data = {}) {
  const area = normalizeArea(data.area)
  const subject = String(data.subject ?? '').trim()
  const questionCount = Math.max(0, Math.round(Number(data.questionCount ?? 0)))
  const ponderation = Number(data.ponderation ?? 0) || 0
  const order = Math.max(0, Math.round(Number(data.order ?? 0)))
  const id = data.id ?? buildPonderationKey(area, subject)

  return {
    id,
    area,
    subject,
    questionCount,
    ponderation,
    order,
  }
}

function reindexPonderationOrders() {
  // Esta función ya no reordena automáticamente
  // Solo se usa para inicializar orders si no existen
  ponderationRows.value.forEach((row) => {
    if (!row.order || row.order === 0) {
      const areaRows = ponderationRows.value.filter((r) => r.area === row.area)
      const maxOrder = Math.max(...areaRows.map((r) => r.order || 0), 0)
      row.order = maxOrder + 1
    }
  })
}

// Función de mover eliminada - el orden se mantiene manualmente según el order asignado

function ensureDefaultPonderations() {
  let changed = false
  DEFAULT_PONDERATIONS.forEach((entry) => {
    const area = normalizeArea(entry.area)
    const subjectKey = normalize(entry.subject)
    const exists = ponderationRows.value.some(
      (row) => normalizeArea(row.area) === area && normalize(row.subject) === subjectKey,
    )
    if (!exists) {
      ponderationRows.value.push(
        createPonderationRow({
          ...entry,
          area,
        }),
      )
      changed = true
    }
  })

  if (changed) {
    // Solo asignar order inicial si no existe, sin reordenar los existentes
    ponderationRows.value.forEach((row) => {
      if (!row.order || row.order === 0) {
        const areaRows = ponderationRows.value.filter((r) => r.area === row.area && r.order > 0)
        const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order)) : 0
        row.order = maxOrder + 1
      }
    })
  }
}

function resetNewPonderation() {
  newPonderation.subject = ''
  newPonderation.questionCount = 1
  newPonderation.ponderation = 1
}

function isPonderationEditing(id) {
  return ponderationEditing.value.has(id)
}

async function togglePonderationEditRow(row) {
  const next = new Set(ponderationEditing.value)
  if (next.has(row.id)) {
    next.delete(row.id)
    await upsertPonderationOverride(row)
  } else {
    next.add(row.id)
  }
  ponderationEditing.value = next
}

async function removePonderationRow(row) {
  // Usar el ID directamente para evitar duplicados
  const rowId = row.id || buildPonderationKey(row.area, row.subject)
  
  try {
    await deletePonderationFromAPI(row)
  } catch (error) {
    console.error('Error al eliminar de API, continuando con eliminación local:', error)
  }
  
  // Filtrar usando el ID para evitar problemas con duplicados
  // Usar splice para actualizar reactivamente
  const index = ponderationRows.value.findIndex((item) => {
    const itemId = item.id || buildPonderationKey(item.area, item.subject)
    return itemId === rowId
  })
  
  if (index !== -1) {
    ponderationRows.value.splice(index, 1)
  }
  
  // NO reindexar - mantener el orden de los demás
}

async function addPonderationRow() {
  ponderationError.value = ''
  const subject = String(newPonderation.subject ?? '').trim()
  const questionCount = Math.max(0, Math.round(Number(newPonderation.questionCount ?? 0)))
  const ponderation = Number(newPonderation.ponderation ?? 0)

  if (!subject) {
    ponderationError.value = 'Ingresa la asignatura.'
    return
  }

  if (!Number.isFinite(questionCount) || questionCount <= 0) {
    ponderationError.value = 'La cantidad de preguntas debe ser mayor a cero.'
    return
  }

  if (!Number.isFinite(ponderation) || ponderation <= 0) {
    ponderationError.value = 'La ponderación debe ser un número positivo.'
    return
  }

  const area = ponderationModalArea.value
  // Asignar el siguiente order disponible en el área
  const areaRows = ponderationRows.value.filter((r) => normalizeArea(r.area) === normalizeArea(area))
  const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order || 0)) : 0
  const row = createPonderationRow({
    area,
    subject,
    questionCount,
    ponderation,
    order: maxOrder + 1,
  })

  await upsertPonderationOverride(row)
  resetNewPonderation()
}

async function upsertPonderationOverride(row) {
  const area = normalizeArea(row.area)
  const subject = String(row.subject ?? '').trim()
  const key = buildPonderationKey(area, subject)
  const questionCount = Math.max(0, Math.round(Number(row.questionCount ?? 0)))
  const ponderation = Number(row.ponderation ?? 0) || 0
  const order = Math.max(1, Math.round(Number(row.order ?? 1)))

  const defaultEntry = DEFAULT_PONDERATIONS.find(
    (entry) => buildPonderationKey(entry.area, entry.subject) === key,
  )

  const matchesDefault =
    defaultEntry &&
    Math.round(Number(defaultEntry.questionCount ?? 0)) === questionCount &&
    Number(defaultEntry.ponderation ?? 0) === ponderation

  // Guardar en la API
  try {
    await savePonderationToAPI(row)
  } catch (error) {
    console.error('Error al guardar en API, continuando con guardado local:', error)
  }

  // Usar el ID para filtrar y evitar duplicados
  const rowId = row.id || key
  const nextRows = ponderationRows.value.filter((item) => {
    const itemId = item.id || buildPonderationKey(item.area, item.subject)
    return itemId !== rowId
  })

  if (!matchesDefault) {
    nextRows.push(
      createPonderationRow({
        id: key,
        area,
        subject,
        questionCount,
        ponderation,
        order,
      }),
    )
  }

  ponderationRows.value = nextRows
  // NO reindexar - mantener el orden manual
}

function openCalificationModal(tab = 'calificar') {
  if (tab === 'calificar') {
    if (!canCalify.value) {
      calificationError.value = 'Necesitas cargar respuestas, claves y ponderaciones antes de calificar.'
      return
    }

    const areas = calificationAreaOptions.value
    const readyAreas = areas.filter((areaOption) => {
      const entry = ponderationTotalsByArea.value.get(areaOption)
      return entry?.questions === 60
    })

    if (!readyAreas.length) {
      calificationError.value = 'Completa las 60 preguntas para el área antes de calificar.'
      return
    }

    const preferredArea =
      calificationArea.value && readyAreas.includes(calificationArea.value)
        ? calificationArea.value
        : readyAreas[0]
    calificationArea.value = preferredArea
    calificationPonderationArea.value = readyAreas.includes(calificationPonderationArea.value)
      ? calificationPonderationArea.value
      : preferredArea
    calificationCorrectValue.value = 10
    calificationIncorrectValue.value = 0
    calificationBlankValue.value = 2
    calificationError.value = ''
  } else {
    calificationError.value = ''
  }
  
  calificationModalTab.value = tab
  showCalificationModal.value = true
}

function closeCalificationModal() {
  showCalificationModal.value = false
}

function resetCalificationResults() {
  calificationResults.value = []
  calificationSummary.value = null
}

function classifyAnswerChar(answerChar) {
  // Manejar casos de espacios, vacíos, null, undefined
  if (!answerChar || answerChar === ' ' || answerChar === '\t' || answerChar === '\n' || answerChar === '\r') {
    return 'blank'
  }
  
  const value = String(answerChar).trim().toUpperCase()
  
  if (!value || value === '') {
    return 'blank'
  }
  
  if (value === '*') {
    return 'blank'
  }
  
  // Solo A-E son opciones válidas
  if (/^[A-E]$/.test(value)) {
    return 'option'
  }
  
  // Cualquier otro carácter se trata como blanco
  return 'blank'
}

function buildQuestionPlan(entries) {
  const plan = []
  entries.forEach((entry) => {
    const count = Math.max(0, Math.round(Number(entry.questionCount) || 0))
    const weight = Number(entry.ponderation) || 0
    const subject = entry.subject || ''

    for (let index = 0; index < count; index += 1) {
      plan.push({
        subject,
        weight,
      })
    }
  })
  return plan
}

function runCalification() {
  calificationError.value = ''
  const area = normalizeArea(calificationArea.value)
  const ponderationArea = normalizeArea(calificationPonderationArea.value)
  const entries = ponderationEntriesByArea.value.get(ponderationArea) || []

  if (!entries.length) {
    calificationError.value = 'No hay ponderaciones registradas para el área seleccionada.'
    return
  }

  const plan = buildQuestionPlan(entries)
  if (plan.length !== 60) {
    calificationError.value = `Las ponderaciones seleccionadas cubren ${plan.length} preguntas. Deben sumar 60.`
    return
  }

  const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)

  const correctValue = Number(calificationCorrectValue.value)
  const incorrectValue = Number(calificationIncorrectValue.value)
  const blankValue = Number(calificationBlankValue.value)

  if (!Number.isFinite(correctValue)) {
    calificationError.value = 'El valor para respuesta correcta no es válido.'
    return
  }
  if (!Number.isFinite(incorrectValue)) {
    calificationError.value = 'El valor para respuesta incorrecta no es válido.'
    return
  }
  if (!Number.isFinite(blankValue)) {
    calificationError.value = 'El valor para respuesta en blanco no es válido.'
    return
  }

  const candidates = archiveRows.value.filter((row) => normalizeArea(row.area) === area)
  if (!candidates.length) {
    calificationError.value = 'No hay postulantes registrados para el área seleccionada.'
    return
  }

  const processedResults = []
  let missingResponses = 0
  let missingKeys = 0

  candidates.forEach((candidate) => {
    const dni = stripDigits(candidate.dni)
    const responseList = responsesByDni.value.get(dni) || []

    if (!responseList.length) {
      missingResponses += 1
      return
    }

    const matchForArea = responseList
      .map((row) => {
        const key = buildAreaTipoKey(area, row.tipo)
        const answer = key ? answerKeyLookupByAreaTipo.value.get(key) : undefined
        return { row, answer }
      })
      .find((item) => item.answer)

    if (!matchForArea || !matchForArea.answer) {
      missingKeys += 1
      return
    }

    const { row: responseRow, answer: answerRow } = matchForArea

    const answersRaw = (responseRow?.answers || '').toUpperCase()
    const correctAnswersRaw = (answerRow?.answers || '').toUpperCase()
    
    // Asegurar que ambas cadenas tengan exactamente 60 caracteres, rellenando con espacios si es necesario
    const answers = answersRaw.padEnd(plan.length, ' ').slice(0, plan.length)
    const correctAnswers = correctAnswersRaw.padEnd(plan.length, ' ').slice(0, plan.length)

    let total = 0

    for (let index = 0; index < plan.length; index += 1) {
      const weight = Number(plan[index]?.weight) || 0
      if (weight <= 0) {
        // Si el peso es 0 o negativo, no contribuye nada
        continue
      }
      
      const responseChar = answers[index] || ' '
      const correctChar = correctAnswers[index] || ' '

      let contribution = 0
      
      // Verificar si la respuesta es correcta (ambos deben ser A-E y coincidir)
      const isCorrectCharValid = /^[A-E]$/.test(correctChar)
      const isResponseCharValid = /^[A-E]$/.test(responseChar)
      
      if (isCorrectCharValid && isResponseCharValid && responseChar === correctChar) {
        // Respuesta correcta
        contribution = correctValue * weight
      } else if (isResponseCharValid) {
        // Respuesta marcada (A-E) pero incorrecta
        contribution = incorrectValue * weight
      } else {
        // Respuesta en blanco: espacio, vacío, '*', o cualquier otro carácter
        // Si blankValue es 0, esto no afectará el total
        contribution = blankValue * weight
      }
      
      // Redondear cada contribución a 2 decimales para evitar errores de precisión acumulados
      // Usar Math.round para evitar problemas de precisión de punto flotante
      const roundedContribution = Math.round(contribution * 100) / 100
      total += roundedContribution
    }

    // Redondear el total final a 2 decimales usando el método correcto
    const finalScore = Math.round(total * 100) / 100

    processedResults.push({
      id: `${dni}-${area}`,
      dni,
      paterno: candidate.paterno || '',
      materno: candidate.materno || '',
      nombres: candidate.nombres || '',
      area,
      score: finalScore,
    })
  })

  processedResults.sort((a, b) => b.score - a.score)
  calificationResults.value = processedResults
  calificationSummary.value = {
    area,
    timestamp: new Date().toISOString(),
    totalCandidates: candidates.length,
    missingResponses,
    missingKeys,
    totalWeight: Number(totalWeight.toFixed(3)),
  }

  showCalificationModal.value = false
}

watch(
  [calificationResults, calificationSummary],
  () => {
    scoreStorage.value = {
      rows: calificationResults.value,
      summary: calificationSummary.value,
    }
  },
  { deep: true }
)

function buildAnswerKeyObservation(row) {
  const issues = []

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo no informado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answersNormalized = answersRaw.replaceAll(/\s/g, '')
  if (!answersNormalized) {
    issues.push('Sin respuestas registradas')
  } else if (answersNormalized.length !== 60) {
    issues.push(`Cadena incompleta (${answersNormalized.length}/60)`)
  } else if (/[^A-E*]/.test(answersNormalized)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

function buildResponseObservation(row) {
  const issues = []

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI no vinculado')
  } else if (dniDigits.length !== 8) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo no vinculado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answersNormalized = answersRaw.replaceAll(/\s/g, '')
  if (!answersNormalized) {
    issues.push('Sin respuestas marcadas')
  } else if (answersNormalized.length !== 60) {
    issues.push(`Cadena incompleta (${answersNormalized.length}/60)`)
  } else if (/[^A-E*]/.test(answersNormalized)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

function filterIdentifierRows() {
  if (identifierSearch.value) {
    const needle = normalize(identifierSearch.value)
    return identifierRows.value.filter((row) => {
      return (
        normalize(row.dni).includes(needle) ||
        normalize(row.lectura).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    })
  }

  return identifierRows.value
}

function filterAnswerKeyRows() {
  if (answerKeySearch.value) {
    const needle = normalize(answerKeySearch.value)
    return answerKeyRows.value.filter((row) => {
      return (
        normalize(row.area).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.answers).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    })
  }

  return answerKeyRows.value
}

function filterResponseRows() {
  if (responsesSearch.value) {
    const needle = normalize(responsesSearch.value)
    return responsesRows.value.filter((row) => {
      return (
        normalize(row.dni).includes(needle) ||
        normalize(row.lectura).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.answers).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    })
  }

  return responsesRows.value
}

function buildResponseMatchKey(row) {
  const litho = stripDigits(row.litho)
  const indicator = (row.indicator || '').trim().toUpperCase()
  const folio = String(row.folio || '').trim()
  return `${litho}|${indicator}|${folio}`
}

function buildAreaTipoKey(area, tipo) {
  const normalizedArea = normalizeArea(area)
  const normalizedTipo = (tipo || '').trim().toUpperCase().slice(0, 1)
  if (!normalizedTipo) return ''
  return `${normalizedArea}|${normalizedTipo}`
}

function applyIdentifierDataToResponseRow(row, lookup = identifierLookup.value) {
  const key = buildResponseMatchKey(row)
  let match = key ? lookup.get(key) : undefined
  if (!match) {
    const fallback = identifierLookupByLitho.value.get(stripDigits(row.litho))
    match = fallback
  }

  if (match) {
    row.dni = match.dni
    row.tipo = match.tipo
  } else {
    row.dni = row.dni ? stripDigits(row.dni) : ''
    row.tipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
  }

  const obs = buildResponseObservation(row)
  if (row.observaciones !== obs) {
    row.observaciones = obs
  }
}

function toggleResponseSelection(id) {
  const next = new Set(responsesSelection.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  responsesSelection.value = next
}

function clearResponseSelection() {
  responsesSelection.value = new Set()
}

function toggleResponseEdit(id) {
  const next = new Set(responsesEditing.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  responsesEditing.value = next
}

function clearResponseEditing() {
  responsesEditing.value = new Set()
}

function isResponseEditing(id) {
  return responsesEditing.value.has(id)
}

function removeSelectedResponses() {
  if (!responsesSelection.value.size) return

  const toRemove = new Set(responsesSelection.value)
  responsesRows.value = responsesRows.value.filter((row) => !toRemove.has(row.id))
  responsesEditing.value = new Set(
    Array.from(responsesEditing.value).filter((id) => !toRemove.has(id)),
  )
  clearResponseSelection()
}

function removeResponse(id) {
  responsesRows.value = responsesRows.value.filter((row) => row.id !== id)
  const nextSelection = new Set(responsesSelection.value)
  nextSelection.delete(id)
  responsesSelection.value = nextSelection

  const nextEditing = new Set(responsesEditing.value)
  nextEditing.delete(id)
  responsesEditing.value = nextEditing
}

function removeResponsesSource(sourceId) {
  responsesRows.value = responsesRows.value.filter((row) => row.sourceId !== sourceId)
  responsesSources.value = responsesSources.value.filter((source) => source.id !== sourceId)
  clearResponseSelection()
  clearResponseEditing()
}

function clearAllResponses() {
  responsesRows.value = []
  responsesSources.value = []
  clearResponseSelection()
  clearResponseEditing()
}
function toggleAnswerKeySelection(id) {
  const next = new Set(answerKeySelection.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  answerKeySelection.value = next
}

function clearAnswerKeySelection() {
  answerKeySelection.value = new Set()
}

function toggleAnswerKeyEdit(id) {
  const next = new Set(answerKeyEditing.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  answerKeyEditing.value = next
}

function clearAnswerKeyEditing() {
  answerKeyEditing.value = new Set()
}

function isAnswerKeyEditing(id) {
  return answerKeyEditing.value.has(id)
}

function removeSelectedAnswerKeys() {
  if (!answerKeySelection.value.size) return

  const toRemove = new Set(answerKeySelection.value)
  answerKeyRows.value = answerKeyRows.value.filter((row) => !toRemove.has(row.id))
  answerKeyEditing.value = new Set(
    Array.from(answerKeyEditing.value).filter((id) => !toRemove.has(id)),
  )
  clearAnswerKeySelection()
}

function removeAnswerKey(id) {
  answerKeyRows.value = answerKeyRows.value.filter((row) => row.id !== id)
  const nextSelection = new Set(answerKeySelection.value)
  nextSelection.delete(id)
  answerKeySelection.value = nextSelection

  const nextEditing = new Set(answerKeyEditing.value)
  nextEditing.delete(id)
  answerKeyEditing.value = nextEditing
}

function removeAnswerKeySource(sourceId) {
  answerKeyRows.value = answerKeyRows.value.filter((row) => row.sourceId !== sourceId)
  answerKeySources.value = answerKeySources.value.filter((source) => source.id !== sourceId)
  clearAnswerKeySelection()
  clearAnswerKeyEditing()
}

function clearAllAnswerKeys() {
  answerKeyRows.value = []
  answerKeySources.value = []
  clearAnswerKeySelection()
  clearAnswerKeyEditing()
}

function toggleAnswerKeySelectAll(checked) {
  const next = new Set(answerKeySelection.value)
  const visibleSet = new Set(answerKeyVisibleIds.value)

  if (checked) {
    answerKeyVisibleIds.value.forEach((id) => next.add(id))
  } else {
    visibleSet.forEach((id) => next.delete(id))
  }

  answerKeySelection.value = next
}


function toggleResponseSelectAll(checked) {
  const next = new Set(responsesSelection.value)
  const visibleSet = new Set(responsesVisibleIds.value)

  if (checked) {
    responsesVisibleIds.value.forEach((id) => next.add(id))
  } else {
    visibleSet.forEach((id) => next.delete(id))
  }

  responsesSelection.value = next
}

function onResponseDragOver(event) {
  event.preventDefault()
  responsesIsDragging.value = true
}

function onResponseDragLeave(event) {
  event.preventDefault()
  responsesIsDragging.value = false
}

async function onResponseDrop(event) {
  event.preventDefault()
  responsesIsDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return
  await readResponseFiles(files)
}

async function onResponseFileChange(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  await readResponseFiles(files)
  event.target.value = ''
}

function onAnswerKeyIdentificationChange(event) {
  const [file] = Array.from(event.target.files || [])
  answerKeyIdentificationFile.value = file || null
}

function onAnswerKeyResponsesChange(event) {
  const [file] = Array.from(event.target.files || [])
  answerKeyResponsesFile.value = file || null
}

async function importAnswerKeyFiles() {
  if (!answerKeyIdentificationFile.value || !answerKeyResponsesFile.value) {
    answerKeyImportError.value = 'Selecciona ambos archivos (.dat) antes de importar.'
    return
  }

  try {
    await readAnswerKeyFiles(
      answerKeyArea.value,
      answerKeyIdentificationFile.value,
      answerKeyResponsesFile.value,
    )
    answerKeyIdentificationFile.value = null
    answerKeyResponsesFile.value = null
    if (answerKeyIdentificationInputRef.value) {
      answerKeyIdentificationInputRef.value.value = ''
    }
    if (answerKeyResponsesInputRef.value) {
      answerKeyResponsesInputRef.value.value = ''
    }
  } catch (error) {
    console.error(error)
    answerKeyImportError.value = 'Ocurrió un problema al procesar las claves.'
  }
}

async function readAnswerKeyFiles(area, identificationFile, responsesFile) {
  const identifierResults = await readLinesFromFile(identificationFile, parseIdentifierLine)
  const responseResults = await readLinesFromFile(responsesFile, parseResponseLine)

  const identifierRowsOnly = identifierResults.filter((item) => item && item.row)
  const responseRowsOnly = responseResults.filter((item) => item && item.row)
  const identifierErrors = identifierResults.filter((item) => item && item.error)
  const responseErrors = responseResults.filter((item) => item && item.error)

  const lookup = new Map(
    identifierRowsOnly.map(({ row }) => [buildResponseMatchKey(row), row]),
  )
  const fallbackByLitho = new Map(
    identifierRowsOnly
      .map(({ row }) => [stripDigits(row.litho), row])
      .filter(([key]) => key),
  )

  const createdAt = new Date().toISOString()
  const sourceId = generateId()
  const combinedRows = responseRowsOnly.map(({ row }) => {
    const key = buildResponseMatchKey(row)
    let matched = lookup.get(key)

    if (!matched) {
      matched = fallbackByLitho.get(stripDigits(row.litho))
    }

    const tipo = matched ? matched.tipo : ''

    const answerKeyRow = createAnswerKeyRow({
      area,
      tipo,
      answers: row.answers,
      indicator: row.indicator,
      folio: row.folio,
      litho: row.litho,
      sourceId,
    })

    const baseObservation = buildAnswerKeyObservation(answerKeyRow)
    if (matched) {
      answerKeyRow.observaciones = baseObservation
    } else if (baseObservation === 'Sin observaciones') {
      answerKeyRow.observaciones = 'Sin coincidencia en identificador'
    } else {
      answerKeyRow.observaciones = `${baseObservation} · Sin coincidencia en identificador`
    }

    return answerKeyRow
  })

  const errorMessages = [
    ...identifierErrors.map(({ error }) => `${identificationFile.name}: ${error}`),
    ...responseErrors.map(({ error }) => `${responsesFile.name}: ${error}`),
  ]
  if (combinedRows.length === 0) {
    if (errorMessages.length) {
      const preview = errorMessages.slice(0, 3).join(' | ')
      answerKeyImportError.value = errorMessages.length > 3 ? `${preview} ...` : preview
    } else {
      answerKeyImportError.value = 'No se encontraron claves válidas en los archivos seleccionados.'
    }
    return
  }

  answerKeyRows.value = [...answerKeyRows.value, ...combinedRows]
  answerKeySources.value = [
    ...answerKeySources.value,
    {
      id: sourceId,
      name: responsesFile.name,
      identificationName: identificationFile.name,
      timestamp: createdAt,
      area,
      validRows: combinedRows.length,
      responseErrors: responseErrors.length,
      identificationErrors: identifierErrors.length,
    },
  ]

  clearAnswerKeySelection()
  clearAnswerKeyEditing()
  if (errorMessages.length) {
    const preview = errorMessages.slice(0, 3).join(' | ')
    answerKeyImportError.value = errorMessages.length > 3 ? `${preview} ...` : preview
  } else {
    answerKeyImportError.value = ''
  }
}

async function readLinesFromFile(file, parser) {
  const text = await file.text()
  const sanitized = text.split('\u001a').join('')
  const normalized = sanitized.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalized.split('\n')
  const results = []

  lines.forEach((line, index) => {
    const result = parser(line, index + 1)
    if (!result) {
      return
    }
    results.push(result)
  })

  return results
}

function toggleIdentifierSelection(id) {
  const next = new Set(identifierSelection.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  identifierSelection.value = next
}

function clearIdentifierSelection() {
  identifierSelection.value = new Set()
}

function toggleIdentifierEdit(id) {
  const next = new Set(identifierEditing.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  identifierEditing.value = next
}

function clearIdentifierEditing() {
  identifierEditing.value = new Set()
}

function isIdentifierEditing(id) {
  return identifierEditing.value.has(id)
}

function removeSelectedIdentifiers() {
  if (!identifierSelection.value.size) return

  const toRemove = new Set(identifierSelection.value)
  identifierRows.value = identifierRows.value.filter((row) => !toRemove.has(row.id))
  identifierEditing.value = new Set(
    Array.from(identifierEditing.value).filter((id) => !toRemove.has(id)),
  )
  clearIdentifierSelection()
}

function removeIdentifier(id) {
  identifierRows.value = identifierRows.value.filter((row) => row.id !== id)
  const nextSelection = new Set(identifierSelection.value)
  nextSelection.delete(id)
  identifierSelection.value = nextSelection

  const nextEditing = new Set(identifierEditing.value)
  nextEditing.delete(id)
  identifierEditing.value = nextEditing
}

function removeIdentifierSource(sourceId) {
  identifierRows.value = identifierRows.value.filter((row) => row.sourceId !== sourceId)
  identifierSources.value = identifierSources.value.filter((source) => source.id !== sourceId)
  clearIdentifierSelection()
  clearIdentifierEditing()
}

function clearAllIdentifiers() {
  identifierRows.value = []
  clearIdentifierSelection()
  clearIdentifierEditing()
  identifierSources.value = []
}

function toggleIdentifierSelectAll(checked) {
  const next = new Set(identifierSelection.value)
  const visibleSet = new Set(identifierVisibleIds.value)

  if (checked) {
    identifierVisibleIds.value.forEach((id) => next.add(id))
  } else {
    visibleSet.forEach((id) => next.delete(id))
  }

  identifierSelection.value = next
}

function onIdentifierDragOver(event) {
  event.preventDefault()
  identifierIsDragging.value = true
}

function onIdentifierDragLeave(event) {
  event.preventDefault()
  identifierIsDragging.value = false
}

async function onIdentifierDrop(event) {
  event.preventDefault()
  identifierIsDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return
  await readIdentifierFiles(files)
}

async function onIdentifierFileChange(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  await readIdentifierFiles(files)
  event.target.value = ''
}

async function readIdentifierFiles(files) {
  identifierImportError.value = ''
  const aggregatedRows = []
  const aggregatedErrors = []

  for (const file of files) {
    const sourceId = generateId()
    try {
      const text = await file.text()
      const sanitizedText = text.split('\u001a').join('')
      const lines = sanitizedText.split(/\r?\n/)
      const parsedRows = []
      const fileErrors = []

      lines.forEach((line, index) => {
        const result = parseIdentifierLine(line, index + 1)
        if (!result) return
        if (result.error) {
          fileErrors.push(`${file.name}: ${result.error}`)
        } else {
          parsedRows.push({
            ...result.row,
            sourceId,
          })
        }
      })

      if (parsedRows.length) {
        aggregatedRows.push(...parsedRows)
      }

      if (fileErrors.length) {
        aggregatedErrors.push(...fileErrors)
      } else if (!parsedRows.length) {
        aggregatedErrors.push(`${file.name}: no se encontraron registros válidos.`)
      }

      const contentLines = lines.filter((line) => line.trim().length > 0).length
      identifierSources.value = [
        ...identifierSources.value,
        {
          id: sourceId,
          name: file.name,
          timestamp: new Date().toISOString(),
          totalLines: contentLines,
          validRows: parsedRows.length,
          errorCount: fileErrors.length,
        },
      ]
    } catch (error) {
      console.error(error)
      aggregatedErrors.push(`${file.name}: error al leer el archivo.`)
    }
  }

  if (aggregatedRows.length) {
    identifierRows.value = [...identifierRows.value, ...aggregatedRows]
    clearIdentifierSelection()
    clearIdentifierEditing()
  }

  if (aggregatedErrors.length) {
    const preview = aggregatedErrors.slice(0, 3).join(' | ')
    identifierImportError.value =
      aggregatedErrors.length > 3 ? `${preview} ...` : preview
  } else if (aggregatedRows.length === 0) {
    identifierImportError.value = 'No se encontraron registros en los archivos seleccionados.'
  } else {
    identifierImportError.value = ''
  }
}

async function readResponseFiles(files) {
  responsesImportError.value = ''
  const aggregatedRows = []
  const aggregatedErrors = []

  for (const file of files) {
    const sourceId = generateId()
    try {
      const text = await file.text()
      const sanitizedText = text.split('\u001a').join('')
      const lines = sanitizedText.split(/\r?\n/)
      const parsedRows = []
      const fileErrors = []

      lines.forEach((line, index) => {
        const result = parseResponseLine(line, index + 1)
        if (!result) return
        if (result.error) {
          fileErrors.push(`${file.name}: ${result.error}`)
        } else {
          parsedRows.push({
            ...result.row,
            sourceId,
          })
        }
      })

      if (parsedRows.length) {
        aggregatedRows.push(...parsedRows)
      }

      if (fileErrors.length) {
        aggregatedErrors.push(...fileErrors)
      } else if (!parsedRows.length) {
        aggregatedErrors.push(`${file.name}: no se encontraron registros válidos.`)
      }

      const contentLines = lines.filter((line) => line.trim().length > 0).length
      responsesSources.value = [
        ...responsesSources.value,
        {
          id: sourceId,
          name: file.name,
          timestamp: new Date().toISOString(),
          totalLines: contentLines,
          validRows: parsedRows.length,
          errorCount: fileErrors.length,
        },
      ]
    } catch (error) {
      console.error(error)
      aggregatedErrors.push(`${file.name}: error al leer el archivo.`)
    }
  }

  if (aggregatedRows.length) {
    responsesRows.value = [...responsesRows.value, ...aggregatedRows]
    clearResponseSelection()
    clearResponseEditing()
  }

  if (aggregatedErrors.length) {
    const preview = aggregatedErrors.slice(0, 3).join(' | ')
    responsesImportError.value =
      aggregatedErrors.length > 3 ? `${preview} ...` : preview
  } else if (aggregatedRows.length === 0) {
    responsesImportError.value = 'No se encontraron registros en los archivos seleccionados.'
  } else {
    responsesImportError.value = ''
  }
}

function parseIdentifierLine(line, lineNumber) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, 21)
  if (!/^\d{21}$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(21)
  let cursor = 0

  const examMatch = remainder.slice(cursor).match(/^\s*(\d{4})/)
  if (!examMatch) {
    return { error: `L${lineNumber}: código de examen no encontrado` }
  }
  const examCode = examMatch[1]
  cursor += examMatch[0].length

  remainder = remainder.slice(cursor)
  const folioMatch = remainder.match(/^\s*#(\d{4})/)
  if (!folioMatch) {
    return { error: `L${lineNumber}: folio (#0000) no reconocido` }
  }
  const folio = folioMatch[1]
  cursor = folioMatch[0].length

  remainder = remainder.slice(cursor)
  const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
  if (!indicatorMatch) {
    return { error: `L${lineNumber}: indicador de estado no identificado` }
  }
  const indicator = indicatorMatch[1].toUpperCase()
  cursor = indicatorMatch[0].length

  remainder = remainder.slice(cursor)
  if (remainder.startsWith(' ')) {
    remainder = remainder.slice(1)
  }

  const lithoSegment = remainder.slice(0, 6)
  const tipoSegment = remainder.slice(6, 7)
  const dniSegment = remainder.slice(7, 15)
  const aulaSegment = remainder.slice(15, 18)
  const answersSegment = remainder.slice(18).trim()

  const row = createIdentifierRow({
    rawLine: raw,
    header,
    lectura: header.slice(3, 9),
    examCode,
    folio,
    indicator,
    litho: removeWhitespace(lithoSegment),
    tipo: tipoSegment.trim().toUpperCase(),
    dni: removeWhitespace(dniSegment),
    aula: removeWhitespace(aulaSegment),
    answers: answersSegment,
  })

  row.observaciones = buildIdentifierObservation(row)

  return { row }
}

function parseResponseLine(line, lineNumber) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, 21)
  if (!/^\d{21}$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(21)
  let cursor = 0

  const examMatch = remainder.slice(cursor).match(/^\s*(\d{4})/)
  if (!examMatch) {
    return { error: `L${lineNumber}: código de examen no encontrado` }
  }
  const examCode = examMatch[1]
  cursor += examMatch[0].length

  remainder = remainder.slice(cursor)
  const folioMatch = remainder.match(/^\s*#(\d{4})/)
  if (!folioMatch) {
    return { error: `L${lineNumber}: folio (#0000) no reconocido` }
  }
  const folio = folioMatch[1]
  cursor = folioMatch[0].length

  remainder = remainder.slice(cursor)
  const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
  if (!indicatorMatch) {
    return { error: `L${lineNumber}: indicador de estado no identificado` }
  }
  const indicator = indicatorMatch[1].toUpperCase()
  cursor = indicatorMatch[0].length

  remainder = remainder.slice(cursor)
  if (remainder.startsWith(' ')) {
    remainder = remainder.slice(1)
  }

  const lithoSegment = remainder.slice(0, 6)
  const answersSegment = remainder.slice(6)

  const row = createResponseRow({
    rawLine: raw,
    header,
    lectura: header.slice(3, 9),
    examCode,
    folio,
    indicator,
    litho: removeWhitespace(lithoSegment),
    answers: answersSegment,
  })

  row.observaciones = buildResponseObservation(row)

  return { row }
}

async function exportIdentifiersToExcel() {
  if (!identifierRows.value.length) return
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Identificadores')
  worksheet.columns = [
    { header: 'N° lectura', key: 'lectura' },
    { header: 'DNI', key: 'dni' },
    { header: 'Aula', key: 'aula' },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Litho', key: 'litho' },
    { header: 'Indicador', key: 'indicator' },
    { header: 'Observaciones', key: 'observaciones' },
  ]

  identifierRows.value.forEach(({ id, rawLine, header, examCode, folio, answers, ...rest }) => {
    worksheet.addRow(rest)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, 'identificadores.xlsx')
}

async function exportObservationsPdf() {
  const rows = identifierObservations.value
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Reporte de observaciones', 14, 18)

  if (rows.length === 0) {
    doc.setFontSize(12)
    doc.text('No se registraron observaciones en los registros cargados.', 14, 28)
  } else {
    const tableBody = rows.map((row, index) => [
      index + 1,
      row.dni || '-',
      row.lectura || '-',
      row.aula || '-',
      row.observaciones,
    ])
    autoTable(doc, {
      startY: 24,
      head: [['#', 'DNI', 'N° lectura', 'Aula', 'Observaciones']],
      body: tableBody,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
      },
    })
  }

  doc.save('observaciones.pdf')
}

async function exportResponsesToExcel() {
  if (!responsesRows.value.length) return
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Respuestas')
  worksheet.columns = [
    { header: 'N° lectura', key: 'lectura' },
    { header: 'DNI', key: 'dni' },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Litho', key: 'litho' },
    { header: 'Respuestas', key: 'answers' },
    { header: 'Observaciones', key: 'observaciones' },
  ]

  responsesRows.value.forEach(({ id, sourceId, ...rest }) => {
    worksheet.addRow(rest)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, 'respuestas.xlsx')
}

async function exportResponsesObservationsPdf() {
  const rows = responsesObservations.value
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Observaciones de respuestas', 14, 18)

  if (rows.length === 0) {
    doc.setFontSize(12)
    doc.text('No se registraron observaciones en las hojas de respuestas cargadas.', 14, 28)
  } else {
    const tableBody = rows.map((row, index) => [
      index + 1,
      row.dni || '-',
      row.lectura || '-',
      row.tipo || '-',
      row.litho || '-',
      row.observaciones,
    ])
    autoTable(doc, {
      startY: 24,
      head: [['#', 'DNI', 'N° lectura', 'Tip', 'Litho', 'Observaciones']],
      body: tableBody,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
      },
    })
  }

  doc.save('observaciones-respuestas.pdf')
}
async function exportAnswerKeysToExcel() {
  if (!answerKeyRows.value.length) return
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Claves')
  worksheet.columns = ANSWER_KEY_COLUMNS.map(({ key, label }) => ({
    header: label,
    key,
  }))

  answerKeyRows.value.forEach(({ id, ...rest }) => {
    worksheet.addRow(rest)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, 'claves-respuestas.xlsx')
}

function exportAnswerKeysObservationsPdf() {
  const rows = answerKeyObservations.value
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Observaciones de claves', 14, 18)

  if (rows.length === 0) {
    doc.setFontSize(12)
    doc.text('No se registraron observaciones en las claves cargadas.', 14, 28)
  } else {
    const tableBody = rows.map((row, index) => [
      index + 1,
      row.area || '-',
      row.tipo || '-',
      row.litho || '-',
      row.observaciones,
    ])
    autoTable(doc, {
      startY: 24,
      head: [['#', 'Área', 'Tip', 'Litho', 'Observaciones']],
      body: tableBody,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: { fillColor: [33, 150, 243] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 32 },
        2: { cellWidth: 18 },
        3: { cellWidth: 24 },
        4: { cellWidth: 92 },
      },
    })
  }

  doc.save('observaciones-claves.pdf')
}
</script>
<template>
  <div class="page">
    <header class="header">
      <h1>CALIFICADOR DAD</h1>
      <p>
        Sigue los pasos en la pestaña correspondiente:
      </p>
    </header>

    <nav class="tabs" aria-label="Pasos de importación">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="tab"
        :class="{ 'tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section
      v-if="activeTab === TAB_KEYS.ARCHIVES"
      class="tab-content"
    >
      <section
        class="uploader"
        :class="{ dragging: archiveIsDragging }"
        @drop="onArchiveDrop"
        @dragover="onArchiveDragOver"
        @dragleave="onArchiveDragLeave"
      >
        <input
          id="archive-input"
          type="file"
          accept=".xlsx"
          class="uploader__input"
          @change="onArchiveFileChange"
        />
        <label for="archive-input">
          <strong>Paso 1: Carga el padrón desde Excel (.xlsx)</strong>
          <span>Arrastra el archivo o haz clic para seleccionarlo.</span>
          <span class="uploader__hint">
            Columnas esperadas: {{ ARCHIVE_COLUMNS.map((c) => c.label).join(', ') }}
          </span>
          <span class="uploader__hint">
            Después de este paso continúa con la pestaña «Paso 2» para importar las hojas de identificación.
          </span>
        </label>
      </section>

      <div v-if="archiveImportError" class="alert alert--error">
        {{ archiveImportError }}
      </div>

      <section class="toolbar">
        <div class="toolbar__left">
          <button type="button" class="btn" @click="exportArchiveToExcel" :disabled="!archiveHasData">
            Exportar a Excel
          </button>
          <button type="button" class="btn" @click="clearAllArchives" :disabled="!archiveHasData">
            Limpiar tabla
          </button>
          <button
            type="button"
            class="btn btn--danger"
            @click="removeSelectedArchives"
            :disabled="!archiveTotalSelected"
          >
            Eliminar seleccionados ({{ archiveTotalSelected }})
          </button>
        </div>
        <div class="toolbar__right">
          <input
            v-model="archiveSearch"
            type="search"
            class="input"
            placeholder="Buscar por DNI, nombres o área"
            aria-label="Buscar candidatos"
          />
          <div class="metrics">
            <span>Registros: {{ archiveTotalRows }}</span>
            <span v-if="archiveSearch">Coincidencias: {{ archiveTotalFiltered }}</span>
          </div>
        </div>
      </section>

      <section class="table-wrapper" v-if="archiveHasData">
        <table>
          <thead>
            <tr>
              <th class="col-number">#</th>
              <th>
                <input
                  ref="archiveSelectAllRef"
                  type="checkbox"
                  :checked="archiveIsAllVisibleSelected"
                  @change="(event) => toggleArchiveSelectAll(event.target.checked)"
                />
              </th>
              <th v-for="column in ARCHIVE_COLUMNS" :key="column.key">
                {{ column.label }}
              </th>
              <th class="actions-header">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in archiveFilteredRows" :key="row.id">
              <td class="col-number">
                {{ index + 1 }}
              </td>
              <td>
                <input
                  type="checkbox"
                  :checked="archiveSelection.has(row.id)"
                  @change="() => toggleArchiveSelection(row.id)"
                />
              </td>
              <td v-for="column in ARCHIVE_COLUMNS" :key="column.key">
                <input
                  v-model="row[column.key]"
                  type="text"
                  class="cell-input"
                  :readonly="!isArchiveEditing(row.id)"
                  :class="{ 'cell-input--locked': !isArchiveEditing(row.id) }"
                />
              </td>
              <td class="actions-cell">
                <button type="button" class="link" @click="toggleArchiveEdit(row.id)">
                  {{ isArchiveEditing(row.id) ? 'Cerrar' : 'Editar' }}
                </button>
                <button type="button" class="link link--danger" @click="removeArchiveRow(row.id)">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="empty" v-else>
        <p>Aún no hay registros. Carga un Excel o agrega filas manualmente.</p>
      </section>

      <section class="adder">
        <h2>Agregar registro manual</h2>
        <form class="adder__form" @submit.prevent="addArchiveRow">
          <div v-for="column in ARCHIVE_COLUMNS" :key="column.key" class="field">
            <label :for="`new-${column.key}`">{{ column.label }}</label>
            <input
              :id="`new-${column.key}`"
              v-model="archivePendingRow[column.key]"
              type="text"
              :placeholder="column.placeholder"
            />
          </div>
          <div class="adder__actions">
            <button type="submit" class="btn">Guardar fila</button>
            <button type="button" class="btn btn--ghost" @click="resetArchivePendingRow">
              Limpiar
            </button>
          </div>
        </form>
      </section>
    </section>

    <section
      v-else-if="activeTab === TAB_KEYS.IDENTIFIERS"
      class="tab-content"
    >
      <section
        class="uploader"
        :class="{ dragging: identifierIsDragging }"
        @drop="onIdentifierDrop"
        @dragover="onIdentifierDragOver"
        @dragleave="onIdentifierDragLeave"
      >
        <input
          id="identifier-input"
          type="file"
          accept=".dat,.txt"
          multiple
          class="uploader__input"
          @change="onIdentifierFileChange"
        />
        <label for="identifier-input">
          <strong>Paso 2: Carga hojas de identificación (.dat)</strong>
          <span>Arrastra uno o varios archivos o haz clic para seleccionarlos.</span>
          <span class="uploader__hint">Puedes cargar archivos de diferentes áreas; los registros se agregarán al listado existente.</span>
        </label>
      </section>

      <div v-if="identifierImportError" class="alert alert--error">
        {{ identifierImportError }}
      </div>

      <section class="toolbar">
        <div class="toolbar__left">
          <button type="button" class="btn" @click="exportIdentifiersToExcel" :disabled="!identifierHasData">
            Exportar a Excel
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            @click="exportObservationsPdf"
            :disabled="!identifierObservationCount"
          >
            <span class="icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v14h12V9h-5V4H6Zm2 12h8v2H8v-2Zm0-4h8v2H8v-2Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            Observaciones PDF
          </button>
          <button type="button" class="btn" @click="clearAllIdentifiers" :disabled="!identifierHasData">
            Limpiar tabla
          </button>
          <button
            type="button"
            class="btn btn--danger"
            @click="removeSelectedIdentifiers"
            :disabled="!identifierTotalSelected"
          >
            Eliminar seleccionados ({{ identifierTotalSelected }})
          </button>
        </div>
        <div class="toolbar__right">
          <input
            v-model="identifierSearch"
            type="search"
            class="input"
            placeholder="Buscar por DNI, lectura, litho u observaciones"
            aria-label="Buscar identificadores"
          />
          <div class="metrics">
            <span>Registros: {{ identifierTotalRows }}</span>
            <span v-if="identifierSearch">Coincidencias: {{ identifierTotalFiltered }}</span>
          </div>
        </div>
      </section>

      <nav class="subtabs" aria-label="Secciones de identificadores">
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': identifierSubTab === IDENTIFIER_SUBTABS.LIST }"
          @click="identifierSubTab = IDENTIFIER_SUBTABS.LIST"
        >
          Registros ({{ identifierTotalRows }})
        </button>
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': identifierSubTab === IDENTIFIER_SUBTABS.SOURCES }"
          @click="identifierSubTab = IDENTIFIER_SUBTABS.SOURCES"
        >
          Archivos cargados ({{ identifierSources.length }})
        </button>
      </nav>

      <section v-if="identifierSubTab === IDENTIFIER_SUBTABS.LIST">
        <section class="table-wrapper" v-if="identifierHasData">
          <table>
            <thead>
              <tr>
                <th class="col-number">#</th>
                <th>
                  <input
                    ref="identifierSelectAllRef"
                    type="checkbox"
                    :checked="identifierIsAllVisibleSelected"
                    @change="(event) => toggleIdentifierSelectAll(event.target.checked)"
                  />
                </th>
                <th>N° lectura</th>
                <th>DNI</th>
                <th>Aula</th>
                <th>Tip</th>
                <th>Litho</th>
                <th>Observaciones</th>
                <th class="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in identifierFilteredRows"
                :key="row.id"
                :class="{ 'row--issue': row.observaciones !== 'Sin observaciones' }"
              >
                <td class="col-number">
                  {{ index + 1 }}
                </td>
                <td>
                  <input
                    type="checkbox"
                    :checked="identifierSelection.has(row.id)"
                    @change="() => toggleIdentifierSelection(row.id)"
                  />
                </td>
                <td>
                  <input
                    v-model="row.lectura"
                    type="text"
                    class="cell-input"
                    :readonly="!isIdentifierEditing(row.id)"
                    :class="{ 'cell-input--locked': !isIdentifierEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.dni"
                    type="text"
                    class="cell-input"
                    maxlength="8"
                    :readonly="!isIdentifierEditing(row.id)"
                    :class="{ 'cell-input--locked': !isIdentifierEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.aula"
                    type="text"
                    class="cell-input"
                    maxlength="3"
                    :readonly="!isIdentifierEditing(row.id)"
                    :class="{ 'cell-input--locked': !isIdentifierEditing(row.id) }"
                  />
                </td>
                <td class="col-type">
                  <input
                    v-model="row.tipo"
                    type="text"
                    class="cell-input cell-input--tight"
                    maxlength="1"
                    :readonly="!isIdentifierEditing(row.id)"
                    :class="{ 'cell-input--locked': !isIdentifierEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.litho"
                    type="text"
                    class="cell-input"
                    maxlength="6"
                    :readonly="!isIdentifierEditing(row.id)"
                    :class="{ 'cell-input--locked': !isIdentifierEditing(row.id) }"
                  />
                </td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': row.observaciones === 'Sin observaciones',
                      'badge--warn': row.observaciones !== 'Sin observaciones',
                    }"
                  >
                    {{ row.observaciones }}
                  </span>
                </td>
              <td class="actions-cell">
                <button
                  type="button"
                  class="icon-button"
                  :class="{ 'icon-button--active': isIdentifierEditing(row.id) }"
                  @click="toggleIdentifierEdit(row.id)"
                  :aria-label="isIdentifierEditing(row.id) ? 'Cerrar edición' : 'Editar fila'"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 18.5V21h2.5l7.37-7.37-2.5-2.5L5 18.5Zm13.71-7.71a1 1 0 0 0 0-1.42l-2.08-2.08a1 1 0 0 0-1.42 0l-1.79 1.79 3.5 3.5 1.79-1.79Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="icon-button icon-button--danger"
                  @click="removeIdentifier(row.id)"
                  aria-label="Eliminar fila"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="empty" v-else>
          <p>Carga uno o varios archivos .dat de identificadores para comenzar.</p>
        </section>
      </section>

      <section
        v-else
        class="sources-panel"
      >
        <header class="sources-header">
          <div>
            <h3>Archivos importados</h3>
            <p>Resumen de cargas realizadas en esta sesión.</p>
          </div>
          <div class="sources-counts">
            <span>Total archivos: {{ identifierSources.length }}</span>
            <span>Total registros: {{ identifierTotalRows }}</span>
          </div>
        </header>

        <div v-if="identifierSources.length" class="sources-table-wrapper">
          <table class="sources-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha y hora</th>
                <th>Registros válidos</th>
                <th>Errores</th>
                <th>Líneas leídas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in identifierSources" :key="source.id">
                <td>{{ source.name }}</td>
                <td>{{ formatTimestamp(source.timestamp) }}</td>
                <td>{{ source.validRows }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': source.errorCount === 0,
                      'badge--warn': source.errorCount > 0,
                    }"
                  >
                    {{ source.errorCount }}
                  </span>
                </td>
                <td>{{ source.totalLines }}</td>
                <td>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    @click="removeIdentifierSource(source.id)"
                    aria-label="Eliminar archivo"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty">
          <p>Aún no se ha registrado ningún archivo. Carga uno o varios archivos .dat para ver el resumen.</p>
        </div>

        <div class="sources-actions">
          <label class="btn" for="identifier-input">Cargar más archivos</label>
          <span class="sources-hint">Los nuevos archivos se añadirán a la lista y podrás combinar áreas distintas.</span>
        </div>
      </section>
    </section>

    <section
      v-else-if="activeTab === TAB_KEYS.RESPONSES"
      class="tab-content"
    >
      <section
        class="uploader"
        :class="{ dragging: responsesIsDragging }"
        @drop="onResponseDrop"
        @dragover="onResponseDragOver"
        @dragleave="onResponseDragLeave"
      >
        <input
          id="responses-input"
          type="file"
          accept=".dat,.txt"
          multiple
          class="uploader__input"
          @change="onResponseFileChange"
        />
        <label for="responses-input">
          <strong>Paso 3: Carga hojas de respuestas (.dat)</strong>
          <span>Arrastra uno o varios archivos o haz clic para seleccionarlos.</span>
          <span class="uploader__hint">La cadena de respuestas debe incluir 60 preguntas marcadas.</span>
        </label>
      </section>

      <div v-if="responsesImportError" class="alert alert--error">
        {{ responsesImportError }}
      </div>

      <section class="toolbar">
        <div class="toolbar__left">
          <button type="button" class="btn" @click="exportResponsesToExcel" :disabled="!responsesHasData">
            Exportar a Excel
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            @click="exportResponsesObservationsPdf"
            :disabled="!responsesObservationCount"
          >
            <span class="icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v14h12V9h-5V4H6Zm2 12h8v2H8v-2Zm0-4h8v2H8v-2Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            Observaciones PDF
          </button>
          <button type="button" class="btn" @click="clearAllResponses" :disabled="!responsesHasData">
            Limpiar tabla
          </button>
          <button
            type="button"
            class="btn btn--danger"
            @click="removeSelectedResponses"
            :disabled="!responsesTotalSelected"
          >
            Eliminar seleccionados ({{ responsesTotalSelected }})
          </button>
        </div>
        <div class="toolbar__right">
          <input
            v-model="responsesSearch"
            type="search"
            class="input"
            placeholder="Buscar por DNI, litho o observaciones"
            aria-label="Buscar respuestas"
          />
          <div class="metrics">
            <span>Registros: {{ responsesTotalRows }}</span>
            <span v-if="responsesSearch">Coincidencias: {{ responsesFilteredRows.length }}</span>
          </div>
        </div>
      </section>

      <nav class="subtabs" aria-label="Secciones de respuestas">
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': responsesSubTab === RESPONSES_SUBTABS.LIST }"
          @click="responsesSubTab = RESPONSES_SUBTABS.LIST"
        >
          Registros ({{ responsesTotalRows }})
        </button>
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': responsesSubTab === RESPONSES_SUBTABS.SOURCES }"
          @click="responsesSubTab = RESPONSES_SUBTABS.SOURCES"
        >
          Archivos cargados ({{ responsesSourcesCount }})
        </button>
      </nav>

      <section v-if="responsesSubTab === RESPONSES_SUBTABS.LIST">
        <section class="table-wrapper" v-if="responsesHasData">
          <table>
            <thead>
              <tr>
                <th class="col-number">#</th>
                <th>
                  <input
                    ref="responsesSelectAllRef"
                    type="checkbox"
                    :checked="responsesIsAllVisibleSelected"
                    @change="(event) => toggleResponseSelectAll(event.target.checked)"
                  />
                </th>
                <th v-for="column in RESPONSES_COLUMNS" :key="column.key">
                  {{ column.label }}
                </th>
                <th class="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in responsesFilteredRows"
                :key="row.id"
                :class="{ 'row--issue': row.observaciones !== 'Sin observaciones' }"
              >
                <td class="col-number">{{ index + 1 }}</td>
                <td>
                  <input
                    type="checkbox"
                    :checked="responsesSelection.has(row.id)"
                    @change="() => toggleResponseSelection(row.id)"
                  />
                </td>
                <td>
                  <input
                    v-model="row.lectura"
                    type="text"
                    class="cell-input"
                    :readonly="!isResponseEditing(row.id)"
                    :class="{ 'cell-input--locked': !isResponseEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.dni"
                    type="text"
                    class="cell-input"
                    maxlength="8"
                    :readonly="!isResponseEditing(row.id)"
                    :class="{ 'cell-input--locked': !isResponseEditing(row.id) }"
                  />
                </td>
                <td class="col-type">
                  <input
                    v-model="row.tipo"
                    type="text"
                    class="cell-input cell-input--tight"
                    maxlength="1"
                    :readonly="!isResponseEditing(row.id)"
                    :class="{ 'cell-input--locked': !isResponseEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.litho"
                    type="text"
                    class="cell-input"
                    maxlength="6"
                    :readonly="!isResponseEditing(row.id)"
                    :class="{ 'cell-input--locked': !isResponseEditing(row.id) }"
                  />
                </td>
                <td>
                  <textarea
                    v-model="row.answers"
                    class="cell-textarea"
                    rows="2"
                    :readonly="!isResponseEditing(row.id)"
                    :class="{ 'cell-input--locked': !isResponseEditing(row.id) }"
                  ></textarea>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': row.observaciones === 'Sin observaciones',
                      'badge--warn': row.observaciones !== 'Sin observaciones',
                    }"
                  >
                    {{ row.observaciones }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    type="button"
                    class="icon-button"
                    :class="{ 'icon-button--active': isResponseEditing(row.id) }"
                    @click="toggleResponseEdit(row.id)"
                    :aria-label="isResponseEditing(row.id) ? 'Cerrar edición' : 'Editar fila'"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 18.5V21h2.5l7.37-7.37-2.5-2.5L5 18.5Zm13.71-7.71a1 1 0 0 0 0-1.42l-2.08-2.08a1 1 0 0 0-1.42 0l-1.79 1.79 3.5 3.5 1.79-1.79Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    @click="removeResponse(row.id)"
                    aria-label="Eliminar fila"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="empty" v-else>
          <p>Carga uno o varios archivos .dat de respuestas para comenzar.</p>
        </section>
      </section>

      <section
        v-else
        class="sources-panel"
      >
        <header class="sources-header">
          <div>
            <h3>Archivos importados</h3>
            <p>Resumen de hojas de respuestas cargadas.</p>
          </div>
          <div class="sources-counts">
            <span>Total archivos: {{ responsesSourcesCount }}</span>
            <span>Total registros: {{ responsesTotalRows }}</span>
          </div>
        </header>

        <div v-if="responsesSources.length" class="sources-table-wrapper">
          <table class="sources-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha y hora</th>
                <th>Registros válidos</th>
                <th>Errores</th>
                <th>Líneas leídas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in responsesSources" :key="source.id">
                <td>{{ source.name }}</td>
                <td>{{ formatTimestamp(source.timestamp) }}</td>
                <td>{{ source.validRows }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': source.errorCount === 0,
                      'badge--warn': source.errorCount > 0,
                    }"
                  >
                    {{ source.errorCount }}
                  </span>
                </td>
                <td>{{ source.totalLines }}</td>
                <td>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    @click="removeResponsesSource(source.id)"
                    aria-label="Eliminar archivo"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty">
          <p>Aún no se ha registrado ningún archivo. Carga uno o varios archivos .dat para ver el resumen.</p>
        </div>

        <div class="sources-actions">
          <label class="btn" for="responses-input">Cargar más archivos</label>
          <span class="sources-hint">Los nuevos archivos se añadirán a la lista y podrás combinar áreas distintas.</span>
        </div>
      </section>
    </section>

    <section
      v-else-if="activeTab === TAB_KEYS.ANSWER_KEYS"
      class="tab-content"
    >
      <section class="uploader uploader--form">
        <form class="uploader__form" @submit.prevent="importAnswerKeyFiles">
          <div class="field">
            <label for="answer-key-area">Área</label>
            <select
              id="answer-key-area"
              v-model="answerKeyArea"
              class="input"
              required
            >
              <option v-for="option in answerKeyAreaOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <div class="field">
            <label for="answer-key-identification">Archivo de identificación (.dat)</label>
            <input
              id="answer-key-identification"
              ref="answerKeyIdentificationInputRef"
              type="file"
              class="input"
              accept=".dat,.txt"
              @change="onAnswerKeyIdentificationChange"
              required
            />
            <small v-if="answerKeyIdentificationFile" class="sources-hint">
              {{ answerKeyIdentificationFile.name }}
            </small>
          </div>

          <div class="field">
            <label for="answer-key-responses">Archivo de respuestas correctas (.dat)</label>
            <input
              id="answer-key-responses"
              ref="answerKeyResponsesInputRef"
              type="file"
              class="input"
              accept=".dat,.txt"
              @change="onAnswerKeyResponsesChange"
              required
            />
            <small v-if="answerKeyResponsesFile" class="sources-hint">
              {{ answerKeyResponsesFile.name }}
            </small>
          </div>

          <button type="submit" class="btn">
            Importar claves para el área
          </button>
        </form>
        <p class="uploader__hint">
          Selecciona el área y adjunta los archivos .dat de identificación y respuestas oficiales para esta
          especialidad.
        </p>
      </section>

      <div v-if="answerKeyImportError" class="alert alert--error">
        {{ answerKeyImportError }}
      </div>

      <section class="toolbar">
        <div class="toolbar__left">
          <button
            type="button"
            class="btn"
            @click="exportAnswerKeysToExcel"
            :disabled="!answerKeyHasData"
          >
            Exportar a Excel
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            @click="exportAnswerKeysObservationsPdf"
            :disabled="!answerKeyObservationCount"
          >
            <span class="icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v14h12V9h-5V4H6Zm2 12h8v2H8v-2Zm0-4h8v2H8v-2Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            Observaciones PDF
          </button>
          <button type="button" class="btn" @click="clearAllAnswerKeys" :disabled="!answerKeyHasData">
            Limpiar tabla
          </button>
          <button
            type="button"
            class="btn btn--danger"
            @click="removeSelectedAnswerKeys"
            :disabled="!answerKeyTotalSelected"
          >
            Eliminar seleccionados ({{ answerKeyTotalSelected }})
          </button>
        </div>
        <div class="toolbar__right">
          <input
            v-model="answerKeySearch"
            type="search"
            class="input"
            placeholder="Buscar por área, tipo, litho o observaciones"
            aria-label="Buscar claves"
          />
          <div class="metrics">
            <span>Registros: {{ answerKeyTotalRows }}</span>
            <span v-if="answerKeySearch">Coincidencias: {{ answerKeyFilteredRows.length }}</span>
          </div>
        </div>
      </section>

      <nav class="subtabs" aria-label="Secciones de claves">
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': answerKeySubTab === ANSWER_KEY_SUBTABS.LIST }"
          @click="answerKeySubTab = ANSWER_KEY_SUBTABS.LIST"
        >
          Registros ({{ answerKeyTotalRows }})
        </button>
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': answerKeySubTab === ANSWER_KEY_SUBTABS.SOURCES }"
          @click="answerKeySubTab = ANSWER_KEY_SUBTABS.SOURCES"
        >
          Archivos cargados ({{ answerKeySourcesCount }})
        </button>
      </nav>

      <section v-if="answerKeySubTab === ANSWER_KEY_SUBTABS.LIST">
        <section class="table-wrapper" v-if="answerKeyHasData">
          <table>
            <thead>
              <tr>
                <th class="col-number">#</th>
                <th>
                  <input
                    ref="answerKeySelectAllRef"
                    type="checkbox"
                    :checked="answerKeyIsAllVisibleSelected"
                    @change="toggleAnswerKeySelectAll($event.target.checked)"
                  />
                </th>
                <th>Área</th>
                <th>Tip</th>
                <th>Litho</th>
                <th>Respuestas</th>
                <th>Observaciones</th>
                <th class="actions-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in answerKeyFilteredRows"
                :key="row.id"
                :class="{ 'row--issue': row.observaciones !== 'Sin observaciones' }"
              >
                <td class="col-number">{{ index + 1 }}</td>
                <td>
                  <input
                    type="checkbox"
                    :checked="answerKeySelection.has(row.id)"
                    @change="toggleAnswerKeySelection(row.id)"
                  />
                </td>
                <td>
                  <template v-if="isAnswerKeyEditing(row.id)">
                    <select class="cell-input" v-model="row.area">
                      <option v-for="option in answerKeyAreaOptions" :key="option" :value="option">
                        {{ option }}
                      </option>
                    </select>
                  </template>
                  <span v-else>{{ row.area || '—' }}</span>
                </td>
                <td>
                  <input
                    v-model="row.tipo"
                    type="text"
                    class="cell-input cell-input--tight"
                    maxlength="1"
                    :readonly="!isAnswerKeyEditing(row.id)"
                    :class="{ 'cell-input--locked': !isAnswerKeyEditing(row.id) }"
                  />
                </td>
                <td>
                  <input
                    v-model="row.litho"
                    type="text"
                    class="cell-input"
                    maxlength="6"
                    :readonly="!isAnswerKeyEditing(row.id)"
                    :class="{ 'cell-input--locked': !isAnswerKeyEditing(row.id) }"
                  />
                </td>
                <td>
                  <textarea
                    v-model="row.answers"
                    class="cell-textarea"
                    rows="2"
                    :readonly="!isAnswerKeyEditing(row.id)"
                    :class="{ 'cell-input--locked': !isAnswerKeyEditing(row.id) }"
                  ></textarea>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': row.observaciones === 'Sin observaciones',
                      'badge--warn': row.observaciones !== 'Sin observaciones',
                    }"
                  >
                    {{ row.observaciones }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    type="button"
                    class="icon-button"
                    :class="{ 'icon-button--active': isAnswerKeyEditing(row.id) }"
                    @click="toggleAnswerKeyEdit(row.id)"
                    :aria-label="isAnswerKeyEditing(row.id) ? 'Cerrar edición' : 'Editar fila'"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 18.5V21h2.5l7.37-7.37-2.5-2.5L5 18.5Zm13.71-7.71a1 1 0 0 0 0-1.42l-2.08-2.08a1 1 0 0 0-1.42 0l-1.79 1.79 3.5 3.5 1.79-1.79Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    @click="removeAnswerKey(row.id)"
                    aria-label="Eliminar fila"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="empty" v-else>
          <p>Importa las claves oficiales para comenzar a trabajar con la tabla.</p>
        </section>
      </section>

      <section v-else class="sources-panel">
        <header class="sources-header">
          <div>
            <h3>Archivos importados</h3>
            <p>Resumen de las claves que has registrado.</p>
          </div>
          <div class="sources-counts">
            <span>Total archivos: {{ answerKeySources.length }}</span>
            <span>Total registros: {{ answerKeyTotalRows }}</span>
          </div>
        </header>

        <div v-if="answerKeySources.length" class="sources-table-wrapper">
          <table class="sources-table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Respuestas</th>
                <th>Identificación</th>
                <th>Fecha y hora</th>
                <th>Registros válidos</th>
                <th>Errores resp.</th>
                <th>Errores id.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in answerKeySources" :key="source.id">
                <td>{{ source.area }}</td>
                <td>{{ source.name }}</td>
                <td>{{ source.identificationName }}</td>
                <td>{{ formatTimestamp(source.timestamp) }}</td>
                <td>{{ source.validRows }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': (source.responseErrors || 0) === 0,
                      'badge--warn': (source.responseErrors || 0) > 0,
                    }"
                  >
                    {{ source.responseErrors || 0 }}
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': (source.identificationErrors || 0) === 0,
                      'badge--warn': (source.identificationErrors || 0) > 0,
                    }"
                  >
                    {{ source.identificationErrors || 0 }}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    @click="removeAnswerKeySource(source.id)"
                    aria-label="Eliminar origen"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty">
          <p>Aún no hay registros de claves importadas para mostrar en el resumen.</p>
        </div>
      </section>
    </section>

    <section
      v-else
      class="tab-content"
    >
      <section class="toolbar">
        <div class="toolbar__left">
          <button type="button" class="btn" @click="openCalificationModal('ponderaciones')">
            Gestionar Ponderaciones
          </button>
          <button type="button" class="btn" @click="openCalificationModal('calificar')" :disabled="!canCalify">
            Calificar
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            @click="() => { resetCalificationResults(); calificationError.value = ''; }"
            :disabled="!calificationHasResults"
          >
            Limpiar resultados
          </button>
        </div>
        <div class="metrics">
          <span>Ponderaciones: {{ ponderationCurrentTotals.questions }}/60 · peso {{ ponderationCurrentTotals.weight.toFixed(2) }}</span>
          <span>Resultados: {{ calificationResults.length }}</span>
        </div>
      </section>

      <div v-if="calificationSummary" class="summary">
        <p><strong>Área:</strong> {{ calificationSummary.area }}</p>
        <p><strong>Último cálculo:</strong> {{ formatTimestamp(calificationSummary.timestamp) }}</p>
        <p><strong>Postulantes:</strong> {{ calificationSummary.totalCandidates }}</p>
        <p>
          <strong>Ponderación aplicada:</strong>
          {{ calificationPonderationArea }} ·
          {{ selectedPonderationTotals.questions }}/60 preguntas ·
          peso {{ selectedPonderationTotals.weight.toFixed(2) }}
        </p>
        <p v-if="calificationSummary.missingResponses">
          Respuestas pendientes: {{ calificationSummary.missingResponses }}
        </p>
        <p v-if="calificationSummary.missingKeys">Claves faltantes: {{ calificationSummary.missingKeys }}</p>
      </div>

      <section class="table-wrapper" v-if="calificationHasResults">
        <table>
          <thead>
            <tr>
              <th class="col-number">#</th>
              <th>DNI</th>
              <th>Apellido paterno</th>
              <th>Apellido materno</th>
              <th>Nombres</th>
              <th>Puntaje</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in calificationResults" :key="row.id">
              <td class="col-number">{{ index + 1 }}</td>
              <td>{{ row.dni }}</td>
              <td>{{ row.paterno || '—' }}</td>
              <td>{{ row.materno || '—' }}</td>
              <td>{{ row.nombres || '—' }}</td>
              <td>{{ row.score.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="empty" v-else>
        <p>Ejecuta una calificación para ver la tabla de resultados.</p>
      </section>
    </section>
  </div>


  <div v-if="showCalificationModal" class="modal" aria-modal="true">
    <div class="modal__content">
      <header class="modal__header">
        <h2>Calificación</h2>
        <button type="button" class="icon-button icon-button--ghost" @click="closeCalificationModal" aria-label="Cerrar">
          ✕
        </button>
      </header>
      
      <!-- Pestañas del modal -->
      <nav class="subtabs subtabs--modal" aria-label="Pestañas de calificación">
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': calificationModalTab === 'ponderaciones' }"
          @click="calificationModalTab = 'ponderaciones'"
        >
          Ponderaciones
        </button>
        <button
          type="button"
          class="subtab"
          :class="{ 'subtab--active': calificationModalTab === 'calificar' }"
          @click="calificationModalTab = 'calificar'"
        >
          Calificar
        </button>
      </nav>

      <!-- Contenido de la pestaña Ponderaciones -->
      <div v-if="calificationModalTab === 'ponderaciones'" class="modal__body">
        <section class="ponderations-panel">
          <header class="sources-header">
            <div>
              <h3>Ponderaciones por área</h3>
              <p>Gestiona las ponderaciones oficiales y ajustes manuales para cada curso.</p>
            </div>
            <div class="sources-counts">
              <span>Área activa: {{ ponderationModalArea }}</span>
              <span>Preguntas: {{ ponderationCurrentTotals.questions }}/60</span>
              <span>Peso total: {{ ponderationCurrentTotals.weight.toFixed(2) }}</span>
            </div>
          </header>

          <nav class="subtabs subtabs--modal" aria-label="Áreas de ponderación">
            <button
              v-for="area in ponderationAreaList"
              :key="area"
              type="button"
              class="subtab"
              :class="{ 'subtab--active': ponderationModalArea === area }"
              @click="ponderationModalArea = area"
            >
              {{ area }}
            </button>
          </nav>

          <div class="ponderations-actions">
            <form class="modal-form" @submit.prevent="addPonderationRow">
              <div class="field">
                <label for="ponderation-subject">Asignatura</label>
                <input
                  id="ponderation-subject"
                  v-model="newPonderation.subject"
                  type="text"
                  class="input"
                  placeholder="Nombre de la asignatura"
                  required
                />
              </div>
              <div class="field">
                <label for="ponderation-count">Cantidad de preguntas</label>
                <input
                  id="ponderation-count"
                  v-model.number="newPonderation.questionCount"
                  type="number"
                  min="1"
                  step="1"
                  class="input"
                  required
                />
              </div>
              <div class="field">
                <label for="ponderation-weight">Ponderación</label>
                <input
                  id="ponderation-weight"
                  v-model.number="newPonderation.ponderation"
                  type="number"
                  min="0"
                  step="0.001"
                  class="input"
                  required
                />
              </div>
              <button type="submit" class="btn">Agregar</button>
            </form>
            <p class="modal-hint">
              Preguntas registradas: {{ ponderationCurrentTotals.questions }}/60 · peso acumulado
              {{ ponderationCurrentTotals.weight.toFixed(2) }}
            </p>
            <div v-if="ponderationError" class="alert alert--error">
              {{ ponderationError }}
            </div>
          </div>

          <section class="table-wrapper modal-table-wrapper ponderation-table-container">
            <div class="table-header-info">
              <span>Total de cursos: {{ ponderationCurrentAreaRows.length }}</span>
            </div>
            <div class="table-scroll-wrapper">
              <table class="modal-table">
                <thead>
                  <tr>
                    <th class="col-number">#</th>
                    <th>Asignatura</th>
                    <th>Preguntas</th>
                    <th>Ponderación</th>
                    <th class="actions-header">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in ponderationCurrentAreaRows" :key="row.id">
                  <td class="col-number">{{ row.order }}</td>
                  <td>
                    <template v-if="isPonderationEditing(row.id)">
                      <input type="text" class="cell-input" v-model="row.subject" />
                    </template>
                    <span v-else>{{ row.subject || '—' }}</span>
                  </td>
                  <td>
                    <template v-if="isPonderationEditing(row.id)">
                      <input type="number" class="cell-input" min="0" step="1" v-model.number="row.questionCount" />
                    </template>
                    <span v-else>{{ row.questionCount }}</span>
                  </td>
                  <td>
                    <template v-if="isPonderationEditing(row.id)">
                      <input type="number" class="cell-input" step="0.001" v-model.number="row.ponderation" />
                    </template>
                    <span v-else>{{ row.ponderation.toFixed(3) }}</span>
                  </td>
                  <td class="actions-cell">
                    <div class="sources-actions">
                      <button
                        type="button"
                        class="icon-button"
                        @click="togglePonderationEditRow(row)"
                        :aria-label="isPonderationEditing(row.id) ? 'Guardar fila' : 'Editar fila'"
                        title="Editar"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            v-if="isPonderationEditing(row.id)"
                            d="M19 13H5v-2h14v2Z"
                            fill="currentColor"
                          />
                          <path
                            v-else
                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04-2.92-2.92a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.03 0-1.42Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="icon-button icon-button--danger"
                        @click="removePonderationRow(row)"
                        aria-label="Eliminar fila"
                        title="Eliminar"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>

      <!-- Contenido de la pestaña Calificar -->
      <form v-if="calificationModalTab === 'calificar'" class="modal__body modal-form" @submit.prevent="runCalification">
        <div class="field">
          <label for="calification-area">Área</label>
          <select id="calification-area" v-model="calificationArea" class="input" required>
            <option v-for="area in calificationAreaOptions" :key="area" :value="area">
              {{ area }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="calification-set">Ponderación</label>
          <select id="calification-set" v-model="calificationPonderationArea" class="input" required>
            <option v-for="area in calificationAreaOptions" :key="area" :value="area">
              {{ area }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="value-correct">Valor respuesta correcta</label>
          <input
            id="value-correct"
            v-model.number="calificationCorrectValue"
            type="number"
            step="0.01"
            class="input"
            required
          />
        </div>
        <div class="field">
          <label for="value-incorrect">Valor respuesta incorrecta</label>
          <input
            id="value-incorrect"
            v-model.number="calificationIncorrectValue"
            type="number"
            step="0.01"
            class="input"
            required
          />
        </div>
        <div class="field">
          <label for="value-blank">Valor respuesta en blanco</label>
          <input
            id="value-blank"
            v-model.number="calificationBlankValue"
            type="number"
            step="0.01"
            class="input"
            required
          />
        </div>

        <div v-if="calificationError" class="alert alert--error modal-alert">
          {{ calificationError }}
        </div>

        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" @click="closeCalificationModal">Cancelar</button>
          <button type="submit" class="btn">Calcular</button>
        </footer>
      </form>
    </div>
  </div>
</template>
<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: #1f2937;
}


.header h1 {
  margin: 0;
  font-size: 2rem;
}

.header p {
  margin: 0.25rem 0 0;
  color: #4b5563;
}

.tabs {
  display: inline-flex;
  gap: 0.5rem;
  background-color: #e2e8f0;
  padding: 0.35rem;
  border-radius: 12px;
  align-self: flex-start;
}

.tab {
  border: none;
  background: transparent;
  padding: 0.5rem 1.25rem;
  border-radius: 10px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.tab--active {
  background: white;
  color: #1d4ed8;
  box-shadow: 0 8px 20px -16px rgba(30, 64, 175, 0.6);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.subtabs {
  display: inline-flex;
  gap: 0.5rem;
  background-color: #e2e8f0;
  padding: 0.35rem;
  border-radius: 12px;
  align-self: flex-start;
}

.subtab {
  border: none;
  background: transparent;
  padding: 0.45rem 1.1rem;
  border-radius: 10px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.subtab--active {
  background: white;
  color: #1d4ed8;
  box-shadow: 0 8px 20px -16px rgba(30, 64, 175, 0.6);
}

.uploader {
  position: relative;
  border: 2px dashed #93c5fd;
  border-radius: 12px;
  padding: 2.5rem 1rem;
  text-align: center;
  background-color: #f8fafc;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.uploader--form {
  text-align: left;
}

.uploader__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  align-items: end;
}

.uploader__form .field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.uploader__form small {
  color: #6b7280;
}

.uploader.dragging {
  border-color: #2563eb;
  background-color: #eff6ff;
}

.uploader label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: #1d4ed8;
  cursor: pointer;
}

.uploader__hint {
  color: #6b7280;
  font-size: 0.85rem;
}

.uploader__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.alert {
  padding: 0.95rem 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
}

.alert--error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  background-color: #f3f4f6;
  border-radius: 10px;
  padding: 1rem;
}

.toolbar__left,
.toolbar__right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.metrics {
  display: flex;
  gap: 0.75rem;
  color: #4b5563;
  font-size: 0.9rem;
}

.btn {
  border: none;
  border-radius: 6px;
  padding: 0.55rem 1rem;
  cursor: pointer;
  background-color: #2563eb;
  color: white;
  font-weight: 600;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.btn .icon {
  display: inline-flex;
  align-items: center;
  margin-right: 0.4rem;
}

.btn .icon svg {
  width: 16px;
  height: 16px;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn:hover:not(:disabled) {
  background-color: #1d4ed8;
  transform: translateY(-1px);
}

.btn--danger {
  background-color: #dc2626;
}

.btn--danger:hover:not(:disabled) {
  background-color: #b91c1c;
}


.ponderations-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.ponderations-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 1rem;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 20;
}

.modal__content {
  background: white;
  border-radius: 14px;
  width: min(960px, 100%);
  max-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 44px -24px rgba(15, 23, 42, 0.35);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.modal__body {
  padding: 1.25rem 1.5rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem 1.25rem;
  border-top: 1px solid #e5e7eb;
}

.modal-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1rem;
  align-items: end;
}

.modal-hint {
  margin: 0;
  color: #1d4ed8;
  font-weight: 600;
}

.modal-table-wrapper {
  display: flex;
  flex-direction: column;
}

.ponderation-table-container {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.ponderation-table-container .table-header-info {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.ponderation-table-container .table-scroll-wrapper {
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
}

.ponderation-table-container .table-scroll-wrapper table {
  width: 100%;
  border-collapse: collapse;
}

.table-header-info {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.ponderations-add-form {
  margin-bottom: 1rem;
}

.ponderations-add-form .form-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

.ponderations-add-form .field--button {
  display: flex;
  align-items: flex-end;
}

.ponderations-stats {
  margin-top: 0.75rem;
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
}

.modal-table th,
.modal-table td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
}

.modal-table th {
  background: #f1f5f9;
  text-align: left;
}

.modal-alert {
  grid-column: 1 / -1;
}

.subtabs--modal {
  align-self: stretch;
}

.btn--ghost {
  background-color: transparent;
  color: #374151;
  border: 1px solid #d1d5db;
}

.input {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #cbd5f5;
  min-width: 220px;
}

.table-wrapper {
  border-radius: 12px;
  border: 1px solid #dbeafe;
  overflow: hidden;
  box-shadow: 0 12px 25px -20px rgba(37, 99, 235, 0.45);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: linear-gradient(90deg, #2563eb, #1d4ed8);
  color: white;
}

th,
td {
  padding: 0.75rem;
  text-align: left;
}

.col-number {
  width: 3rem;
  text-align: center;
  font-weight: 600;
}

.col-type {
  width: 80px;
}

.actions-header {
  width: 170px;
}

tbody tr:nth-child(even) {
  background-color: #ffffff;
}

tbody tr:nth-child(odd) {
  background-color: #f8fafc;
}

tbody tr:hover {
  background-color: #e0f2fe;
}

.row--issue {
  box-shadow: inset 4px 0 0 #f59e0b;
}

.cell-input {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  padding: 0.25rem 0.35rem;
  border-radius: 4px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.cell-input--tight {
  max-width: 60px;
}

.cell-input:focus {
  outline: none;
  border-color: #2563eb;
  background-color: white;
}

.cell-textarea {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  resize: vertical;
  min-height: 48px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  font-family: inherit;
  font-size: 0.95rem;
  padding: 0.35rem 0.45rem;
}

.cell-textarea:focus {
  outline: none;
  border-color: #2563eb;
  background-color: #ffffff;
}

.cell-input--locked {
  color: #4b5563;
  background-color: transparent;
  border-color: transparent;
  cursor: not-allowed;
}

.cell-input--locked:hover {
  background-color: #f1f5f9;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background-color: #ffffff;
  color: #1f2937;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.icon-button:hover {
  background-color: #eff6ff;
  color: #1d4ed8;
  transform: translateY(-1px);
}

.icon-button--active {
  background-color: #e0f2fe;
  border-color: #2563eb;
  color: #1d4ed8;
}

.icon-button--danger {
  border-color: #fca5a5;
  color: #dc2626;
}

.icon-button--danger:hover {
  background-color: #fee2e2;
  color: #b91c1c;
}

.icon-button--ghost {
  background: transparent;
  border-color: transparent;
  color: #6b7280;
}

.icon-button--ghost:hover {
  background: transparent;
  color: #111827;
}

.link {
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  color: #1d4ed8;
}

.link:hover {
  opacity: 0.8;
}

.link.link--danger {
  color: #dc2626;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge--ok {
  background-color: #dcfce7;
  color: #166534;
}

.badge--warn {
  background-color: #fef3c7;
  color: #92400e;
}

.empty {
  text-align: center;
  color: #6b7280;
  padding: 2rem 0;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
}

.adder {
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 1.5rem;
  background-color: #f8fafc;
}

.adder h2 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.adder__form {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  color: #374151;
}

.field input {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #cbd5f5;
}

.adder__actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.sources-panel {
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 1.5rem;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sources-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.sources-header h3 {
  margin: 0;
}

.sources-header p {
  margin: 0.15rem 0 0;
  color: #4b5563;
  font-size: 0.9rem;
}

.sources-counts {
  display: flex;
  gap: 0.75rem;
  font-weight: 600;
  color: #1f2937;
}

.sources-table-wrapper {
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  overflow-x: auto;
  background-color: white;
}

.sources-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 520px;
}

.sources-table th,
.sources-table td {
  padding: 0.65rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid #e0e7ff;
}

.sources-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.sources-actions .btn {
  cursor: pointer;
  text-align: center;
}

.sources-hint {
  color: #4b5563;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .table-wrapper {
    overflow-x: auto;
  }

  table {
    min-width: 860px;
  }
}
</style>
