import { ref, shallowRef, computed, watch } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS, API_BASE_URL, DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'
import { useToast } from '@/composables/useToast'
import {
  normalize,
  normalizeArea,
} from '@/utils/helpers'
import {
  GENERAL_SIMULACRO_AREA,
} from '@/utils/calificationHelpers'
import { calculateAreaResults } from '@/domain/calification/calculateResults'
import { buildCalificationPreflight } from '@/domain/calification/preflight'
import { validateCalificationResult } from '@/domain/calification/validateResults'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateDefaultName() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.toLocaleDateString('es-PE', { month: 'long' })
  return `Admisión ${year} · ${month.charAt(0).toUpperCase() + month.slice(1)}`
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
  const preflightCheck = computed(() => buildCalificationPreflight({
    area: calificationArea.value,
    processType: processType.value,
    simulacroScope: simulacroScope.value,
    archiveRows: archiveRows.value,
    responsesRows: responsesRows.value,
    answerKeyRows: answerKeyRows.value,
    responsesByDni: responsesByDni.value,
    areaList: effectiveAreaNames.value,
  }))

  function buildPreflightForArea(area) {
    return buildCalificationPreflight({
      area,
      processType: processType.value,
      simulacroScope: simulacroScope.value,
      archiveRows: archiveRows.value,
      responsesRows: responsesRows.value,
      answerKeyRows: answerKeyRows.value,
      responsesByDni: responsesByDni.value,
      areaList: effectiveAreaNames.value,
    })
  }

  function getPreflightBlockerMessage(preflight) {
    const blocker = preflight.items.find((item) => item.status === 'error')
    return blocker?.detail || 'Corrige los bloqueos antes de calificar.'
  }

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
    return calculateAreaResults({
      area,
      plantilla,
      correctValue,
      incorrectValue,
      blankValue,
      processType: processType.value,
      simulacroScope: simulacroScope.value,
      answersLength: effectiveAnswersLength.value,
      archiveRows: archiveRows.value,
      responsesRows: responsesRows.value,
      answerKeyRows: answerKeyRows.value,
      responsesByDni: responsesByDni.value,
      answerKeyLookupByAreaTipo: answerKeyLookupByAreaTipo.value,
      answerKeyFallbackByArea: answerKeyFallbackByArea?.value,
      areaList: effectiveAreaNames.value,
      vacantesPrograma: vacantesPrograma?.value,
    })
  }

  function auditCalificationResult(areaResult) {
    const validation = validateCalificationResult({
      result: areaResult,
      processType: processType.value,
      answersLength: effectiveAnswersLength.value,
      vacantesPrograma: vacantesPrograma?.value,
    })

    if (!validation.valid) {
      console.warn('[calification] Resultado calculado con invariantes inválidas:', validation)
    }

    return validation
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

    if (preflightCheck.value.hasBlockers) {
      calificationError.value = getPreflightBlockerMessage(preflightCheck.value)
      showToast(calificationError.value, 'error', 8000)
      return
    }

    let areaResult
    try {
      areaResult = _calcForArea(area, plantilla, correctValue, incorrectValue, blankValue)
      auditCalificationResult(areaResult)
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
      const areaPreflight = buildPreflightForArea(calculationArea)
      if (areaPreflight.hasBlockers) {
        skippedDetails.push({ area: areaName, reason: getPreflightBlockerMessage(areaPreflight) })
        continue
      }

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
        const areaResult = _calcForArea(calculationArea, plantilla, correctValue, incorrectValue, blankValue)
        auditCalificationResult(areaResult)
        newAreas[calculationArea] = areaResult
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
