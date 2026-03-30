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
})

const emit = defineEmits([
  'toggleSelection',
  'toggleSelectAll',
  'toggleEdit',
  'cancelEdit',
  'removeRow',
])

// Snapshot de valores originales para cancel
const originalValues = new Map()

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

function onRemoveRow(id) {
  if (confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) {
    emit('removeRow', id)
  }
}

function getRowClasses(row) {
  return {
    'row--selected': isSelected(row.id),
    'row--editing': isEditing(row.id),
    ...props.rowClass(row),
  }
}

watch(() => props.isIndeterminate, (val) => {
  if (checkboxRef.value) checkboxRef.value.indeterminate = val
}, { immediate: true })
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
            <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
            <th v-if="showActions" class="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="row.id"
            :class="getRowClasses(row)"
          >
            <td v-if="showIndex" class="col-index">{{ index + 1 }}</td>
            <td v-if="showCheckbox" class="col-check">
              <label class="checkbox">
                <input type="checkbox" :checked="isSelected(row.id)" @change="() => onToggleSelection(row.id)" />
                <span class="checkbox__mark"></span>
              </label>
            </td>
            <td v-for="column in columns" :key="column.key">
              <textarea
                v-if="column.type === 'textarea'"
                v-model="row[column.key]"
                class="cell-textarea"
                :rows="column.rows || 2"
                :readonly="!isEditing(row.id)"
                :class="{ 'cell-input--locked': !isEditing(row.id) }"
              ></textarea>
              <template v-else-if="column.type === 'select' && isEditing(row.id)">
                <select class="cell-input" v-model="row[column.key]">
                  <option v-for="option in column.options" :key="option" :value="option">{{ option }}</option>
                </select>
              </template>
              <span v-else-if="column.type === 'select' && !isEditing(row.id)">
                {{ row[column.key] || '—' }}
              </span>
              <span
                v-else-if="column.badge"
                class="badge"
                :class="{
                  'badge--ok': row[column.key] === 'Sin observaciones',
                  'badge--warn': row[column.key] !== 'Sin observaciones',
                }"
              >{{ row[column.key] }}</span>
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
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                </button>
                <!-- Eliminar (solo si no editando) -->
                <button
                  v-if="!isEditing(row.id)"
                  type="button"
                  class="action-btn action-btn--danger"
                  @click="onRemoveRow(row.id)"
                  title="Eliminar"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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

.table-container { overflow-x: auto; }

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
.col-actions { width: 110px; }

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

.cell-textarea {
  width: 100%; padding: var(--space-2); border: 1px solid transparent;
  border-radius: var(--radius-sm); background: transparent;
  resize: vertical; min-height: 48px; font-family: inherit;
  font-size: 0.9rem; transition: all var(--transition-fast);
}
.cell-textarea:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.1);
}

/* Badge */
.badge {
  display: inline-flex; align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600;
}
.badge--ok { background: var(--success-100); color: var(--success-600); }
.badge--warn { background: var(--warning-100); color: var(--warning-600); }

/* Row actions */
.row-actions { display: flex; gap: var(--space-1); }

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

@media (max-width: 768px) {
  .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .data-table { min-width: 800px; }
}
</style>
