<script setup>
import { ref, watch, computed } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps({
  show:           { type: Boolean, required: true },
  hasData:        { type: Boolean, default: false },
  areasCount:     { type: Number,  default: 0 },
  plantillasCount:{ type: Number,  default: 0 },
})

const emit = defineEmits(['confirm', 'close'])

const modalRef = ref(null)
useFocusTrap(modalRef, computed(() => props.show))

const name = ref('')
const processPath = ref('')
const submitted = ref(false)
const shaking = ref(false)

const nameError = computed(() => submitted.value && !name.value.trim() ? 'El nombre es obligatorio' : '')
const processPathError = computed(() =>
  submitted.value && !processPath.value
    ? 'Selecciona el camino del proceso'
    : ''
)

const selectedPath = computed(() => {
  if (processPath.value === 'simulacro-general') {
    return { type: 'simulacro', simulacroScope: 'general' }
  }
  if (processPath.value === 'simulacro-areas') {
    return { type: 'simulacro', simulacroScope: 'areas' }
  }
  if (processPath.value === 'real') {
    return { type: 'real', simulacroScope: '' }
  }
  return { type: '', simulacroScope: '' }
})

watch(() => props.show, (val) => {
  if (val) {
    name.value = ''
    processPath.value = ''
    submitted.value = false
    shaking.value = false
  }
})

function confirm() {
  submitted.value = true
  if (!name.value.trim() || processPathError.value) {
    shaking.value = true
    setTimeout(() => { shaking.value = false }, 400)
    return
  }
  emit('confirm', {
    name: name.value.trim(),
    type: selectedPath.value.type,
    simulacroScope: selectedPath.value.simulacroScope,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <div ref="modalRef" class="modal" role="dialog" aria-modal="true">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <h2>Nuevo proceso de calificación</h2>
              <p>Elige cómo se calcularán claves, ponderaciones y resultados</p>
            </div>
            <button type="button" class="modal-close" @click="emit('close')">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Nombre -->
            <div class="field" :class="{ 'field--error': nameError, 'field--shake': shaking && nameError }">
              <label class="field-label" for="proc-name">
                Nombre del proceso
                <span class="field-required">*</span>
              </label>
              <div class="input-wrap">
                <input
                  id="proc-name"
                  v-model="name"
                  type="text"
                  class="input"
                  :class="{ 'input--error': nameError, 'input--ok': submitted && name.trim() }"
                  placeholder="Ej: Simulacro Marzo 2026 · Biomédicas"
                  maxlength="120"
                  @keyup.enter="confirm"
                  autofocus
                />
                <span v-if="submitted && name.trim()" class="input-icon input-icon--ok">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                </span>
                <span v-else-if="nameError" class="input-icon input-icon--err">
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </span>
              </div>
              <div class="field-footer">
                <span v-if="nameError" class="field-error">{{ nameError }}</span>
                <span v-else class="field-hint">Usa un nombre claro para ubicarlo luego en historial.</span>
                <span class="field-counter" :class="{ 'field-counter--warn': name.length > 100 }">
                  {{ name.length }}/120
                </span>
              </div>
            </div>

            <div class="field" :class="{ 'field--error': processPathError, 'field--shake': shaking && processPathError }">
              <label class="field-label">
                Camino del proceso
                <span class="field-required">*</span>
              </label>
              <div class="path-options">
                <button
                  type="button"
                  class="path-option"
                  :class="{ 'path-option--active': processPath === 'simulacro-general' }"
                  @click="processPath = 'simulacro-general'"
                >
                  <span class="path-option__radio">
                    <span v-if="processPath === 'simulacro-general'" class="path-option__dot" />
                  </span>
                  <div class="path-option__info">
                    <span class="path-option__eyebrow">Simulacro</span>
                    <span class="path-option__name">Simulacro general</span>
                    <span class="path-option__desc">Una clave general y ranking general para todos los postulantes.</span>
                  </div>
                  <span class="path-option__badge">Clave general</span>
                </button>
                <button
                  type="button"
                  class="path-option"
                  :class="{ 'path-option--active': processPath === 'simulacro-areas' }"
                  @click="processPath = 'simulacro-areas'"
                >
                  <span class="path-option__radio">
                    <span v-if="processPath === 'simulacro-areas'" class="path-option__dot" />
                  </span>
                  <div class="path-option__info">
                    <span class="path-option__eyebrow">Simulacro</span>
                    <span class="path-option__name">Simulacro por áreas</span>
                    <span class="path-option__desc">Claves por área y ranking separado por área de evaluación.</span>
                  </div>
                  <span class="path-option__badge">Por áreas</span>
                </button>
                <button
                  type="button"
                  class="path-option path-option--real"
                  :class="{ 'path-option--active': processPath === 'real' }"
                  @click="processPath = 'real'"
                >
                  <span class="path-option__radio">
                    <span v-if="processPath === 'real'" class="path-option__dot" />
                  </span>
                  <div class="path-option__info">
                    <span class="path-option__eyebrow">Proceso oficial</span>
                    <span class="path-option__name">Convocatoria real</span>
                    <span class="path-option__desc">Claves por área/tipo, vacantes, ranking por carrera e ingresantes.</span>
                  </div>
                  <span class="path-option__badge">Área + tipo</span>
                </button>
              </div>
              <span v-if="processPathError" class="field-error">{{ processPathError }}</span>
            </div>

            <div class="setup-summary">
              <span class="setup-summary__label">Configuración disponible</span>
              <div class="setup-summary__items">
                <span :class="areasCount > 0 ? 'setup-summary__item--ok' : 'setup-summary__item--warn'">
                  {{ areasCount > 0 ? `${areasCount} área(s)` : 'Sin áreas' }}
                </span>
                <span :class="plantillasCount > 0 ? 'setup-summary__item--ok' : 'setup-summary__item--warn'">
                  {{ plantillasCount > 0 ? `${plantillasCount} plantilla(s)` : 'Sin plantillas' }}
                </span>
              </div>
            </div>

            <!-- Advertencia si hay datos -->
            <div v-if="hasData" class="warning-row">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Se limpiarán los datos del proceso actual (padrón, respuestas y claves cargadas).
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button type="button" class="btn btn--ghost" @click="emit('close')">Cancelar</button>
            <button type="button" class="btn btn--primary" @click="confirm">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
              Iniciar proceso
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  background: rgba(0, 20, 51, 0.55);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);
  overflow-y: auto;
}

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 620px;
  max-height: calc(100vh - 32px);
  box-shadow: 0 24px 64px rgba(0, 20, 51, 0.25);
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700), var(--unap-blue-800));
  color: white;
  flex-shrink: 0;
}

