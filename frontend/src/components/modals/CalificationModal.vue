<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  calification: { type: Object, required: true },
  vacantesPrograma: { type: Object, required: true },
})

// Bloquear scroll del body cuando el modal está abierto
watch(() => props.show, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
}, { immediate: true })

const calification = reactive(props.calification)
const emit = defineEmits(['close'])

function close() { emit('close') }
function runCalification() { props.calification.runCalification() }

function getVacantes(programa) {
  return props.vacantesPrograma.vacantesPrograma.value[programa] ?? 0
}

function setVacantes(programa, val) {
  props.vacantesPrograma.setVacantes(programa, val)
}

function plantillaOptionLabel(p) {
  const ready = p.questionTotal === (calification.selectedPonderationTotals?.answersLength ?? p.questionTotal)
  return `${p.name}  (${p.questionTotal} pregs ${p.area ? '' : '· General '}${ready ? '✓' : '✗'})`
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

          <!-- Nombre del proceso -->
          <div class="field">
            <label for="process-name">
              Nombre del proceso
              <span class="field__hint">Se agrupa junto a las demás áreas que calcules</span>
            </label>
            <input
              id="process-name"
              v-model="calification.processName"
              type="text"
              class="input"
              placeholder="Ej: Admisión 2026 · Primera vuelta"
              maxlength="80"
              required
            />
          </div>

          <div class="field-divider"></div>

          <!-- Tipo de proceso -->
          <div class="field">
            <label>Tipo de proceso</label>
            <div class="process-type-toggle">
              <button
                type="button"
                class="type-btn"
                :class="{ 'type-btn--active': calification.processType === 'simulacro' }"
                @click="calification.processType = 'simulacro'"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
                </svg>
                Simulacro
                <span class="type-hint">Ranking general</span>
              </button>
              <button
                type="button"
                class="type-btn type-btn--real"
                :class="{ 'type-btn--active': calification.processType === 'real' }"
                @click="calification.processType = 'real'"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd"/>
                </svg>
                Convocatoria Real
                <span class="type-hint">Por carrera + vacantes</span>
              </button>
            </div>
          </div>

          <div class="field-divider"></div>

          <!-- Área a calificar -->
          <div class="field">
            <label for="calification-area">Área a calificar</label>
            <select id="calification-area" v-model="calification.calificationArea" class="input" required>
              <option v-for="area in calification.calificationAreaOptions" :key="area" :value="area">
                {{ area }}{{ calification.processAreas.includes(area) ? ' ✓ ya calculada' : '' }}
              </option>
            </select>
            <span v-if="calification.processAreas.includes(calification.calificationArea)" class="field__warning">
              Esta área ya tiene resultados. Al calcular se reemplazarán.
            </span>
          </div>

          <!-- Plantilla de ponderación -->
          <div class="field">
            <label for="calification-plantilla">
              Plantilla de ponderación
              <span class="field__hint">Receta de pesos por asignatura a aplicar</span>
            </label>
            <select
              id="calification-plantilla"
              v-model="calification.calificationPlantillaId"
              class="input"
              required
            >
              <option
                v-for="p in calification.availablePlantillas"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} ({{ p.questionTotal }} pregs{{ !p.area ? ' · General' : '' }})
              </option>
            </select>
            <span v-if="!calification.availablePlantillas.length" class="field__warning">
              No hay plantillas para esta área. Ve al Paso 5 para crearlas.
            </span>
          </div>

          <!-- Preview de la plantilla seleccionada -->
          <div
            v-if="calification.selectedCalificationPlantilla"
            class="plantilla-preview"
            :class="calification.selectedPonderationIsReady ? 'preview--ready' : 'preview--incomplete'"
          >
            <div class="preview__stat">
              <span class="preview__label">Preguntas</span>
              <span class="preview__value">{{ calification.selectedCalificationPlantilla.questionTotal }}</span>
            </div>
            <div class="preview__sep">·</div>
            <div class="preview__stat">
              <span class="preview__label">Asignaturas</span>
              <span class="preview__value">{{ (calification.selectedCalificationPlantilla.items || []).length }}</span>
            </div>
            <div class="preview__sep">·</div>
            <span
              class="preview__badge"
              :class="calification.selectedPonderationIsReady ? 'badge--ok' : 'badge--warn'"
            >
              {{ calification.selectedPonderationIsReady ? '✓ Lista' : '✗ Incompleta' }}
            </span>
          </div>

          <!-- Valores de calificación -->
          <div class="scores-row">
            <div class="field">
              <label for="value-correct">Correcta</label>
              <input id="value-correct" v-model.number="calification.calificationCorrectValue" type="number" step="0.01" class="input input--sm" required />
            </div>
            <div class="field">
              <label for="value-incorrect">Incorrecta</label>
              <input id="value-incorrect" v-model.number="calification.calificationIncorrectValue" type="number" step="0.01" class="input input--sm" required />
            </div>
            <div class="field">
              <label for="value-blank">En blanco</label>
              <input id="value-blank" v-model.number="calification.calificationBlankValue" type="number" step="0.01" class="input input--sm" required />
            </div>
          </div>

          <!-- Vacantes por programa -->
          <div v-if="calification.programasForCurrentArea.length > 0" class="vacantes-section">
            <div class="vacantes-header">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
              </svg>
              <span>Vacantes por programa</span>
              <span class="vacantes-hint">0 = sin límite</span>
            </div>
            <div class="vacantes-list">
              <div
                v-for="programa in calification.programasForCurrentArea"
                :key="programa"
                class="vacantes-row"
              >
                <span class="vacantes-programa">{{ programa }}</span>
                <input
                  type="number"
                  min="0"
                  class="vacantes-input"
                  :value="getVacantes(programa)"
                  @input="setVacantes(programa, $event.target.value)"
                />
              </div>
            </div>
          </div>

          <div v-if="!calification.selectedPonderationIsReady && calification.selectedCalificationPlantilla" class="info-banner">
            ⚠ La plantilla no está completa. Ve al Paso 5 para terminarla.
          </div>

          <!-- Pre-vuelo -->
          <div class="preflight">
            <div class="preflight__header">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span>Diagnóstico del área</span>
              <span
                class="preflight__badge"
                :class="calification.preflightCheck.hasBlockers ? 'badge--error'
                  : calification.preflightCheck.hasWarnings ? 'badge--warn' : 'badge--ok'"
              >
                {{ calification.preflightCheck.hasBlockers ? 'Con errores'
                  : calification.preflightCheck.hasWarnings ? 'Con advertencias' : 'Todo listo' }}
              </span>
            </div>
            <div class="preflight__items">
              <div
                v-for="item in calification.preflightCheck.items"
                :key="item.key"
                class="preflight__item"
                :class="`preflight__item--${item.status}`"
              >
                <svg v-if="item.status === 'ok'" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <svg v-else-if="item.status === 'warn'" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <svg v-else viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <div class="preflight__item-text">
                  <span class="preflight__item-label">{{ item.label }}</span>
                  <span class="preflight__item-value">{{ item.value }}</span>
                  <span v-if="item.detail" class="preflight__item-detail">{{ item.detail }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="calification.calificationError" class="alert alert--error">
            {{ calification.calificationError }}
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn--ghost" @click="close">Cancelar</button>
            <button
              type="submit"
              class="btn btn--gold"
              :disabled="!calification.selectedPonderationIsReady || calification.preflightCheck.hasBlockers"
            >
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
  display: flex; align-items: flex-start; justify-content: center;
  padding: var(--space-8);
  overflow-y: auto;
  z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: min(560px, 100%);
  margin: auto;
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
  transition: all var(--transition-fast); flex-shrink: 0;
}
.modal__close svg { width: 20px; height: 20px; }
.modal__close:hover { background: rgba(255,255,255,0.2); }

