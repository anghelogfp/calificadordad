<script setup>
import { ref, computed, reactive, nextTick, watch } from 'vue'
import { buildQuestionPlan } from '@/utils/helpers'
import { scoreAnswerSheet, roundScore } from '@/domain/calification/scoreAnswerSheet'
import {
  useVerificador,
  PJ_EXAM_CODES,
  extractExamCodes,
  filterExceptionsForExam,
  findCandidateInProcess,
  normalizeDni,
} from '@/composables/useVerificador'
import { useToast } from '@/composables/useToast'
import { loadPdfExportDeps } from '@/utils/exportLoaders'
import AnswerSheetPreview from '@/components/shared/AnswerSheetPreview.vue'

const props = defineProps({
  ponderations:        { type: Object, default: () => ({}) },
  currentUser:         { type: String, default: '' },
  plantillas:          { type: Array, default: () => [] },
  archiveRows:         { type: Array, default: () => [] },
  responsesRows:       { type: Array, default: () => [] },
  answerKeyRows:       { type: Array, default: () => [] },
  questionExceptions:  { type: Array, default: () => [] },
  calificationResults: { type: Array, default: () => [] },
})

const toast = useToast()
const verificador = useVerificador()

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
const subTab = ref('nueva') // 'nueva' | 'historial'
const historySearch = ref('')
const savedKeyVersion = ref(0)

// ── Modo de verificación (Poder Judicial 30 preg vs Admisión 60 preg) ────────
const verifierMode = ref('poder_judicial') // 'poder_judicial' | 'admision'

// ── Estado del formulario ─────────────────────────────────────────────────────
const selectedPlantillaId = ref(null)
const correctValue   = ref(1)
const incorrectValue = ref(0)
const blankValue     = ref(0)

const selectedExamCode  = ref('')
const dniSearchQuery    = ref('')
const loadedCandidateComparison = ref(null)

const candidatoProceso  = ref('')
const candidatoDni      = ref('')
const candidatoNombre   = ref('')
const candidatoArea     = ref('')
const candidatoPrograma = ref('')
const candidatoAula     = ref('')
const candidatoPosicion = ref('')
const candidatoTipo     = ref('')

// Simulador rápido de excepciones en el verificador
const localExceptions = ref([])
const simQuestionNumber = ref(1)
const simExceptionType = ref('ANULADA_OTORGAR')
const simValidAnswers = ref('BD')
const simExceptionReason = ref('')

// Arrays de 60 celdas (strings 'A'-'E', '*' o '')
const correctCells = reactive(Array(60).fill(''))
const answerCells  = reactive(Array(60).fill(''))

// Template refs para los inputs
const correctRefs = ref([])
const answerRefs  = ref([])

// ID de sesión activa (para edición)
const editingId = ref(null)

// ── Plantilla seleccionada ────────────────────────────────────────────────────
const plantillasList = computed(() => {
  if (Array.isArray(props.plantillas) && props.plantillas.length > 0) {
    return props.plantillas
  }
  const fromPonderations = props.ponderations?.plantillas?.value ?? props.ponderations?.plantillas
  return Array.isArray(fromPonderations) ? fromPonderations : []
})

const selectedPlantilla = computed(() =>
  plantillasList.value.find(p => p.id === selectedPlantillaId.value) ?? null
)

function plantillaOptionLabel(plantilla) {
  const name = String(plantilla?.name || 'Sin nombre')
  const area = String(plantilla?.area || '').trim()
  if (!area) return name
  return name.toLowerCase().includes(area.toLowerCase()) ? name : `${name} : ${area}`
}

const questionPlan = computed(() => {
  if (selectedPlantilla.value) {
    const built = buildQuestionPlan(selectedPlantilla.value.items || [])
    if (built.length > 0) return built
  }
  const count = verifierMode.value === 'poder_judicial' ? 30 : 60
  const defaultSubject = verifierMode.value === 'poder_judicial' ? 'Conocimientos' : 'General'
  return Array.from({ length: count }, () => ({ subject: defaultSubject, weight: 1 }))
})

const totalQuestions = computed(() => questionPlan.value.length || (verifierMode.value === 'poder_judicial' ? 30 : 60))

// Cuando se cambia de plantilla manualmente, sincronizar modo si aplica
watch(selectedPlantilla, (plantilla) => {
  if (!plantilla) return
  const built = buildQuestionPlan(plantilla.items || [])
  if (built.length === 30) {
    verifierMode.value = 'poder_judicial'
  } else if (built.length === 60) {
    verifierMode.value = 'admision'
  }
})

function setVerifierMode(mode) {
  verifierMode.value = mode
  if (mode === 'poder_judicial') {
    correctValue.value = 1
    incorrectValue.value = 0
    blankValue.value = 0
    if (selectedPlantilla.value) {
      const built = buildQuestionPlan(selectedPlantilla.value.items || [])
      if (built.length !== 30) {
        const pjPlantilla = plantillasList.value.find(p => buildQuestionPlan(p.items || []).length === 30)
        selectedPlantillaId.value = pjPlantilla ? pjPlantilla.id : null
      }
    }
    if (simQuestionNumber.value > 30) simQuestionNumber.value = 1
  } else {
    correctValue.value = 10
    incorrectValue.value = 0
    blankValue.value = 2
    if (selectedPlantilla.value) {
      const built = buildQuestionPlan(selectedPlantilla.value.items || [])
      if (built.length === 30) {
        selectedPlantillaId.value = null
      }
    }
  }
}

// ── Códigos de Examen disponibles (COD_EXAMEN) ────────────────────────────────
const availableExamCodes = computed(() => {
  const extracted = extractExamCodes({
    answerKeyRows: props.answerKeyRows,
    archiveRows: props.archiveRows,
  })
  if (extracted.length > 0) return extracted
  return PJ_EXAM_CODES.map(code => ({ code, hasKey: false, candidateCount: 0 }))
})

const activeExamCode = computed(() =>
  String(selectedExamCode.value || candidatoArea.value || '').trim()
)

// ── Excepciones activas (del proceso + simuladas en el verificador) ──────────
const processExceptionsForExam = computed(() =>
  filterExceptionsForExam(props.questionExceptions, activeExamCode.value)
)

const activeExceptionsForExam = computed(() => {
  const byQuestion = new Map()
  processExceptionsForExam.value.forEach((exc) => {
    const qNum = Number(exc.questionNumber)
    if (qNum >= 1 && qNum <= totalQuestions.value) {
      byQuestion.set(qNum, { ...exc, source: 'proceso' })
    }
  })
  localExceptions.value.forEach((exc) => {
    const qNum = Number(exc.questionNumber)
    if (qNum >= 1 && qNum <= totalQuestions.value) {
      if (exc.type === 'NONE') {
        byQuestion.delete(qNum)
      } else {
        byQuestion.set(qNum, { ...exc, source: 'simulacion' })
      }
    }
  })
  return Array.from(byQuestion.values()).sort((a, b) => a.questionNumber - b.questionNumber)
})

const activeExceptionsByQuestion = computed(() => {
  const map = new Map()
  activeExceptionsForExam.value.forEach((exc) => {
    map.set(Number(exc.questionNumber), exc)
  })
  return map
})

function addOrUpdateLocalException() {
  const qNum = Number(simQuestionNumber.value)
  if (!Number.isInteger(qNum) || qNum < 1 || qNum > totalQuestions.value) {
    toast.showToast(`Ingresa un N° de pregunta entre 1 y ${totalQuestions.value}`, 'warning')
    return
  }
  const type = String(simExceptionType.value || 'ANULADA_OTORGAR').toUpperCase()
  const validAnswers = type === 'CLAVE_MULTIPLE'
    ? String(simValidAnswers.value || '').toUpperCase().replace(/[^A-E]/g, '')
    : ''

  if (type === 'CLAVE_MULTIPLE' && validAnswers.length < 1) {
    toast.showToast('Ingresa al menos una letra válida (A-E) para clave múltiple', 'warning')
    return
  }

  const existingIdx = localExceptions.value.findIndex(e => Number(e.questionNumber) === qNum)
  const payload = {
    questionNumber: qNum,
    codExamen: activeExamCode.value || '*',
    type,
    validAnswers,
    reason: simExceptionReason.value.trim() || 'Simulación en Verificador Manual',
  }
  if (existingIdx !== -1) {
    localExceptions.value.splice(existingIdx, 1, payload)
  } else {
    localExceptions.value.push(payload)
  }
  toast.showToast(`Excepción aplicada a la pregunta ${qNum}`, 'success')
}

function setRowQuickException(questionNumber, type) {
  const qNum = Number(questionNumber)
  const existingIdx = localExceptions.value.findIndex(e => Number(e.questionNumber) === qNum)
  if (!type) {
    if (existingIdx !== -1) {
      localExceptions.value.splice(existingIdx, 1)
    } else if (processExceptionsForExam.value.some(e => Number(e.questionNumber) === qNum)) {
      localExceptions.value.push({ questionNumber: qNum, type: 'NONE' })
    }
    return
  }
  const currentKey = normalizeCell(correctCells[qNum - 1]) || 'A'
  const fallbackMulti = currentKey === 'B' ? 'BD' : `${currentKey}B`
  const payload = {
    questionNumber: qNum,
    codExamen: activeExamCode.value || '*',
    type,
    validAnswers: type === 'CLAVE_MULTIPLE' ? (simValidAnswers.value.toUpperCase().replace(/[^A-E]/g, '') || fallbackMulti) : '',
    reason: 'Simulación rápida en tabla',
  }
  if (existingIdx !== -1) {
    localExceptions.value.splice(existingIdx, 1, payload)
  } else {
    localExceptions.value.push(payload)
  }
}

function removeException(questionNumber) {
  setRowQuickException(questionNumber, '')
}

function clearLocalExceptions() {
  localExceptions.value = []
}

const savedKeyStorageId = computed(() => {
  if (selectedPlantilla.value) {
    return `calificador-verificador-clave-${selectedPlantilla.value.id}`
  }
  if (activeExamCode.value) {
    return `calificador-verificador-clave-pj-${activeExamCode.value.toLowerCase()}`
  }
  return `calificador-verificador-clave-${verifierMode.value}-${totalQuestions.value}`
})

const hasSavedCorrectKey = computed(() => {
  savedKeyVersion.value
  return !!(savedKeyStorageId.value && localStorage.getItem(savedKeyStorageId.value))
})

// ── Mapa de normalización: 1-5 → A-E, A-E → A-E, * → * ────────────────────────
const KEY_MAP = {
  '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E',
  'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
  '*': '*',
}

