<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ANSWER_KEY_SUBTABS } from '@/constants'
import WorkflowIntroCard from '@/components/shared/WorkflowIntroCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import SourcesPanel from '@/components/shared/SourcesPanel.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import StepVerificationPanel from '@/components/shared/StepVerificationPanel.vue'

const props = defineProps({
  answerKeys: {
    type: Object,
    required: true
  },
  subTab: {
    type: String,
    required: true
  },
  reconciliation: {
    type: Object,
    default: null,
  },
  processType: {
    type: String,
    default: 'simulacro',
  },
  simulacroScope: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:subTab'])

const answerKeys = reactive(props.answerKeys)
const showOnlyObserved = ref(false)
const importMode = ref('general')

const expectedKeyMode = computed(() => {
  if (props.processType === 'real') return 'area'
  return props.simulacroScope === 'general' ? 'general' : 'area'
})

watch(expectedKeyMode, (mode) => {
  setImportMode(mode)
}, { immediate: true })

const displayedRows = computed(() => (
  showOnlyObserved.value ? answerKeys.observations : answerKeys.pagedRows
))

const displayedRowsWithCounts = computed(() =>
  displayedRows.value.map((row) => {
    const expected = answerKeys.expectedAnswersLength ?? 60
    const actual = String(row.answers || '').replace(/\s/g, '').length
    row.answerCount = `${actual}/${expected}`
    row.answerCountStatus = actual === expected ? 'ok' : 'warn'
    row.answerCountTitle = actual === expected
      ? 'Clave completa'
      : `Clave incompleta: ${actual} de ${expected} respuestas`
    return row
  })
)

function setImportMode(mode) {
  const nextMode = expectedKeyMode.value === 'general' ? 'general' : 'area'
  mode = mode === nextMode ? mode : nextMode
  importMode.value = mode
  if (mode === 'general') {
    answerKeys.identificationFile = null
    if (answerKeys.identificationInputRef) {
      answerKeys.identificationInputRef.value = ''
    }
  }
}

const configuredOffset = computed(() => answerKeys.configuredResponseAnswersOffset ?? 7)
const detectFileInput = ref(null)
const detecting = ref(false)

const detectStatus = computed(() => {
  const r = answerKeys.detectedOffset
  if (!r) return null
  if (r.offset < 0) return { label: 'Error al detectar', variant: 'error' }
  const match = r.offset === configuredOffset.value
  return {
    label: match
      ? `Offset detectado: ${r.offset} (coincide con config)`
      : `Offset detectado: ${r.offset} (config: ${configuredOffset.value})`,
    variant: match ? 'success' : 'warn',
  }
})

function handleDetectFormat() {
  detectFileInput.value?.click()
}

async function onDetectFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  detecting.value = true
  await answerKeys.detectFormat(file)
  detecting.value = false
  event.target.value = ''
}

const tableColumns = [
  { key: 'area', label: 'Área', type: 'select', minWidth: '170px' },
  { key: 'tipo', label: 'Tip', maxlength: 1, tight: true, class: 'column--code', width: '65px', minWidth: '65px' },
  { key: 'litho', label: 'Litho', maxlength: 6, class: 'column--code', width: '105px', minWidth: '105px' },
  { key: 'answers', label: 'Respuestas', type: 'textarea', rows: 2, class: 'column--answers', minWidth: '470px' },
  { key: 'answerCount', label: 'Conteo', type: 'answer-count', width: '92px', minWidth: '92px' },
  { key: 'observaciones', label: 'Observaciones', badge: true, class: 'column--observations', minWidth: '240px' },
]

const sourcesColumns = [
  { key: 'area', label: 'Área', minWidth: '150px' },
  { key: 'name', label: 'Respuestas', minWidth: '220px' },
  { key: 'identificationName', label: 'Identificación', minWidth: '220px' },
  { key: 'timestamp', label: 'Fecha y hora', format: 'timestamp', minWidth: '175px' },
  { key: 'validRows', label: 'Registros válidos', width: '130px' },
  { key: 'responseErrors', label: 'Errores resp.', badge: true, width: '110px' },
  { key: 'identificationErrors', label: 'Errores id.', badge: true, width: '100px' },
]

function getRowClass(row) {
  return {
    'row--issue': Boolean(answerKeys.observationByRowId?.get(row.id))
  }
}

// Cobertura de áreas
const areaCoverage = computed(() => {
  const loaded = new Set(answerKeys.sources.map(s => s.area).filter(Boolean))
  const generalKeyCoversSimulacro = props.reconciliation?.generalKeyCoversSimulacro
  return (answerKeys.answerKeyAreaOptions || []).map(area => ({
    name: area,
    hasKey: generalKeyCoversSimulacro || loaded.has(area),
  }))
})

const coveredCount = computed(() => areaCoverage.value.filter(a => a.hasKey).length)
const hasMissingAreaCoverage = computed(() =>
  !props.reconciliation?.generalKeyCoversSimulacro &&
  coveredCount.value < areaCoverage.value.length
)
const coverageUnit = computed(() =>
  props.reconciliation?.mode === 'simulacro-areas' ? 'áreas' : 'pares'
)

const stepState = computed(() => {
  if (!answerKeys.answerKeyHasData && !(props.reconciliation?.keysTotal)) {
    return {
      variant: 'info',
      title: 'Pendiente de claves',
    }
  }
  if (props.reconciliation?.missingPairs?.length || props.reconciliation?.duplicatePairs) {
    return {
      variant: 'error',
      title: 'Corregir claves faltantes o duplicadas',
    }
  }
  if (props.reconciliation?.incompleteKeys || hasMissingAreaCoverage.value) {
    return {
      variant: 'warn',
      title: 'Revisar cobertura de claves',
    }
  }
  return {
    variant: 'ok',
    title: 'Claves listas para calificar',
  }
})
</script>

<template>
  <section class="tab-content">
    <WorkflowIntroCard
      eyebrow="Paso 4 · Claves oficiales"
      title="Claves de respuestas"
      description="Registra las respuestas correctas oficiales para cada área y tipo de prueba."
      :count="answerKeys.totalRows"
      count-label="claves cargadas"
      :ready="answerKeys.answerKeyHasData"
      :process-type="processType"
      :simulacro-scope="simulacroScope"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      </template>
    </WorkflowIntroCard>

    <StepVerificationPanel
      v-if="areaCoverage.length || (reconciliation && reconciliation.keysTotal)"
      eyebrow="Verificación de claves"
      :title="stepState.title"
      :summary="areaCoverage.length && !reconciliation?.generalKeyCoversSimulacro
        ? `${coveredCount} / ${areaCoverage.length} áreas con clave`
        : reconciliation?.generalKeyCoversSimulacro
          ? 'Clave general activa'
          : ''"
    >
      <template v-if="answerKeys.observationCount" #actions>
        <button type="button" class="btn btn--ghost" @click="showOnlyObserved = !showOnlyObserved">
          {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
        </button>
        <button type="button" class="btn btn--primary" @click="answerKeys.exportAnswerKeyObservationsToExcel">
          Exportar observados
        </button>
      </template>
      <template #chips>
        <template v-if="reconciliation && reconciliation.keysTotal">
          <span class="verification-chip verification-chip--ok"><strong>{{ reconciliation.coveredPairs }}</strong> {{ coverageUnit }} cubiertos</span>
          <span class="verification-chip" :class="reconciliation.missingPairs.length ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.missingPairs.length }}</strong> {{ coverageUnit }} faltantes</span>
          <span class="verification-chip verification-chip--info"><strong>{{ reconciliation.generalKeys }}</strong> claves generales</span>
          <span class="verification-chip" :class="reconciliation.duplicatePairs ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicatePairs }}</strong> duplicadas</span>
          <span class="verification-chip" :class="reconciliation.incompleteKeys ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ reconciliation.incompleteKeys }}</strong> observadas</span>
        </template>
        <template v-if="!reconciliation?.generalKeyCoversSimulacro">
          <span
            v-for="area in areaCoverage"
            :key="area.name"
            class="verification-chip"
            :class="area.hasKey ? 'verification-chip--ok' : 'verification-chip--warn'"
          >
            <strong>{{ area.hasKey ? 'OK' : 'Falta' }}</strong> {{ area.name }}
          </span>
        </template>
      </template>
      <template v-if="answerKeys.observationCount" #detail>
        <span v-for="item in answerKeys.observationSummary" :key="item.label" class="verification-chip verification-chip--warn">
          <strong>{{ item.count }}</strong> {{ item.label }}
        </span>
      </template>
      <template v-if="reconciliation?.missingPairs?.length" #hint>
        Faltan:
        <strong
          v-for="(pair, index) in reconciliation.missingPairs.slice(0, 8)"
          :key="`${pair.area}-${pair.type}`"
        >
          {{ pair.type ? `${pair.area} ${pair.type}` : pair.area }}<span v-if="index < Math.min(reconciliation.missingPairs.length, 8) - 1">, </span>
        </strong>
        <span v-if="reconciliation.missingPairs.length > 8"> y {{ reconciliation.missingPairs.length - 8 }} más.</span>
      </template>
      <template v-else #hint>
        {{ reconciliation?.generalKeyCoversSimulacro
          ? 'En simulacro, la clave general cubre el ranking completo sin exigir claves por área.'
          : 'Este cruce compara las claves cargadas con las áreas y tipos detectados en las respuestas.' }}
      </template>
    </StepVerificationPanel>

    <details class="upload-form-card" :open="!answerKeys.answerKeyHasData">
      <summary class="upload-form-card__header">
        <span class="upload-form-card__icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </span>
        <span class="upload-form-card__title">
          <strong>Cargar claves</strong>
          <small>{{ importMode === 'general' ? 'Clave general de simulacro' : 'Área + identificación + respuestas oficiales' }}</small>
        </span>
      </summary>
      <form class="upload-form-grid" @submit.prevent="answerKeys.importAnswerKeyFiles">
        <div class="form-field form-field--wide">
          <label class="form-field__label">Tipo de clave</label>
          <div class="key-mode-toggle key-mode-toggle--locked">
            <button
              type="button"
              class="key-mode-btn"
              :class="{ 'key-mode-btn--active': importMode === 'general' }"
              :disabled="expectedKeyMode !== 'general'"
              @click="setImportMode('general')"
            >
              Clave general
            </button>
            <button
              type="button"
              class="key-mode-btn"
              :class="{ 'key-mode-btn--active': importMode === 'area' }"
              :disabled="expectedKeyMode !== 'area'"
              @click="setImportMode('area')"
            >
              {{ processType === 'real' ? 'Por área/tipo' : 'Por área' }}
            </button>
          </div>
          <p class="form-field__hint">Este modo viene del camino definido al crear el proceso.</p>
        </div>

        <div v-if="importMode === 'area'" class="form-field">
          <label for="answer-key-area" class="form-field__label">Área</label>
          <select
            id="answer-key-area"
            v-model="answerKeys.answerKeyArea"
            class="form-field__select"
            required
          >
            <option v-for="option in answerKeys.answerKeyAreaOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>

        <div v-if="importMode === 'area'" class="form-field">
          <label for="answer-key-identification" class="form-field__label">Archivo de identificación</label>
          <div class="file-input-wrapper">
            <input
              id="answer-key-identification"
              :ref="(el) => answerKeys.identificationInputRef = el"
              type="file"
              class="file-input"
              accept=".dat,.txt"
              @change="answerKeys.onAnswerKeyIdentificationChange"
              :required="importMode === 'area'"
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
          <label for="answer-key-responses" class="form-field__label">
            {{ importMode === 'general' ? 'Clave general (.dat)' : 'Archivo de respuestas correctas' }}
          </label>
          <div class="file-input-wrapper">
            <input
              id="answer-key-responses"
              :ref="(el) => answerKeys.responsesInputRef = el"
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
            Importar claves
          </button>
        </div>
      </form>
    </details>

    <div v-if="answerKeys.importError" class="alert alert--error">
      {{ answerKeys.importError }}
    </div>

    <input
      ref="detectFileInput"
      type="file"
      accept=".dat,.txt"
      style="display:none"
      @change="onDetectFileChange"
    >

    <section v-if="importMode === 'general'" class="detect-section">
      <div class="detect-section__info">
        <span class="detect-section__eyebrow">Formato de archivo</span>
        <p>Offset configurado: <strong>{{ configuredOffset }}</strong> (respuestas inician en posición {{ configuredOffset }})</p>
      </div>
      <div class="detect-section__actions">
        <button type="button" class="btn btn--ghost" :disabled="detecting" @click="handleDetectFormat">
          <svg v-if="detecting" class="btn__icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <svg v-else class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          {{ detecting ? 'Analizando...' : 'Detectar formato' }}
        </button>
        <span v-if="detectStatus" class="detect-badge" :class="`detect-badge--${detectStatus.variant}`">
          {{ detectStatus.label }}
        </span>
      </div>
    </section>

    <Toolbar
      v-model:search-value="answerKeys.search"
      search-placeholder="Buscar por área, tipo, litho o observaciones"
      :total-rows="answerKeys.totalRows"
      :filtered-count="answerKeys.filteredRows.length"
    >
      <template #actions>
        <details class="toolbar-menu">
          <summary class="btn btn--ghost">Acciones ▾</summary>
          <div class="toolbar-menu__panel">
        <button type="button" class="btn" @click="answerKeys.exportAnswerKeysToExcel" :disabled="!answerKeys.answerKeyHasData">
          Exportar a Excel
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="answerKeys.exportAnswerKeyObservationsToExcel"
          :disabled="!answerKeys.observationCount"
        >
          Observados Excel
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
          </div>
        </details>
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
        :rows="displayedRowsWithCounts"
        :selection="answerKeys.selection"
        :editing="answerKeys.editing"
        :is-all-selected="answerKeys.isAllVisibleSelected"
        :is-indeterminate="answerKeys.isSomeVisibleSelected"
        :row-class="getRowClass"
        :pagination="showOnlyObserved ? null : answerKeys.pagination"
        @toggle-selection="answerKeys.toggleSelection"
        @toggle-select-all="answerKeys.toggleSelectAll"
        @toggle-edit="answerKeys.toggleEdit"
        @remove-row="answerKeys.removeRow"
        @change-page="answerKeys.goToPage"
        @change-page-size="answerKeys.setPageSize"
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

/* ── Cobertura de áreas ──────────────────────────────────────────────────── */
.area-coverage {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.area-coverage__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.area-coverage__label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--slate-500);
}

.area-coverage__summary {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--slate-500);
  background: var(--slate-100);
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
}

