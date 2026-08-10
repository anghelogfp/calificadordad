function digits(value) {
  return (String(value ?? '').match(/\d/g) || []).join('')
}

function firstLetter(value) {
  return String(value ?? '').trim().toUpperCase().slice(0, 1)
}

function indexRows(rows, valueForRow) {
  const index = new Map()
  rows.forEach((row) => {
    const value = valueForRow(row)
    if (!value) return
    if (!index.has(value)) index.set(value, [])
    index.get(value).push(row)
  })
  return index
}

function duplicateRowCount(index) {
  return [...index.values()]
    .filter(rows => rows.length > 1)
    .reduce((total, rows) => total + rows.length, 0)
}

function sourceName(row, sourcesById) {
  return sourcesById.get(row?.sourceId || row?.source_client_id || '')?.name || ''
}

function identifierMatchKey(row) {
  const litho = digits(row?.litho)
  const folio = String(row?.folio || '').trim()
  if (!litho || !folio) return ''
  return `${litho}|${firstLetter(row?.indicator)}|${folio}`
}

function statusForCodes(codes) {
  if (!codes.length) return 'valid'
  if (codes.some(code => code.includes('DUPLICATE'))) return 'duplicate'
  if (codes.some(code => code.includes('MISSING'))) return 'missing'
  if (codes.some(code => code.includes('OUTSIDE'))) return 'outside_padron'
  return 'observed'
}

