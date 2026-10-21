<script setup>
import { ref, reactive, computed, unref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { computeFileSha256, formatHashBlocks, sha256Hex } from '@/utils/cryptoHash'
import { stripDigits, normalize } from '@/utils/helpers'
import { computeConfigurationSha256 } from '@/domain/calification/configHash'
import { runPreCalificationSyntheticSuite } from '@/domain/calification/syntheticTests'
import { validateCalificationResult } from '@/domain/calification/validateResults'
import { parseGrupoAulaFromObservaciones } from '@/composables/useArchives'
import { useExport } from '@/composables/useExport'

const props = defineProps({
  archiveRows: { type: [Array, Object], default: () => [] },
  archiveMeta: { type: Object, default: () => ({}) },
  identifierRows: { type: [Array, Object], default: () => [] },
  identifierSources: { type: [Array, Object], default: () => [] },
  responseRows: { type: [Array, Object], default: () => [] },
  responseSources: { type: [Array, Object], default: () => [] },
  answerKeyRows: { type: [Array, Object], default: () => [] },
  answerKeySources: { type: [Array, Object], default: () => [] },
  calification: { type: Object, default: () => ({}) },
  exportedFilesRegistry: { type: [Array, Object], default: () => [] },
  bitacoraEvents: { type: [Array, Object], default: () => [] },
})

const exporter = useExport()

// ═══════════════════════════════════════════════════════════════════════════
// DATOS OFICIALES POR DEFECTO (PAQUETE PODER JUDICIAL CSJ PUNO)
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_RAR_SHA256 = 'eee7604f3025bdc93bc5ea5743a3663b83068fc9deaddc28dcf088c827bdf2e2'
const DEFAULT_PADRON_SHA256 = 'decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92'

const DEFAULT_GRUPO_1_AULAS = [
  { aula: 'A01', cantidad: 53 },
  { aula: 'A02', cantidad: 53 },
  { aula: 'A03', cantidad: 53 },
  { aula: 'A04', cantidad: 53 },
  { aula: 'A05', cantidad: 53 },
  { aula: 'A06', cantidad: 54 },
  { aula: 'A07', cantidad: 50 },
  { aula: 'A08', cantidad: 49 },
  { aula: 'A09', cantidad: 54 },
  { aula: 'A10', cantidad: 51 },
  { aula: 'A11', cantidad: 50 },
  { aula: 'A12', cantidad: 39 },
  { aula: 'A13', cantidad: 40 },
  { aula: 'A14', cantidad: 39 },
  { aula: 'A15', cantidad: 40 },
  { aula: 'A16', cantidad: 40 },
  { aula: 'A17', cantidad: 39 },
  { aula: 'A18', cantidad: 35 },
  { aula: 'A19', cantidad: 13 },
  { aula: 'A20', cantidad: 27 },
  { aula: 'A21', cantidad: 30 },
  { aula: 'A22', cantidad: 30 },
  { aula: 'A23', cantidad: 26 },
  { aula: 'A24', cantidad: 19 },
  { aula: 'A25', cantidad: 8 },
]

const DEFAULT_GRUPO_2_AULAS = [
  { aula: 'A01', cantidad: 52 },
  { aula: 'A02', cantidad: 52 },
  { aula: 'A03', cantidad: 52 },
  { aula: 'A04', cantidad: 55 },
  { aula: 'A05', cantidad: 54 },
  { aula: 'A06', cantidad: 52 },
  { aula: 'A07', cantidad: 51 },
  { aula: 'A08', cantidad: 46 },
  { aula: 'A09', cantidad: 51 },
  { aula: 'A10', cantidad: 50 },
  { aula: 'A11', cantidad: 44 },
  { aula: 'A12', cantidad: 37 },
  { aula: 'A13', cantidad: 38 },
  { aula: 'A14', cantidad: 35 },
  { aula: 'A15', cantidad: 39 },
  { aula: 'A16', cantidad: 37 },
  { aula: 'A17', cantidad: 37 },
  { aula: 'A18', cantidad: 32 },
  { aula: 'A19', cantidad: 32 },
  { aula: 'A20', cantidad: 29 },
  { aula: 'A21', cantidad: 27 },
  { aula: 'A22', cantidad: 26 },
  { aula: 'A23', cantidad: 22 },
  { aula: 'A24', cantidad: 17 },
  { aula: 'A25', cantidad: 17 },
]

const DEFAULT_EXAM_CODES_27 = [
  'E01a', 'E01b', 'E02a', 'E02b', 'E02c', 'E03a', 'E03b', 'E03c', 'E03d',
  'E04a', 'E04b', 'E05', 'E06', 'E07', 'E08a', 'E08b', 'E09a', 'E09b',
  'E09c', 'E09d', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16',
]

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN EDITABLE EN VIVO DE LAS ACTAS
// ═══════════════════════════════════════════════════════════════════════════

const showConfigPanel = ref(true)
const configTab = ref('general') // 'general' | 'horarios' | 'firmas' | 'apertura' | 'hashes'
const activeDocKey = ref('doc-01')
const printAllMode = ref(false)
const showOpticalCountsIn03A = ref(true)
const selectedKeyDetailCode = ref('')
const containerFileInput = ref(null)
const containerHashing = ref(false)

const localContainerMeta = reactive({
  name: '',
  sha256: '',
  size: 0,
})

const DEFAULT_ACTA_CONFIG = Object.freeze({
  procesoNombre: 'Proceso de Selección de Personal D.L. 728 N.° 001-2026-UE-PUNO',
  oficioReferencia: 'OFICIO N.° 003-2025-AP-UAF-GAD-CSJPU-PJ',
  entidadSolicitante: 'Corte Superior de Justicia de Puno — Poder Judicial',
  entidadEjecutora: 'UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO — Dirección de Admisión',
  modalidadTexto: 'Evaluación Técnica Presencial',
  codigoActa01: 'ACTA-01-INICIO-2026',
  codigoActa02: 'ACTA-02-DIGITAL-2026',
  codigoActa03A: 'DOC-03-A-RECEPCION-AULAS',
  codigoActa03B: 'DOC-03-B-LECTURA-ERRORES',
  codigoActa04: 'ACTA-04-CLAVES-PRUEBAS-2026',
  codigoActa05: 'DOC-05-INFORME-TECNICO-2026',
  codigoActa06: 'ACTA-06-CIERRE-CONFORMIDAD-2026',
  fecha: '16 de octubre de 2026',
  horaInicio: '08:30 horas',
  horaRecepcionDigital: '08:45 horas',
  horaAperturaClaves: '14:10 horas',
  horaCierre: '16:45 horas',
  lugar: 'Centro de Convenciones UNA-PUNO — Ciudad Universitaria',
  ambiente: 'Sala de Calificación Óptica (Acceso Restringido)',
  precintoUsb: 'USB Kingston — Precinto de Seguridad N.° #004512',
  sobreLacradoClaves: 'Sobre Lacrado N.° LC-091',
  vacantesTotales: 65,
  espacioFirmaPx: 75,
  observacionesGenerales:
    'Procesamiento óptico realizado en circuito cerrado sin conexión a red externa, bajo supervisión conjunta de la Dirección de Admisión UNA-PUNO y la Comisión de Selección de la CSJ Puno.',
  firmanteUnap: {
    nombre: 'Dr. Bladimiro Centeno Herrera',
    dni: '01893412',
    cargo: 'Director de la Dirección de Admisión',
    entidad: 'UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO',
  },
  firmantePj: {
    nombre: 'Abog. Benny José Álvarez Quiñonez',
    dni: '01234567',
    cargo: 'Presidente CSJ Puno / Comisión de Selección D.L. 728',
    entidad: 'CORTE SUPERIOR DE JUSTICIA DE PUNO',
  },
  verificacionesApertura: [
    {
      item: 'Aislamiento físico y seguridad perimétrica del recinto de cómputo',
      conforme: true,
      obs: 'Sin dispositivos externos ni celulares',
    },
    {
      item: 'Operatividad y calibración de escáneres ópticos (OMR de alta velocidad)',
      conforme: true,
      obs: 'Sensores limpios y calibrados',
    },
    {
      item: 'Segmento de red local (LAN) aislado sin salida a internet',
      conforme: true,
      obs: 'Tráfico externo bloqueado físicamente',
    },
    {
      item: 'Respaldo eléctrico ininterrumpido (UPS operativo y grupo de contingencia)',
      conforme: true,
      obs: 'Prueba de corte superada',
    },
    {
      item: 'Formatos oficiales de recepción, precintos de seguridad y útiles de lacrado',
      conforme: true,
      obs: 'Completos en mesa técnica',
    },
  ],
})

const storedActaConfig = useStorage('calificador-actas-pj-config-v3', DEFAULT_ACTA_CONFIG)
const actaConfig = reactive({
  ...DEFAULT_ACTA_CONFIG,
  ...(storedActaConfig.value || {}),
  firmanteUnap: { ...DEFAULT_ACTA_CONFIG.firmanteUnap, ...(storedActaConfig.value?.firmanteUnap || {}) },
  firmantePj: { ...DEFAULT_ACTA_CONFIG.firmantePj, ...(storedActaConfig.value?.firmantePj || {}) },
  verificacionesApertura: (storedActaConfig.value?.verificacionesApertura?.length
    ? storedActaConfig.value.verificacionesApertura
    : DEFAULT_ACTA_CONFIG.verificacionesApertura
  ).map((item) => ({ ...item })),
})

watch(
  actaConfig,
  (val) => {
    storedActaConfig.value = JSON.parse(JSON.stringify(val))
  },
  { deep: true },
)

function addVerificacionApertura() {
  actaConfig.verificacionesApertura.push({
    item: 'Nuevo aspecto técnico verificado por la comisión',
    conforme: true,
    obs: 'Conforme',
  })
}

function removeVerificacionApertura(idx) {
  if (actaConfig.verificacionesApertura.length > 1) {
    actaConfig.verificacionesApertura.splice(idx, 1)
  }
}

function resetActaConfigToDefaults() {
  Object.assign(actaConfig, JSON.parse(JSON.stringify(DEFAULT_ACTA_CONFIG)))
}

const DOCUMENTS_TABS = [
  { key: 'doc-01', code: '01', title: 'Acta de Inicio y Apertura', short: '01. Apertura' },
  { key: 'doc-02', code: '02', title: 'Acta de Recepción Digital (SHA-256)', short: '02. Recepción Digital' },
  { key: 'doc-03a', code: '03-A', title: 'Hoja de Recepción de Tarjetas por Aula', short: '03-A. Recepción Aulas' },
  { key: 'doc-03b', code: '03-B', title: 'Reporte de Lectura Óptica y Errores', short: '03-B. Lectura y Errores' },
  { key: 'doc-04', code: '04', title: 'Conformidad de Claves, Excepciones y 5 Pruebas', short: '04. Claves y Pruebas' },
  { key: 'doc-05', code: '05', title: 'Informe Técnico de Validación y Calificación', short: '05. Informe Técnico' },
  { key: 'doc-06', code: '06', title: 'Acta de Cierre y Conformidad Final', short: '06. Acta de Cierre' },
]

// ═══════════════════════════════════════════════════════════════════════════
// DESEMPAQUETADO REACTIVO DE PROPS Y FUENTES DE DATOS
// ═══════════════════════════════════════════════════════════════════════════

function unwrapArray(val) {
  const raw = unref(val)
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.value)) return raw.value
  return []
}

function unwrapVal(val, fallback = '') {
  const raw = unref(val)
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value ?? fallback
  return raw ?? fallback
}

const rowsArchive = computed(() => unwrapArray(props.archiveRows))
const rowsIdentifier = computed(() => unwrapArray(props.identifierRows))
const sourcesIdentifier = computed(() => unwrapArray(props.identifierSources))
const rowsResponse = computed(() => unwrapArray(props.responseRows))
const sourcesResponse = computed(() => unwrapArray(props.responseSources))
const rowsAnswerKey = computed(() => unwrapArray(props.answerKeyRows))
const sourcesAnswerKey = computed(() => unwrapArray(props.answerKeySources))

const padFileName = computed(() => {
  const fromMeta = unwrapVal(props.archiveMeta?.lastFileName, '')
  return fromMeta || 'PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx'
})

const padFileSha256 = computed(() => {
  const fromMeta = unwrapVal(props.archiveMeta?.lastFileSha256, '')
  if (fromMeta) return String(fromMeta).toLowerCase()
  return DEFAULT_PADRON_SHA256
})

const padFileSize = computed(() => {
  const fromMeta = Number(unwrapVal(props.archiveMeta?.lastFileSize, 0))
  return fromMeta > 0 ? fromMeta : 127777
})

const rarFileName = computed(() => {
  const fromMeta = unwrapVal(props.archiveMeta?.rarFileName, '')
  return localContainerMeta.name || fromMeta || 'calificacionPoderJudicial.rar'
})

const rarFileSha256 = computed(() => {
  const fromMeta = unwrapVal(props.archiveMeta?.rarFileSha256, '')
  return (localContainerMeta.sha256 || fromMeta || DEFAULT_RAR_SHA256).toLowerCase()
})

