import { ref, shallowRef, computed, watch } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS, DEFAULT_DAT_FORMAT } from '@/constants'
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
import { buildProvisionalPreview } from '@/domain/calification/provisionalMatches'
import { classifyQuestionExceptions, keyFingerprint } from '@/domain/calification/questionExceptions'

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
    get: () => processType.value === 'real' ? '' : (_processMeta.value.simulacroScope || inferredSimulacroScope.value),
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

  const calificationConfigStorage = ref({})
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
    await Promise.all([loadDniCorrections(), loadQuestionExceptions()])
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
      } else {
        skipNextCalificationConfigSync = true
        calificationConfigStorage.value = {}
      }
    } catch (error) {
      console.warn('[calification] API no disponible para configuración, manteniendo estado local en memoria:', error)
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

  // Excepciones de pregunta activas (se cargan de la API; ver más abajo sus acciones)
  const questionExceptions = ref([])

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
    questionExceptions: questionExceptions.value,
    answersLength: effectiveAnswersLength.value,
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
      questionExceptions: questionExceptions.value,
      answersLength: effectiveAnswersLength.value,
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
    if (processType.value === 'real' && _processMeta.value.simulacroScope) {
      simulacroScope.value = ''
      return
    }
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
      showToast(calificationError.value, 'error', 5000)
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
      showToast(calificationError.value, 'error', 5000)
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

  function startNewProcess({ name = '', type = 'simulacro', simulacroScope: scope = '' } = {}) {
    const normalizedScope = type === 'simulacro'
      ? scope || inferredSimulacroScope.value
      : ''
    activeProcess.value = { id: null, name, type, simulacroScope: normalizedScope, areas: {} }
    calificationDisplayArea.value = null
    processName.value = name
    processType.value = type
    simulacroScope.value = normalizedScope
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
    simulacroScope.value = process.type === 'real'
      ? ''
      : (process.simulacroScope || inferredSimulacroScope.value)
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
      dniCorrections: confirmedCorrectionsForCalc(),
      questionExceptions: questionExceptions.value,
    })
  }

  /**
   * Vista previa de hojas sin alumno en el padrón: qué puntaje tendrían si el DNI
   * sugerido fuera el correcto. No guarda ni cambia ningún resultado.
   * Usa la misma plantilla y valores con los que se calificó el área mostrada.
   */
  // ── Correcciones de DNI confirmadas ──────────────────────────────────────────
  const dniCorrections = ref([])

  async function loadDniCorrections() {
    try {
      const res = await apiFetch('/correcciones-dni/')
      if (res.ok) dniCorrections.value = await res.json()
    } catch (error) {
      console.warn('[calification] No se pudieron cargar las correcciones de DNI:', error)
    }
  }

  async function readApiError(res) {
    try {
      const body = await res.json()
      const first = Object.values(body || {})[0]
      return (Array.isArray(first) ? first[0] : first) || 'No se pudo completar la acción.'
    } catch {
      return 'No se pudo completar la acción.'
    }
  }

  // ── Excepciones de pregunta ──────────────────────────────────────────────────
  async function loadQuestionExceptions() {
    try {
      const res = await apiFetch('/excepciones-pregunta/')
      if (res.ok) questionExceptions.value = await res.json()
    } catch (error) {
      console.warn('[calification] No se pudieron cargar las excepciones de pregunta:', error)
    }
  }

  /** Cada excepción con su estado respecto de las claves cargadas (aplicada, desactualizada...). */
  const questionExceptionStatuses = computed(() => classifyQuestionExceptions({
    exceptions: questionExceptions.value,
    keyRows: answerKeyRows.value,
    answersLength: effectiveAnswersLength.value,
    areaList: effectiveAreaNames.value,
  }))

  /** Claves cargadas sobre las que se puede registrar una excepción. */
  const answerKeyOptions = computed(() => {
    const seen = new Map()
    answerKeyRows.value.forEach((row) => {
      const area = String(row.area ?? '').trim()
      const tipo = String(row.tipo ?? '').trim().toUpperCase().slice(0, 1)
      const id = `${area}|${tipo}`
      if (seen.has(id)) return
      const label = area ? `${area}${tipo ? ` · Tipo ${tipo}` : ''}` : `Clave general${tipo ? ` · Tipo ${tipo}` : ''}`
      seen.set(id, { id, area, tipo, label, answers: row.answers, length: String(row.answers ?? '').length })
    })
    return [...seen.values()]
  })

  /** Cuántos postulantes marcó cada opción en una pregunta de una clave (entre los ya calificados). */
  function answerDistribution(keyOption, questionNumber) {
    const empty = { A: 0, B: 0, C: 0, D: 0, E: 0, blank: 0, multiple: 0, total: 0, key: '' }
    if (!keyOption || !(questionNumber >= 1)) return empty
    const fingerprint = keyFingerprint(keyOption.answers)
    const result = { ...empty, key: String(keyOption.answers ?? '').toUpperCase()[questionNumber - 1] || '' }
    calificationResults.value.forEach((row) => {
      if (keyFingerprint(row.correctAnswersRaw) !== fingerprint) return
      const mark = String(row.answersRaw ?? '').toUpperCase()[questionNumber - 1] || ' '
      result.total += 1
      if (/^[A-E]$/.test(mark)) result[mark] += 1
      else if (mark === '*') result.multiple += 1
      else result.blank += 1
    })
    return result
  }

  /** Registra una excepción y recalcula el ranking con ella. */
  function addQuestionException(payload) {
    return syncCorrectionsIntoResults(async () => {
      try {
        const res = await apiFetch('/excepciones-pregunta/', { method: 'POST', body: JSON.stringify(payload) })
        if (!res.ok) return { ok: false, error: await readApiError(res) }
        await loadQuestionExceptions()
        return { ok: true }
      } catch {
        return { ok: false, error: 'No se pudo conectar con el servidor.' }
      }
    })
  }

  /** Deshace una excepción (queda registrada como revocada) y recalcula el ranking sin ella. */
  function revokeQuestionException(id) {
    return syncCorrectionsIntoResults(async () => {
      try {
        const res = await apiFetch(`/excepciones-pregunta/${id}/`, { method: 'DELETE' })
        if (!res.ok) return { ok: false, error: await readApiError(res) }
        await loadQuestionExceptions()
        return { ok: true }
      } catch {
        return { ok: false, error: 'No se pudo conectar con el servidor.' }
      }
    })
  }

  function confirmedCorrectionsForCalc() {
    return dniCorrections.value.map((item) => ({
      litho: item.litho,
      correctedDni: item.correctedDni,
      originalDni: item.originalDni,
    }))
  }

  /**
   * Recalcula las áreas ya calificadas con los mismos parámetros (plantilla y valores)
   * para que las correcciones confirmadas o deshechas se reflejen en el ranking.
   * Si algo falla, no cambia el resultado actual.
   */
  function recalculateActiveAreas() {
    const current = activeProcess.value
    const entries = Object.entries(current?.areas || {})
    if (!entries.length) return { ok: true }

    const next = {}
    for (const [area, data] of entries) {
      const summary = data?.summary
      const plantilla = summary ? ponderationsComposable.getPlantillaById(summary.plantillaId) : null
      if (!plantilla) {
        return { ok: false, error: `No se encontró la plantilla "${summary?.plantillaName || ''}" para recalcular ${area}.` }
      }
      try {
        const result = _calcForArea(
          area,
          plantilla,
          Number(summary.correctValue),
          Number(summary.incorrectValue),
          Number(summary.blankValue),
        )
        auditCalificationResult(result)
        next[area] = result
      } catch (error) {
        console.error('[calification] No se pudo recalcular con las correcciones:', error)
        return { ok: false, error: error?.message || String(error) }
      }
    }

    activeProcess.value = { ...current, areas: next }
    _saveProcesoToApi()
    return { ok: true }
  }

  /** Ejecuta el cambio de correcciones y actualiza el ranking. Devuelve { ok, error? }. */
  async function syncCorrectionsIntoResults(action) {
    const result = await action()
    if (!result.ok) return result
    const recalculated = recalculateActiveAreas()
    if (!recalculated.ok) {
      return {
        ok: false,
        error: `La corrección se guardó, pero no se pudo actualizar el ranking: ${recalculated.error}`,
      }
    }
    return { ok: true }
  }

  /** Confirma que el DNI sugerido es el correcto para la hoja y la incluye en el ranking. */
  function confirmDniCorrection(litho, correctedDni) {
    return syncCorrectionsIntoResults(() => postDniCorrection(litho, correctedDni))
  }

  async function postDniCorrection(litho, correctedDni) {
    try {
      const res = await apiFetch('/correcciones-dni/', {
        method: 'POST',
        body: JSON.stringify({ litho, correctedDni }),
      })
      if (!res.ok) return { ok: false, error: await readApiError(res) }
      await loadDniCorrections()
      return { ok: true }
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' }
    }
  }

  /** Deshace una confirmación y la quita del ranking (queda registrada como revocada, no se borra). */
  function undoDniCorrection(litho) {
    return syncCorrectionsIntoResults(() => deleteDniCorrection(litho))
  }

  async function deleteDniCorrection(litho) {
    const correction = dniCorrections.value.find((item) => item.litho === litho)
    if (!correction) return { ok: false, error: 'La corrección ya no existe.' }
    try {
      const res = await apiFetch(`/correcciones-dni/${correction.id}/`, { method: 'DELETE' })
      if (!res.ok) return { ok: false, error: await readApiError(res) }
      await loadDniCorrections()
      return { ok: true }
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' }
    }
  }

  function previewProvisionalMatches() {
    const summary = calificationSummary.value
    if (!summary) return null
    const plantilla = ponderationsComposable.getPlantillaById(summary.plantillaId)
    if (!plantilla) return null

    return buildProvisionalPreview({
      archiveRows: archiveRows.value,
      responsesRows: responsesRows.value,
      officialScores: calificationResults.value.map((row) => row.score),
      confirmedCorrections: confirmedCorrectionsForCalc(),
      scoreParams: {
        area: summary.area,
        plantilla,
        correctValue: summary.correctValue,
        incorrectValue: summary.incorrectValue,
        blankValue: summary.blankValue,
        processType: processType.value,
        simulacroScope: simulacroScope.value,
        answersLength: effectiveAnswersLength.value,
        answerKeyRows: answerKeyRows.value,
        answerKeyLookupByAreaTipo: answerKeyLookupByAreaTipo.value,
        answerKeyFallbackByArea: answerKeyFallbackByArea?.value,
        areaList: effectiveAreaNames.value,
        vacantesPrograma: vacantesPrograma?.value,
      },
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
      const firstError = validation.errors?.[0]
      throw new Error(firstError?.message || 'El resultado calculado no pasó la auditoría interna.')
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

      const specificAvailable = available.filter(
        (p) => p.area?.trim() && normalizeArea(p.area, effectiveAreaNames.value) === area
      )
      const globalAvailable = available.filter((p) => !p.area?.trim())

      const userSelected = calificationPlantillaId.value &&
        available.find(p => p.id === calificationPlantillaId.value)

      const selectedIsSpecific = userSelected?.area?.trim() &&
        normalizeArea(userSelected.area, effectiveAreaNames.value) === area
      const selectedIsGlobal = userSelected && !userSelected.area?.trim()

      const readySpecific = specificAvailable.find(p => p.questionTotal === effectiveAnswersLength.value)
        || specificAvailable[0]
      const readyGlobal = globalAvailable.find(p => p.questionTotal === effectiveAnswersLength.value)
        || globalAvailable[0]

      const plantilla = selectedIsSpecific
        ? userSelected
        : readySpecific || (selectedIsGlobal ? userSelected : readyGlobal) || available[0]
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
    previewProvisionalMatches,
    questionExceptions,
    questionExceptionStatuses,
    answerKeyOptions,
    answerDistribution,
    loadQuestionExceptions,
    addQuestionException,
    revokeQuestionException,
    dniCorrections,
    loadDniCorrections,
    confirmDniCorrection,
    undoDniCorrection,
    resetCalificationResults,
    startNewProcess,
    switchDisplayArea,
    getActiveProcess,
    loadProcess,
    activeProcess,
  }
}