function normalizeCell(c, allowMultiple = false) {
  const mapped = KEY_MAP[(c || '').toUpperCase()] || ''
  if (!allowMultiple && mapped === '*') return ''
  return mapped
}

function cellsToPositionString(cells, total = totalQuestions.value, allowMultiple = false) {
  return Array.from({ length: total }, (_, index) => normalizeCell(cells[index], allowMultiple) || ' ').join('')
}

const answerString = computed(() =>
  cellsToPositionString(answerCells, totalQuestions.value, true)
)

const correctString = computed(() =>
  cellsToPositionString(correctCells, totalQuestions.value, false)
)

// ── Cálculo unificado delegando a scoreAnswerSheet ────────────────────────────
const scoringResult = computed(() => {
  const plan = questionPlan.value
  const total = plan.length
  const answersRaw = answerString.value
  const rawCorrect = correctString.value
  const exceptions = activeExceptionsForExam.value
  const excByQ = activeExceptionsByQuestion.value

  // Para evitar que scoreAnswerSheet lance error mientras el operador aún está
  // digitando las celdas de la clave una por una, proveemos un carácter seguro
  // en las posiciones donde la clave aún está vacía, preservando el cálculo exacto.
  const safeCorrectChars = Array.from({ length: total }, (_, i) => {
    const ch = rawCorrect[i] || ' '
    if (/^[A-E]$/.test(ch)) return ch
    const marked = answersRaw[i] || ' '
    return marked === 'A' ? 'B' : 'A'
  }).join('')

  const sanitizedExceptions = exceptions.map((exc) => {
    if (String(exc.type || '').toUpperCase() === 'CLAVE_MULTIPLE') {
      const cleaned = String(exc.validAnswers || '').toUpperCase().replace(/[^A-E]/g, '')
      return { ...exc, validAnswers: cleaned || 'A' }
    }
    return exc
  })

  try {
    return scoreAnswerSheet({
      answersRaw,
      correctAnswersRaw: safeCorrectChars,
      plan,
      correctValue: Number(correctValue.value) || 0,
      incorrectValue: Number(incorrectValue.value) || 0,
      blankValue: Number(blankValue.value) || 0,
      questionExceptions: sanitizedExceptions,
    })
  } catch {
    return {
      score: 0,
      maxPossibleScore: 0,
      correctCount: 0,
      incorrectCount: 0,
      blankCount: total,
      multipleCount: 0,
      annulledGrantedCount: 0,
      annulledExcludedCount: 0,
      questionDetails: [],
      subjectBreakdown: [],
      answersNormalized: answersRaw,
      correctAnswersNormalized: safeCorrectChars,
    }
  }
})

const rows = computed(() => {
  const details = scoringResult.value.questionDetails || []
  const plan = questionPlan.value
  let acum = 0

  return details.map((detail, i) => {
    const rawMarked = String(answerCells[i] || '').toUpperCase()
    const rawCorrect = String(correctCells[i] || '').toUpperCase()
    const isCorrectValid = /^[A-E]$/.test(normalizeCell(correctCells[i]))
    const isMarkedValid = /^[A-E]$/.test(normalizeCell(answerCells[i]))
    const isMultipleMark = rawMarked === '*'

    acum = roundScore(acum + detail.score)

    let displayCorrect = isCorrectValid ? rawCorrect : '?'
    if (detail.exceptionApplied === 'ANULADA_OTORGAR') {
      displayCorrect = isCorrectValid ? `${rawCorrect} (+)` : 'ANUL+'
    } else if (detail.exceptionApplied === 'ANULADA_EXCLUIR') {
      displayCorrect = 'EXCL'
    } else if (detail.exceptionApplied === 'CLAVE_MULTIPLE') {
      displayCorrect = detail.correctAnswer || rawCorrect || '?'
    }

    return {
      ...detail,
      n: detail.number,
      subject: plan[i]?.subject || detail.subject || '',
      marked: isMultipleMark ? '*' : (isMarkedValid ? rawMarked : '—'),
      correct: displayCorrect,
      weight: detail.weight,
      status: detail.status,
      pts: detail.score,
      acum,
      exceptionApplied: detail.exceptionApplied || null,
    }
  })
})

// Alias requerido por contrato reactivo
const questionResults = rows

const detailColumns = computed(() => {
  const all = rows.value
  if (all.length === 30) {
    return [
      all.slice(0, 10),
      all.slice(10, 20),
      all.slice(20, 30),
    ]
  }
  const midpoint = Math.ceil(all.length / 2)
  return [
    all.slice(0, midpoint),
    all.slice(midpoint),
  ].filter(column => column.length > 0)
})

const questionBlocks = computed(() => {
  const total = totalQuestions.value
  const blocks = []
  for (let start = 1; start <= total; start += 10) {
    const end = Math.min(start + 9, total)
    const indices = []
    for (let q = start; q <= end; q++) indices.push(q)
    blocks.push({
      label: `Preguntas ${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')}`,
      indices,
    })
  }
  return blocks
})

const stats = computed(() => ({
  correctCount: scoringResult.value.correctCount,
  incorrectCount: scoringResult.value.incorrectCount,
  blankCount: scoringResult.value.blankCount,
  multipleCount: scoringResult.value.multipleCount,
  annulledGrantedCount: scoringResult.value.annulledGrantedCount,
  annulledExcludedCount: scoringResult.value.annulledExcludedCount,
  score: scoringResult.value.score,
  maxPossibleScore: scoringResult.value.maxPossibleScore,
}))

// Alias requerido por contrato reactivo
const totals = stats

const missingSummary = computed(() => {
  const total = totalQuestions.value
  const excMap = activeExceptionsByQuestion.value
  let missingCorrect = 0
  let missingAnswers = 0
  for (let i = 0; i < total; i++) {
    const exc = excMap.get(i + 1)
    const excCoversKey = exc && (
      exc.type === 'ANULADA_OTORGAR' ||
      exc.type === 'ANULADA_EXCLUIR' ||
      (exc.type === 'CLAVE_MULTIPLE' && String(exc.validAnswers || '').trim().length > 0)
    )
    if (!excCoversKey && !normalizeCell(correctCells[i])) {
      missingCorrect++
    }
    if (!normalizeCell(answerCells[i], true)) {
      missingAnswers++
    }
  }
  return { missingCorrect, missingAnswers }
})

const subjectBreakdown = computed(() =>
  (scoringResult.value.subjectBreakdown || []).map(item => ({
    ...item,
    subject: item.subject === 'Sin materia' ? 'Sin curso' : item.subject,
    points: item.score,
  }))
)

const subjectSummary = subjectBreakdown

// Comparación con Ranking Oficial
const rankingComparison = computed(() => {
  const targetDni = normalizeDni(candidatoDni.value || dniSearchQuery.value)
  const fromResults = targetDni && Array.isArray(props.calificationResults)
    ? props.calificationResults.find(r => normalizeDni(r?.dni) === targetDni) || null
    : null
  const official = fromResults || loadedCandidateComparison.value
  if (!official || official.score === undefined || official.score === null) return null

  const verifierScore = Number(stats.value.score)
  const officialScore = roundScore(Number(official.score))
  const diff = roundScore(Math.abs(verifierScore - officialScore))
  const matches = diff < 0.001

  return {
    dni: official.dni || targetDni,
    verifierScore,
    officialScore,
    diff,
    matches,
    condicion: official.condicion || '',
    position: official.positionInPrograma ?? official.position ?? '',
  }
})

const filteredSesiones = computed(() => {
  const needle = historySearch.value.trim().toLowerCase()
  if (!needle) return verificador.sesiones.value
  return verificador.sesiones.value.filter((s) => [
    s.dni,
    s.nombre,
    s.proceso,
    s.area,
    s.programa,
    s.aula,
    s.tipo_prueba,
    s.plantilla_name,
  ].some(value => String(value || '').toLowerCase().includes(needle)))
})

// Mostrar tabla si hay al menos una respuesta, clave o excepción activa
const hasAnyAnswer = computed(() =>
  answerCells.slice(0, totalQuestions.value).some(c => !!KEY_MAP[c?.toUpperCase()]) ||
  correctCells.slice(0, totalQuestions.value).some(c => !!KEY_MAP[c?.toUpperCase()]) ||
  activeExceptionsForExam.value.length > 0
)

function ensureCellCapacity(total = totalQuestions.value) {
  const cap = Math.max(60, total)
  for (let i = correctCells.length; i < cap; i++) correctCells[i] = ''
  for (let i = answerCells.length; i < cap; i++) answerCells[i] = ''
}

function extractAnswerChars(text, allowMultiple = false) {
  return String(text || '')
    .toUpperCase()
    .split('')
    .map(ch => normalizeCell(ch, allowMultiple))
    .filter(Boolean)
}

function setCell(index, gridType, val) {
  if (gridType === 'correct') correctCells[index] = val
  else                        answerCells[index]  = val
}

function fillCellsFromText(gridType, text, startIndex = 0) {
  const allowMulti = gridType !== 'correct'
  const chars = extractAnswerChars(text, allowMulti)
  if (!chars.length) return 0
  const target = gridType === 'correct' ? correctCells : answerCells
  const max = Math.min(totalQuestions.value, startIndex + chars.length)
  for (let i = startIndex; i < max; i++) {
    target[i] = chars[i - startIndex]
  }
  return max - startIndex
}

function fillCellsPositional(gridType, rawString) {
  ensureCellCapacity()
  const target = gridType === 'correct' ? correctCells : answerCells
  const allowMulti = gridType !== 'correct'
  const total = totalQuestions.value
  const str = String(rawString ?? '')
  for (let i = 0; i < target.length; i++) {
    if (i < total) {
      const ch = str[i] || ''
      target[i] = normalizeCell(ch, allowMulti)
    } else {
      target[i] = ''
    }
  }
}

// ── Cargar Clave por Código de Examen (COD_EXAMEN) ────────────────────────────
function handleSelectExamCode(codeInput) {
  const code = String(codeInput ?? selectedExamCode.value ?? '').trim()
  selectedExamCode.value = code
  if (!code) return

  candidatoArea.value = code
  if (!candidatoTipo.value) candidatoTipo.value = code

  const keyRow = Array.isArray(props.answerKeyRows)
    ? props.answerKeyRows.find(
        k => String(k?.cod_examen || k?.codExamen || k?.area || '').trim().toLowerCase() === code.toLowerCase()
      )
    : null

  if (keyRow) {
    const rawKey = String(keyRow.answers || keyRow.correct_answers || keyRow.respuestas || '')
    if (rawKey.trim().length <= 30) {
      setVerifierMode('poder_judicial')
    }
    fillCellsPositional('correct', rawKey)
    toast.showToast(`Clave oficial cargada para ${code}`, 'success')
  } else {
    toast.showToast(`Código ${code} seleccionado (sin clave en el proceso activo)`, 'info')
  }
}

