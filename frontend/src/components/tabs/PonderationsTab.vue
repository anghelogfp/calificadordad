<script setup>
import { reactive, ref } from 'vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  ponderations: { type: Object, required: true },
  answersLength: { type: Number, default: 60 },
})

const ponderations = reactive(props.ponderations)

// Confirmación inline — evitar browser confirm()
const pendingDeletePlantilla = ref(null)
const pendingDeleteItem = ref(null)

function askDeletePlantilla(id) { pendingDeletePlantilla.value = id }
function cancelDeletePlantilla() { pendingDeletePlantilla.value = null }
function confirmDeletePlantilla() {
  ponderations.deletePlantilla(pendingDeletePlantilla.value)
  pendingDeletePlantilla.value = null
}

function askDeleteItem(id) { pendingDeleteItem.value = id }
function cancelDeleteItem() { pendingDeleteItem.value = null }
function confirmDeleteItem() {
  ponderations.removeItem(pendingDeleteItem.value)
  pendingDeleteItem.value = null
}

function handleRename(event) {
  ponderations.renamePlantilla(ponderations.selectedPlantillaId, event.target.value)
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      title="Plantillas de Ponderación"
      description="Gestiona las recetas de puntaje reutilizables. Cada plantilla define el peso de cada asignatura en el cálculo."
      variant="gold"
      :stats="ponderations.sidebarSections.map(s => ({
        value: s.plantillas.length,
        label: s.label
      }))"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <div class="plantillas-layout">

      <!-- ═══════════════ SIDEBAR ═══════════════ -->
      <aside class="sidebar">
        <div class="sidebar__inner">

          <div
            v-for="section in ponderations.sidebarSections"
            :key="section.label"
            class="sidebar__section"
          >
            <div class="sidebar__section-label">
              {{ section.label }}
              <span class="section-count">{{ section.plantillas.length }}</span>
            </div>

            <button
              v-for="p in section.plantillas"
              :key="p.id"
              type="button"
              class="plantilla-item"
              :class="{ 'plantilla-item--active': ponderations.selectedPlantillaId === p.id }"
              @click="ponderations.selectPlantilla(p.id)"
            >
              <div class="plantilla-item__info">
                <span class="plantilla-item__name">{{ p.name }}</span>
                <span
                  class="plantilla-item__badge"
                  :class="p.questionTotal === answersLength ? 'badge--ok' : 'badge--warn'"
                >
                  {{ p.questionTotal }}/{{ answersLength }}
                </span>
              </div>

              <div v-if="pendingDeletePlantilla === p.id" class="delete-confirm" @click.stop>
                <span class="delete-confirm__text">¿Eliminar?</span>
                <button type="button" class="btn-confirm" @click="confirmDeletePlantilla">Sí</button>
                <button type="button" class="btn-cancel-sm" @click="cancelDeletePlantilla">No</button>
              </div>
              <button
                v-else
                type="button"
                class="plantilla-item__delete"
                :title="`Eliminar ${p.name}`"
                @click.stop="askDeletePlantilla(p.id)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-1 8a1 1 0 112 0v3a1 1 0 11-2 0v-3zm4 0a1 1 0 112 0v3a1 1 0 11-2 0v-3z" clip-rule="evenodd"/>
                </svg>
              </button>
            </button>
          </div>

          <div v-if="ponderations.sidebarSections.length === 0" class="sidebar__empty">
            Aún no hay plantillas. Crea una abajo.
          </div>
        </div>

        <!-- Footer nueva plantilla -->
        <div class="sidebar__footer">
          <div v-if="ponderations.showNewPlantillaForm" class="new-plantilla-form">
            <input
              v-model="ponderations.newPlantillaName"
              type="text"
              class="input"
              placeholder="Nombre de la plantilla"
              maxlength="80"
              @keyup.enter="ponderations.confirmNewPlantilla"
              @keyup.escape="ponderations.cancelNewPlantillaForm"
            />
            <select v-model="ponderations.newPlantillaArea" class="input">
              <option value="">General (todas las áreas)</option>
              <option
                v-for="s in ponderations.sidebarSections.filter(s => s.area)"
                :key="s.area"
                :value="s.area"
              >
                {{ s.label }}
              </option>
            </select>
            <div class="new-plantilla-actions">
              <button type="button" class="btn btn--primary btn--sm" @click="ponderations.confirmNewPlantilla">
                Crear
              </button>
              <button type="button" class="btn btn--ghost btn--sm" @click="ponderations.cancelNewPlantillaForm">
                Cancelar
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="btn-new-plantilla"
            @click="ponderations.openNewPlantillaForm()"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
            </svg>
            Nueva plantilla
          </button>
        </div>
      </aside>

      <!-- ═══════════════ EDITOR ═══════════════ -->
      <div class="editor">

        <EmptyState
          v-if="!ponderations.selectedPlantilla"
          title="Selecciona una plantilla"
          description="Elige una plantilla de la lista para editarla, o crea una nueva."
          icon="select"
        />

        <template v-else>
          <!-- Cabecera -->
          <div class="editor__header">
            <div class="editor__name-row">
              <input
                :value="ponderations.selectedPlantilla.name"
                type="text"
                class="editor__name-input"
                placeholder="Nombre de la plantilla"
                maxlength="80"
                @blur="handleRename"
                @keyup.enter="($event.target).blur()"
              />
              <span
                class="editor__area-badge"
                :class="ponderations.selectedPlantilla.area ? 'badge-area' : 'badge-global'"
              >
                {{ ponderations.selectedPlantilla.area || 'General' }}
              </span>
            </div>

            <div
              class="totals-bar"
              :class="ponderations.selectedPlantillaTotal.questions === answersLength ? 'totals--ready' : 'totals--warning'"
            >
              <span class="totals__item">
                <span class="totals__label">Preguntas</span>
                <span class="totals__value">{{ ponderations.selectedPlantillaTotal.questions }}/{{ answersLength }}</span>
              </span>
              <span class="totals__sep">·</span>
              <span class="totals__item">
                <span class="totals__label">Peso total</span>
                <span class="totals__value">{{ ponderations.selectedPlantillaTotal.weight.toFixed(3) }}</span>
              </span>
              <span class="totals__sep">·</span>
              <span class="totals__item">
                <span class="totals__label">Asignaturas</span>
                <span class="totals__value">{{ ponderations.selectedPlantillaItems.length }}</span>
              </span>
              <span
                class="totals__badge"
                :class="ponderations.selectedPlantillaTotal.questions === answersLength ? 'totals__badge--ok' : 'totals__badge--pending'"
              >
                {{ ponderations.selectedPlantillaTotal.questions === answersLength
                    ? '✓ Lista'
                    : ponderations.selectedPlantillaTotal.questions < answersLength
                      ? `Faltan ${answersLength - ponderations.selectedPlantillaTotal.questions}`
                      : `Excede ${ponderations.selectedPlantillaTotal.questions - answersLength}` }}
              </span>
            </div>
          </div>

          <!-- Form agregar asignatura -->
          <div class="add-form-card">
            <h3 class="add-form-title">Agregar asignatura</h3>
            <form class="add-form" @submit.prevent="ponderations.addItem">
              <div class="field">
                <label>Asignatura</label>
                <input
                  v-model="ponderations.newItem.subject"
                  type="text"
                  class="input"
                  placeholder="Ej: Aritmética"
                  required
                />
              </div>
              <div class="field field--sm">
                <label>Preguntas</label>
                <input
                  v-model.number="ponderations.newItem.questionCount"
                  type="number"
                  min="1"
                  step="1"
                  class="input"
                  required
                />
              </div>
              <div class="field field--sm">
                <label>Ponderación</label>
                <input
                  v-model.number="ponderations.newItem.ponderation"
                  type="number"
                  min="0.001"
                  step="0.001"
                  class="input"
                  required
                />
              </div>
              <button type="submit" class="btn btn--primary add-btn">
                <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                Agregar
              </button>
            </form>
            <div v-if="ponderations.editorError" class="alert alert--error">
              {{ ponderations.editorError }}
            </div>
          </div>

          <!-- Tabla de asignaturas -->
          <div class="items-table-card">
            <div class="table-header">
              {{ ponderations.selectedPlantillaItems.length }}
              asignatura{{ ponderations.selectedPlantillaItems.length !== 1 ? 's' : '' }}
              en <strong>{{ ponderations.selectedPlantilla.name }}</strong>
            </div>

            <EmptyState
              v-if="!ponderations.selectedPlantillaItems.length"
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
                    <th class="col-num">Pregs.</th>
                    <th class="col-num">Ponderación</th>
                    <th class="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in ponderations.selectedPlantillaItems" :key="item.id">
                    <td class="col-num muted">{{ item.order }}</td>
                    <td>
                      <input
                        v-if="ponderations.isEditingItem(item.id)"
                        v-model="item.subject"
                        type="text"
                        class="cell-input"
                      />
                      <span v-else>{{ item.subject || '—' }}</span>
                    </td>
                    <td class="col-num">
                      <input
                        v-if="ponderations.isEditingItem(item.id)"
                        v-model.number="item.questionCount"
                        type="number"
                        min="1"
                        step="1"
                        class="cell-input cell-input--sm"
                      />
                      <span v-else>{{ item.questionCount }}</span>
                    </td>
                    <td class="col-num">
                      <input
                        v-if="ponderations.isEditingItem(item.id)"
                        v-model.number="item.ponderation"
                        type="number"
                        min="0.001"
                        step="0.001"
                        class="cell-input cell-input--sm"
                      />
                      <span v-else class="mono">{{ Number(item.ponderation).toFixed(3) }}</span>
                    </td>
                    <td class="col-actions">
                      <div v-if="pendingDeleteItem === item.id" class="delete-confirm" @click.stop>
                        <span class="delete-confirm__text">¿Eliminar?</span>
                        <button type="button" class="btn-confirm" @click="confirmDeleteItem">Sí</button>
                        <button type="button" class="btn-cancel-sm" @click="cancelDeleteItem">No</button>
                      </div>
                      <template v-else>
                        <button
                          type="button"
                          class="icon-btn"
                          :title="ponderations.isEditingItem(item.id) ? 'Guardar' : 'Editar'"
                          @click="ponderations.toggleEditItem(item.id)"
                        >
                          <svg viewBox="0 0 24 24">
                            <path
                              v-if="ponderations.isEditingItem(item.id)"
                              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
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
                          class="icon-btn icon-btn--danger"
                          title="Eliminar asignatura"
                          @click="askDeleteItem(item.id)"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" fill="currentColor"/>
                          </svg>
                        </button>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
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

