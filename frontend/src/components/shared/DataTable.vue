<script setup>
import { ref, watch } from 'vue'

const checkboxRef = ref(null)

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  selection: { type: Object, default: () => new Set() },
  editing: { type: Object, default: () => new Set() },
  isAllSelected: { type: Boolean, default: false },
  isIndeterminate: { type: Boolean, default: false },
  showIndex: { type: Boolean, default: true },
  showCheckbox: { type: Boolean, default: true },
  showActions: { type: Boolean, default: true },
  rowClass: { type: Function, default: () => ({}) },
  selectedCount: { type: Number, default: 0 },
  // Paginación — pasar el objeto `pagination` de useTableState
  pagination: { type: Object, default: null },
  // Skeleton loader
  loading: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 8 },
  pageSizeOptions: { type: Array, default: () => [10, 25, 50, 100] },
})

const emit = defineEmits([
  'toggleSelection',
  'toggleSelectAll',
  'toggleEdit',
  'cancelEdit',
  'removeRow',
  'changePage',
  'changePageSize',
  'cellAction',
])

// Snapshot de valores originales para cancel
const originalValues = new Map()

// Confirmación inline por fila
const pendingRemoveId = ref(null)

function onRemoveRequest(id) { pendingRemoveId.value = id }
function onRemoveConfirm()   { emit('removeRow', pendingRemoveId.value); pendingRemoveId.value = null }
function onRemoveCancel()    { pendingRemoveId.value = null }

function isEditing(id) { return props.editing.has(id) }
function isSelected(id) { return props.selection.has(id) }

function onToggleSelection(id) { emit('toggleSelection', id) }
function onToggleSelectAll(event) { emit('toggleSelectAll', event.target.checked) }

function onToggleEdit(id) {
  if (!isEditing(id)) {
    // Snapshot antes de editar
    const row = props.rows.find(r => r.id === id)
    if (row) originalValues.set(id, { ...row })
  } else {
    originalValues.delete(id)
  }
  emit('toggleEdit', id)
}

function onCancelEdit(id) {
  const original = originalValues.get(id)
  if (original) {
    const row = props.rows.find(r => r.id === id)
    if (row) Object.assign(row, original)
    originalValues.delete(id)
  }
  emit('cancelEdit', id)
}

function onRemoveRow(id) { onRemoveRequest(id) }

function getRowClasses(row) {
  return {
    'row--selected': isSelected(row.id),
    'row--editing': isEditing(row.id),
    ...props.rowClass(row),
  }
}

function getColumnStyle(column) {
  return {
    width: column.width || undefined,
    minWidth: column.minWidth || undefined,
    maxWidth: column.maxWidth || undefined,
  }
}

watch(() => props.isIndeterminate, (val) => {
  if (checkboxRef.value) checkboxRef.value.indeterminate = val
}, { immediate: true })

// Genera la secuencia de páginas con elipsis: [1, '...', 4, 5, 6, '...', 20]
function visiblePages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  const addPage = (p) => { if (!pages.includes(p) && p >= 1 && p <= total) pages.push(p) }

  addPage(1)
  if (current > 3) pages.push('...')
  for (let p = current - 1; p <= current + 1; p++) addPage(p)
  if (current < total - 2) pages.push('...')
  addPage(total)

  return pages
}
</script>