.modal__body { padding: var(--space-6); overflow-y: auto; flex: 1; min-height: 0; }
.modal-form { display: flex; flex-direction: column; gap: var(--space-4); }

.field-divider { height: 1px; background: var(--slate-200); margin: var(--space-1) 0; }

.scores-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.plantilla-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  border: 1px solid;
}

.preview--ready {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border-color: #b8dacc;
  color: #155724;
}

.preview--incomplete {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.preview__stat { display: flex; align-items: baseline; gap: var(--space-1); }
.preview__label { font-size: 0.75rem; opacity: 0.7; }
.preview__value { font-weight: 700; font-family: var(--font-mono); }
.preview__sep { opacity: 0.4; }

.preview__badge {
  margin-left: auto;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.badge--ok { background: #155724; color: white; }
.badge--warn { background: #856404; color: white; }
.badge--error { background: var(--error-600); color: white; }

/* ── Vacantes por programa ── */
.vacantes-section {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.vacantes-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vacantes-header svg { width: 14px; height: 14px; color: var(--unap-blue-500); }

.vacantes-hint {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--slate-400);
  text-transform: none;
  letter-spacing: 0;
}

.vacantes-list {
  max-height: 180px;
  overflow-y: auto;
}

.vacantes-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--slate-100);
}

.vacantes-row:last-child { border-bottom: none; }

.vacantes-programa {
  font-size: 0.82rem;
  color: var(--slate-700);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vacantes-input {
  width: 64px;
  padding: var(--space-1) var(--space-2);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: var(--font-mono);
  font-weight: 700;
  text-align: center;
  background: white;
  color: var(--unap-blue-800);
  transition: border-color var(--transition-fast);
  flex-shrink: 0;
}

.vacantes-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 2px rgba(0, 64, 128, 0.1);
}

/* ── Pre-vuelo ── */
.preflight {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preflight__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preflight__header svg { width: 14px; height: 14px; color: var(--unap-blue-500); }

.preflight__badge {
  margin-left: auto;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
}

.preflight__items {
  display: flex;
  flex-direction: column;
}

.preflight__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--slate-100);
  font-size: 0.82rem;
}

.preflight__item:last-child { border-bottom: none; }

.preflight__item svg { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }

.preflight__item--ok svg { color: var(--success-500); }
.preflight__item--warn svg { color: var(--warning-500); }
.preflight__item--error { background: var(--error-50); }
.preflight__item--error svg { color: var(--error-500); }

.preflight__item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
}

