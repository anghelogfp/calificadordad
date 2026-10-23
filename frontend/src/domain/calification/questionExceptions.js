import { normalizeAreaStrict } from '@/utils/helpers'
import { sha256Hex } from '@/utils/cryptoHash'
import { EXCEPTION_TYPES, parseValidAnswers } from './scoreAnswerSheet'

export const EXCEPTION_LABELS = {
  [EXCEPTION_TYPES.AWARD]: 'Anulada: el punto es para todos',
  [EXCEPTION_TYPES.EXCLUDE]: 'Anulada: no cuenta para nadie',
  [EXCEPTION_TYPES.MULTIPLE_KEY]: 'Varias respuestas válidas',
}

/**
 * Huella de una clave. Una excepción se liga al contenido de la clave sobre la que se decidió:
 * si en otro examen la clave es distinta, la excepción vieja deja de aplicarse y se avisa,
 * en lugar de anular silenciosamente otra pregunta.
 */
export function keyFingerprint(answers) {
  return sha256Hex(String(answers ?? '').toUpperCase())
}

function canonicalArea(area, areaList) {
  const value = String(area ?? '').trim()
  if (!value) return ''
  return normalizeAreaStrict(value, areaList) || value.toUpperCase()
}

function canonicalTipo(tipo) {
  return String(tipo ?? '').trim().toUpperCase().slice(0, 1)
}

/** Identidad de una clave: el área y el tipo de prueba ('' para la clave general). */
export function keyIdentity(area, tipo, areaList = []) {
  return `${canonicalArea(area, areaList)}|${canonicalTipo(tipo)}`
}

/** Mensajes de error de una excepción mal formada; lista vacía si es válida. */
export function validateQuestionException(exception, { answersLength } = {}) {
  const errors = []
  const number = Number(exception?.questionNumber)
  const max = Number(answersLength)

  if (!Object.values(EXCEPTION_TYPES).includes(exception?.type)) {
    errors.push('El tipo de excepción no es válido.')
  }
  if (!Number.isInteger(number) || number < 1) {
    errors.push('El número de pregunta no es válido.')
  } else if (Number.isFinite(max) && number > max) {
    errors.push(`La pregunta ${number} no existe: el examen tiene ${max} preguntas.`)
  }
  if (exception?.type === EXCEPTION_TYPES.MULTIPLE_KEY && !parseValidAnswers(exception.validAnswers)) {
    errors.push('Indica al menos una respuesta válida (A a E).')
  }
  if (!String(exception?.reason ?? '').trim()) {
    errors.push('Indica el motivo de la excepción.')
  }
  return errors
}

/**
 * Clasifica cada excepción respecto de las claves cargadas:
 * - `applied`: su clave existe y no cambió; se aplica.
 * - `outdated`: existe una clave de ese área y tipo, pero su contenido cambió; NO se aplica.
 * - `orphan`: no hay ninguna clave de ese área y tipo; NO se aplica.
 * - `invalid`: está mal formada o hay otra para la misma pregunta de la misma clave; NO se aplica.
 */
export function classifyQuestionExceptions({ exceptions = [], keyRows = [], answersLength, areaList = [] } = {}) {
  const keysByIdentity = new Map()
  keyRows.forEach((row) => {
    const identity = keyIdentity(row.area, row.tipo, areaList)
    if (!keysByIdentity.has(identity)) keysByIdentity.set(identity, [])
    keysByIdentity.get(identity).push(row)
  })

  const questionCounts = new Map()
  exceptions.forEach((exception) => {
    const slot = `${keyIdentity(exception.area, exception.tipo, areaList)}|${Number(exception.questionNumber)}`
    questionCounts.set(slot, (questionCounts.get(slot) || 0) + 1)
  })

  return exceptions.map((exception) => {
    const identity = keyIdentity(exception.area, exception.tipo, areaList)
    const errors = validateQuestionException(exception, { answersLength })
    if (errors.length > 0) return { ...exception, status: 'invalid', message: errors[0] }

    if (questionCounts.get(`${identity}|${Number(exception.questionNumber)}`) > 1) {
      return { ...exception, status: 'invalid', message: `Hay más de una excepción para la pregunta ${exception.questionNumber} de esta clave.` }
    }

    const keys = keysByIdentity.get(identity) || []
    if (keys.length === 0) {
      return { ...exception, status: 'orphan', message: 'No hay una clave cargada para esta área y tipo.' }
    }
    const sameKey = keys.some((row) => keyFingerprint(row.answers) === exception.keySha256)
    if (!sameKey) {
      return { ...exception, status: 'outdated', message: 'La clave cambió desde que se registró la excepción; no se aplica.' }
    }
    return { ...exception, status: 'applied', message: '' }
  })
}

/** Excepciones ya clasificadas que aplican a una fila de clave concreta. */
export function exceptionsForKeyRow(classified = [], keyRow, areaList = []) {
  if (!keyRow) return []
  const identity = keyIdentity(keyRow.area, keyRow.tipo, areaList)
  const fingerprint = keyFingerprint(keyRow.answers)
  return classified.filter((exception) =>
    exception.status === 'applied'
    && exception.keySha256 === fingerprint
    && keyIdentity(exception.area, exception.tipo, areaList) === identity)
}

/** Forma compacta que se guarda en cada resultado: lo mínimo para reproducir el puntaje. */
export function toAppliedSummary(exceptions = []) {
  return exceptions
    .map((exception) => ({
      questionNumber: Number(exception.questionNumber),
      type: exception.type,
      validAnswers: exception.type === EXCEPTION_TYPES.MULTIPLE_KEY ? parseValidAnswers(exception.validAnswers) : '',
    }))
    .sort((a, b) => a.questionNumber - b.questionNumber)
}

/**
 * Excepciones clasificadas que corresponden a este cálculo: las de la clave general en un
 * simulacro general, o las del área calculada en los demás casos.
 */
export function classifyExceptionsInScope({
  exceptions = [], keyRows = [], answersLength, areaList = [], calculationArea = '', generalSimulacro = false,
} = {}) {
  return classifyQuestionExceptions({ exceptions, keyRows, answersLength, areaList })
    .filter((exception) => (generalSimulacro
      ? !String(exception.area ?? '').trim()
      : normalizeAreaStrict(exception.area, areaList) === calculationArea))
}
