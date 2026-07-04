<script setup>
import { reactive, ref, watch, computed, unref } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import ProcessPathCard from '@/components/shared/ProcessPathCard.vue'

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

const modalRef = ref(null)
useFocusTrap(modalRef, computed(() => props.show))

const runningAll = ref(false)
const allResult = ref(null)
const isRealMode = computed(() => props.calification.processType === 'real')
const isGeneralSimulacro = computed(() => props.calification.isGeneralSimulacro)
const processAreas = computed(() => unref(props.calification.processAreas) ?? [])
const calificationAreaOptions = computed(() => unref(props.calification.calificationAreaOptions) ?? [])
const programasForCurrentArea = computed(() => unref(props.calification.programasForCurrentArea) ?? [])
const calculatedAreasCount = computed(() => processAreas.value.length)
const totalAreaOptionsCount = computed(() => calificationAreaOptions.value.length)
const pendingAreasCount = computed(() => Math.max(totalAreaOptionsCount.value - calculatedAreasCount.value, 0))
const selectedAreaAlreadyCalculated = computed(() =>
  processAreas.value.includes(props.calification.calificationArea)
)
const currentProgramCount = computed(() => programasForCurrentArea.value.length)

function close() { emit('close') }
function runCalification() {
  props.calification.runCalification()
}

async function runAllAreas() {
  runningAll.value = true
  allResult.value = null
  await new Promise(r => setTimeout(r, 50))
  const result = props.calification.runAllAreas()
  runningAll.value = false
  allResult.value = result
}

function getVacantes(programa) {
  return props.vacantesPrograma.vacantesPrograma.value[programa] ?? 0
}

