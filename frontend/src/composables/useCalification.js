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

/**
 * Composable para gestión de calificación
 * @param {Ref} archiveRows
 * @param {Ref} responsesRows
 * @param {Ref} answerKeyRows
 * @param {Ref} ponderationRows
 * @param {Ref} ponderationEntriesByArea
 * @param {Ref} ponderationTotalsByArea
 * @param {Ref} responsesByDni
 * @param {Ref} answerKeyLookupByAreaTipo
 * @param {Ref} [areaNames] - Lista de nombres de área disponibles
 * @param {Ref} [activeConvocatoriaId]
 * @param {Ref} [formatConfig] - Configuración del formato DAT
 * @param {Ref} [areaByName] - Map de área por nombre para acceder a vacantes
 */
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
  areaByName
) {
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )
  const effectiveAnswersLength = computed(() =>
    formatConfig?.value?.answersLength ?? DEFAULT_DAT_FORMAT.answersLength
  )

  // Estado del modal de calificación
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

  // Resultados
  const scoreStorage = useStorage(STORAGE_KEYS.SCORE_RESULTS, { summary: null, rows: [] })
  const calificationResults = ref(Array.isArray(scoreStorage.value?.rows) ? scoreStorage.value.rows : [])
  const calificationSummary = ref(scoreStorage.value?.summary || null)

  // Computed
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
  const calificationHasResults = computed(() => calificationResults.value.length > 0)
  const selectedPonderationIsReady = computed(() =>
    selectedPonderationTotals.value.questions === effectiveAnswersLength.value
  )

  const canCalify = computed(() =>
    responsesRows.value.length > 0 &&
    answerKeyRows.value.length > 0 &&
    ponderationRows.value.length > 0 &&
    selectedPonderationIsReady.value
  )

  // Persistir resultados
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

  // Cargar configuración cuando cambia el área
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

  // Methods
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

    // Cargar configuración guardada para el área
    initConfigForArea(preferredArea)
    const cfg = getConfigForArea(preferredArea)
    calificationCorrectValue.value = cfg.correctValue
    calificationIncorrectValue.value = cfg.incorrectValue
    calificationBlankValue.value = cfg.blankValue
    calificationError.value = ''
    showCalificationModal.value = true
  }

  function closeCalificationModal() {
    showCalificationModal.value = false
  }

  function resetCalificationResults() {
    calificationResults.value = []
    calificationSummary.value = null
  }

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

  function runCalification() {
    calificationError.value = ''
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const ponderationArea = normalizeArea(calificationPonderationArea.value, effectiveAreaNames.value)
    const entries = ponderationEntriesByArea.value.get(ponderationArea) || []
    const answersLength = effectiveAnswersLength.value

    if (!entries.length) {
      calificationError.value = 'No hay ponderaciones registradas para el área seleccionada.'
      return
    }

    const plan = buildQuestionPlan(entries)
    if (plan.length !== answersLength) {
      calificationError.value = `Las ponderaciones cubren ${plan.length} preguntas. Deben sumar ${answersLength}.`
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

      if (!responseList.length) {
        missingResponses += 1
        return
      }

      const matchForArea = responseList
        .map((row) => {
          const key = buildAreaTipoKey(area, row.tipo, effectiveAreaNames.value)
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

      const finalScore = Math.round(total * 100) / 100
      processedResults.push({
        id: `${dni}-${area}`,
        dni,
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        area,
        score: finalScore,
        position: 0,
        isIngresante: false,
      })
    })

    processedResults.sort((a, b) => b.score - a.score)

    const unlinkedResponses = responsesRows.value.filter(
      (r) => !r.dni || r.dni.trim() === ''
    ).length

    calificationResults.value = processedResults
    calificationSummary.value = {
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

    // Persistir configuración usada
    calificationConfigStorage.value[area] = { correctValue, incorrectValue, blankValue }
    saveCalificationConfigToAPI(area, correctValue, incorrectValue, blankValue)

    showCalificationModal.value = false
  }

  return {
    showCalificationModal,
    calificationArea,
    calificationPonderationArea,
    calificationCorrectValue,
    calificationIncorrectValue,
    calificationBlankValue,
    calificationError,
    calificationSearch,
    calificationResults,
    calificationSummary,
    calificationFilteredResults,
    calificationAreaOptions,
    calificationHasResults,
    selectedPonderationTotals,
    selectedPonderationPlan,
    selectedPonderationIsReady,
    canCalify,
    openCalificationModal,
    closeCalificationModal,
    resetCalificationResults,
    runCalification,
  }
}