const rarFileSize = computed(() => {
  const fromMeta = Number(unwrapVal(props.archiveMeta?.rarFileSize, 0))
  return localContainerMeta.size || (fromMeta > 0 ? fromMeta : 0)
})

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!n || n <= 0) return 'Verificado en origen'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB (${n.toLocaleString('es-PE')} bytes)`
  return `${(n / (1024 * 1024)).toFixed(2)} MB (${n.toLocaleString('es-PE')} bytes)`
}

async function handleSelectContainerFile(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  containerHashing.value = true
  try {
    const hash = await computeFileSha256(file)
    localContainerMeta.name = file.name
    localContainerMeta.sha256 = hash
    localContainerMeta.size = Number(file.size || 0)
    const callback = props.archiveMeta?.onReadContainerHash || props.archiveMeta?.readContainerArchiveHash
    if (typeof callback === 'function') {
      await callback(file)
    }
  } finally {
    containerHashing.value = false
    if (event.target) event.target.value = ''
  }
}

function triggerContainerFilePicker() {
  containerFileInput.value?.click()
}

// ═══════════════════════════════════════════════════════════════════════════
// MÉTRICAS DEL PADRÓN, EXÁMENES, PUESTOS Y AULAS (DOC 02 Y DOC 03-A)
// ═══════════════════════════════════════════════════════════════════════════

const examCodesList = computed(() => {
  const fromMeta = unwrapArray(props.archiveMeta?.examCodes)
  if (fromMeta.length > 0) return fromMeta
  const set = new Set()
  rowsArchive.value.forEach((r) => {
    const code = String(r.cod_examen || r.codExamen || r.area || '').trim()
    if (code) set.add(code)
  })
  rowsAnswerKey.value.forEach((k) => {
    const code = String(k.cod_examen || k.codExamen || k.area || '').trim()
    if (code) set.add(code)
  })
  if (set.size > 0) {
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  }
  return DEFAULT_EXAM_CODES_27
})

const puestosSummaryList = computed(() => {
  const fromMeta = unwrapArray(props.archiveMeta?.puestosList)
  if (fromMeta.length > 0) return fromMeta
  const map = new Map()
  rowsArchive.value.forEach((r) => {
    const codPuesto = String(r.cod_puesto || r.codPuesto || r.codigo_programa || '').trim()
    const puesto = String(r.puesto || r.programa || '').trim()
    const key = codPuesto || puesto
    if (!key) return
    if (!map.has(key)) {
      map.set(key, {
        key,
        codPuesto,
        puesto: puesto || codPuesto,
        codExamen: String(r.cod_examen || r.codExamen || r.area || '').trim(),
        unidad: String(r.unidad || '').trim(),
        count: 0,
      })
    }
    map.get(key).count += 1
  })
  return Array.from(map.values()).sort(
    (a, b) =>
      a.codExamen.localeCompare(b.codExamen, 'es', { numeric: true }) ||
      a.codPuesto.localeCompare(b.codPuesto, 'es', { numeric: true }),
  )
})

const totalPadronCount = computed(() => rowsArchive.value.length || 1982)
const totalExamCodesCount = computed(() => (rowsArchive.value.length ? examCodesList.value.length : 27))
const totalPuestosCount = computed(() => (puestosSummaryList.value.length > 0 ? puestosSummaryList.value.length : 59))

// Mapa de DNI -> candidato del padrón (con grupo y aula oficial)
const padronByDni = computed(() => {
  const map = new Map()
  rowsArchive.value.forEach((r) => {
    const dni = stripDigits(r.dni)
    if (!dni) return
    const parsed = parseGrupoAulaFromObservaciones(r.observaciones)
    map.set(dni, {
      ...r,
      dni,
      grupo: (r.grupo || parsed.grupo || '').trim(),
      aulaPadron: (r.aula_padron || r.aulaPadron || parsed.aula_padron || '').trim(),
    })
  })
  return map
})

// Conteo de fichas ID y RESP leídas por (grupo, aula)
const opticalCountsByGrupoAula = computed(() => {
  const idCounts = new Map()
  const respCounts = new Map()

  rowsIdentifier.value.forEach((row) => {
    const dni = stripDigits(row.dni)
    const cand = padronByDni.value.get(dni)
    const grupo = cand?.grupo || 'Grupo 1'
    const aula = cand?.aulaPadron || String(row.aula || '').trim().toUpperCase()
    if (!aula) return
    const key = `${grupo.toUpperCase()}__${aula}`
    idCounts.set(key, (idCounts.get(key) || 0) + 1)
  })

  rowsResponse.value.forEach((row) => {
    const dni = stripDigits(row.dni)
    const cand = padronByDni.value.get(dni)
    const grupo = cand?.grupo || 'Grupo 1'
    const aula = cand?.aulaPadron || String(row.aula || '').trim().toUpperCase()
    if (!aula) return
    const key = `${grupo.toUpperCase()}__${aula}`
    respCounts.set(key, (respCounts.get(key) || 0) + 1)
  })

  return { idCounts, respCounts }
})

const receptionTwoBlocks = computed(() => {
  const rawGroups = unwrapArray(props.archiveMeta?.aulasReceptionSummary)
  let groups = rawGroups

  if (!groups.length && rowsArchive.value.length > 0) {
    const groupMap = new Map()
    rowsArchive.value.forEach((r) => {
      const parsed = parseGrupoAulaFromObservaciones(r.observaciones)
      const grupo = (r.grupo || parsed.grupo || 'Grupo 1').trim()
      const aula = (r.aula_padron || r.aulaPadron || parsed.aula_padron || 'A01').trim()
      if (!groupMap.has(grupo)) groupMap.set(grupo, new Map())
      const aMap = groupMap.get(grupo)
      aMap.set(aula, (aMap.get(aula) || 0) + 1)
    })
    groups = Array.from(groupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
      .map(([grupo, aMap]) => {
        const aulas = Array.from(aMap.entries())
          .map(([aula, cantidad]) => ({ aula, cantidad }))
          .sort((a, b) => a.aula.localeCompare(b.aula, 'es', { numeric: true }))
        return {
          grupo,
          aulas,
          totalPostulantes: aulas.reduce((s, x) => s + x.cantidad, 0),
        }
      })
  }

  const g1Source = groups[0]?.aulas?.length ? groups[0].aulas : DEFAULT_GRUPO_1_AULAS
  const g2Source = groups[1]?.aulas?.length ? groups[1].aulas : DEFAULT_GRUPO_2_AULAS

  const hasIdData = rowsIdentifier.value.length > 0
  const hasRespData = rowsResponse.value.length > 0
  const { idCounts, respCounts } = opticalCountsByGrupoAula.value

  const enrichAulas = (aulasList, grupoLabel) =>
    aulasList.map((item) => {
      const key = `${grupoLabel.toUpperCase()}__${String(item.aula).toUpperCase()}`
      const idRead = hasIdData ? (idCounts.get(key) ?? 0) : null
      const respRead = hasRespData ? (respCounts.get(key) ?? 0) : null
      return {
        aula: item.aula.startsWith('Aula') ? item.aula : item.aula,
        aulaShort: String(item.aula).replace(/^Aula\s*/i, ''),
        cantidad: Number(item.cantidad || 0),
        idRead,
        respRead,
      }
    })

  const g1Aulas = enrichAulas(g1Source, groups[0]?.grupo || 'Grupo 1')
  const g2Aulas = enrichAulas(g2Source, groups[1]?.grupo || 'Grupo 2')

  return {
    grupo1: {
      titulo: 'GRUPO 1 — TURNO MAÑANA',
      aulas: g1Aulas,
      totalCantidad: g1Aulas.reduce((acc, a) => acc + a.cantidad, 0),
      totalId: hasIdData ? g1Aulas.reduce((acc, a) => acc + (a.idRead || 0), 0) : null,
      totalResp: hasRespData ? g2Aulas && g1Aulas.reduce((acc, a) => acc + (a.respRead || 0), 0) : null,
    },
    grupo2: {
      titulo: 'GRUPO 2 — TURNO TARDE',
      aulas: g2Aulas,
      totalCantidad: g2Aulas.reduce((acc, a) => acc + a.cantidad, 0),
      totalId: hasIdData ? g2Aulas.reduce((acc, a) => acc + (a.idRead || 0), 0) : null,
      totalResp: hasRespData ? g2Aulas.reduce((acc, a) => acc + (a.respRead || 0), 0) : null,
    },
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVOS DIGITALES (.RAR, .XLSX Y .DAT) CON HASHES SHA-256 (DOC 02)
// ═══════════════════════════════════════════════════════════════════════════

const digitalFilesTable = computed(() => {
  const list = [
    {
      correlativo: '01',
      categoria: 'CONTENEDOR OFICIAL (.RAR)',
      nombre: rarFileName.value,
      registros: 'Paquete Comprimido Oficial',
      tamano: formatBytes(rarFileSize.value),
      sha256: rarFileSha256.value,
      sha256Blocks: formatHashBlocks(rarFileSha256.value, 8),
    },
    {
      correlativo: '02',
      categoria: 'PADRÓN OFICIAL (.XLSX)',
      nombre: padFileName.value,
      registros: `${totalPadronCount.value.toLocaleString('es-PE')} postulantes (${totalExamCodesCount.value} exámenes / ${totalPuestosCount.value} puestos)`,
      tamano: formatBytes(padFileSize.value),
      sha256: padFileSha256.value,
      sha256Blocks: formatHashBlocks(padFileSha256.value, 8),
    },
  ]

  let corr = 3
  const appendDatSources = (sources, rows, tipoLabel, fallbackName) => {
    if (sources.length > 0) {
      sources.forEach((src) => {
        const rawHash =
          src.sha256 ||
          sha256Hex(
            JSON.stringify({
              name: src.name,
              rowsCount: src.rowsCount || rows.length,
              tipoLabel,
            }),
          )
        list.push({
          correlativo: String(corr++).padStart(2, '0'),
          categoria: tipoLabel,
          nombre: src.name || fallbackName,
          registros: `${Number(src.rowsCount ?? rows.length).toLocaleString('es-PE')} fichas`,
          tamano: formatBytes(src.file_size || src.fileSize || src.size || 0),
          sha256: rawHash,
          sha256Blocks: formatHashBlocks(rawHash, 8),
        })
      })
    } else if (rows.length > 0) {
      const computedHash = sha256Hex(
        rows.map((r) => `${r.litho || ''}|${r.dni || ''}|${r.answers || ''}`).join('\n'),
      )
      list.push({
        correlativo: String(corr++).padStart(2, '0'),
        categoria: tipoLabel,
        nombre: fallbackName,
        registros: `${rows.length.toLocaleString('es-PE')} registros en memoria`,
        tamano: `${(rows.length * 56).toLocaleString('es-PE')} bytes`,
        sha256: computedHash,
        sha256Blocks: formatHashBlocks(computedHash, 8),
      })
    }
  }

  appendDatSources(sourcesIdentifier.value, rowsIdentifier.value, 'LECTURA ÓPTICA ID (.DAT)', 'test_ide_5964.dat')
  appendDatSources(sourcesResponse.value, rowsResponse.value, 'LECTURA ÓPTICA RESP (.DAT)', 'test_res_5964.dat')
  appendDatSources(sourcesAnswerKey.value, rowsAnswerKey.value, 'CLAVES OFICIALES (.DAT/.XLSX)', 'claves_oficiales_pj.dat')

  return list
})

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORÍA DE LECTURA ÓPTICA Y ERRORES DE FICHAS (DOC 03-B)
// ═══════════════════════════════════════════════════════════════════════════

const opticalAuditReport = computed(() => {
  const idTotal = rowsIdentifier.value.length
  const respTotal = rowsResponse.value.length

  const blankDniIds = []
  const incompleteDniIds = []
  const orphanDniIds = []
  const duplicateDniIds = []

  const idDniCounts = new Map()
  rowsIdentifier.value.forEach((r) => {
    const d = stripDigits(r.dni)
    if (d) idDniCounts.set(d, (idDniCounts.get(d) || 0) + 1)
  })

  rowsIdentifier.value.forEach((r, idx) => {
    const d = stripDigits(r.dni)
    const item = {
      index: idx + 1,
      litho: r.litho || 'S/L',
      dni: r.dni || '(Vacío)',
      aula: r.aula || 'S/A',
      sourceFile: r.sourceFile || 'ID.dat',
    }
    if (!d) {
      blankDniIds.push({ ...item, issue: 'DNI en blanco en ficha ID' })
    } else if (d.length !== 8) {
      incompleteDniIds.push({ ...item, issue: `DNI incompleto (${d.length}/8 dígitos)` })
    } else if (rowsArchive.value.length > 0 && !padronByDni.value.has(d)) {
      orphanDniIds.push({ ...item, issue: 'DNI no existe en el padrón oficial' })
    }
    if (d && (idDniCounts.get(d) || 0) > 1) {
      duplicateDniIds.push({ ...item, issue: `DNI duplicado (${idDniCounts.get(d)} fichas ID)` })
    }
  })

  const multipleMarkResponses = []
  const blankResponses = []
  const unlinkedResponses = []
  const duplicateResponses = []

  const respDniCounts = new Map()
  rowsResponse.value.forEach((r) => {
    const d = stripDigits(r.dni)
    if (d) respDniCounts.set(d, (respDniCounts.get(d) || 0) + 1)
  })

  rowsResponse.value.forEach((r, idx) => {
    const d = stripDigits(r.dni)
    const ans = String(r.answers || '')
    const starCount = (ans.match(/\*/g) || []).length
    const spaceCount = (ans.match(/\s/g) || []).length
    const baseItem = {
      index: idx + 1,
      litho: r.litho || 'S/L',
      dni: d || '(Sin vincular)',
      aula: r.aula || 'S/A',
      starCount,
      spaceCount,
      answers: ans,
    }
    if (!d) {
      unlinkedResponses.push({ ...baseItem, issue: 'Ficha de respuestas sin DNI vinculado' })
    } else if ((respDniCounts.get(d) || 0) > 1) {
      duplicateResponses.push({
        ...baseItem,
        issue: `DNI con ${respDniCounts.get(d)} hojas de respuestas`,
      })
    }
    if (starCount > 0) {
      multipleMarkResponses.push({
        ...baseItem,
        issue: `${starCount} marca(s) múltiple(s) (*) detectada(s)`,
      })
    }
    if (spaceCount > 0) {
      blankResponses.push({
        ...baseItem,
        issue: `${spaceCount} pregunta(s) en blanco`,
      })
    }
  })

  const idErrorTotal =
    blankDniIds.length + incompleteDniIds.length + orphanDniIds.length + duplicateDniIds.length
  const idValidCount = Math.max(0, idTotal - idErrorTotal)
  const idEffectiveness = idTotal > 0 ? ((idValidCount / idTotal) * 100).toFixed(2) : '100.00'

  const respErrorTotal = unlinkedResponses.length + duplicateResponses.length
  const respValidCount = Math.max(0, respTotal - respErrorTotal)
  const respEffectiveness = respTotal > 0 ? ((respValidCount / respTotal) * 100).toFixed(2) : '100.00'

  return {
    idTotal,
    idValidCount,
    idErrorTotal,
    idEffectiveness,
    respTotal,
    respValidCount,
    respErrorTotal,
    respEffectiveness,
    blankDniIds,
    incompleteDniIds,
    orphanDniIds,
    duplicateDniIds,
    multipleMarkResponses,
    blankResponses,
    unlinkedResponses,
    duplicateResponses,
    allIdErrors: [...blankDniIds, ...incompleteDniIds, ...orphanDniIds, ...duplicateDniIds],
    allRespErrors: [...unlinkedResponses, ...duplicateResponses, ...multipleMarkResponses],
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CLAVES OFICIALES (27 CÓDIGOS), EXCEPCIONES, 5 PRUEBAS Y HASH (DOC 04)
// ═══════════════════════════════════════════════════════════════════════════

const calificationResults = computed(() => {
  const fromAll = unwrapArray(props.calification?.calificationAllResults)
  if (fromAll.length > 0) return fromAll
  const fromCurrent = unwrapArray(props.calification?.calificationResults)
  if (fromCurrent.length > 0) return fromCurrent
  const fromDirect = unwrapArray(props.calification?.results)
  return fromDirect
})

const calificationSummary = computed(() => {
  const s = unref(props.calification?.calificationSummary) || unref(props.calification?.summary)
  if (s) return s
  const activeProc = unref(props.calification?.activeProcess)
  const firstArea = Object.values(activeProc?.areas || {})[0]
  return firstArea?.summary || null
})

const scoringValues = computed(() => {
  const summary = calificationSummary.value
  const correctValue = Number(
    summary?.correctValue ?? unwrapVal(props.calification?.calificationCorrectValue, 1),
  )
  const incorrectValue = Number(
    summary?.incorrectValue ?? unwrapVal(props.calification?.calificationIncorrectValue, 0),
  )
  const blankValue = Number(
    summary?.blankValue ?? unwrapVal(props.calification?.calificationBlankValue, 0),
  )
  const answersLength = Number(summary?.answersLength ?? 30)
  const totalWeight = Number(summary?.totalWeight ?? answersLength)
  const maxPossibleScore = totalWeight * correctValue
  const scoringOptions =
    summary?.scoringOptions ||
    unref(props.calification?.scoringOptions) || {
      useMinPassingScore: false,
      minPassingScore: 18,
      requireQuotaForIngreso: true,
      tieBreakerMode: 'shared_rank',
    }
  return {
    correctValue,
    incorrectValue,
    blankValue,
    answersLength,
    totalWeight,
    maxPossibleScore,
    scoringOptions,
  }
})

const questionExceptionsList = computed(() => {
  const fromCal = unwrapArray(props.calification?.questionExceptions)
  if (fromCal.length > 0) return fromCal
  const fromSummary = unwrapArray(calificationSummary.value?.questionExceptions)
  return fromSummary
})

const candidateExceptionsList = computed(() => {
  const fromCal = unwrapArray(props.calification?.candidateExceptions)
  if (fromCal.length > 0) return fromCal
  const fromAnulados = unwrapArray(calificationSummary.value?.anuladosComision)
  return fromAnulados
})

// Matriz de las 27 claves oficiales por COD_EXAMEN
const matrix27AnswerKeys = computed(() => {
  const keyMap = new Map()
  rowsAnswerKey.value.forEach((row) => {
    const code = String(row.cod_examen || row.codExamen || row.area || row.tipo || '').trim()
    if (!code) return
    keyMap.set(normalize(code), {
      codExamen: code,
      answers: String(row.answers || '').toUpperCase().trim(),
      loaded: true,
    })
  })

  const codes = examCodesList.value.length > 0 ? examCodesList.value : DEFAULT_EXAM_CODES_27
  return codes.map((code, idx) => {
    const found = keyMap.get(normalize(code))
    const ans = found?.answers || ''
    return {
      index: idx + 1,
      codExamen: code,
      loaded: Boolean(found && ans.length > 0),
      answers: ans,
      block1: ans.slice(0, 10) || '----------',
      block2: ans.slice(10, 20) || '----------',
      block3: ans.slice(20, 30) || '----------',
    }
  })
})

const selectedExamKeyDetail = computed(() => {
  const list = matrix27AnswerKeys.value
  if (!list.length) return null
  const found = list.find((item) => item.codExamen === selectedKeyDetailCode.value)
  return found || list.find((item) => item.loaded) || list[0]
})

const canonicalConfigHash = computed(() => {
  const { answersLength, correctValue, incorrectValue, blankValue, scoringOptions } = scoringValues.value
  return computeConfigurationSha256({
    answersLength,
    correctValue,
    incorrectValue,
    blankValue,
    plantillaItems: calificationSummary.value?.plantillaSnapshot || [
      { subject: 'Conocimientos', questionCount: answersLength, ponderation: 1 },
    ],
    answerKeyRows: rowsAnswerKey.value,
    questionExceptions: questionExceptionsList.value,
    candidateExceptions: candidateExceptionsList.value,
    scoringOptions,
  })
})

const syntheticSuiteResult = computed(() => {
  const fromCal = unref(props.calification?.syntheticTestsResult) || unref(props.calification?.syntheticTests)
  if (fromCal && Array.isArray(fromCal.cases) && fromCal.cases.length === 5) {
    return fromCal
  }
  const { answersLength, correctValue, incorrectValue, blankValue } = scoringValues.value
  return runPreCalificationSyntheticSuite({
    answerKeyRows: rowsAnswerKey.value,
    correctValue,
    incorrectValue,
    blankValue,
    answersLength,
    questionExceptions: questionExceptionsList.value,
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONCILIACIÓN, RESULTADOS POR EXAMEN/PUESTO, EMPATES E INVARIANTES (DOC 05)
// ═══════════════════════════════════════════════════════════════════════════

const resultsByExamCode = computed(() => {
  const map = new Map()
  examCodesList.value.forEach((code) => {
    map.set(code, {
      codExamen: code,
      padronCount: 0,
      calificadosCount: 0,
      ganadoresCount: 0,
      empatesCount: 0,
      scores: [],
    })
  })

  rowsArchive.value.forEach((r) => {
    const code = String(r.cod_examen || r.codExamen || r.area || '').trim()
    if (!code) return
    if (!map.has(code)) {
      map.set(code, {
        codExamen: code,
        padronCount: 0,
        calificadosCount: 0,
        ganadoresCount: 0,
        empatesCount: 0,
        scores: [],
      })
    }
    map.get(code).padronCount += 1
  })

  calificationResults.value.forEach((r) => {
    const code = String(r.codExamen || r.cod_examen || r.area || '').trim()
    if (!code) return
    if (!map.has(code)) {
      map.set(code, {
        codExamen: code,
        padronCount: 0,
        calificadosCount: 0,
        ganadoresCount: 0,
        empatesCount: 0,
        scores: [],
      })
    }
    const entry = map.get(code)
    entry.calificadosCount += 1
    if (r.isIngresante) entry.ganadoresCount += 1
    if (r.isTied) entry.empatesCount += 1
    entry.scores.push(Number(r.score || 0))
  })

  return Array.from(map.values())
    .sort((a, b) => a.codExamen.localeCompare(b.codExamen, 'es', { numeric: true }))
    .map((entry) => {
      const sc = entry.scores
      const max = sc.length ? Math.max(...sc).toFixed(3) : '—'
      const min = sc.length ? Math.min(...sc).toFixed(3) : '—'
      const avg = sc.length ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(3) : '—'
      return {
        ...entry,
        ausentesCount: Math.max(0, entry.padronCount - entry.calificadosCount),
        max,
        min,
        avg,
      }
    })
})

const resultsByPuesto = computed(() => {
  const map = new Map()
  puestosSummaryList.value.forEach((p) => {
    map.set(p.key, {
      codPuesto: p.codPuesto || p.key,
      puesto: p.puesto,
      unidad: p.unidad,
      codExamen: p.codExamen,
      inscritos: p.count,
      calificados: 0,
      ganadores: 0,
      empates: 0,
      maxScore: null,
    })
  })

  calificationResults.value.forEach((r) => {
    const key = r.codPuesto || r.cod_puesto || r.puesto || r.programa || ''
    if (!key) return
    if (!map.has(key)) {
      map.set(key, {
        codPuesto: r.codPuesto || key,
        puesto: r.puesto || r.programa || key,
        unidad: r.unidad || '',
        codExamen: r.codExamen || r.area || '',
        inscritos: 0,
        calificados: 0,
        ganadores: 0,
        empates: 0,
        maxScore: null,
      })
    }
    const item = map.get(key)
    item.calificados += 1
    if (r.isIngresante) item.ganadores += 1
    if (r.isTied) item.empates += 1
    const sc = Number(r.score || 0)
    if (item.maxScore === null || sc > item.maxScore) item.maxScore = sc
  })

  return Array.from(map.values()).sort(
    (a, b) =>
      String(a.codPuesto).localeCompare(String(b.codPuesto), 'es', { numeric: true }) ||
      String(a.puesto).localeCompare(String(b.puesto), 'es'),
  )
})

const tiedCandidatesList = computed(() =>
  calificationResults.value.filter((r) => r.isTied === true),
)

const invariantsAudit = computed(() => {
  if (!calificationResults.value.length && !calificationSummary.value) {
    return {
      valid: true,
      executed: false,
      errors: [],
      warnings: [],
    }
  }
  const check = validateCalificationResult({
    result: {
      results: calificationResults.value,
      summary: calificationSummary.value || {
        totalCandidates: totalPadronCount.value,
        noCalificados: [],
        answersLength: scoringValues.value.answersLength,
        totalWeight: scoringValues.value.totalWeight,
      },
    },
    processType: 'poder_judicial',
    answersLength: scoringValues.value.answersLength,
  })
  return {
    ...check,
    executed: true,
  }
})

const globalTotals = computed(() => {
  const results = calificationResults.value
  const summary = calificationSummary.value
  const noCalificados = unwrapArray(summary?.noCalificados)
  const anulados = unwrapArray(summary?.anuladosComision)
  const padron = rowsArchive.value.length || summary?.totalCandidates || 1982
  const calificados = results.length
  const ganadores = results.filter((r) => r.isIngresante).length
  const aptos = results.filter((r) => r.isApto !== false).length
  const anuladosCount = anulados.length || candidateExceptionsList.value.length
  const ausentes =
    summary?.missingResponses ??
    (noCalificados.length > 0
      ? noCalificados.filter((r) => String(r.motivo || '').toLowerCase().includes('ausente')).length
      : Math.max(0, padron - calificados - anuladosCount))
  const scores = results.map((r) => Number(r.score || 0))
  const max = scores.length ? Math.max(...scores).toFixed(3) : '0.000'
  const min = scores.length ? Math.min(...scores).toFixed(3) : '0.000'
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) : '0.000'

  return {
    padron,
    calificados,
    ganadores,
    aptos,
    ausentes,
    anuladosCount,
    noCalificadosCount: noCalificados.length,
    max,
    min,
    avg,
  }
})

// Registro unificado de archivos Excel y PDF generados (Acta 05 y Acta 06)
const unifiedExportedFiles = computed(() => {
  const fromProp = unwrapArray(props.exportedFilesRegistry)
  const fromComposable = unwrapArray(exporter.exportedArtifacts)
  const map = new Map()
  ;[...fromProp, ...fromComposable].forEach((item) => {
    if (!item || !item.name) return
    map.set(item.name, {
      ...item,
      sha256Blocks: item.sha256Formatted || formatHashBlocks(item.sha256 || '', 8),
    })
  })
  return Array.from(map.values())
})

const bitacoraList = computed(() => {
  const raw = unwrapArray(props.bitacoraEvents)
  if (raw.length > 0) return raw
  const fromCal = unwrapArray(props.calification?.bitacoraEvents)
  if (fromCal.length > 0) return fromCal
  const autoEvents = []
  questionExceptionsList.value.forEach((exc) => {
    autoEvents.push({
      categoria: 'EXCEPCION_PREGUNTA',
      accion: `Excepción ${exc.type} en Examen ${exc.codExamen || 'TODOS'} — Pregunta N.° ${exc.questionNumber}`,
      justificacion: exc.reason || 'Acuerdo de Comisión',
      documento_sustento: exc.documentRef || 'Acta de Comisión PJ',
      timestamp: new Date().toLocaleString('es-PE'),
    })
  })
  candidateExceptionsList.value.forEach((exc) => {
    autoEvents.push({
      categoria: 'ANULACION_POSTULANTE',
      accion: `Anulación de participación DNI ${exc.dni}`,
      justificacion: exc.reason || exc.detalle || 'Disposición de Comisión',
      documento_sustento: exc.documentRef || exc.documento || 'Acta de Incidencia',
      timestamp: new Date().toLocaleString('es-PE'),
    })
  })
  return autoEvents
})

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONES DE EXPORTACIÓN E IMPRESIÓN A4
// ═══════════════════════════════════════════════════════════════════════════

async function handleGenerateOfficialExcel() {
  await exporter.exportPjResultsToExcel(
    calificationResults.value,
    actaConfig.procesoNombre,
    {
      areaSummary: calificationSummary.value,
      archiveRows: rowsArchive.value,
      answerKeyRows: rowsAnswerKey.value,
      questionExceptions: questionExceptionsList.value,
      candidateExceptions: candidateExceptionsList.value,
      scoringOptions: scoringValues.value.scoringOptions,
      correctValue: scoringValues.value.correctValue,
      incorrectValue: scoringValues.value.incorrectValue,
      blankValue: scoringValues.value.blankValue,
      answersLength: scoringValues.value.answersLength,
      configSha256: canonicalConfigHash.value.sha256,
      syntheticTests: syntheticSuiteResult.value,
    },
  )
}

async function handleGenerateOfficialPdf() {
  await exporter.exportPjPublicationPdf(
    calificationResults.value,
    calificationSummary.value,
    actaConfig.procesoNombre,
  )
}

function isDocVisible(docKey) {
  return printAllMode.value || activeDocKey.value === docKey
}

function printElementCleanly(targetMode, title) {
  let contentHtml = ''
  if (targetMode === 'all') {
    const sheets = document.querySelectorAll('.actas-a4-canvas .hoja-a4')
    sheets.forEach((sheet) => {
      contentHtml += `<div class="salto-pagina">${sheet.outerHTML}</div>`
    })
  } else {
    const currentDocEl =
      document.querySelector(`.actas-a4-canvas [data-doc="${targetMode}"]`) ||
      document.querySelector('.actas-a4-canvas .hoja-a4')
    if (currentDocEl) {
      contentHtml = currentDocEl.outerHTML
    }
  }

  if (!contentHtml) {
    window.print()
    return
  }

  let iframe = document.getElementById('pj-print-iframe')
  if (iframe) iframe.remove()

  iframe = document.createElement('iframe')
  iframe.id = 'pj-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>${title || 'Acta Oficial'}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 8.8pt;
          line-height: 1.35;
          color: #1e293b;
          background: #ffffff;
        }
        .hoja-a4 {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 0 !important;
          margin: 0 auto !important;
          padding: 4mm 6mm !important;
          background: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
        }
        .salto-pagina {
          page-break-before: always;
          break-before: page;
        }
        .salto-pagina:first-child {
          page-break-before: avoid;
          break-before: avoid;
        }
        .encabezado-institucional {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2.2px solid #0a2446;
          padding-bottom: 6px;
          margin-bottom: 10px;
          position: relative;
        }
        .encabezado-institucional::after {
          content: "";
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #ddab44;
        }
        .logo-entidad {
          width: 52px;
          height: 52px;
          object-fit: contain;
        }
        .logo-entidad--pj {
          border-radius: 4px;
        }
        .texto-encabezado {
          text-align: center;
          flex: 1;
          padding: 0 10px;
        }
        .texto-encabezado .universidad {
          font-size: 11pt;
          font-weight: 800;
          color: #0a2446;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .texto-encabezado .area-rectora {
          font-size: 8.8pt;
          font-weight: 700;
          color: #1e3a5f;
        }
        .texto-encabezado .subtitulo-convenio {
          font-size: 8pt;
          font-style: italic;
          color: #64748b;
        }
        .titulo-documento-box {
          text-align: center;
          margin: 10px 0 10px 0;
        }
        .titulo-documento {
          font-size: 11.5pt;
          font-weight: 900;
          color: #0a2446;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .meta-documento {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          font-weight: 600;
          color: #64748b;
          margin-top: 4px;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 4px;
        }
        .seccion {
          margin-bottom: 10px;
        }
        .seccion-titulo {
          font-size: 9pt;
          font-weight: 800;
          color: #0a2446;
          background-color: #f1f5f9;
          border-left: 3.5px solid #1e3a5f;
          padding: 3px 6px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .texto-cuerpo {
          text-align: justify;
          font-size: 8.8pt;
          line-height: 1.4;
          margin-bottom: 6px;
        }
        table.tabla-formal {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.2pt;
          margin: 6px 0 8px 0;
          page-break-inside: auto;
        }
        table.tabla-formal th,
        table.tabla-formal td {
          border: 1px solid #cbd5e1;
          padding: 3.5px 5.5px;
          vertical-align: middle;
        }
        table.tabla-formal th {
          background-color: #f1f5f9;
          color: #0a2446;
          font-weight: 700;
          text-align: center;
          font-size: 7.8pt;
          text-transform: uppercase;
        }
        table.tabla-formal tr:nth-child(even) {
          background-color: #f8fafc;
        }
        tr {
          page-break-inside: avoid;
        }
        .grid-dos-columnas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 14px;
          margin-bottom: 8px;
        }
        .campo-dato {
          font-size: 8.3pt;
        }
        .campo-etiqueta {
          font-weight: 700;
          color: #1e3a5f;
        }
        .campo-valor {
          color: #1e293b;
        }
        .caja-hash {
          background-color: #f8fafc;
          border: 1px dashed #94a3b8;
          padding: 6px 8px;
          margin: 6px 0 10px 0;
        }
        .caja-hash__label {
          font-size: 7.5pt;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .caja-hash__value {
          font-family: "SF Mono", Consolas, Menlo, monospace;
          font-size: 8.2pt;
          font-weight: 700;
          color: #0a2446;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        .bloque-firmas {
          margin-top: 26px;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 28px;
        }
        .cuadro-firma {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .espacio-sello-firma {
          height: ${actaConfig.espacioFirmaPx || 75}px;
          width: 100%;
        }
        .linea-firma {
          width: 88%;
          border-top: 1.5px solid #000000;
          padding-top: 5px;
          font-size: 7.8pt;
          line-height: 1.25;
        }
        .linea-firma .nombre {
          font-weight: 800;
          color: #000000;
          font-size: 8.5pt;
        }
        .linea-firma .cargo {
          color: #334155;
          font-size: 7.5pt;
          font-weight: 600;
          margin-bottom: 1px;
        }
        .linea-firma .dni {
          color: #475569;
          font-size: 7.2pt;
          font-weight: 600;
          font-family: "SF Mono", Consolas, monospace;
          margin-bottom: 1px;
        }
        .linea-firma .entidad {
          font-size: 7pt;
          font-weight: 700;
          text-transform: uppercase;
          color: #1e3a5f;
        }
        .pie-pagina {
          display: flex;
          justify-content: space-between;
          font-size: 7pt;
          color: #94a3b8;
          border-top: 1px solid #cbd5e1;
          padding-top: 4px;
          margin-top: 14px;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-mono { font-family: "SF Mono", Consolas, monospace; }
        .font-bold { font-weight: bold; }
        .recepcion-tarjetas-header {
          text-align: center;
          margin: 6px 0 10px 0;
        }
        .recepcion-tarjetas-header h1 {
          font-size: 13pt;
          font-weight: 900;
          text-decoration: underline;
          color: #0a2446;
          letter-spacing: 0.8px;
        }
        .recepcion-aulas-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 8px;
        }
        .tabla-recepcion-aula {
          width: 100%;
          border-collapse: collapse;
          font-size: 7.2pt;
        }
        .tabla-recepcion-aula th,
        .tabla-recepcion-aula td {
          border: 1px solid #334155;
          padding: 2.2px 3.5px;
          text-align: center;
        }
        .tabla-recepcion-aula th {
          background-color: #f1f5f9;
          font-weight: 800;
          font-size: 7pt;
        }
        .recepcion-resumen-bar {
          display: flex;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 4px 8px;
          font-size: 7.2pt;
          font-weight: 700;
          color: #0a2446;
          margin: 6px 0;
        }
        .matriz-claves-pj {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 4px;
          margin: 8px 0;
        }
        .columna-clave-pj {
          border: 1px solid #cbd5e1;
          font-size: 7.5pt;
        }
        .columna-clave-pj__header {
          background-color: #1e3a5f;
          color: #ffffff;
          font-weight: 800;
          text-align: center;
          padding: 2px 0;
        }
        .fila-pregunta-pj {
          display: flex;
          justify-content: space-between;
          padding: 1.5px 5px;
          border-bottom: 1px dotted #cbd5e1;
          font-family: "SF Mono", Consolas, monospace;
        }
        .fila-pregunta-pj:last-child {
          border-bottom: none;
        }
        .fila-pregunta-pj .num {
          color: #64748b;
        }
        .fila-pregunta-pj .res {
          font-weight: 800;
          color: #0a2446;
        }
      </style>
    </head>
    <body>
      ${contentHtml}
    </body>
    </html>
  `)
  doc.close()

  setTimeout(() => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }, 350)
}