// ── Buscar Postulante por DNI en el Proceso ───────────────────────────────────
function buscarPostulantePorDni() {
  const query = normalizeDni(dniSearchQuery.value || candidatoDni.value)
  if (!query) {
    toast.showToast('Ingresa un DNI para buscar en el proceso', 'warning')
    return
  }

  const found = findCandidateInProcess(query, {
    archiveRows: props.archiveRows,
    responsesRows: props.responsesRows,
    answerKeyRows: props.answerKeyRows,
    calificationResults: props.calificationResults,
  })

  if (!found) {
    loadedCandidateComparison.value = null
    toast.showToast(`No se encontró al postulante con DNI ${query} en el proceso activo`, 'warning')
    return
  }

  // Si el candidato tiene cod_examen o respuestas de 30 preguntas, activar modo PJ
  if (
    found.codExamen &&
    (PJ_EXAM_CODES.some(c => c.toLowerCase() === found.codExamen.toLowerCase()) ||
      (found.correctAnswersRaw && found.correctAnswersRaw.trim().length <= 30))
  ) {
    setVerifierMode('poder_judicial')
  }

  candidatoDni.value = found.dni
  dniSearchQuery.value = found.dni
  candidatoNombre.value = found.fullName || candidatoNombre.value
  candidatoArea.value = found.codExamen || candidatoArea.value
  selectedExamCode.value = found.codExamen || selectedExamCode.value

  const programaParts = [found.codPuesto, found.puesto, found.unidad].filter(Boolean)
  candidatoPrograma.value = programaParts.join(' — ') || found.puesto || candidatoPrograma.value

  const aulaParts = [found.grupo, found.aula].filter(Boolean)
  candidatoAula.value = aulaParts.join(' · ') || found.aula || candidatoAula.value

  if (found.officialResult?.positionInPrograma || found.officialResult?.position) {
    candidatoPosicion.value = String(found.officialResult.positionInPrograma ?? found.officialResult.position)
  }
  if (found.codExamen) {
    candidatoTipo.value = found.codExamen
  }

  if (found.correctAnswersRaw) {
    fillCellsPositional('correct', found.correctAnswersRaw)
  }
  if (found.answersRaw) {
    fillCellsPositional('answer', found.answersRaw)
  }

  loadedCandidateComparison.value = found.officialResult || null
  toast.showToast(`Datos cargados para DNI ${found.dni}`, 'success')
}

// ── Navegación de celdas ──────────────────────────────────────────────────────
function handleCellInput(e, index, gridType) {
  const raw = e.target.value.toUpperCase()
  const allowMulti = gridType !== 'correct'
  let stored = ''
  for (const ch of raw) {
    if (normalizeCell(ch, allowMulti)) { stored = ch; break }
  }
  setCell(index, gridType, stored)
  e.target.value = stored
  if (stored && index < totalQuestions.value - 1) {
    nextTick(() => {
      const refs = gridType === 'correct' ? correctRefs.value : answerRefs.value
      refs[index + 1]?.focus()
    })
  }
}

function handleCellPaste(e, index, gridType) {
  const text = e.clipboardData?.getData('text') || ''
  const allowMulti = gridType !== 'correct'
  const chars = extractAnswerChars(text, allowMulti)
  if (chars.length <= 1) return
  e.preventDefault()
  const filled = fillCellsFromText(gridType, text, index)
  const refs = gridType === 'correct' ? correctRefs.value : answerRefs.value
  const nextIndex = Math.min(index + filled, totalQuestions.value - 1)
  nextTick(() => refs[nextIndex]?.focus())
}

function handleCellKeydown(e, index, gridType) {
  const refs = gridType === 'correct' ? correctRefs.value : answerRefs.value
  const key  = e.key.toUpperCase()
  const allowMulti = gridType !== 'correct'

  if (normalizeCell(key, allowMulti)) {
    e.preventDefault()
    setCell(index, gridType, key)
    e.target.value = key
    if (index < totalQuestions.value - 1) {
      nextTick(() => refs[index + 1]?.focus())
    }
    return
  }

  if (e.key === 'Backspace') {
    e.preventDefault()
    setCell(index, gridType, '')
    e.target.value = ''
    if (index > 0) nextTick(() => refs[index - 1]?.focus())
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    setCell(index, gridType, '')
    e.target.value = ''
    return
  }
  if (e.key === 'ArrowRight' && index < totalQuestions.value - 1) {
    e.preventDefault(); refs[index + 1]?.focus()
  }
  if (e.key === 'ArrowLeft' && index > 0) {
    e.preventDefault(); refs[index - 1]?.focus()
  }
  if (e.key === 'ArrowDown' && index + 10 < totalQuestions.value) {
    e.preventDefault(); refs[index + 10]?.focus()
  }
  if (e.key === 'ArrowUp' && index - 10 >= 0) {
    e.preventDefault(); refs[index - 10]?.focus()
  }
}

// ── Acciones ──────────────────────────────────────────────────────────────────
function limpiar() {
  ensureCellCapacity()
  for (let i = 0; i < correctCells.length; i++) {
    correctCells[i] = ''
    answerCells[i]  = ''
  }
  candidatoProceso.value  = ''
  candidatoDni.value      = ''
  dniSearchQuery.value    = ''
  selectedExamCode.value  = ''
  loadedCandidateComparison.value = null
  candidatoNombre.value   = ''
  candidatoArea.value     = ''
  candidatoPrograma.value = ''
  candidatoAula.value     = ''
  candidatoPosicion.value = ''
  candidatoTipo.value     = ''
  localExceptions.value   = []
  editingId.value = null
}

async function guardar() {
  if (!selectedPlantilla.value && verifierMode.value !== 'poder_judicial') {
    toast.showToast('Selecciona una plantilla antes de guardar', 'warning')
    return
  }
  if (missingSummary.value.missingCorrect > 0) {
    toast.showToast(`Completa la clave oficial: faltan ${missingSummary.value.missingCorrect} respuesta(s).`, 'warning')
    return
  }

  ensureCellCapacity()
  const total = totalQuestions.value
  const defaultSnapshot = [{ subject: 'Conocimientos', questions: total, weight: 1 }]
  const payload = {
    plantilla_id:       selectedPlantilla.value?.id ?? null,
    plantilla_name:     selectedPlantilla.value?.name ?? (verifierMode.value === 'poder_judicial' ? 'Poder Judicial — 30 Preguntas' : 'Admisión — 60 Preguntas'),
    plantilla_snapshot: selectedPlantilla.value?.items ?? defaultSnapshot,
    proceso:    candidatoProceso.value.trim(),
    dni:        candidatoDni.value.trim(),
    nombre:     candidatoNombre.value.trim(),
    area:       candidatoArea.value.trim(),
    programa:   candidatoPrograma.value.trim(),
    aula:       candidatoAula.value.trim(),
    posicion:   candidatoPosicion.value.trim(),
    tipo_prueba: candidatoTipo.value.trim(),
    answers:         cellsToPositionString(answerCells, total, true),
    correct_answers: cellsToPositionString(correctCells, total, false),
    correct_value:   Number(correctValue.value),
    incorrect_value: Number(incorrectValue.value),
    blank_value:     Number(blankValue.value),
    score: stats.value.score,
  }

  let result
  if (editingId.value) {
    result = await verificador.updateSesion(editingId.value, payload)
  } else {
    result = await verificador.saveSesion(payload)
  }

  if (result) {
    editingId.value = result.id
    toast.showToast('Verificación guardada', 'success')
  } else {
    toast.showToast('Error al guardar', 'error')
  }
}

function cargarSesion(sesion) {
  selectedPlantillaId.value = sesion.plantilla_id
  const ansStr = String(sesion.answers || '')
  const corStr = String(sesion.correct_answers || '')
  if (!sesion.plantilla_id && (corStr.trim().length <= 30 || Number(sesion.correct_value) === 1)) {
    verifierMode.value = 'poder_judicial'
  }
  ensureCellCapacity()
  const total = totalQuestions.value

  const ans = ansStr.padEnd(total, ' ')
  const cor = corStr.padEnd(total, ' ')
  for (let i = 0; i < answerCells.length; i++) {
    answerCells[i]  = normalizeCell(ans[i], true)
    correctCells[i] = normalizeCell(cor[i], false)
  }

  candidatoProceso.value  = sesion.proceso || ''
  candidatoDni.value      = sesion.dni || ''
  candidatoNombre.value   = sesion.nombre || ''
  candidatoArea.value     = sesion.area || ''
  selectedExamCode.value  = sesion.area || ''
  candidatoPrograma.value = sesion.programa || ''
  candidatoAula.value     = sesion.aula || ''
  candidatoPosicion.value = sesion.posicion || ''
  candidatoTipo.value     = sesion.tipo_prueba || ''
  correctValue.value      = Number(sesion.correct_value)
  incorrectValue.value    = Number(sesion.incorrect_value)
  blankValue.value        = Number(sesion.blank_value)
  editingId.value         = sesion.id

  subTab.value = 'nueva'
}

function duplicarSesion(sesion) {
  cargarSesion(sesion)
  editingId.value = null
  candidatoNombre.value = candidatoNombre.value ? `${candidatoNombre.value} (copia)` : ''
  toast.showToast('Verificación duplicada como nueva', 'success')
}

async function eliminarSesion(id) {
  await verificador.deleteSesion(id)
  if (editingId.value === id) {
    editingId.value = null
  }
  toast.showToast('Sesión eliminada', 'success')
}

function abrirHistorial() {
  subTab.value = 'historial'
  verificador.fetchSesiones()
}

function saveCorrectKey() {
  const key = correctCells.slice(0, totalQuestions.value).map(c => normalizeCell(c)).join('')
  if (!key.trim() || missingSummary.value.missingCorrect > 0) {
    toast.showToast('Completa la clave correcta antes de guardarla', 'warning')
    return
  }
  localStorage.setItem(savedKeyStorageId.value, key)
  savedKeyVersion.value += 1
  toast.showToast('Clave frecuente guardada', 'success')
}

