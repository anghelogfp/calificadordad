import { ref, computed } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'
import { useTableState } from './useTableState'
import { STORAGE_KEYS, ANSWER_KEY_COLUMNS, ANSWER_KEY_AREAS, DEFAULT_DAT_FORMAT } from '@/constants'
import {
  generateId,
  normalize,
  normalizeArea,
  stripDigits,
  buildResponseMatchKey,
  buildAreaTipoKey,
} from '@/utils/helpers'
import { loadExcelExportDeps, loadPdfExportDeps } from '@/utils/exportLoaders'
import { parseIdentifierLine, parseResponseLine, readLinesFromFile, detectResponseAnswersOffset } from '@/utils/parsers'
import { apiFetch } from '@/utils/apiFetch'

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
 * Crea una fila de clave de respuesta
 */
export function createAnswerKeyRow(data = {}, areaList = ANSWER_KEY_AREAS, formatConfig = DEFAULT_DAT_FORMAT) {
  const rawArea = data.area == null ? '' : String(data.area).trim()
  const row = {
    id: data.id ?? generateId(),
    area: rawArea ? normalizeArea(rawArea, areaList) : '',
    tipo: data.tipo ?? '',
    answers: data.answers ?? '',
    indicator: data.indicator ?? '',
    folio: data.folio ?? '',
    litho: data.litho ?? '',
    scope: data.scope ?? (rawArea ? 'area' : 'general'),
    observaciones: data.observaciones ?? 'Sin observaciones',
    sourceId: data.sourceId ?? '',
  }

  row.observaciones = buildAnswerKeyObservation(row, formatConfig)
  return row
}

/**
 * Construye observación para una clave de respuesta
 */
export function buildAnswerKeyObservation(row, formatConfig = DEFAULT_DAT_FORMAT) {
  const issues = []
  const isGeneralKey = row.scope === 'general' || !String(row.area || '').trim()

  const tipo = (row.tipo || '').trim()
  if (!isGeneralKey && !tipo) {
    issues.push('Tipo no informado')
  }

  const lithoDigits = stripDigits(row.litho)
  if (!lithoDigits) {
    issues.push('Litho sin marcar')
  } else if (lithoDigits.length !== formatConfig.lithoLength) {
    issues.push(`Litho incompleto (${lithoDigits})`)
  }

  const answersRaw = String(row.answers || '').toUpperCase()
  const answerWindow = answersRaw.slice(0, formatConfig.answersLength)
  const answersNormalized = answerWindow.replace(/\s/g, '')
  if (!answersNormalized) {
    issues.push('Sin respuestas registradas')
  } else if (answersRaw.length < formatConfig.answersLength) {
    issues.push(`Cadena incompleta (${answersRaw.length}/${formatConfig.answersLength})`)
  } else if (/[^A-E*]/.test(answersNormalized)) {
    issues.push('Respuestas con marcas no válidas')
  }

  return issues.length ? issues.join(' · ') : 'Sin observaciones'
}

/**
 * Composable para gestión de claves de respuestas
 */
