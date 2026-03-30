<script setup>
import { reactive } from 'vue'
import SubTabs from '@/components/shared/SubTabs.vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  ponderations: { type: Object, required: true },
  answersLength: { type: Number, default: 60 },
})

const ponderations = reactive(props.ponderations)

function confirmRemovePonderation(row) {
  if (confirm(`¿Eliminar la asignatura "${row.subject}"?`)) {
    ponderations.removePonderationRow(row)
  }
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Ponderaciones por área"
      description="Configura el peso de cada asignatura en el cálculo de puntajes. La suma de preguntas debe ser igual al total configurado."
      variant="gold"
      :stats="ponderations.ponderationAreaList.map(a => ({
        value: ponderations.ponderationTotalsByArea.get(a)?.questions ?? 0,
        label: a
      }))"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <div class="ponderations-layout">
      <!-- Selector de área -->
      <div class="area-tabs-wrapper">
        <SubTabs
          :tabs="ponderations.ponderationAreaList.map(area => ({ key: area, label: area }))"
          :model-value="ponderations.ponderationModalArea"
          @update:model-value="ponderations.ponderationModalArea = $event"
          variant="default"
        />
      </div>

      <!-- Totales del área -->
      <div class="area-totals" :class="{ 'totals--ready': ponderations.ponderationCurrentTotals.questions === answersLength, 'totals--warning': ponderations.ponderationCurrentTotals.questions !== answersLength }">
        <span class="totals__item">
          <span class="totals__label">Preguntas</span>
          <span class="totals__value">{{ ponderations.ponderationCurrentTotals.questions }}/{{ answersLength }}</span>
        </span>
        <span class="totals__sep">·</span>
        <span class="totals__item">
          <span class="totals__label">Peso total</span>
          <span class="totals__value">{{ ponderations.ponderationCurrentTotals.weight.toFixed(3) }}</span>
        </span>
        <span v-if="ponderations.ponderationCurrentTotals.questions === answersLength" class="totals__badge totals__badge--ok">
          ✓ Listo
        </span>
        <span v-else class="totals__badge totals__badge--pending">
          {{ answersLength - ponderations.ponderationCurrentTotals.questions > 0 ? `Faltan ${answersLength - ponderations.ponderationCurrentTotals.questions}` : `Excede ${ponderations.ponderationCurrentTotals.questions - answersLength}` }}
        </span>
      </div>

      <!-- Info Modo Simple -->
      <div class="simple-mode-info-banner">
        <svg viewBox="0 0 20 20" fill="currentColor" class="simple-mode-info-icon">
          <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clip-rule="evenodd"/>
        </svg>
        <p>
          <strong>¿Sin asignaturas?</strong> Puedes omitir este paso. Al calificar, selecciona
          <strong>Modo Simple</strong> en el modal y el puntaje se calculará directamente
          con los valores de correcta / incorrecta / en blanco.
        </p>
      </div>

      <!-- Formulario para agregar asignatura -->
      <div class="add-form-wrapper">
        <h3 class="section-title">Agregar asignatura</h3>
        <form class="add-form" @submit.prevent="ponderations.addPonderationRow">
          <div class="field">
            <label for="pond-subject">Asignatura</label>
            <input
              id="pond-subject"
              v-model="ponderations.newPonderation.subject"
              type="text"
              class="input"
              placeholder="Nombre de la asignatura"
              required
            />
          </div>
          <div class="field">
            <label for="pond-count">N° preguntas</label>
            <input
              id="pond-count"
              v-model.number="ponderations.newPonderation.questionCount"
              type="number"
              min="1"
              step="1"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label for="pond-weight">Ponderación</label>
            <input
              id="pond-weight"
              v-model.number="ponderations.newPonderation.ponderation"
              type="number"
              min="0"
              step="0.001"
              class="input"
              required
            />
          </div>
          <button type="submit" class="btn btn--primary">
            <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
            </svg>
            Agregar
          </button>
        </form>
        <div v-if="ponderations.ponderationError" class="alert alert--error">
          {{ ponderations.ponderationError }}
        </div>
        <div v-if="ponderations.ponderationApiError" class="alert alert--warning">
          API: {{ ponderations.ponderationApiError }}
        </div>
      </div>

      <!-- Tabla de ponderaciones -->
      <div class="table-wrapper">
        <div class="table-header">
          <span>{{ ponderations.ponderationCurrentAreaRows.length }} asignaturas en {{ ponderations.ponderationModalArea }}</span>
        </div>

        <EmptyState
          v-if="!ponderations.ponderationCurrentAreaRows.length"
          title="Sin asignaturas"
          description="Agrega asignaturas usando el formulario de arriba."
          icon="add"
        />

        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th>Asignatura</th>
                <th class="col-num">Preguntas</th>
                <th class="col-num">Ponderación</th>
                <th class="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in ponderations.ponderationCurrentAreaRows" :key="row.id">
                <td class="col-num">{{ row.order }}</td>
                <td>
                  <input v-if="ponderations.isPonderationEditing(row.id)" type="text" class="cell-input" v-model="row.subject" />
                  <span v-else>{{ row.subject || '—' }}</span>
                </td>
                <td class="col-num">
                  <input v-if="ponderations.isPonderationEditing(row.id)" type="number" class="cell-input cell-input--sm" min="0" step="1" v-model.number="row.questionCount" />
                  <span v-else>{{ row.questionCount }}</span>
                </td>
                <td class="col-num">
                  <input v-if="ponderations.isPonderationEditing(row.id)" type="number" class="cell-input cell-input--sm" step="0.001" v-model.number="row.ponderation" />
                  <span v-else>{{ row.ponderation.toFixed(3) }}</span>
                </td>
                <td class="col-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    @click="ponderations.togglePonderationEditRow(row)"
                    :title="ponderations.isPonderationEditing(row.id) ? 'Guardar' : 'Editar'"
                  >
                    <svg viewBox="0 0 24 24">
                      <path v-if="ponderations.isPonderationEditing(row.id)" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                      <path v-else d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04-2.92-2.92a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.03 0-1.42Z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    @click="confirmRemovePonderation(row)"
                    title="Eliminar"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" fill="currentColor"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
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

