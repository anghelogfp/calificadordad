<script setup>
import { onMounted, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { TAB_KEYS, tabs, IDENTIFIER_SUBTABS, RESPONSES_SUBTABS, ANSWER_KEY_SUBTABS } from '@/constants'

// Composables
import { useArchives } from '@/composables/useArchives'
import { useIdentifiers } from '@/composables/useIdentifiers'
import { useResponses } from '@/composables/useResponses'
import { useAnswerKeys } from '@/composables/useAnswerKeys'
import { usePonderations } from '@/composables/usePonderations'
import { useCalification } from '@/composables/useCalification'

// Layout Components
import AppHeader from '@/components/layout/AppHeader.vue'
import StepNav from '@/components/layout/StepNav.vue'

// Tab Components
import ArchivesTab from '@/components/tabs/ArchivesTab.vue'
import IdentifiersTab from '@/components/tabs/IdentifiersTab.vue'
import ResponsesTab from '@/components/tabs/ResponsesTab.vue'
import AnswerKeysTab from '@/components/tabs/AnswerKeysTab.vue'
import ScoresTab from '@/components/tabs/ScoresTab.vue'

// Modal
import CalificationModal from '@/components/modals/CalificationModal.vue'

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE
// ═══════════════════════════════════════════════════════════════════════════

const activeTab = useStorage('calificador-active-tab', TAB_KEYS.ARCHIVES)
const identifierSubTab = useStorage('calificador-identificador-subtab', IDENTIFIER_SUBTABS.LIST)
const responsesSubTab = useStorage('calificador-respuestas-subtab', RESPONSES_SUBTABS.LIST)
const answerKeySubTab = useStorage('calificador-claves-subtab', ANSWER_KEY_SUBTABS.LIST)

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSABLES INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

// 1. Archives (independiente)
const archives = useArchives()

// 2. Identifiers (independiente)
const identifiers = useIdentifiers()

// 3. Responses (depende de identifiers)
const responses = useResponses(
  identifiers.identifierLookup,
  identifiers.identifierLookupByLitho
)

// 4. Answer Keys (depende de archives)
const answerKeys = useAnswerKeys(archives.rows)

// 5. Ponderations (independiente)
const ponderations = usePonderations()

// 6. Calification (depende de todos)
const calification = useCalification(
  archives.rows,
  responses.rows,
  answerKeys.rows,
  ponderations.ponderationRows,
  ponderations.ponderationEntriesByArea,
  ponderations.ponderationTotalsByArea,
  responses.responsesByDni,
  answerKeys.answerKeyLookupByAreaTipo
)

// ═══════════════════════════════════════════════════════════════════════════
// WATCHERS - Sincronización entre composables
// ═══════════════════════════════════════════════════════════════════════════

// Sincronizar datos de identificadores con respuestas
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
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(async () => {
  await ponderations.initializePonderations()
})
</script>

<template>
  <div class="app-layout">
    <AppHeader />

    <StepNav
      :tabs="tabs"
      :active-tab="activeTab"
      :archives-count="archives.rows.value.length"
      :identifiers-count="identifiers.rows.value.length"
      :responses-count="responses.rows.value.length"
      :answer-keys-count="answerKeys.rows.value.length"
      :scores-count="calification.calificationResults.value.length"
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

      <ScoresTab
        v-else-if="activeTab === TAB_KEYS.SCORES"
        :calification="calification"
        :ponderations="ponderations"
        @open-modal="calification.openCalificationModal"
      />
    </main>

    <CalificationModal
      :show="calification.showCalificationModal.value"
      :tab="calification.calificationModalTab.value"
      :calification="calification"
      :ponderations="ponderations"
      @close="calification.closeCalificationModal"
      @update:tab="calification.calificationModalTab.value = $event"
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
  .app-main {
    padding: var(--space-5);
  }
}
</style>
