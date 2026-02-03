<script setup>
import { RESPONSES_SUBTABS } from '@/constants'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  responses: {
    type: Object,
    required: true
  },
  subTab: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:subTab'])

const tableColumns = [
  { key: 'lectura', label: 'N° lectura' },
  { key: 'dni', label: 'DNI', maxlength: 8 },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true },
  { key: 'litho', label: 'Litho', maxlength: 6 },
  { key: 'answers', label: 'Respuestas', type: 'textarea', rows: 2 },
  { key: 'observaciones', label: 'Observaciones', badge: true },
]

function getRowClass(row) {
  return {
    'row--issue': row.observaciones !== 'Sin observaciones'
  }
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Importar Hojas de Respuestas"
      description="Carga los archivos .dat con las respuestas marcadas por los postulantes (60 preguntas)."
      :stats="responses.responsesHasData ? [
        { value: responses.totalRows, label: 'Registros' },
        ...(responses.sourcesCount ? [{ value: responses.sourcesCount, label: 'Archivos' }] : [])
      ] : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
      </template>
    </StepInfoCard>

    <FileUploader
      id="responses-input"
      accept=".dat,.txt"
      :multiple="true"
      :is-dragging="responses.isDragging"
      :has-data="responses.responsesHasData"
      title="Arrastra tus archivos de respuestas aquí"
      subtitle="o haz clic para seleccionar desde tu equipo"
      button-text="Seleccionar archivos .dat"
      :badges="['.dat', '.txt']"
      hint="60 preguntas por hoja de respuestas"
      @drop="responses.onResponseDrop"
      @dragover="responses.onDragOver"
      @dragleave="responses.onDragLeave"
      @change="responses.onResponseFileChange"
    >
      <template #icon>
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="10" y="6" width="28" height="36" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M18 18h12M18 26h12M18 34h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cx="18" cy="18" r="1.5" fill="currentColor"/>
          <circle cx="18" cy="26" r="1.5" fill="currentColor"/>
          <circle cx="18" cy="34" r="1.5" fill="currentColor"/>
        </svg>
      </template>
    </FileUploader>

    <div v-if="responses.importError" class="alert alert--error">
      {{ responses.importError }}
    </div>

    <Toolbar
      v-model:search-value="responses.search.value"
      search-placeholder="Buscar por DNI, litho o observaciones"
      :total-rows="responses.totalRows"
      :filtered-count="responses.filteredRows.length"
    >
      <template #actions>
        <button type="button" class="btn" @click="responses.exportResponsesToExcel" :disabled="!responses.responsesHasData">
          Exportar a Excel
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="responses.exportResponsesObservationsPdf"
          :disabled="!responses.observationCount"
        >
          <span class="icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v14h12V9h-5V4H6Zm2 12h8v2H8v-2Zm0-4h8v2H8v-2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          Observaciones PDF
        </button>
        <button type="button" class="btn" @click="responses.clearAllResponses" :disabled="!responses.responsesHasData">
          Limpiar tabla
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="responses.removeSelected"
          :disabled="!responses.totalSelected"
        >
          Eliminar seleccionados ({{ responses.totalSelected }})
        </button>
      </template>
    </Toolbar>

    <SubTabs
      :tabs="[
        { key: 'list', label: `Registros (${responses.totalRows})` },
        { key: 'sources', label: `Archivos cargados (${responses.sourcesCount})` }
      ]"
      :model-value="subTab"
      @update:model-value="$emit('update:subTab', $event)"
      aria-label="Secciones de respuestas"
    />

    <template v-if="subTab === 'list'">
      <DataTable
        v-if="responses.responsesHasData"
        :columns="tableColumns"
        :rows="responses.filteredRows"
        :selection="responses.selection"
        :editing="responses.editing"
        :is-all-selected="responses.isAllVisibleSelected"
        :row-class="getRowClass"
        @toggle-selection="responses.toggleSelection"
        @toggle-select-all="responses.toggleSelectAll"
        @toggle-edit="responses.toggleEdit"
        @remove-row="responses.removeRow"
      />

      <EmptyState
        v-else
        title="Sin registros cargados"
        description="Carga uno o varios archivos .dat de respuestas para comenzar."
        icon="document"
      />
    </template>

    <SourcesPanel
      v-else
      title="Archivos importados"
      description="Resumen de hojas de respuestas cargadas."
      :sources="responses.sources"
      :total-rows="responses.totalRows"
      upload-input-id="responses-input"
      upload-hint="Los nuevos archivos se añadirán a la lista y podrás combinar áreas distintas."
      @remove-source="responses.removeResponsesSource"
    />
  </section>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
}

.alert--error {
  background: linear-gradient(135deg, var(--error-50) 0%, var(--error-100) 100%);
  color: var(--error-600);
  border: 1px solid var(--error-100);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  background: var(--slate-100);
  color: var(--slate-700);
}

.btn:hover:not(:disabled) {
  background: var(--slate-200);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  background: transparent;
  color: var(--slate-600);
  border: 1px solid var(--slate-200);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--slate-50);
  border-color: var(--slate-300);
  color: var(--slate-800);
}

.btn--danger {
  background: linear-gradient(135deg, var(--error-500) 0%, var(--error-600) 100%);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--error-600) 0%, #b91c1c 100%);
}

.icon {
  display: inline-flex;
  align-items: center;
}

.icon svg {
  width: 16px;
  height: 16px;
}
</style>
