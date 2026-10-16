import { ref } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

export const PJ_EXAM_CODES = [
  'E01a', 'E01b',
  'E02a', 'E02b', 'E02c',
  'E03a', 'E03b', 'E03c', 'E03d',
  'E04a', 'E04b',
  'E05', 'E06', 'E07',
  'E08a', 'E08b',
  'E09a', 'E09b', 'E09c', 'E09d',
  'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16',
]

export function normalizeDni(value) {
  const raw = String(value ?? '').trim()
  const digits = raw.match(/\d/g)
  return digits ? digits.join('') : raw
}

export function extractExamCodes({ answerKeyRows = [], archiveRows = [] } = {}) {
  const map = new Map()

  const addCode = (rawCode, hasKey = false) => {
    const code = String(rawCode ?? '').trim()
    if (!code) return
    const upper = code.toLowerCase()
    if (!map.has(upper)) {
      map.set(upper, { code, hasKey: Boolean(hasKey), candidateCount: 0 })
    } else if (hasKey) {
      map.get(upper).hasKey = true
    }
  }

  if (Array.isArray(answerKeyRows)) {
    answerKeyRows.forEach((row) => {
      const code = row?.cod_examen || row?.codExamen || row?.area
      addCode(code, Boolean(row?.answers || row?.correct_answers || row?.respuestas))
    })
  }

  if (Array.isArray(archiveRows)) {
    archiveRows.forEach((row) => {
      const code = row?.cod_examen || row?.codExamen || row?.area
      if (!code) return
      addCode(code, false)
      const entry = map.get(String(code).trim().toLowerCase())
      if (entry) entry.candidateCount += 1
    })
  }

  return Array.from(map.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

export function filterExceptionsForExam(questionExceptions = [], codExamen = '') {
  if (!Array.isArray(questionExceptions)) return []
  const target = String(codExamen ?? '').trim().toLowerCase()
  return questionExceptions.filter((exc) => {
    if (!exc || !exc.questionNumber || !exc.type) return false
    const excCode = String(exc.codExamen ?? exc.cod_examen ?? exc.area ?? '').trim().toLowerCase()
    if (!excCode || excCode === '*' || excCode === 'todos' || excCode === 'all') return true
    return Boolean(target && excCode === target)
  })
}

export function findCandidateInProcess(
  dniInput,
  { archiveRows = [], responsesRows = [], answerKeyRows = [], calificationResults = [] } = {},
) {
  const cleanDni = normalizeDni(dniInput)
  if (!cleanDni) return null

  const candidate = Array.isArray(archiveRows)
    ? archiveRows.find((r) => normalizeDni(r?.dni) === cleanDni) || null
    : null

  const responseRow = Array.isArray(responsesRows)
    ? responsesRows.find((r) => normalizeDni(r?.dni) === cleanDni) || null
    : null

  const officialResult = Array.isArray(calificationResults)
    ? calificationResults.find((r) => normalizeDni(r?.dni) === cleanDni) || null
    : null

  const codExamen = String(
    candidate?.cod_examen ||
      candidate?.codExamen ||
      candidate?.area ||
      officialResult?.codExamen ||
      officialResult?.cod_examen ||
      officialResult?.area ||
      '',
  ).trim()

  const keyRow =
    codExamen && Array.isArray(answerKeyRows)
      ? answerKeyRows.find(
          (k) =>
            String(k?.cod_examen || k?.codExamen || k?.area || '')
              .trim()
              .toLowerCase() === codExamen.toLowerCase(),
        ) || null
      : null

  if (!candidate && !responseRow && !officialResult) {
    return null
  }

  const fullName = candidate
    ? [candidate.paterno, candidate.materno, candidate.nombres]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ') || String(candidate.nombre || candidate.fullName || '').trim()
    : String(officialResult?.fullName || officialResult?.nombre || '').trim()

  const puesto = String(
    candidate?.puesto ||
      candidate?.programa ||
      officialResult?.puesto ||
      officialResult?.programa ||
      '',
  ).trim()

  const codPuesto = String(
    candidate?.cod_puesto ||
      candidate?.codPuesto ||
      candidate?.codigo_programa ||
      officialResult?.codPuesto ||
      officialResult?.cod_puesto ||
      '',
  ).trim()

  const unidad = String(candidate?.unidad || officialResult?.unidad || '').trim()
  const grupo = String(candidate?.grupo || officialResult?.grupo || '').trim()
  const aula = String(
    candidate?.aula_padron ||
      candidate?.aula ||
      responseRow?.aula ||
      officialResult?.aula ||
      '',
  ).trim()

  return {
    dni: cleanDni,
    fullName,
    codExamen,
    codPuesto,
    puesto,
    unidad,
    grupo,
    aula,
    candidate,
    responseRow,
    keyRow,
    officialResult,
    answersRaw: String(
      responseRow?.answers ??
        responseRow?.respuestas ??
        officialResult?.answers ??
        '',
    ),
    correctAnswersRaw: String(
      keyRow?.answers ??
        keyRow?.correct_answers ??
        keyRow?.respuestas ??
        officialResult?.correctAnswers ??
        '',
    ),
  }
}

export function useVerificador() {
  const sesiones = ref([])
  const loading = ref(false)
  const saving = ref(false)

  // ── Historial ────────────────────────────────────────────────────────────────

  async function fetchSesiones() {
    loading.value = true
    try {
      const res = await apiFetch('/verificador/')
      if (!res.ok) return
      sesiones.value = await res.json()
    } catch { /* silencioso */ }
    finally { loading.value = false }
  }

  async function saveSesion(payload) {
    saving.value = true
    try {
      const res = await apiFetch('/verificador/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) return null
      const created = await res.json()
      sesiones.value.unshift(created)
      return created
    } catch { return null }
    finally { saving.value = false }
  }

  async function updateSesion(id, payload) {
    saving.value = true
    try {
      const res = await apiFetch(`/verificador/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) return null
      const updated = await res.json()
      const idx = sesiones.value.findIndex(s => s.id === id)
      if (idx !== -1) sesiones.value[idx] = updated
      return updated
    } catch { return null }
    finally { saving.value = false }
  }

  async function deleteSesion(id) {
    try {
      await apiFetch(`/verificador/${id}/`, { method: 'DELETE' })
      sesiones.value = sesiones.value.filter(s => s.id !== id)
    } catch { /* silencioso */ }
  }

  return {
    sesiones,
    loading,
    saving,
    fetchSesiones,
    saveSesion,
    updateSesion,
    deleteSesion,
    extractExamCodes,
    filterExceptionsForExam,
    findCandidateInProcess,
  }
}
