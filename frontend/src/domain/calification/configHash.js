import { stripDigits } from '@/utils/helpers'
import { formatHashBlocks, sha256Hex } from '@/utils/cryptoHash'

function canonicalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue)
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort()
    const result = {}
    sortedKeys.forEach((k) => {
      result[k] = canonicalizeValue(value[k])
    })
    return result
  }
  return value
}

/**
 * Construye el payload canónico determinista de configuración de calificación (claves, ponderación, excepciones).
 */
export function buildCanonicalConfigurationPayload({
  answersLength = 30,
  correctValue = 1,
  incorrectValue = 0,
  blankValue = 0,
  plantilla = null,
  plantillaItems = null,
  answerKeyRows = [],
  questionExceptions = [],
  candidateExceptions = [],
  scoringOptions = {},
} = {}) {
  const rawItems = Array.isArray(plantillaItems)
    ? plantillaItems
    : Array.isArray(plantilla?.items)
      ? plantilla.items
      : []

  const normalizedPlantillaItems = rawItems.map((item) => ({
    ponderation: Number(item?.ponderation ?? item?.weight ?? 1),
    questionCount: Number(item?.questionCount ?? 0),
    subject: String(item?.subject || '').trim(),
  }))

  const normalizedAnswerKeys = (answerKeyRows || [])
    .map((row) => ({
      answers: String(row?.answers || '').trim().toUpperCase(),
      codExamen: String(
        row?.cod_examen || row?.codExamen || row?.area || row?.tipo || '',
      ).trim(),
    }))
    .filter((row) => row.codExamen || row.answers)
    .sort((a, b) => a.codExamen.localeCompare(b.codExamen, 'es', { numeric: true, sensitivity: 'base' }))

  const normalizedQuestionExceptions = (questionExceptions || [])
    .map((exc) => ({
      codExamen: String(exc?.codExamen ?? exc?.area ?? '*').trim() || '*',
      documentRef: String(exc?.documentRef || '').trim(),
      questionNumber: Number(exc?.questionNumber || 0),
      reason: String(exc?.reason || '').trim(),
      type: String(exc?.type || '').trim().toUpperCase(),
      validAnswers: String(exc?.validAnswers || '')
        .toUpperCase()
        .replace(/[^A-E]/g, '')
        .split('')
        .sort()
        .join(''),
    }))
    .sort((a, b) => {
      const codeCmp = a.codExamen.localeCompare(b.codExamen, 'es', { numeric: true, sensitivity: 'base' })
      if (codeCmp !== 0) return codeCmp
      return a.questionNumber - b.questionNumber
    })

  const normalizedCandidateExceptions = (candidateExceptions || [])
    .map((exc) => ({
      dni: stripDigits(exc?.dni),
      documentRef: String(exc?.documentRef || '').trim(),
      reason: String(exc?.reason || '').trim(),
    }))
    .filter((exc) => exc.dni)
    .sort((a, b) => a.dni.localeCompare(b.dni))

  const payload = {
    answerKeys: normalizedAnswerKeys,
    answersLength: Number(answersLength) || 30,
    blankValue: Number(blankValue ?? 0),
    candidateExceptions: normalizedCandidateExceptions,
    correctValue: Number(correctValue ?? 1),
    incorrectValue: Number(incorrectValue ?? 0),
    plantillaItems: normalizedPlantillaItems,
    questionExceptions: normalizedQuestionExceptions,
    scoringOptions: {
      minPassingScore: Number(scoringOptions?.minPassingScore ?? 0),
      requireQuotaForIngreso:
        scoringOptions?.requireQuotaForIngreso !== undefined
          ? Boolean(scoringOptions.requireQuotaForIngreso)
          : true,
      tieBreakerMode: String(scoringOptions?.tieBreakerMode || 'shared_rank'),
      useMinPassingScore: Boolean(scoringOptions?.useMinPassingScore ?? false),
    },
  }

  return canonicalizeValue(payload)
}

/**
 * Calcula la huella criptográfica SHA-256 canónica sobre claves, ponderación y excepciones.
 */
export function computeConfigurationSha256(params = {}) {
  const payload = buildCanonicalConfigurationPayload(params)
  const canonicalJson = JSON.stringify(payload)
  const sha256 = sha256Hex(canonicalJson)
  const formatted = formatHashBlocks(sha256, 8)

  const result = {
    sha256,
    hash: sha256,
    formatted,
    canonicalJson,
    payload,
  }

  Object.defineProperty(result, 'toString', {
    value: () => sha256,
    enumerable: false,
  })
  Object.defineProperty(result, 'valueOf', {
    value: () => sha256,
    enumerable: false,
  })

  return result
}
