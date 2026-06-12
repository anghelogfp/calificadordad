<script setup>
import { ref, reactive } from 'vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

const props = defineProps({
  programasByArea:  { type: Map, required: true },
  vacantesPrograma: { type: Object, required: true },
  datFormat:        { type: Object, required: true },
  areas:            { type: Object, required: true },
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
    await props.datFormat.saveFormatConfig()
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

// ── Gestión de áreas ─────────────────────────────────────────────────────
const areaForm = reactive({ name: '', question_count: 60 })
const areaFormError = ref('')
const areaFormSaving = ref(false)
const showAreaForm = ref(false)

const editingArea = ref(null)   // { id, name, question_count } — área en edición inline
const deletingAreaId = ref(null)

async function saveNewArea() {
  areaFormError.value = ''
  if (!areaForm.name.trim()) { areaFormError.value = 'El nombre es obligatorio'; return }
  if (props.areas.areas.value.some(a => a.name.toLowerCase() === areaForm.name.trim().toLowerCase())) {
    areaFormError.value = 'Ya existe un área con ese nombre'; return
  }
  areaFormSaving.value = true
  try {
    await props.areas.createArea({ name: areaForm.name.trim(), question_count: Number(areaForm.question_count) || 60, vacantes: 0, order: props.areas.areas.value.length + 1 })
    areaForm.name = ''; areaForm.question_count = 60
    showAreaForm.value = false
    showToast('Área creada correctamente', 'success')
  } catch (e) {
    areaFormError.value = 'Error al crear el área'
  } finally {
    areaFormSaving.value = false
  }
}

function startEditArea(area) {
  editingArea.value = { id: area.id, name: area.name, question_count: area.question_count }
}

async function saveEditArea() {
  if (!editingArea.value) return
  if (!editingArea.value.name.trim()) return
  try {
    await props.areas.updateArea(editingArea.value.id, {
      name: editingArea.value.name.trim(),
      question_count: Number(editingArea.value.question_count) || 60,
    })
    editingArea.value = null
    showToast('Área actualizada', 'success')
  } catch {
    showToast('Error al actualizar el área', 'error')
  }
}

async function confirmDeleteArea(id) {
  try {
    await props.areas.deleteArea(id)
    deletingAreaId.value = null
    showToast('Área eliminada', 'success')
  } catch {
    showToast('Error al eliminar el área', 'error')
  }
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

      <!-- ── Gestión de áreas ───────────────────────────────────────── -->
      <div class="config-card">
        <div class="card-header">
          <h3 class="card-title">Áreas de evaluación</h3>
          <p class="card-desc">Define las áreas del examen (Biomédicas, Ingeniería, etc.) y el número de preguntas por área.</p>
        </div>

        <!-- Lista de áreas -->
        <div class="areas-mgr">
          <div v-if="areas.loading.value" class="empty-msg">Cargando áreas...</div>

          <template v-else>
            <div
              v-for="area in areas.areas.value"
              :key="area.id"
              class="area-mgr-row"
              :class="{ 'area-mgr-row--editing': editingArea?.id === area.id }"
            >
              <!-- Vista normal -->
              <template v-if="editingArea?.id !== area.id">
                <span class="area-mgr-row__name">{{ area.name }}</span>
                <span class="area-mgr-row__q">{{ area.question_count }} preg.</span>
                <div class="area-mgr-row__actions">
                  <button type="button" class="icon-btn" title="Editar" @click="startEditArea(area)">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    title="Eliminar"
                    @click="deletingAreaId = area.id"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                  </button>
                </div>
              </template>

              <!-- Vista edición inline -->
              <template v-else>
                <input
                  v-model="editingArea.name"
                  class="input input--sm input--grow"
                  placeholder="Nombre del área"
                  @keyup.enter="saveEditArea"
                  @keyup.escape="editingArea = null"
                />
                <input
                  v-model.number="editingArea.question_count"
                  type="number" min="1" max="200"
                  class="input input--sm input--narrow"
                  title="Nro. preguntas"
                />
                <div class="area-mgr-row__actions">
                  <button type="button" class="icon-btn icon-btn--save" title="Guardar" @click="saveEditArea">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  </button>
                  <button type="button" class="icon-btn" title="Cancelar" @click="editingArea = null">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                  </button>
                </div>
              </template>

              <!-- Confirmación de borrado -->
              <div v-if="deletingAreaId === area.id" class="delete-confirm">
                <span>¿Eliminar "{{ area.name }}"?</span>
                <button type="button" class="btn btn--danger btn--xs" @click="confirmDeleteArea(area.id)">Eliminar</button>
                <button type="button" class="btn btn--ghost btn--xs" @click="deletingAreaId = null">Cancelar</button>
              </div>
            </div>

            <!-- Formulario nueva área -->
            <div v-if="showAreaForm" class="area-new-form">
              <input
                v-model="areaForm.name"
                class="input input--sm input--grow"
                placeholder="Nombre del área (ej: Biomédicas)"
                @keyup.enter="saveNewArea"
                @keyup.escape="showAreaForm = false"
                autofocus
              />
              <input
                v-model.number="areaForm.question_count"
                type="number" min="1" max="200"
                class="input input--sm input--narrow"
                title="Nro. preguntas"
              />
              <button type="button" class="btn btn--primary btn--xs" :disabled="areaFormSaving" @click="saveNewArea">
                {{ areaFormSaving ? '…' : 'Agregar' }}
              </button>
              <button type="button" class="btn btn--ghost btn--xs" @click="showAreaForm = false; areaFormError = ''">
                Cancelar
              </button>
            </div>
            <p v-if="areaFormError" class="field-error">{{ areaFormError }}</p>
          </template>
        </div>

        <button
          v-if="!showAreaForm"
          type="button"
          class="btn btn--ghost btn--add"
          @click="showAreaForm = true; areaFormError = ''"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Nueva área
        </button>
      </div>

      <!-- ── Formato DAT ──────────────────────────────────────────────── -->
      <div class="config-card">
        <div class="card-header">
          <div class="card-title-row">
            <h3 class="card-title">Formato del archivo .dat</h3>
            <span class="card-badge card-badge--setup">Configurar una vez</span>
          </div>
          <p class="card-desc">
            Offsets y longitudes de campos según el modelo de lector óptico. Debe coincidir con la configuración física del escáner.
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
  grid-template-rows: auto auto;
  gap: var(--space-5);
  align-items: start;
}

/* Formato DAT → col 1, ocupa ambas filas (lo más crítico, va primero) */
.config-card:nth-child(3) { grid-column: 1; grid-row: 1 / 3; }
/* Áreas → col 2, row 1 */
.config-card:nth-child(2) { grid-column: 2; grid-row: 1; }
/* Vacantes → col 2, row 2 */
.config-card:nth-child(1) { grid-column: 2; grid-row: 2; }

@media (max-width: 900px) {
  .config-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  .config-card:nth-child(1),
  .config-card:nth-child(2),
  .config-card:nth-child(3) {
    grid-column: 1;
    grid-row: auto;
  }
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

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.card-title {
  font-size: 0.8rem; font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0;
}

.card-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-badge--setup {
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  border: 1px solid var(--unap-blue-100);
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

/* ── Gestión de áreas ─────────────────────────────────────────────────────── */
.areas-mgr {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.area-mgr-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
  flex-wrap: wrap;
  position: relative;
}

.area-mgr-row:hover { background: var(--slate-50); }

.area-mgr-row--editing {
  background: var(--unap-blue-50);
  border: 1px solid var(--unap-blue-100);
}

.area-mgr-row__name {
  flex: 1;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--slate-800);
}

.area-mgr-row__q {
  font-size: 0.75rem;
  color: var(--unap-blue-600);
  background: var(--unap-blue-50);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-weight: 600;
  white-space: nowrap;
}

.area-mgr-row__actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.area-mgr-row:hover .area-mgr-row__actions,
.area-mgr-row--editing .area-mgr-row__actions {
  opacity: 1;
}

.icon-btn {
  width: 28px; height: 28px;
  border: none; border-radius: var(--radius-md);
  background: var(--slate-100); color: var(--slate-500);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.icon-btn svg { width: 14px; height: 14px; }
.icon-btn:hover { background: var(--unap-blue-100); color: var(--unap-blue-700); }
.icon-btn--danger:hover { background: var(--error-100); color: var(--error-600); }
.icon-btn--save { background: var(--success-100); color: var(--success-600); }
.icon-btn--save:hover { background: var(--success-500); color: white; }

/* Confirmación de borrado */
.delete-confirm {
  width: 100%;
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  background: var(--error-50);
  border: 1px solid var(--error-100);
  border-radius: var(--radius-md);
  font-size: 0.8rem; color: var(--error-600);
}
.delete-confirm span { flex: 1; font-weight: 500; }

/* Formulario nueva área */
.area-new-form {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2);
  background: var(--unap-blue-50);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.input--grow { flex: 1; min-width: 120px; }
.input--narrow { width: 68px; text-align: center; }

.field-error {
  font-size: 0.75rem; color: var(--error-600);
  font-weight: 500; margin: 0;
}

.btn--add {
  width: 100%;
  justify-content: center;
  gap: var(--space-2);
  border-style: dashed;
  color: var(--slate-500);
  font-size: 0.82rem;
}
.btn--add:hover { color: var(--unap-blue-700); border-color: var(--unap-blue-300); background: var(--unap-blue-50); }

</style>
