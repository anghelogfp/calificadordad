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
  createResponseRow,
  buildResponseObservation,
  parseResponseLine,
} from '@/utils/parsers'

export { createResponseRow, buildResponseObservation }

/**
 * Composable para gestión de respuestas
 */
export function useResponses(identifierLookup, identifierLookupByLitho) {
  const tableState = useTableState({
    storageKey: STORAGE_KEYS.RESPONSES,
    createRow: createResponseRow,
    filterFn: (row, searchValue) => {
      const needle = normalize(searchValue)
      return (
        normalize(row.dni).includes(needle) ||
        normalize(row.lectura).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.answers).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    },
  })

  // Sources (archivos importados)
  const sources = useStorage(STORAGE_KEYS.RESPONSES_SOURCES, [])
  if (!Array.isArray(sources.value)) {
    sources.value = []
  }

  // Computed
  const responsesHasData = computed(() => tableState.rows.value.length > 0)
  const sourcesCount = computed(() => sources.value.length)

  const observations = computed(() =>
    tableState.rows.value.filter(
      (row) => row.observaciones && row.observaciones !== 'Sin observaciones'
    )
  )

  const observationCount = computed(() => observations.value.length)

  // Lookup por DNI
  const responsesByDni = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      const dni = stripDigits(row.dni)
      if (!dni) return
      if (!map.has(dni)) {
        map.set(dni, [])
      }
      map.get(dni).push(row)
    })
    return map
  })

  /**
   * Aplica datos de identificador a una fila de respuesta
   */
  function applyIdentifierDataToResponseRow(row, lookup = identifierLookup?.value, lithoLookup = identifierLookupByLitho?.value) {
    const key = buildResponseMatchKey(row)
    let match = key && lookup ? lookup.get(key) : undefined
    if (!match && lithoLookup) {
      const fallback = lithoLookup.get(stripDigits(row.litho))
      match = fallback
    }

    if (match) {
      row.dni = match.dni
      row.tipo = match.tipo
    } else {
      row.dni = row.dni ? stripDigits(row.dni) : ''
      row.tipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
    }

    const obs = buildResponseObservation(row)
    if (row.observaciones !== obs) {
      row.observaciones = obs
    }
  }

  /**
   * Lee archivos de respuestas
   */
  async function readResponseFiles(files) {
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
          const result = parseResponseLine(line, index + 1)
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
  async function onResponseDrop(event) {
    event.preventDefault()
    tableState.isDragging.value = false
    const files = Array.from(event.dataTransfer?.files || [])
    if (!files.length) return
    await readResponseFiles(files)
  }

  /**
   * Handler para cambio de archivo
   */
  async function onResponseFileChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    await readResponseFiles(files)
    event.target.value = ''
  }

  /**
   * Elimina un source y sus filas asociadas
   */
  function removeResponsesSource(sourceId) {
    tableState.rows.value = tableState.rows.value.filter((row) => row.sourceId !== sourceId)
    sources.value = sources.value.filter((source) => source.id !== sourceId)
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Limpia todo incluyendo sources
   */
  function clearAllResponses() {
    tableState.rows.value = []
    sources.value = []
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Exporta respuestas a Excel
   */
  async function exportResponsesToExcel() {
    if (!tableState.rows.value.length) return
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Respuestas')
    worksheet.columns = [
      { header: 'N° lectura', key: 'lectura' },
      { header: 'DNI', key: 'dni' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Litho', key: 'litho' },
      { header: 'Respuestas', key: 'answers' },
      { header: 'Observaciones', key: 'observaciones' },
    ]

    tableState.rows.value.forEach(({ id, sourceId, header, examCode, folio, indicator, ...rest }) => {
      worksheet.addRow(rest)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'respuestas.xlsx')
  }

  /**
   * Exporta observaciones a PDF
   */
  function exportResponsesObservationsPdf() {
    const rows = observations.value
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Observaciones de respuestas', 14, 18)

    if (rows.length === 0) {
      doc.setFontSize(12)
      doc.text('No se registraron observaciones en las hojas de respuestas cargadas.', 14, 28)
    } else {
      const tableBody = rows.map((row, index) => [
        index + 1,
        row.dni || '-',
        row.lectura || '-',
        row.tipo || '-',
        row.litho || '-',
        row.observaciones,
      ])
      autoTable(doc, {
        startY: 24,
        head: [['#', 'DNI', 'N° lectura', 'Tip', 'Litho', 'Observaciones']],
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

    doc.save('observaciones-respuestas.pdf')
  }

  return {
    // Estado de tabla
    ...tableState,

    // Estado específico
    sources,
    responsesHasData,
    sourcesCount,
    observations,
    observationCount,
    responsesByDni,

    // Métodos específicos
    applyIdentifierDataToResponseRow,
    readResponseFiles,
    onResponseDrop,
    onResponseFileChange,
    removeResponsesSource,
    clearAllResponses,
    exportResponsesToExcel,
    exportResponsesObservationsPdf,
  }
}