function handlePrintActiveDoc() {
  printAllMode.value = false
  printElementCleanly(activeDocKey.value, `Acta Oficial — ${activeDocKey.value.toUpperCase()}`)
}

function handlePrintAllDocs() {
  printAllMode.value = true
  printElementCleanly('all', 'Paquete Completo de Actas Oficiales (01–06) — CSJ PUNO / UNA-PUNO')
}

function handleOpenCleanWindow() {
  const targetMode = printAllMode.value ? 'all' : activeDocKey.value
  let contentHtml = ''
  if (targetMode === 'all') {
    const sheets = document.querySelectorAll('.actas-a4-canvas .hoja-a4')
    sheets.forEach((sheet) => {
      contentHtml += `<div class="salto-pagina">${sheet.outerHTML}</div>`
    })
  } else {
    const currentDocEl =
      document.querySelector(`.actas-a4-canvas [data-doc="${targetMode}"]`) ||
      document.querySelector('.actas-a4-canvas .hoja-a4')
    if (currentDocEl) {
      contentHtml = currentDocEl.outerHTML
    }
  }

  const printWindow = window.open('', '_blank', 'width=950,height=1000')
  if (!printWindow) {
    handlePrintActiveDoc()
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Vista de Impresión Limpia A4 — UNA-PUNO / CSJ PUNO</title>
      <link rel="stylesheet" href="/actas-static/assets/print.css">
      <style>
        body { background: #cbd5e1; padding: 20px; }
        .hoja-a4 { box-shadow: 0 4px 15px rgba(0,0,0,0.15); margin: 0 auto 20px auto; }
        @media print { body { background: #fff; padding: 0; } }
      </style>
    </head>
    <body>
      ${contentHtml}
      <script>
        window.onload = function() {
          window.focus();
        };
      <\/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}
</script>

<template>
  <div class="actas-pj-shell">
    <!-- ═══════════════════════════════════════════════════════════════════════
         BARRA DE CONTROL SUPERIOR (OCULTA EN IMPRESIÓN A4)
         ═══════════════════════════════════════════════════════════════════════ -->
    <header class="actas-toolbar no-print">
      <div class="actas-toolbar__title">
        <span class="actas-toolbar__badge">UNA-PUNO • CORTE SUPERIOR DE JUSTICIA DE PUNO</span>
        <h1>Actas Oficiales e Informe Técnico (01 a 06)</h1>
      </div>

      <div class="actas-toolbar__actions">
        <button
          type="button"
          class="actas-btn actas-btn--ghost"
          @click="showConfigPanel = !showConfigPanel"
        >
          ⚙️ {{ showConfigPanel ? 'Ocultar Configuración' : 'Configurar Datos, Horarios y Firmas' }}
        </button>

        <button
          type="button"
          class="actas-btn actas-btn--excel"
          :disabled="!calificationResults.length && !rowsArchive.length"
          @click="handleGenerateOfficialExcel"
        >
          📊 Exportar Excel Oficial PJ
        </button>

        <button
          type="button"
          class="actas-btn actas-btn--pdf"
          :disabled="!calificationResults.length"
          @click="handleGenerateOfficialPdf"
        >
          📄 Exportar PDF Publicación
        </button>

        <button
          type="button"
          class="actas-btn actas-btn--primary"
          @click="handlePrintActiveDoc"
        >
          🖨️ Imprimir Acta Actual (A4)
        </button>

        <button
          type="button"
          class="actas-btn actas-btn--gold"
          @click="handlePrintAllDocs"
        >
          📚 Imprimir Paquete Completo (01–06)
        </button>

        <button
          type="button"
          class="actas-btn actas-btn--clean"
          title="Abre el acta en una pestaña limpia e independiente"
          @click="handleOpenCleanWindow"
        >
          🔍 Vista Previa Limpia
        </button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════════════════
         PANEL DE CONFIGURACIÓN MODULAR CON SUBPESTAÑAS
         ═══════════════════════════════════════════════════════════════════════ -->
    <section v-if="showConfigPanel" class="actas-config-panel no-print">
      <div class="actas-config-header">
        <div class="actas-config-tabs">
          <button
            type="button"
            class="actas-cfg-tab"
            :class="{ 'actas-cfg-tab--active': configTab === 'general' }"
            @click="configTab = 'general'"
          >
            🏢 Convocatoria & Oficios
          </button>
          <button
            type="button"
            class="actas-cfg-tab"
            :class="{ 'actas-cfg-tab--active': configTab === 'horarios' }"
            @click="configTab = 'horarios'"
          >
            🕒 Horarios y Sede
          </button>
          <button
            type="button"
            class="actas-cfg-tab"
            :class="{ 'actas-cfg-tab--active': configTab === 'firmas' }"
            @click="configTab = 'firmas'"
          >
            ✍️ Firmantes y Espacio
          </button>
          <button
            type="button"
            class="actas-cfg-tab"
            :class="{ 'actas-cfg-tab--active': configTab === 'apertura' }"
            @click="configTab = 'apertura'"
          >
            🔍 Verificaciones Apertura (Acta 01)
          </button>
          <button
            type="button"
            class="actas-cfg-tab"
            :class="{ 'actas-cfg-tab--active': configTab === 'hashes' }"
            @click="configTab = 'hashes'"
          >
            🔐 Hashes SHA-256
          </button>
        </div>

        <button
          type="button"
          class="actas-btn-reset"
          title="Restablecer todos los datos a sus valores originales"
          @click="resetActaConfigToDefaults"
        >
          ↺ Restablecer Valores por Defecto
        </button>
      </div>

      <!-- TAB 1: Convocatoria y Oficios -->
      <div v-if="configTab === 'general'" class="actas-config-body">
        <div class="actas-config-grid">
          <div class="actas-config-card">
            <h3>Datos del Concurso</h3>
            <div class="actas-field-row">
              <label>Nombre Oficial del Proceso</label>
              <input v-model="actaConfig.procesoNombre" type="text" />
            </div>
            <div class="actas-field-row">
              <label>Oficio de Referencia</label>
              <input v-model="actaConfig.oficioReferencia" type="text" />
            </div>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>Modalidad de Evaluación</label>
                <input v-model="actaConfig.modalidadTexto" type="text" />
              </div>
              <div>
                <label>Vacantes en Concurso</label>
                <input v-model.number="actaConfig.vacantesTotales" type="number" min="1" />
              </div>
            </div>
          </div>

          <div class="actas-config-card">
            <h3>Entidades del Convenio</h3>
            <div class="actas-field-row">
              <label>Entidad Solicitante</label>
              <input v-model="actaConfig.entidadSolicitante" type="text" />
            </div>
            <div class="actas-field-row">
              <label>Entidad Ejecutora</label>
              <input v-model="actaConfig.entidadEjecutora" type="text" />
            </div>
            <div class="actas-field-row">
              <label>Observaciones Generales de las Actas</label>
              <textarea v-model="actaConfig.observacionesGenerales" rows="2"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: Horarios y Sede -->
      <div v-if="configTab === 'horarios'" class="actas-config-body">
        <div class="actas-config-grid">
          <div class="actas-config-card">
            <h3>Horarios Oficiales de las Actas</h3>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>Fecha Oficial</label>
                <input v-model="actaConfig.fecha" type="text" />
              </div>
              <div>
                <label>Hora Inicio (Acta 01)</label>
                <input v-model="actaConfig.horaInicio" type="text" />
              </div>
            </div>
            <div class="actas-field-row actas-field-row--3col">
              <div>
                <label>Hora Recep. Digital (Acta 02)</label>
                <input v-model="actaConfig.horaRecepcionDigital" type="text" />
              </div>
              <div>
                <label>Hora Claves (Acta 04)</label>
                <input v-model="actaConfig.horaAperturaClaves" type="text" />
              </div>
              <div>
                <label>Hora Cierre (Acta 06)</label>
                <input v-model="actaConfig.horaCierre" type="text" />
              </div>
            </div>
          </div>

          <div class="actas-config-card">
            <h3>Lugar, Ambiente y Precintos</h3>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>Lugar / Sede de Calificación</label>
                <input v-model="actaConfig.lugar" type="text" />
              </div>
              <div>
                <label>Ambiente de Cómputo</label>
                <input v-model="actaConfig.ambiente" type="text" />
              </div>
            </div>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>Precinto / Medio USB (Acta 02)</label>
                <input v-model="actaConfig.precintoUsb" type="text" />
              </div>
              <div>
                <label>Sobre Lacrado Claves (Acta 04)</label>
                <input v-model="actaConfig.sobreLacradoClaves" type="text" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Firmantes y Espacio de Firma -->
      <div v-if="configTab === 'firmas'" class="actas-config-body">
        <div class="actas-config-grid">
          <div class="actas-config-card">
            <h3>Firmante 1 (UNA-PUNO)</h3>
            <div class="actas-field-row">
              <label>Nombres y Grado Académico</label>
              <input v-model="actaConfig.firmanteUnap.nombre" type="text" />
            </div>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>DNI</label>
                <input v-model="actaConfig.firmanteUnap.dni" type="text" maxlength="8" />
              </div>
              <div>
                <label>Cargo / Función</label>
                <input v-model="actaConfig.firmanteUnap.cargo" type="text" />
              </div>
            </div>
            <div class="actas-field-row">
              <label>Entidad / Institución</label>
              <input v-model="actaConfig.firmanteUnap.entidad" type="text" />
            </div>
          </div>

          <div class="actas-config-card">
            <h3>Firmante 2 (Poder Judicial / CSJ Puno)</h3>
            <div class="actas-field-row">
              <label>Nombres y Grado Profesional</label>
              <input v-model="actaConfig.firmantePj.nombre" type="text" />
            </div>
            <div class="actas-field-row actas-field-row--2col">
              <div>
                <label>DNI</label>
                <input v-model="actaConfig.firmantePj.dni" type="text" maxlength="8" />
              </div>
              <div>
                <label>Cargo / Función</label>
                <input v-model="actaConfig.firmantePj.cargo" type="text" />
              </div>
            </div>
            <div class="actas-field-row">
              <label>Entidad / Institución</label>
              <input v-model="actaConfig.firmantePj.entidad" type="text" />
            </div>
          </div>

          <div class="actas-config-card actas-config-card--signature-space">
            <h3>Espacio para Firma y Sello Físico</h3>
            <p class="actas-config-hint">
              Ajusta la altura del área en blanco arriba de la línea de firma para que haya espacio holgado para el sello oficial de posfirma y la rúbrica manual.
            </p>
            <div class="actas-slider-row">
              <label>Altura del espacio: <strong>{{ actaConfig.espacioFirmaPx || 75 }} px</strong></label>
              <input
                v-model.number="actaConfig.espacioFirmaPx"
                type="range"
                min="45"
                max="120"
                step="5"
                class="actas-slider"
              />
            </div>
            <div class="firma-preview-box">
              <div class="firma-preview-space" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }">
                <span class="firma-preview-tag">[ Espacio reservado para sello y firma ]</span>
              </div>
              <div class="firma-preview-line">
                <strong>{{ actaConfig.firmanteUnap.nombre }}</strong>
                <div>{{ actaConfig.firmanteUnap.cargo }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: Verificaciones de Apertura (Acta 01) -->
      <div v-if="configTab === 'apertura'" class="actas-config-body">
        <div class="actas-config-card actas-config-card--full">
          <div class="actas-card-header-action">
            <div>
              <h3>Checklist de Constatación Inicial (Acta 01 — Inicio y Apertura)</h3>
              <p class="actas-config-hint">
                Marca el estado de conformidad de cada aspecto técnico verificado por la comisión y edita las observaciones que se imprimirán en el Acta 01.
              </p>
            </div>
            <button
              type="button"
              class="actas-btn actas-btn--primary actas-btn--sm"
              @click="addVerificacionApertura"
            >
              + Agregar Aspecto
            </button>
          </div>

          <div class="verif-table-wrapper">
            <table class="verif-edit-table">
              <thead>
                <tr>
                  <th style="width: 44%">Aspecto Técnico Inspeccionado</th>
                  <th style="width: 20%">Estado</th>
                  <th style="width: 30%">Observaciones</th>
                  <th style="width: 6%">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(verif, idx) in actaConfig.verificacionesApertura" :key="idx">
                  <td>
                    <input v-model="verif.item" type="text" class="verif-input" />
                  </td>
                  <td class="text-center">
                    <button
                      type="button"
                      class="verif-toggle-btn"
                      :class="verif.conforme ? 'verif-toggle-btn--ok' : 'verif-toggle-btn--obs'"
                      @click="verif.conforme = !verif.conforme"
                    >
                      {{ verif.conforme ? '✓ CONFORME' : '⚠️ OBSERVADO' }}
                    </button>
                  </td>
                  <td>
                    <input v-model="verif.obs" type="text" class="verif-input" placeholder="Detalle de observación..." />
                  </td>
                  <td class="text-center">
                    <button
                      type="button"
                      class="verif-del-btn"
                      title="Eliminar aspecto"
                      :disabled="actaConfig.verificacionesApertura.length <= 1"
                      @click="removeVerificacionApertura(idx)"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 5: Hashes SHA-256 -->
      <div v-if="configTab === 'hashes'" class="actas-config-body">
        <div class="actas-config-grid">
          <div class="actas-config-card actas-config-card--hash">
            <h3>Verificación SHA-256 de Contenedor (.rar / .zip)</h3>
            <p class="actas-config-hint">
              Selecciona <code>calificacionPoderJudicial.rar</code> para calcular su huella SHA-256 en el navegador e inyectarla en el Acta 02.
            </p>
            <input
              ref="containerFileInput"
              type="file"
              accept=".rar,.zip,.7z,*/*"
              style="display: none"
              @change="handleSelectContainerFile"
            />
            <button
              type="button"
              class="actas-btn actas-btn--hash"
              :disabled="containerHashing"
              @click="triggerContainerFilePicker"
            >
              🔐 {{ containerHashing ? 'Calculando SHA-256...' : 'Calcular Hash SHA-256 de contenedor (.rar / .zip)' }}
            </button>
            <div class="actas-hash-preview">
              <div><strong>Archivo contenedor:</strong> {{ rarFileName }}</div>
              <div class="actas-hash-mono">{{ formatHashBlocks(rarFileSha256, 8) }}</div>
            </div>
          </div>

          <div class="actas-config-card">
            <h3>Padrón Oficial y Huella Canónica</h3>
            <div class="actas-field-row">
              <label>Padrón Oficial:</label>
              <div class="font-bold">{{ padFileName }}</div>
              <div class="actas-hash-mono" style="font-size: 0.72rem">{{ formatHashBlocks(padFileSha256, 8) }}</div>
            </div>
            <div class="actas-field-row" style="margin-top: 10px">
              <label>Huella Canónica de Configuración (Acta 04):</label>
              <div class="actas-hash-mono" style="font-size: 0.72rem">{{ canonicalConfigHash.formatted || 'Calculando...' }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════════════════
         SELECTOR DE DOCUMENTOS (PESTAÑAS 01 A 06)
         ═══════════════════════════════════════════════════════════════════════ -->
    <nav class="actas-tabs-nav no-print" aria-label="Selector de Actas Oficiales">
      <button
        v-for="doc in DOCUMENTS_TABS"
        :key="doc.key"
        type="button"
        class="actas-tab-btn"
        :class="{ 'actas-tab-btn--active': !printAllMode && activeDocKey === doc.key }"
        @click="printAllMode = false; activeDocKey = doc.key"
      >
        {{ doc.short }}
      </button>
      <button
        type="button"
        class="actas-tab-btn actas-tab-btn--all"
        :class="{ 'actas-tab-btn--active': printAllMode }"
        @click="printAllMode = !printAllMode"
      >
        📑 Ver Todas (01–06)
      </button>
    </nav>

    <!-- ═══════════════════════════════════════════════════════════════════════
         LIENZO DE PÁGINAS A4 PARA VISTA PREVIA E IMPRESIÓN DIRECTA
         ═══════════════════════════════════════════════════════════════════════ -->
    <div class="actas-a4-canvas">
      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 01: ACTA DE INICIO Y APERTURA DEL AMBIENTE DE CALIFICACIÓN
           ───────────────────────────────────────────────────────────────────── -->
      <article v-if="isDocVisible('doc-01')" class="hoja-a4" data-doc="doc-01">
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">Acta de Inicio y Apertura del Ambiente de Calificación</h1>
          <div class="meta-documento">
            <span>CÓDIGO: ACTA-01-INICIO-2026</span>
            <span>REF: {{ actaConfig.oficioReferencia }}</span>
            <span>VERSIÓN: 1.0</span>
          </div>
        </div>

        <section class="seccion">
          <div class="seccion-titulo">1. Datos Generales del Proceso</div>
          <div class="grid-dos-columnas">
            <div class="campo-dato">
              <span class="campo-etiqueta">Proceso:</span>
              <span class="campo-valor">{{ actaConfig.procesoNombre }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Entidad Solicitante:</span>
              <span class="campo-valor">{{ actaConfig.entidadSolicitante }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Modalidad:</span>
              <span class="campo-valor">
                Evaluación Técnica Presencial ({{ totalPadronCount.toLocaleString('es-PE') }} Postulantes / 2 Grupos / 50 Aulas)
              </span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Fecha y Hora de Inicio:</span>
              <span class="campo-valor">{{ actaConfig.fecha }} — {{ actaConfig.horaInicio }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Lugar de Ejecución:</span>
              <span class="campo-valor">{{ actaConfig.lugar }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Ambiente de Cómputo:</span>
              <span class="campo-valor">{{ actaConfig.ambiente }}</span>
            </div>
          </div>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">2. Responsables Intervinientes en la Apertura</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 36%">Nombre y Apellidos</th>
                <th style="width: 14%">DNI</th>
                <th style="width: 25%">Cargo / Función</th>
                <th style="width: 25%">Entidad / Institución</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">{{ actaConfig.firmanteUnap.nombre }}</td>
                <td class="text-center font-mono">{{ actaConfig.firmanteUnap.dni }}</td>
                <td>{{ actaConfig.firmanteUnap.cargo }}</td>
                <td>{{ actaConfig.firmanteUnap.entidad }}</td>
              </tr>
              <tr>
                <td class="font-bold">{{ actaConfig.firmantePj.nombre }}</td>
                <td class="text-center font-mono">{{ actaConfig.firmantePj.dni }}</td>
                <td>{{ actaConfig.firmantePj.cargo }}</td>
                <td>{{ actaConfig.firmantePj.entidad }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">3. Constatación y Verificaciones Iniciales (Aislamiento, OMR y UPS)</div>
          <p class="texto-cuerpo">
            En presencia de los representantes acreditados de ambas instituciones, se procedió a la inspección ocular y técnica de las instalaciones, equipos de lectura óptica y medidas de seguridad informática:
          </p>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 52%">Aspecto Técnico Inspeccionado</th>
                <th style="width: 23%">Estado de Verificación</th>
                <th style="width: 25%">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(verif, idx) in actaConfig.verificacionesApertura" :key="idx">
                <td>{{ verif.item }}</td>
                <td class="text-center font-bold">
                  <span v-if="verif.conforme">[ X ] CONFORME &nbsp; [ &nbsp; ] OBS.</span>
                  <span v-else>[ &nbsp; ] CONFORME &nbsp; [ X ] OBS.</span>
                </td>
                <td>{{ verif.obs }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">4. Declaración Formal de Inicio</div>
          <p class="texto-cuerpo">
            Habiéndose constatado la plena conformidad de las condiciones técnicas, físicas y de seguridad requeridas, las partes declaran formalmente <strong>ABIERTO EL AMBIENTE DE CÓMPUTO Y CALIFICACIÓN</strong> e iniciadas las actividades oficiales para la recepción digital y física, lectura óptica, validación y calificación del concurso.
          </p>
        </section>

        <div class="bloque-firmas" style="margin-top: 40px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmanteUnap.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmanteUnap.dni }}</div>
              <div class="entidad">{{ actaConfig.firmanteUnap.entidad }}</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmantePj.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmantePj.dni }}</div>
              <div class="entidad">{{ actaConfig.firmantePj.entidad }}</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ACTA 01 — APERTURA DE AMBIENTE</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 02: ACTA DE RECEPCIÓN Y ENTREGA DE INFORMACIÓN DIGITAL (SHA-256)
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-02')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-02"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">Acta de Recepción y Entrega de Información Digital</h1>
          <div class="meta-documento">
            <span>CÓDIGO: ACTA-02-DIGITAL-2026</span>
            <span>MEDIO: {{ actaConfig.precintoUsb }}</span>
            <span>ALGORITMO: SHA-256 (FIPS 180-4)</span>
          </div>
        </div>

        <section class="seccion">
          <div class="seccion-titulo">1. Datos Generales de la Transferencia Digital</div>
          <div class="grid-dos-columnas">
            <div class="campo-dato">
              <span class="campo-etiqueta">Proceso:</span>
              <span class="campo-valor">{{ actaConfig.procesoNombre }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Fecha y Hora:</span>
              <span class="campo-valor">{{ actaConfig.fecha }} — {{ actaConfig.horaRecepcionDigital }}</span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Resumen del Padrón:</span>
              <span class="campo-valor font-bold">
                {{ totalPadronCount.toLocaleString('es-PE') }} postulantes · {{ totalExamCodesCount }} códigos de examen · {{ totalPuestosCount }} puestos
              </span>
            </div>
            <div class="campo-dato">
              <span class="campo-etiqueta">Medio de Entrega:</span>
              <span class="campo-valor">{{ actaConfig.precintoUsb }}</span>
            </div>
          </div>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">2. Intervinientes en la Custodia Digital</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 22%">Rol</th>
                <th style="width: 36%">Nombres y Apellidos</th>
                <th style="width: 14%">DNI</th>
                <th style="width: 28%">Cargo / Institución</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">ENTREGA (Custodio PJ)</td>
                <td>{{ actaConfig.firmantePj.nombre }}</td>
                <td class="text-center font-mono">{{ actaConfig.firmantePj.dni }}</td>
                <td>{{ actaConfig.firmantePj.cargo }}</td>
              </tr>
              <tr>
                <td class="font-bold">RECIBE (UNA-PUNO)</td>
                <td>{{ actaConfig.firmanteUnap.nombre }}</td>
                <td class="text-center font-mono">{{ actaConfig.firmanteUnap.dni }}</td>
                <td>{{ actaConfig.firmanteUnap.cargo }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">
            3. Relación de Archivos Digitales y Huellas Criptográficas SHA-256 (En Bloques de 8)
          </div>
          <p class="texto-cuerpo">
            Se verifica en presencia de las partes la integridad matemática de cada archivo recibido y generado en la estación de lectura óptica mediante el algoritmo criptográfico <strong>SHA-256</strong>:
          </p>

          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 6%">N.°</th>
                <th style="width: 22%">Categoría / Tipo</th>
                <th style="width: 28%">Nombre de Archivo</th>
                <th style="width: 24%">Registros / Contenido</th>
                <th style="width: 20%">Tamaño</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="fileItem in digitalFilesTable" :key="fileItem.correlativo">
                <tr>
                  <td class="text-center font-bold">{{ fileItem.correlativo }}</td>
                  <td class="font-bold">{{ fileItem.categoria }}</td>
                  <td class="font-mono" style="font-size: 7.5pt">{{ fileItem.nombre }}</td>
                  <td>{{ fileItem.registros }}</td>
                  <td class="text-center font-mono" style="font-size: 7.5pt">{{ fileItem.tamano }}</td>
                </tr>
                <tr>
                  <td colspan="5" style="background-color: #f8fafc; padding: 3px 8px">
                    <span class="font-bold" style="font-size: 7.2pt; color: #1e3a5f">
                      SHA-256 (Bloques de 8):
                    </span>
                    <span class="font-mono font-bold" style="font-size: 7.6pt; color: #0f172a; margin-left: 6px">
                      {{ fileItem.sha256Blocks }}
                    </span>
                    <div class="font-mono" style="font-size: 6.8pt; color: #64748b">
                      Hex: {{ fileItem.sha256 }}
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">4. Constancia de Integridad</div>
          <p class="texto-cuerpo">
            Ambas partes certifican que las sumas de verificación SHA-256 consignadas en la presente acta corresponden fielmente a los archivos originales utilizados para el proceso de calificación, quedando resguardados en copia inmutable.
          </p>
        </section>

        <div class="bloque-firmas" style="margin-top: 40px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmanteUnap.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmanteUnap.dni }}</div>
              <div class="entidad">{{ actaConfig.firmanteUnap.entidad }}</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmantePj.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmantePj.dni }}</div>
              <div class="entidad">{{ actaConfig.firmantePj.entidad }}</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ACTA 02 — RECEPCIÓN DIGITAL SHA-256</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-A: HOJA DE CONTROL DE RECEPCIÓN DE TARJETAS POR AULA (modelo.jpeg)
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03a')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03a"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Coordinación de Operaciones y Cómputo</div>
            <div class="subtitulo-convenio">
              Corte Superior de Justicia de Puno — {{ actaConfig.procesoNombre }}
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="recepcion-tarjetas-header">
          <h1 class="recepcion-tarjetas-title">RECEPCIÓN DE TARJETAS</h1>
          <div class="recepcion-tarjetas-sub">
            <span>FECHA: {{ actaConfig.fecha }}</span>
            <span>TOTAL PADRÓN: {{ (receptionTwoBlocks.grupo1.totalCantidad + receptionTwoBlocks.grupo2.totalCantidad).toLocaleString('es-PE') }} POSTULANTES</span>
            <label class="no-print recepcion-toggle">
              <input v-model="showOpticalCountsIn03A" type="checkbox" />
              Mostrar conteo leído junto a línea de check manual
            </label>
          </div>
        </div>

        <!-- 2 Bloques Lado a Lado idéntico a modelo.jpeg -->
        <div class="recepcion-dos-bloques">
          <!-- BLOQUE IZQUIERDO: GRUPO 1 MAÑANA (A01-A25, 998 postulantes) -->
          <div class="recepcion-bloque">
            <div class="recepcion-bloque__banner">
              {{ receptionTwoBlocks.grupo1.titulo }} ({{ receptionTwoBlocks.grupo1.totalCantidad }} Postulantes)
            </div>
            <table class="tabla-recepcion-modelo">
              <thead>
                <tr>
                  <th style="width: 24%">Aula</th>
                  <th style="width: 22%">Cantidad</th>
                  <th style="width: 27%"># Ident.</th>
                  <th style="width: 27%"># Resp.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in receptionTwoBlocks.grupo1.aulas" :key="`g1-${item.aula}`">
                  <td class="font-bold">{{ item.aulaShort }}</td>
                  <td class="font-mono font-bold">{{ item.cantidad }}</td>
                  <td class="celda-linea-check">
                    <span v-if="showOpticalCountsIn03A && item.idRead !== null" class="conteo-leido">
                      ✓ {{ item.idRead }}
                    </span>
                    <span class="linea-check-manual">________</span>
                  </td>
                  <td class="celda-linea-check">
                    <span v-if="showOpticalCountsIn03A && item.respRead !== null" class="conteo-leido">
                      ✓ {{ item.respRead }}
                    </span>
                    <span class="linea-check-manual">________</span>
                  </td>
                </tr>
                <tr class="fila-total-modelo">
                  <td>TOTAL G1</td>
                  <td class="font-mono">{{ receptionTwoBlocks.grupo1.totalCantidad }}</td>
                  <td class="font-mono">
                    {{ showOpticalCountsIn03A && receptionTwoBlocks.grupo1.totalId !== null ? receptionTwoBlocks.grupo1.totalId : '________' }}
                  </td>
                  <td class="font-mono">
                    {{ showOpticalCountsIn03A && receptionTwoBlocks.grupo1.totalResp !== null ? receptionTwoBlocks.grupo1.totalResp : '________' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- BLOQUE DERECHO: GRUPO 2 TARDE (A01-A25, 984 postulantes) -->
          <div class="recepcion-bloque">
            <div class="recepcion-bloque__banner recepcion-bloque__banner--g2">
              {{ receptionTwoBlocks.grupo2.titulo }} ({{ receptionTwoBlocks.grupo2.totalCantidad }} Postulantes)
            </div>
            <table class="tabla-recepcion-modelo">
              <thead>
                <tr>
                  <th style="width: 24%">Aula</th>
                  <th style="width: 22%">Cantidad</th>
                  <th style="width: 27%"># Ident.</th>
                  <th style="width: 27%"># Resp.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in receptionTwoBlocks.grupo2.aulas" :key="`g2-${item.aula}`">
                  <td class="font-bold">{{ item.aulaShort }}</td>
                  <td class="font-mono font-bold">{{ item.cantidad }}</td>
                  <td class="celda-linea-check">
                    <span v-if="showOpticalCountsIn03A && item.idRead !== null" class="conteo-leido">
                      ✓ {{ item.idRead }}
                    </span>
                    <span class="linea-check-manual">________</span>
                  </td>
                  <td class="celda-linea-check">
                    <span v-if="showOpticalCountsIn03A && item.respRead !== null" class="conteo-leido">
                      ✓ {{ item.respRead }}
                    </span>
                    <span class="linea-check-manual">________</span>
                  </td>
                </tr>
                <tr class="fila-total-modelo">
                  <td>TOTAL G2</td>
                  <td class="font-mono">{{ receptionTwoBlocks.grupo2.totalCantidad }}</td>
                  <td class="font-mono">
                    {{ showOpticalCountsIn03A && receptionTwoBlocks.grupo2.totalId !== null ? receptionTwoBlocks.grupo2.totalId : '________' }}
                  </td>
                  <td class="font-mono">
                    {{ showOpticalCountsIn03A && receptionTwoBlocks.grupo2.totalResp !== null ? receptionTwoBlocks.grupo2.totalResp : '________' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="recepcion-resumen-bar">
          <span>TOTAL GENERAL: 50 PAQUETES DE AULA (GRUPO 1: 25 AULAS / GRUPO 2: 25 AULAS)</span>
          <span>
            PROGRAMADOS: {{ (receptionTwoBlocks.grupo1.totalCantidad + receptionTwoBlocks.grupo2.totalCantidad).toLocaleString('es-PE') }}
            | LEÍDAS ID: {{ rowsIdentifier.length }}
            | LEÍDAS RESP: {{ rowsResponse.length }}
          </span>
        </div>

        <div class="bloque-firmas" style="margin-top: 14px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (RECIBE)</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Presidente CSJ Puno / Comisión (ENTREGA)</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>DOC 03-A — HOJA DE CONTROL DE RECEPCIÓN DE TARJETAS POR AULA</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-B: REPORTE DE LECTURA ÓPTICA Y ERRORES DE FICHAS (ID Y RESP)
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03b')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03b"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">Reporte de Lectura Óptica y Control de Errores de Fichas (ID y RESP)</h1>
          <div class="meta-documento">
            <span>CÓDIGO: REP-03B-LECTURA-2026</span>
            <span>PADRÓN BASE: {{ totalPadronCount.toLocaleString('es-PE') }} POSTULANTES</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
          </div>
        </div>

        <section class="seccion">
          <div class="seccion-titulo">1. Balance General de Lectura Óptica (ID vs. RESP)</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 34%">Tipo de Ficha Óptica</th>
                <th style="width: 16%">Fichas Leídas</th>
                <th style="width: 18%">Válidas sin Error</th>
                <th style="width: 16%">Con Observación</th>
                <th style="width: 16%">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">Fichas de Identificación (ID)</td>
                <td class="text-center font-mono font-bold">{{ opticalAuditReport.idTotal }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.idValidCount }}</td>
                <td class="text-center font-mono" style="color: #b91c1c">{{ opticalAuditReport.idErrorTotal }}</td>
                <td class="text-center font-mono font-bold">{{ opticalAuditReport.idEffectiveness }} %</td>
              </tr>
              <tr>
                <td class="font-bold">Fichas de Respuestas (RESP)</td>
                <td class="text-center font-mono font-bold">{{ opticalAuditReport.respTotal }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.respValidCount }}</td>
                <td class="text-center font-mono" style="color: #b91c1c">{{ opticalAuditReport.respErrorTotal }}</td>
                <td class="text-center font-mono font-bold">{{ opticalAuditReport.respEffectiveness }} %</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">2. Clasificación de Errores de DNI e Inconsistencias Ópticas</div>
          <div class="grid-dos-columnas">
            <div>
              <table class="tabla-formal">
                <thead>
                  <tr>
                    <th colspan="2">Tipología de Errores en Fichas ID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>DNI en blanco (sin burbujas marcadas)</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.blankDniIds.length }}</td>
                  </tr>
                  <tr>
                    <td>DNI incompleto (&lt; 8 dígitos)</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.incompleteDniIds.length }}</td>
                  </tr>
                  <tr>
                    <td>DNI no existe en el padrón oficial</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.orphanDniIds.length }}</td>
                  </tr>
                  <tr>
                    <td>DNI duplicado en lectura de identificadores</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.duplicateDniIds.length }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <table class="tabla-formal">
                <thead>
                  <tr>
                    <th colspan="2">Inconsistencias en Fichas de Respuestas (RESP)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Hojas con marcas múltiples (*) detectadas</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.multipleMarkResponses.length }}</td>
                  </tr>
                  <tr>
                    <td>Hojas con respuestas en blanco asumidas</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.blankResponses.length }}</td>
                  </tr>
                  <tr>
                    <td>Hojas de respuesta sin vincular a DNI</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.unlinkedResponses.length }}</td>
                  </tr>
                  <tr>
                    <td>Hojas de respuesta duplicadas por DNI</td>
                    <td class="text-center font-mono font-bold">{{ opticalAuditReport.duplicateResponses.length }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">3. Detalle Nominal de Fichas ID con Observación</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 10%">Fila</th>
                <th style="width: 16%">Litho</th>
                <th style="width: 18%">DNI Leído</th>
                <th style="width: 14%">Aula DAT</th>
                <th style="width: 42%">Diagnóstico / Observación</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="opticalAuditReport.allIdErrors.length > 0">
                <tr v-for="(err, idx) in opticalAuditReport.allIdErrors.slice(0, 12)" :key="`id-err-${idx}`">
                  <td class="text-center font-mono">{{ err.index }}</td>
                  <td class="text-center font-mono">{{ err.litho }}</td>
                  <td class="text-center font-mono font-bold">{{ err.dni }}</td>
                  <td class="text-center font-mono">{{ err.aula }}</td>
                  <td>{{ err.issue }}</td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="5" class="text-center" style="color: #15803d; font-weight: bold">
                  ✓ Sin errores de DNI en fichas de identificación (100% conciliadas con el padrón).
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">4. Detalle de Hojas de Respuestas con Marcas Múltiples (*) o Sin Vincular</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 10%">Fila</th>
                <th style="width: 16%">Litho</th>
                <th style="width: 18%">DNI</th>
                <th style="width: 14%">Marcas (*)</th>
                <th style="width: 42%">Detalle Óptico</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="opticalAuditReport.allRespErrors.length > 0">
                <tr v-for="(err, idx) in opticalAuditReport.allRespErrors.slice(0, 12)" :key="`resp-err-${idx}`">
                  <td class="text-center font-mono">{{ err.index }}</td>
                  <td class="text-center font-mono">{{ err.litho }}</td>
                  <td class="text-center font-mono">{{ err.dni }}</td>
                  <td class="text-center font-mono font-bold">{{ err.starCount }}</td>
                  <td>{{ err.issue }}</td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="5" class="text-center" style="color: #15803d; font-weight: bold">
                  ✓ Ninguna hoja presenta desvinculación ni inconsistencia crítica de lectura.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div class="bloque-firmas">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Presidente CSJ Puno / Comisión D.L. 728</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>DOC 03-B — REPORTE DE LECTURA ÓPTICA Y ERRORES</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 04: ACTA DE CONFORMIDAD DE CLAVES, EXCEPCIONES Y 5 PRUEBAS SINTÉTICAS
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-04')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-04"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">
            Acta de Conformidad de Claves Oficiales, Ponderación, Excepciones y Pruebas Sintéticas
          </h1>
          <div class="meta-documento">
            <span>CÓDIGO: ACTA-04-CLAVES-2026</span>
            <span>SOBRE LACRADO: #{{ actaConfig.sobreLacradoClaves }}</span>
            <span>HORA: {{ actaConfig.horaAperturaClaves }}</span>
          </div>
        </div>

        <!-- 1. Escala de Puntajes -->
        <section class="seccion">
          <div class="seccion-titulo">1. Valores de Puntuación y Reglas Oficiales de Calificación</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th>Total Preguntas</th>
                <th>Respuesta Correcta</th>
                <th>Respuesta Incorrecta</th>
                <th>Respuesta en Blanco</th>
                <th>Marca Múltiple (*)</th>
                <th>Puntaje Máximo Posible</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold">{{ scoringValues.answersLength }}</td>
                <td class="text-center font-mono font-bold" style="color: #15803d">
                  {{ scoringValues.correctValue.toFixed(3) }} pts
                </td>
                <td class="text-center font-mono">{{ scoringValues.incorrectValue.toFixed(3) }} pts</td>
                <td class="text-center font-mono">{{ scoringValues.blankValue.toFixed(3) }} pts</td>
                <td class="text-center font-mono">0.000 pts</td>
                <td class="text-center font-mono font-bold" style="color: #0369a1">
                  {{ scoringValues.maxPossibleScore.toFixed(3) }} pts
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 2. Matriz Completa de las 27 Claves por COD_EXAMEN -->
        <section class="seccion">
          <div class="seccion-titulo">
            2. Matriz Oficial de Claves por Código de Examen ({{ matrix27AnswerKeys.length }} Exámenes × 30 Preguntas)
          </div>
          <div class="matriz-27-grid">
            <table class="tabla-formal tabla-claves-compacta">
              <thead>
                <tr>
                  <th style="width: 6%">#</th>
                  <th style="width: 14%">COD_EXAMEN</th>
                  <th style="width: 24%">Preg. 01–10</th>
                  <th style="width: 24%">Preg. 11–20</th>
                  <th style="width: 24%">Preg. 21–30</th>
                  <th style="width: 8%">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="kRow in matrix27AnswerKeys" :key="kRow.codExamen">
                  <td class="text-center font-mono">{{ kRow.index }}</td>
                  <td class="text-center font-mono font-bold">{{ kRow.codExamen }}</td>
                  <td class="text-center font-mono">{{ kRow.block1 }}</td>
                  <td class="text-center font-mono">{{ kRow.block2 }}</td>
                  <td class="text-center font-mono">{{ kRow.block3 }}</td>
                  <td class="text-center font-bold" :style="{ color: kRow.loaded ? '#15803d' : '#b45309' }">
                    {{ kRow.loaded ? 'OK' : 'PEND.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 3. Excepciones de Preguntas y Postulantes Anulados -->
        <section class="seccion">
          <div class="seccion-titulo">3. Registro de Excepciones de Preguntas y Postulantes Anulados</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 18%">Tipo / Alcance</th>
                <th style="width: 20%">Objetivo (Examen / DNI)</th>
                <th style="width: 18%">Acción Matemática</th>
                <th style="width: 26%">Motivo / Acuerdo de Comisión</th>
                <th style="width: 18%">Documento Sustento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(qExc, idx) in questionExceptionsList" :key="`qexc-${idx}`">
                <td class="font-bold">EXCEPCIÓN PREGUNTA</td>
                <td class="font-mono">
                  Examen {{ qExc.codExamen || 'TODOS' }} — Preg. {{ qExc.questionNumber }}
                </td>
                <td class="font-mono font-bold">
                  {{ qExc.type }} {{ qExc.validAnswers ? `(${qExc.validAnswers})` : '' }}
                </td>
                <td>{{ qExc.reason || 'Acuerdo de Comisión' }}</td>
                <td>{{ qExc.documentRef || 'Acta de Comisión' }}</td>
              </tr>
              <tr v-for="(cExc, idx) in candidateExceptionsList" :key="`cexc-${idx}`">
                <td class="font-bold" style="color: #b91c1c">POSTULANTE ANULADO</td>
                <td class="font-mono">DNI {{ cExc.dni }}</td>
                <td class="font-bold" style="color: #b91c1c">EXCLUIDO DE MÉRITO</td>
                <td>{{ cExc.reason || cExc.detalle || 'Incidencia en aula' }}</td>
                <td>{{ cExc.documentRef || cExc.documento || 'Acta de Incidencia' }}</td>
              </tr>
              <tr v-if="!questionExceptionsList.length && !candidateExceptionsList.length">
                <td colspan="5" class="text-center">
                  Sin excepciones de preguntas ni postulantes anulados registrados al momento de la firma.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 4. Resultados de las 5 Pruebas Sintéticas Pre-Calificación -->
        <section class="seccion">
          <div class="seccion-titulo">
            4. Batería Obligatoria de 5 Pruebas Sintéticas Pre-Calificación (Examen Base: {{ syntheticSuiteResult.examCodeTested }})
          </div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 38%">Caso de Prueba Sintético</th>
                <th style="width: 15%">Puntaje Esperado</th>
                <th style="width: 15%">Puntaje Obtenido</th>
                <th style="width: 20%">Verificación</th>
                <th style="width: 12%">Dictamen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tc in syntheticSuiteResult.cases" :key="tc.code">
                <td class="font-bold">{{ tc.name }}</td>
                <td class="text-center font-mono">
                  {{ tc.expectedScore !== null ? `${tc.expectedScore.toFixed(3)} pts` : 'Excluido' }}
                </td>
                <td class="text-center font-mono font-bold">
                  {{ tc.obtainedScore !== null ? `${tc.obtainedScore.toFixed(3)} pts` : 'Anulado' }}
                </td>
                <td style="font-size: 7.4pt">{{ tc.details }}</td>
                <td class="text-center font-bold" :style="{ color: tc.passed ? '#15803d' : '#b91c1c' }">
                  {{ tc.passed ? 'CONFORME ✓' : 'FALLÓ' }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 5. Huella Criptográfica SHA-256 Canónica -->
        <section class="seccion">
          <div class="seccion-titulo">5. Huella Criptográfica SHA-256 Canónica de Configuración</div>
          <div class="caja-hash">
            <div class="font-bold" style="color: #0369a1">
              {{ canonicalConfigHash.formatted }}
            </div>
            <div style="font-size: 7pt; color: #475569; margin-top: 2px">
              SHA-256 Hex: {{ canonicalConfigHash.sha256 }}
            </div>
          </div>
        </section>

        <div class="bloque-firmas" style="margin-top: 14px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (CONFORMIDAD TÉCNICA)</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Presidente CSJ Puno / Comisión (AUTORIZA CLAVES Y REGLAS)</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ACTA 04 — CONFORMIDAD DE CLAVES Y PRUEBAS SINTÉTICAS</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 05: INFORME TÉCNICO DE VALIDACIÓN Y CALIFICACIÓN
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-05')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-05"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">Informe Técnico de Validación, Conciliación y Calificación</h1>
          <div class="meta-documento">
            <span>INFORME TÉCNICO N.° 005-2026-DAD-UNA-PUNO</span>
            <span>HASH CONFIG: {{ canonicalConfigHash.sha256.slice(0, 16).toUpperCase() }}...</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
          </div>
        </div>

        <!-- 1. Conciliación Padrón vs ID vs RESP -->
        <section class="seccion">
          <div class="seccion-titulo">1. Conciliación General: Padrón Oficial vs. Lecturas ID y RESP</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th>Postulantes en Padrón</th>
                <th>Fichas ID Leídas</th>
                <th>Fichas RESP Leídas</th>
                <th>Calificados Válidos</th>
                <th>Ausentes / Sin Resp.</th>
                <th>Anulados Comisión</th>
                <th>Ganadores / Vacante</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold">{{ globalTotals.padron }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.idTotal }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.respTotal }}</td>
                <td class="text-center font-mono font-bold" style="color: #0369a1">{{ globalTotals.calificados }}</td>
                <td class="text-center font-mono">{{ globalTotals.ausentes }}</td>
                <td class="text-center font-mono" style="color: #b91c1c">{{ globalTotals.anuladosCount }}</td>
                <td class="text-center font-mono font-bold" style="color: #15803d">{{ globalTotals.ganadores }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 2. Resultados Estadísticos por Código de Examen -->
        <section class="seccion">
          <div class="seccion-titulo">2. Estadísticas de Calificación por Código de Examen (27 Exámenes)</div>
          <table class="tabla-formal tabla-claves-compacta">
            <thead>
              <tr>
                <th>COD_EXAMEN</th>
                <th>Inscritos Padrón</th>
                <th>Calificados</th>
                <th>Ausentes</th>
                <th>Ganadores</th>
                <th>Empates</th>
                <th>Puntaje Máx</th>
                <th>Puntaje Mín</th>
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exRow in resultsByExamCode" :key="exRow.codExamen">
                <td class="text-center font-mono font-bold">{{ exRow.codExamen }}</td>
                <td class="text-center font-mono">{{ exRow.padronCount }}</td>
                <td class="text-center font-mono font-bold">{{ exRow.calificadosCount }}</td>
                <td class="text-center font-mono">{{ exRow.ausentesCount }}</td>
                <td class="text-center font-mono" style="color: #15803d">{{ exRow.ganadoresCount }}</td>
                <td class="text-center font-mono">{{ exRow.empatesCount }}</td>
                <td class="text-center font-mono">{{ exRow.max }}</td>
                <td class="text-center font-mono">{{ exRow.min }}</td>
                <td class="text-center font-mono">{{ exRow.avg }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 3. Empates Detectados -->
        <section class="seccion">
          <div class="seccion-titulo">
            3. Reporte de Empates Detectados ({{ tiedCandidatesList.length }} postulantes en condición de empate)
          </div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 14%">COD_PUESTO</th>
                <th style="width: 28%">Puesto</th>
                <th style="width: 14%">DNI</th>
                <th style="width: 26%">Postulante</th>
                <th style="width: 9%">Puntaje</th>
                <th style="width: 9%">Mérito</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="tiedCandidatesList.length > 0">
                <tr v-for="tRow in tiedCandidatesList.slice(0, 10)" :key="tRow.id || tRow.dni">
                  <td class="text-center font-mono">{{ tRow.codPuesto }}</td>
                  <td>{{ tRow.puesto }}</td>
                  <td class="text-center font-mono">{{ tRow.dni }}</td>
                  <td>{{ [tRow.paterno, tRow.materno, tRow.nombres].filter(Boolean).join(' ') }}</td>
                  <td class="text-center font-mono font-bold">{{ Number(tRow.score || 0).toFixed(3) }}</td>
                  <td class="text-center font-mono">
                    #{{ tRow.positionInPrograma }} {{ tRow.isCutoffTie ? '(CORTE)' : '' }}
                  </td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="6" class="text-center">
                  No se registran empates pendientes de dirimir en los puestos calificados.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 4. Bitácora de Modificaciones y Auditoría de Invariantes -->
        <section class="seccion">
          <div class="seccion-titulo">4. Bitácora de Modificaciones y Auditoría Interna de Invariantes</div>
          <div style="font-size: 8pt; margin-bottom: 4px">
            <strong>Estado de Auditoría Post-Cálculo (`validateResults`):</strong>
            <span
              class="font-bold"
              :style="{ color: invariantsAudit.valid ? '#15803d' : '#b91c1c', marginLeft: '6px' }"
            >
              {{
                invariantsAudit.valid
                  ? '✓ TODAS LAS INVARIANTES MATEMÁTICAS Y DE CONCILIACIÓN EN VERDE (0 ERRORES)'
                  : `OBSERVADO (${invariantsAudit.errors.length} errores)`
              }}
            </span>
          </div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 20%">Categoría</th>
                <th style="width: 34%">Acción Registrada</th>
                <th style="width: 28%">Justificación</th>
                <th style="width: 18%">Sustento</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="bitacoraList.length > 0">
                <tr v-for="(ev, idx) in bitacoraList" :key="`bit-${idx}`">
                  <td class="font-mono font-bold">{{ ev.categoria }}</td>
                  <td>{{ ev.accion }}</td>
                  <td>{{ ev.justificacion }}</td>
                  <td>{{ ev.documento_sustento }}</td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="4" class="text-center">
                  Sin modificaciones manuales posteriores a la carga de archivos oficiales.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div class="bloque-firmas" style="margin-top: 14px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (EMITE INFORME)</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 75) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Presidente CSJ Puno / Comisión (RECEPCIONA CONFORME)</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>DOC 05 — INFORME TÉCNICO DE VALIDACIÓN Y CALIFICACIÓN</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 06: ACTA DE CIERRE Y CONFORMIDAD FINAL
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-06')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-06"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">UNIVERSIDAD NACIONAL DEL ALTIPLANO - PUNO</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h1 class="titulo-documento">Acta de Cierre y Conformidad Final de Resultados</h1>
          <div class="meta-documento">
            <span>CÓDIGO: ACTA-06-CIERRE-2026</span>
            <span>REF: {{ actaConfig.oficioReferencia }}</span>
            <span>HORA DE CIERRE: {{ actaConfig.horaCierre }}</span>
          </div>
        </div>

        <section class="seccion">
          <div class="seccion-titulo">1. Culminación del Procesamiento y Entrega de Resultados</div>
          <p class="texto-cuerpo">
            En la ciudad de Puno, en {{ actaConfig.lugar }}, siendo las <strong>{{ actaConfig.horaCierre }} del día {{ actaConfig.fecha }}</strong>, los representantes oficiales de la Universidad Nacional del Altiplano de Puno y de la Corte Superior de Justicia de Puno formalizan el cierre definitivo de los actos de lectura óptica, validación, calificación y generación de resultados del <strong>{{ actaConfig.procesoNombre }}</strong>.
          </p>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">2. Totales Generales Consolidados del Proceso</div>
          <table class="tabla-formal">
            <thead>
              <tr>
                <th>Inscritos en Padrón</th>
                <th>Postulantes Calificados</th>
                <th>Ganadores / Aptos</th>
                <th>Postulantes Ausentes</th>
                <th>Anulados por Comisión</th>
                <th>Puestos / Exámenes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt">
                  {{ globalTotals.padron.toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #0369a1">
                  {{ globalTotals.calificados.toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #15803d">
                  {{ globalTotals.ganadores }} / {{ globalTotals.aptos }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt">
                  {{ globalTotals.ausentes }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #b91c1c">
                  {{ globalTotals.anuladosCount }}
                </td>
                <td class="text-center font-mono font-bold">
                  {{ totalPuestosCount }} puestos / {{ totalExamCodesCount }} exámenes
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">
            3. Relación de Productos Digitales Entregados (Excel y PDF) con Huella SHA-256
          </div>
          <p class="texto-cuerpo">
            La Dirección de Admisión de la UNA-PUNO hace entrega formal a la Comisión de Selección del Poder Judicial de los siguientes archivos oficiales de resultados con sus respectivas huellas criptográficas de integridad <strong>SHA-256</strong>:
          </p>

          <table class="tabla-formal">
            <thead>
              <tr>
                <th style="width: 6%">N.°</th>
                <th style="width: 12%">Formato</th>
                <th style="width: 34%">Archivo Entregable / Descripción</th>
                <th style="width: 48%">Hash Criptográfico SHA-256 (Bloques de 8)</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="unifiedExportedFiles.length > 0">
                <tr v-for="(art, idx) in unifiedExportedFiles" :key="art.id || art.name">
                  <td class="text-center font-bold">{{ String(idx + 1).padStart(2, '0') }}</td>
                  <td class="text-center font-mono font-bold">{{ String(art.type || '').toUpperCase() }}</td>
                  <td>
                    <div class="font-mono font-bold" style="font-size: 7.5pt">{{ art.name }}</div>
                    <div style="font-size: 7pt; color: #475569">{{ art.label || 'Producto Oficial Generado' }}</div>
                  </td>
                  <td class="font-mono" style="font-size: 7.2pt">
                    <div class="font-bold" style="color: #0f172a">{{ art.sha256Blocks }}</div>
                    <div style="font-size: 6.4pt; color: #64748b">{{ art.sha256 }}</div>
                  </td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="4" class="text-center" style="padding: 10px">
                  Utilice los botones <strong>"Exportar Excel Oficial PJ"</strong> y <strong>"Exportar PDF Publicación por Puesto"</strong> en la barra superior para generar los archivos finales e insertar automáticamente sus hashes SHA-256 en esta tabla.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="seccion">
          <div class="seccion-titulo">4. Declaración de Plena Conformidad y Cierre</div>
          <p class="texto-cuerpo">
            {{ actaConfig.observacionesGenerales }}
          </p>
          <p class="texto-cuerpo">
            La Comisión de Selección de la Corte Superior de Justicia de Puno deja constancia de su <strong>PLENA Y TOTAL CONFORMIDAD</strong> respecto a la transparencia, fidelidad y exactitud matemática con la que la Dirección de Admisión de la UNA-PUNO ejecutó la lectura óptica y calificación. No existiendo observaciones pendientes, se suscribe la presente acta en señal de conformidad.
          </p>
        </section>

        <div class="bloque-firmas" style="margin-top: 40px">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmanteUnap.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmanteUnap.dni }}</div>
              <div class="entidad">{{ actaConfig.firmanteUnap.entidad }}</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" :style="{ height: (actaConfig.espacioFirmaPx || 95) + 'px' }"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">{{ actaConfig.firmantePj.cargo }}</div>
              <div class="dni">DNI: {{ actaConfig.firmantePj.dni }}</div>
              <div class="entidad">{{ actaConfig.firmantePj.entidad }}</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ACTA 06 — CIERRE Y CONFORMIDAD FINAL</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>
    </div>
  </div>
</template>

<style scoped>
.actas-pj-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #1e293b;
}

/* Barra superior de herramientas */
.actas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #0f172a;
  color: #f8fafc;
  padding: 12px 18px;
  border-radius: 10px;
  border-bottom: 3px solid #ddab44;
}

.actas-toolbar__title h1 {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 2px 0 0 0;
  color: #ffffff;
}

.actas-toolbar__badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  background: #0284c7;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.4px;
}

.actas-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actas-btn {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.actas-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actas-btn--ghost {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #475569;
}

.actas-btn--excel {
  background: #166534;
  color: #ffffff;
}

.actas-btn--pdf {
  background: #991b1b;
  color: #ffffff;
}

.actas-btn--primary {
  background: #0284c7;
  color: #ffffff;
}

.actas-btn--gold {
  background: #ca8a04;
  color: #ffffff;
}

.actas-btn--clean {
  background: #334155;
  color: #f8fafc;
  border-color: #64748b;
}

.actas-btn--clean:hover {
  background: #475569;
}

.actas-btn--hash {
  background: #0a2446;
  color: #ffffff;
  width: 100%;
  margin-top: 6px;
}

/* Panel de configuración editable */
.actas-config-panel {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.actas-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}

.actas-config-header h2 {
  font-size: 0.92rem;
  font-weight: 800;
  color: #0a2446;
  margin: 0;
}

.actas-btn-reset {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.actas-btn-reset:hover {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.actas-config-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.actas-cfg-tab {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.actas-cfg-tab:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.actas-cfg-tab--active {
  background: #0a2446;
  border-color: #0a2446;
  color: #ffffff;
}

.actas-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actas-slider {
  flex: 1;
  height: 6px;
  accent-color: #0284c7;
  cursor: pointer;
}

.firma-preview-box {
  margin-top: 10px;
  padding: 10px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
}

.firma-preview-space {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 1px dotted #94a3b8;
  border-radius: 4px;
  margin-bottom: 6px;
  transition: height 0.1s ease;
}

.firma-preview-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
}

.firma-preview-line {
  border-top: 1.5px solid #0f172a;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  padding-top: 3px;
}

.verif-table-wrapper {
  overflow-x: auto;
  margin-bottom: 10px;
}

.verif-edit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.verif-edit-table th,
.verif-edit-table td {
  border: 1px solid #e2e8f0;
  padding: 6px 8px;
  text-align: left;
}

.verif-edit-table th {
  background: #f8fafc;
  font-weight: 700;
  color: #334155;
}

.verif-input {
  width: 100%;
  padding: 4px 6px;
  font-size: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
}

.verif-toggle-btn {
  border: none;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.verif-toggle-btn--ok {
  background: #dcfce7;
  color: #166534;
}

.verif-toggle-btn--obs {
  background: #fef3c7;
  color: #92400e;
}

.verif-del-btn {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.verif-del-btn:hover {
  background: #fee2e2;
}

.actas-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.actas-config-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.actas-config-card h3 {
  font-size: 0.82rem;
  font-weight: 800;
  color: #0a2446;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.actas-field-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.actas-field-row--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.actas-field-row--3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}

.actas-field-row label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
}

.actas-field-row input {
  width: 100%;
  padding: 5px 8px;
  font-size: 0.78rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  color: #0f172a;
}

.actas-config-hint {
  font-size: 0.74rem;
  color: #475569;
  line-height: 1.3;
}

.actas-hash-preview {
  margin-top: 8px;
  padding: 6px 8px;
  background: #ffffff;
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  font-size: 0.72rem;
}

.actas-hash-mono {
  font-family: "SF Mono", Consolas, monospace;
  font-weight: 700;
  color: #0369a1;
  margin-top: 2px;
  word-break: break-all;
}

/* Selector de pestañas */
.actas-tabs-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: #f1f5f9;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
}

.actas-tab-btn {
  background: #ffffff;
  color: #334155;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.actas-tab-btn--active {
  background: #0a2446;
  color: #ffffff;
  border-color: #0a2446;
}

.actas-tab-btn--all {
  margin-left: auto;
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

/* Lienzo A4 e Impresión */
.actas-a4-canvas {
  background: #cbd5e1;
  padding: 20px 10px;
  border-radius: 10px;
  overflow-x: auto;
}

.hoja-a4 {
  background: #ffffff;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 24px auto;
  padding: 13mm 14mm 16mm 14mm;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.18);
  position: relative;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 9pt;
  line-height: 1.32;
  color: #1e293b;
}

.encabezado-institucional {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #0a2446;
  padding-bottom: 6px;
  margin-bottom: 10px;
  position: relative;
}

.encabezado-institucional::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #ddab44;
}

.logo-entidad {
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.logo-pj-emblem {
  width: 52px;
  height: 52px;
  border: 2px solid #7c2d12;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fef2f2;
  color: #7c2d12;
  font-weight: 900;
  text-align: center;
}

.logo-pj-emblem__acronym {
  font-size: 13pt;
  line-height: 1;
}

.logo-pj-emblem__sub {
  font-size: 5.5pt;
  letter-spacing: 0.3px;
}

.texto-encabezado {
  text-align: center;
  flex: 1;
  padding: 0 10px;
}

.texto-encabezado .universidad {
  font-size: 10.5pt;
  font-weight: 800;
  color: #0a2446;
  text-transform: uppercase;
}

.texto-encabezado .area-rectora {
  font-size: 8.5pt;
  font-weight: 700;
  color: #1e3a5f;
}

.texto-encabezado .subtitulo-convenio {
  font-size: 7.5pt;
  font-style: italic;
  color: #64748b;
}

.titulo-documento-box {
  text-align: center;
  margin: 10px 0;
}

.titulo-documento {
  font-size: 11pt;
  font-weight: 900;
  color: #0a2446;
  text-transform: uppercase;
}

.meta-documento {
  display: flex;
  justify-content: space-between;
  font-size: 8pt;
  font-weight: 600;
  color: #64748b;
  margin-top: 3px;
  border-bottom: 1px dashed #cbd5e1;
  padding-bottom: 3px;
}

.seccion {
  margin-bottom: 9px;
}

.seccion-titulo {
  font-size: 8.8pt;
  font-weight: 800;
  color: #0a2446;
  background-color: #f1f5f9;
  border-left: 3.5px solid #1e3a5f;
  padding: 2.5px 6px;
  margin-bottom: 5px;
  text-transform: uppercase;
}

.texto-cuerpo {
  text-align: justify;
  font-size: 8.6pt;
  line-height: 1.38;
  margin-bottom: 5px;
}

table.tabla-formal {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  margin: 4px 0 8px 0;
}

table.tabla-formal th,
table.tabla-formal td {
  border: 1px solid #cbd5e1;
  padding: 3px 5px;
  vertical-align: middle;
}

table.tabla-formal th {
  background-color: #f1f5f9;
  color: #0a2446;
  font-weight: 700;
  text-align: center;
  font-size: 7.5pt;
  text-transform: uppercase;
}

table.tabla-claves-compacta th,
table.tabla-claves-compacta td {
  padding: 1.5px 4px;
  font-size: 7.1pt;
}

.grid-dos-columnas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  margin-bottom: 6px;
}

.campo-dato {
  font-size: 8.2pt;
}

.campo-etiqueta {
  font-weight: 700;
  color: #1e3a5f;
  margin-right: 4px;
}

.caja-hash {
  background-color: #f8fafc;
  border: 1px dashed #94a3b8;
  padding: 5px 8px;
  font-family: "SF Mono", Consolas, monospace;
  font-size: 7.8pt;
  color: #0f172a;
  word-break: break-all;
  border-radius: 3px;
}

/* Formato específico Doc 03-A (idéntico a modelo.jpeg) */
.recepcion-tarjetas-header {
  text-align: center;
  margin: 8px 0;
}

.recepcion-tarjetas-title {
  font-size: 13pt;
  font-weight: 900;
  color: #0a2446;
  text-decoration: underline;
  letter-spacing: 0.8px;
}

.recepcion-tarjetas-sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 7.8pt;
  font-weight: 700;
  color: #334155;
  margin-top: 4px;
}

.recepcion-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: #0369a1;
  cursor: pointer;
}

.recepcion-dos-bloques {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.recepcion-bloque__banner {
  background: #0a2446;
  color: #ffffff;
  font-size: 7.4pt;
  font-weight: 800;
  text-align: center;
  padding: 3px 6px;
}

.recepcion-bloque__banner--g2 {
  background: #1e3a5f;
}

.tabla-recepcion-modelo {
  width: 100%;
  border-collapse: collapse;
  font-size: 7pt;
  line-height: 1.15;
}

.tabla-recepcion-modelo th,
.tabla-recepcion-modelo td {
  border: 1px solid #334155;
  padding: 1.4px 4px;
  text-align: center;
}

.tabla-recepcion-modelo th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 800;
}

.celda-linea-check {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.conteo-leido {
  font-family: "SF Mono", Consolas, monospace;
  font-weight: 700;
  color: #0369a1;
  font-size: 6.8pt;
}

.linea-check-manual {
  color: #64748b;
  letter-spacing: -0.5px;
}

.fila-total-modelo {
  background: #f1f5f9;
  font-weight: 800;
}

.recepcion-resumen-bar {
  margin-top: 6px;
  padding: 4px 8px;
  background: #f8fafc;
  border: 1px solid #94a3b8;
  display: flex;
  justify-content: space-between;
  font-size: 7.4pt;
  font-weight: 800;
}

/* Firmas y Pie de Página */
.bloque-firmas {
  margin-top: 26px;
  page-break-inside: avoid;
  break-inside: avoid;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px 28px;
}

.cuadro-firma {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.espacio-sello-firma {
  height: 75px;
  min-height: 70px;
  width: 100%;
}

.linea-firma {
  width: 86%;
  border-top: 1.2px solid #000000;
  padding-top: 4px;
  font-size: 7.8pt;
  line-height: 1.22;
}

.linea-firma .nombre {
  font-weight: 800;
  color: #000000;
}

.linea-firma .cargo {
  color: #475569;
  font-size: 7.2pt;
}

.linea-firma .entidad {
  font-size: 6.8pt;
  font-weight: 700;
  text-transform: uppercase;
}

.pie-pagina {
  position: absolute;
  bottom: 7mm;
  left: 14mm;
  right: 14mm;
  display: flex;
  justify-content: space-between;
  font-size: 6.8pt;
  color: #64748b;
  border-top: 1px solid #cbd5e1;
  padding-top: 3px;
}

.text-center { text-align: center; }
.font-mono { font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace; }
.font-bold { font-weight: 700; }

@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }

  .no-print {
    display: none !important;
  }

  .actas-a4-canvas {
    background: none !important;
    padding: 0 !important;
  }

  .hoja-a4 {
    width: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  .salto-pagina {
    page-break-before: always;
    break-before: page;
  }
}
</style>