.area-coverage__summary--ok {
  background: #dcfce7;
  color: #15803d;
}

.area-coverage__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.area-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.area-badge svg { width: 14px; height: 14px; flex-shrink: 0; }

.area-badge--ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.area-badge--missing {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.upload-form-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.upload-form-card__header {
  display: flex; align-items: center; gap: var(--space-3);
  cursor: pointer;
  list-style: none;
}
.upload-form-card__header::-webkit-details-marker { display: none; }
.upload-form-card__header::after { content: '＋'; margin-left: auto; color: var(--unap-blue-600); font-size: 1.1rem; }
.upload-form-card[open] .upload-form-card__header {
  margin-bottom: var(--space-4); padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--slate-100);
}
.upload-form-card[open] .upload-form-card__header::after { content: '−'; }
.upload-form-card__icon {
  width: 34px; height: 34px; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; border-radius: var(--radius-md);
  background: var(--unap-blue-50); color: var(--unap-blue-600);
}
.upload-form-card__icon svg { width: 17px; height: 17px; }
.upload-form-card__title { display: flex; flex-direction: column; line-height: 1.25; }
.upload-form-card__title strong { color: var(--slate-800); font-size: 0.9rem; }
.upload-form-card__title small { color: var(--slate-500); font-size: 0.73rem; }

