<script setup>
import SubTabs from '@/components/shared/SubTabs.vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  modalTab: {
    type: String,
    required: true
  },
  ponderations: {
    type: Object,
    required: true
  },
  calification: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'update:modalTab', 'runCalification'])

function close() {
  emit('close')
}

function updateModalTab(tab) {
  emit('update:modalTab', tab)
}

function runCalification() {
  emit('runCalification')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="close">
      <div class="modal" aria-modal="true">
        <header class="modal__header">
          <div class="modal__title">
            <h2>Calificación de Examen</h2>
            <p>Gestiona ponderaciones y calcula puntajes</p>
          </div>
          <button type="button" class="modal__close" @click="close" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <SubTabs
          :tabs="[
            { key: 'ponderaciones', label: 'Ponderaciones' },
            { key: 'calificar', label: 'Calificar' }
          ]"
          :model-value="modalTab"
          @update:model-value="updateModalTab"
          variant="modal"
          aria-label="Pestañas de calificación"
        />

        <!-- Tab Ponderaciones -->
        <div v-if="modalTab === 'ponderaciones'" class="modal__body">
          <section class="ponderations-panel">
            <header class="sources-header">
              <div>
                <h3>Ponderaciones por área</h3>
                <p>Gestiona las ponderaciones oficiales y ajustes manuales para cada curso.</p>
              </div>
              <div class="sources-counts">
                <span>Área activa: {{ ponderations.ponderationModalArea }}</span>
                <span>Preguntas: {{ ponderations.ponderationCurrentTotals.questions }}/60</span>
                <span>Peso total: {{ ponderations.ponderationCurrentTotals.weight.toFixed(2) }}</span>
              </div>
            </header>

            <SubTabs
              :tabs="ponderations.ponderationAreaList.map(area => ({ key: area, label: area }))"
              :model-value="ponderations.ponderationModalArea"
              @update:model-value="ponderations.ponderationModalArea = $event"
              variant="modal"
              aria-label="Áreas de ponderación"
            />

            <div class="ponderations-actions">
              <form class="modal-form" @submit.prevent="ponderations.addPonderationRow">
                <div class="field">
                  <label for="ponderation-subject">Asignatura</label>
                  <input
                    id="ponderation-subject"
                    v-model="ponderations.newPonderation.subject"
                    type="text"
                    class="input"
                    placeholder="Nombre de la asignatura"
                    required
                  />
                </div>
                <div class="field">
                  <label for="ponderation-count">Cantidad de preguntas</label>
                  <input
                    id="ponderation-count"
                    v-model.number="ponderations.newPonderation.questionCount"
                    type="number"
                    min="1"
                    step="1"
                    class="input"
                    required
                  />
                </div>
                <div class="field">
                  <label for="ponderation-weight">Ponderación</label>
                  <input
                    id="ponderation-weight"
                    v-model.number="ponderations.newPonderation.ponderation"
                    type="number"
                    min="0"
                    step="0.001"
                    class="input"
                    required
                  />
                </div>
                <button type="submit" class="btn">Agregar</button>
              </form>
              <p class="modal-hint">
                Preguntas registradas: {{ ponderations.ponderationCurrentTotals.questions }}/60 · peso acumulado
                {{ ponderations.ponderationCurrentTotals.weight.toFixed(2) }}
              </p>
              <div v-if="ponderations.ponderationError" class="alert alert--error">
                {{ ponderations.ponderationError }}
              </div>
            </div>

            <section class="table-wrapper modal-table-wrapper ponderation-table-container">
              <div class="table-header-info">
                <span>Total de cursos: {{ ponderations.ponderationCurrentAreaRows.length }}</span>
              </div>
              <div class="table-scroll-wrapper">
                <table class="modal-table">
                  <thead>
                    <tr>
                      <th class="col-number">#</th>
                      <th>Asignatura</th>
                      <th>Preguntas</th>
                      <th>Ponderación</th>
                      <th class="actions-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in ponderations.ponderationCurrentAreaRows" :key="row.id">
                      <td class="col-number">{{ row.order }}</td>
                      <td>
                        <template v-if="ponderations.isPonderationEditing(row.id)">
                          <input type="text" class="cell-input" v-model="row.subject" />
                        </template>
                        <span v-else>{{ row.subject || '—' }}</span>
                      </td>
                      <td>
                        <template v-if="ponderations.isPonderationEditing(row.id)">
                          <input type="number" class="cell-input" min="0" step="1" v-model.number="row.questionCount" />
                        </template>
                        <span v-else>{{ row.questionCount }}</span>
                      </td>
                      <td>
                        <template v-if="ponderations.isPonderationEditing(row.id)">
                          <input type="number" class="cell-input" step="0.001" v-model.number="row.ponderation" />
                        </template>
                        <span v-else>{{ row.ponderation.toFixed(3) }}</span>
                      </td>
                      <td class="actions-cell">
                        <div class="sources-actions">
                          <button
                            type="button"
                            class="icon-button"
                            @click="ponderations.togglePonderationEditRow(row)"
                            :aria-label="ponderations.isPonderationEditing(row.id) ? 'Guardar fila' : 'Editar fila'"
                            title="Editar"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                v-if="ponderations.isPonderationEditing(row.id)"
                                d="M19 13H5v-2h14v2Z"
                                fill="currentColor"
                              />
                              <path
                                v-else
                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04-2.92-2.92a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.03 0-1.42Z"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="icon-button icon-button--danger"
                            @click="ponderations.removePonderationRow(row)"
                            aria-label="Eliminar fila"
                            title="Eliminar"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>

        <!-- Tab Calificar -->
        <form v-if="modalTab === 'calificar'" class="modal__body modal-form" @submit.prevent="runCalification">
          <div class="field">
            <label for="calification-area">Área</label>
            <select id="calification-area" v-model="calification.calificationArea.value" class="input" required>
              <option v-for="area in calification.calificationAreaOptions" :key="area" :value="area">
                {{ area }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="calification-set">Ponderación</label>
            <select id="calification-set" v-model="calification.calificationPonderationArea.value" class="input" required>
              <option v-for="area in calification.calificationAreaOptions" :key="area" :value="area">
                {{ area }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="value-correct">Valor respuesta correcta</label>
            <input
              id="value-correct"
              v-model.number="calification.calificationCorrectValue.value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label for="value-incorrect">Valor respuesta incorrecta</label>
            <input
              id="value-incorrect"
              v-model.number="calification.calificationIncorrectValue.value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label for="value-blank">Valor respuesta en blanco</label>
            <input
              id="value-blank"
              v-model.number="calification.calificationBlankValue.value"
              type="number"
              step="0.01"
              class="input"
              required
            />
          </div>

          <div v-if="calification.calificationError" class="alert alert--error modal-alert">
            {{ calification.calificationError }}
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn--ghost" @click="close">Cancelar</button>
            <button type="submit" class="btn btn--primary">
              <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clip-rule="evenodd"/>
              </svg>
              Calcular Puntajes
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 29, 61, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: min(1000px, 100%);
  max-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: scaleIn 0.3s ease-out;
  overflow: hidden;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
}

.modal__title h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.modal__title p {
  font-size: 0.85rem;
  color: var(--unap-blue-200);
  margin: var(--space-1) 0 0;
}

.modal__close {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.modal__close svg {
  width: 20px;
  height: 20px;
}

.modal__close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal__body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--slate-200);
  background: var(--slate-50);
}

