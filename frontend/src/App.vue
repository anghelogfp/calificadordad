<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { TAB_KEYS, tabs, IDENTIFIER_SUBTABS, RESPONSES_SUBTABS, ANSWER_KEY_SUBTABS } from '@/constants'

// Auth
import { useAuth } from '@/composables/useAuth'
import LoginPage from '@/components/auth/LoginPage.vue'

// Composables
import { useArchives } from '@/composables/useArchives'
import { useIdentifiers } from '@/composables/useIdentifiers'
import { useResponses } from '@/composables/useResponses'
import { useAnswerKeys } from '@/composables/useAnswerKeys'
import { usePonderations } from '@/composables/usePonderations'
import { useCalification } from '@/composables/useCalification'
import { useHistory } from '@/composables/useHistory'
import { useBackup } from '@/composables/useBackup'
import { useAreas } from '@/composables/useAreas'
import { useDatFormat } from '@/composables/useDatFormat'
import { useScoreDashboard } from '@/composables/useScoreDashboard'
import { useExport } from '@/composables/useExport'
import { useVacantesPrograma } from '@/composables/useVacantesPrograma'
import { useToast } from '@/composables/useToast'
import { GENERAL_SIMULACRO_AREA, REAL_TEST_TYPES } from '@/utils/calificationHelpers'

// Layout
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import StepNav from '@/components/layout/StepNav.vue'

// Tabs
import ArchivesTab from '@/components/tabs/ArchivesTab.vue'
import IdentifiersTab from '@/components/tabs/IdentifiersTab.vue'
import ResponsesTab from '@/components/tabs/ResponsesTab.vue'
import AnswerKeysTab from '@/components/tabs/AnswerKeysTab.vue'
import ScoresTab from '@/components/tabs/ScoresTab.vue'
import PonderationsTab from '@/components/tabs/PonderationsTab.vue'

// Modals & Panels
import CalificationModal from '@/components/modals/CalificationModal.vue'
import NuevoProcesoModal from '@/components/modals/NuevoProcesoModal.vue'
import DashboardPanel from '@/components/panels/DashboardPanel.vue'

// Views (sidebar)
import DashboardHomeView from '@/components/views/DashboardHomeView.vue'
import HistoryView from '@/components/views/HistoryView.vue'
import ConfigView from '@/components/views/ConfigView.vue'
import VerificadorView from '@/components/views/VerificadorView.vue'
import UsuariosView from '@/components/views/UsuariosView.vue'
import BackupView from '@/components/views/BackupView.vue'
import ToastContainer from '@/components/shared/ToastContainer.vue'

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE
// ═══════════════════════════════════════════════════════════════════════════

const auth = useAuth()

const activeTab = useStorage('calificador-active-tab', 'dashboard')
const identifierSubTab = useStorage('calificador-identificador-subtab', IDENTIFIER_SUBTABS.LIST)
const responsesSubTab = useStorage('calificador-respuestas-subtab', RESPONSES_SUBTABS.LIST)
const answerKeySubTab = useStorage('calificador-claves-subtab', ANSWER_KEY_SUBTABS.LIST)

// Vistas del sidebar — history y config renderizan en el área central sin StepNav
const PROCESS_TABS = [TAB_KEYS.ARCHIVES, TAB_KEYS.IDENTIFIERS, TAB_KEYS.RESPONSES, TAB_KEYS.ANSWER_KEYS, TAB_KEYS.RESULTS]
const showStepNav = computed(() => PROCESS_TABS.includes(activeTab.value))

// Último paso del stepper visitado — permite volver desde vistas secundarias
const lastStepperTab = useStorage('calificador-last-stepper-tab', '')
watch(activeTab, (tab) => {
  if (PROCESS_TABS.includes(tab)) lastStepperTab.value = tab
}, { immediate: true })

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSABLES
// ═══════════════════════════════════════════════════════════════════════════

