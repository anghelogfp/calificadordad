<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  convocatoria: { type: Object, required: true },
  hasData: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'close'])

const selectedId = ref(null)
const showNewForm = ref(false)
const creating = ref(false)
const createError = ref('')

// Al abrir: cargar convocatorias y preseleccionar la activa
watch(() => props.show, async (val) => {
  if (!val) return
  showNewForm.value = false
  createError.value = ''
  props.convocatoria.newConvocatoriaForm.value = { name: '', year: new Date().getFullYear(), suffix: '' }
  await props.convocatoria.fetchConvocatorias()
  selectedId.value = props.convocatoria.activeConvocatoriaId.value
})

const selected = computed(() =>
  props.convocatoria.convocatoriaList.value.find(c => c.id === selectedId.value) || null
)

const canConfirm = computed(() => !!selectedId.value)

async function handleCreate() {
  creating.value = true
  createError.value = ''
  const prevActive = props.convocatoria.activeConvocatoria.value

  await props.convocatoria.createConvocatoria()

  if (props.convocatoria.formError.value) {
    createError.value = props.convocatoria.formError.value
    if (prevActive) props.convocatoria.setActiveConvocatoria(prevActive)
  } else {
    selectedId.value = props.convocatoria.activeConvocatoriaId.value
    showNewForm.value = false
  }
  creating.value = false
}

function confirm() {
  if (!selected.value) return
  emit('confirm', selected.value)
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
              <p>Selecciona la convocatoria para este proceso</p>
            </div>
            <button type="button" class="modal-close" @click="emit('close')">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">

            <!-- Loading -->
            <div v-if="convocatoria.loading.value && !convocatoria.convocatoriaList.value.length" class="loading-row">
              <div class="spinner" />
              <span>Cargando convocatorias…</span>
            </div>

            <!-- Lista de convocatorias -->
            <div v-else class="conv-list">
              <button
                v-for="conv in convocatoria.convocatoriaList.value"
                :key="conv.id"
                type="button"
                class="conv-option"
                :class="{
                  'conv-option--selected': selectedId === conv.id,
                  'conv-option--closed': conv.status === 'closed',
                }"
                @click="selectedId = conv.id"
              >
                <span class="conv-option__radio">
                  <span v-if="selectedId === conv.id" class="conv-option__dot" />
                </span>
                <span class="conv-option__info">
                  <span class="conv-option__name">{{ conv.name }}</span>
                  <span class="conv-option__year">{{ conv.year }}</span>
                </span>
                <span
                  class="conv-option__status"
                  :class="conv.status === 'active' ? 'status--active' : 'status--closed'"
                >
                  {{ conv.status === 'active' ? 'Activa' : 'Cerrada' }}
                </span>
              </button>

              <div v-if="!convocatoria.convocatoriaList.value.length && !convocatoria.loading.value" class="empty-conv">
                No hay convocatorias. Crea una nueva abajo.
              </div>
            </div>

            <!-- Nueva convocatoria toggle -->
            <button
              v-if="!showNewForm"
              type="button"
              class="btn-add-conv"
              @click="showNewForm = true"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
              </svg>
              Nueva convocatoria
            </button>

            <!-- Form nueva convocatoria -->
            <div v-else class="new-conv-form">
              <div class="new-conv-form__title">Nueva convocatoria</div>

              <div class="new-conv-form__row">
                <div class="field-group field-group--grow">
                  <label class="field-label">Tipo</label>
                  <input
                    v-model="convocatoria.newConvocatoriaForm.value.name"
                    type="text"
                    class="input"
                    placeholder="GENERAL"
                    maxlength="60"
                    @keyup.enter="handleCreate"
                  />
                </div>
                <div class="field-group field-group--year">
                  <label class="field-label">Año</label>
                  <input
                    v-model.number="convocatoria.newConvocatoriaForm.value.year"
                    type="number"
                    class="input"
                    min="2000"
                    max="2100"
                  />
                </div>
                <div class="field-group field-group--suffix">
                  <label class="field-label">Sufijo <span class="optional">(opcional)</span></label>
                  <input
                    v-model="convocatoria.newConvocatoriaForm.value.suffix"
                    type="text"
                    class="input"
                    placeholder="I"
                    maxlength="10"
                    @keyup.enter="handleCreate"
                  />
                </div>
              </div>

              <div v-if="convocatoria.newConvocatoriaForm.value.name" class="name-preview">
                <span class="name-preview__label">Vista previa:</span>
                <strong>
                  {{ convocatoria.newConvocatoriaForm.value.name.trim() }}
                  {{ convocatoria.newConvocatoriaForm.value.year }}
                  <template v-if="convocatoria.newConvocatoriaForm.value.suffix?.trim()">
                    - {{ convocatoria.newConvocatoriaForm.value.suffix.trim() }}
                  </template>
                </strong>
              </div>

              <div class="new-conv-form__actions">
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  :disabled="!convocatoria.newConvocatoriaForm.value.name?.trim() || creating"
                  @click="handleCreate"
                >
                  {{ creating ? 'Creando…' : 'Crear convocatoria' }}
                </button>
                <button type="button" class="btn btn--ghost btn--sm" @click="showNewForm = false; createError = ''">
                  Cancelar
                </button>
              </div>
              <div v-if="createError" class="form-error">{{ createError }}</div>
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
            <button type="button" class="btn btn--ghost" @click="emit('close')">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="!canConfirm"
              @click="confirm"
            >
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
  max-width: 480px;
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
.modal-header p { font-size: 0.78rem; color: var(--unap-blue-200); margin: 2px 0 0; }

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
  display: flex; flex-direction: column; gap: var(--space-3);
  max-height: 55vh; overflow-y: auto;
}

