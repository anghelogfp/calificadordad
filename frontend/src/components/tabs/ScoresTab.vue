<script setup>
import { reactive, ref, computed } from 'vue'
import { formatTimestamp } from '@/utils/helpers'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  calification: { type: Object, required: true },
  ponderations: { type: Object, required: true },
  dashboard: { type: Object, required: true },
  exporter: { type: Object, required: true },
  convocatoriaName: { type: String, default: '' },
  onSaveToHistory: { type: Function, default: null },
})

const calification = reactive(props.calification)
const ponderations = reactive(props.ponderations)

const emit = defineEmits(['openModal', 'openDashboard'])

function openModal() { emit('openModal') }

// ── Guardar con nombre editable ──────────────────────────────────────────────

const savingName = ref(false)
const saveNameInput = ref('')

function handleSaveToHistory() {
  saveNameInput.value = props.convocatoriaName || calification.activeProcessName || ''
  savingName.value = true
}

function confirmSaveName() {
  props.onSaveToHistory?.(saveNameInput.value.trim() || saveNameInput.value)
  savingName.value = false
}

function cancelSaveName() {
  savingName.value = false
}

// ── Confirmación inline ──────────────────────────────────────────────────────

const pendingAction = ref(null)

function handleNewProcess() {
  pendingAction.value = {
    type: 'newProcess',
    message: '¿Iniciar un nuevo proceso? Los resultados actuales quedarán en el historial solo si los guardaste antes.',
  }
}

function handleReset() {
  pendingAction.value = {
    type: 'reset',
    message: '¿Limpiar todos los resultados? Esta acción no se puede deshacer.',
  }
}

function confirmPendingAction() {
  if (pendingAction.value?.type === 'newProcess') calification.startNewProcess()
  if (pendingAction.value?.type === 'reset') calification.resetCalificationResults()
  pendingAction.value = null
}

function cancelPendingAction() {
  pendingAction.value = null
}

// ── Dashboard stats del área actual ─────────────────────────────────────────

const currentAreaStats = computed(() => {
  const area = calification.calificationDisplayArea
  if (!area) return null
  return props.dashboard.statsByArea.value?.get(area) ?? null
})

const hasIngresanteData = computed(() =>
  (currentAreaStats.value?.ingresantes ?? 0) > 0
)

// ── Filtros locales ──────────────────────────────────────────────────────────

const filterPrograma = ref('')
const filterEstado = ref('todos') // 'todos' | 'ingresante' | 'no-ingresante'

const programasEnArea = computed(() => {
  const set = new Set()
  calification.calificationResults.forEach((r) => {
    if (r.programa) set.add(r.programa)
  })
  return Array.from(set).sort()
})

const localFilteredResults = computed(() => {
  let rows = calification.calificationFilteredResults
  if (filterPrograma.value) {
    rows = rows.filter((r) => r.programa === filterPrograma.value)
  }
  if (filterEstado.value === 'ingresante') {
    rows = rows.filter((r) => r.isIngresante)
  } else if (filterEstado.value === 'no-ingresante') {
    rows = rows.filter((r) => !r.isIngresante)
  }
  return rows
})

const hasActiveFilters = computed(() => filterPrograma.value || filterEstado.value !== 'todos')

function clearFilters() {
  filterPrograma.value = ''
  filterEstado.value = 'todos'
}

// ── Export ───────────────────────────────────────────────────────────────────

function handleExportExcel() {
  props.exporter.exportScoresToExcel(
    localFilteredResults.value,
    props.convocatoriaName
  )
}

function handleExportPdf() {
  props.exporter.exportScoresToPdf(
    localFilteredResults.value,
    { statsByArea: props.dashboard.statsByArea.value },
    props.convocatoriaName
  )
}

