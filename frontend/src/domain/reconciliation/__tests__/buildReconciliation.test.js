import { describe, expect, it } from 'vitest'
import { buildIdentifierReconciliation, buildResponseReconciliation } from '../buildReconciliation'

describe('buildIdentifierReconciliation', () => {
  it('concilia un padrón e identificadores que cierran exactamente', () => {
    const result = buildIdentifierReconciliation(
      [{ dni: '12345678' }, { dni: '87654321' }],
      [
        { dni: '12345678', litho: '1', indicator: 'A', folio: '1' },
        { dni: '87654321', litho: '2', indicator: 'B', folio: '2' },
      ],
    )
    expect(result).toMatchObject({ matchedCandidates: 2, linkedIdentifierRows: 2, missingIdentifiers: 0, identifiersWithoutCandidate: 0, issues: 0, status: 'ok' })
    expect(result.verificationRows.every(row => row.status === 'valid')).toBe(true)
  })

  it('detalla faltantes, registros externos y DNI no vinculados', () => {
    const result = buildIdentifierReconciliation(
      [{ dni: '12345678' }, { dni: '87654321' }],
      [
        { dni: '12345678', litho: '1', indicator: 'A', folio: '1' },
        { dni: '99999999', litho: '2', indicator: 'B', folio: '2' },
        { dni: '', litho: '3', indicator: 'C', folio: '3' },
      ],
    )
    expect(result).toMatchObject({ missingIdentifiers: 1, identifiersWithoutCandidate: 1, unlinkedIdentifiers: 1 })
    expect(result.verificationRows.map(row => row.issueCodes[0])).toEqual(expect.arrayContaining([
      'IDENTIFIER_MISSING', 'IDENTIFIER_OUTSIDE_PADRON', 'IDENTIFIER_DNI_MISSING',
    ]))
  })

  it('marca duplicados de DNI y de clave física de lectura', () => {
    const identifiers = [
      { dni: '12345678', litho: '1', indicator: 'A', folio: '7' },
      { dni: '12345678', litho: '1', indicator: 'A', folio: '7' },
    ]
    const result = buildIdentifierReconciliation([{ dni: '12345678' }], identifiers)
    expect(result.duplicateIdentifierDnis).toBe(2)
    expect(result.duplicateMatchKeys).toBe(2)
    expect(result.verificationRows.every(row => row.status === 'duplicate')).toBe(true)
  })

  it('incluye el nombre del archivo fuente en el detalle', () => {
    const result = buildIdentifierReconciliation(
      [{ dni: '12345678' }],
      [{ dni: '12345678', sourceId: 'source-1' }],
      [{ id: 'source-1', name: 'id101.dat' }],
    )
    expect(result.verificationRows[0].sourceName).toBe('id101.dat')
  })
})

describe('buildResponseReconciliation', () => {
  it('concilia respuestas y conserva las métricas usadas por la interfaz', () => {
    const candidates = [{ dni: '12345678' }, { dni: '87654321' }]
    const identifiers = [...candidates]
    const responses = [...candidates]
    const result = buildResponseReconciliation(candidates, identifiers, responses)
    expect(result).toMatchObject({ responsesTotal: 2, linkedResponses: 2, candidatesWithoutResponse: 0, identifiersWithoutResponse: 0, issues: 0, status: 'ok' })
  })

  it('detalla respuestas faltantes, externas, no vinculadas y duplicadas', () => {
    const candidates = [{ dni: '12345678' }, { dni: '87654321' }]
    const result = buildResponseReconciliation(candidates, candidates, [
      { dni: '12345678' }, { dni: '12345678' }, { dni: '99999999' }, { dni: '' },
    ])
    expect(result).toMatchObject({ duplicateResponseDnis: 2, candidatesWithoutResponse: 1, responsesWithoutCandidate: 1, unlinkedResponses: 1 })
    expect(result.detailRows.flatMap(row => row.issueCodes)).toEqual(expect.arrayContaining([
      'RESPONSE_MISSING', 'RESPONSE_DNI_DUPLICATE', 'RESPONSE_OUTSIDE_PADRON', 'RESPONSE_DNI_UNLINKED',
    ]))
  })
})