.modal-header__icon {
  width: 40px; height: 40px; flex-shrink: 0;
  background: rgba(255,255,255,0.15);
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
}
.modal-header__icon svg { width: 20px; height: 20px; }
.modal-header h2 { font-size: 1rem; font-weight: 700; margin: 0; }
.modal-header p  { font-size: 0.78rem; color: var(--unap-blue-200); margin: 2px 0 0; }

.modal-close {
  margin-left: auto; flex-shrink: 0;
  width: 32px; height: 32px; border: none;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.modal-close svg { width: 16px; height: 16px; }
.modal-close:hover { background: rgba(255,255,255,0.2); }

/* Body */
.modal-body {
  padding: var(--space-5) var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-4);
  min-height: 0;
  overflow-y: auto;
}

.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 0.78rem; font-weight: 700; color: var(--slate-600);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.field-hint { font-size: 0.75rem; color: var(--slate-400); }

.input-wrap { position: relative; }

.input {
  width: 100%;
  padding: var(--space-2) 2.2rem var(--space-2) var(--space-3);
  border: 1.5px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.9rem; background: white;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }

.input--error { border-color: var(--error-500) !important; background: var(--error-50); }
.input--error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12) !important; }
.input--ok { border-color: var(--success-500); }
.input--ok:focus { box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }

.input-icon {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; pointer-events: none;
}
.input-icon--ok { color: var(--success-500); }
.input-icon--err { color: var(--error-500); }