function useSavedCorrectKey() {
  const key = savedKeyStorageId.value ? localStorage.getItem(savedKeyStorageId.value) : ''
  if (!key) {
    toast.showToast('No hay clave guardada para esta configuración', 'warning')
    return
  }
  fillCellsFromText('correct', key)
  toast.showToast('Clave frecuente cargada', 'success')
}

function exportHistoryCsv() {
  const rowsToExport = filteredSesiones.value
  if (!rowsToExport.length) {
    toast.showToast('No hay verificaciones para exportar', 'warning')
    return
  }
  const headers = ['Fecha', 'Proceso', 'DNI', 'Nombre', 'Area', 'Programa', 'Aula', 'Posicion', 'Tipo', 'Plantilla', 'Puntaje']
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rowsToExport.map(s => [
      formatFecha(s.created_at),
      s.proceso,
      s.dni,
      s.nombre,
      s.area,
      s.programa,
      s.aula,
      s.posicion,
      s.tipo_prueba,
      s.plantilla_name,
      Number(s.score).toFixed(3),
    ].map(escapeCsv).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `historial-verificador-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function abbrevCurso(name) {
  if (!name) return '—'
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return words.map(w => w[0].toUpperCase()).join('.')
  return name.slice(0, 3).toUpperCase()
}

function exceptionBadgeLabel(excType) {
  if (excType === 'ANULADA_OTORGAR') return 'Anulada (+pts)'
  if (excType === 'ANULADA_EXCLUIR') return 'Anulada (Excluida)'
  if (excType === 'CLAVE_MULTIPLE') return 'Clave múltiple'
  return ''
}

async function _loadLogo() {
  try {
    const res = await fetch('/unap.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function exportPdf() {
  if (!hasAnyAnswer.value) {
    toast.showToast('Ingresa respuestas antes de exportar', 'warning')
    return
  }
  if (missingSummary.value.missingCorrect > 0) {
    toast.showToast(`Completa la clave oficial: faltan ${missingSummary.value.missingCorrect} respuesta(s).`, 'warning')
    return
  }

  const { correctCount, incorrectCount, blankCount, score } = stats.value
  const { jsPDF, autoTable } = await loadPdfExportDeps()
  const logoBase64 = await _loadLogo()
  const allRows    = rows.value

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 210
  const pageH = doc.internal.pageSize.getHeight()  // 297

  // ── 1. Encabezado institucional ───────────────────────────────────────────────
  const HDR_H = 28
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageW, HDR_H, 'F')

  if (logoBase64) doc.addImage(logoBase64, 'PNG', 7, 3, 20, 20)
  const txtX = logoBase64 ? pageW / 2 + 5 : pageW / 2

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO DE PUNO', txtX, 8, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text(
    verifierMode.value === 'poder_judicial'
      ? 'DIRECCIÓN DE ADMISIÓN · CONCURSO PODER JUDICIAL CSJ PUNO'
      : 'DIRECCIÓN DE ADMISIÓN',
    txtX, 14, { align: 'center' }
  )
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(
    selectedPlantilla.value?.name ||
      (verifierMode.value === 'poder_judicial' ? 'VERIFICACIÓN MANUAL — 30 PREGUNTAS' : 'VERIFICACIÓN DE RESPUESTAS'),
    txtX, 20, { align: 'center' }
  )
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  const hdrSub = candidatoProceso.value.trim()
    ? candidatoProceso.value.trim().toUpperCase()
    : 'VERIFICADOR MANUAL DE RESPUESTAS'
  doc.text(hdrSub, txtX, 25.5, { align: 'center' })

  // ── 2. Card candidato ─────────────────────────────────────────────────────────
  const CAND_Y = HDR_H + 3
  const CAND_H = 38
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.rect(10, CAND_Y, pageW - 20, CAND_H, 'FD')
  doc.setFillColor(30, 41, 59)
  doc.rect(10, CAND_Y, 3, CAND_H, 'F')

  const procesoStr = candidatoProceso.value.trim()
  if (procesoStr) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 58, 138)
    doc.text(procesoStr.toUpperCase(), 17, CAND_Y + 5)
  }

  const nombre = candidatoNombre.value.trim() || 'Sin nombre'
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(nombre.toUpperCase(), 17, CAND_Y + (procesoStr ? 11 : 8))

  const subLine = [candidatoArea.value.trim(), candidatoPrograma.value.trim()].filter(Boolean).join(' · ')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(subLine || '—', 17, CAND_Y + (procesoStr ? 17 : 14))

  const scoreStr  = score.toFixed(3)
  const scoreBoxW = 34
  const scoreBoxH = 22
  const scoreBoxX = pageW - 13 - scoreBoxW
  const scoreBoxY = CAND_Y + 2
  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(0.8)
  doc.roundedRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 2, 2, 'D')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('PUNTAJE', scoreBoxX + scoreBoxW / 2, scoreBoxY + 7, { align: 'center' })
  doc.setFontSize(14)
  doc.setTextColor(120, 53, 15)
  doc.text(scoreStr, scoreBoxX + scoreBoxW / 2, scoreBoxY + 17, { align: 'center' })

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(17, CAND_Y + 22, scoreBoxX - 3, CAND_Y + 22)

  const fieldDefs = [
    ['DNI',          candidatoDni.value      || '—'],
    ['Aula / Grupo', candidatoAula.value     || '—'],
    ['Posición',     candidatoPosicion.value || '—'],
    ['Cód. Examen',  candidatoTipo.value || candidatoArea.value || '—'],
  ]
  const fieldColW = (scoreBoxX - 3 - 17) / fieldDefs.length
  fieldDefs.forEach(([label, val], i) => {
    const fx = 17 + i * fieldColW
    const fy = CAND_Y + 25
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), fx, fy)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), fx, fy + 5.5)
  })

  // ── 3. Barra de estadísticas (inline) ────────────────────────────────────────
  const STATS_Y = CAND_Y + CAND_H + 2
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.15)
  doc.rect(10, STATS_Y, pageW - 20, 9, 'FD')

  doc.setFontSize(7.5)
  const statPairs = [
    ['Correctas: ',   `${correctCount}`,          [21, 128, 61]],
    ['Incorrectas: ', `${incorrectCount}`,        [220, 38, 38]],
    ['En blanco: ',   `${blankCount}`,            [100, 116, 139]],
    ['C×',            `${correctValue.value}`,    [30, 41, 59]],
    ['I×',            `${incorrectValue.value}`,  [30, 41, 59]],
    ['B×',            `${blankValue.value}`,      [30, 41, 59]],
    ['Excepciones: ', `${activeExceptionsForExam.value.length}`, [146, 64, 14]],
  ]
  let sx = 14
  statPairs.forEach(([label, val, rgb]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(label, sx, STATS_Y + 6)
    sx += doc.getTextWidth(label)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...rgb)
    doc.text(val, sx, STATS_Y + 6)
    sx += doc.getTextWidth(val) + 5
  })

  // ── 4. Tablas dos columnas ────────────────────────────────────────────────────
  const TABLE_Y = STATS_Y + 12
  const GAP     = 5
  const halfW   = (pageW - 20 - GAP) / 2

  const CW = { 0: 8, 1: 18, 2: 11, 3: 11, 4: 12, 5: 14, 6: 18.5 }
  const HEAD = [['N°', 'Curso', 'Marc.', 'Corr.', 'Pond.', 'Pts', 'Acum.']]

  function buildBody(halfRows) {
    return halfRows.map(r => [
      r.n,
      r.exceptionApplied ? exceptionBadgeLabel(r.exceptionApplied) : abbrevCurso(r.subject),
      r.status === 'blank' ? '—' : r.marked,
      r.correct,
      `×${Number(r.weight).toFixed(3)}`,
      r.pts.toFixed(3),
      r.acum.toFixed(3),
    ])
  }

  function makeDidParseCell(halfRows, isLastTable) {
    return function(data) {
      if (data.section !== 'body') return
      const row = halfRows[data.row.index]
      if (!row) return
      const col    = data.column.index
      const isLast = data.row.index === halfRows.length - 1

      if (row.status === 'correct')   data.cell.styles.fillColor = [240, 253, 244]
      if (row.status === 'incorrect') data.cell.styles.fillColor = [255, 245, 245]
      if (row.status === 'excluded')  data.cell.styles.fillColor = [241, 245, 249]

      if (col === 2) {
        data.cell.styles.fontStyle = 'bold'
        if (row.status === 'correct')   data.cell.styles.textColor = [21, 128, 61]
        if (row.status === 'incorrect') data.cell.styles.textColor = [220, 38, 38]
        if (row.status === 'blank')     data.cell.styles.textColor = [148, 163, 184]
      }
      if (col === 3) {
        data.cell.styles.textColor = [29, 78, 216]
        data.cell.styles.fontStyle = 'bold'
      }
      if (col === 5 && row.status === 'correct') {
        data.cell.styles.textColor = [21, 128, 61]
      }
      if (isLastTable && col === 6 && isLast) {
        data.cell.styles.fillColor = [254, 249, 195]
        data.cell.styles.textColor = [146, 64, 14]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  }

  const half      = Math.ceil(allRows.length / 2)
  const leftRows  = allRows.slice(0, half)
  const rightRows = allRows.slice(half)

  const sharedCfg = (halfRows, marginLeft, marginRight, isLastTable) => ({
    startY: TABLE_Y,
    margin: { left: marginLeft, right: marginRight },
    head: HEAD,
    body: buildBody(halfRows),
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      halign: 'center',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: CW[0] },
      1: { cellWidth: CW[1], halign: 'left', fontSize: 7, overflow: 'ellipsize' },
      2: { cellWidth: CW[2] },
      3: { cellWidth: CW[3] },
      4: { cellWidth: CW[4], fontSize: 7 },
      5: { cellWidth: CW[5] },
      6: { cellWidth: CW[6], fontStyle: 'bold' },
    },
    headStyles: {
      fillColor: [30, 41, 59], textColor: 255,
      fontStyle: 'bold', fontSize: 7.5, cellPadding: 2,
    },
    didParseCell: makeDidParseCell(halfRows, isLastTable),
  })

  autoTable(doc, sharedCfg(leftRows,  10,              10 + halfW + GAP, false))
  autoTable(doc, sharedCfg(rightRows, 10 + halfW + GAP, 10,              true))

  // Espacio de firmas en modo 30 preguntas
  if (allRows.length <= 30) {
    const signY = pageH - 22
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.line(25, signY, 90, signY)
    doc.line(120, signY, 185, signY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('POR LA UNIVERSIDAD NACIONAL DEL ALTIPLANO', 57.5, signY + 4, { align: 'center' })
    doc.text('POR LA COMISIÓN PODER JUDICIAL — CSJ PUNO', 152.5, signY + 4, { align: 'center' })
  }

  // ── 5. Footer ─────────────────────────────────────────────────────────────────
  const now   = new Date()
  const fecha = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Generado: ${fecha}  ${hora}` + (props.currentUser ? `   ·   ${props.currentUser}` : ''),
    14, pageH - 5
  )
  doc.text('Pág. 1 / 1', pageW - 12, pageH - 5, { align: 'right' })

  const safe = (candidatoDni.value || 'verificador').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  doc.save(`verificador-${safe}-${fecha.replace(/\//g, '')}.pdf`)
}

function formatFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="verificador">
    <!-- Encabezado -->
    <div class="verificador__header">
      <div class="verificador__title-row">
        <h2 class="verificador__title">Verificador de Respuestas</h2>
        <p class="verificador__subtitle">
          Verifica hojas de respuestas con el motor oficial <code>scoreAnswerSheet</code>, claves por código de examen y simulación de excepciones en vivo
        </p>
      </div>
      <div class="verificador__tabs">
        <button
          type="button"
          class="vtab"
          :class="{ 'vtab--active': subTab === 'nueva' }"
          @click="subTab = 'nueva'"
        >Nueva verificación</button>
        <button
          type="button"
          class="vtab"
          :class="{ 'vtab--active': subTab === 'historial' }"
          @click="abrirHistorial"
        >
          Historial
          <span v-if="verificador.sesiones.value.length" class="vtab__badge">
            {{ verificador.sesiones.value.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- ══ SUB-TAB: NUEVA VERIFICACIÓN ══════════════════════════════════════════ -->
    <div v-if="subTab === 'nueva'" class="verificador__body">

      <!-- Selector rápido de Perfil: Poder Judicial (30) vs Admisión (60) -->
      <div class="mode-switch-bar" role="region" aria-label="Modo de verificación">
        <div class="mode-switch-bar__buttons">
          <button
            type="button"
            class="mode-btn"
            :class="{ 'mode-btn--active': verifierMode === 'poder_judicial' }"
            data-testid="mode-pj-btn"
            @click="setVerifierMode('poder_judicial')"
          >
            <span class="mode-btn__dot" />
            Modo Poder Judicial (30 preguntas · 1 / 0 / 0)
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ 'mode-btn--active': verifierMode === 'admision' }"
            data-testid="mode-admision-btn"
            @click="setVerifierMode('admision')"
          >
            <span class="mode-btn__dot" />
            Modo Admisión (60 preguntas · 10 / 0 / 2)
          </button>
        </div>
        <div class="mode-switch-bar__info">
          <span class="mode-pill">{{ totalQuestions }} preguntas</span>
          <span class="mode-pill mode-pill--max">Máx: {{ stats.maxPossibleScore.toFixed(3) }} pts</span>
        </div>
      </div>

      <!-- Barra de Carga Rápida del Proceso: Búsqueda por DNI + Selector COD_EXAMEN -->
      <div class="vcard vcard--quickload">
        <div class="quickload-grid">
          <!-- Búsqueda instantánea por DNI -->
          <div class="quickload-block">
            <label class="config-label" for="verificador-dni-search">
              Buscar Postulante por DNI en el Proceso
            </label>
            <div class="quickload-input-row">
              <input
                id="verificador-dni-search"
                v-model="dniSearchQuery"
                type="text"
                maxlength="12"
                placeholder="Ej: 44095837"
                class="config-input config-input--flex"
                data-testid="dni-search-input"
                @keydown.enter.prevent="buscarPostulantePorDni"
              />
              <button
                type="button"
                class="btn btn--primary"
                data-testid="dni-search-btn"
                @click="buscarPostulantePorDni"
              >
                Cargar del Proceso
              </button>
            </div>
          </div>

          <!-- Selector de Clave por Código de Examen (COD_EXAMEN) -->
          <div class="quickload-block">
            <label class="config-label" for="verificador-cod-examen">
              Cargar Clave por Código de Examen (COD_EXAMEN)
            </label>
            <div class="quickload-input-row">
              <select
                id="verificador-cod-examen"
                v-model="selectedExamCode"
                class="config-select config-input--flex"
                data-testid="cod-examen-select"
                @change="handleSelectExamCode(selectedExamCode)"
              >
                <option value="">— Seleccionar código (27 tipos) —</option>
                <option
                  v-for="item in availableExamCodes"
                  :key="item.code"
                  :value="item.code"
                >
                  {{ item.code }}{{ item.hasKey ? ' · Clave cargada' : '' }}{{ item.candidateCount ? ` (${item.candidateCount} post.)` : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Banner comparativo con el Ranking Oficial -->
        <div
          v-if="rankingComparison"
          class="comparison-banner"
          :class="rankingComparison.matches ? 'comparison-banner--ok' : 'comparison-banner--diff'"
          data-testid="ranking-comparison-banner"
        >
          <div class="comparison-banner__main">
            <strong>Puntaje en Verificador: {{ rankingComparison.verifierScore.toFixed(3) }}</strong>
            <span>vs</span>
            <strong>Puntaje en Ranking Oficial: {{ rankingComparison.officialScore.toFixed(3) }}</strong>
            <span>—</span>
            <span v-if="rankingComparison.matches" class="comparison-banner__status">
              COINCIDE 100% ✅
            </span>
            <span v-else class="comparison-banner__status">
              DIFIERE EN {{ rankingComparison.diff.toFixed(3) }} PTS ⚠️
            </span>
          </div>
          <div v-if="rankingComparison.condicion || rankingComparison.position" class="comparison-banner__meta">
            <span v-if="rankingComparison.position">Mérito: #{{ rankingComparison.position }}</span>
            <span v-if="rankingComparison.condicion">{{ rankingComparison.condicion }}</span>
          </div>
        </div>
      </div>

      <!-- Control operativo -->
      <div class="vcard vcard--control">
        <div class="control-panel">
          <div class="control-panel__main">
            <div class="vcard__title">Configuración de Ponderación y Puntaje</div>
            <div class="config-row">
              <div class="config-field config-field--wide">
                <label class="config-label">Plantilla de Ponderaciones</label>
                <select v-model.number="selectedPlantillaId" class="config-select">
                  <option :value="null">
                    {{ verifierMode === 'poder_judicial' ? 'Poder Judicial — 30 Preguntas (Peso 1.0)' : 'Sin Plantilla (60 Preguntas)' }}
                  </option>
                  <option v-for="p in plantillasList" :key="p.id" :value="p.id">
                    {{ plantillaOptionLabel(p) }}
                  </option>
                </select>
              </div>

              <div class="config-field">
                <label class="config-label">Correcta ×</label>
                <input v-model.number="correctValue" type="number" step="0.1" class="config-input" data-testid="correct-value-input" />
              </div>
              <div class="config-field">
                <label class="config-label">Incorrecta ×</label>
                <input v-model.number="incorrectValue" type="number" step="0.1" class="config-input" data-testid="incorrect-value-input" />
              </div>
              <div class="config-field">
                <label class="config-label">Blanco ×</label>
                <input v-model.number="blankValue" type="number" step="0.1" class="config-input" data-testid="blank-value-input" />
              </div>
            </div>
          </div>

          <div class="score-panel" :class="{ 'score-panel--empty': !hasAnyAnswer }">
            <span class="score-panel__label">Puntaje</span>
            <strong class="score-panel__value" data-testid="verifier-total-score">{{ stats.score.toFixed(3) }}</strong>
            <div class="score-panel__meta">
              <span class="score-chip score-chip--correct">{{ stats.correctCount }} C</span>
              <span class="score-chip score-chip--incorrect">{{ stats.incorrectCount }} I</span>
              <span class="score-chip score-chip--blank">{{ stats.blankCount }} B</span>
              <span v-if="stats.multipleCount" class="score-chip score-chip--multiple">{{ stats.multipleCount }} *</span>
              <span v-if="stats.annulledGrantedCount" class="score-chip score-chip--granted">+{{ stats.annulledGrantedCount }} Anul.</span>
              <span v-if="stats.annulledExcludedCount" class="score-chip score-chip--excluded">{{ stats.annulledExcludedCount }} Excl.</span>
            </div>
          </div>
        </div>

        <!-- Simulador rápido de excepciones de pregunta en el verificador -->
        <details class="exception-simulator" open>
          <summary>
            <span>Simulador Rápido de Excepciones por Pregunta (En Vivo)</span>
            <span v-if="activeExceptionsForExam.length" class="exc-count-badge">
              {{ activeExceptionsForExam.length }} activa(s)
            </span>
          </summary>
          <div class="exception-simulator__body">
            <div class="exception-simulator__form">
              <div class="config-field">
                <label class="config-label">N° Pregunta</label>
                <input
                  v-model.number="simQuestionNumber"
                  type="number"
                  min="1"
                  :max="totalQuestions"
                  class="config-input"
                  data-testid="sim-question-number"
                />
              </div>
              <div class="config-field config-field--wide">
                <label class="config-label">Tipo de Excepción</label>
                <select
                  v-model="simExceptionType"
                  class="config-select"
                  data-testid="sim-exception-type"
                >
                  <option value="ANULADA_OTORGAR">Anulada (+pts a todos)</option>
                  <option value="ANULADA_EXCLUIR">Anulada (Excluida del cálculo)</option>
                  <option value="CLAVE_MULTIPLE">Clave múltiple (ej. BD)</option>
                </select>
              </div>
              <div v-if="simExceptionType === 'CLAVE_MULTIPLE'" class="config-field">
                <label class="config-label">Claves Válidas</label>
                <input
                  v-model="simValidAnswers"
                  type="text"
                  maxlength="5"
                  placeholder="BD"
                  class="config-input"
                  data-testid="sim-valid-answers"
                />
              </div>
              <div class="config-field config-field--wide">
                <label class="config-label">Sustento / Nota</label>
                <input
                  v-model="simExceptionReason"
                  type="text"
                  placeholder="Ej: Acuerdo de Comisión / Fe de erratas"
                  class="config-input"
                />
              </div>
              <button
                type="button"
                class="btn btn--outline"
                data-testid="apply-sim-exception-btn"
                @click="addOrUpdateLocalException"
              >
                Aplicar Excepción
              </button>
              <button
                v-if="localExceptions.length"
                type="button"
                class="btn btn--ghost"
                @click="clearLocalExceptions"
              >
                Restaurar
              </button>
            </div>

            <div v-if="activeExceptionsForExam.length" class="exception-chips">
              <span
                v-for="exc in activeExceptionsForExam"
                :key="`exc-${exc.questionNumber}`"
                class="exc-chip"
                :class="`exc-chip--${String(exc.type).toLowerCase()}`"
              >
                <strong>P{{ exc.questionNumber }}:</strong>
                <template v-if="exc.type === 'ANULADA_OTORGAR'">Anulada (+pts)</template>
                <template v-else-if="exc.type === 'ANULADA_EXCLUIR'">Anulada (Excluida)</template>
                <template v-else-if="exc.type === 'CLAVE_MULTIPLE'">Clave múltiple ({{ exc.validAnswers }})</template>
                <button
                  type="button"
                  class="exc-chip__remove"
                  title="Quitar excepción"
                  @click="removeException(exc.questionNumber)"
                >×</button>
              </span>
            </div>
          </div>
        </details>

        <!-- Datos candidato -->
        <details class="candidate-fields candidate-fields--optional" open>
          <summary>Datos del postulante</summary>
          <!-- Fila 1: Proceso + Tipo de prueba -->
          <div class="candidate-row candidate-row--top">
            <div class="cfield cfield--proceso">
              <label class="cfield__label">Proceso / Convocatoria</label>
              <input v-model="candidatoProceso" type="text" placeholder="Ej: CONCURSO PODER JUDICIAL 001-2026-UE-PUNO" class="cfield__input" />
            </div>
            <div class="cfield cfield--tipo">
              <label class="cfield__label">Código Examen / Tipo</label>
              <input v-model="candidatoTipo" type="text" maxlength="15" placeholder="Ej: E02a" class="cfield__input cfield__input--center" />
            </div>
          </div>

          <!-- Fila 2: Nombre + DNI + Aula -->
          <div class="candidate-row candidate-row--mid">
            <div class="cfield cfield--nombre">
              <label class="cfield__label">Nombre completo</label>
              <input v-model="candidatoNombre" type="text" placeholder="Apellidos y Nombres" class="cfield__input" data-testid="candidato-nombre" />
            </div>
            <div class="cfield cfield--dni">
              <label class="cfield__label">DNI</label>
              <input
                v-model="candidatoDni"
                type="text"
                maxlength="12"
                placeholder="12345678"
                class="cfield__input cfield__input--center"
                data-testid="candidato-dni"
                @keydown.enter.prevent="buscarPostulantePorDni"
              />
            </div>
            <div class="cfield cfield--aula">
              <label class="cfield__label">Grupo / Aula</label>
              <input v-model="candidatoAula" type="text" maxlength="30" placeholder="Ej: Grupo 1 · A18" class="cfield__input cfield__input--center" data-testid="candidato-aula" />
            </div>
          </div>

          <!-- Fila 3: Área + Programa + Posición -->
          <div class="candidate-row candidate-row--bot">
            <div class="cfield cfield--area">
              <label class="cfield__label">Área / COD_EXAMEN</label>
              <input v-model="candidatoArea" type="text" placeholder="Ej: E02a" class="cfield__input" data-testid="candidato-area" />
            </div>
            <div class="cfield cfield--programa">
              <label class="cfield__label">Puesto / Programa / Unidad</label>
              <input v-model="candidatoPrograma" type="text" placeholder="Ej: Especialista Judicial de Juzgado" class="cfield__input" data-testid="candidato-programa" />
            </div>
            <div class="cfield cfield--posicion">
              <label class="cfield__label">Posición</label>
              <input v-model="candidatoPosicion" type="text" maxlength="10" placeholder="Ej: 1" class="cfield__input cfield__input--center" />
            </div>
          </div>
        </details>
      </div>

      <!-- Grids de respuestas organizadas en bloques de 10 preguntas -->
      <div class="grids-row">
        <!-- Grid respuestas correctas -->
        <div class="vcard vcard--grid">
          <div class="vcard__title vcard__title--correct">
            Respuestas Correctas (Clave Oficial {{ activeExamCode ? `· ${activeExamCode}` : '' }})
          </div>
          <div class="blocks-container">
            <div
              v-for="block in questionBlocks"
              :key="`c-block-${block.label}`"
              class="question-block"
            >
              <div class="question-block__label">{{ block.label }}</div>
              <div class="answer-grid">
                <div
                  v-for="i in block.indices"
                  :key="`c-${i}`"
                  class="cell-wrapper"
                >
                  <span class="cell-num">{{ i }}</span>
                  <input
                    :ref="el => { if (el) correctRefs[i-1] = el }"
                    :value="correctCells[i-1]"
                    type="text"
                    maxlength="1"
                    class="cell-input cell-input--key"
                    :class="{ 'cell-input--has-exception': activeExceptionsByQuestion.has(i) }"
                    autocomplete="off"
                    @input="e => handleCellInput(e, i-1, 'correct')"
                    @keydown="e => handleCellKeydown(e, i-1, 'correct')"
                    @paste="e => handleCellPaste(e, i-1, 'correct')"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Grid respuestas candidato -->
        <div class="vcard vcard--grid">
          <div class="vcard__title vcard__title--answer">
            Respuestas del Postulante ({{ totalQuestions }} preguntas)
          </div>
          <div class="blocks-container">
            <div
              v-for="block in questionBlocks"
              :key="`a-block-${block.label}`"
              class="question-block"
            >
              <div class="question-block__label">{{ block.label }}</div>
              <div class="answer-grid">
                <div
                  v-for="i in block.indices"
                  :key="`a-${i}`"
                  class="cell-wrapper"
                  :class="`cell-wrapper--${rows[i-1]?.status ?? 'blank'}`"
                >
                  <span class="cell-num">{{ i }}</span>
                  <input
                    :ref="el => { if (el) answerRefs[i-1] = el }"
                    :value="answerCells[i-1]"
                    type="text"
                    maxlength="1"
                    class="cell-input"
                    :class="`cell-input--${rows[i-1]?.status ?? 'blank'}`"
                    autocomplete="off"
                    @input="e => handleCellInput(e, i-1, 'answer')"
                    @keydown="e => handleCellKeydown(e, i-1, 'answer')"
                    @paste="e => handleCellPaste(e, i-1, 'answer')"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Utilidades -->
      <div class="helper-row">
        <div class="helper-panel">
          <div>
            <strong>Clave frecuente</strong>
            <span>Guarda o reutiliza la clave correcta para la plantilla o código de examen seleccionado.</span>
          </div>
          <div class="helper-actions">
            <button type="button" class="btn btn--outline" :disabled="!hasSavedCorrectKey" @click="useSavedCorrectKey">
              Usar clave
            </button>
            <button type="button" class="btn btn--ghost" @click="saveCorrectKey">
              Guardar clave
            </button>
          </div>
        </div>
        <div class="helper-panel helper-panel--validation">
          <div>
            <strong>Validación</strong>
            <span>
              {{ missingSummary.missingCorrect }} clave(s) faltante(s) ·
              {{ missingSummary.missingAnswers }} respuesta(s) en blanco
            </span>
          </div>
        </div>
      </div>

      <!-- Resultado -->
      <div v-if="hasAnyAnswer" class="vcard">
        <!-- Stats bar -->
        <div class="stats-bar">
          <div class="stat stat--correct">
            <span class="stat__val">{{ stats.correctCount }}</span>
            <span class="stat__label">Correctas</span>
          </div>
          <div class="stat stat--incorrect">
            <span class="stat__val">{{ stats.incorrectCount }}</span>
            <span class="stat__label">Incorrectas</span>
          </div>
          <div class="stat stat--blank">
            <span class="stat__val">{{ stats.blankCount }}</span>
            <span class="stat__label">En blanco</span>
          </div>
          <div v-if="stats.multipleCount" class="stat stat--multiple">
            <span class="stat__val">{{ stats.multipleCount }}</span>
            <span class="stat__label">Múltiples (*)</span>
          </div>
          <div v-if="stats.annulledGrantedCount" class="stat stat--granted">
            <span class="stat__val">{{ stats.annulledGrantedCount }}</span>
            <span class="stat__label">Anuladas (+pts)</span>
          </div>
          <div v-if="stats.annulledExcludedCount" class="stat stat--excluded">
            <span class="stat__val">{{ stats.annulledExcludedCount }}</span>
            <span class="stat__label">Excluidas</span>
          </div>
          <div class="stat-divider" />
          <div class="stat">
            <span class="stat__val stat__val--score">{{ stats.score.toFixed(3) }}</span>
            <span class="stat__label">Puntaje total (de {{ stats.maxPossibleScore.toFixed(3) }})</span>
          </div>
          <div class="stat-multipliers">
            <span>Correcta <strong>×{{ correctValue }}</strong></span>
            <span>Incorrecta <strong>×{{ incorrectValue }}</strong></span>
            <span>Blanco <strong>×{{ blankValue }}</strong></span>
          </div>
        </div>

        <!-- Tabla detalle -->
        <details class="result-details" open>
          <summary>
            <span>Detalle por pregunta</span>
            <strong>{{ rows.length }} preguntas ({{ detailColumns.length }} bloques)</strong>
          </summary>
          <div
            class="detail-table-wrap detail-table-wrap--columns"
            :class="{ 'detail-table-wrap--three-cols': detailColumns.length === 3 }"
          >
            <table
              v-for="(columnRows, columnIndex) in detailColumns"
              :key="`detail-col-${columnIndex}`"
              class="detail-table detail-table--compact"
            >
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Curso / Excepción</th>
                  <th>Marc.</th>
                  <th>Corr.</th>
                  <th>Pond.</th>
                  <th>Pts</th>
                  <th>Acum.</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in columnRows"
                  :key="row.n"
                  :class="['detail-row', `detail-row--${row.status}`, { 'detail-row--last': row.n === rows.length }]"
                >
                  <td class="cell-n">{{ row.n }}</td>
                  <td class="cell-subject">
                    <div class="cell-subject__inner">
                      <span
                        v-if="row.exceptionApplied"
                        class="row-exc-badge"
                        :class="`row-exc-badge--${String(row.exceptionApplied).toLowerCase()}`"
                      >
                        {{ exceptionBadgeLabel(row.exceptionApplied) }}
                      </span>
                      <span v-else class="cell-subject__text">{{ row.subject || '—' }}</span>
                      <select
                        class="row-exc-select"
                        :value="row.exceptionApplied || ''"
                        :title="`Simular excepción en pregunta ${row.n}`"
                        @change="e => setRowQuickException(row.n, e.target.value)"
                      >
                        <option value="">Normal</option>
                        <option value="ANULADA_OTORGAR">Anulada (+pts)</option>
                        <option value="ANULADA_EXCLUIR">Anulada (Excluida)</option>
                        <option value="CLAVE_MULTIPLE">Clave múltiple</option>
                      </select>
                    </div>
                  </td>
                  <td class="cell-marked" :class="`marked--${row.status}`">{{ row.marked }}</td>
                  <td class="cell-correct">{{ row.correct }}</td>
                  <td class="cell-weight">{{ row.weight.toFixed(3) }}</td>
                  <td class="cell-pts">{{ row.pts.toFixed(3) }}</td>
                  <td class="cell-acum">{{ row.acum.toFixed(3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <details class="result-details subject-details">
          <summary>
            <span>Resumen por curso</span>
            <strong>{{ subjectSummary.length }} curso(s)</strong>
          </summary>
          <div class="subject-summary">
            <div v-for="item in subjectSummary" :key="item.subject" class="subject-item">
              <span class="subject-item__name">{{ item.subject }}</span>
              <span class="subject-pill subject-pill--correct">{{ item.correct }}</span>
              <span class="subject-pill subject-pill--incorrect">{{ item.incorrect }}</span>
              <span class="subject-pill subject-pill--blank">{{ item.blank }}</span>
              <strong>{{ item.points.toFixed(3) }}</strong>
            </div>
          </div>
        </details>

        <details class="result-details sheet-details">
          <summary>
            <span>Cartilla visual</span>
            <strong>Comparación física</strong>
          </summary>
          <div class="sheet-details__body">
            <AnswerSheetPreview
              :answers="answerString"
              :correct-answers="correctString"
              :total-questions="totalQuestions"
              mode="compare"
              title="Hoja de respuestas"
            />
          </div>
        </details>
      </div>

      <!-- Acciones -->
      <div class="actions-bar">
        <button type="button" class="btn btn--ghost" @click="limpiar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Limpiar
        </button>
        <div class="actions-right">
          <button
            type="button"
            class="btn btn--outline"
            :disabled="!hasAnyAnswer"
            @click="exportPdf"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Exportar PDF
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="verificador.saving.value"
            @click="guardar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {{ editingId ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ SUB-TAB: HISTORIAL ════════════════════════════════════════════════════ -->
    <div v-else class="verificador__body">
      <div class="history-toolbar">
        <input
          v-model="historySearch"
          type="search"
          class="history-search"
          placeholder="Buscar por DNI, nombre, proceso, área o plantilla"
        />
        <button type="button" class="btn btn--outline" @click="exportHistoryCsv">
          Exportar CSV
        </button>
      </div>
      <div v-if="verificador.loading.value" class="empty-state">
        Cargando historial...
      </div>
      <div v-else-if="!verificador.sesiones.value.length" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3" stroke-linecap="round"/></svg>
        <p>No hay verificaciones guardadas</p>
      </div>
      <div v-else-if="!filteredSesiones.length" class="empty-state">
        No hay verificaciones que coincidan con la búsqueda
      </div>
      <div v-else class="history-list">
        <div
          v-for="s in filteredSesiones"
          :key="s.id"
          class="history-item"
          :class="{ 'history-item--active': editingId === s.id }"
        >
          <div class="history-item__scorebox">
            <span>Puntaje</span>
            <strong>{{ Number(s.score).toFixed(3) }}</strong>
          </div>
          <div class="history-item__info">
            <div class="history-item__top">
              <span class="history-item__plantilla">{{ s.plantilla_name || 'Sin plantilla' }}</span>
            </div>
            <div v-if="s.proceso" class="history-item__proceso">{{ s.proceso }}</div>
            <div class="history-item__mid">
              <span v-if="s.nombre" class="history-item__nombre">{{ s.nombre }}</span>
              <span v-if="s.dni" class="history-item__dni">DNI: {{ s.dni }}</span>
            </div>
            <div class="history-item__tags">
              <span v-if="s.area" class="htag htag--area">{{ s.area }}</span>
              <span v-if="s.aula" class="htag">Aula {{ s.aula }}</span>
              <span v-if="s.posicion" class="htag">Pos. {{ s.posicion }}</span>
              <span v-if="s.tipo_prueba" class="htag htag--tipo">Tipo {{ s.tipo_prueba }}</span>
            </div>
            <div class="history-item__date">{{ formatFecha(s.created_at) }}</div>
          </div>
          <div class="history-item__actions">
            <button type="button" class="btn-icon btn-icon--copy" title="Duplicar" @click="duplicarSesion(s)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="btn-icon btn-icon--load" title="Cargar" @click="cargarSesion(s)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="btn-icon btn-icon--delete" title="Eliminar" @click="eliminarSesion(s.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verificador {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.verificador__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.verificador__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--slate-900);
  margin: 0 0 var(--space-1);
}

.verificador__subtitle {
  font-size: 0.82rem;
  color: var(--slate-500);
  margin: 0;
}

.verificador__tabs {
  display: flex;
  gap: var(--space-1);
  background: var(--slate-100);
  border-radius: var(--radius-md);
  padding: 3px;
}

.vtab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: none;
  cursor: pointer;
  font-size: 0.83rem;
  font-weight: 500;
  color: var(--slate-600);
  transition: all 0.15s;
  white-space: nowrap;
}
.vtab--active {
  background: white;
  color: var(--unap-blue-700);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.vtab__badge {
  background: var(--unap-gold-500);
  color: var(--unap-blue-900);
  border-radius: var(--radius-full);
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

/* ── Mode Switch Bar ────────────────────────────────────────────────────────── */
.mode-switch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-100);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}

.mode-switch-bar__buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-300);
  background: white;
  color: var(--slate-700);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--slate-300);
}

.mode-btn--active {
  background: var(--unap-blue-900, #0f172a);
  color: white;
  border-color: var(--unap-blue-900, #0f172a);
}

.mode-btn--active .mode-btn__dot {
  background: #fbbf24;
}

.mode-switch-bar__info {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.mode-pill {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: white;
  border: 1px solid var(--slate-200);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--slate-700);
}

.mode-pill--max {
  background: #fef3c7;
  border-color: #fde68a;
  color: #92400e;
}

/* ── Quickload (DNI + COD_EXAMEN) ───────────────────────────────────────────── */
.vcard--quickload {
  padding: var(--space-4);
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.quickload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.quickload-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quickload-input-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.config-input--flex {
  flex: 1;
  width: auto !important;
}

.comparison-banner {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: 0.85rem;
}

.comparison-banner--ok {
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  color: #065f46;
}

.comparison-banner--diff {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  color: #92400e;
}

.comparison-banner__main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.comparison-banner__status {
  font-weight: 800;
}

.comparison-banner__meta {
  display: flex;
  gap: var(--space-2);
  font-size: 0.78rem;
  font-weight: 700;
}

/* ── Body ───────────────────────────────────────────────────────────────────── */
.verificador__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Cards ──────────────────────────────────────────────────────────────────── */
.vcard {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.vcard--grid { padding: var(--space-4); }
.vcard--control { padding: var(--space-4); }

.vcard__title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--slate-500);
  margin-bottom: var(--space-3);
}
.vcard__title--correct { color: #2563eb; }
.vcard__title--answer  { color: var(--unap-blue-700); }

/* ── Control operativo ─────────────────────────────────────────────────────── */
.control-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
  gap: var(--space-4);
  align-items: stretch;
}

.control-panel__main {
  min-width: 0;
}

.score-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  background: #fffbeb;
  min-height: 112px;
}

.score-panel--empty {
  border-color: var(--slate-200);
  background: var(--slate-50);
}

.score-panel__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.score-panel--empty .score-panel__label {
  color: var(--slate-500);
}

.score-panel__value {
  font-size: 2rem;
  line-height: 1;
  color: #92400e;
  font-variant-numeric: tabular-nums;
}

.score-panel--empty .score-panel__value {
  color: var(--slate-500);
}

.score-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.score-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 800;
  background: white;
  border: 1px solid transparent;
}

.score-chip--correct   { color: #15803d; border-color: #bbf7d0; }
.score-chip--incorrect { color: #dc2626; border-color: #fecaca; }
.score-chip--blank     { color: var(--slate-500); border-color: var(--slate-200); }
.score-chip--multiple  { color: #c2410c; border-color: #fed7aa; }
.score-chip--granted   { color: #1d4ed8; border-color: #bfdbfe; }
.score-chip--excluded  { color: #475569; border-color: #cbd5e1; }

/* ── Simulador de Excepciones ───────────────────────────────────────────────── */
.exception-simulator {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--slate-100);
}

.exception-simulator > summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--unap-blue-700);
  list-style: none;
}

.exception-simulator > summary::-webkit-details-marker { display: none; }

.exc-count-badge {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.7rem;
  font-weight: 800;
}

.exception-simulator__body {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.exception-simulator__form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-end;
}

.exception-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.exc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}

.exc-chip--anulada_excluir {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #334155;
}

.exc-chip--clave_multiple {
  background: #fef3c7;
  border-color: #fde68a;
  color: #92400e;
}

.exc-chip__remove {
  border: none;
  background: none;
  color: inherit;
  font-weight: 800;
  cursor: pointer;
  padding: 0 2px;
}

/* ── Config (plantilla + valores) ────────────────────────────────────────────── */
.config-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}

.config-field { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
.config-field--wide { flex: 1; min-width: 160px; }

.config-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.config-select,
.config-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--slate-800);
  background: white;
  transition: border-color 0.15s;
}
.config-select:focus,
.config-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.config-input { width: 80px; }
.config-field--wide .config-input { width: 100%; }

