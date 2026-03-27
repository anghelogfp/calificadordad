import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Composable para exportar resultados a Excel y PDF
 */
export function useExport() {
  function buildFilename(prefix, convocatoriaName, area, ext) {
    const date = new Date().toISOString().slice(0, 10)
    const safeName = (convocatoriaName || 'resultados').replace(/[^a-z0-9_-]/gi, '_')
    const safeArea = (area || 'todas').replace(/[^a-z0-9_-]/gi, '_')
    return `${prefix}-${safeName}-${safeArea}-${date}.${ext}`
  }

  async function exportScoresToExcel(rankedResults, convocatoriaName = '') {
    if (!rankedResults?.length) return

    const workbook = new ExcelJS.Workbook()

    // Agrupar por área
    const byArea = new Map()
    rankedResults.forEach((row) => {
      if (!byArea.has(row.area)) byArea.set(row.area, [])
      byArea.get(row.area).push(row)
    })

    byArea.forEach((rows, area) => {
      const sheet = workbook.addWorksheet(area)

      // Encabezado institucional
      sheet.mergeCells('A1:H1')
      sheet.getCell('A1').value = 'Universidad Nacional del Altiplano - Puno'
      sheet.getCell('A1').font = { bold: true, size: 14 }
      sheet.getCell('A1').alignment = { horizontal: 'center' }

      sheet.mergeCells('A2:H2')
      sheet.getCell('A2').value = `Resultados de Calificación - ${convocatoriaName} - Área: ${area}`
      sheet.getCell('A2').font = { size: 11 }
      sheet.getCell('A2').alignment = { horizontal: 'center' }

      sheet.addRow([])

      // Cabeceras
      const headerRow = sheet.addRow([
        'Posición', 'DNI', 'Apellido Paterno', 'Apellido Materno', 'Nombres',
        'Área', 'Puntaje', 'Estado',
      ])
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A5F' },
        }
        cell.alignment = { horizontal: 'center' }
      })

      // Datos
      rows.forEach((row) => {
        const dataRow = sheet.addRow([
          row.position,
          row.dni,
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          row.area,
          row.score,
          row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE',
        ])

        if (row.isIngresante) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD4EDDA' },
            }
          })
        }

        // Score en negrita
        dataRow.getCell(7).font = { bold: true }
        // Estado con color
        const estadoCell = dataRow.getCell(8)
        estadoCell.font = {
          bold: true,
          color: { argb: row.isIngresante ? 'FF155724' : 'FF721C24' },
        }
      })

      // Anchos de columna
      sheet.columns = [
        { width: 10 }, { width: 12 }, { width: 20 }, { width: 20 }, { width: 25 },
        { width: 15 }, { width: 12 }, { width: 16 },
      ]
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, buildFilename('resultados', convocatoriaName, 'todas', 'xlsx'))
  }

  async function exportScoresToPdf(rankedResults, summary, convocatoriaName = '') {
    if (!rankedResults?.length) return

    // Agrupar por área
    const byArea = new Map()
    rankedResults.forEach((row) => {
      if (!byArea.has(row.area)) byArea.set(row.area, [])
      byArea.get(row.area).push(row)
    })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    let isFirst = true

    byArea.forEach((rows, area) => {
      if (!isFirst) doc.addPage()
      isFirst = false

      const date = new Date().toLocaleDateString('es-PE')
      const areaStats = summary?.statsByArea?.get(area)

      // Encabezado
      doc.setFontSize(14)
      doc.setTextColor(30, 58, 95)
      doc.text('Universidad Nacional del Altiplano - Puno', 105, 15, { align: 'center' })
      doc.setFontSize(11)
      doc.text(`Resultados de Calificación - ${convocatoriaName}`, 105, 22, { align: 'center' })
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Área: ${area}  |  Fecha: ${date}  |  Total: ${rows.length}`, 105, 29, { align: 'center' })

      if (areaStats) {
        doc.text(
          `Ingresantes: ${areaStats.ingresantes}  |  Promedio: ${areaStats.avg}  |  Máx: ${areaStats.max}  |  Mín: ${areaStats.min}`,
          105, 35, { align: 'center' }
        )
      }

      // Tabla
      autoTable(doc, {
        startY: 40,
        head: [['#', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Puntaje', 'Estado']],
        body: rows.map((row) => [
          row.position,
          row.dni,
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          row.score.toFixed(2),
          row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE',
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 5: { halign: 'center' }, 6: { halign: 'center' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const isIng = data.cell.raw === 'INGRESANTE'
            data.cell.styles.textColor = isIng ? [21, 87, 36] : [114, 28, 36]
            data.cell.styles.fontStyle = 'bold'
            if (isIng) {
              data.row.cells[0].styles.fillColor = [212, 237, 218]
              // Colorear toda la fila
              Object.values(data.row.cells).forEach((cell) => {
                cell.styles.fillColor = [212, 237, 218]
              })
            }
          }
        },
        margin: { left: 10, right: 10 },
      })
    })

    doc.save(buildFilename('resultados', convocatoriaName, 'todas', 'pdf'))
  }

  return {
    exportScoresToExcel,
    exportScoresToPdf,
  }
}
