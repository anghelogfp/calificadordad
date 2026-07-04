import { computed, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useTableState } from './useTableState'
import { DEFAULT_DAT_FORMAT } from '@/constants'
import { generateId, normalize, stripDigits, buildResponseMatchKey } from '@/utils/helpers'
import { loadExcelExportDeps, loadPdfExportDeps } from '@/utils/exportLoaders'
import {
  createIdentifierRow,
  buildIdentifierObservation,
  parseIdentifierLine,
} from '@/utils/parsers'
import { apiFetch } from '@/utils/apiFetch'

export { createIdentifierRow, buildIdentifierObservation }

function summarizeObservations(rows) {
  const summary = new Map()
  rows.forEach((row) => {
    String(row.observaciones || '')
      .split(' · ')
      .filter(Boolean)
      .forEach((issue) => summary.set(issue, (summary.get(issue) || 0) + 1))
  })
  return Array.from(summary.entries()).map(([label, count]) => ({ label, count }))
}

/**
 * Composable para gestión de identificadores
 */
export function useIdentifiers(formatConfig) {
  const effectiveFormatConfig = () => formatConfig?.value || DEFAULT_DAT_FORMAT
  const tableState = useTableState({
    pageSize: 10,
    createRow: createIdentifierRow,
    filterFn: (row, searchValue) => {
      const needle = normalize(searchValue)
      return (
        normalize(row.dni).includes(needle) ||
        normalize(row.lectura).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    },
  })

  // Sources (archivos importados)
  const sources = ref([])
  const apiLoading = ref(false)
  const apiSyncing = ref(false)
  const apiReady = ref(false)
  let skipNextApiSync = false

  // Computed
  const identifierHasData = computed(() => tableState.rows.value.length > 0)

  const observations = computed(() =>
    tableState.rows.value.filter(
      (row) => row.observaciones && row.observaciones !== 'Sin observaciones'
    )
  )

  const observationCount = computed(() => observations.value.length)
  const observationSummary = computed(() => summarizeObservations(observations.value))
  const observationByRowId = computed(() => {
    const map = new Map()
    observations.value.forEach(row => map.set(row.id, row))
    return map
  })
  // Lookup por clave de match
  const identifierLookup = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      const key = buildResponseMatchKey(row)
      map.set(key, row)
    })
    return map
  })

  // Lookup por litho
  const identifierLookupByLitho = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      const litho = stripDigits(row.litho)
      if (litho && !map.has(litho)) {
        map.set(litho, row)
      }
    })
    return map
  })

  async function initializeIdentifiers() {
    apiLoading.value = true
    try {
      const [rowsRes, sourcesRes] = await Promise.all([
        apiFetch('/identificadores/'),
        apiFetch('/identifier-sources/'),
      ])
      if (!rowsRes.ok || !sourcesRes.ok) throw new Error('No se pudieron cargar los identificadores.')

      const [rowsData, sourcesData] = await Promise.all([
        rowsRes.json(),
        sourcesRes.json(),
      ])

      apiReady.value = true
      if (rowsData.length > 0 || sourcesData.length > 0) {
        skipNextApiSync = true
        tableState.setRows(rowsData)
        sources.value = sourcesData
      } else {
        skipNextApiSync = true
        tableState.setRows([])
        sources.value = []
      }
    } catch (error) {
      console.warn('[identifiers] API no disponible, manteniendo estado local en memoria:', error)
      apiReady.value = false
    } finally {
      apiLoading.value = false
    }
  }

  async function syncIdentifiersToApi() {
    if (!apiReady.value) return
    apiSyncing.value = true
    try {
      const res = await apiFetch('/identificadores/bulk_replace/', {
        method: 'POST',
        body: JSON.stringify({
          rows: tableState.rows.value,
          sources: sources.value,
        }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar los identificadores.')
    } catch (error) {
      console.warn('[identifiers] No se pudo sincronizar con API:', error)
    } finally {
      apiSyncing.value = false
    }
  }

  watchDebounced(
    [tableState.rows, sources],
    () => {
      if (skipNextApiSync) {
        skipNextApiSync = false
        return
      }
      syncIdentifiersToApi()
    },
    { debounce: 800, deep: true },
  )

  /**
   * Lee archivos de identificadores
   */
  async function readIdentifierFiles(files) {
    tableState.importError.value = ''
    const aggregatedRows = []
    const aggregatedErrors = []

    for (const file of files) {
      const sourceId = generateId()
      try {
        const text = await file.text()
        const sanitizedText = text.split('\u001a').join('')
        const lines = sanitizedText.split(/\r?\n/)
        const parsedRows = []
        const fileErrors = []

        lines.forEach((line, index) => {
          const result = parseIdentifierLine(line, index + 1, effectiveFormatConfig())
          if (!result) return
          if (result.error) {
            fileErrors.push(`${file.name}: ${result.error}`)
          } else {
            parsedRows.push({
              ...result.row,
              sourceId,
            })
          }
        })

        if (parsedRows.length) {
          aggregatedRows.push(...parsedRows)
        }

        if (fileErrors.length) {
          aggregatedErrors.push(...fileErrors)
        } else if (!parsedRows.length) {
          aggregatedErrors.push(`${file.name}: no se encontraron registros válidos.`)
        }

        const contentLines = lines.filter((line) => line.trim().length > 0).length
        sources.value = [
          ...sources.value,
          {
            id: sourceId,
            name: file.name,
            timestamp: new Date().toISOString(),
            totalLines: contentLines,
            validRows: parsedRows.length,
            errorCount: fileErrors.length,
          },
        ]
      } catch (error) {
        console.error(error)
        aggregatedErrors.push(`${file.name}: error al leer el archivo.`)
      }
    }

    if (aggregatedRows.length) {
      tableState.rows.value = [...tableState.rows.value, ...aggregatedRows]
      tableState.clearSelection()
      tableState.clearEditing()
    }

    if (aggregatedErrors.length) {
      const preview = aggregatedErrors.slice(0, 3).join(' | ')
      tableState.importError.value =
        aggregatedErrors.length > 3 ? `${preview} ...` : preview
    } else if (aggregatedRows.length === 0) {
      tableState.importError.value = 'No se encontraron registros en los archivos seleccionados.'
    } else {
      tableState.importError.value = ''
    }
  }

  /**
   * Handler para drop de archivos
   */
  async function onIdentifierDrop(event) {
    event.preventDefault()
    tableState.isDragging.value = false
    const files = Array.from(event.dataTransfer?.files || [])
    if (!files.length) return
    await readIdentifierFiles(files)
  }

  /**
   * Handler para cambio de archivo
   */
  async function onIdentifierFileChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    await readIdentifierFiles(files)
    event.target.value = ''
  }

  /**
   * Elimina un source y sus filas asociadas
   */
  function removeIdentifierSource(sourceId) {
    tableState.rows.value = tableState.rows.value.filter((row) => row.sourceId !== sourceId)
    sources.value = sources.value.filter((source) => source.id !== sourceId)
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Limpia todo incluyendo sources
   */
  function clearAllIdentifiers() {
    tableState.rows.value = []
    sources.value = []
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Exporta identificadores a Excel
   */
  async function exportIdentifiersToExcel() {
    if (!tableState.rows.value.length) return
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Identificadores')
    worksheet.columns = [
      { header: 'N° lectura', key: 'lectura' },
      { header: 'DNI', key: 'dni' },
      { header: 'Aula', key: 'aula' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Litho', key: 'litho' },
      { header: 'Indicador', key: 'indicator' },
      { header: 'Observaciones', key: 'observaciones' },
    ]

    tableState.rows.value.forEach(({ id, rawLine, header, examCode, folio, answers, sourceId, ...rest }) => {
      worksheet.addRow(rest)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'identificadores.xlsx')
  }

  async function exportIdentifierObservationsToExcel() {
    const rows = observations.value
    if (!rows.length) return
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Observados')
    worksheet.columns = [
      { header: 'N° lectura', key: 'lectura', width: 14 },
      { header: 'DNI', key: 'dni', width: 12 },
      { header: 'Aula', key: 'aula', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 8 },
      { header: 'Litho', key: 'litho', width: 12 },
      { header: 'Observaciones', key: 'observaciones', width: 60 },
    ]
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
      cell.alignment = { horizontal: 'center' }
    })
    rows.forEach(({ id, rawLine, header, examCode, folio, answers, sourceId, ...rest }) => {
      worksheet.addRow(rest)
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `observados-identificadores-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  /**
   * Exporta observaciones a PDF
   */
  async function exportObservationsPdf() {
    const rows = observations.value
    const { jsPDF, autoTable } = await loadPdfExportDeps()
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Reporte de observaciones', 14, 18)

    if (rows.length === 0) {
      doc.setFontSize(12)
      doc.text('No se registraron observaciones en los registros cargados.', 14, 28)
    } else {
      const tableBody = rows.map((row, index) => [
        index + 1,
        row.dni || '-',
        row.lectura || '-',
        row.aula || '-',
        row.observaciones,
      ])
      autoTable(doc, {
        startY: 24,
        head: [['#', 'DNI', 'N° lectura', 'Aula', 'Observaciones']],
        body: tableBody,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [29, 78, 216],
          textColor: [255, 255, 255],
        },
      })
    }

    doc.save('observaciones.pdf')
  }

  return {
    // Estado de tabla
    ...tableState,

    // Estado específico
    sources,
    apiLoading,
    apiSyncing,
    apiReady,
    identifierHasData,
    observations,
    observationCount,
    observationSummary,
    observationByRowId,
    identifierLookup,
    identifierLookupByLitho,

    // Métodos específicos
    initializeIdentifiers,
    syncIdentifiersToApi,
    readIdentifierFiles,
    onIdentifierDrop,
    onIdentifierFileChange,
    removeIdentifierSource,
    clearAllIdentifiers,
    exportIdentifiersToExcel,
    exportIdentifierObservationsToExcel,
    exportObservationsPdf,
  }
}
