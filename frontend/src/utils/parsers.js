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
  } else {
    if (answersRaw.length < formatConfig.answersLength) {
      issues.push(`Blancos finales asumidos (${formatConfig.answersLength - answersRaw.length})`)
    }
    if (/[^A-E*]/.test(markedAnswers)) {
      issues.push('Respuestas con marcas no válidas')
    }
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Parsea una línea de archivo de respuestas
 * @param {string} line
 * @param {number} lineNumber
 * @param {object} [formatConfig] - Configuración de formato DAT
 */
export function parseResponseLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT, options = {}) {
  return parseResponseLineInternal(line, lineNumber, formatConfig, null, options)
}

export function parseLinkedResponseLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT, linkedIdentifier = null, options = {}) {
  return parseResponseLineInternal(line, lineNumber, formatConfig, linkedIdentifier, options)
}

export function parseAnswerKeyResponseLine(line, lineNumber, formatConfig = DEFAULT_DAT_FORMAT, linkedIdentifier = null, options = {}) {
  return parseResponseLineInternal(line, lineNumber, formatConfig, linkedIdentifier, options)
}

/**
 * Clasifica el contenido de la columna "tipo" de una línea de respuestas.
 *
 * Los alfabetos de tipo (P-T) y de respuestas (A-E, *) no se solapan, así que:
 * - 'with-tipo':    hay una marca en la columna tipo; las respuestas empiezan después.
 * - 'without-tipo': hay una respuesta A-E o *; la línea no trae columna tipo y las
 *                   respuestas empiezan justo después del litho.
 * - 'ambiguous':    espacio. Puede ser tipo sin marcar (la columna existe) o una primera
 *                   pregunta en blanco (la columna no existe); no se decide con una sola línea.
 */
function classifyTipoColumn(remainder, formatConfig) {
  const mark = remainder
    .slice(formatConfig.tipoOffset, formatConfig.tipoOffset + formatConfig.tipoLength)
    .toUpperCase()
  if (!mark.trim()) return 'ambiguous'
  if (/^[A-E*]$/.test(mark)) return 'without-tipo'
  return 'with-tipo'
}

/**
 * Offset donde empiezan las respuestas. Nunca depende de cuántas marcas haya en la ventana:
 * un blanco al final de la línea no puede cambiar la alineación de todas las preguntas.
 * Si la columna tipo es ambigua, manda la disposición del archivo (layoutHint) y, sin ella,
 * se asume el offset configurado (la columna tipo existe, aunque venga sin marcar).
 */
function resolveAnswersOffset(remainder, formatConfig, layoutHint = null) {
  const withTipoOffset = formatConfig.responseAnswersOffset
    ?? (formatConfig.tipoOffset + formatConfig.tipoLength)
  const withoutTipoOffset = formatConfig.lithoOffset + formatConfig.lithoLength

  const column = classifyTipoColumn(remainder, formatConfig)
  if (column === 'with-tipo') return withTipoOffset
  if (column === 'without-tipo') return withoutTipoOffset
  return layoutHint === 'without-tipo' ? withoutTipoOffset : withTipoOffset
}

/**
 * Extrae lo que sigue al encabezado, examen, folio e indicador de una línea DAT.
 * Devuelve null si la línea no tiene la estructura esperada.
 */
