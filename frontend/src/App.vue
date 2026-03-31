<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { TAB_KEYS, tabs, IDENTIFIER_SUBTABS, RESPONSES_SUBTABS, ANSWER_KEY_SUBTABS } from '@/constants'

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

// Layout
import AppHeader from '@/components/layout/AppHeader.vue'
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
import HistoryPanel from '@/components/panels/HistoryPanel.vue'
import ConvocatoriaPanel from '@/components/panels/ConvocatoriaPanel.vue'
import DashboardPanel from '@/components/panels/DashboardPanel.vue'
import ConfigPanel from '@/components/panels/ConfigPanel.vue'

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE
// ═══════════════════════════════════════════════════════════════════════════

const activeTab = useStorage('calificador-active-tab', TAB_KEYS.ARCHIVES)
const identifierSubTab = useStorage('calificador-identificador-subtab', IDENTIFIER_SUBTABS.LIST)
const responsesSubTab = useStorage('calificador-respuestas-subtab', RESPONSES_SUBTABS.LIST)
const answerKeySubTab = useStorage('calificador-claves-subtab', ANSWER_KEY_SUBTABS.LIST)

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
const showConfigPanel = ref(false)

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

function saveToHistory() {
  const process = calification.getActiveProcess()
  if (process) {
    history.saveProcess(process)
  }
}

function handleLoadProcess(process) {
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
  await ponderations.initializePonderations()
  convocatoria.fetchConvocatorias()
})
</script>

<template>
  <div class="app-layout">
    <AppHeader
      :convocatoria="convocatoria.activeConvocatoria.value"
      :history-count="history.historyList.value.length"
      @open-backup="backup.showModal.value = true"
      @open-convocatoria="convocatoria.showPanel.value = true"
      @open-history="history.openHistoryPanel"
      @open-config="showConfigPanel = true"
    />

    <StepNav
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
    </main>

    <CalificationModal
      :show="calification.showCalificationModal.value"
      :calification="calification"
      @close="calification.closeCalificationModal"
    />

    <BackupModal
      :show="backup.showModal.value"
      :backup="backup"
      @close="backup.showModal.value = false"
    />

    <HistoryPanel
      :show="history.showHistoryPanel.value"
      :history-list="history.historyList.value"
      @close="history.closeHistoryPanel"
      @load-process="handleLoadProcess"
      @delete-process="history.deleteProcess"
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

    <ConfigPanel
      :show="showConfigPanel"
      :programas-by-area="programasByArea"
      :vacantes-programa="vacantesPrograma"
      :dat-format="datFormat"
      :convocatoria-id="convocatoria.activeConvocatoriaId.value"
      @close="showConfigPanel = false"
    />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding: var(--space-8);
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1024px) {
  .app-main { padding: var(--space-5); }
}
</style>