/* ─── LAYOUT 2 COLUMNAS ─── */

.plantillas-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (max-width: 900px) {
  .plantillas-layout { grid-template-columns: 1fr; }
}

/* ─── SIDEBAR ─── */

.sidebar {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  top: var(--space-6);
  max-height: calc(100vh - 200px);
}

.sidebar__inner {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) 0;
}

.sidebar__section { margin-bottom: var(--space-2); }

.sidebar__section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--slate-400);
}

.section-count {
  background: var(--slate-100);
  color: var(--slate-500);
  border-radius: var(--radius-full);
  padding: 1px 6px;
  font-size: 0.65rem;
  font-weight: 600;
}

.plantilla-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  background: none;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: left;
}

.plantilla-item:hover { background: var(--slate-50); }

.plantilla-item--active {
  background: var(--unap-blue-50);
  border-right: 3px solid var(--unap-blue-600);
}

.plantilla-item--active .plantilla-item__name {
  color: var(--unap-blue-700);
  font-weight: 600;
}

.plantilla-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plantilla-item__name {
  font-size: 0.875rem;
  color: var(--slate-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.plantilla-item__badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
}

.badge--ok  { background: #d4edda; color: #155724; }
.badge--warn { background: #fff3cd; color: #856404; }

.plantilla-item__delete {
  flex-shrink: 0;
  width: 24px; height: 24px;
  border: none; border-radius: var(--radius-sm);
  background: none; color: var(--slate-300);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
  opacity: 0;
}

.plantilla-item:hover .plantilla-item__delete { opacity: 1; }
.plantilla-item__delete:hover { color: var(--error-500); background: var(--error-50); }
.plantilla-item__delete svg { width: 14px; height: 14px; }

.sidebar__empty {
  padding: var(--space-5) var(--space-4);
  font-size: 0.8rem;
  color: var(--slate-400);
  text-align: center;
}

/* Confirmaciones inline */
.delete-confirm {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}

.delete-confirm__text { font-size: 0.75rem; color: var(--error-600); font-weight: 600; }

.btn-confirm {
  padding: 2px 8px; font-size: 0.7rem; font-weight: 700;
  background: var(--error-500); color: white;
  border: none; border-radius: var(--radius-sm); cursor: pointer;
}
.btn-confirm:hover { background: var(--error-600); }

.btn-cancel-sm {
  padding: 2px 8px; font-size: 0.7rem; font-weight: 600;
  background: var(--slate-100); color: var(--slate-600);
  border: none; border-radius: var(--radius-sm); cursor: pointer;
}
.btn-cancel-sm:hover { background: var(--slate-200); }

/* Footer sidebar */
.sidebar__footer {
  border-top: 1px solid var(--slate-200);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
}

.btn-new-plantilla {
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-3);
  background: none; border: 1px dashed var(--slate-300);
  border-radius: var(--radius-md); color: var(--slate-500);
  font-size: 0.8rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-new-plantilla svg { width: 14px; height: 14px; }
.btn-new-plantilla:hover { border-color: var(--unap-blue-400); color: var(--unap-blue-600); background: var(--unap-blue-50); }

.new-plantilla-form { display: flex; flex-direction: column; gap: var(--space-2); }
.new-plantilla-actions { display: flex; gap: var(--space-2); }

/* ─── EDITOR ─── */

.editor { display: flex; flex-direction: column; gap: var(--space-4); }

.editor__header {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.editor__name-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.editor__name-input {
  flex: 1;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  border: none;
  border-bottom: 2px solid var(--slate-200);
  border-radius: 0;
  padding: var(--space-1) 0;
  background: none;
  transition: border-color var(--transition-fast);
}

.editor__name-input:focus {
  outline: none;
  border-bottom-color: var(--unap-blue-400);
}

.editor__area-badge {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-area  { background: var(--unap-blue-100); color: var(--unap-blue-700); }
.badge-global { background: var(--slate-100); color: var(--slate-600); }

/* Totales */
.totals-bar {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); font-size: 0.875rem;
  border: 1px solid; flex-wrap: wrap;
}

.totals--ready {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border-color: #b8dacc; color: #155724;
}

.totals--warning {
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, var(--slate-50) 100%);
  border-color: var(--unap-blue-100); color: var(--slate-700);
}

.totals__item { display: flex; align-items: baseline; gap: var(--space-1); }
.totals__label { font-size: 0.75rem; opacity: 0.7; }
.totals__value { font-weight: 700; font-family: var(--font-mono); }
.totals__sep { opacity: 0.4; }

.totals__badge {
  margin-left: auto; padding: 2px var(--space-3);
  border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600;
}

.totals__badge--ok     { background: #155724; color: white; }
.totals__badge--pending { background: var(--unap-blue-700); color: white; }

/* Form agregar */
.add-form-card {
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg); padding: var(--space-5);
  box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: var(--space-4);
}

.add-form-title { font-size: 0.9rem; font-weight: 700; color: var(--slate-700); margin: 0; }

.add-form {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: var(--space-3);
  align-items: end;
}

@media (max-width: 640px) { .add-form { grid-template-columns: 1fr; } }

.field { display: flex; flex-direction: column; gap: var(--space-1); }
.field--sm { width: 110px; }

@media (max-width: 640px) { .field--sm { width: 100%; } }

.field label {
  font-size: 0.7rem; font-weight: 600; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.add-btn { align-self: end; }

/* Tabla */
.items-table-card {
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
}

.table-header {
  padding: var(--space-3) var(--space-4); background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200); font-size: 0.83rem; color: var(--slate-500);
}

.table-scroll { max-height: 460px; overflow-y: auto; }

table { width: 100%; border-collapse: collapse; }

thead {
  position: sticky; top: 0; z-index: 1;
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
}

th {
  padding: var(--space-3) var(--space-4); text-align: left;
  font-size: 0.7rem; font-weight: 600; color: white;
  text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
}

td {
  padding: var(--space-3) var(--space-4); font-size: 0.875rem;
  border-bottom: 1px solid var(--slate-100); color: var(--slate-700);
}

tbody tr:hover { background: var(--slate-50); }
tbody tr:last-child td { border-bottom: none; }

.col-num    { width: 80px; text-align: center; font-family: var(--font-mono); }
.col-actions { width: 100px; text-align: center; }

td.col-actions {
  display: flex; gap: var(--space-2);
  justify-content: center; align-items: center;
}

.muted { color: var(--slate-400); }
.mono  { font-family: var(--font-mono); }

.cell-input {
  width: 100%; padding: var(--space-1) var(--space-2);
  border: 1px solid var(--unap-blue-300); border-radius: var(--radius-sm);
  font-size: 0.875rem; background: white;
}

.cell-input--sm { max-width: 90px; }

.cell-input:focus {
  outline: none; border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 2px rgba(0, 82, 163, 0.15);
}

/* Botones */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
}

.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }
.btn__icon { width: 16px; height: 16px; flex-shrink: 0; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; box-shadow: var(--shadow-sm);
}
.btn--primary:hover {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px);
}

.btn--ghost {
  background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200);
}
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

.icon-btn {
  width: 32px; height: 32px; border: 1px solid var(--slate-200); border-radius: var(--radius-sm);
  background: white; color: var(--slate-500); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}

.icon-btn svg { width: 16px; height: 16px; }
.icon-btn:hover { background: var(--unap-blue-50); color: var(--unap-blue-600); border-color: var(--unap-blue-200); }
.icon-btn--danger { color: var(--error-400); border-color: var(--error-100); }
.icon-btn--danger:hover { background: var(--error-50); border-color: var(--error-200); color: var(--error-600); }

.input {
  padding: var(--space-2) var(--space-3); border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); font-size: 0.875rem;
  background: var(--slate-50); transition: all var(--transition-fast); width: 100%;
}

.input:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.alert { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: 0.875rem; }
.alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
</style>