const areas = useAreas()
const archives = useArchives(areas.areaNames)
const datFormat = useDatFormat()
const identifiers = useIdentifiers(datFormat.formatConfig)
const responses = useResponses(
  identifiers.identifierLookup,
  identifiers.identifierLookupByLitho,
  datFormat.formatConfig
)
const answerKeys = useAnswerKeys(archives.rows, areas.areaNames, datFormat.formatConfig)
const ponderations = usePonderations(areas.areaNames)
const history = useHistory()
const toast = useToast()
const backup = useBackup()
const exporter = useExport()
const vacantesPrograma = useVacantesPrograma()

const calification = useCalification(
  archives.rows,
  responses.rows,
  answerKeys.rows,
  ponderations,
  responses.responsesByDni,
  answerKeys.answerKeyLookupByAreaTipo,
  areas.areaNames,
  datFormat.formatConfig,
  vacantesPrograma.vacantesPrograma,
  answerKeys.answerKeyFallbackByArea
)

const dashboard = useScoreDashboard(calification.calificationAllResults)
const showDashboardPanel = ref(false)
const showNuevoProcesoModal = ref(false)
const savingToHistory = ref(false)
const savedProcessFingerprint = ref('')
const mobileMenuOpen = ref(false)
const appBootstrapping = ref(true)
const authenticatedDataInitialized = ref(false)
let authenticatedDataPromise = null

// Responses vinculadas con identificadores (aula viene solo del identificador)
const linkedResponsesCount = computed(() =>
  responses.rows.value.filter(r => r.dni && r.dni !== '').length
)

const hasProcessData = computed(() =>
  archives.rows.value.length > 0 ||
  identifiers.rows.value.length > 0 ||
  responses.rows.value.length > 0 ||
  answerKeys.rows.value.length > 0
)

// Programas disponibles agrupados por área, derivados del padrón cargado
const programasByArea = computed(() => {
  const map = new Map()
  archives.rows.value.forEach((row) => {
    const area = row.area?.trim() || 'Sin área'
    const prog = row.programa?.trim()
    if (!prog) return
    if (!map.has(area)) map.set(area, new Set())
    map.get(area).add(prog)
  })
  const result = new Map()
  map.forEach((set, area) => result.set(area, Array.from(set).sort()))
  return result
})

function onlyDigits(value) {
  const digits = String(value ?? '').match(/\d/g)
  return digits ? digits.join('') : ''
}

function firstLetter(value) {
  return String(value ?? '').trim().toUpperCase().slice(0, 1)
}

function countDuplicates(values) {
  const counts = new Map()
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0)
}

