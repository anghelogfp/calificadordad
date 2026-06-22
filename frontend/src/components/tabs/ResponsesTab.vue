<script setup>
import { reactive, ref, computed } from 'vue'
import { RESPONSES_SUBTABS } from '@/constants'
import WorkflowIntroCard from '@/components/shared/WorkflowIntroCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  responses:         { type: Object,  required: true },
  subTab:            { type: String,  required: true },
  identifiersLoaded: { type: Boolean, default: false },
  linkedCount:       { type: Number,  default: 0 },
})

const matchPercent = computed(() => {
  const total = responses.totalRows
  if (!total) return 0
  return Math.round((props.linkedCount / total) * 100)
})

const matchStatus = computed(() => {
  if (!props.identifiersLoaded) return 'no-identifiers'
  if (matchPercent.value === 100) return 'complete'
  if (matchPercent.value >= 80)  return 'good'
  if (matchPercent.value >= 50)  return 'partial'
  return 'low'
})

const emit = defineEmits(['update:subTab'])

const responses = reactive(props.responses)

// ── Confirmación inline ──────────────────────────────────────────────────────
const pendingAction = ref(null)

function confirmRemoveSelected() {
  const count = responses.totalSelected
  if (!count) return
  pendingAction.value = {
    type: 'remove',
    message: `¿Eliminar ${count} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
  }
}

function confirmClearAll() {
  pendingAction.value = {
    type: 'clear',
    message: '¿Limpiar todas las respuestas? Esta acción no se puede deshacer.',
  }
}

function executePending() {
  if (pendingAction.value?.type === 'remove') responses.removeSelected()
  if (pendingAction.value?.type === 'clear') responses.clearAllResponses()
  pendingAction.value = null
}

function cancelPending() {
  pendingAction.value = null
}

const tableColumns = [
  { key: 'lectura', label: 'N° lectura', class: 'column--code', width: '110px', minWidth: '110px' },
  { key: 'dni', label: 'DNI', maxlength: 8, class: 'column--dni', width: '120px', minWidth: '120px' },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true, class: 'column--code', width: '65px', minWidth: '65px' },
  { key: 'litho', label: 'Litho', maxlength: 6, class: 'column--code', width: '105px', minWidth: '105px' },
  { key: 'answers', label: 'Respuestas', type: 'textarea', rows: 2, class: 'column--answers', minWidth: '470px' },
  { key: 'observaciones', label: 'Observaciones', badge: true, class: 'column--observations', minWidth: '240px' },
]

function getRowClass(row) {
  return {
    'row--issue': row.observaciones !== 'Sin observaciones'
  }
}
</script>

<template>
  <section class="tab-content">
    <WorkflowIntroCard
      eyebrow="Paso 3 · Respuestas"
      title="Hojas de respuestas"
      description="Importa las respuestas marcadas por los postulantes para vincularlas con sus identificadores."
      :count="responses.totalRows"
      count-label="respuestas cargadas"
      :ready="responses.responsesHasData"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
      </template>
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
    </WorkflowIntroCard>

    <div v-if="responses.importError" class="alert alert--error">
      {{ responses.importError }}
    </div>

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

    <!-- Barra de vinculación con identificadores -->
    <div v-if="responses.responsesHasData" class="match-bar" :class="`match-bar--${matchStatus}`">
      <div class="match-bar__info">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        <span v-if="!identifiersLoaded" class="match-bar__text">
          Sin identificadores cargados — las respuestas no tendrán DNI ni aula asignados (Paso 2)
        </span>
        <span v-else class="match-bar__text">
          <strong>{{ linkedCount }} / {{ responses.totalRows }}</strong> respuestas vinculadas con identificadores
          <em v-if="matchStatus === 'complete'">— vinculación completa</em>
          <em v-else-if="matchStatus === 'good'">— {{ 100 - matchPercent }}% sin vincular</em>
          <em v-else>— revisar Paso 2</em>
        </span>
        <span class="match-bar__pct">{{ matchPercent }}%</span>
      </div>
      <div class="match-bar__track">
        <div class="match-bar__fill" :style="{ width: matchPercent + '%' }"></div>
      </div>
    </div>

    <Toolbar
      v-model:search-value="responses.search"
      search-placeholder="Buscar por DNI, litho o observaciones"
      :total-rows="responses.totalRows"
      :filtered-count="responses.filteredRows.length"
      :selected-count="responses.totalSelected"
    >
      <template #actions>
        <details class="toolbar-menu">
          <summary class="btn btn--ghost">Acciones ▾</summary>
          <div class="toolbar-menu__panel">
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
        <button type="button" class="btn" @click="confirmClearAll" :disabled="!responses.responsesHasData">
          Limpiar tabla
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="confirmRemoveSelected"
          :disabled="!responses.totalSelected"
        >
          Eliminar seleccionados ({{ responses.totalSelected }})
        </button>
          </div>
        </details>
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
        :rows="responses.pagedRows"
        :selection="responses.selection"
        :editing="responses.editing"
        :is-all-selected="responses.isAllVisibleSelected"
        :is-indeterminate="responses.isSomeVisibleSelected"
        :selected-count="responses.totalSelected"
        :row-class="getRowClass"
        :pagination="responses.pagination"
        @toggle-selection="responses.toggleSelection"
        @toggle-select-all="responses.toggleSelectAll"
        @toggle-edit="responses.toggleEdit"
        @cancel-edit="responses.toggleEdit"
        @remove-row="responses.removeRow"
        @change-page="responses.goToPage"
        @change-page-size="responses.setPageSize"
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

.alert--error {
  background: linear-gradient(135deg, var(--error-50) 0%, var(--error-100) 100%);
  color: var(--error-600);
  border: 1px solid var(--error-100);
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

/* ── Match bar ───────────────────────────────────────────────────────────── */
.match-bar {
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--slate-200);
}

.match-bar__info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.82rem;
}

.match-bar__info svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.match-bar__text {
  flex: 1;
}

.match-bar__text strong { font-weight: 700; }
.match-bar__text em     { font-style: normal; font-weight: 500; margin-left: 4px; }

.match-bar__pct {
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.match-bar__track {
  height: 5px;
  background: rgba(0,0,0,0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.match-bar__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Estados */
.match-bar--no-identifiers {
  background: #fefce8;
  border-color: #fde68a;
  color: #92400e;
}
.match-bar--no-identifiers svg  { color: #d97706; }
.match-bar--no-identifiers .match-bar__fill { background: #fcd34d; }

.match-bar--complete {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}
.match-bar--complete svg        { color: var(--success-500); }
.match-bar--complete .match-bar__fill { background: var(--success-500); }

.match-bar--good {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}
.match-bar--good svg            { color: var(--success-500); }
.match-bar--good .match-bar__fill { background: var(--success-400); }

.match-bar--partial {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}
.match-bar--partial svg         { color: #d97706; }
.match-bar--partial .match-bar__fill { background: #fbbf24; }

.match-bar--low {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}
.match-bar--low svg             { color: #dc2626; }
.match-bar--low .match-bar__fill { background: #f87171; }
</style>