.ponderations-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.ponderations-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sources-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.sources-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
}

.sources-header p {
  font-size: 0.85rem;
  color: var(--slate-500);
  margin: var(--space-1) 0 0;
}

.sources-counts {
  display: flex;
  gap: var(--space-4);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--slate-700);
}

.modal-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  align-items: end;
}

.modal-hint {
  margin: 0;
  color: var(--unap-blue-600);
  font-weight: 600;
  font-size: 0.9rem;
}

.modal-table-wrapper {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.ponderation-table-container {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: white;
}

.ponderation-table-container .table-header-info {
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200);
  font-size: 0.85rem;
  color: var(--slate-600);
  font-weight: 500;
}

.ponderation-table-container .table-scroll-wrapper {
  max-height: 400px;
  overflow-y: auto;
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
}

.modal-table th,
.modal-table td {
  padding: var(--space-3) var(--space-4);
  font-size: 0.9rem;
  border-bottom: 1px solid var(--slate-100);
}

.modal-table th {
  background: var(--unap-blue-50);
  text-align: left;
  font-weight: 600;
  color: var(--unap-blue-700);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.modal-table tbody tr:hover {
  background: var(--slate-50);
}

.modal-alert {
  grid-column: 1 / -1;
}

.col-number {
  width: 50px;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--slate-400);
}

.actions-header {
  width: 120px;
}

.actions-cell {
  display: flex;
  gap: var(--space-2);
}

.sources-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.input {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-200);
  font-size: 0.9rem;
  min-width: 200px;
  transition: all var(--transition-fast);
  background: var(--slate-50);
}

.input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.cell-input {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  background: white;
  transition: all var(--transition-fast);
}

.cell-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.1);
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

.icon-button {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-200);
  background: white;
  color: var(--slate-600);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.icon-button:hover {
  background: var(--unap-blue-50);
  color: var(--unap-blue-600);
  border-color: var(--unap-blue-200);
}

.icon-button--danger {
  border-color: var(--error-100);
  color: var(--error-500);
}

.icon-button--danger:hover {
  background: var(--error-50);
  border-color: var(--error-200);
  color: var(--error-600);
}
</style>