function extractLineRemainder(rawLine, formatConfig) {
  const raw = rawLine.replace(/\r$/, '')
  if (!raw.trim() || raw.trim().length <= 1 || raw.length < 40) return null
  if (!/^\d+$/.test(raw.slice(0, formatConfig.headerLength))) return null

  let remainder = raw.slice(formatConfig.headerLength)
  const examMatch = remainder.match(/^\s*(\d{4})/)
  if (!examMatch) return null
  remainder = remainder.slice(examMatch[0].length)

  const folioMatch = remainder.match(/^\s*#?(\d+)/)
  if (!folioMatch) return null
  remainder = remainder.slice(folioMatch[0].length)

  const indicatorMatch = remainder.match(/^\s*([A-Z])/i)
  if (!indicatorMatch) return null
  remainder = remainder.slice(indicatorMatch[0].length)

  return remainder.startsWith(' ') ? remainder.slice(1) : remainder
}

/**
 * Determina la disposición de un archivo completo de respuestas o claves.
 * Todas las líneas de un archivo comparten disposición, así que las líneas con columna
 * tipo inequívoca deciden también las ambiguas (tipo sin marcar o 1ª pregunta en blanco).
 * @param {string[]} lines - Líneas crudas del archivo
 * @param {object} [formatConfig]
 * @returns {'with-tipo' | 'without-tipo' | null} null si ninguna línea es concluyente
 */
export function inferResponseLayout(lines, formatConfig = DEFAULT_DAT_FORMAT) {
  let withTipo = 0
  let withoutTipo = 0
  for (const line of lines) {
    const remainder = extractLineRemainder(line, formatConfig)
    if (remainder === null) continue
    const column = classifyTipoColumn(remainder, formatConfig)
    if (column === 'with-tipo') withTipo += 1
    else if (column === 'without-tipo') withoutTipo += 1
  }
  if (!withTipo && !withoutTipo) return null
  return withoutTipo > withTipo ? 'without-tipo' : 'with-tipo'
}

/**
 * Auditoría de un archivo de respuestas ya parseado. Devuelve advertencias legibles;
 * lista vacía = sin hallazgos. No modifica filas.
 * @param {string[]} lines - Líneas crudas del archivo
 * @param {object[]} rows - Filas producidas por el parser
 * @param {object} [formatConfig]
 * @returns {string[]}
 */
export function auditParsedResponses(lines, rows, formatConfig = DEFAULT_DAT_FORMAT) {
  const warnings = []
  const expectedLen = formatConfig.answersLength || 60

  let withTipo = 0
  let withoutTipo = 0
  for (const line of lines) {
    const remainder = extractLineRemainder(line, formatConfig)
    if (remainder === null) continue
    const column = classifyTipoColumn(remainder, formatConfig)
    if (column === 'with-tipo') withTipo += 1
    else if (column === 'without-tipo') withoutTipo += 1
  }
  if (withTipo && withoutTipo) {
    warnings.push(
      `El archivo mezcla dos disposiciones de columna tipo (${withTipo} con tipo, ${withoutTipo} sin tipo). Revisa la configuración de ScanTools.`,
    )
  }

  const invalid = []
  const tooLong = []
  const tooShort = []
  for (const row of rows) {
    const answers = String(row.answers || '')
    if (answers.length > expectedLen) tooLong.push(row.litho)
    if (answers.length < expectedLen) tooShort.push(row.litho)
    if (/[^A-E* ]/.test(answers)) invalid.push(row.litho)
  }
  if (invalid.length) {
    warnings.push(
      `${invalid.length} hoja(s) con caracteres que no son respuestas (posible desplazamiento): ${invalid.slice(0, 5).join(', ')}`,
    )
  }
  if (tooShort.length) {
    warnings.push(
      `${tooShort.length} hoja(s) con menos de ${expectedLen} respuestas (se asumirán blancos al final): ${tooShort.slice(0, 5).join(', ')}`,
    )
  }
  if (tooLong.length) {
    warnings.push(`${tooLong.length} hoja(s) con más de ${expectedLen} respuestas: ${tooLong.slice(0, 5).join(', ')}`)
  }
  return warnings
}

/**
 * Compara respuestas locales con las guardadas en la base. Los blancos finales
 * no cambian el puntaje, por eso se comparan rellenados al largo esperado.
 * @returns {string[]} litho de las hojas que difieren
 */
export function findStoredAnswerMismatches(localRows, storedRows, answersLength = 60) {
  const norm = (value) => String(value || '').padEnd(answersLength, ' ')
  const stored = new Map()
  for (const row of storedRows) {
    const key = `${row.litho}|${row.folio || ''}|${row.examCode || row.exam_code || ''}`
    const list = stored.get(key) || []
    list.push(norm(row.answers))
    stored.set(key, list)
  }
  const mismatches = []
  for (const row of localRows) {
    const key = `${row.litho}|${row.folio || ''}|${row.examCode || row.exam_code || ''}`
    const list = stored.get(key)
    const expected = norm(row.answers)
    const index = list ? list.indexOf(expected) : -1
    if (index === -1) mismatches.push(row.litho)
    else list.splice(index, 1)
  }
  return mismatches
}

function parseResponseLineInternal(
  line,
  lineNumber,
  formatConfig = DEFAULT_DAT_FORMAT,
  linkedIdentifier = null,
  { layoutHint = null } = {},
) {
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
  const answersOffset = resolveAnswersOffset(remainder, formatConfig, layoutHint)
  const typeOverlapsAnswers = answersOffset <= formatConfig.tipoOffset
  const tipoSegment = typeOverlapsAnswers
    ? (linkedIdentifier?.tipo || '')
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

  row.detectedAnswersOffset = answersOffset
  row.tipoSource = typeOverlapsAnswers
    ? (linkedIdentifier?.tipo ? 'identifier' : 'none')
    : 'response'

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
    const remainder = extractLineRemainder(lines[i], formatConfig)
    if (remainder !== null) remainders.push(remainder)
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
 * @param {File} file
 * @param {(line: string, lineNumber: number, context?: any) => any} parser
 * @param {{ prepare?: (lines: string[]) => any }} [options] - `prepare` recibe todas las líneas
 *   una vez y su resultado se pasa como 3er argumento a `parser` (disposición del archivo).
 */
export async function readLinesFromFile(file, parser, { prepare } = {}) {
  const text = await file.text()
  const sanitized = text.split('\u001a').join('')
  const normalized = sanitized.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalized.split('\n')
  const context = prepare ? prepare(lines) : undefined
  const results = []

  lines.forEach((line, index) => {
    const result = parser(line, index + 1, context)
    if (!result) {
      return
    }
    results.push(result)
  })

  return results
}
