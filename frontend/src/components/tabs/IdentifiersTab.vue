<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { IDENTIFIER_SUBTABS } from '@/constants'
import WorkflowIntroCard from '@/components/shared/WorkflowIntroCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import StepVerificationPanel from '@/components/shared/StepVerificationPanel.vue'

const props = defineProps({
  identifiers: { type: Object, required: true },
  subTab:      { type: String, required: true },
  reconciliation: { type: Object, default: null },
  processType: { type: String, default: 'simulacro' },
  simulacroScope: { type: String, default: '' },
})

const emit = defineEmits(['update:subTab'])

const identifiers = reactive(props.identifiers)
const activeFilterMode = ref('all') // 'all' | 'observed' | 'outside_padron'

const outsidePadronRows = computed(() => {
  if (!props.reconciliation?.verificationRows) return []
  return props.reconciliation.verificationRows
    .filter((r) => r.issueCodes?.includes('IDENTIFIER_OUTSIDE_PADRON') && r.identifier)
    .map((r) => r.identifier)
})

const outsidePadronRowIds = computed(() => {
  return new Set(outsidePadronRows.value.map((r) => r.id))
})

watch(
  () => outsidePadronRows.value.length,
  (newCount) => {
    if (newCount === 0 && activeFilterMode.value === 'outside_padron') {
      activeFilterMode.value = 'all'
    }
  }
)

function toggleFilterOutsidePadron() {
  if (activeFilterMode.value === 'outside_padron') {
    activeFilterMode.value = 'all'
  } else {
    activeFilterMode.value = 'outside_padron'
  }
}

function toggleFilterObserved() {
  if (activeFilterMode.value === 'observed') {
    activeFilterMode.value = 'all'
  } else {
    activeFilterMode.value = 'observed'
  }
}

const displayedRows = computed(() => {
  if (activeFilterMode.value === 'outside_padron') {
    return outsidePadronRows.value
  }
  if (activeFilterMode.value === 'observed') {
    return identifiers.observations
  }
  return identifiers.pagedRows
})

const stepState = computed(() => {
  if (!props.reconciliation || (!props.reconciliation.padronTotal && !props.reconciliation.identifiersTotal)) {
    return {
      variant: 'info',
      title: 'Pendiente de datos',
    }
  }
  if (props.reconciliation.duplicateIdentifierDnis || props.reconciliation.duplicateMatchKeys) {
    return {
      variant: 'error',
      title: 'Corregir duplicados de identificadores',
    }
  }
  if (props.reconciliation.issues || identifiers.observationCount) {
    return {
      variant: 'warn',
      title: 'Revisar identificadores antes de continuar',
    }
  }
  return {
    variant: 'ok',
    title: 'Identificadores listos',
  }
})

const identifierDatClosure = computed(() => {
  const reconciliation = props.reconciliation || {}
  const total = Number(reconciliation.identifiersTotal || identifiers.totalRows || 0)
  const linked = Number(reconciliation.linkedIdentifierRows || 0)
  const outsidePadron = Number(reconciliation.identifiersWithoutCandidate || 0)
  const withoutDni = Math.max(0, total - linked - outsidePadron)

  return {
    total,
    linked,
    outsidePadron,
    withoutDni,
    closes: total === linked + outsidePadron + withoutDni,
  }
})

const identifierPadronClosure = computed(() => {
  const reconciliation = props.reconciliation || {}
  const total = Number(reconciliation.padronTotal || 0)
  const linked = Number(reconciliation.matchedCandidates || 0)
  const missing = Number(reconciliation.missingIdentifiers || 0)

  return {
    total,
    linked,
    missing,
    closes: total === linked + missing,
  }
})

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

const tableColumns = computed(() => [
  { key: 'lectura', label: 'N° lectura', class: 'column--code', width: '16%', minWidth: '110px' },
  { key: 'dni', label: 'DNI', maxlength: 8, class: 'column--dni', width: '16%', minWidth: '120px' },
  { key: 'aula', label: 'Aula', maxlength: 3, class: 'column--code', width: '10%', minWidth: '80px' },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true, class: 'column--code', width: '8%', minWidth: '65px' },
  { key: 'litho', label: 'Litho', maxlength: 6, class: 'column--code', width: '14%', minWidth: '105px' },
  {
    key: 'observaciones',
    label: 'Observaciones',
    badge: true,
    class: 'column--observations',
    width: '36%',
    minWidth: '220px',
    maxWidth: '360px',
    formatter: (value, row) => {
      if (outsidePadronRowIds.value.has(row.id)) {
        const base = value && value !== 'Sin observaciones' ? value : ''
        return base ? `⚠️ Fuera de padrón · ${base}` : '⚠️ No figura en padrón oficial'
      }
      return value
    },
  },
])

