import { generateId, stripDigits, removeWhitespace } from './helpers'

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
export function buildIdentifierObservation(row) {
  const issues = []

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo sin marcar')
  }

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI sin marcar')
  } else if (dniDigits.length !== 8) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const aulaDigits = stripDigits(row.aula)
  if (!aulaDigits) {
    issues.push('Aula sin marcar')
  } else if (aulaDigits.length !== 3) {
    issues.push(`Aula incompleta (${aulaDigits})`)
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Parsea una línea de archivo de identificación
 */
export function parseIdentifierLine(line, lineNumber) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, 21)
  if (!/^\d{21}$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(21)
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

  const lithoSegment = remainder.slice(0, 6)
  const tipoSegment = remainder.slice(6, 7)
  const dniSegment = remainder.slice(7, 15)
  const aulaSegment = remainder.slice(15, 18)
  const answersSegment = remainder.slice(18).trim()

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

  row.observaciones = buildIdentifierObservation(row)

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
 */
export function buildResponseObservation(row) {
  const issues = []

  const dniDigits = stripDigits(row.dni)
  if (!dniDigits) {
    issues.push('DNI no vinculado')
  } else if (dniDigits.length !== 8) {
    issues.push(`DNI incompleto (${dniDigits})`)
  }

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo no vinculado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answersNormalized = answersRaw.replaceAll(/\s/g, '')
  if (!answersNormalized) {
    issues.push('Sin respuestas marcadas')
  } else if (answersNormalized.length !== 60) {
    issues.push(`Cadena incompleta (${answersNormalized.length}/60)`)
  } else if (/[^A-E*]/.test(answersNormalized)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Parsea una línea de archivo de respuestas
 */
export function parseResponseLine(line, lineNumber) {
  const raw = line.endsWith('\r') ? line.slice(0, -1) : line
  if (!raw.trim() || raw.trim().length <= 1) {
    return null
  }

  if (raw.length < 40) {
    return { error: `L${lineNumber}: longitud insuficiente (${raw.length} caracteres)` }
  }

  const header = raw.slice(0, 21)
  if (!/^\d{21}$/.test(header)) {
    return { error: `L${lineNumber}: cabecera inválida (${header})` }
  }

  let remainder = raw.slice(21)
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

  const lithoSegment = remainder.slice(0, 6)
  const answersSegment = remainder.slice(6)

  const row = createResponseRow({
    rawLine: raw,
    header,
    lectura: header.slice(3, 9),
    examCode,
    folio,
    indicator,
    litho: removeWhitespace(lithoSegment),
    answers: answersSegment,
  })

  row.observaciones = buildResponseObservation(row)

  return { row }
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