.field-footer {
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--space-2);
}

.field-error {
  font-size: 0.75rem; color: var(--error-600); font-weight: 500;
  animation: fadeIn 0.2s ease;
}

.field-required { color: var(--error-500); margin-left: 2px; }

.field-counter {
  font-size: 0.72rem; color: var(--slate-400);
  margin-left: auto; flex-shrink: 0;
}
.field-counter--warn { color: var(--warning-600); font-weight: 600; }

/* Shake en error */
.field--shake { animation: fieldShake 0.35s ease; }

@keyframes fieldShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

/* Path options */
.path-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.path-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-4);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.path-option:hover {
  border-color: var(--unap-blue-300);
  background: #f8fbff;
}

.path-option--active {
  border-color: var(--unap-blue-500);
  background: var(--unap-blue-50);
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.08);
}

.path-option--real.path-option--active {
  border-color: var(--unap-gold-500);
  background: #fffdf7;
  box-shadow: 0 0 0 3px rgba(217, 160, 41, 0.12);
}

.path-option__radio {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
  border: 2px solid var(--slate-300);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
}

.path-option--active .path-option__radio {
  border-color: var(--unap-blue-500);
}

.path-option--real.path-option--active .path-option__radio {
  border-color: var(--unap-gold-500);
}

.path-option__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--unap-blue-500);
}

.path-option--real .path-option__dot {
  background: var(--unap-gold-500);
}

.path-option__info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.path-option__eyebrow {
  color: var(--slate-400);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.path-option__name {
  color: var(--slate-900);
  font-size: 0.96rem;
  font-weight: 800;
}

.path-option__desc {
  color: var(--slate-500);
  font-size: 0.8rem;
  line-height: 1.4;
}

.path-option__badge {
  flex-shrink: 0;
  margin-top: 1px;
  padding: 4px var(--space-2);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: white;
  color: var(--unap-blue-700);
  font-size: 0.7rem;
  font-weight: 800;
  white-space: nowrap;
}

.path-option--real .path-option__badge {
  color: #78350f;
}

.setup-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: var(--slate-50);
}

.setup-summary__label {
  color: var(--slate-500);
  font-size: 0.76rem;
  font-weight: 700;
}

.setup-summary__items {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.setup-summary__items span {
  padding: 3px var(--space-2);
  border-radius: var(--radius-full);
  background: white;
  font-size: 0.72rem;
  font-weight: 800;
}

.setup-summary__item--ok { color: var(--success-600); }
.setup-summary__item--warn { color: #b45309; }

/* Warning */
.warning-row {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #fffbeb; border: 1px solid #fcd34d;
  border-radius: var(--radius-md);
  font-size: 0.8rem; color: #92400e; line-height: 1.4;
}
.warning-row svg { flex-shrink: 0; margin-top: 1px; color: #d97706; }

/* Footer */
.modal-footer {
  display: flex; justify-content: flex-end; gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--slate-100);
  background: var(--slate-50);
  flex-shrink: 0;
}

.btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-5); border: none;
  border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.btn--primary { background: linear-gradient(135deg, var(--unap-blue-600), var(--unap-blue-700)); color: white; }
.btn--primary:hover { background: linear-gradient(135deg, var(--unap-blue-500), var(--unap-blue-600)); }
.btn--ghost { background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-fade-leave-active .modal { transition: transform 0.15s ease; }
.modal-fade-enter-from .modal { transform: scale(0.93) translateY(8px); }
.modal-fade-leave-to .modal { transform: scale(0.96); }

@media (max-width: 640px) {
  .modal-overlay { align-items: flex-start; overflow-y: auto; }
  .modal { max-width: 100%; }
  .modal-header { padding: var(--space-4); }
  .modal-body { padding: var(--space-4); }
  .modal-footer { padding: var(--space-4); }
  .path-option { flex-wrap: wrap; }
  .path-option__badge { margin-left: 32px; }
  .setup-summary { align-items: flex-start; flex-direction: column; }
  .setup-summary__items { justify-content: flex-start; }
}
</style>
