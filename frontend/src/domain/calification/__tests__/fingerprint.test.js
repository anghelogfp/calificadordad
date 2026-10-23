import { describe, expect, it } from 'vitest'
import { buildCalculationFingerprint } from '../fingerprint'

const KEY = 'ABCDE'.repeat(12)

function input(overrides = {}) {
  return {
    processType: 'simulacro',
    simulacroScope: 'general',
    answersLength: 60,
    correctValue: 10,
    incorrectValue: 0,
    blankValue: 2,
    plantilla: { items: [{ subject: 'Letras', questionCount: 30, ponderation: 1 }, { subject: 'Ciencias', questionCount: 30, ponderation: 2 }] },
    answerKeyRows: [{ area: '', tipo: 'P', answers: KEY }],
    dniCorrections: [],
    archiveRows: [
      { dni: '11111111', paterno: 'A', materno: 'B', nombres: 'Uno' },
      { dni: '22222222', paterno: 'C', materno: 'D', nombres: 'Dos' },
    ],
    responsesRows: [
      { litho: '000001', dni: '11111111', tipo: 'P', answers: KEY },
      { litho: '000002', dni: '22222222', tipo: 'P', answers: ' ' + KEY.slice(1) },
    ],
    ...overrides,
  }
}

const HEX64 = /^[0-9a-f]{64}$/

describe('buildCalculationFingerprint', () => {
  it('produce dos huellas SHA-256 de 64 caracteres', () => {
    const { configSha256, dataSha256 } = buildCalculationFingerprint(input())
    expect(configSha256).toMatch(HEX64)
    expect(dataSha256).toMatch(HEX64)
    expect(configSha256).not.toBe(dataSha256)
  })

  it('es determinista', () => {
    expect(buildCalculationFingerprint(input())).toEqual(buildCalculationFingerprint(input()))
  })

  it('no depende del orden en que se cargaron los datos', () => {
    const base = input()
    const shuffled = input({
      archiveRows: [...base.archiveRows].reverse(),
      responsesRows: [...base.responsesRows].reverse(),
      answerKeyRows: [...base.answerKeyRows].reverse(),
    })
    expect(buildCalculationFingerprint(shuffled)).toEqual(buildCalculationFingerprint(base))
  })

  describe('la huella de configuración cambia si cambia', () => {
    const base = buildCalculationFingerprint(input()).configSha256
    const changed = (overrides) => buildCalculationFingerprint(input(overrides)).configSha256

    it('una letra de la clave', () => {
      expect(changed({ answerKeyRows: [{ area: '', tipo: 'P', answers: 'B' + KEY.slice(1) }] })).not.toBe(base)
    })
    it('un valor de calificación', () => {
      expect(changed({ blankValue: 1 })).not.toBe(base)
      expect(changed({ correctValue: 5 })).not.toBe(base)
      expect(changed({ incorrectValue: -1 })).not.toBe(base)
    })
    it('un peso de la plantilla', () => {
      expect(changed({ plantilla: { items: [{ subject: 'Letras', questionCount: 30, ponderation: 1 }, { subject: 'Ciencias', questionCount: 30, ponderation: 3 }] } })).not.toBe(base)
    })
    it('el orden de la plantilla, porque define qué pregunta pesa cuánto', () => {
      expect(changed({ plantilla: { items: [{ subject: 'Ciencias', questionCount: 30, ponderation: 2 }, { subject: 'Letras', questionCount: 30, ponderation: 1 }] } })).not.toBe(base)
    })
    it('el tipo de proceso', () => {
      expect(changed({ processType: 'real' })).not.toBe(base)
    })
    it('una corrección de DNI confirmada', () => {
      expect(changed({ dniCorrections: [{ litho: '000002', originalDni: '22222229', correctedDni: '22222222' }] })).not.toBe(base)
    })
    it('un espacio en blanco de la clave', () => {
      expect(changed({ answerKeyRows: [{ area: '', tipo: 'P', answers: KEY.slice(0, 59) + ' ' }] })).not.toBe(base)
    })
  })

  describe('la huella de datos cambia si cambia', () => {
    const base = buildCalculationFingerprint(input()).dataSha256
    const changed = (overrides) => buildCalculationFingerprint(input(overrides)).dataSha256

    it('una respuesta de una hoja', () => {
      const rows = input().responsesRows
      rows[0] = { ...rows[0], answers: 'B' + KEY.slice(1) }
      expect(changed({ responsesRows: rows })).not.toBe(base)
    })
    it('un blanco al inicio de una hoja (el desplazamiento que ya nos ocurrió)', () => {
      const rows = input().responsesRows
      rows[1] = { ...rows[1], answers: rows[1].answers.slice(1) }
      expect(changed({ responsesRows: rows })).not.toBe(base)
    })
    it('el DNI de una hoja', () => {
      const rows = input().responsesRows
      rows[0] = { ...rows[0], dni: '33333333' }
      expect(changed({ responsesRows: rows })).not.toBe(base)
    })
    it('un alumno del padrón', () => {
      const rows = input().archiveRows
      rows[0] = { ...rows[0], nombres: 'Otro' }
      expect(changed({ archiveRows: rows })).not.toBe(base)
    })
    it('una hoja más', () => {
      expect(changed({ responsesRows: [...input().responsesRows, { litho: '000003', dni: '', tipo: 'P', answers: KEY }] })).not.toBe(base)
    })
  })

  it('las huellas de datos y de configuración son independientes', () => {
    const a = buildCalculationFingerprint(input())
    const b = buildCalculationFingerprint(input({ blankValue: 1 }))
    expect(b.dataSha256).toBe(a.dataSha256)
    expect(b.configSha256).not.toBe(a.configSha256)

    const rows = input().responsesRows
    rows[0] = { ...rows[0], answers: 'B' + KEY.slice(1) }
    const c = buildCalculationFingerprint(input({ responsesRows: rows }))
    expect(c.configSha256).toBe(a.configSha256)
    expect(c.dataSha256).not.toBe(a.dataSha256)
  })

  it('ignora diferencias irrelevantes de formato (espacios alrededor de los nombres, minúsculas en claves)', () => {
    const a = buildCalculationFingerprint(input())
    const b = buildCalculationFingerprint(input({
      archiveRows: input().archiveRows.map((r) => ({ ...r, paterno: ` ${r.paterno} ` })),
      answerKeyRows: [{ area: ' ', tipo: 'p', answers: KEY.toLowerCase() }],
    }))
    expect(b).toEqual(a)
  })
})