.upload-form-grid {
  display: grid;
  grid-template-columns: minmax(140px, 0.65fr) minmax(220px, 1fr) minmax(220px, 1fr) auto;
  gap: var(--space-3);
  align-items: end;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-field--wide {
  grid-column: 1 / -1;
}

.form-field__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-field__hint {
  margin: 0;
  color: var(--slate-400);
  font-size: 0.74rem;
}

.form-field__select {
  width: 100%;
  height: 40px; padding: var(--space-2) var(--space-3);
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

.key-mode-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: var(--space-2);
  width: min(420px, 100%);
}

.key-mode-btn {
  border: 1px solid var(--slate-200);
  background: var(--slate-50);
  color: var(--slate-600);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.key-mode-btn:hover:not(:disabled) {
  border-color: var(--unap-blue-300);
  color: var(--unap-blue-700);
}

.key-mode-btn:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.key-mode-btn--active {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-400);
  color: var(--unap-blue-700);
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.08);
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
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.file-input-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 40px; padding: var(--space-2) var(--space-3);
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
  flex: 1; min-width: 0;
  font-size: 0.8rem;
  color: var(--slate-500);
  height: 40px; padding: var(--space-2);
  background: var(--slate-50);
  border-radius: var(--radius-sm);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.form-field--action {
  display: flex; align-items: flex-end; justify-content: flex-end;
}
.form-field--action .btn { height: 40px; white-space: nowrap; }

@media (max-width: 1100px) {
  .upload-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form-field--action { grid-column: 2; }
}
@media (max-width: 700px) {
  .upload-form-grid { grid-template-columns: 1fr; }
  .form-field--action { grid-column: 1; }
  .form-field--action .btn { width: 100%; }
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

.step-state-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.step-state-panel--info {
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-left: 4px solid var(--slate-400);
}

.step-state-panel--ok {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 4px solid #16a34a;
}

.step-state-panel--warn {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
}

.step-state-panel--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
}

.step-state-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.step-state-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.step-state-panel--info .step-state-panel__eyebrow {
  color: var(--slate-600);
}

.step-state-panel--ok .step-state-panel__eyebrow {
  color: #15803d;
}

.step-state-panel--warn .step-state-panel__eyebrow {
  color: #92400e;
}

.step-state-panel--error .step-state-panel__eyebrow {
  color: #b91c1c;
}

.step-state-panel h3 {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.3;
}

.step-state-panel--info h3 {
  color: var(--slate-700);
}

.step-state-panel--ok h3 {
  color: #14532d;
}

.step-state-panel--warn h3 {
  color: #78350f;
}

.step-state-panel--error h3 {
  color: #991b1b;
}

.step-state-panel__summary {
  flex-shrink: 0;
  padding: 3px var(--space-3);
  border-radius: var(--radius-full);
  background: white;
  color: #92400e;
  font-size: 0.78rem;
  font-weight: 800;
}

.step-state-panel--ok .step-state-panel__summary {
  color: #15803d;
}

.step-state-panel--info .step-state-panel__summary {
  color: var(--slate-600);
}

.step-state-panel--error .step-state-panel__summary {
  color: #b91c1c;
}

.step-state-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.step-state-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  border-radius: var(--radius-full);
  background: white;
  font-size: 0.76rem;
  font-weight: 700;
}

