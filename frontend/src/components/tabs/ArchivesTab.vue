<script setup>
import { ARCHIVE_COLUMNS } from '@/constants'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import FileUploader from '@/components/shared/FileUploader.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import DataTable from '@/components/shared/DataTable.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  archives: {
    type: Object,
    required: true
  }
})

const tableColumns = ARCHIVE_COLUMNS.map(col => ({
  key: col.key,
  label: col.label,
  editable: true,
}))

function getRowClass(row) {
  return {}
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Importar Padrón de Postulantes"
      description="Carga el archivo Excel con la lista de candidatos inscritos para el examen de admisión."
      :stats="archives.hasData ? [{ value: archives.totalRows, label: 'Registros' }] : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
      </template>
    </StepInfoCard>

    <FileUploader
      id="archive-input"
      accept=".xlsx"
      :is-dragging="archives.isDragging"
      :has-data="archives.hasData"
      title="Arrastra tu archivo Excel aquí"
      subtitle="o haz clic para seleccionar desde tu equipo"
      button-text="Seleccionar archivo .xlsx"
      :badges="['.xlsx']"
      :hint="`Columnas: ${ARCHIVE_COLUMNS.map(c => c.label).join(', ')}`"
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

    <div v-if="archives.importError" class="alert alert--error">
      <svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
      </svg>
      <span>{{ archives.importError }}</span>
    </div>

    <Toolbar
      v-model:search-value="archives.search.value"
      search-placeholder="Buscar postulantes..."
      :total-rows="archives.totalRows"
      :filtered-count="archives.totalFiltered"
    >
      <template #actions>
        <button type="button" class="btn btn--primary" @click="archives.exportArchiveToExcel" :disabled="!archives.hasData">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Exportar Excel
        </button>
        <button type="button" class="btn btn--ghost" @click="archives.clearAll" :disabled="!archives.hasData">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
          Limpiar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="archives.removeSelected"
          :disabled="!archives.totalSelected"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          Eliminar ({{ archives.totalSelected }})
        </button>
      </template>
    </Toolbar>

    <DataTable
      v-if="archives.hasData"
      :columns="tableColumns"
      :rows="archives.filteredRows"
      :selection="archives.selection"
      :editing="archives.editing"
      :is-all-selected="archives.isAllVisibleSelected"
      :row-class="getRowClass"
      @toggle-selection="archives.toggleSelection"
      @toggle-select-all="archives.toggleSelectAll"
      @toggle-edit="archives.toggleEdit"
      @remove-row="archives.removeRow"
    />

    <EmptyState
      v-else
      title="Sin registros cargados"
      description="Importa un archivo Excel o agrega registros manualmente para comenzar."
      icon="add"
    />

    <section class="form-card">
      <header class="form-card__header">
        <h3>Agregar registro manual</h3>
        <p>Completa los campos para añadir un nuevo postulante</p>
      </header>
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
    </section>
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

.form-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.form-card__header {
  margin-bottom: var(--space-5);
}

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
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
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
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
