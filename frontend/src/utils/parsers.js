import { generateId, stripDigits, removeWhitespace } from './helpers'
import { DEFAULT_DAT_FORMAT } from '@/constants'

/**
 * Crea una fila de identificador con valores por defecto
 */
export function createIdentifierRow(data = {}) {
  return {
    id: data.id ?? generateId(),
    rawLine: data.rawLine ?? '',
    header: data.header ?? '',
    lectura: data.lectura ?? '',
    examCode: data.examCode ?? '',
    folio: data.folio ?? '',
    indicator: data.indicator ?? '',
    litho: data.litho ?? '',
    tipo: data.tipo ?? '',
    dni: data.dni ?? '',
    aula: data.aula ?? '',
    answers: data.answers ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }
}

/**
 * Construye observación para una fila de identificador
 */
export function buildIdentifierObservation(row, formatConfig = DEFAULT_DAT_FORMAT) {
  const issues = []

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== formatConfig.lithoLength) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo sin marcar')
  }

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI sin marcar')
  } else if (dniDigits.length !== formatConfig.dniLength) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const aulaDigits = stripDigits(row.aula)
  if (!aulaDigits) {
    issues.push('Aula sin marcar')
  } else if (aulaDigits.length !== formatConfig.aulaLength) {
    issues.push(`Aula incompleta (${aulaDigits})`)
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Parsea una línea de archivo de identificación
 * @param {string} line
 * @param {number} lineNumber
 * @param {object} [formatConfig] - Configuración de formato DAT (usa DEFAULT_DAT_FORMAT si no se pasa)
 */
export function parseIdentifierLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, formatConfig.headerLength)
  if (!/^\d+$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(formatConfig.headerLength)
  let cursor = 0

  const examMatch = remainder.slice(cursor).match(/^\s*(\d{4})/)
  if (!examMatch) {
    return { error: `L${lineNumber}: código de examen no encontrado` }
  }
  const examCode = examMatch[1]
  cursor += examMatch[0].length

  remainder = remainder.slice(cursor)
  const folioMatch = remainder.match(/^\s*#?(\d+)/)
  if (!folioMatch) {
    return { error: `L${lineNumber}: folio (#0000) no reconocido (encontrado: "${remainder.slice(0, 10)}...")` }
  }
  const folio = folioMatch[1]
  cursor = folioMatch[0].length

  remainder = remainder.slice(cursor)
  const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
  if (!indicatorMatch) {
    return { error: `L${lineNumber}: indicador de estado no identificado` }
  }
  const indicator = indicatorMatch[1].toUpperCase()
  cursor = indicatorMatch[0].length

  remainder = remainder.slice(cursor)
  if (remainder.startsWith(' ')) {
    remainder = remainder.slice(1)
  }

  const lithoSegment = remainder.slice(formatConfig.lithoOffset, formatConfig.lithoOffset + formatConfig.lithoLength)
  const tipoSegment = remainder.slice(formatConfig.tipoOffset, formatConfig.tipoOffset + formatConfig.tipoLength)
  const dniSegment = remainder.slice(formatConfig.dniOffset, formatConfig.dniOffset + formatConfig.dniLength)
  const aulaSegment = remainder.slice(formatConfig.aulaOffset, formatConfig.aulaOffset + formatConfig.aulaLength)
  const answersSegment = remainder
    .slice(formatConfig.answersOffset, formatConfig.answersOffset + formatConfig.answersLength)

  const row = createIdentifierRow({
    rawLine: raw,
    header,
    lectura: header.slice(3, 9),
    examCode,
    folio,
    indicator,
    litho: removeWhitespace(lithoSegment),
    tipo: tipoSegment.trim().toUpperCase(),
    dni: removeWhitespace(dniSegment),
    aula: removeWhitespace(aulaSegment),
    answers: answersSegment,
  })

  row.observaciones = buildIdentifierObservation(row, formatConfig)

  return { row }
}

/**
 * Crea una fila de respuesta con valores por defecto
 */
export function createResponseRow(data = {}) {
  return {
    id: data.id ?? generateId(),
    header: data.header ?? '',
    lectura: data.lectura ?? '',
    examCode: data.examCode ?? '',
    folio: data.folio ?? '',
    indicator: data.indicator ?? '',
    litho: data.litho ?? '',
    tipo: data.tipo ?? '',
    dni: data.dni ?? '',
    answers: data.answers ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }
}

/**
 * Construye observación para una fila de respuesta
 * @param {object} row
 * @param {object} [formatConfig] - Configuración de formato DAT
 */
export function buildResponseObservation(row, formatConfig = DEFAULT_DAT_FORMAT) {
  const issues = []

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI no vinculado')
  } else if (dniDigits.length !== formatConfig.dniLength) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo no vinculado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== formatConfig.lithoLength) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answerWindow = answersRaw.slice(0, formatConfig.answersLength)
  const markedAnswers = answerWindow.replace(/\s/g, '')
  if (!answersRaw.trim()) {
    issues.push('Sin respuestas marcadas')
  } else if (answersRaw.length < formatConfig.answersLength) {
    issues.push(`Cadena incompleta (${answersRaw.length}/${formatConfig.answersLength})`)
  } else if (/[^A-E*]/.test(markedAnswers)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Parsea una línea de archivo de respuestas
 * @param {string} line
 * @param {number} lineNumber
 * @param {object} [formatConfig] - Configuración de formato DAT
 */
export function parseResponseLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT) {
  return parseResponseLineInternal(line, lineNumber, formatConfig, false)
}

export function parseAnswerKeyResponseLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT) {
  return parseResponseLineInternal(line, lineNumber, formatConfig, true)
}

function scoreAnswersSegment(segment, answersLength) {
  if (segment.length < answersLength) return -1
  const window = segment.slice(0, answersLength).toUpperCase()
  const marked = window.replace(/\s/g, '')
  if (/[^A-E*]/.test(marked)) return -1
  return marked.length
}

function selectAnswerKeyAnswersOffset(remainder, formatConfig) {
  const configuredOffset = formatConfig.responseAnswersOffset
    ?? (formatConfig.tipoOffset + formatConfig.tipoLength)
  const noTypeOffset = formatConfig.lithoOffset + formatConfig.lithoLength
  const candidates = Array.from(new Set([configuredOffset, noTypeOffset]))

  return candidates
    .map(offset => ({
      offset,
      score: scoreAnswersSegment(remainder.slice(offset), formatConfig.answersLength),
    }))
    .sort((a, b) => b.score - a.score || a.offset - b.offset)[0]?.offset ?? configuredOffset
}

function parseResponseLineInternal(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT, autoDetectAnswerKeyOffset = false) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, formatConfig.headerLength)
  if (!/^\d+$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(formatConfig.headerLength)
  let cursor = 0

  const examMatch = remainder.slice(cursor).match(/^\s*(\d{4})/)
  if (!examMatch) {
    return { error: `L${lineNumber}: código de examen no encontrado` }
  }
  const examCode = examMatch[1]
  cursor += examMatch[0].length

  remainder = remainder.slice(cursor)
  const folioMatch = remainder.match(/^\s*#?(\d+)/)
  if (!folioMatch) {
    return { error: `L${lineNumber}: folio (#0000) no reconocido (encontrado: "${remainder.slice(0, 10)}...")` }
  }
  const folio = folioMatch[1]
  cursor = folioMatch[0].length

  remainder = remainder.slice(cursor)
  const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
  if (!indicatorMatch) {
    return { error: `L${lineNumber}: indicador de estado no identificado` }
  }
  const indicator = indicatorMatch[1].toUpperCase()
  cursor = indicatorMatch[0].length

  remainder = remainder.slice(cursor)
  if (remainder.startsWith(' ')) {
    remainder = remainder.slice(1)
  }

  const lithoSegment = remainder.slice(formatConfig.lithoOffset, formatConfig.lithoOffset + formatConfig.lithoLength)
  const responseAnswersOffset = formatConfig.responseAnswersOffset
    ?? (formatConfig.tipoOffset + formatConfig.tipoLength)
  const answersOffset = autoDetectAnswerKeyOffset
    ? selectAnswerKeyAnswersOffset(remainder, formatConfig)
    : responseAnswersOffset
  const typeOverlapsAnswers = answersOffset <= formatConfig.tipoOffset
  const tipoSegment = typeOverlapsAnswers
    ? ''
    : remainder.slice(formatConfig.tipoOffset, formatConfig.tipoOffset + formatConfig.tipoLength)
  const answersSegment = remainder
    .slice(answersOffset, answersOffset + formatConfig.answersLength)
    .toUpperCase()

  const row = createResponseRow({
    rawLine: raw,
    header,
    lectura: header.slice(3, 9),
    examCode,
    folio,
    indicator,
    litho: removeWhitespace(lithoSegment),
    tipo: tipoSegment.trim().toUpperCase(),
    answers: answersSegment,
  })

  row.observaciones = buildResponseObservation(row, formatConfig)

  return { row }
}

/**
 * Detecta automáticamente el offset de respuestas en un archivo .dat
 * Probando offsets 0-25 y midiendo cuál produce más caracteres A-E/espacio
 * (respuestas válidas) y menos dígitos (DNI/aula).
 * @param {string[]} lines - Líneas crudas del archivo
 * @param {object} [formatConfig] - Configuración de formato DAT
 * @returns {{ offset: number, score: number, answerPct: number, digitPct: number } | null}
 */
export function detectResponseAnswersOffset(lines, formatConfig = DEFAULT_DAT_FORMAT) {
  const SAMPLE_SIZE = 20
  const MAX_OFFSET = 25
  const expectedLen = formatConfig.answersLength || 60

  const remainders = []
  for (let i = 0; i < Math.min(lines.length, SAMPLE_SIZE); i++) {
    const raw = lines[i].replace(/\r$/, '')
    if (!raw.trim() || raw.trim().length <= 1) continue
    if (raw.length < 40) continue

    const header = raw.slice(0, formatConfig.headerLength)
    if (!/^\d+$/.test(header)) continue

    let remainder = raw.slice(formatConfig.headerLength)
    let cursor = 0

    const examMatch = remainder.slice(cursor).match(/^\s*(\d{4})/)
    if (!examMatch) continue
    cursor += examMatch[0].length
    remainder = remainder.slice(cursor)

    const folioMatch = remainder.match(/^\s*#?(\d+)/)
    if (!folioMatch) continue
    cursor = folioMatch[0].length
    remainder = remainder.slice(cursor)

    const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
    if (!indicatorMatch) continue
    cursor = indicatorMatch[0].length
    remainder = remainder.slice(cursor)

    if (remainder.startsWith(' ')) remainder = remainder.slice(1)
    remainders.push(remainder)
  }

  if (remainders.length < 3) return null

  const scores = []
  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    let answerChars = 0
    let digitChars = 0
    let spaceChars = 0
    let total = 0

    remainders.forEach((r) => {
      const block = r.slice(offset, offset + expectedLen).toUpperCase()
      for (const ch of block) {
        total++
        if (/[A-E]/.test(ch)) answerChars++
        else if (/\d/.test(ch)) digitChars++
        else if (ch === ' ') spaceChars++
      }
    })

    if (total === 0) continue
    const answerPct = (answerChars + spaceChars) / total
    const digitPct = digitChars / total
    scores.push({ offset, answerPct, digitPct, score: answerPct - digitPct * 2 })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores[0]
}

/**
 * Lee líneas de un archivo y las parsea
 */
export async function readLinesFromFile(file, parser) {
  const text = await file.text()
  const sanitized = text.split('\u001a').join('')
  const normalized = sanitized.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalized.split('\n')
  const results = []

  lines.forEach((line, index) => {
    const result = parser(line, index + 1)
    if (!result) {
      return
    }
    results.push(result)
  })

  return results
}
