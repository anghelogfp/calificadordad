import { describe, it, expect } from 'vitest'
import {
  buildDniCounts,
  getCandidateDniIssue,
  getExactAnswerKey,
  REAL_TEST_TYPES,
  GENERAL_SIMULACRO_AREA,
} from '../../utils/calificationHelpers'

describe('buildDniCounts', () => {
  it('cuenta DNIs correctamente', () => {
    const rows = [
      { dni: '12345678' },
      { dni: '87654321' },
      { dni: '12345678' },
    ]
    const counts = buildDniCounts(rows)
    expect(counts.get('12345678')).toBe(2)
    expect(counts.get('87654321')).toBe(1)
  })

  it('ignora DNIs vacíos o inválidos', () => {
    const rows = [
      { dni: '' },
      { dni: null },
      { dni: '12345678' },
      { dni: 'abc' },
    ]
    const counts = buildDniCounts(rows)
    expect(counts.has('')).toBe(false)
    expect(counts.has('abc')).toBe(false)
    expect(counts.get('12345678')).toBe(1)
  })

  it('maneja filas sin propiedad dni', () => {
    const counts = buildDniCounts([{}, { dni: '12345678' }])
    expect(counts.get('12345678')).toBe(1)
  })

  it('retorna map vacío para array vacío', () => {
    expect(buildDniCounts([]).size).toBe(0)
  })

  it('extrae solo dígitos del DNI', () => {
    const rows = [{ dni: 'ABC12345678XYZ' }]
    const counts = buildDniCounts(rows)
    expect(counts.get('12345678')).toBe(1)
  })
})

describe('getCandidateDniIssue', () => {
  it('retorna string vacío para DNI válido', () => {
    const dniCounts = new Map([['12345678', 1]])
    expect(getCandidateDniIssue({ dni: '12345678' }, dniCounts)).toBe('')
  })

  it('detecta DNI vacío', () => {
    expect(getCandidateDniIssue({ dni: '' }, new Map())).toBe('DNI vacío')
    expect(getCandidateDniIssue({ dni: null }, new Map())).toBe('DNI vacío')
    expect(getCandidateDniIssue({ dni: undefined }, new Map())).toBe('DNI vacío')
  })

  it('detecta DNI incompleto', () => {
    expect(getCandidateDniIssue({ dni: '1234' }, new Map())).toBe('DNI incompleto (4/8)')
    expect(getCandidateDniIssue({ dni: '1234567' }, new Map())).toBe('DNI incompleto (7/8)')
  })

  it('detecta DNI duplicado', () => {
    const dniCounts = new Map([['12345678', 2]])
    expect(getCandidateDniIssue({ dni: '12345678' }, dniCounts)).toBe('DNI duplicado')
  })

  it('solo cuenta duplicados si es > 1', () => {
    const dniCounts = new Map([['12345678', 1]])
    expect(getCandidateDniIssue({ dni: '12345678' }, dniCounts)).toBe('')
  })

  it('maneja filas sin propiedad dni', () => {
    expect(getCandidateDniIssue({}, new Map())).toBe('DNI vacío')
  })
})

describe('getExactAnswerKey', () => {
  const rows = [
    { area: 'Biomédicas', tipo: 'P' },
    { area: 'Biomédicas', tipo: 'Q' },
    { area: 'Sociales', tipo: 'P' },
    { area: 'Ingeniería', tipo: 'P' },
    { area: '', tipo: 'P' },
  ]
  const areaList = ['Biomédicas', 'Sociales', 'Ingeniería']

  it('encuentra clave exacta por área y tipo', () => {
    const result = getExactAnswerKey(rows, 'Biomédicas', 'P', areaList)
    expect(result).toEqual({ area: 'Biomédicas', tipo: 'P' })
  })

  it('normaliza área y tipo', () => {
    const result = getExactAnswerKey(rows, 'biomedicas', 'p', areaList)
    expect(result).toEqual({ area: 'Biomédicas', tipo: 'P' })
  })

  it('devuelve undefined si no hay tipo', () => {
    expect(getExactAnswerKey(rows, 'Biomédicas', '', areaList)).toBeUndefined()
    expect(getExactAnswerKey(rows, 'Biomédicas', null, areaList)).toBeUndefined()
  })

  it('devuelve undefined si el tipo no coincide', () => {
    expect(getExactAnswerKey(rows, 'Biomédicas', 'X', areaList)).toBeUndefined()
  })

  it('devuelve undefined si solo coincide el área', () => {
    expect(getExactAnswerKey(rows, 'Sociales', 'X', areaList)).toBeUndefined()
  })

  it('ignora filas sin área', () => {
    const result = getExactAnswerKey(rows, 'Biomédicas', 'P', areaList)
    expect(result.area).toBeTruthy()
  })
})

describe('REAL_TEST_TYPES', () => {
  it('contiene los 5 tipos de prueba real', () => {
    expect(REAL_TEST_TYPES).toEqual(['P', 'Q', 'R', 'S', 'T'])
  })
})

describe('GENERAL_SIMULACRO_AREA', () => {
  it('es "General"', () => {
    expect(GENERAL_SIMULACRO_AREA).toBe('General')
  })
})