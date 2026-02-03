import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useTableState } from './useTableState'
import { STORAGE_KEYS } from '@/constants'
import { generateId, normalize, stripDigits, buildResponseMatchKey } from '@/utils/helpers'
import {
  createIdentifierRow,
  buildIdentifierObservation,
  parseIdentifierLine,
} from '@/utils/parsers'

export { createIdentifierRow, buildIdentifierObservation }

/**
 * Composable para gestión de identificadores
 */
export function useIdentifiers() {
  const tableState = useTableState({
    storageKey: STORAGE_KEYS.IDENTIFIER,
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
  const sources = useStorage(STORAGE_KEYS.IDENTIFIER_SOURCES, [])
  if (!Array.isArray(sources.value)) {
    sources.value = []
  }

  // Computed
  const identifierHasData = computed(() => tableState.rows.value.length > 0)

  const observations = computed(() =>
    tableState.rows.value.filter(
      (row) => row.observaciones && row.observaciones !== 'Sin observaciones'
    )
  )

  const observationCount = computed(() => observations.value.length)

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
          const result = parseIdentifierLine(line, index + 1)
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

  /**
   * Exporta observaciones a PDF
   */
  function exportObservationsPdf() {
    const rows = observations.value
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
    identifierHasData,
    observations,
    observationCount,
    identifierLookup,
    identifierLookupByLitho,

    // Métodos específicos
    readIdentifierFiles,
    onIdentifierDrop,
    onIdentifierFileChange,
    removeIdentifierSource,
    clearAllIdentifiers,
    exportIdentifiersToExcel,
    exportObservationsPdf,
  }
}