function handleExportIngresantesPdf() {
  props.exporter.exportIngresantesPdf(
    localFilteredResults.value,
    { statsByArea: props.dashboard.statsByArea.value },
    props.convocatoriaName
  )
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Calificación Final"
      description="Genera los puntajes aplicando las ponderaciones a las respuestas de los postulantes."
      variant="gold"
      :stats="calification.calificationHasResults
        ? calification.processAreas.map(area => ({
            value: (calification.activeProcess?.areas?.[area]?.results?.length ?? 0),
            label: area
          }))
        : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <!-- Toolbar -->
    <Toolbar
      v-model:search-value="calification.calificationSearch"
      search-placeholder="Buscar por DNI o nombres"
      :total-rows="calification.calificationResults.length"
      :filtered-count="calification.calificationFilteredResults.length"
    >
      <template #actions>
        <button type="button" class="btn btn--gold" @click="openModal" :disabled="!calification.canCalify">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          Calcular Puntajes
        </button>

        <!-- Dashboard -->
        <button
          v-if="calification.calificationHasResults"
          type="button"
          class="btn btn--ghost"
          @click="emit('openDashboard')"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
          </svg>
          Estadísticas
        </button>

        <!-- Export buttons — solo con resultados -->
        <template v-if="calification.calificationHasResults">
          <button type="button" class="btn btn--outline-green" @click="handleExportExcel">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Excel
          </button>
          <button type="button" class="btn btn--outline-red" @click="handleExportPdf">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            PDF
          </button>
          <button
            v-if="hasIngresanteData"
            type="button"
            class="btn btn--primary"
            @click="handleExportIngresantesPdf"
          >
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd"/>
            </svg>
            PDF Ingresantes
          </button>
        </template>

        <template v-if="calification.calificationHasResults && onSaveToHistory">
          <!-- Input inline de nombre -->
          <template v-if="savingName">
            <input
              v-model="saveNameInput"
              type="text"
              class="save-name-input"
              placeholder="Nombre del proceso..."
              @keyup.enter="confirmSaveName"
              @keyup.escape="cancelSaveName"
              autofocus
            />
            <button type="button" class="btn btn--primary" @click="confirmSaveName">Confirmar</button>
            <button type="button" class="btn btn--ghost" @click="cancelSaveName">Cancelar</button>
          </template>
          <!-- Botón normal -->
          <button v-else type="button" class="btn btn--primary" @click="handleSaveToHistory">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"/>
            </svg>
            Guardar
          </button>
        </template>

        <button
          v-if="calification.calificationHasResults"
          type="button"
          class="btn btn--ghost"
          @click="handleNewProcess"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Nuevo
        </button>

        <button
          type="button"
          class="btn btn--ghost"
          @click="handleReset"
          :disabled="!calification.calificationHasResults"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
          Limpiar
        </button>
      </template>
      <template #metrics>
        <span class="metric">
          <span class="metric__value">{{ ponderations.ponderationCurrentTotals.questions }}/60</span>
          <span class="metric__label">preguntas</span>
        </span>
      </template>
    </Toolbar>

    <!-- Nombre del proceso activo -->
    <div v-if="calification.calificationHasResults" class="process-name-bar">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd"/>
      </svg>
      <span class="process-name-bar__label">Proceso:</span>
      <span class="process-name-bar__name">{{ calification.processName || 'Sin nombre' }}</span>
    </div>

    <!-- Banner de confirmación inline -->
    <div v-if="pendingAction" class="confirm-banner">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span>{{ pendingAction.message }}</span>
      <div class="confirm-banner__actions">
        <button type="button" class="btn btn--ghost btn--sm" @click="cancelPendingAction">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" @click="confirmPendingAction">Confirmar</button>
      </div>
    </div>

    <!-- Tabs de áreas calculadas -->
    <div v-if="calification.processAreas.length > 1" class="area-tabs">
      <button
        v-for="area in calification.processAreas"
        :key="area"
        type="button"
        class="area-tab"
        :class="{ 'area-tab--active': calification.calificationDisplayArea === area }"
        @click="calification.switchDisplayArea(area)"
      >
        {{ area }}
        <span class="area-tab__count">
          {{ calification.activeProcess?.areas?.[area]?.results?.length ?? 0 }}
        </span>
      </button>
    </div>

    <!-- Panel de estadísticas del área actual -->
    <div v-if="calification.calificationSummary" class="stats-panel">
      <!-- Fila 1: stats numéricas -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-card__value">{{ calification.calificationSummary.totalCandidates }}</span>
          <span class="stat-card__label">Postulantes</span>
        </div>
        <div class="stat-card stat-card--green" v-if="currentAreaStats">
          <span class="stat-card__value">{{ currentAreaStats.ingresantes }}</span>
          <span class="stat-card__label">Ingresantes</span>
        </div>
        <div class="stat-card stat-card--red" v-if="currentAreaStats">
          <span class="stat-card__value">{{ currentAreaStats.count - currentAreaStats.ingresantes }}</span>
          <span class="stat-card__label">No ingresantes</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.max.toFixed(2) }}</span>
          <span class="stat-card__label">Puntaje máx.</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.avg.toFixed(2) }}</span>
          <span class="stat-card__label">Promedio</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.min.toFixed(2) }}</span>
          <span class="stat-card__label">Puntaje mín.</span>
        </div>
      </div>

      <!-- Fila 2: meta del proceso -->
      <div class="stats-meta">
        <span>
          <strong>Área:</strong> {{ calification.calificationSummary.area }}
        </span>
        <span>
          <strong>Cálculo:</strong> {{ formatTimestamp(calification.calificationSummary.timestamp) }}
        </span>
        <span>
          <strong>Ponderación:</strong>
          {{ calification.calificationSummary.totalWeight.toFixed(3) }} peso ·
          {{ calification.calificationSummary.answersLength }} preguntas
        </span>
        <span v-if="calification.calificationSummary.missingResponses" class="meta-warn">
          Sin respuesta: {{ calification.calificationSummary.missingResponses }}
        </span>
        <span v-if="calification.calificationSummary.missingKeys" class="meta-warn">
          Sin clave: {{ calification.calificationSummary.missingKeys }}
        </span>
      </div>

      <div v-if="calification.calificationSummary.unlinkedResponses > 0" class="alert alert--warning">
        <strong>Atención:</strong> {{ calification.calificationSummary.unlinkedResponses }} respuestas sin DNI vinculado.
        <small> Carga el Paso 2 (Identificadores) para vincularlas.</small>
      </div>
    </div>

    <!-- Filtros -->
    <div v-if="calification.calificationHasResults" class="filter-bar">
      <div class="filter-bar__left">
        <!-- Filtro programa -->
        <div class="filter-group">
          <label class="filter-label">Programa</label>
          <select v-model="filterPrograma" class="filter-select">
            <option value="">Todos los programas</option>
            <option v-for="prog in programasEnArea" :key="prog" :value="prog">{{ prog }}</option>
          </select>
        </div>

        <!-- Filtro estado -->
        <div v-if="hasIngresanteData" class="filter-group">
          <label class="filter-label">Estado</label>
          <div class="filter-toggle">
            <button type="button" class="filter-toggle__btn" :class="{ active: filterEstado === 'todos' }" @click="filterEstado = 'todos'">Todos</button>
            <button type="button" class="filter-toggle__btn filter-toggle__btn--green" :class="{ active: filterEstado === 'ingresante' }" @click="filterEstado = 'ingresante'">Ingresantes</button>
            <button type="button" class="filter-toggle__btn filter-toggle__btn--red" :class="{ active: filterEstado === 'no-ingresante' }" @click="filterEstado = 'no-ingresante'">No ingresantes</button>
          </div>
        </div>
      </div>

      <div class="filter-bar__right">
        <span class="filter-count">
          <strong>{{ localFilteredResults.length }}</strong> de {{ calification.calificationResults.length }}
        </span>
        <button v-if="hasActiveFilters" type="button" class="btn-clear-filters" @click="clearFilters">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          Limpiar filtros
        </button>
      </div>
    </div>

    <!-- Tabla de resultados -->
    <section class="table-wrapper" v-if="calification.calificationHasResults">
      <table>
        <thead>
          <tr>
            <th class="col-number">#</th>
            <th>DNI</th>
            <th>Ap. Paterno</th>
            <th>Ap. Materno</th>
            <th>Nombres</th>
            <th>Programa</th>
            <th class="col-score">Puntaje</th>
            <th v-if="hasIngresanteData" class="col-status">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in localFilteredResults"
            :key="row.id"
            :class="{ 'row--ingresante': row.isIngresante }"
          >
            <td class="col-number">{{ row.position }}</td>
            <td class="mono">{{ row.dni }}</td>
            <td>{{ row.paterno || '—' }}</td>
            <td>{{ row.materno || '—' }}</td>
            <td>{{ row.nombres || '—' }}</td>
            <td class="col-programa">{{ row.programa || '—' }}</td>
            <td class="col-score">
              <span class="score-badge" :class="{ 'score-badge--ingresante': row.isIngresante }">
                {{ row.score.toFixed(2) }}
              </span>
            </td>
            <td v-if="hasIngresanteData" class="col-status">
              <span class="status-chip" :class="row.isIngresante ? 'status-chip--in' : 'status-chip--out'">
                {{ row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <EmptyState
      v-else
      title="Sin resultados de calificación"
      description="Haz clic en 'Calcular Puntajes' para ejecutar la calificación con las ponderaciones configuradas."
      icon="time"
    />
  </section>
</template>

<style scoped>
.tab-content {
  display: flex; flex-direction: column; gap: var(--space-6);
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Nombre del proceso activo */
.process-name-bar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, var(--unap-gold-50) 0%, #fefdf0 100%);
  border: 1px solid var(--unap-gold-200);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
}
.process-name-bar svg { width: 16px; height: 16px; color: var(--unap-gold-600); flex-shrink: 0; }
.process-name-bar__label { font-weight: 600; color: var(--unap-gold-600); }
.process-name-bar__name { color: var(--unap-blue-800); font-weight: 700; }

/* Input nombre al guardar */
.save-name-input {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--unap-blue-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  width: 220px;
  outline: none;
}
.save-name-input:focus { border-color: var(--unap-blue-500); box-shadow: 0 0 0 2px var(--unap-blue-100); }

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

/* Area tabs */
.area-tabs {
  display: flex; gap: var(--space-2); flex-wrap: wrap;
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg); padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}
.area-tab {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: var(--slate-50); color: var(--slate-600);
  font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast);
}
.area-tab:hover { background: var(--unap-blue-50); border-color: var(--unap-blue-200); color: var(--unap-blue-700); }
.area-tab--active {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  border-color: var(--unap-blue-600); color: white;
}
.area-tab__count {
  background: rgba(255,255,255,0.25); border-radius: var(--radius-full);
  padding: 0 var(--space-2); font-size: 0.75rem; font-weight: 700;
  min-width: 20px; text-align: center;
}
.area-tab:not(.area-tab--active) .area-tab__count { background: var(--slate-200); color: var(--slate-600); }