function getRowClass(row) {
  return {
    'row--issue': Boolean(identifiers.observationByRowId?.get(row.id)),
    'row--outside-padron': outsidePadronRowIds.value.has(row.id),
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
      :process-type="processType"
      :simulacro-scope="simulacroScope"
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

    <StepVerificationPanel
      v-if="(reconciliation && (reconciliation.padronTotal || reconciliation.identifiersTotal)) || identifiers.observationCount"
      eyebrow="Verificación de identificadores"
      :title="stepState.title"
    >
      <template v-if="identifiers.observationCount || identifierDatClosure.outsidePadron || activeFilterMode !== 'all'" #actions>
        <button
          v-if="identifierDatClosure.outsidePadron || activeFilterMode === 'outside_padron'"
          type="button"
          class="btn"
          :class="activeFilterMode === 'outside_padron' ? 'btn--warn-active' : 'btn--warn'"
          @click="toggleFilterOutsidePadron"
        >
          <span v-if="activeFilterMode === 'outside_padron'">✕ Quitar filtro (Ver todos)</span>
          <span v-else>⚠️ Ver fuera del padrón ({{ identifierDatClosure.outsidePadron }})</span>
        </button>

        <button
          v-if="identifiers.observationCount || activeFilterMode === 'observed'"
          type="button"
          class="btn btn--ghost"
          :class="{ 'btn--ghost-active': activeFilterMode === 'observed' }"
          @click="toggleFilterObserved"
        >
          {{ activeFilterMode === 'observed' ? '✕ Quitar filtro (Ver todos)' : `Ver observados (${identifiers.observationCount})` }}
        </button>

        <button
          v-if="identifiers.observationCount"
          type="button"
          class="btn btn--primary"
          @click="identifiers.exportIdentifierObservationsToExcel"
        >
          Exportar observados
        </button>
      </template>

      <template v-if="reconciliation && (reconciliation.padronTotal || reconciliation.identifiersTotal)" #chips>
        <div class="verification-group">
          <span class="verification-group__title">DAT identificadores</span>
          <span class="verification-chip verification-chip--info"><strong>{{ identifierDatClosure.total }}</strong> registros cargados</span>
          <span class="verification-chip verification-chip--ok"><strong>{{ identifierDatClosure.linked }}</strong> vinculados al padrón</span>
          <button
            v-if="identifierDatClosure.outsidePadron"
            type="button"
            class="verification-chip verification-chip--clickable verification-chip--warn"
            :class="{ 'verification-chip--active': activeFilterMode === 'outside_padron' }"
            :title="activeFilterMode === 'outside_padron' ? 'Haz clic para ver todos los registros' : 'Haz clic para aislar los DNI fuera del padrón'"
            @click="toggleFilterOutsidePadron"
          >
            <strong>{{ identifierDatClosure.outsidePadron }}</strong> fuera del padrón
            <span v-if="activeFilterMode === 'outside_padron'">✕</span>
            <span v-else>🔍</span>
          </button>
          <span v-else class="verification-chip verification-chip--muted"><strong>0</strong> fuera del padrón</span>
          <span class="verification-chip" :class="identifierDatClosure.withoutDni ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ identifierDatClosure.withoutDni }}</strong> sin DNI leído</span>
        </div>

        <div class="verification-group">
          <span class="verification-group__title">Padrón</span>
          <span class="verification-chip verification-chip--info"><strong>{{ identifierPadronClosure.total }}</strong> postulantes</span>
          <span class="verification-chip verification-chip--ok"><strong>{{ identifierPadronClosure.linked }}</strong> con identificador</span>
          <span class="verification-chip" :class="identifierPadronClosure.missing ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ identifierPadronClosure.missing }}</strong> sin identificador</span>
        </div>

        <div class="verification-group">
          <span class="verification-group__title">Duplicados</span>
          <span class="verification-chip" :class="reconciliation.duplicatePadronDnis ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicatePadronDnis || 0 }}</strong> DNI duplicados en padrón</span>
          <span class="verification-chip" :class="reconciliation.duplicateIdentifierDnis ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicateIdentifierDnis }}</strong> DNI duplicados</span>
          <span class="verification-chip" :class="reconciliation.duplicateMatchKeys ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicateMatchKeys }}</strong> lecturas/litho duplicados</span>
        </div>
      </template>

      <template v-if="identifiers.observationCount" #detail>
        <div class="verification-group verification-group--quality">
          <span class="verification-group__title">Calidad del DAT</span>
          <button
            type="button"
            class="verification-chip verification-chip--clickable verification-chip--warn"
            :class="{ 'verification-chip--active': activeFilterMode === 'observed' }"
            :title="activeFilterMode === 'observed' ? 'Haz clic para ver todos' : 'Haz clic para ver solo observados'"
            @click="toggleFilterObserved"
          >
            <strong>{{ identifiers.observationCount }}</strong> registros observados
            <span v-if="activeFilterMode === 'observed'">✕</span>
            <span v-else>🔍</span>
          </button>
          <span v-for="item in identifiers.observationSummary" :key="item.label" class="verification-chip verification-chip--warn">
            <strong>{{ item.count }}</strong> {{ item.label }}
          </span>
        </div>
      </template>

      <template #hint>
        Este cruce confirma si los DNI del archivo de identificación corresponden al padrón cargado en el Paso 1.
        <span v-if="identifierDatClosure.outsidePadron">
          Hay {{ identifierDatClosure.outsidePadron }} DNI que no figura en el padrón. Usa el botón "⚠️ Ver fuera del padrón" para ubicarlo y corregirlo.
        </span>
        <span v-else-if="identifiers.observationCount">Corrige los campos en la tabla si cambia DNI, lectura, aula o tipo.</span>
      </template>
    </StepVerificationPanel>

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
      <div v-if="activeFilterMode === 'outside_padron'" class="banner-filtro-activo banner-filtro-activo--warn">
        <div class="banner-filtro-activo__info">
          <strong>⚠️ Filtrando DNI fuera del padrón oficial ({{ outsidePadronRows.length }} registro)</strong>
          <span>Este DNI fue leído en las hojas de identificación pero no coincide con ningún postulante del padrón. Puedes corregir el DNI haciendo clic en el lápiz de edición si fue un error de burbujeo.</span>
        </div>
        <button type="button" class="btn btn--sm btn--warn-active" @click="toggleFilterOutsidePadron">
          ✕ Quitar filtro y ver todos ({{ identifiers.totalRows }})
        </button>
      </div>

      <div v-else-if="activeFilterMode === 'observed'" class="banner-filtro-activo banner-filtro-activo--info">
        <div class="banner-filtro-activo__info">
          <strong>🔍 Filtrando registros observados ({{ identifiers.observations.length }} registro/s)</strong>
          <span>Mostrando únicamente los registros que presentan observaciones de lectura o formato.</span>
        </div>
        <button type="button" class="btn btn--sm btn--ghost-active" @click="toggleFilterObserved">
          ✕ Quitar filtro y ver todos ({{ identifiers.totalRows }})
        </button>
      </div>

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
        :pagination="activeFilterMode === 'all' ? identifiers.pagination : null"
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

.step-state-panel,
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

.step-state-panel--info {
  background: var(--slate-50);
  border-color: var(--slate-200);
  border-left-color: var(--slate-400);
}

.step-state-panel--ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  border-left-color: var(--success-500);
}

.step-state-panel--warn {
  background: #fffbeb;
  border-color: #fde68a;
  border-left-color: #d97706;
}

.step-state-panel--error {
  background: #fef2f2;
  border-color: #fecaca;
  border-left-color: #dc2626;
}

.step-state-panel__header,
.observed-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.step-state-panel__eyebrow,
.observed-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: #92400e;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.step-state-panel h3,
.observed-panel h3 {
  margin: 0;
  color: #78350f;
  font-size: 0.98rem;
}

.step-state-panel--info .step-state-panel__eyebrow,
.step-state-panel--info h3 {
  color: var(--slate-600);
}

.step-state-panel--ok .step-state-panel__eyebrow,
.step-state-panel--ok h3 {
  color: #15803d;
}

.step-state-panel--error .step-state-panel__eyebrow,
.step-state-panel--error h3 {
  color: #b91c1c;
}

.step-state-panel__actions,
.observed-panel__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.step-state-panel__chips,
.observed-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.step-state-panel__detail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid rgba(146, 64, 14, 0.18);
}

