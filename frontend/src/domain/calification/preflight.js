import { normalizeArea, normalizeAreaStrict, stripDigits } from '@/utils/helpers'
import {
  buildDniCounts,
  getCandidateDniIssue,
  REAL_TEST_TYPES,
  GENERAL_SIMULACRO_AREA,
} from '@/utils/calificationHelpers'

export function buildCalificationPreflight({
  area,
  processType,
  simulacroScope,
  archiveRows = [],
  responsesRows = [],
  answerKeyRows = [],
  responsesByDni = new Map(),
  areaList = [],
} = {}) {
  const isRealProcess = processType === 'real'
  const isGeneralSimulacro = !isRealProcess && simulacroScope === 'general'
  const normalizedArea = isGeneralSimulacro
    ? GENERAL_SIMULACRO_AREA
    : normalizeArea(area, areaList)
  const dniCounts = buildDniCounts(archiveRows)

  const candidates = isGeneralSimulacro
    ? archiveRows
    : archiveRows.filter(r => normalizeAreaStrict(r.area, areaList) === normalizedArea)

  const unknownAreaCandidates = isGeneralSimulacro
    ? []
    : archiveRows.filter(r => r.area?.trim() && !normalizeAreaStrict(r.area, areaList))

  const unassignedCandidates = archiveRows.filter(r => !r.area?.trim())
  const usingFallback = !isRealProcess && candidates.length === 0 && unassignedCandidates.length > 0
  const effectiveCandidates = usingFallback ? unassignedCandidates : candidates

  const withoutResponse = effectiveCandidates.filter(c => {
    const dni = stripDigits(c.dni)
    return !responsesByDni.has(dni) || responsesByDni.get(dni).length === 0
  })
  const duplicatedResponses = effectiveCandidates.filter(c => {
    const dni = stripDigits(c.dni)
    return dni && (responsesByDni.get(dni) || []).length > 1
  })
  const invalidDniCandidates = effectiveCandidates.filter(c => getCandidateDniIssue(c, dniCounts))

  const allDnisInPadron = new Set(archiveRows.map(r => stripDigits(r.dni)))
  const orphanResponses = [...responsesByDni.entries()].filter(([dni]) => !allDnisInPadron.has(dni))

  const areaAnswerKeys = answerKeyRows.filter(
    k => k.area?.trim() && normalizeArea(k.area, areaList) === normalizedArea
  )
  const generalAnswerKeys = answerKeyRows.filter(k => !k.area?.trim())
  const keyTypes = new Set(areaAnswerKeys.map(k => (k.tipo || '').trim().toUpperCase().slice(0, 1)).filter(Boolean))
  const missingRealKeyTypes = REAL_TEST_TYPES.filter(tipo => !keyTypes.has(tipo))
  const hasAnswerKeys = isRealProcess
    ? missingRealKeyTypes.length === 0
    : isGeneralSimulacro
      ? generalAnswerKeys.length > 0 || answerKeyRows.length > 0
      : areaAnswerKeys.length > 0

  const unlinked = archiveRows.length > 0
    ? responsesRows.filter(r => !stripDigits(r.dni)).length
    : 0

  const missingTipoResponses = isRealProcess
    ? effectiveCandidates.filter((candidate) => {
      const dni = stripDigits(candidate.dni)
      const responseList = responsesByDni.get(dni) || []
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

  if (unknownAreaCandidates.length > 0) {
    items.push({
      key: 'unknownArea',
      label: 'Postulantes con área desconocida',
      value: unknownAreaCandidates.length,
      status: 'error',
      detail: `${unknownAreaCandidates.length} postulante(s) tienen un área que no coincide con la configuración. Corrige el padrón antes de calificar.`,
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
          ? `Faltan claves para ${normalizedArea}: ${missingRealKeyTypes.join(', ')}.`
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
}
