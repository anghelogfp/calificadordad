import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

// Regresión: exceljs 3.x fallaba con "Unexpected xml node in parseClose: filters"
// al leer padrones exportados con una tabla que tiene filtros aplicados.
async function buildWorkbookWithFilteredTable() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Padron')
  sheet.addTable({
    name: 'Estudiantes',
    ref: 'A1',
    headerRow: true,
    columns: [{ name: 'DNI' }, { name: 'NOMBRES' }],
    rows: [
      ['78415016', 'NICOLL'],
      ['63735500', 'JUAN'],
    ],
  })
  const buffer = await workbook.xlsx.writeBuffer()

  const zip = await JSZip.loadAsync(buffer)
  const tablePath = Object.keys(zip.files).find((name) => /xl\/tables\/table\d+\.xml$/.test(name))
  const xml = await zip.file(tablePath).async('string')
  const filtered = xml.replace(
    /<filterColumn colId="0"[^>]*\/>/,
    '<filterColumn colId="0"><filters><filter val="78415016"/></filters></filterColumn>',
  )
  expect(filtered).toContain('<filters>')
  zip.file(tablePath, filtered)
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('lectura de padrón con tabla filtrada', () => {
  it('abre el libro y conserva las filas', async () => {
    const buffer = await buildWorkbookWithFilteredTable()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.getRow(2).getCell(1).value).toBe('78415016')
    expect(sheet.getRow(3).getCell(2).value).toBe('JUAN')
  })
})
