import { reactive, computed, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useTableState } from './useTableState'
import {
  ARCHIVE_COLUMNS,
  ARCHIVE_KEY_ALIASES,
} from '@/constants'
import { generateId, normalize, normalizeAreaStrict, stripDigits } from '@/utils/helpers'
import { apiFetch } from '@/utils/apiFetch'
import { loadExcelDeps, loadExcelExportDeps } from '@/utils/exportLoaders'

/**
 * Crea una fila de archivo (padrón)
 */
export function createArchiveRow(data = {}) {
  const normalized = ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    const raw = data[key]
    if (typeof raw === 'string') {
      acc[key] = raw
    } else if (raw === undefined || raw === null) {
      acc[key] = ''
    } else {
      acc[key] = String(raw)
    }
    return acc
  }, {})

  return {
    id: data.id ?? generateId(),
    ...normalized,
  }
}

/**
 * Crea una fila de archivo vacía
 */
export function createEmptyArchiveRow() {
  return ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    acc[key] = ''
    return acc
  }, {})
}

/**
 * Mapea una fila de Excel al esquema de archivo
 */
export function mapArchiveRowToSchema(row) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalize(key),
    String(value ?? '').trim(),
  ])

  const lookup = new Map(normalizedEntries)

  const mappedRow = ARCHIVE_COLUMNS.reduce((acc, { key }) => {
    const aliases = ARCHIVE_KEY_ALIASES[key] || []
    const match = aliases.find((alias) => lookup.has(normalize(alias)))
    acc[key] = match ? lookup.get(normalize(match)) : ''
    return acc
  }, {})

  const hasContent = Object.values(mappedRow).some(Boolean)
  return hasContent ? createArchiveRow(mappedRow) : null
}

function buildArchiveIssues(rows, areaList = []) {
  const countsByDni = new Map()
  const normalizedAreaList = Array.isArray(areaList) ? areaList : []
  rows.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    countsByDni.set(dni, (countsByDni.get(dni) || 0) + 1)
  })

  return rows.map((row) => {
    const dni = stripDigits(row.dni)
    const issues = []
    if (!dni) {
      issues.push('DNI vacío')
    } else {
      if (dni.length !== 8) issues.push(`DNI incompleto (${dni.length}/8)`)
      if ((countsByDni.get(dni) || 0) > 1) issues.push('DNI duplicado')
    }
    if (normalizedAreaList.length && row.area?.trim() && !normalizeAreaStrict(row.area, normalizedAreaList)) {
      issues.push('Área no configurada')
    }
    return {
      row,
      dni,
      issues,
      message: issues.length ? issues.join(' · ') : 'Sin observaciones',
    }
  })
}

/**
 * Composable para gestión de archivos (padrón)
 */
