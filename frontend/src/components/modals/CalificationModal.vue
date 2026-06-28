<script setup>
import { reactive, ref, watch, computed } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

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

        <form class="modal__body" @submit.prevent="runCalification" novalidate>

          <!-- Error de calificación (top) -->
          <div v-if="calification.calificationError" class="alert alert--error">
            <svg viewBox="0 0 16 16" fill="currentColor" width="15" height="15" style="flex-shrink:0">
              <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zM7 6.5a1 1 0 112 0v4a1 1 0 11-2 0V6.5zM8 13a1 1 0 110-2 1 1 0 010 2z" clip-rule="evenodd"/>
            </svg>
            {{ calification.calificationError }}
          </div>

          <!-- ── SECCIÓN 1: Proceso ─────────────────────────────────────── -->
          <div class="section">
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v8a2 2 0 002 2h4a2 2 0 002-2V6.414A2 2 0 0011.414 5L9 2.586A2 2 0 007.586 2H6zm-1 9a1 1 0 011-1h2a1 1 0 110 2H6a1 1 0 01-1-1zm1-4a1 1 0 000 2h2a1 1 0 100-2H6z" clip-rule="evenodd"/>
              </svg>
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

            <div class="field">
              <label>
                Tipo de proceso
                <span v-if="calification.processAreas.length > 0" class="locked-chip">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path fill-rule="evenodd" d="M5 7V5a3 3 0 016 0v2h1a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h1zm4-2v2H7V5a1 1 0 112 0z" clip-rule="evenodd"/></svg>
                  Bloqueado — ya hay áreas calculadas
                </span>
              </label>
              <div class="type-toggle" :class="{ 'type-toggle--locked': calification.processAreas.length > 0 }">
                <button
                  type="button"
                  class="type-opt"
                  :class="{ 'type-opt--active': calification.processType === 'simulacro' }"
                  :disabled="calification.processAreas.length > 0"
                  @click="calification.processType = 'simulacro'"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v8A7.969 7.969 0 015.5 12c1.335 0 2.584.41 3.616 1.108A6.963 6.963 0 0112.5 12c.855 0 1.671.15 2.43.425A7.96 7.96 0 0114 11.5V5.5a7.968 7.968 0 00-2.5-.696V10a1 1 0 11-2 0V4.804z"/>
                  </svg>
                  <span class="type-opt__text">
                    Simulacro
                    <small>Ranking global · tabla plana</small>
                  </span>
                </button>
                <button
                  type="button"
                  class="type-opt type-opt--real"
                  :class="{ 'type-opt--active': calification.processType === 'real' }"
                  :disabled="calification.processAreas.length > 0"
                  @click="calification.processType = 'real'"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v8a2 2 0 002 2h4a2 2 0 002-2V5.414A2 2 0 0011.414 4L9 1.586A2 2 0 007.586 1H6zM5 6a1 1 0 011-1h2a1 1 0 010 2H6a1 1 0 01-1-1zm1 3a1 1 0 000 2h2a1 1 0 100-2H6zm3-3a1 1 0 000 2h.01a1 1 0 100-2H9z" clip-rule="evenodd"/>
                  </svg>
                  <span class="type-opt__text">
                    Convocatoria Real
                    <small>Por carrera · vacantes · ingresantes</small>
                  </span>
                </button>
              </div>
              <p v-if="calification.processAreas.length > 0" class="field-note">
                Para cambiar el tipo, recalcula todas las áreas del proceso.
              </p>

              <div v-if="!isRealMode" class="field">
                <label>
                  Alcance del simulacro
                  <span class="locked-chip">
                    Detectado: {{ calification.inferredSimulacroScope === 'general' ? 'General' : 'Por áreas' }}
                  </span>
                </label>
                <div class="type-toggle" :class="{ 'type-toggle--locked': calification.processAreas.length > 0 }">
                  <button
                    type="button"
                    class="type-opt"
                    :class="{ 'type-opt--active': calification.simulacroScope === 'general' }"
                    :disabled="calification.processAreas.length > 0"
                    @click="calification.simulacroScope = 'general'"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                      <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s1-4 6-4 6 4 6 4H2z"/>
                    </svg>
                    <span class="type-opt__text">
                      General
                      <small>Un ranking para todos</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="type-opt"
                    :class="{ 'type-opt--active': calification.simulacroScope === 'areas' }"
                    :disabled="calification.processAreas.length > 0"
                    @click="calification.simulacroScope = 'areas'"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                      <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5V5H2V3.5zM2 6h5v8H3.5A1.5 1.5 0 012 12.5V6zm6 0h6v6.5a1.5 1.5 0 01-1.5 1.5H8V6z"/>
                    </svg>
                    <span class="type-opt__text">
                      Por áreas
                      <small>Ranking separado por área</small>
                    </span>
                  </button>
                </div>
              </div>

              <div class="mode-summary" :class="isRealMode ? 'mode-summary--real' : 'mode-summary--simulacro'">
                <span class="mode-chip">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882L7.45 9.703 5.28 7.533a.75.75 0 00-1.06 1.061l2.79 2.79a.75.75 0 001.137-.089l3.71-5.104z" clip-rule="evenodd"/>
                  </svg>
                  {{ isRealMode ? 'Tipo P/Q/R/S/T obligatorio' : 'Tipo no requerido' }}
                </span>
                <span class="mode-chip">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <path d="M2 3.75A1.75 1.75 0 013.75 2h8.5A1.75 1.75 0 0114 3.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5zM4 5v1.5h8V5H4zm0 3v1.5h8V8H4zm0 3v1h5v-1H4z"/>
                  </svg>
                  {{ isRealMode ? 'Área y programa requeridos' : isGeneralSimulacro ? 'Padrón sin área permitido' : 'Áreas del padrón' }}
                </span>
                <span class="mode-chip">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <path fill-rule="evenodd" d="M2 13.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0012.5 5h-9A1.5 1.5 0 002 6.5v7zM3.5 6h9a.5.5 0 01.5.5V8H3V6.5a.5.5 0 01.5-.5zM3 9h10v4.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5V9z" clip-rule="evenodd"/>
                    <path d="M5 1a1 1 0 00-1 1v1h2V2a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v1h2V2a1 1 0 00-1-1z"/>
                  </svg>
                  {{ isRealMode ? 'Vacantes por programa' : isGeneralSimulacro ? 'Ranking general' : 'Ranking por área' }}
                </span>
              </div>
            </div>
          </div>

          <!-- ── SECCIÓN 2: Área ────────────────────────────────────────── -->
          <div class="section">
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6A.5.5 0 002 8v5a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1V8a.5.5 0 00-.146-.354l-6-6z"/>
              </svg>
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
          </div>

          <!-- ── SECCIÓN 3: Plantilla y valores ────────────────────────── -->
          <div class="section">
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
              </svg>
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
          <div v-if="isRealMode && calification.programasForCurrentArea.length > 0" class="section">
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 100-6 3 3 0 000 6zM5.978 8.372A5.976 5.976 0 005 9H1s-1 0-1 1 1 3 1 3h3.5c.34-.81.84-1.583 1.478-2.372z"/>
              </svg>
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
          </div>
          <div v-else-if="!isRealMode" class="section mode-note">
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path fill-rule="evenodd" d="M8 16A8 8 0 108 0 8 8 0 008 16zm.75-11.25a.75.75 0 00-1.5 0v4.5c0 .414.336.75.75.75h3a.75.75 0 000-1.5H8.75V4.75z" clip-rule="evenodd"/>
              </svg>
              Salida de simulacro
            </p>
            <div class="mode-note__body">
              <span>Se generará una tabla plana por puntaje total.</span>
              <span>Las vacantes e ingresantes no se aplican en este modo.</span>
            </div>
          </div>

          <!-- ── SECCIÓN 5: Diagnóstico del área ───────────────────────── -->
          <div
            class="section section--preflight"
            :class="{
              'preflight--error':   calification.preflightCheck.hasBlockers,
              'preflight--warning': !calification.preflightCheck.hasBlockers && calification.preflightCheck.hasWarnings,
              'preflight--ok':      !calification.preflightCheck.hasBlockers && !calification.preflightCheck.hasWarnings,
            }"
          >
            <p class="section__label">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm.93-9.412l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 110-2 1 1 0 010 2z" clip-rule="evenodd"/>
              </svg>
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
              :disabled="calification.preflightCheck.hasBlockers"
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
  width: min(580px, 100%);
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

