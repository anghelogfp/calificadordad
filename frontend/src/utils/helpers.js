import { ANSWER_KEY_AREAS, ANSWER_KEY_AREA_ALIASES } from '@/constants'

/**
 * Elimina diacríticos (tildes) de una cadena
 */
export function removeDiacritics(value) {
  return Array.from(String(value ?? '').normalize('NFD'))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < 0x300 || code > 0x036f
    })
    .join('')
}

/**
 * Extrae solo dígitos de una cadena
 */
export function stripDigits(value) {
  const digits = String(value ?? '').match(/\d/g)
  return digits ? digits.join('') : ''
}

/**
 * Elimina espacios en blanco de una cadena
 */
export function removeWhitespace(value) {
  return Array.from(String(value ?? '')).filter((char) => !/\s/.test(char)).join('')
}

/**
 * Normaliza una cadena para comparaciones (sin tildes, minúsculas, sin espacios extremos)
 */
export function normalize(value) {
  return removeDiacritics(value).toLowerCase().trim()
}

/**
 * Normaliza un área a su forma canónica.
 * @param {string} value - Valor a normalizar
 * @param {string[]} [areaList] - Lista dinámica de áreas disponibles (fallback a ANSWER_KEY_AREAS)
 */
export function normalizeArea(value, areaList = ANSWER_KEY_AREAS) {
  const raw = String(value ?? '')
  const trimmedOriginal = raw.trim()
  if (!trimmedOriginal) {
    return areaList[0] ?? ANSWER_KEY_AREAS[0]
  }

  const exactMatch = areaList.find((area) => area === trimmedOriginal)
  if (exactMatch) {
    return exactMatch
  }

  const normalized = removeDiacritics(trimmedOriginal).toLowerCase()
  const aliasMatch = ANSWER_KEY_AREA_ALIASES[normalized]
  if (aliasMatch) {
    // Verificar que el alias exista en la lista dinámica
    const aliasInList = areaList.find((area) => area === aliasMatch)
    if (aliasInList) return aliasInList
    // Si no está en la lista dinámica, buscar parcialmente
  }

  const matched = areaList.find(
    (area) => removeDiacritics(area).trim().toLowerCase() === normalized,
  )
  return matched ?? areaList[0] ?? ANSWER_KEY_AREAS[0]
}

/**
 * Genera un ID único
 */
export function generateId() {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
  return crypto.randomUUID()
}

/**
 * Formatea un timestamp a formato local peruano
 */
export function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Construye una clave de match para respuestas basada en litho, indicator y folio
 */
export function buildResponseMatchKey(row) {
  const litho = stripDigits(row.litho)
  const indicator = (row.indicator || '').trim().toUpperCase()
  const folio = String(row.folio || '').trim()
  return `${litho}|${indicator}|${folio}`
}

/**
 * Construye una clave para lookup por área y tipo
 */
export function buildAreaTipoKey(area, tipo, areaList = ANSWER_KEY_AREAS) {
  const normalizedArea = normalizeArea(area, areaList)
  const normalizedTipo = (tipo || '').trim().toUpperCase().slice(0, 1)
  if (!normalizedTipo) return ''
  return `${normalizedArea}|${normalizedTipo}`
}

/**
 * Construye una clave única para ponderaciones
 */
export function buildPonderationKey(area, subject, areaList = ANSWER_KEY_AREAS) {
  return `${normalizeArea(area, areaList)}|${normalize(subject)}`
}

/**
 * Clasifica un caracter de respuesta
 */
export function classifyAnswerChar(answerChar) {
  if (!answerChar || answerChar === ' ' || answerChar === '\t' || answerChar === '\n' || answerChar === '\r') {
    return 'blank'
  }

  const value = String(answerChar).trim().toUpperCase()

  if (!value || value === '') {
    return 'blank'
  }

  if (value === '*') {
    return 'blank'
  }

  if (/^[A-E]$/.test(value)) {
    return 'option'
  }

  return 'blank'
}

/**
 * Construye el plan de preguntas a partir de las ponderaciones
 */
export function buildQuestionPlan(entries) {
  const plan = []
  entries.forEach((entry) => {
    const count = Math.max(0, Math.round(Number(entry.questionCount) || 0))
    const weight = Number(entry.ponderation) || 0
    const subject = entry.subject || ''

    for (let index = 0; index < count; index += 1) {
      plan.push({
        subject,
        weight,
      })
    }
  })
  return plan
}