function setVacantes(programa, val) {
  props.vacantesPrograma.setVacantes(programa, val)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="close">
      <div ref="modalRef" class="modal" role="dialog" aria-modal="true">

        <!-- ── Header ─────────────────────────────────────────────────────── -->
        <header class="modal__header">
          <div class="modal__header-icon">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="modal__title">
            <h2>Calcular Puntajes</h2>
            <p>
              {{
                isRealMode
                  ? 'Convocatoria real · claves P/Q/R/S/T · ranking por programa'
                  : isGeneralSimulacro
                    ? 'Simulacro general · clave única · ranking general'
                    : 'Simulacro por áreas · ranking por área'
              }}
            </p>
          </div>
          <button type="button" class="modal__close" @click="close" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div class="calculation-strip calculation-strip--compact">
          <span class="calculation-strip__item calculation-strip__item--meta">
            <strong>Modo</strong>
            {{ isRealMode ? 'Convocatoria real' : isGeneralSimulacro ? 'Simulacro general' : 'Simulacro por áreas' }}
          </span>
          <span class="calculation-strip__item calculation-strip__item--meta">
            <strong>{{ isGeneralSimulacro ? 'Ranking' : 'Área' }}</strong>
            {{ isGeneralSimulacro ? 'General' : calification.calificationArea || 'Sin seleccionar' }}
          </span>
          <span
            class="calculation-strip__item"
            :class="calification.preflightCheck.hasBlockers ? 'calculation-strip__item--error'
              : calification.preflightCheck.hasWarnings ? 'calculation-strip__item--warn' : 'calculation-strip__item--ok'"
          >
            <strong>Estado</strong>
            {{ calification.preflightCheck.hasBlockers ? 'Bloqueado'
              : calification.preflightCheck.hasWarnings ? 'Con alertas' : 'Listo' }}
          </span>
        </div>

        <form class="modal__body" @submit.prevent="runCalification" novalidate>

          <!-- Error de calificación (top) -->
          <div v-if="calification.calificationError" class="alert alert--error">
            <svg viewBox="0 0 16 16" fill="currentColor" width="15" height="15" style="flex-shrink:0">
              <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zM7 6.5a1 1 0 112 0v4a1 1 0 11-2 0V6.5zM8 13a1 1 0 110-2 1 1 0 010 2z" clip-rule="evenodd"/>
            </svg>
            {{ calification.calificationError }}
          </div>

          <div class="config-shell">
          <div class="config-shell__header">
            <div>
              <span class="config-shell__eyebrow">Configuración de cálculo</span>
              <h3>Reglas operativas del cálculo</h3>
            </div>
            <span class="config-shell__badge">Proceso configurado</span>
          </div>

          <div class="section section--composed">
            <div class="section__intro">
              <p class="section__eyebrow">Qué vas a calcular</p>
              <h3 class="section__title">Selecciona qué vas a calcular dentro del proceso activo</h3>
            </div>

          <div class="modal-grid modal-grid--decision">
          <div class="section-block">
          <!-- ── SECCIÓN 1: Proceso ─────────────────────────────────────── -->
          <div class="section section--process">
            <p class="section__label">
              Proceso
            </p>

            <div class="field">
              <label for="process-name">Nombre del proceso</label>
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

            <ProcessPathCard
              eyebrow="Camino definido al crear proceso"
              :title="isRealMode ? 'Convocatoria real' : isGeneralSimulacro ? 'Simulacro general' : 'Simulacro por áreas'"
              :description="isRealMode
                ? 'Ranking por programa, vacantes e ingresantes.'
                : isGeneralSimulacro
                  ? 'Un solo ranking para todos los postulantes.'
                  : 'Ranking separado por área de evaluación.'"
              :badge="isRealMode ? 'Vacantes por programa' : isGeneralSimulacro ? 'Ranking general' : 'Ranking por área'"
              :variant="isRealMode ? 'real' : 'simulacro'"
              locked-label="No editable aquí"
            />
            <div class="mode-summary" :class="isRealMode ? 'mode-summary--real' : 'mode-summary--simulacro'">
              <span class="mode-chip">{{ isRealMode ? 'Tipo P/Q/R/S/T obligatorio' : 'Tipo no requerido' }}</span>
              <span class="mode-chip">{{ isRealMode ? 'Área y programa requeridos' : isGeneralSimulacro ? 'Padrón sin área permitido' : 'Áreas del padrón' }}</span>
              <span class="mode-chip">{{ isRealMode ? 'Vacantes por programa' : isGeneralSimulacro ? 'Ranking general' : 'Ranking por área' }}</span>
            </div>
          </div>

          <!-- ── SECCIÓN 2: Área ────────────────────────────────────────── -->
          </div>
          </div>

          <div class="section-block section-block--aside">
          <div class="section section--area">
            <p class="section__label">
              {{ isGeneralSimulacro ? 'Ranking a calificar' : 'Área a calificar' }}
              <span v-if="!isGeneralSimulacro && calification.calificationAreaOptions.length > 1" class="section__counter">
                {{ calification.processAreas.length }} / {{ calification.calificationAreaOptions.length }} calculadas
              </span>
            </p>

            <div class="area-pills">
              <button
                v-for="area in calification.calificationAreaOptions"
                :key="area"
                type="button"
                class="area-pill"
                :class="{
                  'area-pill--done':   calification.processAreas.includes(area),
                  'area-pill--active': calification.calificationArea === area,
                }"
                @click="calification.calificationArea = area"
              >
                <svg v-if="calification.processAreas.includes(area)" viewBox="0 0 12 12" fill="currentColor" width="10" height="10">
                  <path fill-rule="evenodd" d="M10.293 1.293a1 1 0 011.414 1.414l-7 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L4 7.586l6.293-6.293z"/>
                </svg>
                {{ area }}
              </button>
            </div>

            <div v-if="calification.processAreas.includes(calification.calificationArea)" class="recalc-banner">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="flex-shrink:0">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Esta área ya fue calculada. Si continúas, sus resultados actuales se reemplazarán.
            </div>

            <div class="selection-meta">
              <span class="selection-meta__item">
                <strong>Calculadas</strong>
                {{ calculatedAreasCount }} / {{ totalAreaOptionsCount || 1 }}
              </span>
              <span v-if="!isGeneralSimulacro" class="selection-meta__item">
                <strong>Pendientes</strong>
                {{ pendingAreasCount }}
              </span>
              <span class="selection-meta__item">
                <strong>Acción</strong>
                {{ selectedAreaAlreadyCalculated ? 'Recalcular' : 'Nuevo cálculo' }}
              </span>
            </div>
          </div>
          </div>
          </div>
          </div>

          <div class="section section--composed section--composed-accent">
            <div class="section__intro">
              <p class="section__eyebrow">Cómo se calculará</p>
              <h3 class="section__title">Configura la plantilla, los puntajes y la salida del cálculo</h3>
            </div>

          <div class="modal-grid modal-grid--setup">
          <div class="section-block">
          <!-- ── SECCIÓN 3: Plantilla y valores ────────────────────────── -->
          <div class="section section--scoring">
            <p class="section__label">
              Plantilla y valores de calificación
            </p>

            <!-- Plantilla -->
            <div class="field">
              <label for="calification-plantilla">Plantilla de ponderación</label>
              <select
                id="calification-plantilla"
                v-model="calification.calificationPlantillaId"
                class="input"
                required
              >
                <option v-for="p in calification.availablePlantillas" :key="p.id" :value="p.id">
                  {{ p.name }}{{ !p.area ? ' (General)' : '' }}
                </option>
              </select>

              <p v-if="!calification.availablePlantillas.length" class="field-note field-note--warn">
                No hay plantillas para esta área. Ve a Ponderaciones para crearlas.
              </p>

              <!-- Preview compacto -->
              <div v-if="calification.selectedCalificationPlantilla" class="plantilla-preview">
                <span class="preview-chip">
                  {{ calification.selectedCalificationPlantilla.questionTotal }} preguntas
                </span>
                <span class="preview-chip">
                  {{ (calification.selectedCalificationPlantilla.items || []).length }} asignaturas
                </span>
                <span class="preview-chip preview-chip--weight">
                  peso total {{ calification.selectedPonderationTotals.weight.toFixed(2) }}
                </span>
                <span
                  class="preview-chip preview-chip--status"
                  :class="calification.selectedPonderationIsReady ? 'chip--ok' : 'chip--warn'"
                >
                  {{ calification.selectedPonderationIsReady ? '✓ Lista para usar' : '✗ Incompleta' }}
                </span>
              </div>

              <div v-if="!calification.selectedPonderationIsReady && calification.selectedCalificationPlantilla" class="info-banner">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="flex-shrink:0">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                La plantilla no cubre el número esperado de preguntas. Complétala en Ponderaciones antes de calificar.
              </div>
            </div>

            <!-- Valores de calificación -->
            <div class="field">
              <label>Puntos por tipo de respuesta</label>
              <div class="scores-row">
                <div class="score-item score-item--green">
                  <span class="score-item__dot"></span>
                  <span class="score-item__label">Correcta</span>
                  <input
                    id="value-correct"
                    v-model.number="calification.calificationCorrectValue"
                    type="number"
                    step="0.01"
                    class="score-item__input"
                    required
                  />
                  <span class="score-item__unit">pts</span>
                </div>
                <div class="score-item score-item--red">
                  <span class="score-item__dot"></span>
                  <span class="score-item__label">Incorrecta</span>
                  <input
                    id="value-incorrect"
                    v-model.number="calification.calificationIncorrectValue"
                    type="number"
                    step="0.01"
                    class="score-item__input"
                    required
                  />
                  <span class="score-item__unit">pts</span>
                </div>
                <div class="score-item score-item--gray">
                  <span class="score-item__dot"></span>
                  <span class="score-item__label">En blanco</span>
                  <input
                    id="value-blank"
                    v-model.number="calification.calificationBlankValue"
                    type="number"
                    step="0.01"
                    class="score-item__input"
                    required
                  />
                  <span class="score-item__unit">pts</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── SECCIÓN 4: Vacantes (condicional) ──────────────────────── -->
          </div>
          </div>

          <div class="section-block section-block--aside">
          <div v-if="isRealMode && calification.programasForCurrentArea.length > 0" class="section section--vacantes">
            <p class="section__label">
              Vacantes por programa
              <span class="section__hint">0 = sin límite de cupos</span>
            </p>
            <div class="vacantes-list">
              <div
                v-for="programa in calification.programasForCurrentArea"
                :key="programa"
                class="vacantes-row"
              >
                <span class="vacantes-programa">{{ programa }}</span>
                <div class="vacantes-control">
                  <input
                    type="number"
                    min="0"
                    class="vacantes-input"
                    :value="getVacantes(programa)"
                    @input="setVacantes(programa, $event.target.value)"
                  />
                  <span class="vacantes-unit">vacantes</span>
                </div>
              </div>
            </div>
            <div class="selection-meta selection-meta--output">
              <span class="selection-meta__item">
                <strong>Programas</strong>
                {{ currentProgramCount }}
              </span>
              <span class="selection-meta__item">
                <strong>Salida</strong>
                Ranking por programa
              </span>
              <span class="selection-meta__item">
                <strong>Ingresantes</strong>
                Según vacantes
              </span>
            </div>
          </div>
          <div v-else-if="!isRealMode" class="section mode-note">
            <p class="section__label">
              Salida de simulacro
            </p>
            <div class="mode-note__body">
              <span>Se generará una tabla plana por puntaje total.</span>
              <span>Las vacantes e ingresantes no se aplican en este modo.</span>
            </div>
            <div class="selection-meta selection-meta--output">
              <span class="selection-meta__item">
                <strong>Salida</strong>
                {{ isGeneralSimulacro ? 'Ranking general' : 'Ranking por área' }}
              </span>
              <span class="selection-meta__item">
                <strong>Tabla</strong>
                Plana
              </span>
              <span class="selection-meta__item">
                <strong>Ingresantes</strong>
                No aplica
              </span>
            </div>
          </div>
          </div>
          </div>

          <!-- ── SECCIÓN 5: Diagnóstico del área ───────────────────────── -->
          <div
            class="section section--composed section--preflight"
            :class="{
              'preflight--error':   calification.preflightCheck.hasBlockers,
              'preflight--warning': !calification.preflightCheck.hasBlockers && calification.preflightCheck.hasWarnings,
              'preflight--ok':      !calification.preflightCheck.hasBlockers && !calification.preflightCheck.hasWarnings,
            }"
          >
            <div class="preflight-summary">
              <div>
                <span class="preflight-summary__eyebrow">Validación antes de calcular</span>
                <h3>
                  {{ calification.preflightCheck.hasBlockers
                    ? 'No se puede calcular todavía'
                    : calification.preflightCheck.hasWarnings
                      ? 'Puedes calcular, pero conviene revisar'
                      : 'Todo está listo para calcular' }}
                </h3>
              </div>
              <span
                class="status-badge status-badge--large"
                :class="calification.preflightCheck.hasBlockers ? 'badge--error'
                  : calification.preflightCheck.hasWarnings ? 'badge--warn' : 'badge--ok'"
              >
                {{ calification.preflightCheck.hasBlockers ? 'Bloqueado'
                  : calification.preflightCheck.hasWarnings ? 'Advertencias' : 'Listo' }}
              </span>
            </div>
            <p class="section__label">
              {{ isGeneralSimulacro ? 'Diagnóstico del ranking general' : 'Diagnóstico del área' }}
              <span
                class="status-badge"
                :class="calification.preflightCheck.hasBlockers ? 'badge--error'
                  : calification.preflightCheck.hasWarnings ? 'badge--warn' : 'badge--ok'"
              >
                {{ calification.preflightCheck.hasBlockers ? 'Con errores'
                  : calification.preflightCheck.hasWarnings ? 'Con advertencias' : 'Todo listo' }}
              </span>
            </p>

            <div class="preflight-items">
              <div
                v-for="item in calification.preflightCheck.items"
                :key="item.key"
                class="preflight-item"
                :class="`preflight-item--${item.status}`"
              >
                <div class="preflight-item__icon">
                  <svg v-if="item.status === 'ok'" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L7 8.586 5.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                  <svg v-else-if="item.status === 'warn'" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <svg v-else viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zM7 6.5a1 1 0 112 0v4a1 1 0 11-2 0V6.5zM8 13a1 1 0 110-2 1 1 0 010 2z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div class="preflight-item__body">
                  <div class="preflight-item__row">
                    <span class="preflight-item__label">{{ item.label }}</span>
                    <span class="preflight-item__value">{{ item.value }}</span>
                  </div>
                  <p v-if="item.detail" class="preflight-item__detail">{{ item.detail }}</p>
                </div>
              </div>
            </div>
          </div>

        </form>

        <!-- ── Footer ─────────────────────────────────────────────────────── -->
        <footer class="modal__footer">
          <div class="footer-status">
            <strong>{{ calification.preflightCheck.hasBlockers ? 'Corrige los errores para continuar' : 'Acción de cálculo' }}</strong>
            <span>{{ isGeneralSimulacro ? 'Ranking general' : calification.calificationArea || 'Área seleccionada' }}</span>
          </div>
          <button type="button" class="btn btn--ghost" @click="close">Cancelar</button>

          <div class="footer__actions">
            <!-- Calcular todas — solo si hay más de 1 área -->
            <button
              v-if="calification.calificationAreaOptions.length > 1"
              type="button"
              class="btn btn--secondary"
              :disabled="runningAll"
              @click.prevent="runAllAreas"
            >
              <svg v-if="runningAll" class="btn__icon spin" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
              </svg>
              <svg v-else class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
              </svg>
              {{ runningAll ? 'Calculando…' : 'Calcular todas' }}
            </button>

            <!-- Calcular área activa -->
            <button
              type="button"
              class="btn btn--gold"
              @click="runCalification"
            >
              <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
              </svg>
              Calcular {{ isGeneralSimulacro ? 'ranking general' : calification.calificationArea }}
            </button>
          </div>
        </footer>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay & Modal ─────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(5, 20, 45, 0.65);
  backdrop-filter: blur(6px);
  display: flex; align-items: flex-start; justify-content: center;
  padding: var(--space-8) var(--space-4);
  overflow-y: auto;
  z-index: var(--z-modal);
  animation: fadeIn 0.18s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  background: var(--slate-50);
  border-radius: var(--radius-xl);
  width: min(860px, 100%);
  max-height: calc(100vh - 48px);
  margin: auto;
  display: flex; flex-direction: column;
  box-shadow: 0 25px 60px rgba(5, 20, 45, 0.35);
  animation: scaleIn 0.25s ease-out;
  overflow: hidden;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.modal__header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--unap-blue-800) 0%, var(--unap-blue-900) 100%);
  color: white;
  flex-shrink: 0;
}

