<script setup>
import { computed, reactive, ref } from 'vue'
import { IDENTIFIER_SUBTABS } from '@/constants'
import WorkflowIntroCard from '@/components/shared/WorkflowIntroCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  identifiers: { type: Object, required: true },
  subTab:      { type: String, required: true },
})

const emit = defineEmits(['update:subTab'])

const identifiers = reactive(props.identifiers)
const showOnlyObserved = ref(false)

const displayedRows = computed(() => (
  showOnlyObserved.value ? identifiers.observations : identifiers.pagedRows
))

// ── Confirmación inline ──────────────────────────────────────────────────────
const pendingAction = ref(null)

function confirmRemoveSelected() {
  const count = identifiers.totalSelected
  if (!count) return
  pendingAction.value = {
    type: 'remove',
    message: `¿Eliminar ${count} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
  }
}

function confirmClearAll() {
  pendingAction.value = {
    type: 'clear',
    message: '¿Limpiar todos los identificadores? Esta acción no se puede deshacer.',
  }
}

function executePending() {
  if (pendingAction.value?.type === 'remove') identifiers.removeSelected()
  if (pendingAction.value?.type === 'clear') identifiers.clearAllIdentifiers()
  pendingAction.value = null
}

function cancelPending() {
  pendingAction.value = null
}

const tableColumns = [
  { key: 'lectura', label: 'N° lectura', class: 'column--code', width: '16%', minWidth: '110px' },
  { key: 'dni', label: 'DNI', maxlength: 8, class: 'column--dni', width: '16%', minWidth: '120px' },
  { key: 'aula', label: 'Aula', maxlength: 3, class: 'column--code', width: '10%', minWidth: '80px' },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true, class: 'column--code', width: '8%', minWidth: '65px' },
  { key: 'litho', label: 'Litho', maxlength: 6, class: 'column--code', width: '14%', minWidth: '105px' },
  { key: 'observaciones', label: 'Observaciones', badge: true, class: 'column--observations', width: '36%', minWidth: '220px', maxWidth: '360px' },
]

function getRowClass(row) {
  return {
    'row--issue': Boolean(identifiers.observationByRowId?.get(row.id))
  }
}
</script>

<template>
  <section class="tab-content">
    <WorkflowIntroCard
      eyebrow="Paso 2 · Vinculación"
      title="Hojas de identificación"
      description="Importa los archivos .dat que vinculan lectura, DNI, aula y tipo de prueba."
      :count="identifiers.totalRows"
      count-label="registros cargados"
      :ready="identifiers.identifierHasData"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </template>
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
    </WorkflowIntroCard>

    <div v-if="identifiers.importError" class="alert alert--error">
      {{ identifiers.importError }}
    </div>

    <section v-if="identifiers.observationCount" class="observed-panel">
      <div class="observed-panel__header">
        <div>
          <span class="observed-panel__eyebrow">Observados de identificadores</span>
          <h3>{{ identifiers.observationCount }} registro(s) requieren revisión</h3>
        </div>
        <div class="observed-panel__actions">
          <button type="button" class="btn btn--ghost" @click="showOnlyObserved = !showOnlyObserved">
            {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
          </button>
          <button type="button" class="btn btn--primary" @click="identifiers.exportIdentifierObservationsToExcel">
            Exportar observados
          </button>
        </div>
      </div>
      <div class="observed-panel__chips">
        <span v-for="item in identifiers.observationSummary" :key="item.label" class="observed-chip">
          <strong>{{ item.count }}</strong> {{ item.label }}
        </span>
      </div>
      <p class="observed-panel__hint">
        Corrige los campos en la tabla y vuelve a vincular las respuestas si el cambio afecta DNI, lectura, aula o tipo.
      </p>
    </section>

    <!-- Confirmación inline -->
    <div v-if="pendingAction" class="confirm-banner">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span>{{ pendingAction.message }}</span>
      <div class="confirm-banner__actions">
        <button type="button" class="btn btn--sm btn--danger" @click="executePending">Confirmar</button>
        <button type="button" class="btn btn--sm" @click="cancelPending">Cancelar</button>
      </div>
    </div>

    <Toolbar
      v-model:search-value="identifiers.search"
      search-placeholder="Buscar por DNI, lectura, litho u observaciones"
      :total-rows="identifiers.totalRows"
      :filtered-count="identifiers.totalFiltered"
      :selected-count="identifiers.totalSelected"
    >
      <template #actions>
        <details class="toolbar-menu">
          <summary class="btn btn--ghost">Acciones ▾</summary>
          <div class="toolbar-menu__panel">
        <button type="button" class="btn" @click="identifiers.exportIdentifiersToExcel" :disabled="!identifiers.identifierHasData">
          Exportar a Excel
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="identifiers.exportIdentifierObservationsToExcel"
          :disabled="!identifiers.observationCount"
        >
          Observados Excel
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
          </div>
        </details>
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
        :rows="displayedRows"
        :selection="identifiers.selection"
        :editing="identifiers.editing"
        :is-all-selected="identifiers.isAllVisibleSelected"
        :is-indeterminate="identifiers.isSomeVisibleSelected"
        :selected-count="identifiers.totalSelected"
        :row-class="getRowClass"
        :pagination="showOnlyObserved ? null : identifiers.pagination"
        @toggle-selection="identifiers.toggleSelection"
        @toggle-select-all="identifiers.toggleSelectAll"
        @toggle-edit="identifiers.toggleEdit"
        @cancel-edit="identifiers.toggleEdit"
        @remove-row="identifiers.removeRow"
        @change-page="identifiers.goToPage"
        @change-page-size="identifiers.setPageSize"
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
  min-width: 0;
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

/* Confirm banner */
.confirm-banner {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: #fff8e1; border: 1px solid #f59e0b;
  border-radius: var(--radius-lg);
  font-size: 0.875rem; color: #92400e; flex-wrap: wrap;
}
.confirm-banner svg { width: 18px; height: 18px; flex-shrink: 0; color: #f59e0b; }
.confirm-banner span { flex: 1; min-width: 200px; }
.confirm-banner__actions { display: flex; gap: var(--space-2); }

.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }

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

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.observed-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
  border-radius: var(--radius-lg);
}

.observed-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.observed-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: #92400e;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.observed-panel h3 {
  margin: 0;
  color: #78350f;
  font-size: 0.98rem;
}

.observed-panel__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.observed-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.observed-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  background: white;
  border: 1px solid #fde68a;
  border-radius: var(--radius-full);
  color: #92400e;
  font-size: 0.76rem;
  font-weight: 700;
}

.observed-chip strong {
  color: #78350f;
}

.observed-panel__hint {
  margin: 0;
  color: #92400e;
  font-size: 0.8rem;
  line-height: 1.45;
}

.icon {
  display: inline-flex;
  align-items: center;
}

.icon svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .observed-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .observed-panel__actions {
    justify-content: flex-start;
  }
}
</style>
