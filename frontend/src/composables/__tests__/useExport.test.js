import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExport } from '../useExport'

const workbookInstances = []
const saveAsMock = vi.fn()

class FakeCell {
  constructor(value = '') {
    this.value = value
    this.font = {}
    this.fill = {}
    this.alignment = {}
    this.border = {}
  }
}

class FakeRow {
  constructor(values = []) {
    this.values = values
    this.cells = values.map((value) => new FakeCell(value))
  }

  eachCell(callback) {
    this.cells.forEach((cell, index) => callback(cell, index + 1))
  }

  getCell(index) {
    if (!this.cells[index - 1]) this.cells[index - 1] = new FakeCell()
    return this.cells[index - 1]
  }
}

class FakeWorksheet {
  constructor(name) {
    this.name = name
    this.rows = []
    this.columns = []
    this.views = []
    this.autoFilter = ''
    this.cells = new Map()
  }

  mergeCells() {}

  getCell(address) {
    if (!this.cells.has(address)) this.cells.set(address, new FakeCell())
    return this.cells.get(address)
  }

  addRow(values = []) {
    const row = new FakeRow(values)
    this.rows.push(row)
    return row
  }

  getColumn() {
    return { width: 0, font: {}, alignment: {} }
  }

  eachRow(callback) {
    this.rows.forEach((row, index) => callback(row, index + 1))
  }
}

class FakeWorkbook {
  constructor() {
    this.sheets = []
    this.xlsx = {
      writeBuffer: vi.fn(async () => new ArrayBuffer(8)),
    }
    workbookInstances.push(this)
  }

  addWorksheet(name) {
    const sheet = new FakeWorksheet(name)
    this.sheets.push(sheet)
    return sheet
  }
}

vi.mock('exceljs', () => ({
  default: {
    Workbook: FakeWorkbook,
  },
}))

vi.mock('file-saver', () => ({
  saveAs: saveAsMock,
}))

beforeEach(() => {
  workbookInstances.length = 0
  saveAsMock.mockClear()
})

describe('useExport.exportScoresToExcel', () => {
  it('exporta marcas múltiples en columna propia y no como blanco', async () => {
    const exporter = useExport()

    await exporter.exportScoresToExcel([
      {
        position: 1,
        dni: '12345678',
        paterno: 'Paterno',
        materno: 'Materno',
        nombres: 'Nombre',
        area: 'Ingeniería',
        programa: '',
        tipo: 'P',
        aula: '101',
        litho: '076279',
        score: 12,
        answersRaw: 'A* ',
        correctAnswersRaw: 'ABC',
      },
    ], 'Simulacro', {
      processType: 'simulacro',
      area: 'Ingeniería',
      areaSummary: {
        timestamp: '2026-07-01T12:00:00.000Z',
        plantillaName: 'General',
        correctValue: 10,
        incorrectValue: -1,
        blankValue: 2,
        answersLength: 3,
        totalWeight: 3,
        totalCandidates: 1,
      },
      areaStats: { max: 12, min: 12, avg: 12 },
    })

    const workbook = workbookInstances[0]
    const resultsSheet = workbook.sheets.find((sheet) => sheet.name === 'Resultados INGENIERÍAS')
    const observationsSheet = workbook.sheets.find((sheet) => sheet.name === 'Observaciones')

    const header = resultsSheet.rows.find((row) => row.values.includes('Múltiples')).values
    const data = resultsSheet.rows.find((row) => row.values.includes('12345678')).values
    expect(header).toEqual(expect.arrayContaining([
      'Correctas',
      'Incorrectas',
      'Múltiples',
      'En blanco',
      'Longitud',
      'Respuestas DAT',
      'Respuestas visibles',
    ]))
    expect(header).not.toContain('Programa')
    expect(data.slice(10, 14)).toEqual([1, 0, 1, 1])
    expect(data[14]).toBe(3)
    expect(data[15]).toBe('A* ')
    expect(data[16]).toBe('A*·')

    const multipleObservation = observationsSheet.rows.find((row) =>
      row.values[0] === 'Marcas múltiples/anuladas (*)'
    )
    expect(multipleObservation.values[1]).toBe(1)
    expect(saveAsMock).toHaveBeenCalledOnce()
  })

  it('exporta todo el simulacro por áreas en un solo libro', async () => {
    const exporter = useExport()

    await exporter.exportSimulacroAreasToExcel({
      Ingeniería: {
        results: [{
          position: 1,
          dni: '11111111',
          paterno: 'Uno',
          materno: '',
          nombres: 'Ing',
          area: 'Ingeniería',
          programa: '',
          tipo: 'P',
          aula: '101',
          litho: '000001',
          score: 18,
          answersRaw: 'A'.repeat(3),
          correctAnswersRaw: 'A'.repeat(3),
        }],
        summary: {
          totalCandidates: 2,
          missingResponses: 1,
          noCalificados: [{ dni: '99999999', area: 'Ingeniería', motivo: 'Sin respuesta .dat' }],
        },
      },
      Sociales: {
        results: [{
          position: 1,
          dni: '22222222',
          paterno: 'Dos',
          materno: '',
          nombres: 'Soc',
          area: 'Sociales',
          programa: '',
          tipo: 'Q',
          aula: '102',
          litho: '000002',
          score: 16,
          answersRaw: 'A* ',
          correctAnswersRaw: 'ABC',
        }],
        summary: {
          totalCandidates: 1,
          noCalificados: [],
        },
      },
    }, 'Simulacro', {
      statsByArea: new Map([
        ['Ingeniería', { max: 18, min: 18, avg: 18 }],
        ['Sociales', { max: 16, min: 16, avg: 16 }],
      ]),
    })

    const workbook = workbookInstances[0]
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual([
      'Resumen general',
      'Resultados INGENIERÍAS',
      'Resultados SOCIALES',
      'Observaciones',
      'No calificados',
    ])

    const summarySheet = workbook.sheets.find((sheet) => sheet.name === 'Resumen general')
    expect(summarySheet.rows.some((row) => row.values.includes('INGENIERÍAS'))).toBe(true)
    expect(summarySheet.rows.some((row) => row.values.includes('SOCIALES'))).toBe(true)

    const resultsSheet = workbook.sheets.find((sheet) => sheet.name === 'Resultados INGENIERÍAS')
    const header = resultsSheet.rows.find((row) => row.values.includes('Puntaje')).values
    expect(header).not.toContain('Programa')
    expect(resultsSheet.cells.get('A1').value).toContain('Simulacro')

    const noCalificadosSheet = workbook.sheets.find((sheet) => sheet.name === 'No calificados')
    const observationsSheet = workbook.sheets.find((sheet) => sheet.name === 'Observaciones')
    expect(noCalificadosSheet.rows[0].values).not.toContain('Programa')
    expect(observationsSheet.rows.some((row) =>
      row.values[0] === 'SOCIALES' && row.values[1] === 'Marcas múltiples/anuladas (*)' && row.values[2] === 1
    )).toBe(true)
    expect(noCalificadosSheet.rows.some((row) => row.values.includes('99999999'))).toBe(true)
    expect(saveAsMock).toHaveBeenCalledOnce()
    expect(saveAsMock.mock.calls[0][1]).toContain('simulacro-resultados-todo')
  })
})
