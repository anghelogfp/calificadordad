<script setup>
import { computed } from 'vue'
import { formatTimestamp } from '@/utils/helpers'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  calification: { type: Object, required: true },
  ponderations: { type: Object, required: true },
  dashboard: { type: Object, required: true },
  answersLength: { type: Number, default: 60 },
  convocatoriaName: { type: String, default: '' },
})

const emit = defineEmits(['openCalificationModal', 'exportExcel', 'exportPdf'])

const rankedResults = computed(() => props.dashboard.rankedResults)
const globalSummary = computed(() => props.dashboard.globalSummary)
const statsByArea = computed(() => props.dashboard.statsByArea)
const scoreDistribution = computed(() => props.dashboard.scoreDistribution)
const maxDistCount = computed(() => Math.max(...(scoreDistribution.value?.map((b) => b.count) || [1]), 1))

const showDashboard = computed(() => rankedResults.value.length > 0)
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Resultados de Calificación"
      description="Tabla de puntajes con ranking, estado de ingresante y exportación."
      variant="gold"
      :stats="calification.calificationHasResults ? [
        { value: calification.calificationResults.length, label: 'Calificados' },
        { value: dashboard.globalSummary?.ingresantes ?? 0, label: 'Ingresantes' },
      ] : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <Toolbar
      v-model:search-value="calification.calificationSearch.value"
      search-placeholder="Buscar por DNI o nombres"
      :total-rows="calification.calificationResults.length"
      :filtered-count="calification.calificationFilteredResults.length"
    >
      <template #actions>
        <button type="button" class="btn btn--gold" @click="emit('openCalificationModal')" :disabled="!calification.canCalify">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clip-rule="evenodd"/>
          </svg>
          Calcular Puntajes
        </button>
        <button
          type="button"
          class="btn btn--primary"
          @click="emit('exportExcel')"
          :disabled="!calification.calificationHasResults"
          title="Exportar a Excel"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Excel
        </button>
        <button
          type="button"
          class="btn btn--primary"
          @click="emit('exportPdf')"
          :disabled="!calification.calificationHasResults"
          title="Exportar a PDF"
        >
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
          </svg>
          PDF
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          @click="calification.resetCalificationResults"
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
          <span class="metric__value">{{ ponderations.ponderationCurrentTotals.questions }}/{{ answersLength }}</span>
          <span class="metric__label">preguntas</span>
        </span>
      </template>
    </Toolbar>

    <!-- Resumen de la calificación -->
    <div v-if="calification.calificationSummary" class="summary-grid">
      <div class="summary-card">
        <span class="summary-card__label">Área calificada</span>
        <span class="summary-card__value">{{ calification.calificationSummary.area }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">Fecha</span>
        <span class="summary-card__value summary-card__value--sm">{{ formatTimestamp(calification.calificationSummary.timestamp) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">Total postulantes</span>
        <span class="summary-card__value">{{ calification.calificationSummary.totalCandidates }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">Valores usados</span>
        <span class="summary-card__value summary-card__value--sm">
          ✓{{ calification.calificationSummary.correctValue }}
          ✗{{ calification.calificationSummary.incorrectValue }}
          ·{{ calification.calificationSummary.blankValue }}
        </span>
      </div>

      <div v-if="calification.calificationSummary.unlinkedResponses > 0" class="summary-alert summary-alert--error">
        <strong>⚠ Atención:</strong> {{ calification.calificationSummary.unlinkedResponses }} respuestas sin DNI vinculado.
        Carga el <strong>Paso 2 (Identificadores)</strong> o verifica que los códigos coincidan.
      </div>
      <div v-if="calification.calificationSummary.missingResponses" class="summary-alert summary-alert--warning">
        {{ calification.calificationSummary.missingResponses }} postulantes sin respuesta encontrada.
      </div>
      <div v-if="calification.calificationSummary.missingKeys" class="summary-alert summary-alert--warning">
        {{ calification.calificationSummary.missingKeys }} postulantes sin clave de respuesta para su tipo.
      </div>
    </div>

    <!-- Dashboard de estadísticas -->
    <div v-if="showDashboard" class="dashboard">
      <h3 class="dashboard__title">Estadísticas</h3>

      <!-- Resumen global -->
      <div v-if="globalSummary" class="stats-row">
        <div class="stat-pill">
          <span class="stat-pill__num">{{ globalSummary.total }}</span>
          <span class="stat-pill__lbl">Total</span>
        </div>
        <div class="stat-pill stat-pill--green">
          <span class="stat-pill__num">{{ globalSummary.ingresantes }}</span>
          <span class="stat-pill__lbl">Ingresantes</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill__num">{{ globalSummary.avg }}</span>
          <span class="stat-pill__lbl">Promedio</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill__num">{{ globalSummary.max }}</span>
          <span class="stat-pill__lbl">Máximo</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill__num">{{ globalSummary.min }}</span>
          <span class="stat-pill__lbl">Mínimo</span>
        </div>
      </div>

      <!-- Distribución de puntajes -->
      <div v-if="scoreDistribution.length" class="chart">
        <div class="chart__title">Distribución de puntajes</div>
        <div class="chart__bars">
          <div
            v-for="bucket in scoreDistribution"
            :key="bucket.range"
            class="chart__bar-wrap"
          >
            <div class="chart__bar" :style="{ height: `${Math.max(4, (bucket.count / maxDistCount) * 80)}px` }">
              <span class="chart__count">{{ bucket.count }}</span>
            </div>
            <span class="chart__range">{{ bucket.range }}</span>
          </div>
        </div>
      </div>

      <!-- Stats por área -->
      <div v-if="statsByArea.size" class="area-stats">
        <div v-for="[area, stats] in statsByArea" :key="area" class="area-stat-card">
          <div class="area-stat-card__name">{{ area }}</div>
          <div class="area-stat-card__grid">
            <span><strong>{{ stats.count }}</strong> postulantes</span>
            <span><strong>{{ stats.ingresantes }}</strong> ingresantes</span>
            <span>Prom: <strong>{{ stats.avg }}</strong></span>
            <span>Máx: <strong>{{ stats.max }}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla de resultados -->
    <section class="table-wrapper" v-if="calification.calificationHasResults">
      <table>
        <thead>
          <tr>
            <th class="col-pos">Pos.</th>
            <th>DNI</th>
            <th>Apellido Paterno</th>
            <th>Apellido Materno</th>
            <th>Nombres</th>
            <th class="col-score">Puntaje</th>
            <th class="col-estado">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in (rankedResults.length ? rankedResults : calification.calificationFilteredResults)"
            :key="row.id"
            :class="{ 'row--ingresante': row.isIngresante }"
          >
            <td class="col-pos">{{ row.position || '#' }}</td>
            <td>{{ row.dni }}</td>
            <td>{{ row.paterno || '—' }}</td>
            <td>{{ row.materno || '—' }}</td>
            <td>{{ row.nombres || '—' }}</td>
            <td class="col-score">{{ row.score.toFixed(2) }}</td>
            <td class="col-estado">
              <span v-if="row.isIngresante" class="badge badge--ingresante">INGRESANTE</span>
              <span v-else-if="row.position > 0" class="badge badge--no">NO INGRESANTE</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <EmptyState
      v-else
      title="Sin resultados de calificación"
      description="Ejecuta una calificación para ver la tabla de puntajes."
      icon="time"
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
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, var(--slate-50) 100%);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.summary-card__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--unap-blue-600);
}

.summary-card__value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  font-family: var(--font-mono);
}

