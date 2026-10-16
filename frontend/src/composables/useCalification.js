import { ref, shallowRef, computed, watch } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS, DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'
import { useToast } from '@/composables/useToast'
import {
  normalize,
  normalizeArea,
  stripDigits,
} from '@/utils/helpers'
import {
  GENERAL_SIMULACRO_AREA,
} from '@/utils/calificationHelpers'
import { calculateAreaResults } from '@/domain/calification/calculateResults'
import { buildCalificationPreflight } from '@/domain/calification/preflight'
import { validateCalificationResult } from '@/domain/calification/validateResults'
import { runPreCalificationSyntheticSuite } from '@/domain/calification/syntheticTests'
import { computeConfigurationSha256 } from '@/domain/calification/configHash'

export const PODER_JUDICIAL_AREA = 'CONCURSO PODER JUDICIAL'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateDefaultName(type = 'simulacro') {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.toLocaleDateString('es-PE', { month: 'long' })
  if (type === 'poder_judicial') {
    return `Convocatoria N.° 001-${year}-UE-PUNO · CSJ Puno`
  }
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
  const isPoderJudicial = computed(() => processType.value === 'poder_judicial')
  const inferredSimulacroScope = computed(() =>
    archiveRows.value.some(row => row.area?.trim()) ? 'areas' : 'general'
  )
  const simulacroScope = computed({
    get: () => (processType.value === 'real' || processType.value === 'poder_judicial')
      ? ''
      : (_processMeta.value.simulacroScope || inferredSimulacroScope.value),
    set: (val) => { _processMeta.value = { ..._processMeta.value, simulacroScope: val } },
  })
  const isGeneralSimulacro = computed(() =>
    processType.value === 'simulacro' && simulacroScope.value === 'general'
  )

  const calificationDisplayArea = ref(
    Object.keys(activeProcess.value.areas || {})[0] || null
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO PODER JUDICIAL (EXCEPCIONES, CRITERIOS, PRUEBAS SINTÉTICAS, BITÁCORA)
  // ═══════════════════════════════════════════════════════════════════════════

  const questionExceptions = ref([])
  const candidateExceptions = ref([])
  const scoringOptions = ref({
    useMinPassingScore: false,
    minPassingScore: 18,
    requireQuotaForIngreso: true,
    tieBreakerMode: 'shared_rank',
  })
  const syntheticSuiteResult = ref(null)
  const bitacoraEvents = ref([])

  async function logBitacoraEvent({
    categoria = 'CONFIGURACION',
    accion = '',
    justificacion = '',
    documento_sustento = '',
    valor_anterior = null,
    valor_nuevo = null,
  } = {}) {
    const entry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      categoria,
      accion,
      justificacion,
      documento_sustento,
      valor_anterior,
      valor_nuevo,
    }
    bitacoraEvents.value = [entry, ...bitacoraEvents.value]
    try {
      await apiFetch('/bitacora/', {
        method: 'POST',
        body: JSON.stringify({
          proceso_local_id: activeProcess.value.id || '',
          categoria,
          accion,
          justificacion,
          documento_sustento,
          valor_anterior,
          valor_nuevo,
        }),
      })
    } catch {
      // Offline / API no disponible: conservado en bitacoraEvents en memoria
    }
    return entry
  }

  function addQuestionException(exc = {}) {
    const qNum = Number(exc.questionNumber)
    if (!Number.isInteger(qNum) || qNum < 1) return null
    const newItem = {
      id: exc.id || generateId(),
      codExamen: String(exc.codExamen || '*').trim() || '*',
      questionNumber: qNum,
      type: String(exc.type || 'ANULADA_OTORGAR').trim().toUpperCase(),
      validAnswers: String(exc.validAnswers || '').toUpperCase().replace(/[^A-E]/g, ''),
      reason: String(exc.reason || '').trim(),
      documentRef: String(exc.documentRef || '').trim(),
    }
    questionExceptions.value = [
      ...questionExceptions.value.filter(
        (item) =>
          !(normalize(item.codExamen) === normalize(newItem.codExamen) && item.questionNumber === newItem.questionNumber),
      ),
      newItem,
    ]
    logBitacoraEvent({
      categoria: 'EXCEPCION_PREGUNTA',
      accion: `Excepción agregada: Examen ${newItem.codExamen} · Pregunta ${newItem.questionNumber} (${newItem.type})`,
      justificacion: newItem.reason,
      documento_sustento: newItem.documentRef,
      valor_nuevo: newItem,
    })
    return newItem
  }

  function removeQuestionException(id) {
    const prev = questionExceptions.value.find((item) => item.id === id)
    questionExceptions.value = questionExceptions.value.filter((item) => item.id !== id)
    if (prev) {
      logBitacoraEvent({
        categoria: 'EXCEPCION_PREGUNTA',
        accion: `Excepción eliminada: Examen ${prev.codExamen} · Pregunta ${prev.questionNumber}`,
        justificacion: prev.reason,
        documento_sustento: prev.documentRef,
        valor_anterior: prev,
      })
    }
  }

  function addCandidateException(exc = {}) {
    const dni = stripDigits(exc.dni)
    if (!dni) return null
    const matchedPadron = archiveRows.value.find((r) => stripDigits(r.dni) === dni) || {}
    const newItem = {
      id: exc.id || generateId(),
      dni,
      paterno: exc.paterno || matchedPadron.paterno || '',
      materno: exc.materno || matchedPadron.materno || '',
      nombres: exc.nombres || matchedPadron.nombres || '',
      codExamen: exc.codExamen || matchedPadron.cod_examen || matchedPadron.area || '',
      codPuesto: exc.codPuesto || matchedPadron.cod_puesto || matchedPadron.programa || '',
      reason: String(exc.reason || 'Anulado por acuerdo de comisión').trim(),
      documentRef: String(exc.documentRef || '').trim(),
    }
    candidateExceptions.value = [
      ...candidateExceptions.value.filter((item) => stripDigits(item.dni) !== dni),
      newItem,
    ]
    logBitacoraEvent({
      categoria: 'ANULACION_POSTULANTE',
      accion: `Participación anulada para DNI ${dni} (${[newItem.paterno, newItem.materno, newItem.nombres].filter(Boolean).join(' ')})`,
      justificacion: newItem.reason,
      documento_sustento: newItem.documentRef,
      valor_nuevo: newItem,
    })
    return newItem
  }

  function removeCandidateException(idOrDni) {
    const prev = candidateExceptions.value.find(
      (item) => item.id === idOrDni || stripDigits(item.dni) === stripDigits(idOrDni),
    )
    candidateExceptions.value = candidateExceptions.value.filter(
      (item) => item.id !== idOrDni && stripDigits(item.dni) !== stripDigits(idOrDni),
    )
    if (prev) {
      logBitacoraEvent({
        categoria: 'ANULACION_POSTULANTE',
        accion: `Anulación revertida para DNI ${prev.dni}`,
        justificacion: prev.reason,
        documento_sustento: prev.documentRef,
        valor_anterior: prev,
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DEL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  const showCalificationModal = ref(false)
  const calificationArea = ref(
    isPoderJudicial.value
      ? PODER_JUDICIAL_AREA
      : isGeneralSimulacro.value
        ? GENERAL_SIMULACRO_AREA
        : (effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0])
  )
  const calificationPlantillaId = ref(null)
  const calificationError = ref('')
  const calificationSearch = ref('')

  const calificationConfigStorage = ref({})
  const calificationConfigApiLoading = ref(false)
  const calificationConfigApiSyncing = ref(false)
  const calificationConfigApiReady = ref(false)
  let skipNextCalificationConfigSync = false

  function getDefaultScoringForArea(area) {
    if (area === PODER_JUDICIAL_AREA || isPoderJudicial.value) {
      return { correctValue: 1, incorrectValue: 0, blankValue: 0 }
    }
    return { correctValue: 10, incorrectValue: 0, blankValue: 2 }
  }

  function getConfigForArea(area) {
    const stored = calificationConfigStorage.value[area]
    const defaults = getDefaultScoringForArea(area)
    return {
      correctValue: stored?.correctValue ?? defaults.correctValue,
      incorrectValue: stored?.incorrectValue ?? defaults.incorrectValue,
      blankValue: stored?.blankValue ?? defaults.blankValue,
    }
  }

  function initConfigForArea(area) {
    if (!calificationConfigStorage.value[area]) {
      calificationConfigStorage.value[area] = getDefaultScoringForArea(area)
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

  const calificationCorrectValue = ref(isPoderJudicial.value ? 1 : 10)
  const calificationIncorrectValue = ref(0)
  const calificationBlankValue = ref(isPoderJudicial.value ? 0 : 2)

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
      normalize(row.nombres).includes(needle) ||
      normalize(row.codExamen).includes(needle) ||
      normalize(row.codPuesto).includes(needle) ||
      normalize(row.puesto).includes(needle) ||
      normalize(row.unidad).includes(needle)
    )
  })

  const defaultPjPlantilla = computed(() => ({
    id: 'pj-default-30',
    name: `Poder Judicial — ${effectiveAnswersLength.value} Preguntas (Peso Unitario)`,
    area: '',
    questionTotal: effectiveAnswersLength.value,
    items: [
      {
        subject: 'Conocimientos',
        questionCount: effectiveAnswersLength.value,
        ponderation: 1,
        order: 1,
      },
    ],
  }))

  // Plantillas disponibles para el área actualmente seleccionada en el modal
  const availablePlantillas = computed(() => {
    if (isPoderJudicial.value) {
      const list = (ponderationsComposable.plantillas.value || [])
        .slice()
        .sort((a, b) => {
          const aReady = a.questionTotal === effectiveAnswersLength.value ? 0 : 1
          const bReady = b.questionTotal === effectiveAnswersLength.value ? 0 : 1
          return aReady - bReady || String(a.name).localeCompare(String(b.name), 'es')
        })
      const hasMatchingReady = list.some((p) => p.questionTotal === effectiveAnswersLength.value)
      return hasMatchingReady ? list : [defaultPjPlantilla.value, ...list]
    }
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

  const selectedCalificationPlantilla = computed(() => {
    if (calificationPlantillaId.value === 'pj-default-30') {
      return defaultPjPlantilla.value
    }
    return (
      ponderationsComposable.getPlantillaById(calificationPlantillaId.value) ||
      (isPoderJudicial.value ? defaultPjPlantilla.value : undefined)
    )
  })

  const selectedPonderationTotals = computed(() => {
    const plantilla = selectedCalificationPlantilla.value
    if (!plantilla) return { questions: 0, weight: 0 }
    const items = plantilla.items || []
    return {
      questions: plantilla.questionTotal || 0,
      weight: items.reduce((a, i) => a + Number(i.ponderation) * Number(i.questionCount), 0),
    }
  })

  const calificationAreaOptions = computed(() => {
    if (isPoderJudicial.value) return [PODER_JUDICIAL_AREA]
    return isGeneralSimulacro.value ? [GENERAL_SIMULACRO_AREA] : effectiveAreaNames.value
  })
  const calificationHasResults = computed(() => processAreas.value.length > 0)

  const examCodesInPadron = computed(() => {
    const codes = new Set()
    archiveRows.value.forEach((r) => {
      const code = String(r?.cod_examen || r?.codExamen || r?.area || '').trim()
      if (code) codes.add(code)
    })
    return Array.from(codes).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  })

  // Programas de estudio / puestos del área actualmente seleccionada en el modal
  const programasForCurrentArea = computed(() => {
    if (isGeneralSimulacro.value) return []
    if (isPoderJudicial.value) {
      const set = new Set()
      archiveRows.value.forEach((r) => {
        const puesto = String(r?.puesto || r?.programa || r?.cod_puesto || '').trim()
        if (puesto) set.add(puesto)
      })
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    }
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const set = new Set()
    archiveRows.value.forEach(r => {
      if (normalizeArea(r.area, effectiveAreaNames.value) === area && r.programa?.trim())
        set.add(r.programa.trim())
    })
    return Array.from(set).sort()
  })

  const configurationSha256 = computed(() =>
    computeConfigurationSha256({
      answersLength: effectiveAnswersLength.value,
      correctValue: calificationCorrectValue.value,
      incorrectValue: calificationIncorrectValue.value,
      blankValue: calificationBlankValue.value,
      plantilla: selectedCalificationPlantilla.value,
      answerKeyRows: answerKeyRows.value,
      questionExceptions: questionExceptions.value,
      candidateExceptions: candidateExceptions.value,
      scoringOptions: scoringOptions.value,
    }),
  )

  function runSyntheticSuite(sampleExamCode = '') {
    const suiteResult = runPreCalificationSyntheticSuite({
      answerKeyRows: answerKeyRows.value,
      plantilla: selectedCalificationPlantilla.value,
      correctValue: Number(calificationCorrectValue.value),
      incorrectValue: Number(calificationIncorrectValue.value),
      blankValue: Number(calificationBlankValue.value),
      answersLength: effectiveAnswersLength.value,
      questionExceptions: questionExceptions.value,
      sampleExamCode: sampleExamCode || examCodesInPadron.value[0] || 'E01a',
    })
    syntheticSuiteResult.value = suiteResult
    logBitacoraEvent({
      categoria: 'PRUEBAS_SINTETICAS',
      accion: `Ejecución de 5 pruebas sintéticas (${suiteResult.passedAll ? 'CONFORME 5/5' : 'OBSERVADO'})`,
      justificacion: `Examen verificado: ${suiteResult.examCodeTested} · Huella SHA-256: ${configurationSha256.value.formatted}`,
    })
    return suiteResult
  }

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
    (isPoderJudicial.value || ponderationsComposable.plantillas.value.length > 0)
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  watch(calificationArea, (area) => {
    if (isPoderJudicial.value) {
      if (area !== PODER_JUDICIAL_AREA) {
        calificationArea.value = PODER_JUDICIAL_AREA
      }
      initConfigForArea(PODER_JUDICIAL_AREA)
      const cfg = getConfigForArea(PODER_JUDICIAL_AREA)
      calificationCorrectValue.value = cfg.correctValue
      calificationIncorrectValue.value = cfg.incorrectValue
      calificationBlankValue.value = cfg.blankValue
      return
    }
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
    if ((processType.value === 'real' || processType.value === 'poder_judicial') && _processMeta.value.simulacroScope) {
      simulacroScope.value = ''
      return
    }
    if (processType.value === 'simulacro' && !simulacroScope.value) {
      simulacroScope.value = inferredSimulacroScope.value
    }
    if (isPoderJudicial.value) {
      calificationArea.value = PODER_JUDICIAL_AREA
      initConfigForArea(PODER_JUDICIAL_AREA)
      const cfg = getConfigForArea(PODER_JUDICIAL_AREA)
      calificationCorrectValue.value = cfg.correctValue
      calificationIncorrectValue.value = cfg.incorrectValue
      calificationBlankValue.value = cfg.blankValue
    } else if (isGeneralSimulacro.value) {
      calificationArea.value = GENERAL_SIMULACRO_AREA
    } else if (
      calificationArea.value === GENERAL_SIMULACRO_AREA ||
      calificationArea.value === PODER_JUDICIAL_AREA
    ) {
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

    if (processType.value === 'simulacro' && !_processMeta.value.simulacroScope) {
      simulacroScope.value = inferredSimulacroScope.value
    }
    if (isPoderJudicial.value) {
      calificationArea.value = PODER_JUDICIAL_AREA
    } else if (isGeneralSimulacro.value) {
      calificationArea.value = GENERAL_SIMULACRO_AREA
    }

    const area = isPoderJudicial.value
      ? PODER_JUDICIAL_AREA
      : isGeneralSimulacro.value
        ? GENERAL_SIMULACRO_AREA
        : normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const available = isPoderJudicial.value || isGeneralSimulacro.value
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
      processName.value = generateDefaultName(processType.value)
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
    if (type === 'poder_judicial') {
      calificationArea.value = PODER_JUDICIAL_AREA
      calificationConfigStorage.value[PODER_JUDICIAL_AREA] = {
        correctValue: 1,
        incorrectValue: 0,
        blankValue: 0,
      }
      calificationCorrectValue.value = 1
      calificationIncorrectValue.value = 0
      calificationBlankValue.value = 0
      calificationPlantillaId.value = 'pj-default-30'
    }
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
    simulacroScope.value = (process.type === 'real' || process.type === 'poder_judicial')
      ? ''
      : (process.simulacroScope || inferredSimulacroScope.value)
    const areas = Object.keys(process.areas || {})
    calificationDisplayArea.value = areas[0] || null
    calificationSearch.value = ''
    if (process.config_metadata && typeof process.config_metadata === 'object') {
      const meta = process.config_metadata
      if (Array.isArray(meta.questionExceptions)) {
        questionExceptions.value = meta.questionExceptions
      }
      if (Array.isArray(meta.candidateExceptions)) {
        candidateExceptions.value = meta.candidateExceptions
      }
      if (meta.scoringOptions && typeof meta.scoringOptions === 'object') {
        scoringOptions.value = { ...scoringOptions.value, ...meta.scoringOptions }
      }
      if (meta.syntheticSuiteResult) {
        syntheticSuiteResult.value = meta.syntheticSuiteResult
      }
      if (Array.isArray(meta.bitacoraEvents)) {
        bitacoraEvents.value = meta.bitacoraEvents
      }
    }
  }

  function resetCalificationResults() {
    startNewProcess({ type: processType.value })
  }

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
      vacantesPuesto: vacantesPrograma?.value,
      questionExceptions: questionExceptions.value,
      candidateExceptions: candidateExceptions.value,
      scoringOptions: scoringOptions.value,
    })
  }

  function auditCalificationResult(areaResult) {
    const validation = validateCalificationResult({
      result: areaResult,
      processType: processType.value,
      answersLength: effectiveAnswersLength.value,
      vacantesPrograma: vacantesPrograma?.value,
      vacantesPuesto: vacantesPrograma?.value,
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

    const area = isPoderJudicial.value
      ? PODER_JUDICIAL_AREA
      : isGeneralSimulacro.value
        ? GENERAL_SIMULACRO_AREA
        : normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const plantilla = selectedCalificationPlantilla.value
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

    if (isPoderJudicial.value && !syntheticSuiteResult.value) {
      runSyntheticSuite()
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

    if (isPoderJudicial.value && areaResult?.summary) {
      areaResult.summary.configSha256 = String(configurationSha256.value)
      areaResult.summary.configSha256Formatted = configurationSha256.value.formatted
      areaResult.summary.syntheticSuiteResult = syntheticSuiteResult.value
    }

    const currentId = activeProcess.value.id || generateId()
    const currentName = processName.value.trim() || generateDefaultName(processType.value)

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

    if (isPoderJudicial.value) {
      logBitacoraEvent({
        categoria: 'RECALCULO',
        accion: `Calificación general ejecutada (${areaResult.results.length} calificados, ${areaResult.summary.noCalificados?.length || 0} no calificados)`,
        justificacion: `Valores: +${correctValue} / ${incorrectValue} / ${blankValue} · Huella: ${configurationSha256.value.formatted}`,
      })
      showCalificationModal.value = false
      _saveProcesoToApi()
      return
    }

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

    if (isPoderJudicial.value) {
      runCalification()
      if (calificationError.value) return null
      return { calculated: [PODER_JUDICIAL_AREA], skipped: [] }
    }

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
    const currentName = processName.value.trim() || generateDefaultName(processType.value)

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
          config_metadata: {
            questionExceptions: questionExceptions.value,
            candidateExceptions: candidateExceptions.value,
            scoringOptions: scoringOptions.value,
            syntheticSuiteResult: syntheticSuiteResult.value,
            configurationSha256: String(configurationSha256.value),
            configurationSha256Formatted: configurationSha256.value.formatted,
            bitacoraEvents: bitacoraEvents.value,
          },
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
    isPoderJudicial,

    // Poder Judicial state & helpers
    questionExceptions,
    candidateExceptions,
    scoringOptions,
    syntheticSuiteResult,
    configurationSha256,
    bitacoraEvents,
    examCodesInPadron,
    addQuestionException,
    removeQuestionException,
    addCandidateException,
    removeCandidateException,
    runSyntheticSuite,
    logBitacoraEvent,

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
