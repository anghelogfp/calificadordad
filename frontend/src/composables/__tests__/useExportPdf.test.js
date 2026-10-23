import { beforeEach, describe, expect, it, vi } from 'vitest'

const autoTableCalls = []

function makeFakeDoc() {
  const base = {
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      getNumberOfPages: () => 1,
    },
    lastAutoTable: { finalY: 100 },
    getTextWidth: () => 10,
    splitTextToSize: (text) => [text],
  }
  return new Proxy(base, {
    get: (target, prop) => (prop in target ? target[prop] : () => {}),
  })
}

vi.mock('@/utils/exportLoaders', () => ({
  loadExcelExportDeps: vi.fn(),
  loadPdfExportDeps: vi.fn(async () => ({
    jsPDF: function FakePdf() { return makeFakeDoc() },
    autoTable: (_doc, options) => { autoTableCalls.push(options) },
  })),
}))

const { useExport } = await import('../useExport')

const row = (position, dni, extra = {}) => ({
  position, dni, paterno: 'P', materno: 'M', nombres: 'N', area: 'General', programa: '',
  score: 100, answersRaw: 'A', ...extra,
})

const summary = { timestamp: '2026-10-22T12:00:00.000Z', plantillaName: 'Sociales', correctValue: 10, incorrectValue: 0, blankValue: 2 }

function dniCells() {
  return autoTableCalls.flatMap((call) => (call.body || []).map((cells) => cells[1]))
}

beforeEach(() => { autoTableCalls.length = 0 })

describe('PDF de resultados y la marca de DNI corregido', () => {
  it('identifica en la celda del DNI a las hojas corregidas y confirmadas', async () => {
    const exporter = useExport()

    await exporter.exportScoresToPdf(
      [row(1, '11111111'), row(2, '63737500', { dniCorregido: true, dniOriginal: '63735500' })],
      { statsByArea: new Map() },
      'Simulacro',
      { processType: 'simulacro', area: 'General', areaSummary: summary },
    )

    expect(dniCells()).toEqual(['11111111', '63737500 (corregido)'])
  })

  it('no agrega nada cuando no hay correcciones', async () => {
    const exporter = useExport()

    await exporter.exportScoresToPdf(
      [row(1, '11111111'), row(2, '22222222')],
      { statsByArea: new Map() },
      'Simulacro',
      { processType: 'simulacro', area: 'General', areaSummary: summary },
    )

    expect(dniCells()).toEqual(['11111111', '22222222'])
  })

  it('también lo marca en el PDF de todo el simulacro', async () => {
    const exporter = useExport()

    await exporter.exportSimulacroAreasToPdf(
      { General: { summary, results: [row(1, '63737500', { dniCorregido: true, dniOriginal: '63735500' })] } },
      'Simulacro',
      { statsByArea: new Map() },
    )

    expect(dniCells()).toContain('63737500 (corregido)')
  })
})