/* ── Datos candidato ──────────────────────────────────────────────────────────── */
.candidate-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--slate-100);
}

.candidate-fields--optional > summary {
  color: var(--unap-blue-700); font-size: 0.8rem; font-weight: 700;
  cursor: pointer; list-style: none;
}
.candidate-fields--optional > summary::-webkit-details-marker { display: none; }
.candidate-fields--optional > summary::after { content: '＋'; margin-left: var(--space-2); }
.candidate-fields--optional[open] > summary { margin-bottom: var(--space-3); }
.candidate-fields--optional[open] > summary::after { content: '−'; }

.candidate-row {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

.candidate-row--top { grid-template-columns: minmax(0, 3fr) minmax(0, 1fr); }
.candidate-row--mid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); }
.candidate-row--bot { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr); }

.cfield {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cfield__label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.cfield__input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  color: var(--slate-800);
  background: white;
  transition: border-color 0.15s;
  font-family: inherit;
}
.cfield__input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.cfield__input--center { text-align: center; }

.cfield--proceso .cfield__input {
  border-color: var(--unap-blue-200);
  background: var(--unap-blue-50);
}
.cfield--proceso .cfield__input:focus {
  border-color: var(--unap-blue-400);
  background: white;
}

/* ── Grids en bloques de 10 ─────────────────────────────────────────────────── */
.grids-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.blocks-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.question-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.question-block__label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--slate-400);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.answer-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(28px, 1fr));
  gap: 4px;
}

