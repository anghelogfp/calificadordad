<script setup>
import { reactive } from 'vue'
import { IDENTIFIER_SUBTABS } from '@/constants'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  identifiers: {
    type: Object,
    required: true
  },
  subTab: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:subTab'])

const identifiers = reactive(props.identifiers)

function confirmRemoveSelected() {
  const count = identifiers.totalSelected
  if (!count) return
  if (confirm(`¿Eliminar ${count} registro(s) seleccionado(s)?`)) identifiers.removeSelected()
}
function confirmClearAll() {
  if (confirm('¿Limpiar todos los identificadores?')) identifiers.clearAllIdentifiers()
}

const tableColumns = [
  { key: 'lectura', label: 'N° lectura' },
  { key: 'dni', label: 'DNI', maxlength: 8 },
  { key: 'aula', label: 'Aula', maxlength: 3 },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true },
  { key: 'litho', label: 'Litho', maxlength: 6 },
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
      title="Importar Hojas de Identificación"
      description="Carga los archivos .dat con los datos de identificación de los postulantes."
      :stats="identifiers.identifierHasData ? [
        { value: identifiers.totalRows, label: 'Registros' },
        ...(identifiers.sources.length ? [{ value: identifiers.sources.length, label: 'Archivos' }] : [])
      ] : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <FileUploader
      id="identifier-input"
      accept=".dat,.txt"
      :multiple="true"
      :is-dragging="identifiers.isDragging"
      :has-data="identifiers.identifierHasData"
      title="Arrastra tus archivos de identificación aquí"
      subtitle="o haz clic para seleccionar desde tu equipo"
      button-text="Seleccionar archivos .dat"
      :badges="['.dat', '.txt']"
      hint="Puedes seleccionar múltiples archivos"
      @drop="identifiers.onIdentifierDrop"
      @dragover="identifiers.onDragOver"
      @dragleave="identifiers.onDragLeave"
      @change="identifiers.onIdentifierFileChange"
    >
      <template #icon>
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M14 6h14l10 10v26a2 2 0 01-2 2H14a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M28 6v10h10" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M18 26h12M18 32h12M18 20h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </template>
    </FileUploader>

    <div v-if="identifiers.importError" class="alert alert--error">
      {{ identifiers.importError }}
    </div>

    <Toolbar
      v-model:search-value="identifiers.search"
      search-placeholder="Buscar por DNI, lectura, litho u observaciones"
      :total-rows="identifiers.totalRows"
      :filtered-count="identifiers.totalFiltered"
      :selected-count="identifiers.totalSelected"
    >
      <template #actions>
        <button type="button" class="btn" @click="identifiers.exportIdentifiersToExcel" :disabled="!identifiers.identifierHasData">
          Exportar a Excel
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="identifiers.exportObservationsPdf"
          :disabled="!identifiers.observationCount"
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
        <button type="button" class="btn" @click="confirmClearAll" :disabled="!identifiers.identifierHasData">
          Limpiar tabla
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="confirmRemoveSelected"
          :disabled="!identifiers.totalSelected"
        >
          Eliminar seleccionados ({{ identifiers.totalSelected }})
        </button>
      </template>
    </Toolbar>

    <SubTabs
      :tabs="[
        { key: 'list', label: `Registros (${identifiers.totalRows})` },
        { key: 'sources', label: `Archivos cargados (${identifiers.sources.length})` }
      ]"
      :model-value="subTab"
      @update:model-value="$emit('update:subTab', $event)"
      aria-label="Secciones de identificadores"
    />

    <template v-if="subTab === 'list'">
      <DataTable
        v-if="identifiers.identifierHasData"
        :columns="tableColumns"
        :rows="identifiers.pagedRows"
        :selection="identifiers.selection"
        :editing="identifiers.editing"
        :is-all-selected="identifiers.isAllVisibleSelected"
        :is-indeterminate="identifiers.isSomeVisibleSelected"
        :selected-count="identifiers.totalSelected"
        :row-class="getRowClass"
        :pagination="identifiers.pagination"
        @toggle-selection="identifiers.toggleSelection"
        @toggle-select-all="identifiers.toggleSelectAll"
        @toggle-edit="identifiers.toggleEdit"
        @cancel-edit="identifiers.toggleEdit"
        @remove-row="identifiers.removeRow"
        @change-page="identifiers.goToPage"
      />

      <EmptyState
        v-else
        title="Sin registros cargados"
        description="Carga uno o varios archivos .dat de identificadores para comenzar."
        icon="document"
      />
    </template>

    <SourcesPanel
      v-else
      title="Archivos importados"
      description="Resumen de cargas realizadas en esta sesión."
      :sources="identifiers.sources"
      :total-rows="identifiers.totalRows"
      upload-input-id="identifier-input"
      upload-hint="Los nuevos archivos se añadirán a la lista y podrás combinar áreas distintas."
      @remove-source="identifiers.removeIdentifierSource"
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
