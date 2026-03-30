import { ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS, API_BASE_URL, DEFAULT_DAT_FORMAT } from '@/constants'
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

export function useCalification(
  archiveRows,
  responsesRows,
  answerKeyRows,
  ponderationRows,
  ponderationEntriesByArea,
  ponderationTotalsByArea,
  responsesByDni,
  answerKeyLookupByAreaTipo,
  areaNames,
  activeConvocatoriaId,
  formatConfig,
  areaByName,
  vacantesPrograma
) {
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )
  const effectiveAnswersLength = computed(() =>
    formatConfig?.value?.answersLength ?? DEFAULT_DAT_FORMAT.answersLength
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESO ACTIVO
  // ═══════════════════════════════════════════════════════════════════════════

  const activeProcess = useStorage(STORAGE_KEYS.ACTIVE_PROCESS, {
    id: null,
    name: '',
    areas: {},
  })

  // Nombre editable del proceso (sincronizado con activeProcess)
  const processName = ref(activeProcess.value.name || '')

  // Área actualmente mostrada en la tabla de resultados
  const calificationDisplayArea = ref(
    Object.keys(activeProcess.value.areas || {})[0] || null
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DEL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  const showCalificationModal = ref(false)
  const calificationArea = ref(effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0])
  const calificationPonderationArea = ref(effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0])
  const calificationError = ref('')
  const calificationSearch = ref('')

  // Valores de calificación persistidos por área
  const calificationConfigStorage = useStorage('calificador-calification-config', {})

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

  const calificationCorrectValue = ref(10)
  const calificationIncorrectValue = ref(0)
  const calificationBlankValue = ref(2)
  const simpleMode = ref(false)

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTADOS REACTIVOS
  // ═══════════════════════════════════════════════════════════════════════════

  // Áreas con resultados en el proceso activo
  const processAreas = computed(() => Object.keys(activeProcess.value.areas || {}))

  // Resultados del área actualmente seleccionada (para la tabla)
  const calificationResults = computed(() => {
    const area = calificationDisplayArea.value
    return area ? (activeProcess.value.areas[area]?.results || []) : []
  })

  // Resumen del área actualmente seleccionada
  const calificationSummary = computed(() => {
    const area = calificationDisplayArea.value
    return area ? (activeProcess.value.areas[area]?.summary || null) : null
  })

  // Todos los resultados combinados de todas las áreas (para dashboard)
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

  const ponderationAreaList = computed(() => {
    const areas = new Set(effectiveAreaNames.value)
    ponderationRows.value.forEach((row) => areas.add(normalizeArea(row.area, effectiveAreaNames.value)))
    return Array.from(areas)
  })

  const selectedPonderationTotals = computed(() => {
    const area = normalizeArea(calificationPonderationArea.value, effectiveAreaNames.value)
    const entry = ponderationTotalsByArea.value.get(area)
    return {
      questions: entry?.questions ?? 0,
      weight: entry?.weight ?? 0,
    }
  })

  const selectedPonderationPlan = computed(() => {
    const area = normalizeArea(calificationPonderationArea.value, effectiveAreaNames.value)
    return ponderationEntriesByArea.value.get(area) || []
  })

  const calificationAreaOptions = computed(() => ponderationAreaList.value)
  const calificationHasResults = computed(() => processAreas.value.length > 0)
  const selectedPonderationIsReady = computed(() =>
    selectedPonderationTotals.value.questions === effectiveAnswersLength.value
  )

  const canCalify = computed(() =>
    responsesRows.value.length > 0 &&
    answerKeyRows.value.length > 0 &&
    (simpleMode.value || (
      ponderationRows.value.length > 0 &&
      selectedPonderationIsReady.value
    ))
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // WATCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  watch(calificationArea, (area) => {
    const normalized = normalizeArea(area, effectiveAreaNames.value)
    initConfigForArea(normalized)
    const cfg = getConfigForArea(normalized)
    calificationCorrectValue.value = cfg.correctValue
    calificationIncorrectValue.value = cfg.incorrectValue
    calificationBlankValue.value = cfg.blankValue
    if (!ponderationEntriesByArea.value.has(calificationPonderationArea.value)) {
      calificationPonderationArea.value = normalized
    }
  })

  // Sync processName with active process
  watch(() => activeProcess.value.name, (name) => {
    processName.value = name || ''
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS - MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openCalificationModal() {
    if (!canCalify.value) {
      calificationError.value = 'Necesitas cargar respuestas, claves y ponderaciones antes de calificar.'
      return
    }

    const areas = calificationAreaOptions.value
    const readyAreas = areas.filter((areaOption) => {
      const entry = ponderationTotalsByArea.value.get(areaOption)
      return entry?.questions === effectiveAnswersLength.value
    })

    if (!readyAreas.length) {
      calificationError.value = `Completa las ${effectiveAnswersLength.value} preguntas para el área antes de calificar.`
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

    initConfigForArea(preferredArea)
    const cfg = getConfigForArea(preferredArea)
    calificationCorrectValue.value = cfg.correctValue
    calificationIncorrectValue.value = cfg.incorrectValue
    calificationBlankValue.value = cfg.blankValue

    // Sugerir nombre si el proceso aún no tiene nombre
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
  // MÉTODOS - PROCESO
  // ═══════════════════════════════════════════════════════════════════════════

  function startNewProcess() {
    activeProcess.value = { id: null, name: '', areas: {} }
    calificationDisplayArea.value = null
    processName.value = ''
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
    const areas = Object.keys(process.areas || {})
    calificationDisplayArea.value = areas[0] || null
    calificationSearch.value = ''
  }

  function resetCalificationResults() {
    startNewProcess()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS - API
  // ═══════════════════════════════════════════════════════════════════════════

  async function saveCalificationConfigToAPI(area, correctValue, incorrectValue, blankValue) {
    if (!activeConvocatoriaId?.value) return
    try {
      await fetch(`${API_BASE_URL}/calification-configs/upsert/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convocatoria: activeConvocatoriaId.value,
          area_name: area,
          correct_value: correctValue,
          incorrect_value: incorrectValue,
          blank_value: blankValue,
        }),
      })
    } catch {
      // No crítico, ya está guardado localmente
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  function runCalification() {
    calificationError.value = ''
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const ponderationArea = normalizeArea(calificationPonderationArea.value, effectiveAreaNames.value)
    const answersLength = effectiveAnswersLength.value
    let plan

    if (simpleMode.value) {
      plan = Array.from({ length: answersLength }, () => ({ weight: 1 }))
    } else {
      const entries = ponderationEntriesByArea.value.get(ponderationArea) || []
      if (!entries.length) {
        calificationError.value = 'No hay ponderaciones registradas para el área seleccionada.'
        return
      }
      plan = buildQuestionPlan(entries)
      if (plan.length !== answersLength) {
        calificationError.value = `Las ponderaciones cubren ${plan.length} preguntas. Deben sumar ${answersLength}.`
        return
      }
    }

    const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)
    const correctValue = Number(calificationCorrectValue.value)
    const incorrectValue = Number(calificationIncorrectValue.value)
    const blankValue = Number(calificationBlankValue.value)

    if (!Number.isFinite(correctValue)) { calificationError.value = 'El valor para respuesta correcta no es válido.'; return }
    if (!Number.isFinite(incorrectValue)) { calificationError.value = 'El valor para respuesta incorrecta no es válido.'; return }
    if (!Number.isFinite(blankValue)) { calificationError.value = 'El valor para respuesta en blanco no es válido.'; return }

    const candidates = archiveRows.value.filter(
      (row) => normalizeArea(row.area, effectiveAreaNames.value) === area
    )
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

      if (!responseList.length) { missingResponses += 1; return }

      const matchForArea = responseList
        .map((row) => {
          const key = buildAreaTipoKey(area, row.tipo, effectiveAreaNames.value)
          const answer = key ? answerKeyLookupByAreaTipo.value.get(key) : undefined
          return { row, answer }
        })
        .find((item) => item.answer)

      if (!matchForArea || !matchForArea.answer) { missingKeys += 1; return }

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
        let contribution = 0

        const isCorrectCharValid = /^[A-E]$/.test(correctChar)
        const isResponseCharValid = /^[A-E]$/.test(responseChar)

        if (isCorrectCharValid && isResponseCharValid && responseChar === correctChar) {
          contribution = correctValue * weight
        } else if (isResponseCharValid) {
          contribution = incorrectValue * weight
        } else {
          contribution = blankValue * weight
        }

        total += Math.round(contribution * 100) / 100
      }

      processedResults.push({
        id: `${stripDigits(candidate.dni)}-${area}`,
        dni: stripDigits(candidate.dni),
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        area,
        programa: candidate.programa || '',
        score: Math.round(total * 100) / 100,
        position: 0,
        positionInPrograma: 0,
        isIngresante: false,
      })
    })

    // Rankear dentro de cada programa y asignar isIngresante por cupo
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

    // Orden global por puntaje para la tabla
    processedResults.sort((a, b) => b.score - a.score)
    processedResults.forEach((r, i) => { r.position = i + 1 })

    const unlinkedResponses = responsesRows.value.filter(
      (r) => !r.dni || r.dni.trim() === ''
    ).length

    const summary = {
      area,
      timestamp: new Date().toISOString(),
      totalCandidates: candidates.length,
      missingResponses,
      missingKeys,
      unlinkedResponses,
      totalWeight: Number(totalWeight.toFixed(3)),
      answersLength,
      correctValue,
      incorrectValue,
      blankValue,
    }

    // Crear proceso si no existe
    const currentId = activeProcess.value.id || generateId()
    const currentName = processName.value.trim() || generateDefaultName()

    activeProcess.value = {
      id: currentId,
      name: currentName,
      areas: {
        ...activeProcess.value.areas,
        [area]: { results: processedResults, summary },
      },
    }

    calificationDisplayArea.value = area

    // Persistir configuración usada
    calificationConfigStorage.value[area] = { correctValue, incorrectValue, blankValue }
    saveCalificationConfigToAPI(area, correctValue, incorrectValue, blankValue)

    showCalificationModal.value = false
  }

  return {
    // Modal state
    showCalificationModal,
    simpleMode,
    calificationArea,
    calificationPonderationArea,
    calificationCorrectValue,
    calificationIncorrectValue,
    calificationBlankValue,
    calificationError,
    calificationSearch,
    processName,

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
    selectedPonderationTotals,
    selectedPonderationPlan,
    selectedPonderationIsReady,
    canCalify,
    ponderationAreaList,

    // Methods
    openCalificationModal,
    closeCalificationModal,
    runCalification,
    resetCalificationResults,
    startNewProcess,
    switchDisplayArea,
    getActiveProcess,
    loadProcess,
    activeProcess,
  }
}
