import { describe, it, expect } from 'vitest'
import {
  createIdentifierRow,
  buildIdentifierObservation,
  createResponseRow,
  buildResponseObservation,
  detectResponseAnswersOffset,
} from '../parsers'
import { DEFAULT_DAT_FORMAT } from '@/constants'

describe('createIdentifierRow', () => {
  it('crea fila con valores por defecto', () => {
    const row = createIdentifierRow()
    expect(row.id).toBeTruthy()
    expect(row.dni).toBe('')
    expect(row.litho).toBe('')
    expect(row.tipo).toBe('')
    expect(row.aula).toBe('')
    expect(row.observaciones).toBe('Sin observaciones')
  })

  it('acepta datos iniciales', () => {
    const row = createIdentifierRow({
      dni: '12345678',
      litho: '001',
      tipo: 'P',
    })
    expect(row.dni).toBe('12345678')
    expect(row.litho).toBe('001')
    expect(row.tipo).toBe('P')
  })

  it('genera id único', () => {
    const row1 = createIdentifierRow()
    const row2 = createIdentifierRow()
    expect(row1.id).not.toBe(row2.id)
  })
})

describe('buildIdentifierObservation', () => {
  it('sin observaciones para fila válida', () => {
    const row = {
      litho: '123456',
      tipo: 'P',
      dni: '12345678',
      aula: 'A101',
    }
    expect(buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)).toBe('Sin observaciones')
  })

  it('detecta litho incompleto', () => {
    const row = {
      litho: '123',
      tipo: 'P',
      dni: '12345678',
      aula: 'A101',
    }
    const obs = buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs).toContain('Litho incompleto')
  })

  it('detecta litho vacío', () => {
    const row = {
      litho: '',
      tipo: 'P',
      dni: '12345678',
      aula: 'A101',
    }
    expect(buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)).toContain('Litho sin marcar')
  })

  it('detecta tipo sin marcar', () => {
    const row = {
      litho: '123456',
      tipo: '',
      dni: '12345678',
      aula: 'A101',
    }
    expect(buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)).toContain('Tipo sin marcar')
  })

  it('detecta DNI incompleto', () => {
    const row = {
      litho: '123456',
      tipo: 'P',
      dni: '1234',
      aula: 'A101',
    }
    expect(buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)).toContain('DNI incompleto')
  })

  it('detecta aula incompleto', () => {
    const row = {
      litho: '123456',
      tipo: 'P',
      dni: '12345678',
      aula: 'A1',
    }
    const obs = buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs).toContain('Aula incomplet')
  })

  it('acumula múltiples observaciones', () => {
    const row = {
      litho: '',
      tipo: '',
      dni: '1234',
      aula: '',
    }
    const obs = buildIdentifierObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs.split(' · ').length).toBe(4)
  })
})

describe('createResponseRow', () => {
  it('crea fila con valores por defecto', () => {
    const row = createResponseRow()
    expect(row.id).toBeTruthy()
    expect(row.answers).toBe('')
    expect(row.observaciones).toBe('Sin observaciones')
  })

  it('acepta datos iniciales', () => {
    const row = createResponseRow({
      litho: '001',
      answers: 'ABCD',
    })
    expect(row.litho).toBe('001')
    expect(row.answers).toBe('ABCD')
  })
})

describe('buildResponseObservation', () => {
  it('sin observaciones para fila válida', () => {
    const row = {
      answers: 'A'.repeat(60),
      dni: '12345678',
      tipo: 'P',
      litho: '123456',
    }
    expect(buildResponseObservation(row, DEFAULT_DAT_FORMAT)).toBe('Sin observaciones')
  })

  it('detecta respuestas con caracteres inválidos', () => {
    const row = {
      answers: 'AAAAACCCCCEEEEEWWWWWIIIII00000BBBBBFFFFFGGGGGHHHHHIIIIIJJJJJ',
      dni: '12345678',
      tipo: 'P',
      litho: '123456',
    }
    const obs = buildResponseObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs).toContain('Respuestas con marcas no válidas')
  })

  it('detecta respuestas muy cortas', () => {
    const row = {
      answers: 'ABCD',
      dni: '12345678',
      tipo: 'P',
      litho: '123456',
    }
    const obs = buildResponseObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs).toContain('Cadena incompleta')
  })

  it('detecta respuestas vacías', () => {
    const row = {
      answers: '',
      dni: '12345678',
      tipo: 'P',
      litho: '123456',
    }
    expect(buildResponseObservation(row, DEFAULT_DAT_FORMAT)).toContain('Sin respuestas marcadas')
  })
})

describe('detectResponseAnswersOffset', () => {
  it('devuelve null si hay menos de 3 líneas válidas', () => {
    const lines = ['only one short line']
    expect(detectResponseAnswersOffset(lines, DEFAULT_DAT_FORMAT)).toBeNull()
  })

  it('devuelve null para líneas sin patrón claro (muy cortas)', () => {
    const lines = ['short line', 'also short']
    expect(detectResponseAnswersOffset(lines, DEFAULT_DAT_FORMAT)).toBeNull()
  })

  it('maneja líneas vacías', () => {
    const lines = ['', '', '']
    expect(detectResponseAnswersOffset(lines, DEFAULT_DAT_FORMAT)).toBeNull()
  })
})