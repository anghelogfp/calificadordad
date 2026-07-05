import { loadExcelExportDeps, loadPdfExportDeps } from '@/utils/exportLoaders'
import { canonicalAreaName } from '@/utils/helpers'

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

  function safeSheetName(name) {
    return String(name || 'Resultados').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
  }

  function answerStats(row) {
    const answers = String(row.answersRaw || '').toUpperCase()
    const keys = String(row.correctAnswersRaw || '').toUpperCase()
    let correct = 0
    let incorrect = 0
    let multiple = 0
    let blank = 0
    const length = Math.max(answers.length, keys.length)

    for (let i = 0; i < length; i += 1) {
      const marked = answers[i] || ' '
      const key = keys[i] || ' '
      const markedValid = /^[A-E]$/.test(marked)
      const keyValid = /^[A-E]$/.test(key)
      if (markedValid && keyValid && marked === key) correct += 1
      else if (markedValid) incorrect += 1
      else if (marked === '*') multiple += 1
      else blank += 1
    }

    return { correct, incorrect, multiple, blank }
  }

  function aggregateAnswerStats(rows = []) {
    return rows.reduce((acc, row) => {
      const stats = answerStats(row)
      acc.correct += stats.correct
      acc.incorrect += stats.incorrect
      acc.multiple += stats.multiple
      acc.blank += stats.blank
      return acc
    }, { correct: 0, incorrect: 0, multiple: 0, blank: 0 })
  }

  function visibleAnswerArray(value) {
    return String(value || '').replaceAll(' ', '·')
  }

  function displayAreaName(area) {
    return canonicalAreaName(area) || area || ''
  }

  function styleHeaderRow(row, fill = 'FF1E3A5F') {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2EC' } },
        left: { style: 'thin', color: { argb: 'FFD9E2EC' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2EC' } },
        right: { style: 'thin', color: { argb: 'FFD9E2EC' } },
      }
    })
  }

  function addSummarySheet(workbook, rows, area, areaSummary, areaStats, convocatoriaName) {
    const sheet = workbook.addWorksheet('Resumen')
    const answerTotals = aggregateAnswerStats(rows)
    const calculationDate = areaSummary?.timestamp
      ? new Date(areaSummary.timestamp).toLocaleString('es-PE')
      : new Date().toLocaleString('es-PE')

    sheet.mergeCells('A1:B1')
    sheet.getCell('A1').value = 'Resumen de Simulacro'
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F2F57' } }
    sheet.getCell('A1').alignment = { horizontal: 'center' }

    const summaryRows = [
      ['Proceso', convocatoriaName || 'Sin nombre'],
      ['Modo', 'Simulacro'],
      ['Área exportada', displayAreaName(area)],
      ['Fecha de cálculo', calculationDate],
      ['Plantilla de ponderación', areaSummary?.plantillaName || ''],
      ['Puntos por correcta', areaSummary?.correctValue ?? ''],
      ['Puntos por incorrecta', areaSummary?.incorrectValue ?? ''],
      ['Puntos por blanco', areaSummary?.blankValue ?? ''],
      ['Puntos por múltiple/anulada', 0],
      ['Total de preguntas', areaSummary?.answersLength ?? ''],
      ['Peso total', areaSummary?.totalWeight ?? ''],
      ['Postulantes del área', areaSummary?.totalCandidates ?? rows.length],
      ['Postulantes calificados', rows.length],
      ['Total correctas', answerTotals.correct],
      ['Total incorrectas', answerTotals.incorrect],
      ['Total múltiples/anuladas', answerTotals.multiple],
      ['Total en blanco', answerTotals.blank],
      ['Sin respuesta', areaSummary?.missingResponses ?? 0],
      ['Sin clave del área', areaSummary?.missingKeys ?? 0],
      ['Respuestas duplicadas por DNI', areaSummary?.duplicateResponses ?? 0],
      ['DNI observado', areaSummary?.invalidCandidates ?? 0],
      ['Respuestas no vinculadas', areaSummary?.unlinkedResponses ?? 0],
      ['Puntaje máximo', areaStats?.max ?? ''],
      ['Puntaje mínimo', areaStats?.min ?? ''],
      ['Promedio', areaStats?.avg ?? ''],
    ]

    summaryRows.forEach((item) => sheet.addRow(item))
    sheet.getColumn(1).width = 28
    sheet.getColumn(2).width = 70
    sheet.getColumn(1).font = { bold: true, color: { argb: 'FF1E3A5F' } }
    sheet.eachRow((row, index) => {
      if (index <= 1) return
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
      row.getCell(2).alignment = { wrapText: true }
    })
  }

  function addObservationsSheet(workbook, areaSummary, rows = []) {
    const sheet = workbook.addWorksheet('Observaciones')
    const header = sheet.addRow(['Tipo de observación', 'Cantidad', 'Detalle'])
    styleHeaderRow(header)
    const answerTotals = aggregateAnswerStats(rows)

    const observationRows = [
      ['Marcas múltiples/anuladas (*)', answerTotals.multiple, 'Preguntas con más de una alternativa marcada. Puntúan 0, no cuentan como blanco.'],
      ['Sin respuesta', areaSummary?.missingResponses ?? 0, 'Postulantes del padrón sin respuesta .dat.'],
      ['Sin clave del área', areaSummary?.missingKeys ?? 0, 'Respuestas que no pudieron cruzarse con una clave del área.'],
      ['Respuestas duplicadas por DNI', areaSummary?.duplicateResponses ?? 0, 'Postulantes con más de una hoja de respuestas vinculada al mismo DNI.'],
      ['DNI observado', areaSummary?.invalidCandidates ?? 0, 'Postulantes con DNI vacío, incompleto o duplicado.'],
      ['Respuestas no vinculadas', areaSummary?.unlinkedResponses ?? 0, 'Respuestas no vinculadas a un DNI.'],
    ]

    observationRows.forEach((item) => sheet.addRow(item))
    sheet.columns = [{ width: 22 }, { width: 12 }, { width: 70 }]
    sheet.getColumn(2).alignment = { horizontal: 'center' }
  }

  function addNoCalificadosSheet(workbook, noCalificados = [], options = {}) {
    const includeProgram = options.includeProgram === true
    const sheet = workbook.addWorksheet('No calificados')
    const headerValues = [
      'DNI',
      'Apellido Paterno',
      'Apellido Materno',
      'Nombres',
      'Área',
      'Motivo',
      'Detalle',
    ]
    if (includeProgram) headerValues.splice(5, 0, 'Programa')

    const header = sheet.addRow(headerValues)
    styleHeaderRow(header, 'FF7C2D12')

    noCalificados.forEach((row) => {
      const values = [
        row.dni || '',
        row.paterno || '',
        row.materno || '',
        row.nombres || '',
        displayAreaName(row.area),
        row.motivo || '',
        row.detalle || '',
      ]
      if (includeProgram) values.splice(5, 0, row.programa || '')
      sheet.addRow(values)
    })

    if (!noCalificados.length) {
      sheet.addRow(includeProgram
        ? ['', '', '', '', '', '', 'Sin observaciones', 'Todos los postulantes con respuesta válida fueron calificados.']
        : ['', '', '', '', '', 'Sin observaciones', 'Todos los postulantes con respuesta válida fueron calificados.'])
    }

    sheet.columns = includeProgram
      ? [
        { width: 12 }, { width: 18 }, { width: 18 }, { width: 25 },
        { width: 16 }, { width: 28 }, { width: 22 }, { width: 70 },
      ]
      : [
        { width: 12 }, { width: 18 }, { width: 18 }, { width: 25 },
        { width: 16 }, { width: 22 }, { width: 70 },
      ]
    sheet.getColumn(includeProgram ? 8 : 7).alignment = { wrapText: true }
  }

  function addSimulacroGeneralSummarySheet(workbook, areaEntries, convocatoriaName) {
    const sheet = workbook.addWorksheet('Resumen general')
    const allRows = areaEntries.flatMap((entry) => entry.results)
    const allNoCalificados = areaEntries.flatMap((entry) => entry.summary?.noCalificados || [])
    const answerTotals = aggregateAnswerStats(allRows)

    sheet.mergeCells('A1:D1')
    sheet.getCell('A1').value = 'Resumen general de simulacro por áreas'
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F2F57' } }
    sheet.getCell('A1').alignment = { horizontal: 'center' }

    sheet.addRow(['Proceso', convocatoriaName || 'Sin nombre'])
    sheet.addRow(['Áreas exportadas', areaEntries.length])
    sheet.addRow(['Postulantes calificados', allRows.length])
    sheet.addRow(['No calificados', allNoCalificados.length])
    sheet.addRow(['Total correctas', answerTotals.correct])
    sheet.addRow(['Total incorrectas', answerTotals.incorrect])
    sheet.addRow(['Total múltiples/anuladas', answerTotals.multiple])
    sheet.addRow(['Total en blanco', answerTotals.blank])
    sheet.addRow([])

    const header = sheet.addRow([
      'Área',
      'Postulantes',
      'Calificados',
      'No calificados',
      'Sin respuesta',
      'Sin clave del área',
      'Duplicadas por DNI',
      'DNI observado',
      'Puntaje máximo',
      'Puntaje mínimo',
      'Promedio',
    ])
    styleHeaderRow(header)

    areaEntries.forEach(({ area, results, summary, stats }) => {
      sheet.addRow([
        displayAreaName(area),
        summary?.totalCandidates ?? results.length,
        results.length,
        summary?.noCalificados?.length ?? 0,
        summary?.missingResponses ?? 0,
        summary?.missingKeys ?? 0,
        summary?.duplicateResponses ?? 0,
        summary?.invalidCandidates ?? 0,
        stats?.max ?? '',
        stats?.min ?? '',
        stats?.avg ?? '',
      ])
    })

    sheet.columns = [
      { width: 20 }, { width: 14 }, { width: 12 }, { width: 14 },
      { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 },
    ]
  }

  function addSimulacroObservationsByAreaSheet(workbook, areaEntries) {
    const sheet = workbook.addWorksheet('Observaciones')
    const header = sheet.addRow(['Área', 'Tipo de observación', 'Cantidad', 'Detalle'])
    styleHeaderRow(header)

    areaEntries.forEach(({ area, results, summary }) => {
      const answerTotals = aggregateAnswerStats(results)
      const rows = [
        ['Marcas múltiples/anuladas (*)', answerTotals.multiple, 'Preguntas con más de una alternativa marcada. Puntúan 0.'],
        ['Sin respuesta', summary?.missingResponses ?? 0, 'Postulantes del padrón sin respuesta .dat.'],
        ['Sin clave del área', summary?.missingKeys ?? 0, 'Respuestas que no pudieron cruzarse con una clave del área.'],
        ['Respuestas duplicadas por DNI', summary?.duplicateResponses ?? 0, 'Postulantes con más de una hoja de respuestas vinculada al mismo DNI.'],
        ['DNI observado', summary?.invalidCandidates ?? 0, 'Postulantes con DNI vacío, incompleto o duplicado.'],
        ['Respuestas no vinculadas', summary?.unlinkedResponses ?? 0, 'Respuestas no vinculadas a un DNI.'],
      ]

      rows.forEach(([type, count, detail]) => {
        sheet.addRow([displayAreaName(area), type, count, detail])
      })
    })

    sheet.columns = [{ width: 18 }, { width: 28 }, { width: 12 }, { width: 72 }]
    sheet.getColumn(3).alignment = { horizontal: 'center' }
    sheet.getColumn(4).alignment = { wrapText: true }
  }

  function addSimulacroResultsSheet(workbook, rows, area, convocatoriaName = '') {
    const displayArea = displayAreaName(area)
    const sheet = workbook.addWorksheet(safeSheetName(`Resultados ${displayArea}`))

    sheet.mergeCells('A1:Q1')
    sheet.getCell('A1').value = `${convocatoriaName || 'Simulacro'} - Área: ${displayArea}`
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F2F57' } }
    sheet.getCell('A1').alignment = { horizontal: 'center' }
    sheet.addRow([])

    const header = sheet.addRow([
      'Posición',
      'DNI',
      'Apellido Paterno',
      'Apellido Materno',
      'Nombres',
      'Área',
      'Tipo',
      'Aula',
      'Litho',
      'Puntaje',
      'Correctas',
      'Incorrectas',
      'Múltiples',
      'En blanco',
      'Longitud',
      'Respuestas DAT',
      'Respuestas visibles',
    ])
    styleHeaderRow(header)

    rows.forEach((row) => {
      const stats = answerStats(row)
      const dataRow = sheet.addRow([
        row.position,
        row.dni,
        row.paterno || '',
        row.materno || '',
        row.nombres || '',
        displayAreaName(row.area || area),
        row.tipo || '',
        row.aula || '',
        row.litho || '',
        row.score,
        stats.correct,
        stats.incorrect,
        stats.multiple,
        stats.blank,
        String(row.answersRaw || '').length,
        row.answersRaw || '',
        visibleAnswerArray(row.answersRaw),
      ])
      dataRow.getCell(10).font = { bold: true }
      dataRow.getCell(16).font = { name: 'Courier New', size: 9 }
      dataRow.getCell(16).numFmt = '@'
      dataRow.getCell(17).font = { name: 'Courier New', size: 9 }
      dataRow.getCell(17).numFmt = '@'
    })

    sheet.columns = [
      { width: 10 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 25 },
      { width: 15 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 12 },
      { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 68 }, { width: 68 },
    ]
    sheet.views = [{ state: 'frozen', ySplit: 3 }]
    sheet.autoFilter = 'A3:Q3'
  }

  async function exportSimulacroAreasToExcel(areaResultsMap = {}, convocatoriaName = '', options = {}) {
    const areaEntries = Object.entries(areaResultsMap)
      .map(([area, value]) => ({
        area,
        results: value?.results || [],
        summary: value?.summary || null,
        stats: options.statsByArea?.get?.(area) || null,
      }))
      .filter((entry) => entry.results.length || entry.summary)

    if (!areaEntries.length) return

    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    addSimulacroGeneralSummarySheet(workbook, areaEntries, convocatoriaName)

    areaEntries.forEach(({ area, results }) => {
      addSimulacroResultsSheet(workbook, results, area, convocatoriaName)
    })

    addSimulacroObservationsByAreaSheet(workbook, areaEntries)
    addNoCalificadosSheet(
      workbook,
      areaEntries.flatMap((entry) => entry.summary?.noCalificados || []),
      { includeProgram: false },
    )

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, buildFilename('simulacro-resultados-todo', convocatoriaName, 'todas', 'xlsx'))
  }

  async function exportScoresToExcel(rankedResults, convocatoriaName = '', options = {}) {
    if (!rankedResults?.length) return

    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const processType = options.processType || 'simulacro'

    if (processType !== 'real') {
      const area = options.area || rankedResults[0]?.area || 'Área'
      addSummarySheet(workbook, rankedResults, area, options.areaSummary, options.areaStats, convocatoriaName)
      addSimulacroResultsSheet(workbook, rankedResults, area, convocatoriaName)
      addObservationsSheet(workbook, options.areaSummary, rankedResults)
      addNoCalificadosSheet(workbook, options.areaSummary?.noCalificados || [], { includeProgram: false })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(blob, buildFilename('simulacro-resultados', convocatoriaName, area, 'xlsx'))
      return
    }

    // Agrupar por área
    const byArea = new Map()
    rankedResults.forEach((row) => {
      if (!byArea.has(row.area)) byArea.set(row.area, [])
      byArea.get(row.area).push(row)
    })

    byArea.forEach((rows, area) => {
      const sheet = workbook.addWorksheet(displayAreaName(area))

      // Encabezado institucional
      sheet.mergeCells('A1:I1')
      sheet.getCell('A1').value = 'Universidad Nacional del Altiplano - Puno'
      sheet.getCell('A1').font = { bold: true, size: 14 }
      sheet.getCell('A1').alignment = { horizontal: 'center' }

      sheet.mergeCells('A2:I2')
      sheet.getCell('A2').value = `Resultados de Calificación - ${convocatoriaName} - Área: ${displayAreaName(area)}`
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
          displayAreaName(row.area),
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
    saveAs(blob, buildFilename('resultados', convocatoriaName, options.area || 'todas', 'xlsx'))
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

  async function exportIngresantesPdf(rankedResults, summary, convocatoriaName = '', processType = 'simulacro') {
    const ingresantes = (rankedResults || []).filter(r => r.isIngresante)
    if (!ingresantes.length) return

    const { jsPDF, autoTable } = await loadPdfExportDeps()
    const isReal = processType === 'real'

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

      // ── Logo ──────────────────────────────────────────────────────────────
      if (logoBase64) doc.addImage(logoBase64, 'PNG', 8, 6, 18, 18)

      // ── Cabecera institucional ─────────────────────────────────────────────
      doc.setFontSize(13)
      doc.setTextColor(30, 58, 95)
      doc.setFont(undefined, 'bold')
      doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO', pageW / 2, 11, { align: 'center' })
      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text('Dirección de Admisión', pageW / 2, 16, { align: 'center' })

      // ── Título ────────────────────────────────────────────────────────────
      doc.setFontSize(11)
      doc.setTextColor(30, 58, 95)
      doc.setFont(undefined, 'bold')
      doc.text('LISTA DE INGRESANTES', pageW / 2, 23, { align: 'center' })

      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(60, 60, 60)
      const modoLabel = isReal ? 'Convocatoria Real' : 'Simulacro'
      doc.text(`${convocatoriaName}  —  Área: ${displayAreaName(area)}  —  ${modoLabel}`, pageW / 2, 28, { align: 'center' })
      doc.text(`Fecha: ${date}`, pageW / 2, 33, { align: 'center' })

      // Línea separadora
      doc.setDrawColor(30, 58, 95)
      doc.setLineWidth(0.5)
      doc.line(8, 36, pageW - 8, 36)

      // ── Estadísticas del área ──────────────────────────────────────────────
      if (areaStats) {
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(
          `Total ingresantes: ${areaStats.ingresantes}   |   Puntaje máx: ${areaStats.max}   |   Puntaje mín: ${areaStats.min}   |   Promedio: ${areaStats.avg}`,
          pageW / 2, 40, { align: 'center' }
        )
      }

      // ── Tabla ─────────────────────────────────────────────────────────────
      if (isReal) {
        // Modo real: body con filas-separador por carrera
        const byCarrera = new Map()
        rows.forEach((row) => {
          const prog = row.programa?.trim() || '(Sin programa)'
          if (!byCarrera.has(prog)) byCarrera.set(prog, [])
          byCarrera.get(prog).push(row)
        })

        // Ordenar carreras alfabéticamente, (Sin programa) al final
        const sortedCarreras = Array.from(byCarrera.entries()).sort(([a], [b]) => {
          if (a === '(Sin programa)') return 1
          if (b === '(Sin programa)') return -1
          return a.localeCompare(b, 'es')
        })

        const body = []
        sortedCarreras.forEach(([carrera, carreraRows]) => {
          // Fila separadora con nombre de carrera + conteo
          body.push([{
            content: `${carrera}  (${carreraRows.length} ingresante${carreraRows.length !== 1 ? 's' : ''})`,
            colSpan: 6,
            styles: {
              fillColor: [30, 58, 95],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8,
              cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
            },
          }])
          // Filas de candidatos
          carreraRows.forEach((row, i) => {
            body.push([
              i + 1,
              row.dni,
              row.paterno || '',
              row.materno || '',
              row.nombres || '',
              row.score.toFixed(3),
            ])
          })
        })

        autoTable(doc, {
          startY: 44,
          head: [['N°', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Puntaje']],
          body,
          headStyles: { fillColor: [10, 36, 70], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 20 },
            5: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          },
          margin: { left: 8, right: 8 },
          didDrawPage: (data) => {
            const pg = doc.internal.getCurrentPageInfo().pageNumber
            doc.setFontSize(7)
            doc.setTextColor(150, 150, 150)
            doc.text(`Página ${pg}`, pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' })
            doc.text(`Generado el ${date}`, pageW - 8, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
          },
        })
      } else {
        // Modo simulacro: tabla plana sin programa/carrera
        autoTable(doc, {
          startY: 44,
          head: [['N°', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Puntaje']],
          body: rows.map((row, i) => [
            i + 1,
            row.dni,
            row.paterno || '',
            row.materno || '',
            row.nombres || '',
            row.score.toFixed(3),
          ]),
          headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
          },
          margin: { left: 8, right: 8 },
          didDrawPage: (data) => {
            const pg = doc.internal.getCurrentPageInfo().pageNumber
            doc.setFontSize(7)
            doc.setTextColor(150, 150, 150)
            doc.text(`Página ${pg} de ${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' })
            doc.text(`Generado el ${date}`, pageW - 8, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
          },
        })
      }
    })

    const date = new Date().toISOString().slice(0, 10)
    const safeName = (convocatoriaName || 'ingresantes').replace(/[^a-z0-9_-]/gi, '_')
    const modoSuffix = isReal ? '-real' : ''
    doc.save(`ingresantes${modoSuffix}-${safeName}-${date}.pdf`)
  }

  async function exportScoresToPdf(rankedResults, summary, convocatoriaName = '', options = {}) {
    if (!rankedResults?.length) return
    const { jsPDF, autoTable } = await loadPdfExportDeps()
    const processType = options.processType || 'simulacro'
    const isReal = processType === 'real'

    // Agrupar por área
    const byArea = new Map()
    rankedResults.forEach((row) => {
      if (!byArea.has(row.area)) byArea.set(row.area, [])
      byArea.get(row.area).push(row)
    })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const logoBase64 = await _loadLogoBase64()
    let isFirst = true

    byArea.forEach((rows, area) => {
      if (!isFirst) doc.addPage()
      isFirst = false

      const date = new Date().toLocaleDateString('es-PE')
      const areaStats = summary?.statsByArea?.get(area)
      const areaSummary = options.areaSummary
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      if (!isReal) {
        // Cabecera institucional compacta
        if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 8, 18, 18)

        doc.setFillColor(10, 36, 70)
        doc.rect(0, 0, pageW, 7, 'F')

        doc.setFontSize(13)
        doc.setTextColor(30, 58, 95)
        doc.setFont(undefined, 'bold')
        doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO', pageW / 2, 13, { align: 'center' })
        doc.setFontSize(9)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(90, 98, 112)
        doc.text('Dirección de Admisión', pageW / 2, 18, { align: 'center' })

        doc.setDrawColor(221, 171, 68)
        doc.setLineWidth(0.8)
        doc.line(34, 25, pageW - 10, 25)

        doc.setFontSize(14)
        doc.setTextColor(15, 47, 87)
        doc.setFont(undefined, 'bold')
        doc.text('RESULTADOS DE SIMULACRO', 10, 34)

        doc.setFontSize(8.5)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(80, 80, 80)
        doc.text(`Proceso: ${convocatoriaName || 'Sin nombre'}`, 10, 40)
        doc.text(`Área: ${displayAreaName(area)}  |  Fecha: ${date}  |  Total calificados: ${rows.length}`, 10, 45)

        const stats = [
          ['Máximo', areaStats?.max?.toFixed ? areaStats.max.toFixed(3) : (areaStats?.max ?? '-')],
          ['Mínimo', areaStats?.min?.toFixed ? areaStats.min.toFixed(3) : (areaStats?.min ?? '-')],
          ['Promedio', areaStats?.avg?.toFixed ? areaStats.avg.toFixed(3) : (areaStats?.avg ?? '-')],
          ['Preguntas', areaSummary?.answersLength ?? '-'],
        ]

        const boxY = 51
        const boxW = (pageW - 20 - 9) / 4
        stats.forEach(([label, value], index) => {
          const x = 10 + index * (boxW + 3)
          doc.setFillColor(244, 247, 251)
          doc.setDrawColor(217, 226, 236)
          doc.roundedRect(x, boxY, boxW, 14, 2, 2, 'FD')
          doc.setFontSize(7)
          doc.setTextColor(90, 98, 112)
          doc.text(label, x + 3, boxY + 5)
          doc.setFontSize(10)
          doc.setFont(undefined, 'bold')
          doc.setTextColor(15, 47, 87)
          doc.text(String(value), x + 3, boxY + 11)
          doc.setFont(undefined, 'normal')
        })

        doc.setFontSize(7.5)
        doc.setTextColor(90, 98, 112)
        doc.text(
          `Plantilla: ${areaSummary?.plantillaName || '-'}  |  Correcta: ${areaSummary?.correctValue ?? '-'}  Incorrecta: ${areaSummary?.incorrectValue ?? '-'}  Blanco: ${areaSummary?.blankValue ?? '-'}`,
          10,
          71,
        )

        autoTable(doc, {
          startY: 76,
          head: [['#', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Puntaje']],
          body: rows.map((row) => [
            row.position,
            row.dni,
            row.paterno || '',
            row.materno || '',
            row.nombres || '',
            Number(row.score || 0).toFixed(3),
          ]),
          headStyles: {
            fillColor: [10, 36, 70],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
          },
          bodyStyles: { fontSize: 7.3, cellPadding: 2 },
          alternateRowStyles: { fillColor: [246, 248, 251] },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 18 },
            5: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
          },
          margin: { left: 10, right: 10 },
          didDrawPage: () => {
            const pg = doc.internal.getCurrentPageInfo().pageNumber
            doc.setDrawColor(221, 226, 232)
            doc.line(10, pageH - 12, pageW - 10, pageH - 12)
            doc.setFontSize(7)
            doc.setTextColor(140, 148, 160)
            doc.text(`Página ${pg}`, pageW / 2, pageH - 7, { align: 'center' })
            doc.text(`Generado el ${date}`, pageW - 10, pageH - 7, { align: 'right' })
          },
        })

        return
      }

      // Encabezado
      doc.setFontSize(14)
      doc.setTextColor(30, 58, 95)
      doc.text('Universidad Nacional del Altiplano - Puno', 105, 15, { align: 'center' })
      doc.setFontSize(11)
      doc.text(`Resultados de Calificación - ${convocatoriaName}`, 105, 22, { align: 'center' })
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Área: ${displayAreaName(area)}  |  Fecha: ${date}  |  Total: ${rows.length}`, 105, 29, { align: 'center' })

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

    doc.save(buildFilename(isReal ? 'resultados' : 'simulacro-ranking', convocatoriaName, options.area || 'todas', 'pdf'))
  }

  async function exportSimulacroAreasToPdf(areaResultsMap = {}, convocatoriaName = '', options = {}) {
    const areaEntries = Object.entries(areaResultsMap)
      .map(([area, value]) => ({
        area,
        results: value?.results || [],
        summary: value?.summary || null,
        stats: options.statsByArea?.get?.(area) || null,
      }))
      .filter((entry) => entry.results.length || entry.summary)

    if (!areaEntries.length) return

    const { jsPDF, autoTable } = await loadPdfExportDeps()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const logoBase64 = await _loadLogoBase64()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const date = new Date().toLocaleDateString('es-PE')
    const allRows = areaEntries.flatMap((entry) => entry.results)
    const allNoCalificados = areaEntries.flatMap((entry) => entry.summary?.noCalificados || [])

    if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 8, 18, 18)
    doc.setFillColor(10, 36, 70)
    doc.rect(0, 0, pageW, 7, 'F')
    doc.setFontSize(13)
    doc.setTextColor(30, 58, 95)
    doc.setFont(undefined, 'bold')
    doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO', pageW / 2, 15, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(90, 98, 112)
    doc.text('Dirección de Admisión', pageW / 2, 20, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(15, 47, 87)
    doc.setFont(undefined, 'bold')
    doc.text('RESULTADOS GENERALES DE SIMULACRO', pageW / 2, 32, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Proceso: ${convocatoriaName || 'Sin nombre'}`, pageW / 2, 38, { align: 'center' })
    doc.text(`Fecha: ${date}  |  Áreas: ${areaEntries.length}  |  Calificados: ${allRows.length}`, pageW / 2, 43, { align: 'center' })

    autoTable(doc, {
      startY: 52,
      head: [['Área', 'Postulantes', 'Calificados', 'No calificados', 'Máximo', 'Mínimo', 'Promedio']],
      body: areaEntries.map(({ area, results, summary, stats }) => [
        area,
        summary?.totalCandidates ?? results.length,
        results.length,
        summary?.noCalificados?.length ?? 0,
        stats?.max ?? '',
        stats?.min ?? '',
        stats?.avg ?? '',
      ]),
      headStyles: { fillColor: [10, 36, 70], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [246, 248, 251] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: 10, right: 10 },
    })

    areaEntries.forEach(({ area, results, summary, stats }) => {
      doc.addPage()

      doc.setFillColor(10, 36, 70)
      doc.rect(0, 0, pageW, 7, 'F')
      doc.setFontSize(13)
      doc.setTextColor(15, 47, 87)
      doc.setFont(undefined, 'bold')
      doc.text(convocatoriaName || 'Simulacro', 10, 17)
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(`Área: ${displayAreaName(area)}  |  Fecha: ${date}  |  Calificados: ${results.length}`, 10, 24)

      const statRows = [
        ['Máximo', stats?.max ?? '-'],
        ['Mínimo', stats?.min ?? '-'],
        ['Promedio', stats?.avg ?? '-'],
        ['Preguntas', summary?.answersLength ?? '-'],
      ]
      autoTable(doc, {
        startY: 31,
        body: [statRows.map(([label, value]) => `${label}: ${value}`)],
        theme: 'plain',
        bodyStyles: { fontSize: 8, fillColor: [244, 247, 251], textColor: [15, 47, 87] },
        margin: { left: 10, right: 10 },
      })

      autoTable(doc, {
        startY: 43,
        head: [['#', 'DNI', 'Ap. Paterno', 'Ap. Materno', 'Nombres', 'Puntaje']],
        body: results.map((row) => [
          row.position,
          row.dni,
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          Number(row.score || 0).toFixed(3),
        ]),
        headStyles: { fillColor: [10, 36, 70], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7.2, cellPadding: 2 },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
        },
        margin: { left: 10, right: 10 },
        didDrawPage: () => {
          const pg = doc.internal.getCurrentPageInfo().pageNumber
          doc.setDrawColor(221, 226, 232)
          doc.line(10, pageH - 12, pageW - 10, pageH - 12)
          doc.setFontSize(7)
          doc.setTextColor(140, 148, 160)
          doc.text(`Página ${pg}`, pageW / 2, pageH - 7, { align: 'center' })
          doc.text(`Generado el ${date}`, pageW - 10, pageH - 7, { align: 'right' })
        },
      })
    })

    doc.save(buildFilename('simulacro-ranking-todo', convocatoriaName, 'todas', 'pdf'))
  }

  return {
    exportScoresToExcel,
    exportSimulacroAreasToExcel,
    exportScoresToPdf,
    exportSimulacroAreasToPdf,
    exportIngresantesPdf,
  }
}
