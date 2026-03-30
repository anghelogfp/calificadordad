<script setup>
import { ref } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  programasByArea: { type: Map, required: true },
  vacantesPrograma: { type: Object, required: true },
  datFormat: { type: Object, required: true },
  convocatoriaId: { type: [Number, String], default: null },
})

const emit = defineEmits(['close'])

// ── Vacantes por programa ─────────────────────────────────────────────────

const savingPrograma = ref({})
const successPrograma = ref({})

function getLocalVacantes(programa) {
  return props.vacantesPrograma.vacantesPrograma.value[programa] ?? 0
}

function setLocalVacantes(programa, value) {
  props.vacantesPrograma.setVacantes(programa, value)
}

async function saveVacantes(programa) {
  savingPrograma.value[programa] = true
  successPrograma.value[programa] = false
  // setVacantes ya persiste en localStorage de forma reactiva
  await new Promise((r) => setTimeout(r, 200))
  savingPrograma.value[programa] = false
  successPrograma.value[programa] = true
  setTimeout(() => { successPrograma.value[programa] = false }, 2000)
}

const hasProgramas = (area) => (props.programasByArea.get(area)?.length ?? 0) > 0

// ── Formato DAT ───────────────────────────────────────────────────────────

const datSaving = ref(false)
const datSuccess = ref(false)
const datError = ref('')

async function saveDatFormat() {
  datSaving.value = true
  datSuccess.value = false
  datError.value = ''
  try {
    await props.datFormat.saveFormatConfig(props.convocatoriaId)
    datSuccess.value = true
    setTimeout(() => { datSuccess.value = false }, 2500)
  } catch {
    datError.value = 'Error al guardar. Los cambios se mantienen localmente.'
  } finally {
    datSaving.value = false
  }
}

function resetDatFormat() {
  props.datFormat.resetToDefault()
  datSuccess.value = false
  datError.value = ''
}

const DAT_FIELDS = [
  { key: 'headerLength',  label: 'Longitud cabecera',     hint: 'Bytes antes del contenido útil' },
  { key: 'answersLength', label: 'Longitud respuestas',   hint: 'Número de preguntas del examen' },
  { key: 'lithoOffset',   label: 'Offset litho',          hint: 'Posición inicial del litho' },
  { key: 'lithoLength',   label: 'Longitud litho',        hint: 'Caracteres del litho' },
  { key: 'tipoOffset',    label: 'Offset tipo',           hint: 'Posición inicial del tipo' },
  { key: 'tipoLength',    label: 'Longitud tipo',         hint: 'Caracteres del tipo' },
  { key: 'dniOffset',     label: 'Offset DNI',            hint: 'Posición inicial del DNI' },
  { key: 'dniLength',     label: 'Longitud DNI',          hint: 'Caracteres del DNI' },
  { key: 'aulaOffset',    label: 'Offset aula',           hint: 'Posición inicial del aula' },
  { key: 'aulaLength',    label: 'Longitud aula',         hint: 'Caracteres del aula' },
  { key: 'answersOffset', label: 'Offset respuestas',     hint: 'Posición donde inician las respuestas' },
]
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="panel-overlay" @click.self="emit('close')">
      <div class="panel">

        <header class="panel__header">
          <div>
            <h2>Configuración</h2>
            <p>Vacantes por programa y formato del archivo .dat</p>
          </div>
          <button type="button" class="panel__close" @click="emit('close')" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div class="panel__body">

          <!-- ── Vacantes por programa ─────────────────────────── -->
          <section class="section">
            <div class="section__head">
              <h3 class="section__title">Vacantes por programa de estudios</h3>
              <p class="section__desc">
                Cuántos postulantes ingresan por cada programa. Los programas se leen automáticamente del padrón cargado en el Paso 1.
              </p>
            </div>

            <div v-if="programasByArea.size === 0" class="empty-msg">
              Carga el padrón Excel (Paso 1) para ver los programas disponibles.
            </div>

            <template v-else>
              <div
                v-for="[area, programas] in programasByArea"
                :key="area"
                class="area-group"
              >
                <div class="area-group__header">{{ area }}</div>
                <div class="programa-list">
                  <div
                    v-for="prog in programas"
                    :key="prog"
                    class="programa-row"
                  >
                    <span class="programa-row__name" :title="prog">{{ prog }}</span>
                    <div class="programa-row__control">
                      <input
                        type="number"
                        min="0"
                        class="input input--sm"
                        :value="getLocalVacantes(prog)"
                        @input="setLocalVacantes(prog, $event.target.value)"
                        @keydown.enter.prevent="saveVacantes(prog)"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        class="btn btn--primary btn--sm"
                        :disabled="savingPrograma[prog]"
                        @click="saveVacantes(prog)"
                      >
                        <svg v-if="successPrograma[prog]" class="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        <span v-else>{{ savingPrograma[prog] ? '...' : 'OK' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <p class="section__note">
              Con vacantes en 0 el programa no marcará ingresantes.
            </p>
          </section>

          <div class="divider" />

          <!-- ── Formato DAT ────────────────────────────────────── -->
          <section class="section">
            <div class="section__head">
              <h3 class="section__title">Formato del archivo .dat</h3>
              <p class="section__desc">
                Offsets y longitudes de campos según el modelo de lector óptico utilizado.
              </p>
            </div>

            <div class="dat-grid">
              <div
                v-for="field in DAT_FIELDS"
                :key="field.key"
                class="dat-field"
              >
                <label :for="`dat-${field.key}`" class="dat-field__label">
                  {{ field.label }}
                  <span class="dat-field__hint">{{ field.hint }}</span>
                </label>
                <input
                  :id="`dat-${field.key}`"
                  v-model.number="datFormat.formatConfig.value[field.key]"
                  type="number"
                  min="0"
                  class="input input--sm"
                />
              </div>
            </div>

            <div v-if="datSuccess" class="alert alert--success">Formato guardado correctamente.</div>
            <div v-if="datError" class="alert alert--error">{{ datError }}</div>

            <div class="dat-actions">
              <button type="button" class="btn btn--ghost btn--sm" @click="resetDatFormat">
                Restaurar por defecto
              </button>
              <button
                type="button"
                class="btn btn--primary btn--sm"
                :disabled="datSaving"
                @click="saveDatFormat"
              >
                {{ datSaving ? 'Guardando...' : 'Guardar formato' }}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.panel-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 29, 61, 0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: flex-end;
  z-index: 150;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.panel {
  width: min(460px, 100%);
  height: 100vh;
  background: white;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideIn 0.3s ease-out;
  overflow: hidden;
}
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.panel__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white; flex-shrink: 0;
}
.panel__header h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.panel__header p { font-size: 0.8rem; color: var(--unap-blue-200); margin: 2px 0 0; }