const identifierReconciliation = computed(() => {
  const padronDnis = new Set(archives.rows.value.map(row => onlyDigits(row.dni)).filter(Boolean))
  const identifierDnis = identifiers.rows.value.map(row => onlyDigits(row.dni)).filter(Boolean)
  const identifierDniSet = new Set(identifierDnis)
  const matchedCandidates = [...padronDnis].filter(dni => identifierDniSet.has(dni)).length
  const missingIdentifiers = [...padronDnis].filter(dni => !identifierDniSet.has(dni)).length
  const identifiersWithoutCandidate = identifierDnis.filter(dni => !padronDnis.has(dni)).length
  const duplicateIdentifierDnis = countDuplicates(identifierDnis)
  const duplicateMatchKeys = countDuplicates(
    identifiers.rows.value.map(row => {
      const litho = onlyDigits(row.litho)
      const indicator = firstLetter(row.indicator)
      const folio = String(row.folio || '').trim()
      return litho && folio ? `${litho}|${indicator}|${folio}` : ''
    }),
  )
  const issues = missingIdentifiers + identifiersWithoutCandidate + duplicateIdentifierDnis + duplicateMatchKeys
  return {
    padronTotal: padronDnis.size,
    identifiersTotal: identifiers.rows.value.length,
    matchedCandidates,
    missingIdentifiers,
    identifiersWithoutCandidate,
    duplicateIdentifierDnis,
    duplicateMatchKeys,
    issues,
    status: issues === 0 && padronDnis.size > 0 && identifiers.rows.value.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
})

const responseReconciliation = computed(() => {
  const padronDnis = new Set(archives.rows.value.map(row => onlyDigits(row.dni)).filter(Boolean))
  const identifierDnis = new Set(identifiers.rows.value.map(row => onlyDigits(row.dni)).filter(Boolean))
  const responseDnis = responses.rows.value.map(row => onlyDigits(row.dni)).filter(Boolean)
  const responseDniSet = new Set(responseDnis)
  const linkedResponses = responses.rows.value.filter(row => onlyDigits(row.dni)).length
  const unlinkedResponses = responses.rows.value.length - linkedResponses
  const responsesWithoutCandidate = responseDnis.filter(dni => !padronDnis.has(dni)).length
  const candidatesWithoutResponse = [...padronDnis].filter(dni => !responseDniSet.has(dni)).length
  const identifiersWithoutResponse = [...identifierDnis].filter(dni => !responseDniSet.has(dni)).length
  const duplicateResponseDnis = countDuplicates(responseDnis)
  const issues = unlinkedResponses + responsesWithoutCandidate + candidatesWithoutResponse + duplicateResponseDnis
  return {
    responsesTotal: responses.rows.value.length,
    linkedResponses,
    unlinkedResponses,
    responsesWithoutCandidate,
    candidatesWithoutResponse,
    identifiersWithoutResponse,
    duplicateResponseDnis,
    issues,
    status: issues === 0 && responses.rows.value.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
})

const answerKeyReconciliation = computed(() => {
  const processIsReal = calification.processType.value === 'real'
  const isGeneralSimulacro = !processIsReal && calification.simulacroScope.value === 'general'
  const activeAreas = areas.areaNames.value.length ? areas.areaNames.value : []
  const expectedAreas = activeAreas.filter(area =>
    archives.rows.value.some(row => String(row.area || '').trim().toLowerCase() === area.toLowerCase())
  )
  const areasToCheck = expectedAreas.length ? expectedAreas : activeAreas
  const areaTypes = new Map()
  responses.rows.value.forEach((row) => {
    const dni = onlyDigits(row.dni)
    const candidate = archives.archiveByDni.value.get(dni)
    const area = candidate?.area || ''
    const type = firstLetter(row.tipo)
    if (!area || !type) return
    const canonical = areasToCheck.find(a => a.toLowerCase() === String(area).trim().toLowerCase()) || area
    if (!areaTypes.has(canonical)) areaTypes.set(canonical, new Set())
    areaTypes.get(canonical).add(type)
  })

  const keyByAreaType = new Set()
  const keyByArea = new Set()
  const generalKeys = answerKeys.rows.value.filter(row => !String(row.area || '').trim()).length
  answerKeys.rows.value.forEach((row) => {
    const area = String(row.area || '').trim()
    const type = firstLetter(row.tipo)
    if (area) keyByArea.add(area.toLowerCase())
    if (area && type) keyByAreaType.add(`${area.toLowerCase()}|${type}`)
  })

  const requiredPairs = []
  if (processIsReal) {
    areasToCheck.forEach((area) => {
      REAL_TEST_TYPES.forEach(type => requiredPairs.push({ area, type }))
    })
  } else if (isGeneralSimulacro) {
    if (responses.rows.value.length || archives.rows.value.length) {
      requiredPairs.push({ area: GENERAL_SIMULACRO_AREA, type: 'General' })
    }
  } else {
    const expectedAreaKeys = expectedAreas.length ? expectedAreas : [...areaTypes.keys()]
    expectedAreaKeys.forEach(area => requiredPairs.push({ area, type: '' }))
  }

  const missingPairs = isGeneralSimulacro && generalKeys > 0
    ? []
    : isGeneralSimulacro
      ? (requiredPairs.length && answerKeys.rows.value.length === 0 ? requiredPairs : [])
      : processIsReal
        ? requiredPairs.filter(({ area, type }) =>
          !keyByAreaType.has(`${area.toLowerCase()}|${type}`)
        )
        : requiredPairs.filter(({ area }) =>
          !keyByArea.has(area.toLowerCase())
        )
  const duplicatePairs = countDuplicates(
    answerKeys.rows.value.map(row => {
      const area = String(row.area || '').trim().toLowerCase()
      const type = firstLetter(row.tipo)
      if (processIsReal) return area && type ? `${area}|${type}` : ''
      return area || (!String(row.area || '').trim() ? GENERAL_SIMULACRO_AREA.toLowerCase() : '')
    }),
  )
  const incompleteKeys = answerKeys.rows.value.filter(row =>
    row.observaciones && row.observaciones !== 'Sin observaciones'
  ).length
  const issues = missingPairs.length + duplicatePairs + incompleteKeys
  return {
    keysTotal: answerKeys.rows.value.length,
    generalKeys,
    requiredPairs: requiredPairs.length,
    coveredPairs: Math.max(0, requiredPairs.length - missingPairs.length),
    missingPairs,
    duplicatePairs,
    incompleteKeys,
    issues,
    mode: processIsReal ? 'real' : isGeneralSimulacro ? 'simulacro-general' : 'simulacro-areas',
    generalKeyCoversSimulacro: isGeneralSimulacro && generalKeys > 0,
    status: issues === 0 && answerKeys.rows.value.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
})

function getProcessFingerprint(process) {
  if (!process?.id || !Object.keys(process.areas || {}).length) return ''
  return JSON.stringify({
    id: process.id,
    name: process.name || '',
    type: process.type || 'simulacro',
    simulacroScope: process.simulacroScope || '',
    areas: process.areas || {},
  })
}

const currentProcessFingerprint = computed(() =>
  getProcessFingerprint(calification.getActiveProcess())
)

const resultSavedToHistory = computed(() =>
  Boolean(currentProcessFingerprint.value && currentProcessFingerprint.value === savedProcessFingerprint.value)
)

// ═══════════════════════════════════════════════════════════════════════════
// WATCHERS
// ═══════════════════════════════════════════════════════════════════════════

watch(
  [identifiers.rows, responses.rows],
  () => {
    responses.rows.value.forEach((row) => {
      responses.applyIdentifierDataToResponseRow(
        row,
        identifiers.identifierLookup.value,
        identifiers.identifierLookupByLitho.value
      )
    })
  },
  { deep: true }
)

watch(activeTab, () => {
  mobileMenuOpen.value = false
})

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ═══════════════════════════════════════════════════════════════════════════

async function saveToHistory(customName) {
  const process = calification.getActiveProcess()
  if (!process) return false
  const name = customName || process.name
  savingToHistory.value = true
  let ok = false
  try {
    ok = await history.saveProcess(process, name)
  } finally {
    savingToHistory.value = false
  }
  if (ok) {
    calification.activeProcess.value = { ...calification.activeProcess.value, name }
    calification.processName.value = name
    savedProcessFingerprint.value = getProcessFingerprint(calification.getActiveProcess())
    toast.showToast('Proceso guardado en el historial', 'success')
  } else {
    toast.showToast('Error al guardar el proceso', 'error')
  }
  return ok
}

function navigateToHistory() {
  activeTab.value = 'history'
  history.fetchHistory()
}

function startNewProcess() {
  showNuevoProcesoModal.value = true
}

function confirmNewProcess({ name, type, simulacroScope }) {
  archives.clearAll()
  identifiers.clearAllIdentifiers()
  responses.clearAllResponses()
  answerKeys.clearAllAnswerKeys()
  savedProcessFingerprint.value = ''
  calification.startNewProcess({ name, type, simulacroScope })
  showNuevoProcesoModal.value = false
  activeTab.value = TAB_KEYS.ARCHIVES
}

async function handleLoadProcess(process) {
  const hasResults = Object.values(process.areas || {}).some(a => a.results?.length > 0)
  if (!hasResults && process.dbId) {
    const full = await history.loadProcessFromApi(process.dbId)
    if (full) {
      calification.loadProcess(full)
      savedProcessFingerprint.value = getProcessFingerprint(calification.getActiveProcess())
      activeTab.value = TAB_KEYS.RESULTS
      return
    }
  }
  calification.loadProcess(process)
  savedProcessFingerprint.value = getProcessFingerprint(calification.getActiveProcess())
  activeTab.value = TAB_KEYS.RESULTS
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP NAV
// ═══════════════════════════════════════════════════════════════════════════

function getStepStatus(key) {
  if (key === TAB_KEYS.ARCHIVES) return archives.rows.value.length > 0 ? 'completed' : 'pending'
  if (key === TAB_KEYS.IDENTIFIERS) {
    if (identifiers.rows.value.length === 0) return 'pending'
    return identifierReconciliation.value.issues > 0 ? 'warning' : 'completed'
  }
  if (key === TAB_KEYS.RESPONSES) {
    if (responses.rows.value.length === 0) return 'pending'
    return responseReconciliation.value.issues > 0 || responses.actionableObservationCount.value > 0 ? 'warning' : 'completed'
  }
  if (key === TAB_KEYS.ANSWER_KEYS) {
    if (answerKeyReconciliation.value.status === 'ok') return 'completed'
    if (answerKeys.rows.value.length > 0 && answerKeyReconciliation.value.status === 'warn') return 'warning'
    return 'pending'
  }
  if (key === TAB_KEYS.RESULTS || key === TAB_KEYS.SCORES) {
    if (calification.calificationHasResults.value) return 'completed'
    if (calification.preflightCheck.value.hasBlockers) return 'pending'
    if (calification.preflightCheck.value.hasWarnings) return 'warning'
    return 'pending'
  }
  return 'pending'
}

function getStepLabel(key) {
  const tab = tabs.find((t) => t.key === key)
  const full = tab?.label || key
  const parts = full.split(' · ')
  return parts.length > 1 ? parts[1] : full
}

function getStepDescription(key) {
  if (key === TAB_KEYS.ARCHIVES) {
    const n = archives.rows.value.length
    return n > 0 ? `${n} postulantes cargados` : 'Base obligatoria'
  }
  if (key === TAB_KEYS.IDENTIFIERS) {
    const n = identifiers.rows.value.length
    if (n === 0) return 'Vincula aula y lectura'
    return identifierReconciliation.value.issues > 0 ? `${n} registros con observaciones` : `${n} registros listos`
  }
  if (key === TAB_KEYS.RESPONSES) {
    const n = responses.rows.value.length
    if (n === 0) return 'Necesarias para calificar'
    const linked = responseReconciliation.value.linkedResponses
    const reviewCount = Math.max(responseReconciliation.value.issues, responses.actionableObservationCount.value)
    return reviewCount > 0
      ? `${linked}/${n} vinculadas, ${reviewCount} por revisar`
      : `${linked}/${n} vinculadas`
  }
  if (key === TAB_KEYS.ANSWER_KEYS) {
    const { keysTotal, missingPairs, incompleteKeys, duplicatePairs } = answerKeyReconciliation.value
    const issues = missingPairs.length + incompleteKeys + duplicatePairs
    if (keysTotal === 0) return 'Sin claves cargadas'
    return issues > 0 ? `${keysTotal} claves, ${issues} observación(es)` : `${keysTotal} claves listas`
  }
  if (key === TAB_KEYS.RESULTS || key === TAB_KEYS.SCORES) {
    const processAreas = calification.processAreas.value
    if (processAreas.length > 0) return `${processAreas.length} área(s) calculada(s)`
    if (calification.preflightCheck.value.hasBlockers) return 'Hay faltantes obligatorios'
    if (calification.preflightCheck.value.hasWarnings) return 'Listo con observaciones'
    return 'Pendiente de cálculo'
  }
  return ''
}

function getStepAction(key) {
  if (key === TAB_KEYS.ARCHIVES) {
    return archives.rows.value.length > 0 ? 'Revisar padrón' : 'Cargar padrón Excel'
  }
  if (key === TAB_KEYS.IDENTIFIERS) {
    if (identifiers.rows.value.length === 0) return 'Cargar identificadores'
    return identifierReconciliation.value.issues > 0 ? 'Revisar cruces' : 'Continuar'
  }
  if (key === TAB_KEYS.RESPONSES) {
    if (responses.rows.value.length === 0) return 'Cargar respuestas'
    return responseReconciliation.value.issues > 0 ? 'Revisar vinculaciones' : 'Continuar'
  }
  if (key === TAB_KEYS.ANSWER_KEYS) {
    if (answerKeys.rows.value.length === 0) return 'Cargar claves'
    return answerKeyReconciliation.value.issues > 0 ? 'Corregir faltantes' : 'Continuar'
  }
  if (key === TAB_KEYS.RESULTS || key === TAB_KEYS.SCORES) {
    if (calification.calificationHasResults.value) return 'Revisar resultados'
    if (calification.preflightCheck.value.hasBlockers) return 'Resolver faltantes'
    return 'Calcular puntajes'
  }
  return ''
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

async function initializeAuthenticatedData() {
  if (authenticatedDataInitialized.value) return authenticatedDataPromise
  if (authenticatedDataPromise) return authenticatedDataPromise

  appBootstrapping.value = true
  authenticatedDataPromise = (async () => {
    localStorage.removeItem('calificador-plantillas')
    localStorage.removeItem('calificador-historial')
    await areas.fetchAreas()
    await datFormat.fetchFormatConfig()
    await archives.initializeArchives()
    await identifiers.initializeIdentifiers()
    await responses.initializeResponses()
    await answerKeys.initializeAnswerKeys()
    await vacantesPrograma.initializeVacantesPrograma()
    await calification.initializeCalificationConfig()
    await ponderations.initializePonderations()
    authenticatedDataInitialized.value = true
  })()

  try {
    await authenticatedDataPromise
  } finally {
    appBootstrapping.value = false
  }

  return authenticatedDataPromise
}

onMounted(async () => {
  await auth.initialize()
  if (auth.isAuthenticated.value) {
    await initializeAuthenticatedData()
  } else {
    appBootstrapping.value = false
  }
})

watch(
  () => auth.isAuthenticated.value,
  async (isAuthenticated) => {
    if (auth.initializing.value) return
    if (isAuthenticated) {
      await initializeAuthenticatedData()
    } else {
      authenticatedDataInitialized.value = false
      authenticatedDataPromise = null
      appBootstrapping.value = false
    }
  }
)
</script>

<template>
  <ToastContainer />

  <!-- Verificando token — evita el flash del login al recargar -->
  <div v-if="auth.initializing.value || appBootstrapping" key="auth-splash" class="auth-splash">
    <div class="auth-splash__spinner"></div>
  </div>

  <LoginPage v-else-if="!auth.isAuthenticated.value" />

  <div v-else key="app-layout" class="app-layout">
    <AppHeader
      :mobile-menu-open="mobileMenuOpen"
      @go-home="activeTab = 'dashboard'; mobileMenuOpen = false"
      @toggle-mobile-menu="mobileMenuOpen = !mobileMenuOpen"
    />

    <div class="app-body">
      <AppSidebar
        :history-count="history.historyList.value.length"
        :active-tab="activeTab"
        :active-dashboard="activeTab === 'dashboard'"
        :active-ponderations="activeTab === TAB_KEYS.PONDERATIONS"
        :active-history="activeTab === 'history'"
        :active-config="activeTab === 'config'"
        :active-verificador="activeTab === 'verificador'"
        :active-backup="activeTab === 'backup'"
        :active-usuarios="activeTab === 'usuarios'"
        :is-staff="auth.user.value?.is_staff ?? false"
        :mobile-open="mobileMenuOpen"
        :last-process-tab="lastStepperTab"
        @new-process="startNewProcess"
        @continue-process="activeTab = lastStepperTab"
        @open-dashboard="activeTab = 'dashboard'"
        @open-ponderations="activeTab = TAB_KEYS.PONDERATIONS"
        @open-history="navigateToHistory"
        @open-config="activeTab = 'config'"
        @open-backup="activeTab = 'backup'"
        @open-verificador="activeTab = 'verificador'"
        @open-usuarios="activeTab = 'usuarios'"
        @close-mobile="mobileMenuOpen = false"
      />

      <div class="app-content">
        <StepNav
          v-if="showStepNav"
          :tabs="tabs"
          :active-tab="activeTab"
          :get-step-status="getStepStatus"
          :get-step-label="getStepLabel"
          :get-step-description="getStepDescription"
          :get-step-action="getStepAction"
          @update:active-tab="activeTab = $event"
        />

        <main class="app-main">

          <!-- Breadcrumb — aparece en todas las vistas excepto dashboard -->
          <nav v-if="activeTab !== 'dashboard'" class="breadcrumb">
            <button type="button" class="breadcrumb__back" @click="activeTab = 'dashboard'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Inicio
            </button>
            <span class="breadcrumb__sep">/</span>
            <span class="breadcrumb__current">{{
              activeTab === TAB_KEYS.ARCHIVES    ? 'Padrón de postulantes' :
              activeTab === TAB_KEYS.IDENTIFIERS ? 'Identificadores' :
              activeTab === TAB_KEYS.RESPONSES   ? 'Respuestas' :
              activeTab === TAB_KEYS.ANSWER_KEYS ? 'Claves de respuestas' :
              activeTab === TAB_KEYS.SCORES      ? 'Resultados' :
              activeTab === TAB_KEYS.PONDERATIONS ? 'Ponderaciones' :
              activeTab === 'history'    ? 'Historial de procesos' :
              activeTab === 'config'     ? 'Configuración' :
              activeTab === 'verificador' ? 'Verificador' :
              activeTab === 'usuarios'   ? 'Usuarios' :
              activeTab === 'backup'     ? 'Backup' : activeTab
            }}</span>
          </nav>

          <DashboardHomeView
            v-if="activeTab === 'dashboard'"
            :history="history"
            :areas="areas"
            :current-user="auth.user.value?.username ?? ''"
            :last-process-tab="lastStepperTab"
            @load-process="handleLoadProcess"
            @new-process="startNewProcess"
            @open-verificador="activeTab = 'verificador'"
            @open-history="navigateToHistory"
            @continue-process="activeTab = lastStepperTab"
          />

          <ArchivesTab
            v-else-if="activeTab === TAB_KEYS.ARCHIVES"
            :archives="archives"
            :area-names="areas.areaNames.value"
            :process-type="calification.processType.value"
            :simulacro-scope="calification.simulacroScope.value"
            @go-config="activeTab = 'config'"
          />

          <IdentifiersTab
            v-else-if="activeTab === TAB_KEYS.IDENTIFIERS"
            :identifiers="identifiers"
            :sub-tab="identifierSubTab"
            :reconciliation="identifierReconciliation"
            :process-type="calification.processType.value"
            :simulacro-scope="calification.simulacroScope.value"
            @update:sub-tab="identifierSubTab = $event"
          />

          <ResponsesTab
            v-else-if="activeTab === TAB_KEYS.RESPONSES"
            :responses="responses"
            :sub-tab="responsesSubTab"
            :identifiers-loaded="identifiers.rows.value.length > 0"
            :linked-count="linkedResponsesCount"
            :reconciliation="responseReconciliation"
            :process-type="calification.processType.value"
            :simulacro-scope="calification.simulacroScope.value"
            @update:sub-tab="responsesSubTab = $event"
          />

          <AnswerKeysTab
            v-else-if="activeTab === TAB_KEYS.ANSWER_KEYS"
            :answer-keys="answerKeys"
            :sub-tab="answerKeySubTab"
            :reconciliation="answerKeyReconciliation"
            :process-type="calification.processType.value"
            :simulacro-scope="calification.simulacroScope.value"
            @update:sub-tab="answerKeySubTab = $event"
          />

          <PonderationsTab
            v-else-if="activeTab === TAB_KEYS.PONDERATIONS"
            :ponderations="ponderations"
            :answers-length="datFormat.formatConfig.value?.answersLength ?? 60"
            :process-type="calification.processType.value"
            :simulacro-scope="calification.simulacroScope.value"
          />

          <ScoresTab
            v-else-if="activeTab === TAB_KEYS.SCORES"
            :calification="calification"
            :ponderations="ponderations"
            :dashboard="dashboard"
            :exporter="exporter"
            :vacantes-programa="vacantesPrograma"
            :convocatoria-name="calification.processName.value"
            :on-save-to-history="saveToHistory"
            :is-saved-to-history="resultSavedToHistory"
            :saving-to-history="savingToHistory"
            @open-modal="calification.openCalificationModal"
            @open-dashboard="showDashboardPanel = true"
          />

          <HistoryView
            v-else-if="activeTab === 'history'"
            :history="history"
            @load-process="handleLoadProcess"
          />

          <ConfigView
            v-else-if="activeTab === 'config'"
            :programas-by-area="programasByArea"
            :vacantes-programa="vacantesPrograma"
            :dat-format="datFormat"
            :areas="areas"
          />

          <VerificadorView
            v-else-if="activeTab === 'verificador'"
            :ponderations="ponderations"
            :current-user="auth.user.value?.username ?? ''"
          />

          <UsuariosView
            v-else-if="activeTab === 'usuarios'"
          />

          <BackupView
            v-else-if="activeTab === 'backup'"
            :backup="backup"
          />
        </main>
      </div>
    </div>

    <NuevoProcesoModal
      :show="showNuevoProcesoModal"
      :has-data="hasProcessData"
      :areas-count="areas.areas.value.length"
      :plantillas-count="ponderations.plantillas.value.length"
      @confirm="confirmNewProcess"
      @close="showNuevoProcesoModal = false"
    />

    <CalificationModal
      :show="calification.showCalificationModal.value"
      :calification="calification"
      :vacantes-programa="vacantesPrograma"
      @close="calification.closeCalificationModal"
    />

    <DashboardPanel
      :show="showDashboardPanel"
      :dashboard="dashboard"
      @close="showDashboardPanel = false"
    />

  </div>
</template>

<style scoped>
.auth-splash {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--unap-blue-900, #0a2a5e);
}

.auth-splash__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.app-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-8);
  max-width: none;
  min-width: 0;
  width: 100%;
  margin: 0;
}

.app-main > * {
  min-width: 0;
  max-width: 100%;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.breadcrumb__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-full);
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.breadcrumb__back svg {
  width: 14px;
  height: 14px;
}
.breadcrumb__back:hover {
  background: var(--unap-blue-100);
  color: var(--unap-blue-800);
}

.breadcrumb__sep {
  color: var(--slate-300);
  font-size: 0.85rem;
  user-select: none;
}

.breadcrumb__current {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--slate-500);
}

@media (max-width: 1024px) {
  .app-main { padding: var(--space-5); }
}
</style>