<template>
  <section class="data-card">
    <!-- Barra de selección -->
    <div v-if="selectedCount > 0" class="selection-bar">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
      <span>{{ selectedCount }} fila(s) seleccionada(s)</span>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="showIndex" class="col-index">#</th>
            <th v-if="showCheckbox" class="col-check">
              <label class="checkbox">
                <input
                  ref="checkboxRef"
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="onToggleSelectAll"
                />
                <span class="checkbox__mark"></span>
              </label>
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="column.class"
              :style="getColumnStyle(column)"
            >{{ column.label }}</th>
            <th v-if="showActions" class="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <!-- Skeleton rows -->
          <template v-if="loading">
            <tr v-for="i in skeletonRows" :key="`sk-${i}`" class="row--skeleton">
              <td v-if="showIndex" class="col-index"><span class="skel skel--xs"></span></td>
              <td v-if="showCheckbox" class="col-check"><span class="skel skel--check"></span></td>
              <td v-for="col in columns" :key="col.key" :class="col.class" :style="getColumnStyle(col)"><span class="skel" :style="{ width: col.tight ? '50px' : `${55 + (i * 13 + col.key.length * 7) % 35}%` }"></span></td>
              <td v-if="showActions" class="col-actions">
                <div class="row-actions">
                  <span class="skel skel--btn"></span>
                  <span class="skel skel--btn"></span>
                </div>
              </td>
            </tr>
          </template>

          <template v-else>
          <tr
            v-for="(row, index) in rows"
            :key="row.id"
            :class="getRowClasses(row)"
          >
            <td v-if="showIndex" class="col-index">
              {{ pagination ? (pagination.current - 1) * pagination.pageSize + index + 1 : index + 1 }}
            </td>
            <td v-if="showCheckbox" class="col-check">
              <label class="checkbox">
                <input type="checkbox" :checked="isSelected(row.id)" @change="() => onToggleSelection(row.id)" />
                <span class="checkbox__mark"></span>
              </label>
            </td>
            <td v-for="column in columns" :key="column.key" :class="column.class" :style="getColumnStyle(column)">
              <textarea
                v-if="column.type === 'textarea' && isEditing(row.id)"
                v-model="row[column.key]"
                class="cell-textarea"
                :rows="column.rows || 2"
              ></textarea>
              <span
                v-else-if="column.type === 'textarea'"
                class="cell-text-readonly cell-textarea-readonly"
              >{{ row[column.key] || '—' }}</span>
              <template v-else-if="column.type === 'select' && isEditing(row.id)">
                <select class="cell-input" v-model="row[column.key]">
                  <option v-for="option in column.options" :key="option" :value="option">{{ option }}</option>
                </select>
              </template>
              <span v-else-if="column.type === 'select' && !isEditing(row.id)" class="cell-text-readonly">
                {{ row[column.key] || '—' }}
              </span>
              <span
                v-else-if="column.type === 'answer-count'"
                class="answer-count"
                :class="row[column.statusKey || `${column.key}Status`] === 'ok' ? 'answer-count--ok' : 'answer-count--warn'"
                :title="row[column.titleKey || `${column.key}Title`] || undefined"
              >
                {{ row[column.key] }}
              </span>
              <span
                v-else-if="column.badge"
                class="badge"
                :class="{
                  'badge--ok': row[column.key] === 'Sin observaciones',
                  'badge--warn': row[column.key] !== 'Sin observaciones',
                }"
              >{{ row[column.key] }}</span>
              <button
                v-else-if="column.type === 'button'"
                type="button"
                class="cell-action-btn"
                :class="column.buttonClass"
                :title="column.buttonTitle || column.label"
                :aria-label="column.buttonAriaLabel || column.label"
                @click="emit('cellAction', { row, column })"
              >
                <span v-if="column.buttonIcon" class="cell-action-btn__icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path :d="column.buttonIcon" />
                  </svg>
                </span>
                <span class="cell-action-btn__label">{{ column.buttonLabel || column.label }}</span>
              </button>
              <input
                v-else
                v-model="row[column.key]"
                type="text"
                class="cell-input"
                :class="{
                  'cell-input--locked': !isEditing(row.id),
                  'cell-input--tight': column.tight,
                }"
                :maxlength="column.maxlength"
                :readonly="!isEditing(row.id)"
              />
            </td>
            <td v-if="showActions" class="col-actions">
              <div class="row-actions">
                <!-- Guardar edición -->
                <button
                  v-if="isEditing(row.id)"
                  type="button"
                  class="action-btn action-btn--save"
                  @click="onToggleEdit(row.id)"
                  title="Guardar cambios"
                  aria-label="Guardar cambios"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <!-- Cancelar edición -->
                <button
                  v-if="isEditing(row.id)"
                  type="button"
                  class="action-btn action-btn--cancel"
                  @click="onCancelEdit(row.id)"
                  title="Cancelar edición"
                  aria-label="Cancelar edición"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <!-- Editar -->
                <button
                  v-if="!isEditing(row.id)"
                  type="button"
                  class="action-btn"
                  @click="onToggleEdit(row.id)"
                  title="Editar"
                  aria-label="Editar fila"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                </button>
                <!-- Confirmar eliminación inline -->
                <template v-if="pendingRemoveId === row.id">
                  <button type="button" class="action-btn action-btn--confirm" @click="onRemoveConfirm" title="Confirmar eliminación" aria-label="Confirmar eliminación">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  </button>
                  <button type="button" class="action-btn action-btn--cancel" @click="onRemoveCancel" title="Cancelar" aria-label="Cancelar eliminación">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                  </button>
                </template>
                <!-- Eliminar (solo si no editando y sin confirmación pendiente) -->
                <button
                  v-else-if="!isEditing(row.id)"
                  type="button"
                  class="action-btn action-btn--danger"
                  @click="onRemoveRow(row.id)"
                  title="Eliminar"
                  aria-label="Eliminar fila"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Paginación -->
    <div v-if="pagination && pagination.totalFiltered > 0" class="pagination-bar">
      <span class="pagination-info">
        Mostrando
        <strong>{{ (pagination.current - 1) * pagination.pageSize + 1 }}–{{ Math.min(pagination.current * pagination.pageSize, pagination.totalFiltered) }}</strong>
        de <strong>{{ pagination.totalFiltered }}</strong> registros
      </span>
      <label class="page-size-control">
        Filas
        <select :value="pagination.pageSize" @change="emit('changePageSize', Number($event.target.value))">
          <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <div class="pagination-controls">
        <button
          class="page-btn"
          :disabled="pagination.current === 1"
          @click="emit('changePage', 1)"
          title="Primera página"
        >«</button>
        <button
          class="page-btn"
          :disabled="pagination.current === 1"
          @click="emit('changePage', pagination.current - 1)"
          title="Anterior"
        >‹</button>

        <template v-for="p in visiblePages(pagination.current, pagination.total)" :key="p">
          <span v-if="p === '...'" class="page-ellipsis">…</span>
          <button
            v-else
            class="page-btn"
            :class="{ 'page-btn--active': p === pagination.current }"
            @click="emit('changePage', p)"
          >{{ p }}</button>
        </template>

        <button
          class="page-btn"
          :disabled="pagination.current === pagination.total"
          @click="emit('changePage', pagination.current + 1)"
          title="Siguiente"
        >›</button>
        <button
          class="page-btn"
          :disabled="pagination.current === pagination.total"
          @click="emit('changePage', pagination.total)"
          title="Última página"
        >»</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.data-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