export function buildIdentifierReconciliation(candidates = [], identifiers = [], sources = []) {
  const validCandidates = candidates.filter(row => digits(row.dni).length === 8)
  const invalidPadronRows = candidates.length - validCandidates.length
  const candidatesByDni = indexRows(validCandidates, row => digits(row.dni))
  const identifiersByDni = indexRows(identifiers, row => {
    const dni = digits(row.dni)
    return dni.length === 8 ? dni : ''
  })
  const matchKeys = indexRows(identifiers, identifierMatchKey)
  const sourcesById = new Map(sources.map(source => [source.id, source]))
  const duplicatePadronDnis = duplicateRowCount(candidatesByDni)
  const duplicateIdentifierDnis = duplicateRowCount(identifiersByDni)
  const duplicateMatchKeys = duplicateRowCount(matchKeys)
  const duplicateIdentifierRows = new Set(
    [...identifiersByDni.values()].filter(rows => rows.length > 1).flat(),
  )
  const duplicateMatchRows = new Set(
    [...matchKeys.values()].filter(rows => rows.length > 1).flat(),
  )

  const verificationRows = []
  candidates.forEach((candidate, candidateIndex) => {
    const dni = digits(candidate.dni)
    const matches = dni.length === 8 ? identifiersByDni.get(dni) || [] : []
    if (!matches.length) {
      const issueCodes = dni.length === 8 ? ['IDENTIFIER_MISSING'] : ['PADRON_DNI_INVALID']
      verificationRows.push({
        order: candidateIndex + 1,
        dni,
        candidate,
        identifier: null,
        sourceName: '',
        issueCodes,
        status: statusForCodes(issueCodes),
      })
      return
    }

    matches.forEach((identifier) => {
      const issueCodes = []
      if ((candidatesByDni.get(dni) || []).length > 1) issueCodes.push('PADRON_DNI_DUPLICATE')
      if (duplicateIdentifierRows.has(identifier)) issueCodes.push('IDENTIFIER_DNI_DUPLICATE')
      if (duplicateMatchRows.has(identifier)) issueCodes.push('IDENTIFIER_MATCH_KEY_DUPLICATE')
      verificationRows.push({
        order: candidateIndex + 1,
        dni,
        candidate,
        identifier,
        sourceName: sourceName(identifier, sourcesById),
        issueCodes,
        status: statusForCodes(issueCodes),
      })
    })
  })

  identifiers.forEach((identifier) => {
    const dni = digits(identifier.dni)
    if (dni.length === 8 && candidatesByDni.has(dni)) return
    const issueCodes = dni.length === 8 ? ['IDENTIFIER_OUTSIDE_PADRON'] : ['IDENTIFIER_DNI_MISSING']
    if (duplicateMatchRows.has(identifier)) issueCodes.push('IDENTIFIER_MATCH_KEY_DUPLICATE')
    verificationRows.push({
      order: null,
      dni,
      candidate: null,
      identifier,
      sourceName: sourceName(identifier, sourcesById),
      issueCodes,
      status: statusForCodes(issueCodes),
    })
  })

  const padronDnis = new Set(candidatesByDni.keys())
  const identifierDnis = new Set(identifiersByDni.keys())
  const matchedCandidates = [...padronDnis].filter(dni => identifierDnis.has(dni)).length
  const missingIdentifiers = [...padronDnis].filter(dni => !identifierDnis.has(dni)).length
  const identifiersWithoutCandidate = identifiers.filter((row) => {
    const dni = digits(row.dni)
    return dni.length === 8 && !padronDnis.has(dni)
  }).length
  const unlinkedIdentifiers = identifiers.filter(row => digits(row.dni).length !== 8).length
  const linkedIdentifierRows = identifiers.length - identifiersWithoutCandidate - unlinkedIdentifiers
  const issues = missingIdentifiers + identifiersWithoutCandidate + unlinkedIdentifiers
    + duplicatePadronDnis + duplicateIdentifierDnis + duplicateMatchKeys + invalidPadronRows

  return {
    padronTotal: padronDnis.size,
    identifiersTotal: identifiers.length,
    linkedIdentifierRows,
    matchedCandidates,
    missingIdentifiers,
    identifiersWithoutCandidate,
    unlinkedIdentifiers,
    invalidPadronRows,
    duplicatePadronDnis,
    duplicateIdentifierDnis,
    duplicateMatchKeys,
    verificationRows,
    issues,
    status: issues === 0 && padronDnis.size > 0 && identifiers.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
}

export function buildResponseReconciliation(candidates = [], identifiers = [], responses = [], sources = []) {
  const candidatesByDni = indexRows(
    candidates.filter(row => digits(row.dni).length === 8), row => digits(row.dni),
  )
  const identifiersByDni = indexRows(identifiers, row => {
    const dni = digits(row.dni)
    return dni.length === 8 ? dni : ''
  })
  const responsesByDni = indexRows(responses, row => {
    const dni = digits(row.dni)
    return dni.length === 8 ? dni : ''
  })
  const sourcesById = new Map(sources.map(source => [source.id, source]))
  const duplicateResponseDnis = duplicateRowCount(responsesByDni)
  const duplicateRows = new Set(
    [...responsesByDni.values()].filter(rows => rows.length > 1).flat(),
  )
  const padronDnis = new Set(candidatesByDni.keys())
  const responseDnis = new Set(responsesByDni.keys())
  const identifierDnis = new Set(identifiersByDni.keys())
  const detailRows = []

  candidatesByDni.forEach((candidateRows, dni) => {
    const matches = responsesByDni.get(dni) || []
    if (!matches.length) {
      detailRows.push({
        dni,
        candidate: candidateRows[0],
        response: null,
        sourceName: '',
        issueCodes: ['RESPONSE_MISSING'],
        status: 'missing',
      })
      return
    }
    matches.forEach((response) => {
      const issueCodes = duplicateRows.has(response) ? ['RESPONSE_DNI_DUPLICATE'] : []
      detailRows.push({
        dni,
        candidate: candidateRows[0],
        response,
        sourceName: sourceName(response, sourcesById),
        issueCodes,
        status: statusForCodes(issueCodes),
      })
    })
  })

  responses.forEach((response) => {
    const dni = digits(response.dni)
    if (dni.length === 8 && padronDnis.has(dni)) return
    const issueCodes = dni.length === 8 ? ['RESPONSE_OUTSIDE_PADRON'] : ['RESPONSE_DNI_UNLINKED']
    if (duplicateRows.has(response)) issueCodes.push('RESPONSE_DNI_DUPLICATE')
    detailRows.push({
      dni,
      candidate: null,
      response,
      sourceName: sourceName(response, sourcesById),
      issueCodes,
      status: statusForCodes(issueCodes),
    })
  })

  const linkedResponses = responses.filter(row => digits(row.dni).length === 8).length
  const unlinkedResponses = responses.length - linkedResponses
  const responsesWithoutCandidate = responses.filter((row) => {
    const dni = digits(row.dni)
    return dni.length === 8 && !padronDnis.has(dni)
  }).length
  const candidatesWithoutResponse = [...padronDnis].filter(dni => !responseDnis.has(dni)).length
  const identifiersWithoutResponse = [...identifierDnis].filter(dni => !responseDnis.has(dni)).length
  const issues = unlinkedResponses + responsesWithoutCandidate + candidatesWithoutResponse + duplicateResponseDnis

  return {
    padronTotal: padronDnis.size,
    responsesTotal: responses.length,
    linkedResponses,
    unlinkedResponses,
    responsesWithoutCandidate,
    candidatesWithoutResponse,
    identifiersWithoutResponse,
    duplicateResponseDnis,
    detailRows,
    issues,
    status: issues === 0 && responses.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
}
