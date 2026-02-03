import { ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { STORAGE_KEYS, ANSWER_KEY_AREAS } from '@/constants'
import {
  normalize,
  normalizeArea,
  stripDigits,
  buildAreaTipoKey,
  buildQuestionPlan,
} from '@/utils/helpers'

/**
 * Composable para gestión de calificación
 */
export function useCalification(
  archiveRows,
  responsesRows,
  answerKeyRows,
  ponderationRows,
  ponderationEntriesByArea,
  ponderationTotalsByArea,
  responsesByDni,
  answerKeyLookupByAreaTipo
) {
  // Estado del modal
  const showCalificationModal = ref(false)
  const calificationModalTab = ref('calificar')
  const calificationArea = ref(ANSWER_KEY_AREAS[0])
  const calificationPonderationArea = ref(ANSWER_KEY_AREAS[0])
  const calificationCorrectValue = ref(10)
  const calificationIncorrectValue = ref(0)
  const calificationBlankValue = ref(2)
  const calificationError = ref('')
  const calificationSearch = ref('')

  // Resultados
  const scoreStorage = useStorage(STORAGE_KEYS.SCORE_RESULTS, { summary: null, rows: [] })
  const calificationResults = ref(Array.isArray(scoreStorage.value?.rows) ? scoreStorage.value.rows : [])
  const calificationSummary = ref(scoreStorage.value?.summary || null)

  // Computed
  const calificationFilteredResults = computed(() => {
    if (!calificationSearch.value.trim()) {
      return calificationResults.value
    }
    const needle = normalize(calificationSearch.value)
    return calificationResults.value.filter((row) => {
      return (
        normalize(row.dni).includes(needle) ||
        normalize(row.paterno).includes(needle) ||
        normalize(row.materno).includes(needle) ||
        normalize(row.nombres).includes(needle)
      )
    })
  })

  const ponderationAreaList = computed(() => {
    const areas = new Set(ANSWER_KEY_AREAS)
    ponderationRows.value.forEach((row) => areas.add(normalizeArea(row.area)))
    return Array.from(areas)
  })

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
    return ponderationEntriesByArea.value.get(area) || []
  })

  const calificationAreaOptions = computed(() => ponderationAreaList.value)
  const calificationHasResults = computed(() => calificationResults.value.length > 0)
  const selectedPonderationIsReady = computed(() => selectedPonderationTotals.value.questions === 60)

  const canCalify = computed(() =>
    responsesRows.value.length > 0 &&
    answerKeyRows.value.length > 0 &&
    ponderationRows.value.length > 0 &&
    selectedPonderationIsReady.value
  )

  // Watch para persistir resultados
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

  watch(calificationArea, (value) => {
    const normalized = normalizeArea(value)
    if (calificationArea.value !== normalized) {
      calificationArea.value = normalized
    }
    if (!ponderationEntriesByArea.value.has(calificationPonderationArea.value)) {
      calificationPonderationArea.value = normalized
    }
  })

  // Methods
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

      const answers = answersRaw.padEnd(plan.length, ' ').slice(0, plan.length)
      const correctAnswers = correctAnswersRaw.padEnd(plan.length, ' ').slice(0, plan.length)

      let total = 0

      for (let index = 0; index < plan.length; index += 1) {
        const weight = Number(plan[index]?.weight) || 0
        if (weight <= 0) {
          continue
        }

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

        const roundedContribution = Math.round(contribution * 100) / 100
        total += roundedContribution
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
      })
    })

    processedResults.sort((a, b) => b.score - a.score)

    const unlinkedResponses = responsesRows.value.filter(r => !r.dni || r.dni.trim() === '').length

    calificationResults.value = processedResults
    calificationSummary.value = {
      area,
      timestamp: new Date().toISOString(),
      totalCandidates: candidates.length,
      missingResponses,
      missingKeys,
      unlinkedResponses,
      totalWeight: Number(totalWeight.toFixed(3)),
    }

    showCalificationModal.value = false
  }

  return {
    // Estado
    showCalificationModal,
    calificationModalTab,
    calificationArea,
    calificationPonderationArea,
    calificationCorrectValue,
    calificationIncorrectValue,
    calificationBlankValue,
    calificationError,
    calificationSearch,
    calificationResults,
    calificationSummary,

    // Computed
    calificationFilteredResults,
    calificationAreaOptions,
    calificationHasResults,
    selectedPonderationTotals,
    selectedPonderationPlan,
    selectedPonderationIsReady,
    canCalify,

    // Methods
    openCalificationModal,
    closeCalificationModal,
    resetCalificationResults,
    runCalification,
  }
}