/* ── Body ────────────────────────────────────────────────────────────────── */
.modal__body {
  flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden;
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}

/* ── Secciones ───────────────────────────────────────────────────────────── */
.section {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}

.section__label {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: 0.68rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--slate-400);
  margin: 0; padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--slate-100);
}
.section__label svg { flex-shrink: 0; color: var(--unap-blue-400); }

.section__counter {
  margin-left: auto;
  font-size: 0.7rem; font-weight: 600;
  color: var(--unap-blue-600);
  text-transform: none; letter-spacing: 0;
  background: var(--unap-blue-50);
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
  color: #92400e; background: #fef3c7;
  border: 1px solid #fde68a;
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
  border: 1px solid var(--slate-200);
  background: var(--slate-50);
}

.mode-summary--simulacro {
  border-color: var(--unap-blue-100);
  background: var(--unap-blue-50);
}

.mode-summary--real {
  border-color: #fde68a;
  background: #fffbeb;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--slate-600);
  font-size: 0.72rem;
  font-weight: 700;
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

/* ── Plantilla preview ───────────────────────────────────────────────────── */
.plantilla-preview {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
}

.preview-chip {
  display: inline-flex; align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.72rem; font-weight: 600;
  background: var(--slate-100); color: var(--slate-600);
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
  border-color: var(--unap-blue-100);
  background: var(--unap-blue-50);
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
  border-left-width: 3px;
}
.preflight--error   { border-left-color: var(--error-500);   background: var(--error-50); }
.preflight--warning { border-left-color: #f59e0b;            background: #fffbeb; }
.preflight--ok      { border-left-color: #16a34a;            background: #f0fdf4; }

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
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-3); padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--slate-200);
  background: white; flex-shrink: 0;
}

.footer__actions { display: flex; align-items: center; gap: var(--space-2); }

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
</style>