export function useArchives(areaNames) {
  const tableState = useTableState({
    pageSize: 10,
    createRow: createArchiveRow,
    filterFn: (row, searchValue) => {
      const needle = normalize(searchValue)
      return ARCHIVE_COLUMNS.some(({ key }) => normalize(row[key]).includes(needle))
    },
  })

  const lastFileName = reactive({ value: '' })
  const apiLoading = ref(false)
  const apiSyncing = ref(false)
  const apiReady = ref(false)
  let skipNextApiSync = false

  // Fila pendiente para agregar manualmente
  const pendingRow = reactive(createEmptyArchiveRow())

  // Computed para verificar si hay datos
  const archiveHasData = computed(() => tableState.rows.value.length > 0)

  // Lookup por DNI
  const archiveByDni = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((row) => {
      const dni = String(row.dni ?? '').replace(/\D/g, '')
      if (!dni) return
      map.set(dni, row)
    })
    return map
  })

  const archiveIssues = computed(() =>
    buildArchiveIssues(tableState.rows.value, areaNames?.value || []).filter(item => item.issues.length > 0)
  )

  const archiveIssueCount = computed(() => archiveIssues.value.length)

  const archiveIssueSummary = computed(() => {
    const summary = new Map()
    archiveIssues.value.forEach((item) => {
      item.issues.forEach((issue) => {
        const key = issue.startsWith('DNI incompleto') ? 'DNI incompleto' : issue
        summary.set(key, (summary.get(key) || 0) + 1)
      })
    })
    return Array.from(summary.entries()).map(([label, count]) => ({ label, count }))
  })

  const archiveIssueByRowId = computed(() => {
    const map = new Map()
    archiveIssues.value.forEach((item) => {
      map.set(item.row.id, item)
    })
    return map
  })

  const observedRows = computed(() => archiveIssues.value.map(item => item.row))

  async function initializeArchives() {
    apiLoading.value = true
    try {
      const res = await apiFetch('/candidatos/')
      if (!res.ok) throw new Error('No se pudo cargar el padrón.')
      const data = await res.json()
      apiReady.value = true
      if (data.length > 0) {
        skipNextApiSync = true
        tableState.setRows(data)
      } else {
        skipNextApiSync = true
        tableState.setRows([])
      }
    } catch (error) {
      console.warn('[archives] API no disponible, manteniendo estado local en memoria:', error)
      apiReady.value = false
    } finally {
      apiLoading.value = false
    }
  }

  async function syncArchivesToApi() {
    if (!apiReady.value) return
    apiSyncing.value = true
    try {
      const res = await apiFetch('/candidatos/bulk_replace/', {
        method: 'POST',
        body: JSON.stringify({ rows: tableState.rows.value }),
      })
      if (!res.ok) throw new Error('No se pudo guardar el padrón.')
    } catch (error) {
      console.warn('[archives] No se pudo sincronizar con API:', error)
    } finally {
      apiSyncing.value = false
    }
  }

  watchDebounced(
    tableState.rows,
    () => {
      if (skipNextApiSync) {
        skipNextApiSync = false
        return
      }
      syncArchivesToApi()
    },
    { debounce: 800, deep: true },
  )

  /**
   * Lee un archivo Excel de padrón
   */
  async function readArchiveWorkbook(file) {
    tableState.importError.value = ''
    if (!file?.name || !file.name.toLowerCase().endsWith('.xlsx')) {
      tableState.importError.value = 'Selecciona un archivo .xlsx válido.'
      return
    }

    try {
      const { ExcelJS } = await loadExcelDeps()
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        tableState.importError.value = 'No se encontró ninguna hoja en el archivo.'
        return
      }

      const headers = []
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim()
      })

      if (!headers.some((header) => header.length)) {
        tableState.importError.value = 'No se identificaron encabezados en la primera fila.'
        return
      }

      const rawRows = []
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber === 1) return

        const record = {}
        headers.forEach((header, index) => {
          if (!header) return
          const cell = row.getCell(index + 1)
          const value = cell?.text ?? ''
          record[header] = value.trim()
        })

        if (Object.values(record).some((value) => value.length)) {
          rawRows.push(record)
        }
      })

      if (!rawRows.length) {
        tableState.importError.value = 'La hoja no contiene registros.'
        return
      }

      const mapped = rawRows.map(mapArchiveRowToSchema).filter(Boolean)
      if (!mapped.length) {
        tableState.importError.value =
          'No se pudieron mapear columnas válidas. Verifica los encabezados del archivo.'
        return
      }

      tableState.setRows(mapped)
    } catch (error) {
      console.error(error)
      const message = String(error?.message || '').toLowerCase()
      if (message.includes('invalid') || message.includes('zip') || message.includes('corrupt')) {
        tableState.importError.value = 'El archivo seleccionado no parece ser un .xlsx válido o está dañado.'
        return
      }

      if (message.includes('worksheet') || message.includes('header')) {
        tableState.importError.value = 'El archivo se abrió, pero su estructura no coincide con el formato esperado.'
        return
      }

      tableState.importError.value =
        'No se pudo procesar el archivo Excel. Revisa que sea un .xlsx válido y que no esté protegido o dañado.'
    }
  }

  /**
   * Exporta el padrón a Excel
   */
  async function exportArchiveToExcel() {
    if (!tableState.rows.value.length) return
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Postulantes')
    worksheet.columns = ARCHIVE_COLUMNS.map(({ key, label }) => ({
      header: label,
      key,
    }))

    tableState.rows.value.forEach(({ id, ...rest }) => {
      worksheet.addRow(rest)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'postulantes.xlsx')
  }

  async function exportArchiveIssuesToExcel() {
    if (!archiveIssues.value.length) return
    const { ExcelJS, saveAs } = await loadExcelExportDeps()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Observados')
    worksheet.columns = [
      { header: 'DNI', key: 'dni', width: 12 },
      { header: 'Apellido paterno', key: 'paterno', width: 20 },
      { header: 'Apellido materno', key: 'materno', width: 20 },
      { header: 'Nombres', key: 'nombres', width: 28 },
      { header: 'Área', key: 'area', width: 18 },
      { header: 'Programa', key: 'programa', width: 32 },
      { header: 'Observación', key: 'observacion', width: 48 },
    ]

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }
      cell.alignment = { horizontal: 'center' }
    })

    archiveIssues.value.forEach(({ row, message, dni }) => {
      worksheet.addRow({
        dni,
        paterno: row.paterno || '',
        materno: row.materno || '',
        nombres: row.nombres || '',
        area: row.area || '',
        programa: row.programa || '',
        observacion: message,
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `observados-padron-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  /**
   * Handler para drop de archivo
   */
  async function onArchiveDrop(event) {
    event.preventDefault()
    tableState.isDragging.value = false
    const file = Array.from(event.dataTransfer?.files || []).find(
      (item) => item && item.name && item.name.toLowerCase().endsWith('.xlsx')
    )
    if (!file) return
    lastFileName.value = file.name
    await readArchiveWorkbook(file)
  }

  /**
   * Handler para cambio de archivo
   */
  async function onArchiveFileChange(event) {
    const [file] = Array.from(event.target.files || [])
    if (!file) return
    lastFileName.value = file.name
    await readArchiveWorkbook(file)
    event.target.value = ''
  }

  /**
   * Agrega una fila desde pendingRow
   */
  function addArchiveRow() {
    const empty = ARCHIVE_COLUMNS.every(({ key }) => !pendingRow[key].trim())
    if (empty) return

    const newRow = tableState.addRow(
      ARCHIVE_COLUMNS.reduce((acc, { key }) => {
        acc[key] = pendingRow[key].trim()
        return acc
      }, {})
    )

    resetPendingRow()
    tableState.toggleEdit(newRow.id)
  }

  /**
   * Resetea la fila pendiente
   */
  function resetPendingRow() {
    Object.assign(pendingRow, createEmptyArchiveRow())
  }

  return {
    // Estado de tabla
    ...tableState,

    // Estado específico de archivos
    pendingRow,
    archiveHasData,
    archiveByDni,
    archiveIssues,
    archiveIssueCount,
    archiveIssueSummary,
    archiveIssueByRowId,
    observedRows,
    lastFileName,
    apiLoading,
    apiSyncing,
    apiReady,

    // Métodos específicos
    initializeArchives,
    syncArchivesToApi,
    readArchiveWorkbook,
    exportArchiveToExcel,
    exportArchiveIssuesToExcel,
    onArchiveDrop,
    onArchiveFileChange,
    addArchiveRow,
    resetPendingRow,
  }
}
