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

const archives = useArchives()
const identifiers = useIdentifiers()
const responses = useResponses(
  identifiers.identifierLookup,
  identifiers.identifierLookupByLitho
)
const answerKeys = useAnswerKeys(archives.rows)
const ponderations = usePonderations()
const history = useHistory()
const toast = useToast()
const backup = useBackup()
const areas = useAreas()
const datFormat = useDatFormat()
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
  if (!process) return
  const ok = await history.saveProcess(process, customName)
  if (ok) {
    toast.showToast('Proceso guardado en el historial', 'success')
  } else {
    toast.showToast('Error al guardar el proceso', 'error')
  }
}

function navigateToHistory() {
  activeTab.value = 'history'
  history.fetchHistory()
}

function startNewProcess() {
  showNuevoProcesoModal.value = true
}

function confirmNewProcess({ name, type }) {
  archives.clearAll()
  identifiers.clearAllIdentifiers()
  responses.clearAllResponses()
  answerKeys.clearAllAnswerKeys()
  calification.startNewProcess({ name, type })
  showNuevoProcesoModal.value = false
  activeTab.value = TAB_KEYS.ARCHIVES
}

async function handleLoadProcess(process) {
  const hasResults = Object.values(process.areas || {}).some(a => a.results?.length > 0)
  if (!hasResults && process.dbId) {
    const full = await history.loadProcessFromApi(process.dbId)
    if (full) {
      calification.loadProcess(full)
      activeTab.value = TAB_KEYS.RESULTS
      return
    }
  }
  calification.loadProcess(process)
  activeTab.value = TAB_KEYS.RESULTS
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP NAV
// ═══════════════════════════════════════════════════════════════════════════

function getStepStatus(key) {
  if (key === TAB_KEYS.ARCHIVES) return archives.rows.value.length > 0 ? 'completed' : ''
  if (key === TAB_KEYS.IDENTIFIERS) return identifiers.rows.value.length > 0 ? 'completed' : ''
  if (key === TAB_KEYS.RESPONSES) return responses.rows.value.length > 0 ? 'completed' : ''
  if (key === TAB_KEYS.ANSWER_KEYS) return answerKeys.rows.value.length > 0 ? 'completed' : ''
  if (key === TAB_KEYS.PONDERATIONS) return ponderations.ponderationRows.value.length > 0 ? 'completed' : ''
  if (key === TAB_KEYS.RESULTS || key === TAB_KEYS.SCORES) return calification.calificationHasResults.value ? 'completed' : ''
  return ''
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
    return n > 0 ? `${n} postulantes` : 'Sin cargar'
  }
  if (key === TAB_KEYS.IDENTIFIERS) {
    const n = identifiers.rows.value.length
    return n > 0 ? `${n} registros` : 'Sin cargar'
  }
  if (key === TAB_KEYS.RESPONSES) {
    const n = responses.rows.value.length
    return n > 0 ? `${n} respuestas` : 'Sin cargar'
  }
  if (key === TAB_KEYS.ANSWER_KEYS) {
    const n = answerKeys.rows.value.length
    return n > 0 ? `${n} claves` : 'Sin cargar'
  }
  if (key === TAB_KEYS.PONDERATIONS) {
    const n = ponderations.plantillas.value.length
    return n > 0 ? `${n} plantilla${n !== 1 ? 's' : ''}` : 'Sin configurar'
  }
  if (key === TAB_KEYS.RESULTS || key === TAB_KEYS.SCORES) {
    const processAreas = calification.processAreas.value
    return processAreas.length > 0 ? `${processAreas.length} área(s) calculada(s)` : 'Sin calificar'
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
            @go-config="activeTab = 'config'"
          />

          <IdentifiersTab
            v-else-if="activeTab === TAB_KEYS.IDENTIFIERS"
            :identifiers="identifiers"
            :sub-tab="identifierSubTab"
            @update:sub-tab="identifierSubTab = $event"
          />

          <ResponsesTab
            v-else-if="activeTab === TAB_KEYS.RESPONSES"
            :responses="responses"
            :sub-tab="responsesSubTab"
            :identifiers-loaded="identifiers.rows.value.length > 0"
            :linked-count="linkedResponsesCount"
            @update:sub-tab="responsesSubTab = $event"
          />

          <AnswerKeysTab
            v-else-if="activeTab === TAB_KEYS.ANSWER_KEYS"
            :answer-keys="answerKeys"
            :sub-tab="answerKeySubTab"
            @update:sub-tab="answerKeySubTab = $event"
          />

          <PonderationsTab
            v-else-if="activeTab === TAB_KEYS.PONDERATIONS"
            :ponderations="ponderations"
            :answers-length="datFormat.formatConfig.value?.answersLength ?? 60"
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