.preflight__item-label { color: var(--slate-600); font-weight: 500; }
.preflight__item-value { color: var(--slate-900); font-weight: 700; font-family: var(--font-mono); font-size: 0.8rem; }
.preflight__item-detail { color: var(--slate-500); font-size: 0.75rem; }

.modal__footer {
  display: flex; justify-content: flex-end;
  gap: var(--space-3); padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--slate-200);
  background: var(--slate-50);
}

.field { display: flex; flex-direction: column; gap: var(--space-1); }

.field label {
  font-size: 0.75rem; font-weight: 600; color: var(--slate-600);
  text-transform: uppercase; letter-spacing: 0.03em;
  display: flex; flex-direction: column; gap: 2px;
}

.field__hint {
  font-size: 0.7rem; font-weight: 400; color: var(--slate-400);
  text-transform: none; letter-spacing: 0;
}

.field__warning {
  font-size: 0.78rem;
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
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

.alert { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: 0.875rem; }
.alert--error { background: var(--error-50); color: var(--error-600); border: 1px solid var(--error-100); }

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

/* ── Tipo de proceso ── */
.process-type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-2);
  border: 2px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: var(--slate-50);
  color: var(--slate-500);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.type-btn svg { width: 20px; height: 20px; }

.type-btn:hover {
  border-color: var(--unap-blue-300);
  color: var(--unap-blue-700);
  background: var(--unap-blue-50);
}

.type-btn--active {
  border-color: var(--unap-blue-600);
  background: var(--unap-blue-700);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 64, 128, 0.25);
}

.type-btn--active.type-btn--real {
  border-color: var(--unap-gold-600);
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold);
}

.type-hint {
  font-size: 0.68rem;
  font-weight: 400;
  opacity: 0.8;
}
</style>