.panel__close {
  width: 32px; height: 32px; border: none; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background var(--transition-fast); flex-shrink: 0;
}
.panel__close svg { width: 18px; height: 18px; }
.panel__close:hover { background: rgba(255,255,255,0.2); }

.panel__body {
  flex: 1; overflow-y: auto;
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-5);
}

.divider { height: 1px; background: var(--slate-100); flex-shrink: 0; }

.section { display: flex; flex-direction: column; gap: var(--space-3); }
.section__head { display: flex; flex-direction: column; gap: var(--space-1); }
.section__title {
  font-size: 0.8rem; font-weight: 700; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0;
}
.section__desc { font-size: 0.82rem; color: var(--slate-500); margin: 0; line-height: 1.5; }
.section__note { font-size: 0.78rem; color: var(--slate-400); margin: 0; font-style: italic; }

.empty-msg {
  font-size: 0.85rem; color: var(--slate-400);
  text-align: center; padding: var(--space-5);
  background: var(--slate-50); border-radius: var(--radius-lg);
  border: 1px dashed var(--slate-200);
}

/* Área group */
.area-group { display: flex; flex-direction: column; gap: var(--space-1); }

.area-group__header {
  font-size: 0.75rem; font-weight: 700;
  color: var(--unap-blue-700); text-transform: uppercase;
  letter-spacing: 0.05em; padding: var(--space-1) 0;
  border-bottom: 2px solid var(--unap-blue-100);
}

.programa-list { display: flex; flex-direction: column; gap: 2px; }

.programa-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}
.programa-row:hover { background: var(--slate-50); }

.programa-row__name {
  font-size: 0.85rem; color: var(--slate-700); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.programa-row__control {
  display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0;
}

/* DAT */
.dat-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);
}
.dat-field { display: flex; flex-direction: column; gap: var(--space-1); }
.dat-field__label {
  font-size: 0.75rem; font-weight: 600; color: var(--slate-700);
  display: flex; flex-direction: column; gap: 1px;
}
.dat-field__hint { font-size: 0.68rem; font-weight: 400; color: var(--slate-400); font-style: italic; }

.dat-actions {
  display: flex; justify-content: flex-end; gap: var(--space-2);
  padding-top: var(--space-2);
}

/* Inputs & Buttons */
.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.9rem; background: white;
  transition: border-color var(--transition-fast);
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }
.input--sm { padding: var(--space-1) var(--space-2); font-size: 0.85rem; width: 64px; text-align: center; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-1); border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
  padding: var(--space-2) var(--space-4);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
}
.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
}
.btn--ghost {
  background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200);
}
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

.icon-sm { width: 14px; height: 14px; }

.alert {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md); font-size: 0.82rem;
}
.alert--success { background: #d4edda; color: #155724; border: 1px solid #b8dacc; }
.alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
</style>