.step-state-chip,
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

.step-state-chip--warn {
  border-color: #fcd34d;
}

.step-state-chip strong,
.observed-chip strong {
  color: #78350f;
}

.step-state-panel--ok .step-state-chip {
  border-color: #bbf7d0;
  color: #15803d;
}

.step-state-panel--info .step-state-chip {
  border-color: var(--slate-200);
  color: var(--slate-600);
}

.step-state-panel--error .step-state-chip {
  border-color: #fecaca;
  color: #b91c1c;
}

.step-state-panel--ok .step-state-chip strong {
  color: #14532d;
}

.step-state-panel--info .step-state-chip strong {
  color: var(--slate-800);
}

.step-state-panel--error .step-state-chip strong {
  color: #991b1b;
}

.step-state-panel__hint,
.observed-panel__hint {
  margin: 0;
  color: #92400e;
  font-size: 0.8rem;
  line-height: 1.45;
}

.reconciliation-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--slate-200);
  border-left: 4px solid var(--slate-400);
  background: white;
}
.reconciliation-panel--ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  border-left-color: var(--success-500);
}
.reconciliation-panel--warn {
  background: #fffbeb;
  border-color: #fde68a;
  border-left-color: #d97706;
}
.reconciliation-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.reconciliation-panel h3 {
  margin: 0;
  color: var(--slate-800);
  font-size: 0.98rem;
}
.reconciliation-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.reconciliation-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: var(--radius-full);
  color: var(--slate-600);
  font-size: 0.76rem;
  font-weight: 700;
}
.reconciliation-chip strong {
  color: var(--slate-900);
}
.reconciliation-panel__hint {
  margin: 0;
  color: var(--slate-500);
  font-size: 0.8rem;
  line-height: 1.45;
}

