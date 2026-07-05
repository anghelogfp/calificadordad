import { describe, it, expect } from 'vitest'
import {
  removeDiacritics,
  stripDigits,
  removeWhitespace,
  normalize,
  normalizeArea,
  normalizeAreaStrict,
  buildResponseMatchKey,
  buildUniqueLithoLookup,
  buildAreaTipoKey,
  buildPonderationKey,
  classifyAnswerChar,
} from '../helpers'

describe('removeDiacritics', () => {
  it('elimina tildes', () => {
    expect(removeDiacritics('Biomédicas')).toBe('Biomedicas')
    expect(removeDiacritics('ión')).toBe('ion')
  })

  it('maneja valores nulos', () => {
    expect(removeDiacritics(null)).toBe('')
    expect(removeDiacritics('')).toBe('')
  })
})

describe('stripDigits', () => {
  it('extrae solo dígitos', () => {
    expect(stripDigits('ABC123DEF')).toBe('123')
    expect(stripDigits('dni: 12345678')).toBe('12345678')
    expect(stripDigits('87654321')).toBe('87654321')
  })

  it('retorna string vacío si no hay dígitos', () => {
    expect(stripDigits('abc')).toBe('')
    expect(stripDigits('')).toBe('')
    expect(stripDigits(null)).toBe('')
  })

  it('maneja strings con solo números', () => {
    expect(stripDigits('12345678')).toBe('12345678')
  })
})

describe('removeWhitespace', () => {
  it('elimina espacios en blanco', () => {
    expect(removeWhitespace('hola mundo')).toBe('holamundo')
    expect(removeWhitespace('a b c')).toBe('abc')
  })
})

describe('normalize', () => {
  it('normaliza con minúsculas y sin tildes', () => {
    expect(normalize('Biomédicas')).toBe('biomedicas')
    expect(normalize('IÓN')).toBe('ion')
    expect(normalize('  Hola  ')).toBe('hola')
  })
})

describe('normalizeArea', () => {
  const areas = ['BIOMÉDICAS', 'SOCIALES', 'INGENIERÍAS']

  it('encuentra coincidencia exacta', () => {
    expect(normalizeArea('Biomédicas', areas)).toBe('BIOMÉDICAS')
    expect(normalizeArea('Sociales', areas)).toBe('SOCIALES')
  })

  it('normaliza con tildes', () => {
    expect(normalizeArea('Biomedicas', areas)).toBe('BIOMÉDICAS')
    expect(normalizeArea('Ingenieria', areas)).toBe('INGENIERÍAS')
  })

  it('devuelve primera área si no hay match', () => {
    expect(normalizeArea('Desconocida', areas)).toBe('BIOMÉDICAS')
    expect(normalizeArea('', areas)).toBe('BIOMÉDICAS')
    expect(normalizeArea(null, areas)).toBe('BIOMÉDICAS')
  })

  it('normaliza a minúsculas', () => {
    expect(normalizeArea('BIOMÉDICAS', areas)).toBe('BIOMÉDICAS')
  })
})

describe('normalizeAreaStrict', () => {
  const areas = ['BIOMÉDICAS', 'SOCIALES', 'INGENIERÍAS']

  it('normaliza solo áreas conocidas', () => {
    expect(normalizeAreaStrict('Biomedicas', areas)).toBe('BIOMÉDICAS')
    expect(normalizeAreaStrict('Ingenieria', areas)).toBe('INGENIERÍAS')
  })

  it('no asume la primera área si no hay match', () => {
    expect(normalizeAreaStrict('Desconocida', areas)).toBe('')
    expect(normalizeAreaStrict('', areas)).toBe('')
    expect(normalizeAreaStrict(null, areas)).toBe('')
  })
})

describe('buildResponseMatchKey', () => {
  it('construye clave con litho, indicator y folio', () => {
    expect(buildResponseMatchKey({ litho: '123', indicator: 'A', folio: '1' })).toBe('123|A|1')
    expect(buildResponseMatchKey({ litho: '456', indicator: 'B', folio: '99' })).toBe('456|B|99')
  })

  it('solo extrae dígitos del litho', () => {
    expect(buildResponseMatchKey({ litho: 'ABC123XYZ', indicator: 'A', folio: '1' })).toBe('123|A|1')
  })

  it('maneja valores faltantes', () => {
    expect(buildResponseMatchKey({ litho: '', indicator: '', folio: '' })).toBe('||')
  })
})

describe('buildUniqueLithoLookup', () => {
  it('devuelve la fila solo cuando el litho es único', () => {
    const row = { litho: 'ABC123' }
    const lookup = buildUniqueLithoLookup([row, { litho: '456' }])

    expect(lookup.get('123')).toBe(row)
    expect(lookup.get('456')).toEqual({ litho: '456' })
  })

  it('marca lithos duplicados como ambiguos', () => {
    const lookup = buildUniqueLithoLookup([
      { litho: '123456', dni: '11111111' },
      { litho: '123456', dni: '22222222' },
    ])

    expect(lookup.has('123456')).toBe(true)
    expect(lookup.get('123456')).toBeNull()
  })
})

describe('buildAreaTipoKey', () => {
  const areas = ['BIOMÉDICAS', 'SOCIALES', 'INGENIERÍAS']

  it('construye clave con área y tipo normalizados', () => {
    expect(buildAreaTipoKey('Biomédicas', 'P', areas)).toBe('BIOMÉDICAS|P')
    expect(buildAreaTipoKey('biomedicas', 'p', areas)).toBe('BIOMÉDICAS|P')
  })

  it('devuelve string vacío si no hay tipo', () => {
    expect(buildAreaTipoKey('Biomédicas', '', areas)).toBe('')
    expect(buildAreaTipoKey('Biomédicas', null, areas)).toBe('')
  })
})

describe('buildPonderationKey', () => {
  const areas = ['BIOMÉDICAS', 'SOCIALES']

  it('construye clave única para área y materia', () => {
    expect(buildPonderationKey('Biomédicas', 'Matemáticas', areas)).toBe('BIOMÉDICAS|matematicas')
    expect(buildPonderationKey('Sociales', 'Historia', areas)).toBe('SOCIALES|historia')
  })
})

describe('classifyAnswerChar', () => {
  it('clasifica A-E como opción', () => {
    expect(classifyAnswerChar('A')).toBe('option')
    expect(classifyAnswerChar('e')).toBe('option')
    expect(classifyAnswerChar('C')).toBe('option')
  })

  it('clasifica otros caracteres como blank', () => {
    expect(classifyAnswerChar(' ')).toBe('blank')
    expect(classifyAnswerChar('X')).toBe('blank')
    expect(classifyAnswerChar('')).toBe('blank')
    expect(classifyAnswerChar(null)).toBe('blank')
  })

  it('clasifica asterisco como marca múltiple', () => {
    expect(classifyAnswerChar('*')).toBe('multiple')
  })

  it('clasifica espacios en blanco y tabs como blank', () => {
    expect(classifyAnswerChar('\t')).toBe('blank')
    expect(classifyAnswerChar('\n')).toBe('blank')
  })
})