.modal__header-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  background: rgba(255,255,255,0.12);
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
}
.modal__header-icon svg { width: 18px; height: 18px; }

.modal__title { flex: 1; min-width: 0; }
.modal__title h2 { font-size: 1.1rem; font-weight: 700; margin: 0; line-height: 1.3; }
.modal__title p  { font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 2px 0 0; }

.modal__close {
  width: 32px; height: 32px; border: none; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.modal__close svg { width: 16px; height: 16px; }
.modal__close:hover { background: rgba(255,255,255,0.18); color: white; }

.calculation-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: white;
  border-bottom: 1px solid var(--slate-200);
}

.calculation-strip--compact {
  gap: var(--space-2);
  padding-top: var(--space-2);
  padding-bottom: var(--space-2);
  background: #f8fafc;
}

.calculation-strip__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: var(--slate-50);
  color: var(--slate-700);
  font-size: 0.8rem;
  font-weight: 700;
}

.calculation-strip__item--meta {
  background: white;
}

.calculation-strip__item strong {
  color: var(--slate-400);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.calculation-strip__item--ok {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.calculation-strip__item--warn {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.calculation-strip__item--error {
  border-color: var(--error-200);
  background: var(--error-50);
  color: var(--error-700);
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.modal__body {
  flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden;
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
  background: white;
}

.config-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.config-shell__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0 var(--space-1) var(--space-1);
}

.config-shell__eyebrow {
  display: block;
  margin-bottom: 3px;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.config-shell__header h3 {
  margin: 0;
  color: var(--slate-900);
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.3;
}

.config-shell__badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: #fbfcfd;
  color: var(--slate-500);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.section--composed {
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white;
}

.section--composed-accent {
  background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
}

.section__intro {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--slate-100);
}

.section__eyebrow {
  margin: 0;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section__title {
  margin: 0;
  color: var(--slate-900);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.modal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
  background: transparent;
  overflow: visible;
}

.modal-grid > .section,
.modal-grid > .section-block {
  min-width: 0;
}

.section-block {
  min-width: 0;
}

.section-block--aside {
  display: flex;
  padding-top: var(--space-3);
  border-top: 1px solid var(--slate-100);
}

.section-block--aside > .section {
  width: 100%;
}

/* ── Secciones ───────────────────────────────────────────────────────────── */
.section {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}

.section--composed > .modal-grid > .section-block > .section,
.section--composed > .modal-grid > .section-block--aside > .section {
  padding: 0;
}

.section--process,
.section--scoring {
  border-top: 0;
}

.section--area,
.section--vacantes,
.mode-note {
  border-top: 0;
}

.section__label {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--slate-400);
  margin: 0; padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--slate-100);
}

.section__counter {
  margin-left: auto;
  font-size: 0.66rem; font-weight: 700;
  color: var(--slate-600);
  text-transform: none; letter-spacing: 0;
  background: var(--slate-100);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

.section__hint {
  margin-left: auto;
  font-size: 0.68rem; font-weight: 400;
  color: var(--slate-400);
  text-transform: none; letter-spacing: 0;
}

/* ── Fields ──────────────────────────────────────────────────────────────── */
.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field label {
  font-size: 0.75rem; font-weight: 600; color: var(--slate-600);
  display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2);
}

.locked-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.68rem; font-weight: 600;
  color: #7c5a14; background: #fff8e6;
  border: 1px solid #f2dfad;
  padding: 1px var(--space-2); border-radius: var(--radius-full);
  text-transform: none; letter-spacing: 0;
}

.field-note {
  font-size: 0.75rem; color: var(--slate-400); margin: 0;
}
.field-note--warn {
  color: #92400e;
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
}

.input {
  padding: var(--space-2) var(--space-3);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.875rem; background: white;
  transition: all 0.15s;
}
.input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

/* ── Tipo de proceso ─────────────────────────────────────────────────────── */
.type-toggle {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2);
}

