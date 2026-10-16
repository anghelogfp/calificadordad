import { reactive, computed, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useTableState } from './useTableState'
import {
  ARCHIVE_COLUMNS,
  ARCHIVE_KEY_ALIASES,
  ARCHIVE_SCHEMA_FIELDS,
} from '@/constants'
import { generateId, normalize, normalizeAreaStrict, stripDigits } from '@/utils/helpers'
import { sha256Hex } from '@/utils/cryptoHash'
import { apiFetch } from '@/utils/apiFetch'
import { loadExcelDeps, loadExcelExportDeps } from '@/utils/exportLoaders'

const AREA_BY_EXAM_ID = Object.freeze({
  1: 'BIOMÉDICAS',
  2: 'SOCIALES',
  3: 'INGENIERÍAS',
})

const NULLABLE_ARCHIVE_FIELDS = new Set([
  'fecha_inscripcion',
  'fecha_nacimiento',
  'edad',
])

/**
 * Crea una fila de archivo (padrón)
 */
export function createArchiveRow(data = {}) {
  const normalized = ARCHIVE_SCHEMA_FIELDS.reduce((acc, key) => {
    const raw = data[key]
    if (NULLABLE_ARCHIVE_FIELDS.has(key) && (raw === undefined || raw === null || raw === '')) {
      acc[key] = null
      return acc
    }
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
  return ARCHIVE_SCHEMA_FIELDS.reduce((acc, key) => {
    acc[key] = ''
    return acc
  }, {})
}

function getLookupValue(lookup, aliases) {
  const match = aliases.find((alias) => lookup.has(normalize(alias)))
  return match ? lookup.get(normalize(match)) : ''
}

function inferAreaFromExamId(lookup) {
  const examId = getLookupValue(lookup, [
    'idexamen',
    'id examen',
    'id_examen',
    'codexamen',
    'cod examen',
    'codigo examen',
    'código examen',
  ])
  const trimmed = String(examId || '').trim()
  const normalizedExamId = trimmed.replace(/^0+/, '') || '0'
  if (AREA_BY_EXAM_ID[normalizedExamId]) {
    return AREA_BY_EXAM_ID[normalizedExamId]
  }
  return trimmed
}

/**
 * Extrae grupo y aula desde observaciones con formato "grupo 1 - aula A18"
 */
export function parseGrupoAulaFromObservaciones(observaciones = '') {
  const text = String(observaciones || '').trim()
  const match = text.match(/grupo\s*(\d+)\s*[-–·]\s*aula\s*([A-Za-z0-9_-]+)/i)
  if (!match) return { grupo: '', aula_padron: '' }
  return {
    grupo: `Grupo ${match[1]}`,
    aula_padron: match[2].toUpperCase(),
  }
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

  const mappedRow = ARCHIVE_SCHEMA_FIELDS.reduce((acc, key) => {
    const aliases = ARCHIVE_KEY_ALIASES[key] || []
    acc[key] = getLookupValue(lookup, aliases)
    return acc
  }, {})

  if (!mappedRow.area) {
    mappedRow.area = inferAreaFromExamId(lookup)
  }

  if (mappedRow.cod_examen && !AREA_BY_EXAM_ID[String(mappedRow.cod_examen).replace(/^0+/, '')]) {
    if (!mappedRow.area) {
      mappedRow.area = mappedRow.cod_examen
    }
  }

  if (mappedRow.puesto && !mappedRow.programa) {
    mappedRow.programa = mappedRow.puesto
  }

  if (mappedRow.cod_puesto && !mappedRow.codigo_programa) {
    mappedRow.codigo_programa = mappedRow.cod_puesto
  }

  if (mappedRow.observaciones && (!mappedRow.grupo || !mappedRow.aula_padron)) {
    const parsed = parseGrupoAulaFromObservaciones(mappedRow.observaciones)
    if (!mappedRow.grupo && parsed.grupo) mappedRow.grupo = parsed.grupo
    if (!mappedRow.aula_padron && parsed.aula_padron) mappedRow.aula_padron = parsed.aula_padron
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(mappedRow.fecha_inscripcion || '')) {
    mappedRow.fecha_inscripcion = mappedRow.fecha_inscripcion.replace(' ', 'T')
  }

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
    if (
      !row.cod_examen?.trim() &&
      normalizedAreaList.length &&
      row.area?.trim() &&
      !normalizeAreaStrict(row.area, normalizedAreaList)
    ) {
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
      return (
        ARCHIVE_COLUMNS.some(({ key }) => normalize(row[key]).includes(needle)) ||
        normalize(row.cod_examen).includes(needle) ||
        normalize(row.cod_puesto).includes(needle) ||
        normalize(row.puesto).includes(needle) ||
        normalize(row.unidad).includes(needle)
      )
    },
  })

  const lastFileName = reactive({ value: '' })
  const lastFileSha256 = ref('')
  const lastFileSize = ref(0)
  const rarFileName = ref('')
  const rarFileSha256 = ref('')
  const rarFileSize = ref(0)
  const apiLoading = ref(false)
  const apiSyncing = ref(false)
  const apiReady = ref(false)
  let skipNextApiSync = false

  // Fila pendiente para agregar manualmente
  const pendingRow = reactive(createEmptyArchiveRow())

  // Computed para verificar si hay datos
  const archiveHasData = computed(() => tableState.rows.value.length > 0)

  const isPoderJudicialPadron = computed(() =>
    tableState.rows.value.some((r) => Boolean(r.cod_examen?.trim() || r.cod_puesto?.trim() || r.puesto?.trim()))
  )

  const examCodes = computed(() => {
    const set = new Set()
    tableState.rows.value.forEach((r) => {
      const code = (r.cod_examen || r.area || '').trim()
      if (code) set.add(code)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  })

  const puestosList = computed(() => {
    const map = new Map()
    tableState.rows.value.forEach((r) => {
      const codPuesto = (r.cod_puesto || r.codigo_programa || '').trim()
      const puesto = (r.puesto || r.programa || '').trim()
      const key = codPuesto || puesto
      if (!key) return
      if (!map.has(key)) {
        map.set(key, {
          key,
          codPuesto,
          puesto: puesto || codPuesto,
          codExamen: (r.cod_examen || r.area || '').trim(),
          unidad: (r.unidad || '').trim(),
          count: 0,
        })
      }
      map.get(key).count += 1
    })
    return Array.from(map.values()).sort((a, b) =>
      a.codExamen.localeCompare(b.codExamen, 'es', { numeric: true }) ||
      a.codPuesto.localeCompare(b.codPuesto, 'es', { numeric: true })
    )
  })

  const aulasReceptionSummary = computed(() => {
    const groupMap = new Map()
    tableState.rows.value.forEach((r) => {
      const parsed = parseGrupoAulaFromObservaciones(r.observaciones)
      const grupo = (r.grupo || parsed.grupo || 'Grupo Único').trim()
      const aula = (r.aula_padron || parsed.aula_padron || 'S/A').trim()
      if (!groupMap.has(grupo)) groupMap.set(grupo, new Map())
      const aulaMap = groupMap.get(grupo)
      aulaMap.set(aula, (aulaMap.get(aula) || 0) + 1)
    })
    const groups = []
    for (const [grupo, aulaMap] of [...groupMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))) {
      const aulas = [...aulaMap.entries()]
        .map(([aula, cantidad]) => ({ aula, cantidad }))
        .sort((a, b) => a.aula.localeCompare(b.aula, 'es', { numeric: true }))
      const totalPostulantes = aulas.reduce((acc, item) => acc + item.cantidad, 0)
      groups.push({ grupo, aulas, totalAulas: aulas.length, totalPostulantes })
    }
    return groups
  })

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
      lastFileSha256.value = sha256Hex(buffer)
      lastFileSize.value = Number(file.size || buffer.byteLength || 0)
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
   * Calcula y registra el hash SHA-256 de un archivo contenedor (.rar / .zip)
   */
  async function readContainerArchiveHash(file) {
    if (!file) return null
    const buffer = await file.arrayBuffer()
    const hash = sha256Hex(buffer)
    rarFileName.value = file.name || ''
    rarFileSha256.value = hash
    rarFileSize.value = Number(file.size || buffer.byteLength || 0)
    return {
      name: rarFileName.value,
      sha256: rarFileSha256.value,
      size: rarFileSize.value,
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
    lastFileSha256,
    lastFileSize,
    rarFileName,
    rarFileSha256,
    rarFileSize,
    isPoderJudicialPadron,
    examCodes,
    puestosList,
    aulasReceptionSummary,
    apiLoading,
    apiSyncing,
    apiReady,

    // Métodos específicos
    initializeArchives,
    syncArchivesToApi,
    readArchiveWorkbook,
    readContainerArchiveHash,
    exportArchiveToExcel,
    exportArchiveIssuesToExcel,
    onArchiveDrop,
    onArchiveFileChange,
    addArchiveRow,
    resetPendingRow,
  }
}