/* Stats panel */
.stats-panel {
  display: flex; flex-direction: column; gap: var(--space-3);
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex; flex-direction: column; gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50); border: 1px solid var(--slate-100);
  border-radius: var(--radius-lg); text-align: center;
}
.stat-card--green { background: #f0fdf4; border-color: #bbf7d0; }
.stat-card--green .stat-card__value { color: #15803d; }
.stat-card--red { background: #fef2f2; border-color: #fecaca; }
.stat-card--red .stat-card__value { color: #b91c1c; }

.stat-card__value {
  font-size: 1.5rem; font-weight: 800; color: var(--unap-blue-800);
  line-height: 1;
}
.stat-card__value.mono { font-family: var(--font-mono); font-size: 1.25rem; }
.stat-card__label {
  font-size: 0.7rem; font-weight: 600; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.05em;
}

.stats-meta {
  display: flex; flex-wrap: wrap; gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--slate-100);
  font-size: 0.85rem; color: var(--slate-600);
}
.stats-meta strong { color: var(--unap-blue-700); }
.meta-warn { color: var(--warning-600); font-weight: 600; }

.alert {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); font-size: 0.875rem;
}
.alert--warning { background: var(--warning-50); color: var(--warning-700); border: 1px solid var(--warning-200); }

/* Filter bar */
.filter-bar {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--space-4); flex-wrap: wrap;
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-sm);
}
.filter-bar__left { display: flex; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; }
.filter-bar__right { display: flex; align-items: center; gap: var(--space-3); }

