<script setup>
import { reactive, ref, computed } from 'vue'
import { ARCHIVE_COLUMNS } from '@/constants'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import DataTable from '@/components/shared/DataTable.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ProcessPathBadge from '@/components/shared/ProcessPathBadge.vue'

const props = defineProps({
  archives:  { type: Object, required: true },
  areaNames: { type: Array,  default: () => [] },
  processType: { type: String, default: 'simulacro' },
  simulacroScope: { type: String, default: '' },
})

const archives = reactive(props.archives)
const showOnlyObserved = ref(false)
const fileInputRef = ref(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

const tableColumns = ARCHIVE_COLUMNS.map(col => ({
  key: col.key,
  label: col.label,
  editable: true,
  ...(col.key === 'dni' ? { class: 'column--dni', width: '120px', minWidth: '120px', maxlength: 12 } : {}),
  ...(['paterno', 'materno'].includes(col.key) ? { class: 'column--name', minWidth: '150px' } : {}),
  ...(col.key === 'nombres' ? { class: 'column--name', minWidth: '190px' } : {}),
  ...(col.key === 'observaciones' ? { minWidth: '180px' } : {}),
  ...(col.key === 'area' ? { minWidth: '140px' } : {}),
  ...(col.key === 'programa' ? { class: 'column--program', minWidth: '230px' } : {}),
}))

// Preview para FileUploader (primeras 5 filas, columnas principales)
const PREVIEW_COLS = ARCHIVE_COLUMNS.slice(0, 5).map(c => ({ key: c.key, label: c.label }))
const previewRows = computed(() => (archives.rows?.value ?? []).slice(0, 5))
const displayedRows = computed(() => {
  if (showOnlyObserved.value) return archives.observedRows || []
  return archives.pagedRows || []
})

const simulacroDetection = computed(() => {
  const rows = archives.rows?.value || []
  if (!rows.length) return null
  const withArea = rows.filter(row => row.area?.trim()).length
  return {
    scope: withArea > 0 ? 'areas' : 'general',
    withArea,
    withoutArea: rows.length - withArea,
    total: rows.length,
  }
})

// Validación de áreas: detecta áreas del padrón que no están en la DB
const unknownAreas = computed(() => {
  const unknown = new Set()
  ;(archives.archiveIssues || []).forEach(({ row, issues }) => {
    if (issues?.includes('Área no configurada')) {
      const area = String(row.area || '').trim()
      if (area) unknown.add(area)
    }
  })
  return Array.from(unknown).sort()
})

const archiveVerificationTitle = computed(() => {
  if (archives.archiveIssueCount || unknownAreas.value.length) return 'Revisar observaciones del padrón'
  if (archives.hasData) return 'Padrón listo para continuar'
  return 'Pendiente de padrón'
})

function getRowClass(row) {
  return {
    'row--observed': Boolean(archives.archiveIssueByRowId?.get(row.id)),
  }
}

// ── Confirmación inline ──────────────────────────────────────────────────────

const pendingAction = ref(null)

function confirmRemoveSelected() {
  const count = archives.totalSelected
  if (!count) return
  pendingAction.value = {
    type: 'remove',
    message: `¿Eliminar ${count} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
  }
}

function confirmClearAll() {
  pendingAction.value = {
    type: 'clear',
    message: '¿Limpiar todos los registros? Esta acción no se puede deshacer.',
  }
}

function executePending() {
  if (pendingAction.value?.type === 'remove') archives.removeSelected()
  if (pendingAction.value?.type === 'clear') archives.clearAll()
  pendingAction.value = null
}

function cancelPending() {
  pendingAction.value = null
}

const emit = defineEmits(['goConfig'])
</script>

<template>
  <section class="tab-content">
    <!-- ═══ Sin datos: zona de importación completa ═══ -->
    <section v-if="!archives.hasData" class="archive-import-card">
      <header class="archive-import-card__header">
        <div class="archive-import-card__identity">
          <div class="archive-import-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <span class="archive-import-card__eyebrow">Paso 1 · Datos de entrada</span>
            <div class="archive-import-card__title-row">
              <h2>Padrón de postulantes</h2>
              <ProcessPathBadge
                :process-type="processType"
                :simulacro-scope="simulacroScope"
              />
            </div>
            <p>Importa desde Excel los candidatos inscritos para el proceso.</p>
          </div>
        </div>
      </header>

      <FileUploader
        id="archive-input"
        accept=".xlsx"
        :is-dragging="archives.isDragging"
        :has-data="archives.hasData"
        title="Arrastra tu archivo Excel aquí"
        subtitle="o selecciónalo desde tu equipo"
        button-text="Seleccionar archivo Excel"
        :badges="['.xlsx']"
        hint="DNI · apellidos · nombres · área · programa"
        @drop="archives.onArchiveDrop"
        @dragover="archives.onDragOver"
        @dragleave="archives.onDragLeave"
        @change="archives.onArchiveFileChange"
      >
        <template #icon>
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M24 16v16M16 24h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </template>
      </FileUploader>
    </section>

    <!-- ═══ Con datos: barra compacta ═══ -->
    <div v-else class="archive-bar">
      <div class="archive-bar__main">
        <div class="archive-bar__icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="archive-bar__text">
          <div class="archive-bar__title-row">
            <h2>Padrón de postulantes</h2>
            <ProcessPathBadge :process-type="processType" :simulacro-scope="simulacroScope" />
          </div>
          <span class="archive-bar__meta">
            <strong>{{ archives.totalRows.toLocaleString('es-PE') }}</strong> registros
            <template v-if="archives.lastFileName?.value"> · {{ archives.lastFileName.value }}</template>
          </span>
        </div>
      </div>
      <div class="archive-bar__actions">
        <input ref="fileInputRef" type="file" accept=".xlsx" class="hidden-file-input" @change="archives.onArchiveFileChange" />
        <button type="button" class="btn btn--ghost btn--sm" @click="triggerFileInput">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Reemplazar
        </button>
      </div>
    </div>

    <!-- ═══ Alerta de errores de importación ═══ -->
    <div v-if="archives.importError" class="alert alert--error">
      <svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
      </svg>
      <span>{{ archives.importError }}</span>
    </div>

    <!-- ═══ Resumen de observaciones (solo si hay problemas) ═══ -->
    <div v-if="archives.hasData && (archives.archiveIssueCount || unknownAreas.length)" class="archive-issues">
      <div class="archive-issues__chips">
        <span v-if="archives.archiveIssueCount" class="archive-issues__chip archive-issues__chip--warn">
          <strong>{{ archives.archiveIssueCount }}</strong> observados
        </span>
        <span v-if="unknownAreas.length" class="archive-issues__chip archive-issues__chip--warn">
          <strong>{{ unknownAreas.length }}</strong> área(s) no configurada(s)
        </span>
      </div>
      <div class="archive-issues__actions">
        <button type="button" class="btn btn--ghost btn--sm" @click="showOnlyObserved = !showOnlyObserved">
          {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
        </button>
        <a v-if="unknownAreas.length" class="alert__link" href="#" @click.prevent="$emit('goConfig')">Ir a Configuración</a>
      </div>
    </div>

    <!-- Banner de confirmación inline -->
    <div v-if="pendingAction" class="confirm-banner">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span>{{ pendingAction.message }}</span>
      <div class="confirm-banner__actions">
        <button type="button" class="btn btn--ghost btn--sm" @click="cancelPending">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" @click="executePending">Confirmar</button>
      </div>
    </div>

    <Toolbar
      v-model:search-value="archives.search"
      search-placeholder="Buscar postulantes..."
      :total-rows="archives.totalRows"
      :filtered-count="archives.totalFiltered"
      :selected-count="archives.totalSelected"
    >
      <template #actions>
        <details class="toolbar-menu">
          <summary class="btn btn--ghost">Acciones ▾</summary>
          <div class="toolbar-menu__panel">
        <button type="button" class="btn btn--primary" @click="archives.exportArchiveToExcel" :disabled="!archives.hasData">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Exportar Excel
        </button>
        <button type="button" class="btn btn--ghost" @click="archives.exportArchiveIssuesToExcel" :disabled="!archives.archiveIssueCount">
          Exportar observados
        </button>
        <button type="button" class="btn btn--ghost" @click="confirmClearAll" :disabled="!archives.hasData">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
          Limpiar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="confirmRemoveSelected"
          :disabled="!archives.totalSelected"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          Eliminar ({{ archives.totalSelected }})
        </button>
          </div>
        </details>
      </template>
    </Toolbar>

    <DataTable
      v-if="archives.hasData"
      :columns="tableColumns"
      :rows="displayedRows"
      :selection="archives.selection"
      :editing="archives.editing"
      :is-all-selected="archives.isAllVisibleSelected"
      :is-indeterminate="archives.isSomeVisibleSelected"
      :selected-count="archives.totalSelected"
      :row-class="getRowClass"
      :pagination="showOnlyObserved ? null : archives.pagination"
      @toggle-selection="archives.toggleSelection"
      @toggle-select-all="archives.toggleSelectAll"
      @toggle-edit="archives.toggleEdit"
      @cancel-edit="archives.toggleEdit"
      @remove-row="archives.removeRow"
      @change-page="archives.goToPage"
      @change-page-size="archives.setPageSize"
    />

    <EmptyState
      v-else
      title="Sin registros cargados"
      description="Importa un archivo Excel o agrega registros manualmente para comenzar."
      icon="add"
    />

    <details class="form-card secondary-tool">
      <summary class="form-card__header">
        <h3>Agregar registro manual</h3>
        <p>Herramienta secundaria para correcciones puntuales del padrón.</p>
      </summary>
      <form class="form-grid" @submit.prevent="archives.addArchiveRow">
        <div v-for="column in ARCHIVE_COLUMNS" :key="column.key" class="form-field">
          <label :for="`new-${column.key}`" class="form-field__label">{{ column.label }}</label>
          <input
            :id="`new-${column.key}`"
            v-model="archives.pendingRow[column.key]"
            type="text"
            class="form-field__input"
            :placeholder="column.placeholder"
          />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" @click="archives.resetPendingRow">
            Limpiar campos
          </button>
          <button type="submit" class="btn btn--primary">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
            </svg>
            Agregar registro
          </button>
        </div>
      </form>
    </details>

  </section>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: slideUp 0.4s ease-out;
  min-width: 0;
}

.archive-import-card {
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4); background: white;
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm); min-width: 0;
}
.archive-import-card__header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-5);
}
.archive-import-card__identity { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.archive-import-card__icon {
  width: 46px; height: 46px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-lg); background: var(--unap-blue-50); color: var(--unap-blue-600);
}
.archive-import-card__icon svg { width: 24px; height: 24px; }
.archive-import-card__eyebrow {
  display: block; margin-bottom: 2px; color: var(--unap-blue-600);
  font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
}
.archive-import-card h2 { margin: 0; color: var(--slate-900); font-size: 1.2rem; line-height: 1.25; }
.archive-import-card__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.archive-import-card__identity p { margin: 3px 0 0; color: var(--slate-500); font-size: 0.82rem; }
.archive-import-card__footer {
  color: var(--slate-400); font-size: 0.75rem; text-align: center;
}
.archive-import-card :deep(.uploader) { box-shadow: none; border-radius: var(--radius-lg); }
.archive-import-card :deep(.uploader__label) { padding: var(--space-6) var(--space-5); gap: var(--space-3); }
.archive-import-card :deep(.uploader__icon) { width: 54px; height: 54px; }

/* ── Barra compacta (datos cargados) ───────────────────────────────────────── */
.archive-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: white; border: 1px solid var(--slate-200);
  border-left: 3px solid var(--success-400);
  border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
}
.archive-bar__main { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.archive-bar__icon {
  width: 36px; height: 36px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md); background: var(--success-100); color: var(--success-600);
}
.archive-bar__icon svg { width: 20px; height: 20px; }
.archive-bar__text { min-width: 0; }
.archive-bar__title-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.archive-bar h2 { margin: 0; color: var(--slate-900); font-size: 1.1rem; line-height: 1.25; }
.archive-bar__meta { font-size: 0.78rem; color: var(--slate-500); }
.archive-bar__meta strong { font-family: var(--font-mono); color: var(--slate-800); font-weight: 700; }
.archive-bar__actions { flex-shrink: 0; }
.hidden-file-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }

/* ── Resumen de observaciones ──────────────────────────────────────────────── */
.archive-issues {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-3); flex-wrap: wrap;
  padding: var(--space-2) var(--space-4);
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: var(--radius-md);
}
.archive-issues__chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.archive-issues__chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px var(--space-2); border-radius: var(--radius-full);
  font-size: 0.78rem; font-weight: 700; color: #92400e;
  background: white; border: 1px solid #fde68a;
}
.archive-issues__chip strong { font-family: var(--font-mono); color: #78350f; }
.archive-issues__actions { display: flex; align-items: center; gap: var(--space-3); }

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

.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
}

.alert__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert--error {
  background: linear-gradient(135deg, var(--error-50) 0%, var(--error-100) 100%);
  color: var(--error-600);
  border: 1px solid var(--error-100);
}

.alert--warn {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.alert--warn .alert__icon {
  color: #d97706;
}

.alert__link {
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  margin-left: 4px;
}

.alert__link:hover {
  opacity: 0.75;
}

.form-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.form-card__header {
  cursor: pointer;
  list-style: none;
}
.form-card__header::-webkit-details-marker { display: none; }
.form-card__header::after { content: '＋'; float: right; margin-top: -1.5rem; color: var(--unap-blue-600); }
.form-card[open] .form-card__header { margin-bottom: var(--space-5); }
.form-card[open] .form-card__header::after { content: '−'; }

.form-card__header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0 0 var(--space-1);
}

.form-card__header p {
  font-size: 0.85rem;
  color: var(--slate-500);
  margin: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-field__input {
  padding: var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  transition: all var(--transition-fast);
  background: var(--slate-50);
}

.form-field__input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.form-field__input::placeholder {
  color: var(--slate-400);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--slate-100);
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
}

.btn__icon {
  width: 16px;
  height: 16px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--unap-blue-600);
  color: white;
  box-shadow: none;
}

.btn--primary:hover:not(:disabled) {
  background: var(--unap-blue-700);
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
  background: var(--error-500);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: var(--error-600);
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

.scope-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: #f8fafc;
  border: 1px solid var(--slate-200);
  border-left: 4px solid var(--unap-blue-500);
  border-radius: var(--radius-lg);
}

.scope-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--unap-blue-700);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.scope-panel h3 {
  margin: 0;
  color: var(--slate-800);
  font-size: 0.98rem;
}

.scope-panel p {
  margin: 0;
  color: var(--slate-500);
  font-size: 0.82rem;
  line-height: 1.45;
  max-width: 430px;
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

:deep(.row--observed) {
  background: #fff7ed;
}

:deep(.row--observed td:first-child) {
  border-left: 3px solid #f97316;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .observed-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .observed-panel__actions {
    justify-content: flex-start;
  }

  .scope-panel {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
