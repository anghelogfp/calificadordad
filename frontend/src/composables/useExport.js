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
      sheet.mergeCells('A1:I1')
      sheet.getCell('A1').value = 'Universidad Nacional del Altiplano - Puno'
      sheet.getCell('A1').font = { bold: true, size: 14 }
      sheet.getCell('A1').alignment = { horizontal: 'center' }

      sheet.mergeCells('A2:I2')
      sheet.getCell('A2').value = `Resultados de Calificación - ${convocatoriaName} - Área: ${area}`
      sheet.getCell('A2').font = { size: 11 }
      sheet.getCell('A2').alignment = { horizontal: 'center' }

      sheet.addRow([])

      // Cabeceras
      const headerRow = sheet.addRow([
        'Posición', 'DNI', 'Apellido Paterno', 'Apellido Materno', 'Nombres',
        'Programa de Estudios', 'Área', 'Puntaje', 'Estado',
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
          row.programa || '',
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
        dataRow.getCell(8).font = { bold: true }
        // Estado con color
        const estadoCell = dataRow.getCell(9)
        estadoCell.font = {
          bold: true,
          color: { argb: row.isIngresante ? 'FF155724' : 'FF721C24' },
        }
      })

      // Anchos de columna
      sheet.columns = [
        { width: 10 }, { width: 12 }, { width: 20 }, { width: 20 }, { width: 25 },
        { width: 30 }, { width: 15 }, { width: 12 }, { width: 16 },
      ]
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, buildFilename('resultados', convocatoriaName, 'todas', 'xlsx'))
  }

  async function _loadLogoBase64() {
    try {
      const res = await fetch('/unap.png')
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  async function exportIngresantesPdf(rankedResults, summary, convocatoriaName = '') {
    const ingresantes = (rankedResults || []).filter(r => r.isIngresante)
    if (!ingresantes.length) return

    // Agrupar por área
    const byArea = new Map()
    ingresantes.forEach((row) => {
      if (!byArea.has(row.area)) byArea.set(row.area, [])
      byArea.get(row.area).push(row)
    })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const logoBase64 = await _loadLogoBase64()
    const totalPages = byArea.size
    let pageIndex = 0

    byArea.forEach((rows, area) => {
      if (pageIndex > 0) doc.addPage()
      pageIndex++

      const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
      const areaStats = summary?.statsByArea?.get(area)
      const pageW = doc.internal.pageSize.getWidth()

      // ── Logo ────────────────────────────────────────────────────────────────
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 8, 6, 18, 18)
      }

      // ── Cabecera institucional ───────────────────────────────────────────────
      doc.setFontSize(13)
      doc.setTextColor(30, 58, 95)
      doc.setFont(undefined, 'bold')
      doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO', pageW / 2, 11, { align: 'center' })
      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text('Dirección de Admisión', pageW / 2, 16, { align: 'center' })

      // ── Título del documento ─────────────────────────────────────────────────
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 95)
      doc.setFont(undefined, 'bold')
      doc.text('LISTA DE INGRESANTES', pageW / 2, 23, { align: 'center' })

      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`${convocatoriaName}  —  Área: ${area}`, pageW / 2, 28, { align: 'center' })
      doc.text(`Fecha: ${date}`, pageW / 2, 33, { align: 'center' })

      // Línea separadora
      doc.setDrawColor(30, 58, 95)
      doc.setLineWidth(0.5)
      doc.line(8, 36, pageW - 8, 36)

      // ── Estadísticas del área ────────────────────────────────────────────────
      if (areaStats) {
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(
          `Total ingresantes: ${areaStats.ingresantes}   |   Puntaje máx: ${areaStats.max}   |   Puntaje mín: ${areaStats.min}   |   Promedio: ${areaStats.avg}`,
          pageW / 2, 40, { align: 'center' }
        )
      }

      // ── Tabla ────────────────────────────────────────────────────────────────
      autoTable(doc, {
        startY: 44,
        head: [['N°', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Programa de Estudios', 'Puntaje']],
        body: rows.map((row, i) => [
          i + 1,
          row.dni,
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          row.programa || '',
          row.score.toFixed(2),
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 18 },
        },
        margin: { left: 8, right: 8 },
        didDrawPage: (data) => {
          // Pie de página con numeración
          const pg = doc.internal.getCurrentPageInfo().pageNumber
          doc.setFontSize(7)
          doc.setTextColor(150, 150, 150)
          doc.text(`Página ${pg} de ${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' })
          doc.text(`Generado el ${date}`, pageW - 8, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
        },
      })
    })

    const date = new Date().toISOString().slice(0, 10)
    const safeName = (convocatoriaName || 'ingresantes').replace(/[^a-z0-9_-]/gi, '_')
    doc.save(`ingresantes-${safeName}-${date}.pdf`)
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
        head: [['#', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Programa', 'Puntaje', 'Estado']],
        body: rows.map((row) => [
          row.position,
          row.dni,
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          row.programa || '',
          row.score.toFixed(2),
          row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE',
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          6: { halign: 'center', cellWidth: 18 },
          7: { halign: 'center', cellWidth: 24 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const isIng = data.cell.raw === 'INGRESANTE'
            data.cell.styles.textColor = isIng ? [21, 87, 36] : [114, 28, 36]
            data.cell.styles.fontStyle = 'bold'
            if (isIng) {
              Object.values(data.row.cells).forEach((cell) => {
                cell.styles.fillColor = [212, 237, 218]
              })
            }
          }
        },
        margin: { left: 8, right: 8 },
      })
    })

    doc.save(buildFilename('resultados', convocatoriaName, 'todas', 'pdf'))
  }

  return {
    exportScoresToExcel,
    exportScoresToPdf,
    exportIngresantesPdf,
  }
}
