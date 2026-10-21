import { ref } from 'vue'
import { loadExcelExportDeps, loadPdfExportDeps } from '@/utils/exportLoaders'
import { canonicalAreaName, stripDigits } from '@/utils/helpers'
import { sha256Hex, formatHashBlocks } from '@/utils/cryptoHash'
import { computeConfigurationSha256 } from '@/domain/calification/configHash'
import { runPreCalificationSyntheticSuite } from '@/domain/calification/syntheticTests'

const sharedExportedArtifacts = ref([])

/**
 * Composable para exportar resultados a Excel y PDF
 */
export function useExport() {
  const exportedArtifacts = sharedExportedArtifacts

  function registerExportedArtifact({ name, type, label = '', buffer = null }) {
    let bytes = buffer
    if (!bytes && bytes !== '') {
      bytes = new Uint8Array(0)
    }
    const size = Number(bytes?.byteLength ?? bytes?.length ?? 0)
    const sha256 = sha256Hex(bytes)
    const entry = {
      id: `${name}-${Date.now()}`,
      name,
      type,
      label:
        label ||
        (type === 'excel'
          ? 'Padrón y Ranking Oficial de Resultados (Excel)'
          : 'Publicación Oficial en Orden de Mérito (PDF)'),
      timestamp: new Date().toISOString(),
      size,
      sha256,
      sha256Formatted: formatHashBlocks(sha256, 8),
    }
    const existingIndex = exportedArtifacts.value.findIndex((item) => item.name === name)
    if (existingIndex >= 0) {
      const updated = [...exportedArtifacts.value]
      updated[existingIndex] = entry
      exportedArtifacts.value = updated
    } else {
      exportedArtifacts.value = [...exportedArtifacts.value, entry]
    }
    return entry
  }

  function clearExportedArtifacts() {
    exportedArtifacts.value = []
  }

  function _extractPdfBuffer(doc) {
    try {
      if (doc && typeof doc.output === 'function') {
        const ab = doc.output('arraybuffer')
        if (ab) return ab
      }
    } catch {
      // Fallback en entornos de test o mocks de jsPDF
    }
    return ''
  }

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
    const filename = buildFilename('simulacro-resultados-todo', convocatoriaName, 'todas', 'xlsx')
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, filename)
    return registerExportedArtifact({
      name: filename,
      type: 'excel',
      label: 'Consolidado General de Simulacro (Excel)',
      buffer,
    })
  }

  async function exportPjResultsToExcel(rankedResults = [], convocatoriaName = '', options = {}) {
    const summary = options.areaSummary || options.summary || {}
    const noCalificados = Array.isArray(options.noCalificados)
      ? options.noCalificados
      : Array.isArray(summary.noCalificados)
        ? summary.noCalificados
        : []
    const anuladosComision = Array.isArray(options.anuladosComision)
      ? options.anuladosComision
      : Array.isArray(summary.anuladosComision)
        ? summary.anuladosComision
        : noCalificados.filter((r) => String(r.motivo || '').toLowerCase().includes('anulada'))
    const archiveRows = Array.isArray(options.archiveRows) ? options.archiveRows : []
    const answerKeyRows = Array.isArray(options.answerKeyRows) ? options.answerKeyRows : []
    const questionExceptions = Array.isArray(options.questionExceptions)
      ? options.questionExceptions
      : Array.isArray(summary.questionExceptions)
        ? summary.questionExceptions
        : []
    const candidateExceptions = Array.isArray(options.candidateExceptions)
      ? options.candidateExceptions
      : Array.isArray(summary.candidateExceptions)
        ? summary.candidateExceptions
        : []
    const scoringOptions = options.scoringOptions || summary.scoringOptions || {}
    const correctValue = Number(options.correctValue ?? summary.correctValue ?? 1)
    const incorrectValue = Number(options.incorrectValue ?? summary.incorrectValue ?? 0)
    const blankValue = Number(options.blankValue ?? summary.blankValue ?? 0)
    const answersLength = Number(options.answersLength ?? summary.answersLength ?? 30)

    if (!rankedResults?.length && !noCalificados.length && !archiveRows.length) return null

    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()

    const configHashObj = computeConfigurationSha256({
      answersLength,
      correctValue,
      incorrectValue,
      blankValue,
      plantillaItems: summary.plantillaSnapshot || [{ subject: 'Conocimientos', questionCount: answersLength, ponderation: 1 }],
      answerKeyRows,
      questionExceptions,
      candidateExceptions,
      scoringOptions,
    })
    const configSha256 = options.configSha256 || summary.configSha256 || configHashObj.sha256

    const syntheticSuite =
      options.syntheticTests && Array.isArray(options.syntheticTests.cases)
        ? options.syntheticTests
        : runPreCalificationSyntheticSuite({
            answerKeyRows,
            correctValue,
            incorrectValue,
            blankValue,
            answersLength,
            questionExceptions,
          })

    const fullNameOf = (r) =>
      [r?.paterno, r?.materno, r?.nombres]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(' ')

    const sortedByPuestoAndRank = [...(rankedResults || [])].sort((a, b) => {
      const pA = String(a.codPuesto || a.cod_puesto || a.programa || '')
      const pB = String(b.codPuesto || b.cod_puesto || b.programa || '')
      const cmp = pA.localeCompare(pB, 'es', { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return cmp
      const rankDiff = Number(a.positionInPrograma || a.position || 0) - Number(b.positionInPrograma || b.position || 0)
      if (rankDiff !== 0) return rankDiff
      return Number(b.score || 0) - Number(a.score || 0)
    })

    // ── HOJA 1: Resumen PJ ──────────────────────────────────────────────────
    const sheetResumen = workbook.addWorksheet('Resumen PJ')
    sheetResumen.mergeCells('A1:H1')
    sheetResumen.getCell('A1').value =
      'UNIVERSIDAD NACIONAL DEL ALTIPLANO DE PUNO — CORTE SUPERIOR DE JUSTICIA DE PUNO'
    sheetResumen.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF0A2446' } }
    sheetResumen.getCell('A1').alignment = { horizontal: 'center' }

    sheetResumen.mergeCells('A2:H2')
    sheetResumen.getCell('A2').value = `RESUMEN EJECUTIVO DE CALIFICACIÓN — ${convocatoriaName || 'PROCESO DE SELECCIÓN DE PERSONAL A PLAZO INDETERMINADO N.° 001-2026-UE-PUNO'}`
    sheetResumen.getCell('A2').font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } }
    sheetResumen.getCell('A2').alignment = { horizontal: 'center' }
    sheetResumen.addRow([])

    const totalPadron = archiveRows.length || summary.totalCandidates || rankedResults.length + noCalificados.length
    const totalGanadores = rankedResults.filter((r) => r.isIngresante).length
    const totalAptos = rankedResults.filter((r) => r.isApto !== false).length
    const totalTied = rankedResults.filter((r) => r.isTied).length
    const scoresList = rankedResults.map((r) => Number(r.score || 0))
    const maxScore = scoresList.length ? Math.max(...scoresList) : 0
    const minScore = scoresList.length ? Math.min(...scoresList) : 0
    const avgScore = scoresList.length ? scoresList.reduce((a, b) => a + b, 0) / scoresList.length : 0

    const metaRows = [
      ['Proceso / Convocatoria', convocatoriaName || 'PROCESO DE SELECCIÓN DE PERSONAL A PLAZO INDETERMINADO N.° 001-2026-UE-PUNO'],
      ['Modalidad', 'Concurso Poder Judicial (Por Código de Examen y Puesto)'],
      ['Fecha y Hora de Procesamiento', summary.timestamp ? new Date(summary.timestamp).toLocaleString('es-PE') : new Date().toLocaleString('es-PE')],
      ['Total de Preguntas por Examen', answersLength],
      ['Valor Respuesta Correcta', correctValue],
      ['Valor Respuesta Incorrecta', incorrectValue],
      ['Valor Respuesta en Blanco', blankValue],
      ['Valor Marca Múltiple (*)', 0],
      ['Criterio de Nota Mínima', scoringOptions.useMinPassingScore ? `Sí (${scoringOptions.minPassingScore} pts)` : 'No aplica (Ranking por vacante)'],
      ['Regla de Desempate', scoringOptions.tieBreakerMode || 'shared_rank'],
      ['Total Postulantes en Padrón', totalPadron],
      ['Postulantes Calificados Válidos', rankedResults.length],
      ['Postulantes Ganadores / Alcanzaron Vacante', totalGanadores],
      ['Postulantes Aptos', totalAptos],
      ['Postulantes con Empate Detectado', totalTied],
      ['Postulantes No Calificados / Ausentes', noCalificados.length],
      ['Participaciones Anuladas por Comisión', anuladosComision.length],
      ['Puntaje Máximo Obtenido', Number(maxScore.toFixed(3))],
      ['Puntaje Mínimo Obtenido', Number(minScore.toFixed(3))],
      ['Puntaje Promedio General', Number(avgScore.toFixed(3))],
      ['Huella Criptográfica SHA-256 Configuración', configSha256],
      ['Huella SHA-256 (Bloques de 8)', formatHashBlocks(configSha256, 8)],
    ]

    metaRows.forEach(([k, v]) => {
      const r = sheetResumen.addRow([k, v])
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E3A5F' } }
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
    })

    sheetResumen.addRow([])
    const examSectionTitle = sheetResumen.addRow(['RESUMEN POR CÓDIGO DE EXAMEN (COD_EXAMEN)'])
    examSectionTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0A2446' } }

    const examHeader = sheetResumen.addRow([
      'COD_EXAMEN',
      'CALIFICADOS',
      'AUSENTES / NO CALIF.',
      'GANADORES / VACANTE',
      'EMPATES',
      'PUNTAJE MÁX',
      'PUNTAJE MÍN',
      'PROMEDIO',
    ])
    styleHeaderRow(examHeader)

    const byExam = new Map()
    rankedResults.forEach((r) => {
      const code = r.codExamen || r.cod_examen || r.area || 'S/C'
      if (!byExam.has(code)) byExam.set(code, { calificados: [], noCalif: 0 })
      byExam.get(code).calificados.push(r)
    })
    noCalificados.forEach((r) => {
      const code = r.codExamen || r.cod_examen || r.area || 'S/C'
      if (!byExam.has(code)) byExam.set(code, { calificados: [], noCalif: 0 })
      byExam.get(code).noCalif += 1
    })

    Array.from(byExam.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
      .forEach(([code, data]) => {
        const list = data.calificados
        const sc = list.map((x) => Number(x.score || 0))
        const mx = sc.length ? Math.max(...sc) : 0
        const mn = sc.length ? Math.min(...sc) : 0
        const av = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0
        sheetResumen.addRow([
          code,
          list.length,
          data.noCalif,
          list.filter((x) => x.isIngresante).length,
          list.filter((x) => x.isTied).length,
          sc.length ? Number(mx.toFixed(3)) : '-',
          sc.length ? Number(mn.toFixed(3)) : '-',
          sc.length ? Number(av.toFixed(3)) : '-',
        ])
      })

    sheetResumen.addRow([])
    const puestoSectionTitle = sheetResumen.addRow(['RESUMEN POR PUESTO Y UNIDAD'])
    puestoSectionTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0A2446' } }

    const puestoHeader = sheetResumen.addRow([
      'COD_PUESTO',
      'PUESTO',
      'UNIDAD',
      'COD_EXAMEN',
      'CALIFICADOS',
      'GANADORES',
      'EMPATES',
      'PUNTAJE MÁX',
    ])
    styleHeaderRow(puestoHeader)

    const byPuestoSummary = new Map()
    sortedByPuestoAndRank.forEach((r) => {
      const key = r.codPuesto || r.cod_puesto || r.puesto || r.programa || 'S/P'
      if (!byPuestoSummary.has(key)) {
        byPuestoSummary.set(key, {
          codPuesto: key,
          puesto: r.puesto || r.programa || key,
          unidad: r.unidad || '',
          codExamen: r.codExamen || r.area || '',
          rows: [],
        })
      }
      byPuestoSummary.get(key).rows.push(r)
    })

    Array.from(byPuestoSummary.values()).forEach((grp) => {
      const sc = grp.rows.map((x) => Number(x.score || 0))
      const mx = sc.length ? Math.max(...sc) : 0
      sheetResumen.addRow([
        grp.codPuesto,
        grp.puesto,
        grp.unidad,
        grp.codExamen,
        grp.rows.length,
        grp.rows.filter((x) => x.isIngresante).length,
        grp.rows.filter((x) => x.isTied).length,
        sc.length ? Number(mx.toFixed(3)) : '-',
      ])
    })

    sheetResumen.columns = [
      { width: 32 },
      { width: 38 },
      { width: 34 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
    ]

    // ── HOJA 2: Ranking por Puesto ──────────────────────────────────────────
    const sheetRanking = workbook.addWorksheet('Ranking por Puesto')
    sheetRanking.mergeCells('A1:P1')
    sheetRanking.getCell('A1').value =
      'CUADRO OFICIAL DE MÉRITOS POR PUESTO Y UNIDAD — CORTE SUPERIOR DE JUSTICIA DE PUNO'
    sheetRanking.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF0A2446' } }
    sheetRanking.getCell('A1').alignment = { horizontal: 'center' }
    sheetRanking.addRow([])

    const rankingHeader = sheetRanking.addRow([
      'N°',
      'COD_PUESTO',
      'PUESTO',
      'UNIDAD',
      'COD_EXAMEN',
      'GRUPO',
      'AULA',
      'DNI',
      'APELLIDOS Y NOMBRES',
      'ACIERTOS',
      'ERRORES',
      'BLANCOS',
      'PUNTAJE',
      'ORDEN MÉRITO PUESTO',
      'CONDICIÓN',
      'EMPATE',
    ])
    styleHeaderRow(rankingHeader)

    sortedByPuestoAndRank.forEach((row, idx) => {
      const stats =
        row.correctCount !== undefined
          ? {
              correct: row.correctCount,
              incorrect: row.incorrectCount,
              blank: row.blankCount,
            }
          : answerStats(row)
      const condicion =
        row.condicion ||
        (row.isCutoffTie
          ? 'EMPATE EN CORTE'
          : row.isIngresante
            ? 'GANADOR / ALCANZÓ VACANTE'
            : row.isApto === false
              ? 'NO APROBADO'
              : 'APROBADO (SIN VACANTE)')
      const empateLabel = row.isCutoffTie
        ? `EMPATE EN CORTE (${row.tieGroupSize || row.tieCount || 2})`
        : row.isTied
          ? `EMPATE (${row.tieGroupSize || row.tieCount || 2})`
          : 'SIN EMPATE'

      const r = sheetRanking.addRow([
        idx + 1,
        row.codPuesto || row.cod_puesto || '',
        row.puesto || row.programa || '',
        row.unidad || '',
        row.codExamen || row.cod_examen || row.area || '',
        row.grupo || '',
        row.aula || row.aulaPadron || '',
        row.dni || '',
        fullNameOf(row),
        stats.correct,
        stats.incorrect,
        stats.blank,
        Number(row.score || 0),
        row.positionInPrograma || row.position || idx + 1,
        condicion,
        empateLabel,
      ])

      r.getCell(13).font = { bold: true }
      r.getCell(13).numFmt = '0.000'
      r.getCell(14).alignment = { horizontal: 'center' }

      if (row.isCutoffTie) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        })
      } else if (row.isIngresante) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
        })
      }
    })

    sheetRanking.columns = [
      { width: 7 },
      { width: 14 },
      { width: 32 },
      { width: 32 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 34 },
      { width: 11 },
      { width: 11 },
      { width: 11 },
      { width: 13 },
      { width: 18 },
      { width: 26 },
      { width: 20 },
    ]
    sheetRanking.views = [{ state: 'frozen', ySplit: 3 }]
    sheetRanking.autoFilter = 'A3:P3'

    // ── HOJA 3: Padrón Consolidado ──────────────────────────────────────────
    const sheetPadron = workbook.addWorksheet('Padrón Consolidado')
    sheetPadron.mergeCells('A1:S1')
    sheetPadron.getCell('A1').value =
      'PADRÓN GENERAL CONSOLIDADO DE POSTULANTES (CALIFICADOS, AUSENTES Y ANULADOS)'
    sheetPadron.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF0A2446' } }
    sheetPadron.getCell('A1').alignment = { horizontal: 'center' }
    sheetPadron.addRow([])

    const padronHeader = sheetPadron.addRow([
      'N°',
      'DNI',
      'APELLIDO PATERNO',
      'APELLIDO MATERNO',
      'NOMBRES',
      'COD_EXAMEN',
      'COD_PUESTO',
      'PUESTO',
      'UNIDAD',
      'GRUPO',
      'AULA',
      'ESTADO PROCESAMIENTO',
      'ACIERTOS',
      'ERRORES',
      'BLANCOS',
      'PUNTAJE',
      'ORDEN MÉRITO PUESTO',
      'CONDICIÓN FINAL',
      'DETALLE / SUSTENTO',
    ])
    styleHeaderRow(padronHeader)

    const resultByDni = new Map()
    rankedResults.forEach((r) => {
      const d = stripDigits(r.dni)
      if (d) resultByDni.set(d, r)
    })
    const noCalifByDni = new Map()
    noCalificados.forEach((r) => {
      const d = stripDigits(r.dni)
      if (d) noCalifByDni.set(d, r)
    })

    const baseConsolidadoRows =
      archiveRows.length > 0
        ? archiveRows
        : [
            ...rankedResults,
            ...noCalificados,
          ]

    baseConsolidadoRows.forEach((cand, idx) => {
      const dni = stripDigits(cand.dni)
      const calRow = resultByDni.get(dni)
      const ncRow = noCalifByDni.get(dni)
      let estadoProc = 'CALIFICADO'
      let aciertos = ''
      let errores = ''
      let blancos = ''
      let puntaje = ''
      let ordenMerito = ''
      let condicionFinal = ''
      let detalle = ''

      if (calRow) {
        const st =
          calRow.correctCount !== undefined
            ? { correct: calRow.correctCount, incorrect: calRow.incorrectCount, blank: calRow.blankCount }
            : answerStats(calRow)
        estadoProc = 'CALIFICADO'
        aciertos = st.correct
        errores = st.incorrect
        blancos = st.blank
        puntaje = Number(calRow.score || 0)
        ordenMerito = calRow.positionInPrograma || calRow.position || ''
        condicionFinal = calRow.condicion || (calRow.isIngresante ? 'GANADOR / ALCANZÓ VACANTE' : 'EVALUADO')
      } else if (ncRow) {
        const mot = String(ncRow.motivo || '').toUpperCase()
        if (mot.includes('ANULADA')) {
          estadoProc = 'ANULADO POR COMISIÓN'
        } else if (mot.includes('AUSENTE') || mot.includes('SIN RESPUESTA')) {
          estadoProc = 'AUSENTE'
        } else {
          estadoProc = 'NO CALIFICADO'
        }
        condicionFinal = estadoProc
        detalle = [ncRow.motivo, ncRow.detalle, ncRow.documento].filter(Boolean).join(' — ')
      } else {
        estadoProc = 'AUSENTE'
        condicionFinal = 'AUSENTE'
        detalle = 'Sin lectura de ficha de respuestas'
      }

      sheetPadron.addRow([
        idx + 1,
        dni || cand.dni || '',
        cand.paterno || '',
        cand.materno || '',
        cand.nombres || '',
        cand.cod_examen || cand.codExamen || cand.area || '',
        cand.cod_puesto || cand.codPuesto || cand.codigo_programa || '',
        cand.puesto || cand.programa || '',
        cand.unidad || '',
        cand.grupo || '',
        cand.aula_padron || cand.aula || '',
        estadoProc,
        aciertos,
        errores,
        blancos,
        puntaje,
        ordenMerito,
        condicionFinal,
        detalle,
      ])
    })

    sheetPadron.columns = [
      { width: 7 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 30 },
      { width: 30 },
      { width: 12 },
      { width: 10 },
      { width: 22 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 16 },
      { width: 24 },
      { width: 42 },
    ]
    sheetPadron.views = [{ state: 'frozen', ySplit: 3 }]

    // ── HOJA 4: Empates Detectados ──────────────────────────────────────────
    const sheetEmpates = workbook.addWorksheet('Empates Detectados')
    const tiedRows = sortedByPuestoAndRank.filter((r) => r.isTied === true)
    const empateHeader = sheetEmpates.addRow([
      'COD_PUESTO',
      'PUESTO',
      'UNIDAD',
      'COD_EXAMEN',
      'DNI',
      'APELLIDOS Y NOMBRES',
      'PUNTAJE',
      'ACIERTOS',
      'ERRORES',
      'BLANCOS',
      'ORDEN MÉRITO PUESTO',
      'TAMAÑO EMPATE',
      'EMPATE EN CORTE VACANTE',
      'CONDICIÓN',
    ])
    styleHeaderRow(empateHeader, 'FF92400E')

    if (tiedRows.length > 0) {
      tiedRows.forEach((row) => {
        const st =
          row.correctCount !== undefined
            ? { correct: row.correctCount, incorrect: row.incorrectCount, blank: row.blankCount }
            : answerStats(row)
        const r = sheetEmpates.addRow([
          row.codPuesto || row.cod_puesto || '',
          row.puesto || row.programa || '',
          row.unidad || '',
          row.codExamen || row.cod_examen || row.area || '',
          row.dni || '',
          fullNameOf(row),
          Number(row.score || 0),
          st.correct,
          st.incorrect,
          st.blank,
          row.positionInPrograma || row.position || '',
          row.tieGroupSize || row.tieCount || 2,
          row.isCutoffTie ? 'SÍ (CORTE DE VACANTE)' : 'NO',
          row.condicion || '',
        ])
        if (row.isCutoffTie) {
          r.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
          })
        }
      })
    } else {
      sheetEmpates.addRow([
        '-',
        'Sin empates detectados',
        '-',
        '-',
        '-',
        'No se registraron puntajes empatados en los puestos evaluados.',
        '',
        '',
        '',
        '',
        '',
        '',
        'NO',
        '-',
      ])
    }

    sheetEmpates.columns = [
      { width: 14 },
      { width: 30 },
      { width: 30 },
      { width: 14 },
      { width: 12 },
      { width: 34 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 18 },
      { width: 16 },
      { width: 22 },
      { width: 24 },
    ]

    // ── HOJA 5: No Calificados y Anulados ───────────────────────────────────
    const sheetNoCalif = workbook.addWorksheet('No Calificados y Anulados')
    const ncHeader = sheetNoCalif.addRow([
      'DNI',
      'APELLIDO PATERNO',
      'APELLIDO MATERNO',
      'NOMBRES',
      'COD_EXAMEN',
      'COD_PUESTO',
      'PUESTO',
      'UNIDAD',
      'GRUPO',
      'AULA',
      'MOTIVO',
      'DETALLE / SUSTENTO',
      'DOCUMENTO DE REFERENCIA',
    ])
    styleHeaderRow(ncHeader, 'FF7C2D12')

    if (noCalificados.length > 0) {
      noCalificados.forEach((row) => {
        sheetNoCalif.addRow([
          row.dni || '',
          row.paterno || '',
          row.materno || '',
          row.nombres || '',
          row.codExamen || row.cod_examen || row.area || '',
          row.codPuesto || row.cod_puesto || '',
          row.puesto || row.programa || '',
          row.unidad || '',
          row.grupo || '',
          row.aula || '',
          row.motivo || '',
          row.detalle || '',
          row.documento || '',
        ])
      })
    } else {
      sheetNoCalif.addRow([
        '-',
        '-',
        '-',
        'Sin registros de ausentes o anulados',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        'Sin observaciones',
        'Todos los postulantes del padrón fueron calificados.',
        '-',
      ])
    }

    sheetNoCalif.columns = [
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 28 },
      { width: 28 },
      { width: 12 },
      { width: 10 },
      { width: 28 },
      { width: 45 },
      { width: 26 },
    ]

    // ── HOJA 6: Excepciones y Pruebas ───────────────────────────────────────
    const sheetExc = workbook.addWorksheet('Excepciones y Pruebas')
    sheetExc.mergeCells('A1:F1')
    sheetExc.getCell('A1').value =
      'AUDITORÍA DE EXCEPCIONES, ANULACIONES Y 5 PRUEBAS SINTÉTICAS PRE-CALIFICACIÓN'
    sheetExc.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF0A2446' } }
    sheetExc.addRow(['Huella SHA-256 Canónica de Configuración:', configSha256])
    sheetExc.addRow(['Huella en Bloques de 8:', formatHashBlocks(configSha256, 8)])
    sheetExc.addRow([])

    const qExcTitle = sheetExc.addRow(['1. EXCEPCIONES DE PREGUNTAS Y FE DE ERRATAS'])
    qExcTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0A2446' } }
    const qExcHeader = sheetExc.addRow([
      'COD_EXAMEN',
      'N° PREGUNTA',
      'TIPO DE EXCEPCIÓN',
      'RESPUESTAS VÁLIDAS',
      'MOTIVO / JUSTIFICACIÓN',
      'DOCUMENTO DE SUSTENTO',
    ])
    styleHeaderRow(qExcHeader)

    if (questionExceptions.length > 0) {
      questionExceptions.forEach((exc) => {
        sheetExc.addRow([
          exc.codExamen || exc.area || 'TODOS',
          exc.questionNumber || '',
          exc.type || '',
          exc.validAnswers || '-',
          exc.reason || '',
          exc.documentRef || '',
        ])
      })
    } else {
      sheetExc.addRow(['-', '-', 'SIN EXCEPCIONES', '-', 'No se aplicaron excepciones de preguntas.', '-'])
    }

    sheetExc.addRow([])
    const cExcTitle = sheetExc.addRow(['2. POSTULANTES ANULADOS POR DISPOSICIÓN DE LA COMISIÓN'])
    cExcTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0A2446' } }
    const cExcHeader = sheetExc.addRow([
      'DNI',
      'POSTULANTE',
      'COD_EXAMEN',
      'COD_PUESTO',
      'MOTIVO DE ANULACIÓN',
      'ACTA / DOCUMENTO DE SUSTENTO',
    ])
    styleHeaderRow(cExcHeader, 'FF7C2D12')

    const effectiveCandExc = candidateExceptions.length > 0 ? candidateExceptions : anuladosComision
    if (effectiveCandExc.length > 0) {
      effectiveCandExc.forEach((exc) => {
        sheetExc.addRow([
          exc.dni || '',
          fullNameOf(exc) || exc.nombres || '',
          exc.codExamen || exc.cod_examen || '',
          exc.codPuesto || exc.cod_puesto || '',
          exc.reason || exc.detalle || exc.motivo || '',
          exc.documentRef || exc.documento || '',
        ])
      })
    } else {
      sheetExc.addRow(['-', 'Sin postulantes anulados', '-', '-', 'Ninguna participación fue anulada.', '-'])
    }

    sheetExc.addRow([])
    const synTitle = sheetExc.addRow(['3. BATERÍA DE 5 PRUEBAS SINTÉTICAS PRE-CALIFICACIÓN'])
    synTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0A2446' } }
    const synHeader = sheetExc.addRow([
      'CÓDIGO',
      'CASO DE PRUEBA SINTÉTICO',
      'PUNTAJE ESPERADO',
      'PUNTAJE OBTENIDO',
      'ESTADO',
      'DETALLE DE VERIFICACIÓN',
    ])
    styleHeaderRow(synHeader, 'FF15803D')

    ;(syntheticSuite.cases || []).forEach((tc) => {
      sheetExc.addRow([
        tc.code,
        tc.name,
        tc.expectedScore !== null && tc.expectedScore !== undefined ? Number(tc.expectedScore).toFixed(3) : 'EXCLUIDO RANKING',
        tc.obtainedScore !== null && tc.obtainedScore !== undefined ? Number(tc.obtainedScore).toFixed(3) : 'ANULADO AUDITADO',
        tc.passed ? 'CONFORME (OK)' : 'OBSERVADO',
        tc.details || tc.description || '',
      ])
    })

    sheetExc.columns = [
      { width: 22 },
      { width: 42 },
      { width: 22 },
      { width: 22 },
      { width: 28 },
      { width: 48 },
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const filename =
      options.filename ||
      buildFilename('RESULTADOS_OFICIALES_PJ', convocatoriaName || 'CSJ_PUNO_728', 'consolidado', 'xlsx')
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, filename)
    return registerExportedArtifact({
      name: filename,
      type: 'excel',
      label: 'Padrón General y Ranking Oficial por Puesto PJ (Excel)',
      buffer,
    })
  }

  async function exportScoresToExcel(rankedResults, convocatoriaName = '', options = {}) {
    if (!rankedResults?.length) return

    const processType = options.processType || 'simulacro'
    if (processType === 'poder_judicial') {
      return exportPjResultsToExcel(rankedResults, convocatoriaName, options)
    }

    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()

    if (processType !== 'real') {
      const area = options.area || rankedResults[0]?.area || 'Área'
      addSummarySheet(workbook, rankedResults, area, options.areaSummary, options.areaStats, convocatoriaName)
      addSimulacroResultsSheet(workbook, rankedResults, area, convocatoriaName)
      addObservationsSheet(workbook, options.areaSummary, rankedResults)
      addNoCalificadosSheet(workbook, options.areaSummary?.noCalificados || [], { includeProgram: false })

      const buffer = await workbook.xlsx.writeBuffer()
      const filename = buildFilename('simulacro-resultados', convocatoriaName, area, 'xlsx')
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(blob, filename)
      return registerExportedArtifact({
        name: filename,
        type: 'excel',
        label: `Resultados de Simulacro — ${displayAreaName(area)} (Excel)`,
        buffer,
      })
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
    const filename = buildFilename('resultados', convocatoriaName, options.area || 'todas', 'xlsx')
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, filename)
    return registerExportedArtifact({
      name: filename,
      type: 'excel',
      label: 'Padrón de Resultados Oficiales (Excel)',
      buffer,
    })
  }

  async function _loadLogoBase64(url = '/unap.png') {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
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

  async function exportPjPublicationPdf(rankedResults = [], summary = {}, convocatoriaName = '', options = {}) {
    if (!rankedResults?.length) return null

    const { jsPDF, autoTable } = await loadPdfExportDeps()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const logoUnap = await _loadLogoBase64('/unap.png')
    const logoPj = await _loadLogoBase64('/actas-static/assets/logo-pj.jpg')

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const dateStr = new Date().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const sortedRows = [...rankedResults].sort((a, b) => {
      const pA = String(a.codPuesto || a.cod_puesto || a.programa || '')
      const pB = String(b.codPuesto || b.cod_puesto || b.programa || '')
      const cmp = pA.localeCompare(pB, 'es', { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return cmp
      return Number(a.positionInPrograma || a.position || 0) - Number(b.positionInPrograma || b.position || 0)
    })

    const byPuesto = new Map()
    sortedRows.forEach((row) => {
      const codPuesto = row.codPuesto || row.cod_puesto || ''
      const puesto = row.puesto || row.programa || '(Sin puesto)'
      const unidad = row.unidad || ''
      const key = `${codPuesto}__${puesto}__${unidad}`
      if (!byPuesto.has(key)) {
        byPuesto.set(key, {
          codPuesto,
          puesto,
          unidad,
          codExamen: row.codExamen || row.cod_examen || row.area || '',
          rows: [],
        })
      }
      byPuesto.get(key).rows.push(row)
    })

    const drawHeader = () => {
      if (logoUnap) {
        try { doc.addImage(logoUnap, 'PNG', 10, 7, 16, 16) } catch {}
      }
      if (logoPj) {
        try { doc.addImage(logoPj, 'JPEG', pageW - 26, 7, 16, 16) } catch {}
      }

      doc.setFontSize(11.5)
      doc.setTextColor(10, 36, 70)
      doc.setFont(undefined, 'bold')
      doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO DE PUNO', pageW / 2, 11, { align: 'center' })

      doc.setFontSize(8.5)
      doc.setTextColor(30, 58, 95)
      doc.text('DIRECCIÓN DE ADMISIÓN — CONVENIO CORTE SUPERIOR DE JUSTICIA DE PUNO', pageW / 2, 15.5, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(10, 36, 70)
      doc.text(
        `RESULTADOS OFICIALES POR PUESTO — ${convocatoriaName || 'PROCESO DE SELECCIÓN DE PERSONAL A PLAZO INDETERMINADO N.° 001-2026-UE-PUNO'}`,
        pageW / 2,
        21,
        { align: 'center' },
      )

      doc.setDrawColor(10, 36, 70)
      doc.setLineWidth(0.5)
      doc.line(10, 24.5, pageW - 10, 24.5)
      doc.setDrawColor(221, 171, 68)
      doc.setLineWidth(0.4)
      doc.line(10, 25.5, pageW - 10, 25.5)
    }

    const drawFooterSignatures = (pageNum) => {
      const sigY = pageH - 20
      doc.setDrawColor(100, 116, 139)
      doc.setLineWidth(0.3)
      doc.line(22, sigY, 88, sigY)
      doc.line(pageW - 88, sigY, pageW - 22, sigY)

      doc.setFontSize(7)
      doc.setTextColor(15, 23, 42)
      doc.setFont(undefined, 'bold')
      doc.text('Dr. Bladimiro Centeno Herrera', 55, sigY + 3.5, { align: 'center' })
      doc.text('Abog. Edson Teofilo Mamani Quispe', pageW - 55, sigY + 3.5, { align: 'center' })

      doc.setFont(undefined, 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(100, 116, 139)
      doc.text('Director de Admisión — UNA-PUNO (DNI 29679918)', 55, sigY + 7, { align: 'center' })
      doc.text('Coordinador de Seguridad Integral — CSJ Puno (DNI 46829313)', pageW - 55, sigY + 7, { align: 'center' })

      doc.line(10, pageH - 9.5, pageW - 10, pageH - 9.5)
      doc.text(`Sistema de Calificación Óptica UNA-PUNO — Fecha: ${dateStr}`, 10, pageH - 6)
      doc.text(`Página ${pageNum}`, pageW - 10, pageH - 6, { align: 'right' })
    }

    drawHeader()

    const bodyRows = []
    Array.from(byPuesto.values()).forEach((group) => {
      const headerLabel = [
        group.codPuesto ? `[${group.codPuesto}]` : '',
        group.puesto,
        group.unidad ? `— UNIDAD: ${group.unidad}` : '',
        group.codExamen ? `(Examen: ${group.codExamen} | Evaluados: ${group.rows.length})` : `(Evaluados: ${group.rows.length})`,
      ]
        .filter(Boolean)
        .join(' ')

      bodyRows.push([
        {
          content: headerLabel,
          colSpan: 6,
          styles: {
            fillColor: [10, 36, 70],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
          },
        },
      ])

      group.rows.forEach((row, idx) => {
        const fullName = [row.paterno, row.materno, row.nombres]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .join(' ')
        const condicion =
          row.condicion ||
          (row.isCutoffTie
            ? 'EMPATE EN CORTE'
            : row.isIngresante
              ? 'ALCANZÓ VACANTE / APTO'
              : row.isApto === false
                ? 'NO APTO'
                : 'APTO (SIN VACANTE)')
        bodyRows.push([
          row.positionInPrograma || row.position || idx + 1,
          row.dni || '',
          fullName,
          row.codExamen || row.area || '',
          Number(row.score || 0).toFixed(3),
          condicion,
        ])
      })
    })

    autoTable(doc, {
      startY: 29,
      head: [['ORDEN MÉRITO', 'DNI', 'APELLIDOS Y NOMBRES', 'EXAMEN', 'PUNTAJE', 'CONDICIÓN']],
      body: bodyRows,
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      bodyStyles: { fontSize: 7.2, cellPadding: 1.8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 74 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
        5: { halign: 'center', cellWidth: 42 },
      },
      margin: { top: 29, bottom: 26, left: 10, right: 10 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = String(data.cell.raw || '').toUpperCase()
          if (val.includes('EMPATE')) {
            data.cell.styles.textColor = [146, 64, 14]
            data.cell.styles.fontStyle = 'bold'
          } else if (val.includes('VACANTE') || val.includes('GANADOR')) {
            data.cell.styles.textColor = [21, 128, 61]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
      didDrawPage: () => {
        const pg = doc.internal?.getCurrentPageInfo?.()?.pageNumber || 1
        if (pg > 1) {
          drawHeader()
        }
        drawFooterSignatures(pg)
      },
    })

    const filename =
      options.filename ||
      buildFilename('PUBLICACION_OFICIAL_PJ', convocatoriaName || 'CSJ_PUNO_728', 'puestos', 'pdf')
    const pdfBuffer = _extractPdfBuffer(doc)
    doc.save(filename)
    return registerExportedArtifact({
      name: filename,
      type: 'pdf',
      label: 'Publicación Oficial en Orden de Mérito por Puesto PJ (PDF)',
      buffer: pdfBuffer,
    })
  }

  async function exportIngresantesPdf(rankedResults, summary, convocatoriaName = '', processType = 'simulacro', options = {}) {
    if (processType === 'poder_judicial' || options?.processType === 'poder_judicial') {
      return exportPjPublicationPdf(rankedResults, summary, convocatoriaName, options)
    }

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
          didDrawPage: () => {
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
          didDrawPage: () => {
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
    const filename = `ingresantes${modoSuffix}-${safeName}-${date}.pdf`
    const pdfBuffer = _extractPdfBuffer(doc)
    doc.save(filename)
    return registerExportedArtifact({
      name: filename,
      type: 'pdf',
      label: 'Relación de Ingresantes / Ganadores (PDF)',
      buffer: pdfBuffer,
    })
  }

  async function exportScoresToPdf(rankedResults, summary, convocatoriaName = '', options = {}) {
    if (!rankedResults?.length) return
    const processType = options.processType || 'simulacro'
    if (processType === 'poder_judicial') {
      return exportPjPublicationPdf(rankedResults, summary, convocatoriaName, options)
    }

    const { jsPDF, autoTable } = await loadPdfExportDeps()
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

    const filename = buildFilename(isReal ? 'resultados' : 'simulacro-ranking', convocatoriaName, options.area || 'todas', 'pdf')
    const pdfBuffer = _extractPdfBuffer(doc)
    doc.save(filename)
    return registerExportedArtifact({
      name: filename,
      type: 'pdf',
      label: 'Relación en Orden de Mérito para Publicación (PDF)',
      buffer: pdfBuffer,
    })
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

    const filename = buildFilename('simulacro-ranking-todo', convocatoriaName, 'todas', 'pdf')
    const pdfBuffer = _extractPdfBuffer(doc)
    doc.save(filename)
    return registerExportedArtifact({
      name: filename,
      type: 'pdf',
      label: 'Consolidado General de Simulacro (PDF)',
      buffer: pdfBuffer,
    })
  }

  return {
    exportedArtifacts,
    registerExportedArtifact,
    clearExportedArtifacts,
    exportScoresToExcel,
    exportSimulacroAreasToExcel,
    exportPjResultsToExcel,
    exportScoresToPdf,
    exportSimulacroAreasToPdf,
    exportIngresantesPdf,
    exportPjPublicationPdf,
  }
}