.type-toggle--locked { opacity: 0.55; pointer-events: none; }

.type-opt {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: var(--slate-50); color: var(--slate-500);
  cursor: pointer; font-size: 0.85rem; font-weight: 600;
  transition: all 0.15s; text-align: left;
}
.type-opt svg { flex-shrink: 0; }
.type-opt__text { display: flex; flex-direction: column; gap: 1px; }
.type-opt__text small { font-size: 0.7rem; font-weight: 400; opacity: 0.75; }

.type-opt:hover:not(:disabled) {
  border-color: var(--unap-blue-300);
  color: var(--unap-blue-700);
  background: var(--unap-blue-50);
}

.type-opt--active {
  border-color: var(--unap-blue-600);
  background: var(--unap-blue-700);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 51, 102, 0.25);
}
.type-opt--active .type-opt__text small { opacity: 0.7; }

.type-opt--real.type-opt--active {
  border-color: var(--unap-gold-600);
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold);
}

.mode-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-150, var(--slate-200));
  background: #fcfcfd;
}

.mode-summary--simulacro {
  border-color: #dbe7f5;
  background: #f9fbfe;
}

.mode-summary--real {
  border-color: #f3e1b2;
  background: #fffdf7;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--slate-600);
  font-size: 0.72rem;
  font-weight: 600;
}