/* Barra de selección */
.selection-bar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--unap-gold-50);
  border-bottom: 1px solid var(--unap-gold-200);
  font-size: 0.82rem; font-weight: 600; color: var(--unap-blue-800);
}
.selection-bar svg { width: 14px; height: 14px; color: var(--unap-gold-600); }

.table-container {
  width: 100%; max-width: 100%; min-width: 0;
  overflow-x: auto; overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.data-table {
  width: 100%; border-collapse: collapse; font-size: 0.9rem;
}

.data-table thead {
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
}

.data-table th {
  padding: var(--space-4); text-align: left; font-weight: 600;
  color: white; font-size: 0.8rem; text-transform: uppercase;
  letter-spacing: 0.05em; white-space: nowrap;
}

.data-table tbody tr {
  border-bottom: 1px solid var(--slate-100);
  transition: background var(--transition-fast);
}
.data-table tbody tr:nth-child(even) { background: var(--slate-50); }
.data-table tbody tr:hover { background: var(--unap-blue-50); }
.data-table tbody tr.row--selected { background: var(--unap-gold-50); }
.data-table tbody tr.row--editing {
  background: var(--unap-blue-50);
  box-shadow: inset 4px 0 0 var(--unap-blue-500);
}
.data-table tbody tr.row--issue { box-shadow: inset 4px 0 0 var(--warning-500); }

.data-table td { padding: var(--space-3) var(--space-4); vertical-align: middle; }

.col-index {
  width: 50px; text-align: center; font-family: var(--font-mono);
  font-weight: 600; color: var(--slate-400); font-size: 0.8rem;
}
.col-check { width: 40px; text-align: center; }
.col-actions { width: 84px; min-width: 84px; }

/* Checkbox */
.checkbox { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.checkbox input { position: absolute; opacity: 0; pointer-events: none; }
.checkbox__mark {
  width: 18px; height: 18px; border: 2px solid var(--slate-300);
  border-radius: 4px; background: white;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.checkbox input:checked + .checkbox__mark {
  background: var(--unap-blue-600); border-color: var(--unap-blue-600);
}
.checkbox input:checked + .checkbox__mark::after {
  content: ''; width: 5px; height: 9px; border: solid white;
  border-width: 0 2px 2px 0; transform: rotate(45deg) translateY(-1px);
}

/* Cell inputs */
.cell-input {
  width: 100%; padding: var(--space-2); border: 1px solid transparent;
  border-radius: var(--radius-sm); font-size: 0.875rem;
  background: transparent; transition: all var(--transition-fast);
}
.cell-input:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.1);
}
.cell-input--locked { color: var(--slate-700); cursor: default; }
.cell-input--tight { max-width: 60px; }
.column--dni .cell-input {
  min-width: 9ch; font-family: var(--font-mono); font-weight: 650;
  letter-spacing: 0.02em; white-space: nowrap;
}
.column--name .cell-input { min-width: 150px; }
.column--program .cell-input { min-width: 210px; }
.column--code .cell-input {
  font-family: var(--font-mono); white-space: nowrap; text-align: center;
}
.column--answers .cell-textarea {
  min-width: 440px; font-family: var(--font-mono); letter-spacing: 0.04em;
  white-space: pre; resize: none; overflow-x: auto; overflow-y: hidden;
}
.column--answers .cell-textarea-readonly {
  min-width: 440px;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  white-space: pre;
}
.column--observations { min-width: 220px; }

.cell-textarea {
  width: 100%; padding: var(--space-2); border: 1px solid transparent;
  border-radius: var(--radius-sm); background: transparent;
  resize: none; min-height: 38px; font-family: inherit;
  font-size: 0.9rem; line-height: 1.35; transition: all var(--transition-fast);
  display: block;
}
.cell-textarea:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.1);
}
.cell-textarea-readonly {
  overflow-x: auto;
  overflow-y: hidden;
}
.cell-text-readonly {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: var(--space-2);
  color: var(--slate-700);
  font-size: 0.9rem;
  line-height: 1.35;
}