export function useAnswerKeys(archiveRows, areaNames, formatConfig) {
  const effectiveAreaNames = computed(() =>
    areaNames?.value?.length ? areaNames.value : ANSWER_KEY_AREAS
  )
  const effectiveFormatConfig = () => formatConfig?.value || DEFAULT_DAT_FORMAT

  function createConfiguredAnswerKeyRow(data = {}) {
    return createAnswerKeyRow(data, effectiveAreaNames.value, effectiveFormatConfig())
  }

  const tableState = useTableState({
    storageKey: STORAGE_KEYS.ANSWER_KEYS,
    pageSize: 10,
    createRow: createConfiguredAnswerKeyRow,
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
  const apiLoading = ref(false)
  const apiSyncing = ref(false)
  const apiReady = ref(false)
  let skipNextApiSync = false

  // Estado para formulario de importación
  const answerKeyArea = ref(ANSWER_KEY_AREAS[0])
  const identificationFile = ref(null)
  const responsesFile = ref(null)
  const identificationInputRef = ref(null)
  const responsesInputRef = ref(null)

  // Detección de offset de respuestas
  const detectedOffset = ref(null)
  const configuredResponseAnswersOffset = computed(() =>
    effectiveFormatConfig().responseAnswersOffset ?? DEFAULT_DAT_FORMAT.responseAnswersOffset
  )

  async function detectFormat(file) {
    detectedOffset.value = null
    try {
      const text = await file.text()
      const sanitized = text.split('\u001a').join('')
      const lines = sanitized.split(/\r?\n/).filter(Boolean)
      const result = detectResponseAnswersOffset(lines, effectiveFormatConfig())
      detectedOffset.value = result
    } catch {
      detectedOffset.value = { offset: -1, score: 0, answerPct: 0, digitPct: 1 }
    }
  }

  // Computed
  const answerKeyHasData = computed(() => tableState.rows.value.length > 0)
  const sourcesCount = computed(() => sources.value.length)

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

  // Opciones de área basadas en archivos cargados
  const answerKeyAreaOptions = computed(() => {
    const archiveAreas = (archiveRows?.value || [])
      .map((row) => normalizeArea(row.area, effectiveAreaNames.value))
      .filter((area) => effectiveAreaNames.value.includes(area))
    return Array.from(new Set([...effectiveAreaNames.value, ...archiveAreas]))
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
      const key = buildAreaTipoKey(row.area, row.tipo, effectiveAreaNames.value)
      if (!key) return
      map.set(key, row)
    })
    return map
  })

  // Fallback: primera clave por área (cuando no hay match por tipo)
  const answerKeyFallbackByArea = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      if (!row.area?.trim()) return
      const area = normalizeArea(row.area, effectiveAreaNames.value)
      if (!area || map.has(area)) return
      map.set(area, row)
    })
    return map
  })

  async function initializeAnswerKeys() {
    apiLoading.value = true
    try {
      const [rowsRes, sourcesRes] = await Promise.all([
        apiFetch('/answer-keys/'),
        apiFetch('/answer-key-sources/'),
      ])
      if (!rowsRes.ok || !sourcesRes.ok) throw new Error('No se pudieron cargar las claves.')

      const [rowsData, sourcesData] = await Promise.all([
        rowsRes.json(),
        sourcesRes.json(),
      ])

      apiReady.value = true
      if (rowsData.length > 0 || sourcesData.length > 0) {
        skipNextApiSync = true
        tableState.setRows(rowsData)
        sources.value = sourcesData
      } else if (tableState.rows.value.length > 0 || sources.value.length > 0) {
        await syncAnswerKeysToApi()
      }
    } catch (error) {
      console.warn('[answerKeys] API no disponible, usando localStorage:', error)
      apiReady.value = false
    } finally {
      apiLoading.value = false
    }
  }

  async function syncAnswerKeysToApi() {
    if (!apiReady.value) return
    apiSyncing.value = true
    try {
      const res = await apiFetch('/answer-keys/bulk_replace/', {
        method: 'POST',
        body: JSON.stringify({
          rows: tableState.rows.value,
          sources: sources.value,
        }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar las claves.')
    } catch (error) {
      console.warn('[answerKeys] No se pudo sincronizar con API:', error)
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
      syncAnswerKeysToApi()
    },
    { debounce: 800, deep: true },
  )

  /**
   * Lee archivos de claves de respuestas
   */
  async function readAnswerKeyFiles(area, identificationFileParam, responsesFileParam) {
    const identifierResults = await readLinesFromFile(
      identificationFileParam,
      (line, lineNumber) => parseIdentifierLine(line, lineNumber, effectiveFormatConfig()),
    )
    const responseResults = await readLinesFromFile(
      responsesFileParam,
      (line, lineNumber) => parseResponseLine(line, lineNumber, effectiveFormatConfig()),
    )

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

      const answerKeyRow = createConfiguredAnswerKeyRow({
        area,
        tipo,
        answers: row.answers,
        indicator: row.indicator,
        folio: row.folio,
        litho: row.litho,
        sourceId,
      })

      const baseObservation = buildAnswerKeyObservation(answerKeyRow, effectiveFormatConfig())
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

  async function readGeneralAnswerKeyFile(responsesFileParam) {
    const responseResults = await readLinesFromFile(
      responsesFileParam,
      (line, lineNumber) => parseResponseLine(line, lineNumber, effectiveFormatConfig()),
    )
    const responseRowsOnly = responseResults.filter((item) => item && item.row)
    const responseErrors = responseResults.filter((item) => item && item.error)

    const createdAt = new Date().toISOString()
    const sourceId = generateId()
    const combinedRows = responseRowsOnly.map(({ row }) => createConfiguredAnswerKeyRow({
      area: '',
      tipo: row.tipo || '',
      answers: row.answers,
      indicator: row.indicator,
      folio: row.folio,
      litho: row.litho,
      scope: 'general',
      sourceId,
    }))

    const errorMessages = responseErrors.map(({ error }) => `${responsesFileParam.name}: ${error}`)
    if (combinedRows.length === 0) {
      if (errorMessages.length) {
        const preview = errorMessages.slice(0, 3).join(' | ')
        tableState.importError.value = errorMessages.length > 3 ? `${preview} ...` : preview
      } else {
        tableState.importError.value = 'No se encontraron claves válidas en el archivo seleccionado.'
      }
      return
    }

    tableState.rows.value = [...tableState.rows.value, ...combinedRows]
    sources.value = [
      ...sources.value,
      {
        id: sourceId,
        name: responsesFileParam.name,
        identificationName: '',
        timestamp: createdAt,
        area: 'General',
        scope: 'general',
        validRows: combinedRows.length,
        responseErrors: responseErrors.length,
        identificationErrors: 0,
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
    if (!responsesFile.value) {
      tableState.importError.value = 'Selecciona el archivo de respuestas correctas (.dat) antes de importar.'
      return
    }

    if (!identificationFile.value) {
      try {
        await readGeneralAnswerKeyFile(responsesFile.value)
        responsesFile.value = null
        if (responsesInputRef.value) {
          responsesInputRef.value.value = ''
        }
      } catch (error) {
        console.error(error)
        tableState.importError.value = 'Ocurrió un problema al procesar la clave general.'
      }
      return
    }

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
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
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

  async function exportAnswerKeyObservationsToExcel() {
    const rows = observations.value
    if (!rows.length) return
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Observados')
    worksheet.columns = [
      { header: 'Área', key: 'area', width: 18 },
      { header: 'Tipo', key: 'tipo', width: 8 },
      { header: 'Litho', key: 'litho', width: 12 },
      { header: 'Respuestas', key: 'answers', width: 70 },
      { header: 'Observaciones', key: 'observaciones', width: 60 },
    ]
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
      cell.alignment = { horizontal: 'center' }
    })
    rows.forEach(({ id, sourceId, indicator, folio, ...rest }) => {
      worksheet.addRow(rest)
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `observados-claves-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  /**
   * Exporta observaciones a PDF
   */
  async function exportAnswerKeysObservationsPdf() {
    const rows = observations.value
    const { jsPDF, autoTable } = await loadPdfExportDeps()
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
    apiLoading,
    apiSyncing,
    apiReady,
    answerKeyArea,
    identificationFile,
    responsesFile,
    identificationInputRef,
    responsesInputRef,
    answerKeyHasData,
    sourcesCount,
    observations,
    observationCount,
    observationSummary,
    observationByRowId,
    detectedOffset,
    configuredResponseAnswersOffset,
    answerKeyAreaOptions,
    answerKeyLookupByMatch,
    answerKeyLookupByAreaTipo,
    answerKeyFallbackByArea,

    // Métodos específicos
    initializeAnswerKeys,
    syncAnswerKeysToApi,
    readAnswerKeyFiles,
    readGeneralAnswerKeyFile,
    onAnswerKeyIdentificationChange,
    onAnswerKeyResponsesChange,
    importAnswerKeyFiles,
    detectFormat,
    removeAnswerKeySource,
    clearAllAnswerKeys,
    exportAnswerKeysToExcel,
    exportAnswerKeyObservationsToExcel,
    exportAnswerKeysObservationsPdf,
  }
}