.mode-chip svg {
  flex-shrink: 0;
  color: var(--unap-blue-500);
}

.mode-summary--real .mode-chip {
  color: #78350f;
}

.mode-summary--real .mode-chip svg {
  color: #d97706;
}

/* ── Área pills ──────────────────────────────────────────────────────────── */
.area-pills {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
}

.area-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--slate-200);
  background: var(--slate-50);
  font-size: 0.82rem; font-weight: 600;
  color: var(--slate-500);
  cursor: pointer; transition: all 0.15s;
}
.area-pill:hover { border-color: var(--unap-blue-300); color: var(--unap-blue-700); }

.area-pill--done {
  background: #f0fdf4; border-color: #86efac; color: #166534;
}
.area-pill--active {
  background: var(--unap-blue-700); border-color: var(--unap-blue-700); color: white;
}
.area-pill--done.area-pill--active {
  background: var(--unap-blue-700); border-color: var(--unap-blue-700); color: white;
}

.recalc-banner {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  font-size: 0.8rem; color: #92400e;
  line-height: 1.5;
}
.recalc-banner svg { color: #d97706; margin-top: 1px; }

.selection-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.selection-meta--output {
  margin-top: auto;
}

.selection-meta__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--slate-200);
  background: #fbfcfd;
  color: var(--slate-600);
  font-size: 0.74rem;
  font-weight: 600;
}

