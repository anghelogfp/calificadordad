<script setup>
import { reactive } from 'vue'
import { formatTimestamp } from '@/utils/helpers'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  calification: { type: Object, required: true },
  ponderations: { type: Object, required: true },
  onSaveToHistory: { type: Function, default: null },
})

const calification = reactive(props.calification)
const ponderations = reactive(props.ponderations)

const emit = defineEmits(['openModal'])

function openModal() { emit('openModal') }

function handleSaveToHistory() {
  props.onSaveToHistory?.()
}

function handleNewProcess() {
  if (confirm('¿Iniciar un nuevo proceso? Los resultados actuales se guardarán en el historial si los has guardado antes.')) {
    calification.startNewProcess()
  }
}

function handleReset() {
  if (confirm('¿Limpiar todos los resultados actuales? Esta acción no se puede deshacer.')) {
    calification.resetCalificationResults()
  }
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

        <button
          v-if="calification.calificationHasResults && onSaveToHistory"
          type="button"
          class="btn btn--primary"
          @click="handleSaveToHistory"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"/>
          </svg>
          Guardar en historial
        </button>

        <button
          v-if="calification.calificationHasResults"
          type="button"
          class="btn btn--ghost"
          @click="handleNewProcess"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Nuevo proceso
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

    <!-- Resumen del área actual -->
    <div v-if="calification.calificationSummary" class="summary">
      <p><strong>Área:</strong> {{ calification.calificationSummary.area }}</p>
      <p><strong>Último cálculo:</strong> {{ formatTimestamp(calification.calificationSummary.timestamp) }}</p>
      <p><strong>Postulantes:</strong> {{ calification.calificationSummary.totalCandidates }}</p>
      <p>
        <strong>Ponderación:</strong>
        {{ calification.calificationSummary.totalWeight.toFixed(3) }} peso total ·
        {{ calification.calificationSummary.answersLength }} preguntas
      </p>

      <div v-if="calification.calificationSummary.unlinkedResponses > 0" class="alert alert--warning" style="grid-column: 1 / -1; margin-top: 0.5rem;">
        <strong>⚠ Atención:</strong> {{ calification.calificationSummary.unlinkedResponses }} respuestas sin DNI vinculado.
        <br><small>Carga el Paso 2 (Identificadores) para vincularlas.</small>
      </div>

      <p v-if="calification.calificationSummary.missingResponses">
        Sin respuesta: {{ calification.calificationSummary.missingResponses }}
      </p>
      <p v-if="calification.calificationSummary.missingKeys">
        Sin clave: {{ calification.calificationSummary.missingKeys }}
      </p>
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
            <th class="col-score">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in calification.calificationFilteredResults" :key="row.id">
            <td class="col-number">{{ index + 1 }}</td>
            <td class="mono">{{ row.dni }}</td>
            <td>{{ row.paterno || '—' }}</td>
            <td>{{ row.materno || '—' }}</td>
            <td>{{ row.nombres || '—' }}</td>
            <td class="col-score">
              <span class="score-badge">{{ row.score.toFixed(2) }}</span>
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

/* Area tabs */
.area-tabs {
  display: flex; gap: var(--space-2); flex-wrap: wrap;
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}

.area-tab {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: var(--slate-50);
  color: var(--slate-600);
  font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast);
}
.area-tab:hover { background: var(--unap-blue-50); border-color: var(--unap-blue-200); color: var(--unap-blue-700); }
.area-tab--active {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  border-color: var(--unap-blue-600);
  color: white;
}
.area-tab__count {
  background: rgba(255,255,255,0.25);
  border-radius: var(--radius-full);
  padding: 0 var(--space-2);
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px; text-align: center;
}
.area-tab:not(.area-tab--active) .area-tab__count {
  background: var(--slate-200);
  color: var(--slate-600);
}

/* Summary */
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, var(--slate-50) 100%);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.summary p { margin: 0; font-size: 0.9rem; color: var(--slate-700); }
.summary strong { color: var(--unap-blue-700); }

.alert {
  display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg); font-size: 0.9rem;
}
.alert--warning {
  background: var(--warning-50); color: var(--warning-600);
  border: 1px solid var(--warning-100);
}

/* Table */
.table-wrapper {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}
table { width: 100%; border-collapse: collapse; }
thead { background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%); }
th {
  padding: var(--space-4);
  text-align: left; font-weight: 600; color: white;
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;
}
td { padding: var(--space-3) var(--space-4); }
.col-number { width: 50px; text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--slate-400); }
.col-score { width: 100px; text-align: center; }
.mono { font-family: var(--font-mono); font-size: 0.875rem; }
tbody tr { border-bottom: 1px solid var(--slate-100); transition: background var(--transition-fast); }
tbody tr:nth-child(even) { background: var(--slate-50); }
tbody tr:hover { background: var(--unap-blue-50); }

.score-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.875rem;
}

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
}
</style>