.cell-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cell-num {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--slate-600);
  line-height: 1;
}

.cell-input {
  width: 100%;
  aspect-ratio: 1;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid var(--slate-200);
  border-radius: 4px;
  background: var(--slate-50);
  color: var(--slate-700);
  cursor: text;
  transition: all 0.1s;
  caret-color: transparent;
  min-width: 0;
}
.cell-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}

.cell-input--correct   { background: #dcfce7; border-color: #86efac; color: #15803d; }
.cell-input--incorrect { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
.cell-input--blank     { background: var(--slate-50); }
.cell-input--excluded  { background: #e2e8f0; border-color: #cbd5e1; color: #475569; }
.cell-input--multiple  { background: #ffedd5; border-color: #fdba74; color: #c2410c; }

.cell-input--key {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.cell-input--has-exception {
  box-shadow: inset 0 0 0 2px #f59e0b;
}

/* ── Utilidades del verificador ─────────────────────────────────────────────── */
.helper-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
  gap: var(--space-3);
}

.helper-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white;
}

.helper-panel strong {
  display: block;
  margin-bottom: 2px;
  font-size: 0.86rem;
  color: var(--slate-800);
}

.helper-panel span {
  display: block;
  font-size: 0.78rem;
  color: var(--slate-500);
}

.helper-panel--validation {
  background: var(--slate-50);
}

.helper-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* ── Stats bar ──────────────────────────────────────────────────────────────── */
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.stat { display: flex; flex-direction: column; align-items: center; }
.stat__val { font-size: 1.1rem; font-weight: 700; color: var(--slate-800); }
.stat__val--score { color: #ca8a04; font-size: 1.3rem; }
.stat__label { font-size: 0.68rem; color: var(--slate-500); }
.stat--correct  .stat__val { color: #15803d; }
.stat--incorrect .stat__val { color: #dc2626; }
.stat--blank    .stat__val { color: var(--slate-500); }
.stat--multiple .stat__val { color: #c2410c; }
.stat--granted  .stat__val { color: #1d4ed8; }
.stat--excluded .stat__val { color: #475569; }
.stat-divider { width: 1px; height: 30px; background: var(--slate-200); }
.stat-multipliers {
  margin-left: auto;
  display: flex;
  gap: var(--space-3);
  font-size: 0.75rem;
  color: var(--slate-500);
  flex-wrap: wrap;
}

/* ── Tabla detalle ──────────────────────────────────────────────────────────── */
.result-details {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.result-details > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  color: var(--slate-700);
  background: var(--slate-50);
  font-size: 0.84rem;
  font-weight: 700;
  list-style: none;
}

.result-details > summary::-webkit-details-marker { display: none; }
.result-details > summary::after {
  content: '+';
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  color: var(--unap-blue-700);
  background: white;
  border: 1px solid var(--slate-200);
  font-weight: 800;
}
.result-details[open] > summary::after { content: '-'; }
.result-details > summary strong {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--slate-500);
  font-weight: 700;
}

.detail-table-wrap {
  overflow-x: auto;
  max-height: none;
  overflow-y: visible;
}

.detail-table-wrap--columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(380px, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
  background: white;
}

.detail-table-wrap--three-cols {
  grid-template-columns: repeat(3, minmax(300px, 1fr));
}

.row-exc-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.68rem;
  font-weight: 800;
  background: #dbeafe;
  color: #1d4ed8;
}

.row-exc-badge--anulada_excluir {
  background: #e2e8f0;
  color: #475569;
}

.row-exc-badge--clave_multiple {
  background: #fef3c7;
  color: #92400e;
}

.subject-details {
  margin-top: var(--space-3);
}

.sheet-details {
  margin-top: var(--space-3);
}

.sheet-details__body {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
  background: white;
  overflow-x: auto;
}

.subject-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-2);
  padding: var(--space-3);
  background: white;
}

.subject-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(3, 34px) 72px;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: var(--slate-50);
}

.subject-item__name {
  min-width: 0;
  overflow: hidden;
  color: var(--slate-700);
  font-size: 0.82rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-item strong {
  text-align: right;
  color: #92400e;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.subject-pill {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 22px;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 800;
}

.subject-pill--correct { color: #15803d; background: #dcfce7; }
.subject-pill--incorrect { color: #dc2626; background: #fee2e2; }
.subject-pill--blank { color: var(--slate-600); background: #e2e8f0; }

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.detail-table--compact { table-layout: fixed; }
.detail-table thead tr { background: var(--unap-blue-900); }
.detail-table th {
  padding: var(--space-2);
  text-align: left;
  color: white;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.detail-table td {
  padding: 5px var(--space-2);
  border-bottom: 1px solid var(--slate-100);
  white-space: nowrap;
  font-size: 0.85rem;
}
.detail-table th:nth-child(1),
.detail-table td:nth-child(1) { width: 34px; text-align: center; }
.detail-table th:nth-child(2),
.detail-table td:nth-child(2) { width: auto; }
.detail-table th:nth-child(3),
.detail-table td:nth-child(3),
.detail-table th:nth-child(4),
.detail-table td:nth-child(4) { width: 50px; text-align: center; }
.detail-table th:nth-child(5),
.detail-table td:nth-child(5),
.detail-table th:nth-child(6),
.detail-table td:nth-child(6),
.detail-table th:nth-child(7),
.detail-table td:nth-child(7) { width: 64px; text-align: right; }

.detail-row--correct td { background: #f0fdf4; }
.detail-row--incorrect td { background: #fff1f2; }
.detail-row--blank td { background: var(--slate-50); }
.detail-row--excluded td { background: #f1f5f9; color: var(--slate-500); }
.detail-row--multiple td { background: #fff7ed; }
.detail-row:hover td { filter: brightness(0.98); }

.detail-row--last .cell-acum {
  background: #fef3c7;
  color: #92400e;
  font-weight: 800;
}

.cell-n {
  color: var(--slate-500);
  font-size: 0.75rem;
  font-weight: 700;
}
.cell-subject {
  color: var(--slate-700);
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell-correct {
  color: #2563eb;
  font-weight: 800;
  background: #dbeafe !important;
}
.cell-weight, .cell-pts, .cell-acum { font-family: monospace; color: var(--slate-700); }

.marked--correct {
  color: #15803d;
  font-weight: 800;
  background: #dcfce7 !important;
}
.marked--incorrect {
  color: #dc2626;
  font-weight: 800;
  background: #fee2e2 !important;
}
.marked--blank,
.marked--excluded {
  color: var(--slate-500);
  font-weight: 800;
  background: #e2e8f0 !important;
}
.marked--multiple {
  color: #c2410c;
  font-weight: 800;
  background: #ffedd5 !important;
}

/* ── Acciones ───────────────────────────────────────────────────────────────── */
.actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.actions-right { display: flex; gap: var(--space-2); }

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--ghost   { background: none; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); }
.btn--outline { background: white; color: var(--unap-blue-700); border: 1px solid var(--unap-blue-300); }
.btn--outline:hover:not(:disabled) { background: var(--unap-blue-50); }
.btn--primary { background: var(--unap-blue-600); color: white; }
.btn--primary:hover:not(:disabled) { background: var(--unap-blue-700); }

/* ── Historial ──────────────────────────────────────────────────────────────── */
.history-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white;
}

.history-search {
  flex: 1;
  min-width: 180px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  color: var(--slate-800);
  font: inherit;
}

.history-search:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--slate-400);
  font-size: 0.9rem;
}
.empty-state svg { width: 48px; height: 48px; }

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  transition: all 0.15s;
}
.history-item--active {
  border-color: var(--unap-blue-300);
  background: var(--unap-blue-50);
}
.history-item:hover { border-color: var(--slate-300); }

.history-item__scorebox {
  width: 116px;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  background: #fffbeb;
  flex-shrink: 0;
}

.history-item__scorebox span {
  font-size: 0.66rem;
  font-weight: 700;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-item__scorebox strong {
  font-size: 1.05rem;
  line-height: 1;
  color: #92400e;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.history-item__info { flex: 1; min-width: 0; }

.history-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 3px;
}
.history-item__plantilla {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--slate-800);
}
.history-item__proceso {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--unap-blue-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}
.history-item__mid {
  display: flex;
  gap: var(--space-3);
  font-size: 0.82rem;
  color: var(--slate-700);
  font-weight: 500;
  margin-bottom: 3px;
}
.history-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: 3px;
}
.htag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--slate-100);
  color: var(--slate-600);
}
.htag--area { background: var(--unap-blue-50); color: var(--unap-blue-700); }
.htag--tipo { background: #fef9c3; color: #854d0e; }
.history-item__date { font-size: 0.72rem; color: var(--slate-400); }

.history-item__actions { display: flex; gap: var(--space-2); }

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-icon svg { width: 15px; height: 15px; }
.btn-icon--copy { color: var(--slate-600); }
.btn-icon--copy:hover { background: var(--slate-50); border-color: var(--slate-300); }
.btn-icon--load { color: var(--unap-blue-600); }
.btn-icon--load:hover { background: var(--unap-blue-50); border-color: var(--unap-blue-300); }
.btn-icon--delete { color: #dc2626; }
.btn-icon--delete:hover { background: #fee2e2; border-color: #fca5a5; }

@media (max-width: 1100px) {
  .grids-row { grid-template-columns: 1fr; }
  .quickload-grid { grid-template-columns: 1fr; }
  .control-panel { grid-template-columns: 1fr; }
  .score-panel { min-height: 0; }
  .detail-table-wrap--columns,
  .detail-table-wrap--three-cols { grid-template-columns: minmax(340px, 1fr); }
  .helper-row { grid-template-columns: 1fr; }
}

@media (min-width: 1100px) {
  .answer-grid { grid-template-columns: repeat(10, minmax(30px, 1fr)); }
}

@media (max-width: 720px) {
  .history-item {
    align-items: stretch;
    flex-direction: column;
  }
  .history-item__scorebox {
    width: auto;
    min-height: 0;
  }
  .history-item__actions {
    justify-content: flex-end;
  }
  .actions-right {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .helper-panel,
  .history-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .helper-actions {
    justify-content: flex-start;
  }
}
</style>
