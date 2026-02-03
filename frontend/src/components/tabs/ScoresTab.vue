<script setup>
import { formatTimestamp } from '@/utils/helpers'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  calification: {
    type: Object,
    required: true
  },
  ponderations: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['openModal'])

function openModal(tab) {
  emit('openModal', tab)
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Calificación Final"
      description="Genera los puntajes aplicando las ponderaciones a las respuestas de los postulantes."
      variant="gold"
      :stats="calification.calificationHasResults ? [{ value: calification.calificationResults.length, label: 'Calificados' }] : []"
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
        <button type="button" class="btn btn--primary" @click="openModal('ponderaciones')">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
          </svg>
          Gestionar Ponderaciones
        </button>
        <button type="button" class="btn btn--gold" @click="openModal('calificar')" :disabled="!calification.canCalify">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          Calcular Puntajes
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
          Limpiar resultados
        </button>
      </template>
      <template #metrics>
        <span class="metric">
          <span class="metric__value">{{ ponderations.ponderationCurrentTotals.questions }}/60</span>
          <span class="metric__label">preguntas</span>
        </span>
      </template>
    </Toolbar>

    <div v-if="calification.calificationSummary" class="summary">
      <p><strong>Área:</strong> {{ calification.calificationSummary.area }}</p>
      <p><strong>Último cálculo:</strong> {{ formatTimestamp(calification.calificationSummary.timestamp) }}</p>
      <p><strong>Postulantes:</strong> {{ calification.calificationSummary.totalCandidates }}</p>
      <p>
        <strong>Ponderación aplicada:</strong>
        {{ calification.calificationPonderationArea }} ·
        {{ calification.selectedPonderationTotals.questions }}/60 preguntas ·
        peso {{ calification.selectedPonderationTotals.weight.toFixed(2) }}
      </p>

      <div v-if="calification.calificationSummary.unlinkedResponses > 0" class="alert alert--error" style="grid-column: 1 / -1; margin-top: 0.5rem;">
        <strong>⚠ Atención:</strong> Se detectaron {{ calification.calificationSummary.unlinkedResponses }} respuestas sin DNI vinculado.
        <br>
        <small>
          Esto ocurre cuando no se ha cargado el <strong>Paso 2 (Identificadores)</strong> o los códigos de lectura no coinciden.
          Sin identificación, estas respuestas NO se pueden asignar a ningún postulante.
        </small>
      </div>

      <p v-if="calification.calificationSummary.missingResponses">
        Respuestas pendientes: {{ calification.calificationSummary.missingResponses }}
        <span v-if="calification.calificationSummary.unlinkedResponses > 0" class="text-sm text-gray-500">
          (probablemente debido a las {{ calification.calificationSummary.unlinkedResponses }} respuestas sin vincular)
        </span>
      </p>
      <p v-if="calification.calificationSummary.missingKeys">Claves faltantes: {{ calification.calificationSummary.missingKeys }}</p>
    </div>

    <section class="table-wrapper" v-if="calification.calificationHasResults">
      <table>
        <thead>
          <tr>
            <th class="col-number">#</th>
            <th>DNI</th>
            <th>Apellido paterno</th>
            <th>Apellido materno</th>
            <th>Nombres</th>
            <th>Puntaje</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in calification.calificationFilteredResults" :key="row.id">
            <td class="col-number">{{ index + 1 }}</td>
            <td>{{ row.dni }}</td>
            <td>{{ row.paterno || '—' }}</td>
            <td>{{ row.materno || '—' }}</td>
            <td>{{ row.nombres || '—' }}</td>
            <td>{{ row.score.toFixed(2) }}</td>
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
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, var(--slate-50) 100%);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.summary p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--slate-700);
}

.summary strong {
  color: var(--unap-blue-700);
}

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
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

td {
  padding: var(--space-3) var(--space-4);
}

.col-number {
  width: 50px;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--slate-400);
}

tbody tr {
  border-bottom: 1px solid var(--slate-100);
  transition: background var(--transition-fast);
}

tbody tr:nth-child(even) {
  background: var(--slate-50);
}

tbody tr:hover {
  background: var(--unap-blue-50);
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

.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(212, 175, 55, 0.4);
}

.metric {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--slate-100);
  border-radius: var(--radius-sm);
}

.metric__value {
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--slate-800);
}

.metric__label {
  font-size: 0.75rem;
  color: var(--slate-500);
}
</style>
