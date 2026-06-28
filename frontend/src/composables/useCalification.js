import { ref, shallowRef, computed, watch } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS, API_BASE_URL, DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'
import { useToast } from '@/composables/useToast'
import {
  normalize,
  normalizeArea,
  stripDigits,
  buildAreaTipoKey,
  buildQuestionPlan,
} from '@/utils/helpers'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateDefaultName() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.toLocaleDateString('es-PE', { month: 'long' })
  return `Admisión ${year} · ${month.charAt(0).toUpperCase() + month.slice(1)}`
}

const REAL_TEST_TYPES = ['P', 'Q', 'R', 'S', 'T']
const GENERAL_SIMULACRO_AREA = 'General'

function buildDniCounts(rows) {
  const counts = new Map()
  rows.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    counts.set(dni, (counts.get(dni) || 0) + 1)
  })
  return counts
}

function getCandidateDniIssue(candidate, dniCounts) {
  const dni = stripDigits(candidate.dni)
  if (!dni) return 'DNI vacío'
  if (dni.length !== 8) return `DNI incompleto (${dni.length}/8)`
  if ((dniCounts.get(dni) || 0) > 1) return 'DNI duplicado'
  return ''
}

function getExactAnswerKey(rows, area, tipo, areaList) {
  const normalizedArea = normalizeArea(area, areaList)
  const normalizedTipo = (tipo || '').trim().toUpperCase().slice(0, 1)
  if (!normalizedTipo) return undefined
  return rows.find((row) =>
    row.area?.trim() &&
    normalizeArea(row.area, areaList) === normalizedArea &&
    (row.tipo || '').trim().toUpperCase().slice(0, 1) === normalizedTipo
  )
}

