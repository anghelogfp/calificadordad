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
import { useConvocatoria } from '@/composables/useConvocatoria'
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
import BackupModal from '@/components/modals/BackupModal.vue'
import NuevoProcesoModal from '@/components/modals/NuevoProcesoModal.vue'
import ConvocatoriaPanel from '@/components/panels/ConvocatoriaPanel.vue'
import DashboardPanel from '@/components/panels/DashboardPanel.vue'

// Views (sidebar)
import HistoryView from '@/components/views/HistoryView.vue'
import ConfigView from '@/components/views/ConfigView.vue'
import ToastContainer from '@/components/shared/ToastContainer.vue'

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE
// ═══════════════════════════════════════════════════════════════════════════

const auth = useAuth()

const activeTab = useStorage('calificador-active-tab', TAB_KEYS.ARCHIVES)
const identifierSubTab = useStorage('calificador-identificador-subtab', IDENTIFIER_SUBTABS.LIST)
const responsesSubTab = useStorage('calificador-respuestas-subtab', RESPONSES_SUBTABS.LIST)
const answerKeySubTab = useStorage('calificador-claves-subtab', ANSWER_KEY_SUBTABS.LIST)

// Vistas del sidebar — history y config renderizan en el área central sin StepNav
const PROCESS_TABS = [TAB_KEYS.ARCHIVES, TAB_KEYS.IDENTIFIERS, TAB_KEYS.RESPONSES, TAB_KEYS.ANSWER_KEYS, TAB_KEYS.RESULTS]
const showStepNav = computed(() => PROCESS_TABS.includes(activeTab.value))

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
const convocatoria = useConvocatoria()
const areas = useAreas(convocatoria.activeConvocatoria)
const datFormat = useDatFormat(convocatoria.activeConvocatoria)
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
  convocatoria.activeConvocatoriaId,
  datFormat.formatConfig,
  areas.areaByName,
  vacantesPrograma.vacantesPrograma
)

const dashboard = useScoreDashboard(calification.calificationAllResults, areas.areaByName)
const showDashboardPanel = ref(false)
const showNuevoProcesoModal = ref(false)

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

function confirmNewProcess(selectedConvocatoria) {
  convocatoria.setActiveConvocatoria(selectedConvocatoria)
  archives.clearAll()
  identifiers.clearAllIdentifiers()
  responses.clearAllResponses()
  answerKeys.clearAllAnswerKeys()
  calification.resetCalificationResults()
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

onMounted(async () => {
  await auth.initialize()
  if (auth.isAuthenticated.value) {
    // Limpiar localStorage legacy (ahora viven en la BD)
    localStorage.removeItem('calificador-plantillas')
    localStorage.removeItem('calificador-historial')
    await ponderations.initializePonderations()
    convocatoria.fetchConvocatorias()
  }
})
</script>

<template>
  <ToastContainer />
  <LoginPage v-if="!auth.isAuthenticated.value" />

  <div v-else class="app-layout">
    <AppHeader
      :convocatoria="convocatoria.activeConvocatoria.value"
      @open-convocatoria="convocatoria.showPanel.value = true"
    />

    <div class="app-body">
      <AppSidebar
        :history-count="history.historyList.value.length"
        :active-tab="activeTab"
        :active-ponderations="activeTab === TAB_KEYS.PONDERATIONS"
        :active-history="activeTab === 'history'"
        :active-config="activeTab === 'config'"
        @new-process="startNewProcess"
        @open-ponderations="activeTab = TAB_KEYS.PONDERATIONS"
        @open-history="navigateToHistory"
        @open-config="activeTab = 'config'"
        @open-backup="backup.showModal.value = true"
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
          <ArchivesTab
            v-if="activeTab === TAB_KEYS.ARCHIVES"
            :archives="archives"
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
            :convocatoria-name="convocatoria.activeConvocatoriaName.value"
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
            :convocatoria-id="convocatoria.activeConvocatoriaId.value"
          />
        </main>
      </div>
    </div>

    <NuevoProcesoModal
      :show="showNuevoProcesoModal"
      :convocatoria="convocatoria"
      :has-data="hasProcessData"
      @confirm="confirmNewProcess"
      @close="showNuevoProcesoModal = false"
    />

    <CalificationModal
      :show="calification.showCalificationModal.value"
      :calification="calification"
      :vacantes-programa="vacantesPrograma"
      @close="calification.closeCalificationModal"
    />

    <BackupModal
      :show="backup.showModal.value"
      :backup="backup"
      @close="backup.showModal.value = false"
    />

    <ConvocatoriaPanel
      :convocatoria="convocatoria"
      @close="convocatoria.showPanel.value = false"
    />

    <DashboardPanel
      :show="showDashboardPanel"
      :dashboard="dashboard"
      @close="showDashboardPanel = false"
    />

  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8);
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1024px) {
  .app-main { padding: var(--space-5); }
}
</style>