/* Badge */
.badge {
  display: inline-flex; align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600;
}
.badge--ok { background: var(--success-100); color: var(--success-600); }
.badge--warn { background: var(--warning-100); color: var(--warning-600); }

.cell-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: white;
  color: var(--slate-700);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cell-action-btn:hover {
  border-color: var(--unap-blue-300);
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
}

.cell-action-btn__icon svg {
  width: 14px;
  height: 14px;
}

.cell-action-btn__label {
  white-space: nowrap;
}

.answer-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 800;
}
.answer-count--ok {
  background: var(--success-100);
  color: var(--success-700);
}
.answer-count--warn {
  background: var(--warning-100);
  color: var(--warning-700);
}

/* Row actions — aparecen al hover */
.col-actions { width: 84px; min-width: 84px; }

.row-actions {
  display: flex; gap: var(--space-1);
  opacity: 0.45;
  transition: opacity var(--transition-fast);
}

.data-table tbody tr:hover .row-actions,
.data-table tbody tr.row--editing .row-actions {
  opacity: 1;
}

.action-btn {
  width: 30px; height: 30px; border: none; border-radius: var(--radius-md);
  background: var(--slate-100); color: var(--slate-500); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.action-btn svg { width: 15px; height: 15px; }
.action-btn:hover { background: var(--unap-blue-100); color: var(--unap-blue-600); }

.action-btn--save { background: var(--success-100); color: var(--success-600); }
.action-btn--save:hover { background: var(--success-500); color: white; }

.action-btn--cancel { background: var(--slate-100); color: var(--slate-500); }
.action-btn--cancel:hover { background: var(--warning-100); color: var(--warning-600); }

.action-btn--danger:hover { background: var(--error-100); color: var(--error-600); }

.action-btn--confirm { color: var(--success-600); }
.action-btn--confirm:hover { background: #dcfce7; color: var(--success-700); }

@media (max-width: 768px) {
  .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .data-table { min-width: 800px; }
}

/* ── Paginación ─────────────────────────────────────────────────────────── */
.pagination-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--slate-200);
  background: var(--slate-50);
  flex-wrap: wrap; gap: var(--space-2);
}

.pagination-info {
  font-size: 0.82rem; color: var(--slate-500);
}
.pagination-info strong { color: var(--slate-700); }

.pagination-controls {
  display: flex; align-items: center; gap: var(--space-1);
}

.page-size-control {
  display: flex; align-items: center; gap: var(--space-2);
  margin-left: auto; font-size: 0.8rem; color: var(--slate-500);
}
.page-size-control select {
  padding: var(--space-1) var(--space-2); border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); background: white; color: var(--slate-700);
}

.page-btn {
  min-width: 32px; height: 32px; padding: 0 var(--space-2);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: white; color: var(--slate-600);
  font-size: 0.82rem; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.page-btn:hover:not(:disabled) {
  border-color: var(--unap-blue-400); color: var(--unap-blue-700);
  background: var(--unap-blue-50);
}
.page-btn:disabled {
  opacity: 0.35; cursor: not-allowed;
}
.page-btn--active {
  background: var(--unap-blue-700); border-color: var(--unap-blue-700);
  color: white; font-weight: 700;
}
.page-btn--active:hover { background: var(--unap-blue-800); border-color: var(--unap-blue-800); color: white; }

.page-ellipsis {
  min-width: 24px; text-align: center; color: var(--slate-400); font-size: 0.9rem;
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */
.row--skeleton td {
  padding: var(--space-3) var(--space-4);
}

.skel {
  display: inline-block;
  height: 14px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--slate-200) 25%, var(--slate-100) 50%, var(--slate-200) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  vertical-align: middle;
  width: 70%;
}

.skel--xs { width: 24px; }
.skel--check { width: 18px; height: 18px; border-radius: 4px; }
.skel--btn { width: 30px; height: 30px; border-radius: var(--radius-md); }
</style>