.filter-group { display: flex; flex-direction: column; gap: var(--space-1); }
.filter-label {
  font-size: 0.7rem; font-weight: 700; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em;
}

.filter-select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.85rem; color: var(--slate-700); background: var(--slate-50);
  cursor: pointer; min-width: 200px; max-width: 280px;
  transition: border-color var(--transition-fast);
}
.filter-select:focus { outline: none; border-color: var(--unap-blue-400); background: white; }

.filter-toggle { display: flex; border: 1px solid var(--slate-200); border-radius: var(--radius-md); overflow: hidden; }
.filter-toggle__btn {
  padding: var(--space-1) var(--space-3); font-size: 0.8rem; font-weight: 600;
  border: none; background: var(--slate-50); color: var(--slate-500);
  cursor: pointer; transition: all var(--transition-fast); white-space: nowrap;
}
.filter-toggle__btn + .filter-toggle__btn { border-left: 1px solid var(--slate-200); }
.filter-toggle__btn.active { background: var(--unap-blue-600); color: white; }
.filter-toggle__btn--green.active { background: #16a34a; }
.filter-toggle__btn--red.active { background: #dc2626; }
.filter-toggle__btn:not(.active):hover { background: var(--slate-100); color: var(--slate-700); }

.filter-count {
  font-size: 0.82rem; color: var(--slate-500);
  padding: var(--space-1) var(--space-2);
  background: var(--slate-100); border-radius: var(--radius-md);
}
.filter-count strong { color: var(--unap-blue-700); }

.btn-clear-filters {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3); font-size: 0.8rem; font-weight: 600;
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: white; color: var(--slate-500); cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-clear-filters svg { width: 12px; height: 12px; }
.btn-clear-filters:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

/* Table */
.table-wrapper {
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-md);
}
table { width: 100%; border-collapse: collapse; }
thead { background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%); }
th {
  padding: var(--space-4); text-align: left; font-weight: 600; color: white;
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;
}
td { padding: var(--space-3) var(--space-4); }
.col-number { width: 50px; text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--slate-500); }
.col-programa { font-size: 0.82rem; color: var(--slate-500); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-score { width: 100px; text-align: center; }
.col-status { width: 130px; text-align: center; }
.mono { font-family: var(--font-mono); font-size: 0.875rem; }
tbody tr { border-bottom: 1px solid var(--slate-100); transition: background var(--transition-fast); }
tbody tr:nth-child(even) { background: var(--slate-50); }
tbody tr:hover { background: var(--unap-blue-50); }
tbody tr.row--ingresante { background: #f0fdf4; }
tbody tr.row--ingresante:hover { background: #dcfce7; }

.score-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full); font-family: var(--font-mono);
  font-weight: 700; font-size: 0.875rem;
}
.score-badge--ingresante {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
}

.status-chip {
  display: inline-block; padding: 2px 8px;
  border-radius: var(--radius-full); font-size: 0.7rem;
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
.status-chip--in { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.status-chip--out { background: var(--slate-100); color: var(--slate-500); border: 1px solid var(--slate-200); }

/* Botones */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
}
.btn__icon { width: 16px; height: 16px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; box-shadow: var(--shadow-sm);
}
.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px); box-shadow: var(--shadow-md);
}
.btn--ghost {
  background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200);
}
.btn--ghost:hover:not(:disabled) { background: var(--slate-50); border-color: var(--slate-300); color: var(--slate-800); }
.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
}
.btn--outline-green {
  background: transparent; color: #16a34a;
  border: 1px solid #86efac;
}
.btn--outline-green:hover { background: #f0fdf4; border-color: #4ade80; }

.btn--outline-red {
  background: transparent; color: #dc2626;
  border: 1px solid #fca5a5;
}
.btn--outline-red:hover { background: #fef2f2; border-color: #f87171; }

.btn--danger { background: var(--error-600); color: white; }
.btn--danger:hover { background: var(--error-700); }
.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }

.metric {
  display: flex; align-items: baseline; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--slate-100); border-radius: var(--radius-sm);
}
.metric__value { font-weight: 700; font-family: var(--font-mono); color: var(--slate-800); }
.metric__label { font-size: 0.75rem; color: var(--slate-500); }

@media (max-width: 768px) {
  .table-wrapper { overflow-x: auto; }
  table { min-width: 600px; }
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
