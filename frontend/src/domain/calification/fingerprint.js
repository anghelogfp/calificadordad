import { sha256Hex, formatHashBlocks } from '@/utils/cryptoHash'
import { stripDigits } from '@/utils/helpers'

function text(value) {
  return String(value ?? '').trim()
}

function compareBy(...keys) {
  return (a, b) => {
    for (const key of keys) {
      const diff = String(a[key]).localeCompare(String(b[key]), 'es', { numeric: true })
      if (diff !== 0) return diff
    }
    return 0
  }
}

/** JSON con claves ordenadas: el mismo contenido siempre produce el mismo texto. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Qué se usó para calificar: proceso, valores, plantilla, claves y correcciones de DNI.
 * El orden de la plantilla importa (define qué pregunta pesa cuánto) y se conserva; el resto
 * se ordena para que el orden de carga no cambie la huella.
 */
export function buildConfigPayload({
  processType = '',
  simulacroScope = '',
  answersLength,
  correctValue,
  incorrectValue,
  blankValue,
  plantilla,
  answerKeyRows = [],
  dniCorrections = [],
}) {
  return {
    processType: text(processType),
    simulacroScope: text(simulacroScope),
    answersLength: Number(answersLength),
    values: {
      correct: Number(correctValue),
      incorrect: Number(incorrectValue),
      blank: Number(blankValue),
    },
    plantilla: (plantilla?.items || []).map((item) => ({
      subject: text(item.subject),
      questionCount: Number(item.questionCount),
      ponderation: Number(item.ponderation),
    })),
    answerKeys: answerKeyRows
      .map((row) => ({
        area: text(row.area),
        tipo: text(row.tipo).toUpperCase(),
        // Los espacios de las respuestas son preguntas en blanco: no se recortan.
        answers: String(row.answers ?? '').toUpperCase(),
      }))
      .sort(compareBy('area', 'tipo', 'answers')),
    dniCorrections: dniCorrections
      .map((item) => ({
        litho: text(item.litho),
        originalDni: stripDigits(item.originalDni),
        correctedDni: stripDigits(item.correctedDni),
      }))
      .sort(compareBy('litho', 'correctedDni')),
  }
}

/** Con qué datos se calificó: el padrón y las hojas de respuestas, tal como estaban cargados. */
export function buildDataPayload({ archiveRows = [], responsesRows = [] }) {
  return {
    padron: archiveRows
      .map((row) => ({
        dni: stripDigits(row.dni),
        paterno: text(row.paterno),
        materno: text(row.materno),
        nombres: text(row.nombres),
        area: text(row.area),
        programa: text(row.programa),
      }))
      .sort(compareBy('dni', 'paterno', 'materno', 'nombres')),
    respuestas: responsesRows
      .map((row) => ({
        litho: text(row.litho),
        dni: stripDigits(row.dni),
        tipo: text(row.tipo).toUpperCase(),
        answers: String(row.answers ?? '').toUpperCase(),
      }))
      .sort(compareBy('litho', 'dni', 'answers')),
  }
}

/**
 * Huellas SHA-256 de un cálculo. Con las mismas claves, plantilla, valores, correcciones,
 * padrón y hojas, las huellas son idénticas; cambiar cualquiera de esas cosas las cambia.
 *
 * @returns {{ configSha256: string, dataSha256: string }}
 */
export function buildCalculationFingerprint(input) {
  return {
    configSha256: sha256Hex(canonicalJson(buildConfigPayload(input))),
    dataSha256: sha256Hex(canonicalJson(buildDataPayload(input))),
  }
}

export { formatHashBlocks }
