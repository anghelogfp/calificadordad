import { ref, computed, watch } from 'vue'
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
  })
  const _areasData = ref({})

  // Composite proxy with same interface as the old useStorage ref
  const activeProcess = computed({
    get: () => ({
      id: _processMeta.value.id,
      name: _processMeta.value.name,
      type: _processMeta.value.type,
      areas: _areasData.value,
    }),
    set: (val) => {
      _processMeta.value = {
        id: val?.id ?? null,
        name: val?.name ?? '',
        type: val?.type ?? 'simulacro',
      }
      _areasData.value = val?.areas ?? {}
    },
  })

  const processName = ref(_processMeta.value.name || '')
  const processType = computed({
    get: () => _processMeta.value.type || 'simulacro',
    set: (val) => { _processMeta.value = { ..._processMeta.value, type: val } },
  })

  const calificationDisplayArea = ref(
    Object.keys(activeProcess.value.areas || {})[0] || null
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DEL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  const showCalificationModal = ref(false)
  const calificationArea = ref(effectiveAreaNames.value[0] ?? ANSWER_KEY_AREAS[0])
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

  const calificationAreaOptions = computed(() => effectiveAreaNames.value)
  const calificationHasResults = computed(() => processAreas.value.length > 0)

  // Programas de estudio del área actualmente seleccionada en el modal
  const programasForCurrentArea = computed(() => {
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
    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)

    // 1. Candidatos del padrón en esta área
    const candidates = archiveRows.value.filter(
      r => normalizeArea(r.area, effectiveAreaNames.value) === area
    )

    // Simulacro sin columna área: si no hay candidatos con área, usar los sin área asignada
    const unassignedCandidates = archiveRows.value.filter(r => !r.area?.trim())
    const usingFallback = candidates.length === 0 && unassignedCandidates.length > 0
    const effectiveCandidates = usingFallback ? unassignedCandidates : candidates

    // 2. Candidatos sin respuesta .dat
    const withoutResponse = effectiveCandidates.filter(c => {
      const dni = stripDigits(c.dni)
      return !responsesByDni.value.has(dni) || responsesByDni.value.get(dni).length === 0
    })

    // 3. Respuestas .dat sin candidato en el padrón
    const allDnisInPadron = new Set(archiveRows.value.map(r => stripDigits(r.dni)))
    const orphanResponses = [...responsesByDni.value.entries()].filter(([dni]) => !allDnisInPadron.has(dni))

    // 4. Claves de respuesta para el área
    const hasAnswerKeys = answerKeyRows.value.some(
      k => normalizeArea(k.area, effectiveAreaNames.value) === area
    ) || answerKeyRows.value.some(k => !k.area?.trim())

    // 5. Respuestas .dat sin DNI vinculado
    const unlinked = archiveRows.value.length > 0
      ? (responsesByDni.value.get('') || []).length + (responsesByDni.value.get(undefined) || []).length
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

    items.push(
      {
        key: 'answerKeys',
        label: 'Claves de respuestas',
        value: hasAnswerKeys ? 'Disponibles' : 'No encontradas',
        status: hasAnswerKeys ? 'ok' : 'error',
        detail: !hasAnswerKeys ? 'No se encontraron claves para esta área. Sin claves no es posible calificar.' : null,
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

    // Modo Real: advertir si ningún candidato tiene programa asignado
    if (processType.value === 'real') {
      const sinPrograma = effectiveCandidates.filter(c => !c.programa?.trim()).length
      if (sinPrograma > 0) {
        items.push({
          key: 'sinPrograma',
          label: 'Sin programa de estudios',
          value: sinPrograma,
          status: 'warn',
          detail: sinPrograma === effectiveCandidates.length
            ? 'Ningún postulante tiene programa asignado. El ranking será global.'
            : `${sinPrograma} postulante(s) sin programa. Se agruparán en "(Sin programa)".`,
        })
      }
    }

    const hasBlockers = effectiveCandidates.length === 0 || !hasAnswerKeys
    console.log('[preflight] área:', area, '| candidatos:', effectiveCandidates.length, '| hasAnswerKeys:', hasAnswerKeys, '| answerKeyRows:', answerKeyRows.value.length, '| hasBlockers:', hasBlockers)
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

    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
    const available = ponderationsComposable.getPlantillasForCalification(area)

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
    activeProcess.value = { id: null, name, type, areas: {} }
    calificationDisplayArea.value = null
    processName.value = name
    processType.value = type
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
    const answersLength = effectiveAnswersLength.value
    const plan = buildQuestionPlan(plantilla.items)

    if (plan.length !== answersLength) {
      throw new Error(`La plantilla "${plantilla.name}" cubre ${plan.length} preguntas. Deben sumar ${answersLength}.`)
    }

    const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)

    let candidates = archiveRows.value.filter(
      (row) => normalizeArea(row.area, effectiveAreaNames.value) === area
    )

    // Simulacro sin columna área: si no hay candidatos con área, usar los sin área asignada
    if (candidates.length === 0) {
      const unassigned = archiveRows.value.filter(r => !r.area?.trim())
      if (unassigned.length > 0) candidates = unassigned
    }

    if (!candidates.length) {
      throw new Error('No hay postulantes registrados para el área seleccionada.')
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
          const answer = (key ? answerKeyLookupByAreaTipo.value.get(key) : undefined)
            ?? answerKeyFallbackByArea?.value?.get(normalizeArea(area, effectiveAreaNames.value))
            ?? answerKeyRows.value.find(k => !k.area?.trim())  // simulacro: clave sin área
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
        const isCorrectCharValid = /^[A-E]$/.test(correctChar)
        const isResponseCharValid = /^[A-E]$/.test(responseChar)

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
        id: `${stripDigits(candidate.dni)}-${area}`,
        dni: stripDigits(candidate.dni),
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        area,
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

    // Ranking por programa con cupos
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
      plantillaId: plantilla.id,
      plantillaName: plantilla.name,
      plantillaSnapshot,
    }

    return { results: processedResults, summary }
  }

  function runCalification() {
    calificationError.value = ''

    const area = normalizeArea(calificationArea.value, effectiveAreaNames.value)
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
      areas: {
        ...activeProcess.value.areas,
        [area]: areaResult,
      },
    }

    calificationDisplayArea.value = area
    calificationConfigStorage.value[area] = { correctValue, incorrectValue, blankValue }

    // Avanzar automáticamente a la siguiente área pendiente, o cerrar si ya no hay
    const nextPending = effectiveAreaNames.value.find(
      (a) => normalizeArea(a, effectiveAreaNames.value) !== area &&
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

    for (const areaName of effectiveAreaNames.value) {
      const area = normalizeArea(areaName, effectiveAreaNames.value)
      const available = ponderationsComposable.getPlantillasForCalification(area)

      if (!available.length) {
        skippedDetails.push({ area: areaName, reason: 'Sin plantilla configurada' })
        continue
      }

      const plantilla = available.find(p => p.questionTotal === effectiveAnswersLength.value) || available[0]
      const { correctValue, incorrectValue, blankValue } = getConfigForArea(area)

      try {
        newAreas[area] = _calcForArea(area, plantilla, correctValue, incorrectValue, blankValue)
        calculated.push(areaName)
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