.selection-meta__item strong {
  color: var(--slate-400);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.operation-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: var(--slate-50);
}

.operation-summary--output {
  margin-top: auto;
}

.operation-summary__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--slate-500);
  font-size: 0.76rem;
}

.operation-summary__row + .operation-summary__row {
  border-top: 1px solid var(--slate-200);
  border-radius: 0;
}

.operation-summary__row strong {
  color: var(--slate-800);
  font-size: 0.78rem;
  font-weight: 800;
  text-align: right;
}

/* ── Plantilla preview ───────────────────────────────────────────────────── */
.plantilla-preview {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
}

.preview-chip {
  display: inline-flex; align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.72rem; font-weight: 600;
  background: #fbfcfd; color: var(--slate-600);
  border: 1px solid var(--slate-200);
}

.preview-chip--weight {
  background: var(--unap-blue-50); color: var(--unap-blue-700);
  border-color: var(--unap-blue-100);
}

.preview-chip--status { margin-left: auto; }
.chip--ok  { background: #dcfce7; color: #166534; border-color: #86efac; }
.chip--warn { background: #fef9c3; color: #854d0e; border-color: #fde047; }

/* ── Scores row ──────────────────────────────────────────────────────────── */
.scores-row {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2);
}

.score-item {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--slate-50); border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-md);
  transition: border-color 0.15s;
}
.score-item:focus-within { border-color: var(--unap-blue-400); background: white; }

