import { reactive, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useTableState } from './useTableState'
import {
  STORAGE_KEYS,
  ARCHIVE_COLUMNS,
  ARCHIVE_KEY_ALIASES,
} from '@/constants'
import { generateId, normalize, normalizeArea } from '@/utils/helpers'

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
function mapArchiveRowToSchema(row) {
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

/**
 * Composable para gestión de archivos (padrón)
 */
export function useArchives() {
  const tableState = useTableState({
    storageKey: STORAGE_KEYS.ARCHIVE,
    createRow: createArchiveRow,
    filterFn: (row, searchValue) => {
      const needle = normalize(searchValue)
      return ARCHIVE_COLUMNS.some(({ key }) => normalize(row[key]).includes(needle))
    },
  })

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

  /**
   * Lee un archivo Excel de padrón
   */
  async function readArchiveWorkbook(file) {
    tableState.importError.value = ''
    try {
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
      tableState.importError.value =
        'Ocurrió un problema al procesar el archivo. Asegúrate de que sea un Excel (.xlsx) válido.'
    }
  }

  /**
   * Exporta el padrón a Excel
   */
  async function exportArchiveToExcel() {
    if (!tableState.rows.value.length) return
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
    await readArchiveWorkbook(file)
  }

  /**
   * Handler para cambio de archivo
   */
  async function onArchiveFileChange(event) {
    const [file] = Array.from(event.target.files || [])
    if (!file) return
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

    // Métodos específicos
    readArchiveWorkbook,
    exportArchiveToExcel,
    onArchiveDrop,
    onArchiveFileChange,
    addArchiveRow,
    resetPendingRow,
  }
}