/* Loading */
.loading-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4); color: var(--slate-500); font-size: 0.85rem;
}
.spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--slate-200); border-top-color: var(--unap-blue-500);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Conv list */
.conv-list {
  display: flex; flex-direction: column; gap: var(--space-2);
}

.conv-option {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white; cursor: pointer;
  transition: all 0.15s; text-align: left; width: 100%;
}
.conv-option:hover { border-color: var(--unap-blue-300); background: var(--unap-blue-50); }
.conv-option--selected { border-color: var(--unap-blue-500); background: var(--unap-blue-50); }
.conv-option--closed { opacity: 0.65; }

.conv-option__radio {
  width: 18px; height: 18px; flex-shrink: 0;
  border: 2px solid var(--slate-300); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.conv-option--selected .conv-option__radio { border-color: var(--unap-blue-500); }
.conv-option__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--unap-blue-500);
}

.conv-option__info {
  flex: 1; display: flex; flex-direction: column; gap: 1px;
}
.conv-option__name { font-size: 0.9rem; font-weight: 600; color: var(--slate-800); }
.conv-option__year { font-size: 0.75rem; color: var(--slate-400); }

.conv-option__status {
  font-size: 0.7rem; font-weight: 700; padding: 2px 8px;
  border-radius: var(--radius-full); flex-shrink: 0;
}
.status--active { background: #d4edda; color: #155724; }
.status--closed { background: var(--slate-100); color: var(--slate-500); }

.empty-conv {
  text-align: center; padding: var(--space-4);
  font-size: 0.85rem; color: var(--slate-400);
  background: var(--slate-50); border-radius: var(--radius-lg);
  border: 1px dashed var(--slate-200);
}

/* Btn add */
.btn-add-conv {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: none; border: 1px dashed var(--slate-300);
  border-radius: var(--radius-md); color: var(--slate-500);
  font-size: 0.8rem; font-weight: 500; cursor: pointer;
  transition: all 0.15s; width: 100%; justify-content: center;
}
.btn-add-conv:hover { border-color: var(--unap-blue-400); color: var(--unap-blue-600); background: var(--unap-blue-50); }

/* New form */
.new-conv-form {
  background: var(--slate-50); border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg); padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.new-conv-form__title {
  font-size: 0.78rem; font-weight: 700; color: var(--slate-600);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.new-conv-form__row {
  display: flex; gap: var(--space-2); align-items: flex-end; flex-wrap: wrap;
}
.new-conv-form__actions {
  display: flex; gap: var(--space-2);
}

.field-group { display: flex; flex-direction: column; gap: 4px; }
.field-group--grow { flex: 1; min-width: 120px; }
.field-group--year { flex: 0 0 80px; }
.field-group--suffix { flex: 0 0 70px; }

.field-label {
  font-size: 0.72rem; font-weight: 600; color: var(--slate-600);
  display: flex; align-items: center; gap: var(--space-1);
}
.optional { font-weight: 400; color: var(--slate-400); font-style: italic; }

.name-preview {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--unap-blue-50); border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-md); font-size: 0.82rem;
}
.name-preview__label { color: var(--slate-500); white-space: nowrap; }
.name-preview strong { color: var(--unap-blue-800); }

.form-error { font-size: 0.78rem; color: var(--error-600); }

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

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-5); border: none;
  border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }
.btn--primary { background: linear-gradient(135deg, var(--unap-blue-600), var(--unap-blue-700)); color: white; }
.btn--primary:hover:not(:disabled) { background: linear-gradient(135deg, var(--unap-blue-500), var(--unap-blue-600)); }
.btn--ghost { background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

/* Inputs */
.input {
  flex: 1; padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.85rem; background: white;
  transition: border-color 0.15s; min-width: 0;
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }
.input--year { flex: 0 0 90px; }

/* Transitions */
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-fade-leave-active .modal { transition: transform 0.15s ease; }
.modal-fade-enter-from .modal { transform: scale(0.93) translateY(8px); }
.modal-fade-leave-to .modal { transform: scale(0.96); }
</style>
