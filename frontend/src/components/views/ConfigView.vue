<script setup>
import { ref } from 'vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

const props = defineProps({
  programasByArea: { type: Map, required: true },
  vacantesPrograma: { type: Object, required: true },
  datFormat: { type: Object, required: true },
  convocatoriaId: { type: [Number, String], default: null },
})

// ── Vacantes ──────────────────────────────────────────────────────────────

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
  await new Promise((r) => setTimeout(r, 200))
  savingPrograma.value[programa] = false
  successPrograma.value[programa] = true
  setTimeout(() => { successPrograma.value[programa] = false }, 2000)
}

// ── Formato DAT ───────────────────────────────────────────────────────────

const datSaving = ref(false)

async function saveDatFormat() {
  datSaving.value = true
  try {
    await props.datFormat.saveFormatConfig(props.convocatoriaId)
    showToast('Formato DAT guardado correctamente', 'success')
  } catch {
    showToast('Error al guardar el formato DAT', 'error')
  } finally {
    datSaving.value = false
  }
}

function resetDatFormat() {
  props.datFormat.resetToDefault()
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
  <section class="config-view">
    <StepInfoCard
      title="Configuración"
      description="Vacantes por programa de estudios y formato del archivo .dat para el lector óptico."
      variant="gold"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-1.93 7.07M4.93 4.93A10 10 0 0 0 3 12a10 10 0 0 0 1.93 7.07" stroke-linecap="round"/>
        </svg>
      </template>
    </StepInfoCard>

    <div class="config-grid">

      <!-- ── Vacantes ─────────────────────────────────────────────────── -->
      <div class="config-card">
        <div class="card-header">
          <h3 class="card-title">Vacantes por programa</h3>
          <p class="card-desc">
            Cuántos postulantes ingresan por programa. Los programas se leen del padrón cargado en el Paso 1.
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
            <div class="area-group__label">{{ area }}</div>
            <div class="programa-list">
              <div v-for="prog in programas" :key="prog" class="programa-row">
                <span class="programa-name" :title="prog">{{ prog }}</span>
                <div class="programa-control">
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
                    class="btn btn--primary btn--xs"
                    :disabled="savingPrograma[prog]"
                    @click="saveVacantes(prog)"
                  >
                    <svg v-if="successPrograma[prog]" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span v-else>{{ savingPrograma[prog] ? '…' : 'OK' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <p class="note">Con vacantes en 0 el programa no marcará ingresantes.</p>
      </div>

      <!-- ── Formato DAT ──────────────────────────────────────────────── -->
      <div class="config-card">
        <div class="card-header">
          <h3 class="card-title">Formato del archivo .dat</h3>
          <p class="card-desc">
            Offsets y longitudes de campos según el modelo de lector óptico utilizado.
          </p>
        </div>

        <div class="dat-grid">
          <div v-for="field in DAT_FIELDS" :key="field.key" class="dat-field">
            <label :for="`dat-${field.key}`" class="dat-label">
              {{ field.label }}
              <span class="dat-hint">{{ field.hint }}</span>
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

        <div class="dat-actions">
          <button type="button" class="btn btn--ghost" @click="resetDatFormat">
            Restaurar por defecto
          </button>
          <button type="button" class="btn btn--primary" :disabled="datSaving" @click="saveDatFormat">
            {{ datSaving ? 'Guardando...' : 'Guardar formato' }}
          </button>
        </div>
      </div>

    </div>
  </section>
</template>

<style scoped>
.config-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (max-width: 900px) {
  .config-grid { grid-template-columns: 1fr; }
}

/* Cards */
.config-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card-header { display: flex; flex-direction: column; gap: var(--space-1); }
.card-title {
  font-size: 0.8rem; font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0;
}
.card-desc { font-size: 0.82rem; color: var(--slate-500); margin: 0; line-height: 1.5; }
.note { font-size: 0.78rem; color: var(--slate-400); margin: 0; font-style: italic; }

/* Vacantes */
.area-group { display: flex; flex-direction: column; gap: var(--space-1); }
.area-group__label {
  font-size: 0.72rem; font-weight: 700;
  color: var(--unap-blue-700); text-transform: uppercase;
  letter-spacing: 0.05em; padding: var(--space-1) 0;
  border-bottom: 2px solid var(--unap-blue-100);
}

.programa-list { display: flex; flex-direction: column; gap: 2px; }
.programa-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-3); padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-md); transition: background var(--transition-fast);
}
.programa-row:hover { background: var(--slate-50); }
.programa-name { font-size: 0.83rem; color: var(--slate-700); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.programa-control { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }

.empty-msg {
  font-size: 0.85rem; color: var(--slate-400);
  text-align: center; padding: var(--space-5);
  background: var(--slate-50); border-radius: var(--radius-lg);
  border: 1px dashed var(--slate-200);
}

/* DAT */
.dat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.dat-field { display: flex; flex-direction: column; gap: var(--space-1); }
.dat-label { font-size: 0.75rem; font-weight: 600; color: var(--slate-700); display: flex; flex-direction: column; gap: 1px; }
.dat-hint { font-size: 0.68rem; font-weight: 400; color: var(--slate-400); font-style: italic; }
.dat-actions { display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-2); }

/* Inputs */
.input {
  padding: var(--space-2) var(--space-3); border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); font-size: 0.9rem; background: white;
  transition: border-color var(--transition-fast);
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }
.input--sm { padding: var(--space-1) var(--space-2); font-size: 0.85rem; width: 64px; text-align: center; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-1); border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); padding: var(--space-2) var(--space-4);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--xs { padding: var(--space-1) var(--space-2); font-size: 0.78rem; min-width: 36px; }
.btn--primary { background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%); color: white; }
.btn--primary:hover:not(:disabled) { background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%); }
.btn--ghost { background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

</style>