.score-item__dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.score-item--green .score-item__dot { background: #16a34a; }
.score-item--red   .score-item__dot { background: #dc2626; }
.score-item--gray  .score-item__dot { background: var(--slate-400); }

.score-item__label {
  font-size: 0.72rem; font-weight: 600; color: var(--slate-500);
  white-space: nowrap;
}

.score-item__input {
  width: 0; flex: 1; min-width: 0;
  border: none; background: transparent;
  font-size: 0.95rem; font-weight: 700; font-family: var(--font-mono);
  color: var(--slate-800); text-align: right;
  outline: none;
}

.score-item__unit {
  font-size: 0.68rem; font-weight: 600; color: var(--slate-400);
  white-space: nowrap;
}

/* ── Vacantes ────────────────────────────────────────────────────────────── */
.vacantes-list {
  display: flex; flex-direction: column; gap: var(--space-1);
  max-height: 160px; overflow-y: auto;
}

.vacantes-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--slate-50); border: 1px solid var(--slate-100);
  border-radius: var(--radius-md);
}

.vacantes-programa {
  flex: 1; font-size: 0.82rem; color: var(--slate-700); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.vacantes-control {
  display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;
}

.vacantes-input {
  width: 56px; padding: var(--space-1) var(--space-2);
  border: 1.5px solid var(--slate-200); border-radius: var(--radius-sm);
  font-size: 0.875rem; font-family: var(--font-mono); font-weight: 700;
  text-align: center; background: white; color: var(--unap-blue-800);
  transition: border-color 0.15s;
}
.vacantes-input:focus {
  outline: none; border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 2px rgba(0, 64, 128, 0.1);
}

.vacantes-unit {
  font-size: 0.7rem; color: var(--slate-400); font-weight: 500;
}

.mode-note {
  border-color: transparent;
  background: transparent;
  padding-top: var(--space-4);
}

.mode-note__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--unap-blue-800);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
}

