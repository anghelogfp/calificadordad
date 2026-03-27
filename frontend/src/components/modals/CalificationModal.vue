<script setup>
import { reactive } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  calification: { type: Object, required: true },
})

const calification = reactive(props.calification)

const emit = defineEmits(['close'])

function close() {
  emit('close')
}

function runCalification() {
  props.calification.runCalification()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="close">
      <div class="modal" aria-modal="true">
        <header class="modal__header">
          <div class="modal__title">
            <h2>Calcular Puntajes</h2>
            <p>Configura y ejecuta la calificación del área seleccionada</p>
          </div>
          <button type="button" class="modal__close" @click="close" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <form class="modal__body modal-form" @submit.prevent="runCalification">
          <div class="field">
            <label for="calification-area">Área a calificar</label>
            <select id="calification-area" v-model="calification.calificationArea" class="input" required>
              <option v-for="area in calification.calificationAreaOptions" :key="area" :value="area">
                {{ area }}
              </option>
            </select>
          </div>

          <div class="field">
            <label for="calification-set">Ponderación a aplicar</label>
            <select id="calification-set" v-model="calification.calificationPonderationArea" class="input" required>
              <option v-for="area in calification.calificationAreaOptions" :key="area" :value="area">
                {{ area }} ({{ calification.selectedPonderationTotals.questions }} preguntas)
              </option>
            </select>
          </div>

          <div class="scores-row">
            <div class="field">
              <label for="value-correct">Valor correcta</label>
              <input id="value-correct" v-model.number="calification.calificationCorrectValue" type="number" step="0.01" class="input input--sm" required />
            </div>
            <div class="field">
              <label for="value-incorrect">Valor incorrecta</label>
              <input id="value-incorrect" v-model.number="calification.calificationIncorrectValue" type="number" step="0.01" class="input input--sm" required />
            </div>
            <div class="field">
              <label for="value-blank">Valor en blanco</label>
              <input id="value-blank" v-model.number="calification.calificationBlankValue" type="number" step="0.01" class="input input--sm" required />
            </div>
          </div>

          <div v-if="!calification.selectedPonderationIsReady" class="info-banner">
            ⚠ Las ponderaciones del área no están completas. Ve al Paso 5 para configurarlas.
          </div>

          <div v-if="calification.calificationError" class="alert alert--error">
            {{ calification.calificationError }}
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn--ghost" @click="close">Cancelar</button>
            <button type="submit" class="btn btn--gold" :disabled="!calification.selectedPonderationIsReady">
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
  position: fixed; inset: 0;
  background: rgba(0, 29, 61, 0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-8); z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: min(560px, 100%);
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: scaleIn 0.3s ease-out;
  overflow: hidden;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
}

.modal__title h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
.modal__title p { font-size: 0.85rem; color: var(--unap-blue-200); margin: var(--space-1) 0 0; }

.modal__close {
  width: 36px; height: 36px; border: none; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.modal__close svg { width: 20px; height: 20px; }
.modal__close:hover { background: rgba(255,255,255,0.2); }

.modal__body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.scores-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.modal__footer {
  display: flex; justify-content: flex-end;
  gap: var(--space-3); padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--slate-200);
  background: var(--slate-50);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-size: 0.75rem; font-weight: 600; color: var(--slate-600);
  text-transform: uppercase; letter-spacing: 0.03em;
}

.input {
  padding: var(--space-3); border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); font-size: 0.9rem;
  background: var(--slate-50); transition: all var(--transition-fast);
}

.input--sm { padding: var(--space-2) var(--space-3); }

.input:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.info-banner {
  padding: var(--space-3) var(--space-4);
  background: #fff3cd; color: #856404;
  border: 1px solid #ffc107; border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.alert {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); font-size: 0.875rem;
}

.alert--error {
  background: var(--error-50); color: var(--error-700);
  border: 1px solid var(--error-200);
}

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-5);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
}

.btn__icon { width: 16px; height: 16px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900); box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255,255,255,0.3);
}
.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
}

.btn--ghost {
  background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200);
}
.btn--ghost:hover:not(:disabled) { background: var(--slate-50); border-color: var(--slate-300); }
</style>
