import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useTableState } from './useTableState'
import { STORAGE_KEYS, ANSWER_KEY_COLUMNS, ANSWER_KEY_AREAS } from '@/constants'
import {
  generateId,
  normalize,
  normalizeArea,
  stripDigits,
  buildResponseMatchKey,
  buildAreaTipoKey,
} from '@/utils/helpers'
import { parseIdentifierLine, parseResponseLine, readLinesFromFile } from '@/utils/parsers'

/**
 * Crea una fila de clave de respuesta
 */
export function createAnswerKeyRow(data = {}) {
  const row = {
    id: data.id ?? generateId(),
    area: normalizeArea(data.area),
    tipo: data.tipo ?? '',
    answers: data.answers ?? '',
    indicator: data.indicator ?? '',
    folio: data.folio ?? '',
    litho: data.litho ?? '',
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }

  row.observaciones = buildAnswerKeyObservation(row)
  return row
}

/**
 * Construye observación para una clave de respuesta
 */
export function buildAnswerKeyObservation(row) {
  const issues = []

  const tipo = (row.tipo || '').trim()
  if (!tipo) {
    issues.push('Tipo no informado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== 6) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answersNormalized = answersRaw.replaceAll(/\s/g, '')
  if (!answersNormalized) {
    issues.push('Sin respuestas registradas')
  } else if (answersNormalized.length !== 60) {
    issues.push(`Cadena incompleta (${answersNormalized.length}/60)`)
  } else if (/[^A-E*]/.test(answersNormalized)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Composable para gestión de claves de respuestas
 */
export function useAnswerKeys(archiveRows) {
  const tableState = useTableState({
    storageKey: STORAGE_KEYS.ANSWER_KEYS,
    createRow: createAnswerKeyRow,
    filterFn: (row, searchValue) => {
      const needle = normalize(searchValue)
      return (
        normalize(row.area).includes(needle) ||
        normalize(row.tipo).includes(needle) ||
        normalize(row.litho).includes(needle) ||
        normalize(row.answers).includes(needle) ||
        normalize(row.observaciones).includes(needle)
      )
    },
  })

  // Sources (archivos importados)
  const sources = useStorage(STORAGE_KEYS.ANSWER_KEY_SOURCES, [])
  if (!Array.isArray(sources.value)) {
    sources.value = []
  }

  // Estado para formulario de importación
  const answerKeyArea = ref(ANSWER_KEY_AREAS[0])
  const identificationFile = ref(null)
  const responsesFile = ref(null)
  const identificationInputRef = ref(null)
  const responsesInputRef = ref(null)

  // Computed
  const answerKeyHasData = computed(() => tableState.rows.value.length > 0)
  const sourcesCount = computed(() => sources.value.length)

  const observations = computed(() =>
    tableState.rows.value.filter(
      (row) => row.observaciones && row.observaciones !== 'Sin observaciones'
    )
  )

  const observationCount = computed(() => observations.value.length)

  // Opciones de área basadas en archivos cargados
  const answerKeyAreaOptions = computed(() => {
    const archiveAreas = (archiveRows?.value || [])
      .map((row) => normalizeArea(row.area))
      .filter((area) => ANSWER_KEY_AREAS.includes(area))
    const unique = new Set([...ANSWER_KEY_AREAS, ...archiveAreas])
    return ANSWER_KEY_AREAS.filter((area) => unique.has(area))
  })

  // Lookup por clave de match
  const answerKeyLookupByMatch = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      map.set(buildResponseMatchKey(row), row)
    })
    return map
  })

  // Lookup por área y tipo
  const answerKeyLookupByAreaTipo = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      const key = buildAreaTipoKey(row.area, row.tipo)
      if (!key) return
      map.set(key, row)
    })
    return map
  })

  /**
   * Lee archivos de claves de respuestas
   */
  async function readAnswerKeyFiles(area, identificationFileParam, responsesFileParam) {
    const identifierResults = await readLinesFromFile(identificationFileParam, parseIdentifierLine)
    const responseResults = await readLinesFromFile(responsesFileParam, parseResponseLine)

    const identifierRowsOnly = identifierResults.filter((item) => item && item.row)
    const responseRowsOnly = responseResults.filter((item) => item && item.row)
    const identifierErrors = identifierResults.filter((item) => item && item.error)
    const responseErrors = responseResults.filter((item) => item && item.error)

    const lookup = new Map(
      identifierRowsOnly.map(({ row }) => [buildResponseMatchKey(row), row])
    )
    const fallbackByLitho = new Map(
      identifierRowsOnly
        .map(({ row }) => [stripDigits(row.litho), row])
        .filter(([key]) => key)
    )

    const createdAt = new Date().toISOString()
    const sourceId = generateId()
    const combinedRows = responseRowsOnly.map(({ row }) => {
      const key = buildResponseMatchKey(row)
      let matched = lookup.get(key)

      if (!matched) {
        matched = fallbackByLitho.get(stripDigits(row.litho))
      }

      const tipo = matched ? matched.tipo : ''

      const answerKeyRow = createAnswerKeyRow({
        area,
        tipo,
        answers: row.answers,
        indicator: row.indicator,
        folio: row.folio,
        litho: row.litho,
        sourceId,
      })

      const baseObservation = buildAnswerKeyObservation(answerKeyRow)
      if (matched) {
        answerKeyRow.observaciones = baseObservation
      } else if (baseObservation === 'Sin observaciones') {
        answerKeyRow.observaciones = 'Sin coincidencia en identificador'
      } else {
        answerKeyRow.observaciones = `${baseObservation} · Sin coincidencia en identificador`
      }

      return answerKeyRow
    })

    const errorMessages = [
      ...identifierErrors.map(({ error }) => `${identificationFileParam.name}: ${error}`),
      ...responseErrors.map(({ error }) => `${responsesFileParam.name}: ${error}`),
    ]
    if (combinedRows.length === 0) {
      if (errorMessages.length) {
        const preview = errorMessages.slice(0, 3).join(' | ')
        tableState.importError.value = errorMessages.length > 3 ? `${preview} ...` : preview
      } else {
        tableState.importError.value = 'No se encontraron claves válidas en los archivos seleccionados.'
      }
      return
    }

    tableState.rows.value = [...tableState.rows.value, ...combinedRows]
    sources.value = [
      ...sources.value,
      {
        id: sourceId,
        name: responsesFileParam.name,
        identificationName: identificationFileParam.name,
        timestamp: createdAt,
        area,
        validRows: combinedRows.length,
        responseErrors: responseErrors.length,
        identificationErrors: identifierErrors.length,
      },
    ]

    tableState.clearSelection()
    tableState.clearEditing()
    if (errorMessages.length) {
      const preview = errorMessages.slice(0, 3).join(' | ')
      tableState.importError.value = errorMessages.length > 3 ? `${preview} ...` : preview
    } else {
      tableState.importError.value = ''
    }
  }

  /**
   * Handler para cambio de archivo de identificación
   */
  function onAnswerKeyIdentificationChange(event) {
    const [file] = Array.from(event.target.files || [])
    identificationFile.value = file || null
  }

  /**
   * Handler para cambio de archivo de respuestas
   */
  function onAnswerKeyResponsesChange(event) {
    const [file] = Array.from(event.target.files || [])
    responsesFile.value = file || null
  }

  /**
   * Importa archivos de claves
   */
  async function importAnswerKeyFiles() {
    if (!identificationFile.value || !responsesFile.value) {
      tableState.importError.value = 'Selecciona ambos archivos (.dat) antes de importar.'
      return
    }

    try {
      await readAnswerKeyFiles(
        answerKeyArea.value,
        identificationFile.value,
        responsesFile.value
      )
      identificationFile.value = null
      responsesFile.value = null
      if (identificationInputRef.value) {
        identificationInputRef.value.value = ''
      }
      if (responsesInputRef.value) {
        responsesInputRef.value.value = ''
      }
    } catch (error) {
      console.error(error)
      tableState.importError.value = 'Ocurrió un problema al procesar las claves.'
    }
  }

  /**
   * Elimina un source y sus filas asociadas
   */
  function removeAnswerKeySource(sourceId) {
    tableState.rows.value = tableState.rows.value.filter((row) => row.sourceId !== sourceId)
    sources.value = sources.value.filter((source) => source.id !== sourceId)
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Limpia todo incluyendo sources
   */
  function clearAllAnswerKeys() {
    tableState.rows.value = []
    sources.value = []
    tableState.clearSelection()
    tableState.clearEditing()
  }

  /**
   * Exporta claves a Excel
   */
  async function exportAnswerKeysToExcel() {
    if (!tableState.rows.value.length) return
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Claves')
    worksheet.columns = ANSWER_KEY_COLUMNS.map(({ key, label }) => ({
      header: label,
      key,
    }))

    tableState.rows.value.forEach(({ id, sourceId, indicator, folio, litho, ...rest }) => {
      worksheet.addRow(rest)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'claves-respuestas.xlsx')
  }

  /**
   * Exporta observaciones a PDF
   */
  function exportAnswerKeysObservationsPdf() {
    const rows = observations.value
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Observaciones de claves', 14, 18)

    if (rows.length === 0) {
      doc.setFontSize(12)
      doc.text('No se registraron observaciones en las claves cargadas.', 14, 28)
    } else {
      const tableBody = rows.map((row, index) => [
        index + 1,
        row.area || '-',
        row.tipo || '-',
        row.litho || '-',
        row.observaciones,
      ])
      autoTable(doc, {
        startY: 24,
        head: [['#', 'Área', 'Tip', 'Litho', 'Observaciones']],
        body: tableBody,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: { fillColor: [33, 150, 243] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { cellWidth: 32 },
          2: { cellWidth: 18 },
          3: { cellWidth: 24 },
          4: { cellWidth: 92 },
        },
      })
    }

    doc.save('observaciones-claves.pdf')
  }

  return {
    // Estado de tabla
    ...tableState,

    // Estado específico
    sources,
    answerKeyArea,
    identificationFile,
    responsesFile,
    identificationInputRef,
    responsesInputRef,
    answerKeyHasData,
    sourcesCount,
    observations,
    observationCount,
    answerKeyAreaOptions,
    answerKeyLookupByMatch,
    answerKeyLookupByAreaTipo,

    // Métodos específicos
    readAnswerKeyFiles,
    onAnswerKeyIdentificationChange,
    onAnswerKeyResponsesChange,
    importAnswerKeyFiles,
    removeAnswerKeySource,
    clearAllAnswerKeys,
    exportAnswerKeysToExcel,
    exportAnswerKeysObservationsPdf,
  }
}