/* ── Preflight / Diagnóstico ─────────────────────────────────────────────── */
.section--preflight {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  border-top-width: 3px;
  gap: var(--space-3);
  background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
}
.preflight--error   { border-top-color: var(--error-500);   background: var(--error-50); }
.preflight--warning { border-top-color: #f59e0b;            background: #fffbeb; }
.preflight--ok      { border-top-color: #16a34a;            background: #f0fdf4; }

.preflight-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.preflight-summary__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preflight-summary h3 {
  margin: 0;
  color: var(--slate-900);
  font-size: 1.05rem;
  line-height: 1.3;
}

.status-badge {
  margin-left: auto;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.68rem; font-weight: 700;
  text-transform: none; letter-spacing: 0;
}
.badge--ok    { background: #dcfce7; color: #166534; }
.badge--warn  { background: #fef9c3; color: #854d0e; }
.badge--error { background: var(--error-100); color: var(--error-700); }
.status-badge--large {
  margin-left: 0;
  padding: var(--space-1) var(--space-3);
  font-size: 0.75rem;
  white-space: nowrap;
}

.preflight-items {
  display: flex; flex-direction: column; gap: var(--space-1);
}

.preflight-item {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.7);
  border: 1px solid transparent;
}
.preflight-item--warn  { border-color: #fde68a; }
.preflight-item--error { background: white; border-color: var(--error-200); }

.preflight-item__icon { margin-top: 1px; flex-shrink: 0; }
.preflight-item--ok   .preflight-item__icon { color: #16a34a; }
.preflight-item--warn .preflight-item__icon { color: #d97706; }
.preflight-item--error .preflight-item__icon { color: var(--error-600); }

.preflight-item__body { display: flex; flex-direction: column; gap: 2px; flex: 1; }

.preflight-item__row {
  display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2);
}

.preflight-item__label { font-size: 0.82rem; font-weight: 500; color: var(--slate-600); }
.preflight-item__value { font-size: 0.82rem; font-weight: 700; font-family: var(--font-mono); color: var(--slate-900); }
.preflight-item__detail { font-size: 0.75rem; color: var(--slate-500); margin: 0; line-height: 1.4; }
.preflight-item--warn  .preflight-item__detail { color: #92400e; }
.preflight-item--error .preflight-item__detail { color: var(--error-600); }

/* ── Info banner ─────────────────────────────────────────────────────────── */
.info-banner {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3);
  background: #fffbeb; color: #92400e;
  border: 1px solid #fde68a; border-radius: var(--radius-md);
  font-size: 0.8rem; line-height: 1.5;
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
.alert {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: 0.875rem;
}
.alert--error {
  background: var(--error-50); color: var(--error-700);
  border: 1px solid var(--error-200);
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.modal__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3); padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--slate-200);
  background: white; flex-shrink: 0;
}

.footer__actions { display: flex; align-items: center; gap: var(--space-2); }
.footer-status {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--slate-500);
  font-size: 0.75rem;
}
.footer-status strong {
  color: var(--slate-800);
  font-size: 0.82rem;
}
.footer-status span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.btn__icon { width: 15px; height: 15px; flex-shrink: 0; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.btn--ghost {
  background: transparent; color: var(--slate-500);
  border: 1px solid var(--slate-200);
}
.btn--ghost:hover:not(:disabled) { background: var(--slate-50); color: var(--slate-700); }

.btn--secondary {
  background: transparent; color: var(--unap-blue-700);
  border: 1.5px solid var(--unap-blue-300);
}
.btn--secondary:hover:not(:disabled) {
  background: var(--unap-blue-50); border-color: var(--unap-blue-500);
}

.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255,255,255,0.3);
}
.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

@media (max-width: 760px) {
  .modal-overlay {
    padding: var(--space-3);
  }

  .modal {
    width: 100%;
  }

  .calculation-strip,
  .modal-grid {
    grid-template-columns: 1fr;
  }

  .section--composed {
    padding: var(--space-3);
  }

  .config-shell__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .config-shell__badge {
    white-space: normal;
  }

  .section-block--aside {
    padding-top: var(--space-3);
  }

  .scores-row {
    grid-template-columns: 1fr;
  }

  .modal__footer {
    grid-template-columns: 1fr;
  }

  .footer__actions,
  .modal__footer > .btn {
    width: 100%;
  }

  .footer__actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .footer__actions .btn,
  .modal__footer > .btn {
    width: 100%;
  }
}
</style>