export function useCalification(
  archiveRows,
  responsesRows,
  answerKeyRows,
  ponderationsComposable,
  responsesByDni,
  answerKeyLookupByAreaTipo,
  areaNames,
  formatConfig,
  vacantesPrograma,
  answerKeyFallbackByArea
) {
  const { showToast } = useToast()
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )
  const effectiveAnswersLength = computed(() =>
    formatConfig?.value?.answersLength ?? DEFAULT_DAT_FORMAT.answersLength
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESO ACTIVO
  // ═══════════════════════════════════════════════════════════════════════════

  // Migration: strip large areas data from persisted metadata to prevent localStorage overflows
  try {
    const _raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROCESS)
    if (_raw) {
      const _stored = JSON.parse(_raw)
      if (_stored?.areas) {
        const { areas: _ignored, ...meta } = _stored
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROCESS, JSON.stringify(meta))
      }
    }
  } catch {}

  // Only metadata persists — areas/results live in memory only
  const _processMeta = useStorage(STORAGE_KEYS.ACTIVE_PROCESS, {
    id: null,
    name: '',
    type: 'simulacro',
    simulacroScope: '',
  })
  const _areasData = shallowRef({})

  // Composite proxy with same interface as the old useStorage ref
  const activeProcess = computed({
    get: () => ({
      id: _processMeta.value.id,
      name: _processMeta.value.name,
      type: _processMeta.value.type,
      simulacroScope: _processMeta.value.simulacroScope || '',
      areas: _areasData.value,
    }),
    set: (val) => {
      _processMeta.value = {
        id: val?.id ?? null,
        name: val?.name ?? '',
        type: val?.type ?? 'simulacro',
        simulacroScope: val?.simulacroScope ?? _processMeta.value.simulacroScope ?? '',
      }
      _areasData.value = val?.areas ?? {}
    },
  })

  const processName = ref(_processMeta.value.name || '')
  const processType = computed({
    get: () => _processMeta.value.type || 'simulacro',
    set: (val) => { _processMeta.value = { ..._processMeta.value, type: val } },
  })
  const inferredSimulacroScope = computed(() =>
    archiveRows.value.some(row => row.area?.trim()) ? 'areas' : 'general'
  )
  const simulacroScope = computed({
    get: () => _processMeta.value.simulacroScope || inferredSimulacroScope.value,
    set: (val) => { _processMeta.value = { ..._processMeta.value, simulacroScope: val } },
  })
  const isGeneralSimulacro = computed(() =>
    processType.value !== 'real' && simulacroScope.value === 'general'
  )

  const calificationDisplayArea = ref(
    Object.keys(activeProcess.value.areas || {})[0] || null
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DEL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  const showCalificationModal = ref(false)
  const calificationArea = ref(
    isGeneralSimulacro.value ? GENERAL_SIMULACRO_AREA : (effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0])
  )
  const calificationPlantillaId = ref(null)   // reemplaza calificationPonderationArea
  const calificationError = ref('')
  const calificationSearch = ref('')

  const calificationConfigStorage = useStorage(STORAGE_KEYS.CALIFICATION_CONFIG, {})
  const calificationConfigApiLoading = ref(false)
  const calificationConfigApiSyncing = ref(false)
  const calificationConfigApiReady = ref(false)
  let skipNextCalificationConfigSync = false

  function getConfigForArea(area) {
    const stored = calificationConfigStorage.value[area]
    return {
      correctValue: stored?.correctValue ?? 10,
      incorrectValue: stored?.incorrectValue ?? 0,
      blankValue: stored?.blankValue ?? 2,
    }
  }

  function initConfigForArea(area) {
    if (!calificationConfigStorage.value[area]) {
      calificationConfigStorage.value[area] = { correctValue: 10, incorrectValue: 0, blankValue: 2 }
    }
  }

  async function initializeCalificationConfig() {
    calificationConfigApiLoading.value = true
    try {
      const res = await apiFetch('/calification-configs/')
      if (!res.ok) throw new Error('No se pudo cargar la configuración de calificación.')

      const data = await res.json()
      calificationConfigApiReady.value = true

      if (data.length > 0) {
        skipNextCalificationConfigSync = true
        calificationConfigStorage.value = Object.fromEntries(
          data.map((row) => [
            row.area,
            {
              correctValue: Number(row.correctValue),
              incorrectValue: Number(row.incorrectValue),
              blankValue: Number(row.blankValue),
            },
          ]),
        )
      } else if (Object.keys(calificationConfigStorage.value || {}).length > 0) {
        await syncCalificationConfigToApi()
      }
    } catch (error) {
      console.warn('[calification] API no disponible para configuración, usando localStorage:', error)
      calificationConfigApiReady.value = false
    } finally {
      calificationConfigApiLoading.value = false
    }
  }

  async function syncCalificationConfigToApi() {
    if (!calificationConfigApiReady.value) return

    calificationConfigApiSyncing.value = true
    try {
      const configs = Object.entries(calificationConfigStorage.value || {}).map(([area, cfg]) => ({
        area,
        correctValue: cfg?.correctValue ?? 10,
        incorrectValue: cfg?.incorrectValue ?? 0,
        blankValue: cfg?.blankValue ?? 2,
      }))

      const res = await apiFetch('/calification-configs/bulk_replace/', {
        method: 'POST',
        body: JSON.stringify({ configs }),
      })
      if (!res.ok) throw new Error('No se pudo guardar la configuración de calificación.')
    } catch (error) {
      console.warn('[calification] No se pudo sincronizar configuración:', error)
    } finally {
      calificationConfigApiSyncing.value = false
    }
  }

  watchDebounced(
    calificationConfigStorage,
    () => {
      if (skipNextCalificationConfigSync) {
        skipNextCalificationConfigSync = false
        return
      }
      syncCalificationConfigToApi()
    },
    { debounce: 800, deep: true },
  )

  const calificationCorrectValue = ref(10)
  const calificationIncorrectValue = ref(0)
  const calificationBlankValue = ref(2)

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADOS REACTIVOS
  // ═══════════════════════════════════════════════════════════════════════════

  const processAreas = computed(() => Object.keys(activeProcess.value.areas || {}))

  const calificationResults = computed(() => {
    const area = calificationDisplayArea.value
    return area ? (activeProcess.value.areas[area]?.results || []) : []
  })

  const calificationSummary = computed(() => {
    const area = calificationDisplayArea.value
    return area ? (activeProcess.value.areas[area]?.summary || null) : null
  })

  const calificationAllResults = computed(() =>
    Object.values(activeProcess.value.areas || {}).flatMap(a => a.results || [])
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  const calificationFilteredResults = computed(() => {
    if (!calificationSearch.value.trim()) return calificationResults.value
    const needle = normalize(calificationSearch.value)
    return calificationResults.value.filter((row) =>
      normalize(row.dni).includes(needle) ||
      normalize(row.paterno).includes(needle) ||
      normalize(row.materno).includes(needle) ||
      normalize(row.nombres).includes(needle)
    )
  })

  // Plantillas disponibles para el área actualmente seleccionada en el modal
  const availablePlantillas = computed(() => {
    if (isGeneralSimulacro.value) {
      return ponderationsComposable.plantillas.value
        .slice()
        .sort((a, b) => {
          const aReady = a.questionTotal === effectiveAnswersLength.value ? 0 : 1
          const bReady = b.questionTotal === effectiveAnswersLength.value ? 0 : 1
          return aReady - bReady || String(a.name).localeCompare(String(b.name), 'es')
        })
    }
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    return ponderationsComposable.getPlantillasForCalification(area)
  })

  const selectedCalificationPlantilla = computed(() =>
    ponderationsComposable.getPlantillaById(calificationPlantillaId.value)
  )

  const selectedPonderationTotals = computed(() => {
    const plantilla = selectedCalificationPlantilla.value
    if (!plantilla) return { questions: 0, weight: 0 }
    const items = plantilla.items || []
    return {
      questions: plantilla.questionTotal || 0,
      weight: items.reduce((a, i) => a + Number(i.ponderation) * Number(i.questionCount), 0),
    }
  })

  const calificationAreaOptions = computed(() =>
    isGeneralSimulacro.value ? [GENERAL_SIMULACRO_AREA] : effectiveAreaNames.value
  )
  const calificationHasResults = computed(() => processAreas.value.length > 0)

  // Programas de estudio del área actualmente seleccionada en el modal
  const programasForCurrentArea = computed(() => {
    if (isGeneralSimulacro.value) return []
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const set = new Set()
    archiveRows.value.forEach(r => {
      if (normalizeArea(r.area, effectiveAreaNames.value) === area && r.programa?.trim())
        set.add(r.programa.trim())
    })
    return Array.from(set).sort()
  })

  // ── Pre-vuelo ─────────────────────────────────────────────────────────────
  const preflightCheck = computed(() => {
    const area = isGeneralSimulacro.value
      ? GENERAL_SIMULACRO_AREA
      : normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const isRealProcess = processType.value === 'real'
    const dniCounts = buildDniCounts(archiveRows.value)

    // 1. Candidatos del padrón en esta área
    const candidates = isGeneralSimulacro.value
      ? archiveRows.value
      : archiveRows.value.filter(r => normalizeArea(r.area, effectiveAreaNames.value) === area)

    // Simulacro sin columna área: si no hay candidatos con área, usar los sin área asignada.
    // En real no se aplica este fallback porque área/programa deben venir del padrón.
    const unassignedCandidates = archiveRows.value.filter(r => !r.area?.trim())
    const usingFallback = !isRealProcess && candidates.length === 0 && unassignedCandidates.length > 0
    const effectiveCandidates = usingFallback ? unassignedCandidates : candidates

    // 2. Candidatos sin respuesta .dat
    const withoutResponse = effectiveCandidates.filter(c => {
      const dni = stripDigits(c.dni)
      return !responsesByDni.value.has(dni) || responsesByDni.value.get(dni).length === 0
    })
    const duplicatedResponses = effectiveCandidates.filter(c => {
      const dni = stripDigits(c.dni)
      return dni && (responsesByDni.value.get(dni) || []).length > 1
    })
    const invalidDniCandidates = effectiveCandidates.filter(c => getCandidateDniIssue(c, dniCounts))

    // 3. Respuestas .dat sin candidato en el padrón
    const allDnisInPadron = new Set(archiveRows.value.map(r => stripDigits(r.dni)))
    const orphanResponses = [...responsesByDni.value.entries()].filter(([dni]) => !allDnisInPadron.has(dni))

    // 4. Claves de respuesta para el área
    const areaAnswerKeys = answerKeyRows.value.filter(
      k => k.area?.trim() && normalizeArea(k.area, effectiveAreaNames.value) === area
    )
    const generalAnswerKeys = answerKeyRows.value.filter(k => !k.area?.trim())
    const keyTypes = new Set(areaAnswerKeys.map(k => (k.tipo || '').trim().toUpperCase().slice(0, 1)).filter(Boolean))
    const missingRealKeyTypes = REAL_TEST_TYPES.filter(tipo => !keyTypes.has(tipo))
    const hasAnswerKeys = isRealProcess
      ? missingRealKeyTypes.length === 0
      : isGeneralSimulacro.value
        ? generalAnswerKeys.length > 0 || answerKeyRows.value.length > 0
        : areaAnswerKeys.length > 0 || generalAnswerKeys.length > 0

    // 5. Respuestas .dat sin DNI vinculado
    const unlinked = archiveRows.value.length > 0
      ? responsesRows.value.filter(r => !stripDigits(r.dni)).length
      : 0

    const missingTipoResponses = isRealProcess
      ? effectiveCandidates.filter((candidate) => {
        const dni = stripDigits(candidate.dni)
        const responseList = responsesByDni.value.get(dni) || []
        return responseList.some(r => !(r.tipo || '').trim())
      }).length
      : 0

    const items = [
      {
        key: 'candidates',
        label: 'Postulantes en el padrón',
        value: effectiveCandidates.length,
        status: effectiveCandidates.length > 0 ? 'ok' : 'error',
        detail: effectiveCandidates.length === 0 ? 'No hay postulantes para esta área en el padrón.' : null,
      },
    ]

    if (usingFallback) {
      items.push({
        key: 'noArea',
        label: 'Sin área asignada',
        value: unassignedCandidates.length,
        status: 'warn',
        detail: `El padrón no tiene columna de área — se incluirán los ${unassignedCandidates.length} postulante(s) sin área en el cálculo.`,
      })
    }

    if (isRealProcess && unassignedCandidates.length > 0) {
      items.push({
        key: 'missingArea',
        label: 'Postulantes sin área',
        value: unassignedCandidates.length,
        status: 'warn',
        detail: 'Estos postulantes no entrarán al cálculo del área hasta corregir el padrón.',
      })
    }

    items.push(
      {
        key: 'answerKeys',
        label: isRealProcess ? 'Claves P/Q/R/S/T' : 'Claves de respuestas',
        value: hasAnswerKeys ? 'Disponibles' : 'No encontradas',
        status: hasAnswerKeys ? 'ok' : 'error',
        detail: !hasAnswerKeys
          ? (isRealProcess
            ? `Faltan claves para ${area}: ${missingRealKeyTypes.join(', ')}.`
            : 'No se encontraron claves para esta área. Sin claves no es posible calificar.')
          : null,
      },
      {
        key: 'invalidDni',
        label: 'DNI observado en padrón',
        value: invalidDniCandidates.length,
        status: invalidDniCandidates.length === 0 ? 'ok' : 'warn',
        detail: invalidDniCandidates.length > 0
          ? `${invalidDniCandidates.length} postulante(s) con DNI vacío, incompleto o duplicado quedarán como no calificados.`
          : null,
      },
      {
        key: 'withoutResponse',
        label: 'Sin respuesta .dat',
        value: withoutResponse.length,
        status: withoutResponse.length === 0 ? 'ok' : 'warn',
        detail: withoutResponse.length > 0
          ? `${withoutResponse.length} postulante(s) no tienen respuesta cargada y no se calificarán.`
          : null,
      },
      {
        key: 'duplicatedResponses',
        label: 'Respuestas duplicadas',
        value: duplicatedResponses.length,
        status: duplicatedResponses.length === 0 ? 'ok' : 'warn',
        detail: duplicatedResponses.length > 0
          ? `${duplicatedResponses.length} postulante(s) tienen más de una respuesta .dat y no se calificarán.`
          : null,
      },
      {
        key: 'orphan',
        label: 'Respuestas sin postulante',
        value: orphanResponses.length,
        status: orphanResponses.length === 0 ? 'ok' : 'warn',
        detail: orphanResponses.length > 0
          ? `${orphanResponses.length} respuesta(s) .dat no coinciden con ningún DNI del padrón.`
          : null,
      },
    )

    if (unlinked > 0) {
      items.push({
        key: 'unlinked',
        label: 'Respuestas sin DNI',
        value: unlinked,
        status: 'warn',
        detail: `${unlinked} respuesta(s) sin DNI vinculado (no se calificarán).`,
      })
    }

    if (missingTipoResponses > 0) {
      items.push({
        key: 'missingTipo',
        label: 'Respuestas sin tipo',
        value: missingTipoResponses,
        status: 'warn',
        detail: 'Estos postulantes quedarán como no calificados porque el modo real requiere tipo P, Q, R, S o T.',
      })
    }

    // Modo Real: advertir si ningún candidato tiene programa asignado
    if (isRealProcess) {
      const sinPrograma = effectiveCandidates.filter(c => !c.programa?.trim()).length
      if (sinPrograma > 0) {
        items.push({
          key: 'sinPrograma',
          label: 'Sin programa de estudios',
          value: sinPrograma,
          status: 'warn',
          detail: sinPrograma === effectiveCandidates.length
            ? 'Ningún postulante tiene programa asignado. Quedarán como no calificados hasta corregir el padrón.'
            : `${sinPrograma} postulante(s) sin programa quedarán como no calificados.`,
        })
      }
    }

    const hasBlockers = effectiveCandidates.length === 0 || !hasAnswerKeys || items.some(i => i.status === 'error')
    const hasWarnings = items.some(i => i.status === 'warn')

    return { items, hasBlockers, hasWarnings }
  })

  const selectedPonderationIsReady = computed(() => {
    const plantilla = selectedCalificationPlantilla.value
    return plantilla?.questionTotal === effectiveAnswersLength.value
  })

  const canCalify = computed(() =>
    responsesRows.value.length > 0 &&
    answerKeyRows.value.length > 0 &&
    ponderationsComposable.plantillas.value.length > 0
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  watch(calificationArea, (area) => {
    if (isGeneralSimulacro.value) {
      calificationArea.value = GENERAL_SIMULACRO_AREA
      return
    }
    const normalized = normalizeArea(area, effectiveAreaNames.value)
    initConfigForArea(normalized)
    const cfg = getConfigForArea(normalized)
    calificationCorrectValue.value = cfg.correctValue
    calificationIncorrectValue.value = cfg.incorrectValue
    calificationBlankValue.value = cfg.blankValue

    // Si la plantilla seleccionada no aplica al nuevo área, auto-seleccionar una válida
    const available = ponderationsComposable.getPlantillasForCalification(normalized)
    const currentStillValid = calificationPlantillaId.value &&
      available.find(p => p.id === calificationPlantillaId.value)
    if (!currentStillValid && available.length > 0) {
      const readyFirst = available.find(p => p.questionTotal === effectiveAnswersLength.value)
      calificationPlantillaId.value = readyFirst?.id || available[0].id
    }
  })

  watch([processType, simulacroScope, inferredSimulacroScope], () => {
    if (processType.value !== 'real' && !simulacroScope.value) {
      simulacroScope.value = inferredSimulacroScope.value
    }
    if (isGeneralSimulacro.value) {
      calificationArea.value = GENERAL_SIMULACRO_AREA
    } else if (calificationArea.value === GENERAL_SIMULACRO_AREA) {
      calificationArea.value = effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0]
    }
  }, { immediate: true })

  watch(() => activeProcess.value.name, (name) => {
    processName.value = name || ''
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS — MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openCalificationModal() {
    if (!canCalify.value) {
      calificationError.value = 'Necesitas cargar respuestas y claves antes de calificar.'
      return
    }

    if (processType.value !== 'real' && !_processMeta.value.simulacroScope) {
      simulacroScope.value = inferredSimulacroScope.value
    }
    if (isGeneralSimulacro.value) {
      calificationArea.value = GENERAL_SIMULACRO_AREA
    }

    const area = isGeneralSimulacro.value
      ? GENERAL_SIMULACRO_AREA
      : normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const available = isGeneralSimulacro.value
      ? availablePlantillas.value
      : ponderationsComposable.getPlantillasForCalification(area)

    if (!available.length) {
      calificationError.value = `No hay plantillas configuradas para el área ${area}.`
      return
    }

    const currentStillValid = calificationPlantillaId.value &&
      available.find(p => p.id === calificationPlantillaId.value)

    if (!currentStillValid) {
      const readyFirst = available.find(p => p.questionTotal === effectiveAnswersLength.value)
      calificationPlantillaId.value = readyFirst?.id || available[0].id
    }

    initConfigForArea(area)
    const cfg = getConfigForArea(area)
    calificationCorrectValue.value = cfg.correctValue
    calificationIncorrectValue.value = cfg.incorrectValue
    calificationBlankValue.value = cfg.blankValue

    if (!processName.value) {
      processName.value = generateDefaultName()
    }

    calificationError.value = ''
    showCalificationModal.value = true
  }

  function closeCalificationModal() {
    showCalificationModal.value = false
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS — PROCESO
  // ═══════════════════════════════════════════════════════════════════════════

  function startNewProcess({ name = '', type = 'simulacro' } = {}) {
    activeProcess.value = { id: null, name, type, simulacroScope: inferredSimulacroScope.value, areas: {} }
    calificationDisplayArea.value = null
    processName.value = name
    processType.value = type
    simulacroScope.value = inferredSimulacroScope.value
    calificationSearch.value = ''
  }

  function switchDisplayArea(area) {
    calificationDisplayArea.value = area
    calificationSearch.value = ''
  }

  function getActiveProcess() {
    if (!activeProcess.value.id || processAreas.value.length === 0) return null
    return { ...activeProcess.value }
  }

  function loadProcess(process) {
    activeProcess.value = { ...process }
    processName.value = process.name || ''
    processType.value = process.type || 'simulacro'
    simulacroScope.value = process.simulacroScope || inferredSimulacroScope.value
    const areas = Object.keys(process.areas || {})
    calificationDisplayArea.value = areas[0] || null
    calificationSearch.value = ''
  }

  function resetCalificationResults() {
    startNewProcess()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS — API
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // CALIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Núcleo del cálculo para un área dada. Devuelve { results, summary } o lanza un string de error.
   */
  function _calcForArea(area, plantilla, correctValue, incorrectValue, blankValue) {
    const isRealProcess = processType.value === 'real'
    const generalSimulacro = !isRealProcess && simulacroScope.value === 'general'
    const calculationArea = generalSimulacro ? GENERAL_SIMULACRO_AREA : area
    const answersLength = effectiveAnswersLength.value
    const plan = buildQuestionPlan(plantilla.items)

    if (plan.length !== answersLength) {
      throw new Error(`La plantilla "${plantilla.name}" cubre ${plan.length} preguntas. Deben sumar ${answersLength}.`)
    }

    const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)

    let candidates = generalSimulacro
      ? archiveRows.value
      : archiveRows.value.filter((row) => normalizeArea(row.area, effectiveAreaNames.value) === area)

    if (isRealProcess) {
      const areaAnswerKeys = answerKeyRows.value.filter(
        k => k.area?.trim() && normalizeArea(k.area, effectiveAreaNames.value) === area
      )
      const keyTypes = new Set(areaAnswerKeys.map(k => (k.tipo || '').trim().toUpperCase().slice(0, 1)).filter(Boolean))
      const missingRealKeyTypes = REAL_TEST_TYPES.filter(tipo => !keyTypes.has(tipo))
      if (missingRealKeyTypes.length > 0) {
        throw new Error(`Faltan claves para ${area}: ${missingRealKeyTypes.join(', ')}.`)
      }
    }

    // Solo simulacro puede tomar un padrón sin área asignada.
    if (!isRealProcess && !generalSimulacro && candidates.length === 0) {
      const unassigned = archiveRows.value.filter(r => !r.area?.trim())
      if (unassigned.length > 0) candidates = unassigned
    }

    if (!candidates.length) {
      throw new Error('No hay postulantes registrados para el área seleccionada.')
    }

    const processedResults = []
    const noCalificados = []
    const dniCounts = buildDniCounts(archiveRows.value)
    let missingResponses = 0
    let missingKeys = 0
    let duplicateResponses = 0
    let invalidCandidates = 0
    let missingPrograms = 0
    let invalidResponseTypes = 0

    candidates.forEach((candidate) => {
      const dni = stripDigits(candidate.dni)

      const baseNoCalificado = {
        dni,
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        area: calculationArea,
        programa: candidate.programa || '',
      }

      const dniIssue = getCandidateDniIssue(candidate, dniCounts)
      if (dniIssue) {
        invalidCandidates += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: dniIssue,
          detalle: 'Corrige el DNI en el padrón para poder vincular y calificar al postulante.',
        })
        return
      }

      if (isRealProcess && !candidate.programa?.trim()) {
        missingPrograms += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: 'Sin programa de estudios',
          detalle: 'En convocatoria real se requiere programa para el ranking por carrera.',
        })
        return
      }

      const responseList = responsesByDni.value.get(dni) || []

      if (!responseList.length) {
        missingResponses += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: 'Sin respuesta .dat',
          detalle: 'No se encontró una hoja de respuestas vinculada al DNI.',
        })
        return
      }

      if (responseList.length > 1) {
        duplicateResponses += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: 'Respuesta duplicada',
          detalle: `Se encontraron ${responseList.length} hojas de respuestas para el mismo DNI.`,
        })
        return
      }

      const matchForArea = responseList
        .map((row) => {
          const tipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
          if (isRealProcess && !REAL_TEST_TYPES.includes(tipo)) {
            return {
              row,
              answer: null,
              invalidTipo: tipo || 'vacío',
            }
          }
          const key = buildAreaTipoKey(area, tipo, effectiveAreaNames.value)
          const exactAnswer = isRealProcess
            ? getExactAnswerKey(answerKeyRows.value, area, tipo, effectiveAreaNames.value)
            : generalSimulacro
              ? answerKeyRows.value.find(k => !k.area?.trim()) || answerKeyRows.value[0]
              : key ? answerKeyLookupByAreaTipo.value.get(key) : undefined
          const answer = isRealProcess
            ? exactAnswer
            : generalSimulacro
              ? exactAnswer
              : exactAnswer
                ?? answerKeyFallbackByArea?.value?.get(normalizeArea(area, effectiveAreaNames.value))
                ?? answerKeyRows.value.find(k => !k.area?.trim())
          return { row, answer, invalidTipo: '' }
        })
        .find((item) => item.answer || item.invalidTipo)

      if (matchForArea?.invalidTipo) {
        invalidResponseTypes += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: 'Tipo de prueba inválido',
          detalle: `En convocatoria real la respuesta tiene tipo ${matchForArea.invalidTipo}; debe ser P, Q, R, S o T.`,
        })
        return
      }

      if (!matchForArea || !matchForArea.answer) {
        missingKeys += 1
        noCalificados.push({
          ...baseNoCalificado,
          motivo: 'Sin clave',
          detalle: 'No se pudo asociar la respuesta con una clave válida para el área.',
        })
        return
      }

      const { row: responseRow, answer: answerRow } = matchForArea
      const answersRaw = (responseRow?.answers || '').toUpperCase()
      const correctAnswersRaw = (answerRow?.answers || '').toUpperCase()
      const answers = answersRaw.padEnd(plan.length, ' ').slice(0, plan.length)
      const correctAnswers = correctAnswersRaw.padEnd(plan.length, ' ').slice(0, plan.length)

      let total = 0
      for (let index = 0; index < plan.length; index += 1) {
        const weight = Number(plan[index]?.weight) || 0
        if (weight <= 0) continue

        const responseChar = answers[index] || ' '
        const correctChar = correctAnswers[index] || ' '
        const isCorrectCharValid = /^[A-E]$/.test(correctChar)
        const isResponseCharValid = /^[A-E]$/.test(responseChar)

        if (!isCorrectCharValid) {
          throw new Error(`La clave oficial contiene una respuesta inválida en la pregunta ${index + 1}.`)
        }

        let contribution = 0
        if (isCorrectCharValid && isResponseCharValid && responseChar === correctChar) {
          contribution = correctValue * weight
        } else if (isResponseCharValid) {
          contribution = incorrectValue * weight
        } else {
          contribution = blankValue * weight
        }

        total += contribution
      }

      processedResults.push({
        id: `${stripDigits(candidate.dni)}-${calculationArea}`,
        dni: stripDigits(candidate.dni),
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        area: calculationArea,
        programa: candidate.programa || '',
        score: Math.round(total * 1000) / 1000,
        position: 0,
        positionInPrograma: 0,
        isIngresante: false,
        answersRaw: answers,
        correctAnswersRaw: correctAnswers,
        aula: responseRow.aula || '',
        tipo: responseRow.tipo || '',
        litho: responseRow.litho || '',
        corId: responseRow.examCode || '',
      })
    })

    if (isRealProcess) {
      const byPrograma = new Map()
      processedResults.forEach((r) => {
        const prog = r.programa || ''
        if (!byPrograma.has(prog)) byPrograma.set(prog, [])
        byPrograma.get(prog).push(r)
      })

      byPrograma.forEach((rows, prog) => {
        rows.sort((a, b) => b.score - a.score)
        const cupo = vacantesPrograma?.value?.[prog] ?? 0
        rows.forEach((r, i) => {
          r.positionInPrograma = i + 1
          r.isIngresante = cupo > 0 && r.positionInPrograma <= cupo
        })
      })
    }

    processedResults.sort((a, b) => b.score - a.score)
    processedResults.forEach((r, i) => { r.position = i + 1 })

    const unlinkedResponses = responsesRows.value.filter(
      (r) => !r.dni || r.dni.trim() === ''
    ).length

    const plantillaSnapshot = (plantilla.items || []).map(i => ({
      subject: i.subject,
      questionCount: i.questionCount,
      ponderation: i.ponderation,
    }))

    const summary = {
      area: calculationArea,
      timestamp: new Date().toISOString(),
      totalCandidates: candidates.length,
      missingResponses,
      missingKeys,
      duplicateResponses,
      invalidCandidates,
      missingPrograms,
      invalidResponseTypes,
      unlinkedResponses,
      noCalificados,
      totalWeight: Number(totalWeight.toFixed(3)),
      answersLength,
      correctValue,
      incorrectValue,
      blankValue,
      plantillaId: plantilla.id,
      plantillaName: plantilla.name,
      plantillaSnapshot,
    }

    return { results: processedResults, summary }
  }

  function runCalification() {
    calificationError.value = ''

    const area = isGeneralSimulacro.value
      ? GENERAL_SIMULACRO_AREA
      : normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const plantilla = ponderationsComposable.getPlantillaById(calificationPlantillaId.value)
    if (!plantilla) {
      const msg = 'Selecciona una plantilla de ponderación.'
      calificationError.value = msg
      showToast(msg, 'error')
      return
    }

    const correctValue = Number(calificationCorrectValue.value)
    const incorrectValue = Number(calificationIncorrectValue.value)
    const blankValue = Number(calificationBlankValue.value)

    if (!Number.isFinite(correctValue)) { calificationError.value = 'El valor para respuesta correcta no es válido.'; showToast(calificationError.value, 'error'); return }
    if (!Number.isFinite(incorrectValue)) { calificationError.value = 'El valor para respuesta incorrecta no es válido.'; showToast(calificationError.value, 'error'); return }
    if (!Number.isFinite(blankValue)) { calificationError.value = 'El valor para respuesta en blanco no es válido.'; showToast(calificationError.value, 'error'); return }

    let areaResult
    try {
      areaResult = _calcForArea(area, plantilla, correctValue, incorrectValue, blankValue)
    } catch (e) {
      console.error('[runCalification] error:', e)
      calificationError.value = e?.message || String(e)
      showToast(calificationError.value, 'error', 8000)
      return
    }

    const currentId = activeProcess.value.id || generateId()
    const currentName = processName.value.trim() || generateDefaultName()

    activeProcess.value = {
      id: currentId,
      name: currentName,
      type: processType.value,
      simulacroScope: simulacroScope.value,
      areas: {
        ...activeProcess.value.areas,
        [area]: areaResult,
      },
    }

    calificationDisplayArea.value = area
    calificationConfigStorage.value[area] = { correctValue, incorrectValue, blankValue }

    // Avanzar automáticamente a la siguiente área pendiente, o cerrar si ya no hay
    const nextPending = effectiveAreaNames.value.find(
      (a) => !isGeneralSimulacro.value &&
             normalizeArea(a, effectiveAreaNames.value) !== area &&
             !activeProcess.value.areas[normalizeArea(a, effectiveAreaNames.value)]
    )
    if (nextPending) {
      calificationArea.value = nextPending
    } else {
      showCalificationModal.value = false
      _saveProcesoToApi()
    }
  }

  /**
   * Califica todas las áreas disponibles de una sola vez.
   * Usa la plantilla lista (questionTotal === answersLength) de cada área, o la primera disponible.
   * Devuelve { calculated: string[], skipped: string[] }
   */
  function runAllAreas() {
    calificationError.value = ''

    const calculated = []
    const skippedDetails = []
    const newAreas = { ...activeProcess.value.areas }

    const areasToRun = isGeneralSimulacro.value ? [GENERAL_SIMULACRO_AREA] : effectiveAreaNames.value

    for (const areaName of areasToRun) {
      const area = normalizeArea(areaName, effectiveAreaNames.value)
      const calculationArea = isGeneralSimulacro.value ? GENERAL_SIMULACRO_AREA : area
      const available = isGeneralSimulacro.value
        ? availablePlantillas.value
        : ponderationsComposable.getPlantillasForCalification(area)

      if (!available.length) {
        skippedDetails.push({ area: areaName, reason: 'Sin plantilla configurada' })
        continue
      }

      // Respetar la plantilla elegida por el usuario si aplica a este área
      const userSelected = calificationPlantillaId.value &&
        available.find(p => p.id === calificationPlantillaId.value)
      const readyFirst = available.find(
        p => !isGeneralSimulacro.value && p.area === area && p.questionTotal === effectiveAnswersLength.value
      ) || available.find(p => p.questionTotal === effectiveAnswersLength.value)
      const plantilla = userSelected || readyFirst || available[0]
      const { correctValue, incorrectValue, blankValue } = getConfigForArea(calculationArea)

      try {
        newAreas[calculationArea] = _calcForArea(calculationArea, plantilla, correctValue, incorrectValue, blankValue)
        calculated.push(calculationArea)
      } catch (e) {
        skippedDetails.push({ area: areaName, reason: e?.message || 'Error desconocido' })
      }
    }

    if (!calculated.length) {
      calificationError.value = 'No se pudo calificar ninguna área. Verifica las plantillas y el padrón.'
      return null
    }

    const currentId = activeProcess.value.id || generateId()
    const currentName = processName.value.trim() || generateDefaultName()

    activeProcess.value = {
      id: currentId,
      name: currentName,
      type: processType.value,
      simulacroScope: simulacroScope.value,
      areas: newAreas,
    }

    calificationDisplayArea.value = calculated[0]
    showCalificationModal.value = false
    _saveProcesoToApi()

    if (skippedDetails.length > 0) {
      const detail = skippedDetails.map(s => `${s.area}: ${s.reason}`).join(' · ')
      showToast(`Áreas no calculadas — ${detail}`, 'warning', 8000)
    }

    return { calculated, skipped: skippedDetails.map(s => s.area) }
  }

  async function _saveProcesoToApi() {
    const proceso = activeProcess.value
    if (!proceso?.id || !Object.keys(proceso.areas || {}).length) return
    try {
      const res = await apiFetch('/procesos/', {
        method: 'POST',
        body: JSON.stringify({
          local_id: proceso.id,
          name: proceso.name,
          type: proceso.type || 'simulacro',
          simulacroScope: proceso.simulacroScope || '',
          areas: proceso.areas,
        }),
      })
      if (!res.ok) throw new Error()
    } catch {
      showToast('No se pudo guardar el proceso en el historial. Intenta desde el botón "Guardar".', 'warning', 5000)
    }
  }

  return {
    // Modal state
    showCalificationModal,
    calificationConfigApiLoading,
    calificationConfigApiSyncing,
    calificationConfigApiReady,
    calificationArea,
    calificationPlantillaId,
    calificationCorrectValue,
    calificationIncorrectValue,
    calificationBlankValue,
    calificationError,
    calificationSearch,
    processName,
    processType,
    simulacroScope,
    inferredSimulacroScope,
    isGeneralSimulacro,

    // Results
    calificationResults,
    calificationSummary,
    calificationAllResults,
    calificationFilteredResults,
    processAreas,
    calificationDisplayArea,

    // Computed
    calificationAreaOptions,
    calificationHasResults,
    availablePlantillas,
    selectedCalificationPlantilla,
    selectedPonderationTotals,
    selectedPonderationIsReady,
    canCalify,
    preflightCheck,
    programasForCurrentArea,

    // Methods
    initializeCalificationConfig,
    syncCalificationConfigToApi,
    openCalificationModal,
    closeCalificationModal,
    runCalification,
    runAllAreas,
    resetCalificationResults,
    startNewProcess,
    switchDisplayArea,
    getActiveProcess,
    loadProcess,
    activeProcess,
  }
}