.ponderations-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.area-tabs-wrapper {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}

.area-totals {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
  border: 1px solid;
  flex-wrap: wrap;
}

.totals--ready {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border-color: #b8dacc;
  color: #155724;
}

.totals--warning {
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, var(--slate-50) 100%);
  border-color: var(--unap-blue-100);
  color: var(--slate-700);
}

.totals__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.totals__label {
  font-size: 0.8rem;
  opacity: 0.7;
}

.totals__value {
  font-weight: 700;
  font-family: var(--font-mono);
}

.totals__sep {
  opacity: 0.4;
}

.totals__badge {
  margin-left: auto;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
}

.totals__badge--ok {
  background: #155724;
  color: white;
}

.totals__badge--pending {
  background: var(--unap-blue-700);
  color: white;
}

.add-form-wrapper {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
}

.add-form {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: var(--space-3);
  align-items: end;
}

@media (max-width: 768px) {
  .add-form {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: var(--slate-50);
  transition: all var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.table-wrapper {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-header {
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200);
  font-size: 0.85rem;
  color: var(--slate-600);
  font-weight: 500;
}

.table-scroll {
  max-height: 500px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  position: sticky;
  top: 0;
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  z-index: 1;
}

th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

td {
  padding: var(--space-3) var(--space-4);
  font-size: 0.875rem;
  border-bottom: 1px solid var(--slate-100);
}

tbody tr:hover { background: var(--slate-50); }
tbody tr:last-child td { border-bottom: none; }

.col-num {
  width: 80px;
  text-align: center;
  font-family: var(--font-mono);
}

.col-actions {
  width: 90px;
  text-align: center;
}

td.col-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

.cell-input {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--unap-blue-300);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  background: white;
}

.cell-input--sm {
  max-width: 80px;
}

.cell-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.15);
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--slate-600);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-btn svg { width: 16px; height: 16px; }
.icon-btn:hover { background: var(--unap-blue-50); color: var(--unap-blue-600); border-color: var(--unap-blue-200); }
.icon-btn--danger { color: var(--error-500); border-color: var(--error-100); }
.icon-btn--danger:hover { background: var(--error-50); border-color: var(--error-200); color: var(--error-600); }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
  align-self: end;
}

.btn__icon { width: 16px; height: 16px; }
.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; box-shadow: var(--shadow-sm);
}
.btn--primary:hover {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px); box-shadow: var(--shadow-md);
}

.alert {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}
.alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
.alert--warning { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }

.simple-mode-info-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: linear-gradient(135deg, #fefdf0 0%, #fef9e7 100%);
  border: 1px solid var(--unap-gold-300, #d4af37);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
}

.simple-mode-info-icon {
  width: 18px;
  height: 18px;
  color: var(--unap-gold-600, #b8860b);
  flex-shrink: 0;
  margin-top: 2px;
}

.simple-mode-info-banner p {
  font-size: 0.875rem;
  color: var(--slate-700);
  margin: 0;
  line-height: 1.5;
}
</style>