.summary-card__value--sm { font-size: 0.875rem; }

.summary-alert {
  grid-column: 1 / -1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.summary-alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
.summary-alert--warning { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }

/* Dashboard */
.dashboard {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.dashboard__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
}

.stats-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  min-width: 80px;
}

.stat-pill--green { background: #d4edda; border-color: #b8dacc; }

.stat-pill__num {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--slate-800);
  line-height: 1;
}

.stat-pill__lbl {
  font-size: 0.7rem;
  color: var(--slate-500);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--space-1);
}

/* Chart */
.chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chart__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--slate-600);
}

.chart__bars {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  height: 100px;
  padding: var(--space-2) 0;
}

.chart__bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 30px;
}

.chart__bar {
  width: 100%;
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-700) 100%);
  border-radius: 3px 3px 0 0;
  position: relative;
  transition: height 0.4s ease;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.chart__count {
  font-size: 0.65rem;
  font-weight: 700;
  color: white;
  padding-top: 2px;
}

.chart__range {
  font-size: 0.6rem;
  color: var(--slate-500);
  text-align: center;
  white-space: nowrap;
}

/* Area stats */
.area-stats {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.area-stat-card {
  flex: 1;
  min-width: 200px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
}

.area-stat-card__name {
  font-weight: 700;
  color: var(--unap-blue-700);
  margin-bottom: var(--space-2);
}

.area-stat-card__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
  font-size: 0.8rem;
  color: var(--slate-600);
}

/* Results Table */
.table-wrapper {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
}

th {
  padding: var(--space-4);
  text-align: left;
  font-weight: 600;
  color: white;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

td {
  padding: var(--space-3) var(--space-4);
  font-size: 0.875rem;
}

.col-pos {
  width: 60px;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--slate-500);
}

.col-score {
  font-family: var(--font-mono);
  font-weight: 700;
  text-align: right;
}

.col-estado {
  text-align: center;
  width: 140px;
}

tbody tr {
  border-bottom: 1px solid var(--slate-100);
  transition: background var(--transition-fast);
}

tbody tr:nth-child(even) { background: var(--slate-50); }
tbody tr:hover { background: var(--unap-blue-50); }
tbody tr.row--ingresante { background: #f0fdf4 !important; }
tbody tr.row--ingresante:hover { background: #dcfce7 !important; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.badge--ingresante {
  background: #155724;
  color: white;
}

.badge--no {
  background: var(--slate-200);
  color: var(--slate-600);
}

/* Toolbar buttons */
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

.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900); box-shadow: var(--shadow-gold);
}
.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
}

.btn--ghost {
  background: transparent; color: var(--slate-600);
  border: 1px solid var(--slate-200);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--slate-50); border-color: var(--slate-300); color: var(--slate-800);
}

.metric {
  display: flex; align-items: baseline; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--slate-100); border-radius: var(--radius-sm);
}
.metric__value { font-weight: 700; font-family: var(--font-mono); color: var(--slate-800); }
.metric__label { font-size: 0.75rem; color: var(--slate-500); }
</style>