.verification-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) 0;
}

.verification-group + .verification-group {
  border-top: 1px dashed var(--slate-200);
}

.verification-group--quality {
  padding-top: 0;
}

.verification-group__title {
  min-width: 126px;
  color: var(--slate-500);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.verification-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: white;
  color: var(--slate-600);
  font-size: 0.76rem;
  font-weight: 700;
}

.verification-chip strong {
  color: var(--slate-900);
  font-family: var(--font-mono);
}

.verification-chip--ok {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.verification-chip--ok strong {
  color: #14532d;
}

.verification-chip--warn {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.verification-chip--warn strong {
  color: #78350f;
}

.verification-chip--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.verification-chip--error strong {
  color: #991b1b;
}

.verification-chip--info {
  border-color: #dbe7f5;
  background: #f8fbff;
  color: var(--unap-blue-700);
}

.verification-chip--muted {
  border-color: var(--slate-200);
  background: var(--slate-50);
  color: var(--slate-500);
}

.icon {
  display: inline-flex;
  align-items: center;
}

.icon svg {
  width: 16px;
  height: 16px;
}

.verification-chip--clickable {
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  border: 1px solid #f59e0b;
}

.verification-chip--clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  background: #fef3c7;
}

.verification-chip--active {
  background: #f59e0b !important;
  color: white !important;
  border-color: #d97706 !important;
}

.verification-chip--active strong {
  color: white !important;
}

.btn--warn {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
  font-weight: 700;
}

.btn--warn:hover:not(:disabled) {
  background: #fef3c7;
  border-color: #f59e0b;
}

.btn--warn-active {
  background: #f59e0b;
  color: #ffffff;
  border: 1px solid #d97706;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.btn--warn-active:hover:not(:disabled) {
  background: #d97706;
}

.btn--ghost-active {
  background: var(--slate-200);
  border-color: var(--slate-400);
  color: var(--slate-900);
  font-weight: 700;
}

.banner-filtro-activo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  animation: slideUp 0.2s ease-out;
}

.banner-filtro-activo--warn {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.banner-filtro-activo--info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}

.banner-filtro-activo__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.banner-filtro-activo__info strong {
  font-size: 0.85rem;
}

.banner-filtro-activo__info span {
  font-size: 0.8rem;
  opacity: 0.95;
}

:deep(tr.row--outside-padron) {
  background-color: #fffbeb !important;
}

:deep(tr.row--outside-padron:hover) {
  background-color: #fef3c7 !important;
}

:deep(tr.row--outside-padron td) {
  color: #92400e;
}

:deep(tr.row--outside-padron .cell-input) {
  color: #92400e;
  font-weight: 600;
}

@media (max-width: 768px) {
  .step-state-panel__header,
  .observed-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .step-state-panel__actions,
  .observed-panel__actions {
    justify-content: flex-start;
  }
}
</style>