.step-state-panel--ok .step-state-chip,
.step-state-chip--ok {
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.step-state-panel--info .step-state-chip {
  border: 1px solid var(--slate-200);
  color: var(--slate-600);
}

.step-state-panel--warn .step-state-chip {
  border: 1px solid #fde68a;
  color: #92400e;
}

.step-state-panel--error .step-state-chip {
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.step-state-chip--missing {
  border-color: #fecaca;
  color: #b91c1c;
}

.step-state-chip strong {
  font-family: var(--font-mono);
}

.step-state-panel--ok .step-state-chip strong,
.step-state-chip--ok strong {
  color: #14532d;
}

.step-state-panel--info .step-state-chip strong {
  color: var(--slate-800);
}

.step-state-panel--warn .step-state-chip strong {
  color: #78350f;
}

.step-state-panel--error .step-state-chip strong {
  color: #991b1b;
}

.step-state-chip--missing strong {
  color: #991b1b;
}

.step-state-panel__hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.step-state-panel--ok .step-state-panel__hint {
  color: #15803d;
}

.step-state-panel--info .step-state-panel__hint {
  color: var(--slate-500);
}

.step-state-panel--warn .step-state-panel__hint {
  color: #92400e;
}

.step-state-panel--error .step-state-panel__hint {
  color: #b91c1c;
}

.reconciliation-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
}

.reconciliation-panel--ok {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 4px solid #16a34a;
}

.reconciliation-panel--warn {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
}

.reconciliation-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.reconciliation-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reconciliation-panel--ok .reconciliation-panel__eyebrow {
  color: #15803d;
}

.reconciliation-panel--warn .reconciliation-panel__eyebrow {
  color: #92400e;
}

.reconciliation-panel h3 {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.3;
}

.reconciliation-panel--ok h3 {
  color: #14532d;
}

.reconciliation-panel--warn h3 {
  color: #78350f;
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
  border-radius: var(--radius-full);
  background: white;
  font-size: 0.76rem;
  font-weight: 700;
}

.reconciliation-panel--ok .reconciliation-chip {
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.reconciliation-panel--warn .reconciliation-chip {
  border: 1px solid #fde68a;
  color: #92400e;
}

.reconciliation-chip strong {
  font-family: var(--font-mono);
}

.reconciliation-panel--ok .reconciliation-chip strong {
  color: #14532d;
}

.reconciliation-panel--warn .reconciliation-chip strong {
  color: #78350f;
}

.reconciliation-panel__hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.reconciliation-panel--ok .reconciliation-panel__hint {
  color: #15803d;
}

.reconciliation-panel--warn .reconciliation-panel__hint {
  color: #92400e;
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

.detect-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
}

.detect-section__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.detect-section__info p {
  margin: 0;
  color: var(--slate-700);
  font-size: 0.82rem;
}

.detect-section__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.detect-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.detect-badge--success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.detect-badge--warn {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.detect-badge--error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
