import { describe, it, expect } from 'vitest'
import {
  createIdentifierRow,
  buildIdentifierObservation,
  parseIdentifierLine,
  createResponseRow,
  buildResponseObservation,
  parseResponseLine,
  parseAnswerKeyResponseLine,
  detectResponseAnswersOffset,
  readLinesFromFile,
} from '../parsers'
import { DEFAULT_DAT_FORMAT } from '@/constants'

const HEADER = '123456789012345678901'

function buildDatLine({ examCode = '2024', folio = '77', indicator = 'A', payload = '' } = {}) {
  return `${HEADER}${examCode}#${folio}${indicator}${payload}`
}

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

describe('parseIdentifierLine', () => {
  it('parsea una línea válida de identificadores', () => {
    const answers = 'ABCDE'.repeat(12)
    const line = buildDatLine({
      payload: `654321P12345678001${answers}`,
    })

    const result = parseIdentifierLine(line, 1)

    expect(result.error).toBeUndefined()
    expect(result.row).toMatchObject({
      rawLine: line,
      header: HEADER,
      lectura: '456789',
      examCode: '2024',
      folio: '77',
      indicator: 'A',
      litho: '654321',
      tipo: 'P',
      dni: '12345678',
      aula: '001',
      answers,
      observaciones: 'Sin observaciones',
    })
  })

  it('preserva espacios en respuestas de identificadores para conteo visual', () => {
    const answers = `${'A'.repeat(58)}  `
    const line = buildDatLine({
      payload: `654321P12345678001${answers}`,
    })

    const result = parseIdentifierLine(line, 1)

    expect(result.row.answers).toBe(answers)
    expect(result.row.answers).toHaveLength(60)
  })

  it('retorna null para líneas vacías o de relleno', () => {
    expect(parseIdentifierLine('', 1)).toBeNull()
    expect(parseIdentifierLine(' ', 2)).toBeNull()
    expect(parseIdentifierLine('x', 3)).toBeNull()
  })

  it('reporta errores estructurales de cabecera y longitud', () => {
    expect(parseIdentifierLine('123', 1).error).toContain('longitud insuficiente')

    const line = `ABC4567890123456789012024#77A654321P12345678001${'A'.repeat(60)}`
    expect(parseIdentifierLine(line, 2).error).toContain('cabecera inválida')
  })

  it('reporta partes obligatorias ausentes', () => {
    expect(parseIdentifierLine(`${HEADER}ABCD#77A${'A'.repeat(40)}`, 1).error)
      .toContain('código de examen no encontrado')
    expect(parseIdentifierLine(`${HEADER}2024 A${'A'.repeat(40)}`, 2).error)
      .toContain('folio')
    expect(parseIdentifierLine(`${HEADER}2024#77${' '.repeat(40)}`, 3).error)
      .toContain('indicador')
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

  it('detecta blancos finales asumidos cuando la línea de respuestas es corta', () => {
    const row = {
      answers: 'ABCD',
      dni: '12345678',
      tipo: 'P',
      litho: '123456',
    }
    const obs = buildResponseObservation(row, DEFAULT_DAT_FORMAT)
    expect(obs).toContain('Blancos finales asumidos (56)')
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

describe('parseResponseLine', () => {
  it('parsea respuestas con offset por defecto', () => {
    const answers = 'ABCDE'.repeat(12)
    const line = buildDatLine({
      payload: `654321P${answers}`,
    })

    const result = parseResponseLine(line, 1)

    expect(result.error).toBeUndefined()
    expect(result.row).toMatchObject({
      header: HEADER,
      lectura: '456789',
      examCode: '2024',
      folio: '77',
      indicator: 'A',
      litho: '654321',
      tipo: 'P',
      answers,
    })
    expect(result.row.observaciones).toContain('DNI no vinculado')
  })

  it('respeta responseAnswersOffset custom', () => {
    const answers = 'B'.repeat(60)
    const formatConfig = {
      ...DEFAULT_DAT_FORMAT,
      responseAnswersOffset: 18,
    }
    const line = buildDatLine({
      payload: `654321P12345678001${answers}`,
    })

    const result = parseResponseLine(line, 1, formatConfig)

    expect(result.row.litho).toBe('654321')
    expect(result.row.tipo).toBe('P')
    expect(result.row.answers).toBe(answers)
  })

  it('reporta errores estructurales', () => {
    expect(parseResponseLine('123', 1).error).toContain('longitud insuficiente')

    const line = `ABC4567890123456789012024#77A654321P${'A'.repeat(60)}`
    expect(parseResponseLine(line, 2).error).toContain('cabecera inválida')
  })
})

describe('parseAnswerKeyResponseLine', () => {
  it('parsea clave sin tipo leyendo respuestas desde despues del litho', () => {
    const answers = 'BCCCBCADBACABCABBDACBBCABBABCCBBABBCBCECABABCECDBCBCBAABBCDB'
    const line = buildDatLine({
      payload: `039090${answers}`,
    })

    const result = parseAnswerKeyResponseLine(line, 1)

    expect(result.error).toBeUndefined()
    expect(result.row.litho).toBe('039090')
    expect(result.row.tipo).toBe('')
    expect(result.row.answers).toBe(answers)
    expect(result.row.answers).toHaveLength(60)
  })

  it('mantiene tipo cuando la clave trae litho, tipo y respuestas', () => {
    const answers = 'A'.repeat(60)
    const line = buildDatLine({
      payload: `039090P${answers}`,
    })

    const result = parseAnswerKeyResponseLine(line, 1)

    expect(result.row.litho).toBe('039090')
    expect(result.row.tipo).toBe('P')
    expect(result.row.answers).toBe(answers)
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

  it('detecta el offset cuando las respuestas empiezan después de litho y tipo', () => {
    const lines = [
      buildDatLine({ payload: `111111P${'A'.repeat(60)}` }),
      buildDatLine({ payload: `222222Q${'B'.repeat(60)}` }),
      buildDatLine({ payload: `333333R${'C'.repeat(60)}` }),
    ]

    const result = detectResponseAnswersOffset(lines, DEFAULT_DAT_FORMAT)

    expect(result.offset).toBe(7)
    expect(result.answerPct).toBeGreaterThan(0.95)
    expect(result.digitPct).toBe(0)
  })
})

describe('readLinesFromFile', () => {
  it('normaliza saltos de línea y elimina fin de archivo DOS', async () => {
    const parsed = []
    const file = {
      text: async () => `uno\r\ndos\rtres\u001a\n`,
    }

    const results = await readLinesFromFile(file, (line, lineNumber) => {
      if (!line) return null
      parsed.push([lineNumber, line])
      return { row: { lineNumber, line } }
    })

    expect(parsed).toEqual([
      [1, 'uno'],
      [2, 'dos'],
      [3, 'tres'],
    ])
    expect(results.map((item) => item.row.line)).toEqual(['uno', 'dos', 'tres'])
  })
})
