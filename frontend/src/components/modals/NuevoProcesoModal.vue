<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show:    { type: Boolean, required: true },
  hasData: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'close'])

const name = ref('')
const type = ref('simulacro')

watch(() => props.show, (val) => {
  if (val) {
    name.value = ''
    type.value = 'simulacro'
  }
})

function confirm() {
  emit('confirm', { name: name.value.trim(), type: type.value })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <div class="modal">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <h2>Nuevo proceso de calificación</h2>
              <p>Asigna un nombre e indica el tipo de proceso</p>
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
            <div class="field">
              <label class="field-label" for="proc-name">Nombre del proceso</label>
              <input
                id="proc-name"
                v-model="name"
                type="text"
                class="input"
                placeholder="Ej: Simulacro Marzo 2026 · Biomédicas"
                maxlength="120"
                @keyup.enter="confirm"
                autofocus
              />
              <span class="field-hint">Puedes cambiarlo después en el paso de calificación.</span>
            </div>

            <!-- Tipo -->
            <div class="field">
              <label class="field-label">Tipo de proceso</label>
              <div class="type-options">
                <button
                  type="button"
                  class="type-option"
                  :class="{ 'type-option--active': type === 'simulacro' }"
                  @click="type = 'simulacro'"
                >
                  <span class="type-option__radio">
                    <span v-if="type === 'simulacro'" class="type-option__dot" />
                  </span>
                  <div class="type-option__info">
                    <span class="type-option__name">Simulacro</span>
                    <span class="type-option__desc">Resultados en tabla plana, sin ranking por carrera</span>
                  </div>
                </button>
                <button
                  type="button"
                  class="type-option"
                  :class="{ 'type-option--active': type === 'real' }"
                  @click="type = 'real'"
                >
                  <span class="type-option__radio">
                    <span v-if="type === 'real'" class="type-option__dot" />
                  </span>
                  <div class="type-option__info">
                    <span class="type-option__name">Convocatoria Real</span>
                    <span class="type-option__desc">Ranking por carrera, ingresantes con vacantes</span>
                  </div>
                </button>
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
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 20, 51, 0.55);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);
}

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 460px;
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
}

.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field-label {
  font-size: 0.78rem; font-weight: 700; color: var(--slate-600);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.field-hint { font-size: 0.75rem; color: var(--slate-400); }

.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.9rem; background: white; transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }

/* Type options */
.type-options { display: flex; flex-direction: column; gap: var(--space-2); }

.type-option {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--slate-200); border-radius: var(--radius-lg);
  background: white; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%;
}
.type-option:hover { border-color: var(--unap-blue-300); background: var(--unap-blue-50); }
.type-option--active { border-color: var(--unap-blue-500); background: var(--unap-blue-50); }

.type-option__radio {
  width: 18px; height: 18px; flex-shrink: 0;
  border: 2px solid var(--slate-300); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; transition: border-color 0.15s;
}
.type-option--active .type-option__radio { border-color: var(--unap-blue-500); }
.type-option__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--unap-blue-500); }

.type-option__info { display: flex; flex-direction: column; gap: 2px; }
.type-option__name { font-size: 0.88rem; font-weight: 600; color: var(--slate-800); }
.type-option__desc { font-size: 0.75rem; color: var(--slate-500); }

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
</style>
