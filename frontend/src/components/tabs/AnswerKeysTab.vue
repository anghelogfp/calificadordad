<script setup>
import { ANSWER_KEY_SUBTABS } from '@/constants'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  answerKeys: {
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
  { key: 'area', label: 'Área', type: 'select' },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true },
  { key: 'litho', label: 'Litho', maxlength: 6 },
  { key: 'answers', label: 'Respuestas', type: 'textarea', rows: 2 },
  { key: 'observaciones', label: 'Observaciones', badge: true },
]

const sourcesColumns = [
  { key: 'area', label: 'Área' },
  { key: 'name', label: 'Respuestas' },
  { key: 'identificationName', label: 'Identificación' },
  { key: 'timestamp', label: 'Fecha y hora', format: 'timestamp' },
  { key: 'validRows', label: 'Registros válidos' },
  { key: 'responseErrors', label: 'Errores resp.', badge: true },
  { key: 'identificationErrors', label: 'Errores id.', badge: true },
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
      title="Importar Claves de Respuestas"
      description="Carga los archivos .dat con las respuestas correctas oficiales para cada área."
      :stats="answerKeys.answerKeyHasData ? [
        { value: answerKeys.totalRows, label: 'Claves' },
        ...(answerKeys.sourcesCount ? [{ value: answerKeys.sourcesCount, label: 'Archivos' }] : [])
      ] : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      </template>
    </StepInfoCard>

    <section class="upload-form-card">
      <header class="upload-form-card__header">
        <h3>Cargar archivos de claves</h3>
        <p>Selecciona el área y adjunta los archivos .dat de identificación y respuestas oficiales.</p>
      </header>
      <form class="upload-form-grid" @submit.prevent="answerKeys.importAnswerKeyFiles">
        <div class="form-field">
          <label for="answer-key-area" class="form-field__label">Área</label>
          <select
            id="answer-key-area"
            v-model="answerKeys.answerKeyArea.value"
            class="form-field__select"
            required
          >
            <option v-for="option in answerKeys.answerKeyAreaOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <div class="form-field">
          <label for="answer-key-identification" class="form-field__label">Archivo de identificación</label>
          <div class="file-input-wrapper">
            <input
              id="answer-key-identification"
              :ref="(el) => answerKeys.identificationInputRef.value = el"
              type="file"
              class="file-input"
              accept=".dat,.txt"
              @change="answerKeys.onAnswerKeyIdentificationChange"
              required
            />
            <div class="file-input-display">
              <span class="file-input-button">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
                Seleccionar .dat
              </span>
              <span class="file-input-name">{{ answerKeys.identificationFile?.name || 'Ningún archivo seleccionado' }}</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label for="answer-key-responses" class="form-field__label">Archivo de respuestas correctas</label>
          <div class="file-input-wrapper">
            <input
              id="answer-key-responses"
              :ref="(el) => answerKeys.responsesInputRef.value = el"
              type="file"
              class="file-input"
              accept=".dat,.txt"
              @change="answerKeys.onAnswerKeyResponsesChange"
              required
            />
            <div class="file-input-display">
              <span class="file-input-button">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
                Seleccionar .dat
              </span>
              <span class="file-input-name">{{ answerKeys.responsesFile?.name || 'Ningún archivo seleccionado' }}</span>
            </div>
          </div>
        </div>

        <div class="form-field form-field--action">
          <button type="submit" class="btn btn--primary btn--lg">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Importar claves para el área
          </button>
        </div>
      </form>
    </section>

    <div v-if="answerKeys.importError" class="alert alert--error">
      {{ answerKeys.importError }}
    </div>

    <Toolbar
      v-model:search-value="answerKeys.search.value"
      search-placeholder="Buscar por área, tipo, litho o observaciones"
      :total-rows="answerKeys.totalRows"
      :filtered-count="answerKeys.filteredRows.length"
    >
      <template #actions>
        <button type="button" class="btn" @click="answerKeys.exportAnswerKeysToExcel" :disabled="!answerKeys.answerKeyHasData">
          Exportar a Excel
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="answerKeys.exportAnswerKeysObservationsPdf"
          :disabled="!answerKeys.observationCount"
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
        <button type="button" class="btn" @click="answerKeys.clearAllAnswerKeys" :disabled="!answerKeys.answerKeyHasData">
          Limpiar tabla
        </button>
        <button
          type="button"
          class="btn btn--danger"
          @click="answerKeys.removeSelected"
          :disabled="!answerKeys.totalSelected"
        >
          Eliminar seleccionados ({{ answerKeys.totalSelected }})
        </button>
      </template>
    </Toolbar>

    <SubTabs
      :tabs="[
        { key: 'list', label: `Registros (${answerKeys.totalRows})` },
        { key: 'sources', label: `Archivos cargados (${answerKeys.sourcesCount})` }
      ]"
      :model-value="subTab"
      @update:model-value="$emit('update:subTab', $event)"
      aria-label="Secciones de claves"
    />

    <template v-if="subTab === 'list'">
      <DataTable
        v-if="answerKeys.answerKeyHasData"
        :columns="tableColumns.map(col => col.key === 'area' ? { ...col, options: answerKeys.answerKeyAreaOptions } : col)"
        :rows="answerKeys.filteredRows"
        :selection="answerKeys.selection"
        :editing="answerKeys.editing"
        :is-all-selected="answerKeys.isAllVisibleSelected"
        :row-class="getRowClass"
        @toggle-selection="answerKeys.toggleSelection"
        @toggle-select-all="answerKeys.toggleSelectAll"
        @toggle-edit="answerKeys.toggleEdit"
        @remove-row="answerKeys.removeRow"
      />

      <EmptyState
        v-else
        title="Sin claves cargadas"
        description="Importa las claves oficiales para comenzar a trabajar con la tabla."
        icon="document"
      />
    </template>

    <SourcesPanel
      v-else
      title="Archivos importados"
      description="Resumen de las claves que has registrado."
      :sources="answerKeys.sources"
      :total-rows="answerKeys.totalRows"
      :columns="sourcesColumns"
      @remove-source="answerKeys.removeAnswerKeySource"
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

.upload-form-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
}

.upload-form-card__header {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--slate-100);
}

.upload-form-card__header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0 0 var(--space-1);
}

.upload-form-card__header p {
  font-size: 0.9rem;
  color: var(--slate-500);
  margin: 0;
}

.upload-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-5);
  align-items: start;
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

.form-field__select {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.form-field__select:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.file-input-wrapper {
  position: relative;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}

.file-input-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-input-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.file-input-button svg {
  width: 16px;
  height: 16px;
}

.file-input-wrapper:hover .file-input-button {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.file-input-name {
  font-size: 0.8rem;
  color: var(--slate-500);
  padding: var(--space-2);
  background: var(--slate-50);
  border-radius: var(--radius-sm);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.form-field--action {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  grid-column: 1 / -1;
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--slate-100);
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

.btn__icon {
  width: 16px;
  height: 16px;
}

.btn:hover:not(:disabled) {
  background: var(--slate-200);
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

.btn--lg {
  padding: var(--space-3) var(--space-6);
  font-size: 0.95rem;
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
