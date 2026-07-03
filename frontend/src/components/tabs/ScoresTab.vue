<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { formatTimestamp } from '@/utils/helpers'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import Toolbar from '@/components/shared/Toolbar.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import CandidateDetailModal from '@/components/shared/CandidateDetailModal.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'

const props = defineProps({
  calification: { type: Object, required: true },
  ponderations: { type: Object, required: true },
  dashboard: { type: Object, required: true },
  exporter: { type: Object, required: true },
  convocatoriaName: { type: String, default: '' },
  onSaveToHistory: { type: Function, default: null },
  vacantesPrograma: { type: Object, default: null },
})

const calification = reactive(props.calification)
const ponderations = reactive(props.ponderations)

const emit = defineEmits(['openModal', 'openDashboard'])

function openModal() { emit('openModal') }

// ── Guardar con nombre editable ──────────────────────────────────────────────

const savingName = ref(false)
const saveNameInput = ref('')

function handleSaveToHistory() {
  saveNameInput.value = props.convocatoriaName || calification.processName || ''
  savingName.value = true
}

function confirmSaveName() {
  props.onSaveToHistory?.(saveNameInput.value.trim() || saveNameInput.value)
  savingName.value = false
}

function cancelSaveName() {
  savingName.value = false
}

// ── Confirmación inline ──────────────────────────────────────────────────────

const pendingAction = ref(null)

function handleNewProcess() {
  pendingAction.value = {
    type: 'newProcess',
    message: '¿Iniciar un nuevo proceso? Los resultados actuales quedarán en el historial solo si los guardaste antes.',
  }
}

function handleReset() {
  pendingAction.value = {
    type: 'reset',
    message: '¿Limpiar todos los resultados? Esta acción no se puede deshacer.',
  }
}

function confirmPendingAction() {
  if (pendingAction.value?.type === 'newProcess') calification.startNewProcess()
  if (pendingAction.value?.type === 'reset') calification.resetCalificationResults()
  pendingAction.value = null
}

function cancelPendingAction() {
  pendingAction.value = null
}

// ── Dashboard stats del área actual ─────────────────────────────────────────

const currentAreaStats = computed(() => {
  const area = calification.calificationDisplayArea
  if (!area) return null
  return props.dashboard.statsByArea.value?.get(area) ?? null
})

const hasIngresanteData = computed(() =>
  (currentAreaStats.value?.ingresantes ?? 0) > 0
)

const issueCount = computed(() => {
  const summary = calification.calificationSummary
  if (!summary) return 0
  return (summary.missingResponses || 0) +
    (summary.missingKeys || 0) +
    (summary.duplicateResponses || 0) +
    (summary.invalidCandidates || 0) +
    (summary.missingPrograms || 0) +
    (summary.invalidResponseTypes || 0) +
    (summary.unlinkedResponses || 0)
})

const noCalificados = computed(() =>
  Array.isArray(calification.calificationSummary?.noCalificados)
    ? calification.calificationSummary.noCalificados
    : []
)

const noCalificadosByMotivo = computed(() => {
  const counts = new Map()
  noCalificados.value.forEach((row) => {
    const motivo = row.motivo || 'Sin motivo'
    counts.set(motivo, (counts.get(motivo) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([motivo, count]) => ({ motivo, count }))
})

// ── Filtros locales ──────────────────────────────────────────────────────────

const filterPrograma = ref('')
const filterEstado = ref('todos') // 'todos' | 'ingresante' | 'no-ingresante'

const programasEnArea = computed(() => {
  const set = new Set()
  calification.calificationResults.forEach((r) => {
    if (r.programa) set.add(r.programa)
  })
  return Array.from(set).sort()
})

const localFilteredResults = computed(() => {
  let rows = calification.calificationFilteredResults
  if (filterPrograma.value) {
    rows = rows.filter((r) => r.programa === filterPrograma.value)
  }
  if (filterEstado.value === 'ingresante') {
    rows = rows.filter((r) => r.isIngresante)
  } else if (filterEstado.value === 'no-ingresante') {
    rows = rows.filter((r) => !r.isIngresante)
  }
  return rows
})

const hasActiveFilters = computed(() => filterPrograma.value || filterEstado.value !== 'todos')
const resultsPage = ref(1)
const resultsPageSize = ref(10)
const groupPages = ref(new Map())

const pagedResults = computed(() => {
  const start = (resultsPage.value - 1) * resultsPageSize.value
  return localFilteredResults.value.slice(start, start + resultsPageSize.value)
})

watch(
  [localFilteredResults, () => calification.calificationDisplayArea, resultsPageSize],
  () => {
    resultsPage.value = 1
    groupPages.value = new Map()
  },
)

function getGroupPage(programa) {
  return groupPages.value.get(programa) || 1
}

function setGroupPage(programa, page) {
  const next = new Map(groupPages.value)
  next.set(programa, page)
  groupPages.value = next
}

function pagedGroupResults(group) {
  const start = (getGroupPage(group.programa) - 1) * resultsPageSize.value
  return group.results.slice(start, start + resultsPageSize.value)
}

function clearFilters() {
  filterPrograma.value = ''
  filterEstado.value = 'todos'
}

// ── Modo Real: vista agrupada por carrera ────────────────────────────────────

const isRealMode = computed(() => calification.activeProcess?.type === 'real')

const groupedResults = computed(() => {
  if (!isRealMode.value) return []
  const map = new Map()
  localFilteredResults.value.forEach((r) => {
    const prog = r.programa?.trim() || '(Sin programa)'
    if (!map.has(prog)) map.set(prog, [])
    map.get(prog).push(r)
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === '(Sin programa)') return 1
      if (b === '(Sin programa)') return -1
      return a.localeCompare(b, 'es')
    })
    .map(([programa, results]) => {
      const vacantes = props.vacantesPrograma?.vacantesPrograma?.value?.[programa] ?? 0
      const ingresantes = results.filter((r) => r.isIngresante).length
      return { programa, results, vacantes, ingresantes }
    })
})

// ── Acordeón carreras (modo real) ────────────────────────────────────────────
const collapsedCarreras = ref(new Set())
const initializedCarreras = new Set()

watch(groupedResults, (groups) => {
  const next = new Set(collapsedCarreras.value)
  groups.forEach(({ programa }) => {
    if (!initializedCarreras.has(programa)) {
      initializedCarreras.add(programa)
      next.add(programa)
    }
  })
  collapsedCarreras.value = next
}, { immediate: true })

function toggleCarrera(programa) {
  const s = new Set(collapsedCarreras.value)
  s.has(programa) ? s.delete(programa) : s.add(programa)
  collapsedCarreras.value = s
}

function isCollapsed(programa) {
  return collapsedCarreras.value.has(programa)
}

function collapseAllCarreras() {
  collapsedCarreras.value = new Set(groupedResults.value.map((group) => group.programa))
}

function expandAllCarreras() {
  collapsedCarreras.value = new Set()
}

// ── Detalle candidato ────────────────────────────────────────────────────────
const detailCandidate = ref(null)

function openDetail(row) {
  detailCandidate.value = row
}
function closeDetail() {
  detailCandidate.value = null
}

// ── Export ───────────────────────────────────────────────────────────────────

function handleExportExcel() {
  props.exporter.exportScoresToExcel(
    localFilteredResults.value,
    props.convocatoriaName,
    {
      processType: calification.activeProcess?.type ?? 'simulacro',
      area: calification.calificationDisplayArea,
      areaSummary: calification.calificationSummary,
      areaStats: currentAreaStats.value,
    },
  )
}

function handleExportPdf() {
  props.exporter.exportScoresToPdf(
    localFilteredResults.value,
    { statsByArea: props.dashboard.statsByArea.value },
    props.convocatoriaName,
    {
      processType: calification.activeProcess?.type ?? 'simulacro',
      area: calification.calificationDisplayArea,
      areaSummary: calification.calificationSummary,
    },
  )
}

function handleExportIngresantesPdf() {
  props.exporter.exportIngresantesPdf(
    localFilteredResults.value,
    { statsByArea: props.dashboard.statsByArea.value },
    props.convocatoriaName,
    calification.activeProcess?.type ?? 'simulacro'
  )
}
</script>

<template>
  <section class="tab-content">
    <StepInfoCard
      v-if="!calification.calificationHasResults"
      title="Calificación Final"
      description="Genera los puntajes aplicando las ponderaciones a las respuestas de los postulantes."
      variant="gold"
      :stats="calification.calificationHasResults
        ? calification.processAreas.map(area => ({
            value: (calification.activeProcess?.areas?.[area]?.results?.length ?? 0),
            label: area
          }))
        : []"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </template>
    </StepInfoCard>

    <!-- Toolbar -->
    <Toolbar
      v-if="!calification.calificationHasResults"
      v-model:search-value="calification.calificationSearch"
      search-placeholder="Buscar por DNI o nombres"
      :total-rows="calification.calificationResults.length"
      :filtered-count="calification.calificationFilteredResults.length"
    >
      <template #actions>
        <button type="button" class="btn btn--gold" @click="openModal" :disabled="!calification.canCalify">
          <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          Calcular Puntajes
        </button>

      </template>
      <template #metrics>
        <span class="metric">
          <span class="metric__value">{{ ponderations.ponderationCurrentTotals.questions }}/60</span>
          <span class="metric__label">preguntas</span>
        </span>
      </template>
    </Toolbar>

    <!-- Cabecera operativa compacta -->
    <section v-if="calification.calificationHasResults" class="results-shell">
      <header class="results-header">
        <div class="results-header__identity">
          <span class="results-header__eyebrow">Resultados de calificación</span>
          <h2>{{ calification.processName || 'Proceso sin nombre' }}</h2>
          <div class="results-header__context">
            <span>{{ calification.calificationDisplayArea }}</span>
            <span>·</span>
            <span>{{ isRealMode ? 'Convocatoria real' : 'Simulacro' }}</span>
            <span>·</span>
            <span>{{ formatTimestamp(calification.calificationSummary?.timestamp) }}</span>
          </div>
        </div>

        <div class="results-header__actions">
          <button type="button" class="btn btn--ghost" @click="openModal" :disabled="!calification.canCalify">
            Recalcular
          </button>
          <button
            v-if="onSaveToHistory && !savingName"
            type="button"
            class="btn btn--primary"
            @click="handleSaveToHistory"
          >
            Guardar
          </button>

          <details class="action-menu">
            <summary class="btn btn--ghost">Exportar <span aria-hidden="true">▾</span></summary>
            <div class="action-menu__panel">
              <button type="button" @click="handleExportExcel">Exportar Excel</button>
              <button type="button" @click="handleExportPdf">Exportar PDF completo</button>
              <button v-if="isRealMode && hasIngresanteData" type="button" @click="handleExportIngresantesPdf">PDF de ingresantes</button>
            </div>
          </details>

          <details class="action-menu action-menu--right">
            <summary class="btn btn--ghost btn--icon" aria-label="Más acciones">•••</summary>
            <div class="action-menu__panel">
              <button type="button" @click="emit('openDashboard')">Ver estadísticas completas</button>
              <button type="button" @click="handleNewProcess">Iniciar nuevo proceso</button>
              <button type="button" class="action-menu__danger" @click="handleReset">Limpiar resultados</button>
            </div>
          </details>
        </div>
      </header>

      <div v-if="savingName" class="save-inline">
        <label for="result-save-name">Nombre para el historial</label>
        <input
          id="result-save-name"
          v-model="saveNameInput"
          type="text"
          class="save-name-input"
          @keyup.enter="confirmSaveName"
          @keyup.escape="cancelSaveName"
          autofocus
        />
        <button type="button" class="btn btn--primary" @click="confirmSaveName">Confirmar</button>
        <button type="button" class="btn btn--ghost" @click="cancelSaveName">Cancelar</button>
      </div>

      <nav v-if="calification.processAreas.length > 1" class="area-tabs area-tabs--compact" aria-label="Áreas calificadas">
        <button
          v-for="area in calification.processAreas"
          :key="area"
          type="button"
          class="area-tab"
          :class="{ 'area-tab--active': calification.calificationDisplayArea === area }"
          @click="calification.switchDisplayArea(area)"
        >
          {{ area }}
          <span class="area-tab__count">{{ calification.activeProcess?.areas?.[area]?.results?.length ?? 0 }}</span>
        </button>
      </nav>

      <div class="summary-strip">
        <div class="summary-item">
          <strong>{{ calification.calificationSummary?.totalCandidates ?? 0 }}</strong>
          <span>Postulantes</span>
        </div>
        <div class="summary-item summary-item--success" v-if="currentAreaStats">
          <strong>{{ currentAreaStats.ingresantes }}</strong>
          <span>Ingresantes</span>
        </div>
        <div class="summary-item" v-if="currentAreaStats">
          <strong class="mono">{{ currentAreaStats.avg.toFixed(3) }}</strong>
          <span>Promedio</span>
        </div>
        <div class="summary-item" :class="{ 'summary-item--warning': issueCount > 0 }">
          <strong>{{ issueCount }}</strong>
          <span>Observaciones</span>
        </div>
      </div>

      <details class="calculation-details">
        <summary>Detalles del cálculo</summary>
        <div class="calculation-details__grid">
          <span><strong>Puntaje máximo:</strong> {{ currentAreaStats?.max?.toFixed(3) ?? '—' }}</span>
          <span><strong>Puntaje mínimo:</strong> {{ currentAreaStats?.min?.toFixed(3) ?? '—' }}</span>
          <span><strong>Peso total:</strong> {{ calification.calificationSummary?.totalWeight?.toFixed(3) }}</span>
          <span><strong>Preguntas:</strong> {{ calification.calificationSummary?.answersLength }}</span>
          <span v-if="calification.calificationSummary?.missingResponses" class="meta-warn">Sin respuesta: {{ calification.calificationSummary.missingResponses }}</span>
          <span v-if="calification.calificationSummary?.missingKeys" class="meta-warn">Sin clave: {{ calification.calificationSummary.missingKeys }}</span>
          <span v-if="calification.calificationSummary?.duplicateResponses" class="meta-warn">Duplicados: {{ calification.calificationSummary.duplicateResponses }}</span>
          <span v-if="calification.calificationSummary?.invalidCandidates" class="meta-warn">DNI observado: {{ calification.calificationSummary.invalidCandidates }}</span>
          <span v-if="calification.calificationSummary?.missingPrograms" class="meta-warn">Sin programa: {{ calification.calificationSummary.missingPrograms }}</span>
          <span v-if="calification.calificationSummary?.invalidResponseTypes" class="meta-warn">Tipo inválido: {{ calification.calificationSummary.invalidResponseTypes }}</span>
          <span v-if="calification.calificationSummary?.unlinkedResponses" class="meta-warn">Sin DNI vinculado: {{ calification.calificationSummary.unlinkedResponses }}</span>
        </div>
      </details>

      <section v-if="noCalificados.length" class="not-qualified-panel">
        <div class="not-qualified-panel__header">
          <div>
            <span class="not-qualified-panel__eyebrow">No calificados</span>
            <h3>{{ noCalificados.length }} postulante(s) quedaron fuera del cálculo</h3>
          </div>
          <button type="button" class="btn btn--ghost" @click="handleExportExcel">
            Exportar Excel
          </button>
        </div>

        <div class="not-qualified-panel__chips">
          <span v-for="item in noCalificadosByMotivo" :key="item.motivo" class="not-qualified-chip">
            <strong>{{ item.count }}</strong> {{ item.motivo }}
          </span>
        </div>

        <div class="not-qualified-table-wrap">
          <table class="not-qualified-table">
            <thead>
              <tr>
                <th>DNI</th>
                <th>Apellidos y nombres</th>
                <th>Área</th>
                <th>Programa</th>
                <th>Motivo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in noCalificados" :key="`${row.dni}-${row.motivo}-${row.detalle}`">
                <td class="mono">{{ row.dni || '—' }}</td>
                <td>{{ [row.paterno, row.materno, row.nombres].filter(Boolean).join(' ') || '—' }}</td>
                <td>{{ row.area || '—' }}</td>
                <td>{{ row.programa || '—' }}</td>
                <td><span class="not-qualified-reason">{{ row.motivo || 'Sin motivo' }}</span></td>
                <td>{{ row.detalle || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="not-qualified-panel__hint">
          El Excel de resultados incluye una hoja “No calificados” con este detalle.
        </p>
      </section>

      <div class="results-filters">
        <div class="results-search">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9 3a6 6 0 104.472 10.001l3.264 3.263a1 1 0 001.414-1.414l-3.263-3.264A6 6 0 009 3zm-4 6a4 4 0 118 0 4 4 0 01-8 0z" clip-rule="evenodd"/></svg>
          <input v-model="calification.calificationSearch" type="search" placeholder="Buscar por DNI o nombre" />
        </div>
        <select v-model="filterPrograma" class="filter-select" aria-label="Filtrar por programa">
          <option value="">Todos los programas</option>
          <option v-for="prog in programasEnArea" :key="prog" :value="prog">{{ prog }}</option>
        </select>
        <div v-if="hasIngresanteData" class="filter-toggle" aria-label="Filtrar por estado">
          <button type="button" class="filter-toggle__btn" :class="{ active: filterEstado === 'todos' }" @click="filterEstado = 'todos'">Todos</button>
          <button type="button" class="filter-toggle__btn filter-toggle__btn--green" :class="{ active: filterEstado === 'ingresante' }" @click="filterEstado = 'ingresante'">Ingresantes</button>
          <button type="button" class="filter-toggle__btn filter-toggle__btn--red" :class="{ active: filterEstado === 'no-ingresante' }" @click="filterEstado = 'no-ingresante'">No ingresantes</button>
        </div>
        <span class="results-count"><strong>{{ localFilteredResults.length }}</strong> de {{ calification.calificationResults.length }}</span>
        <button v-if="hasActiveFilters" type="button" class="btn-clear-filters" @click="clearFilters">Limpiar</button>
      </div>
    </section>

    <!-- Nombre del proceso activo -->
    <div v-if="false" class="process-name-bar">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd"/>
      </svg>
      <span class="process-name-bar__label">Proceso:</span>
      <span class="process-name-bar__name">{{ calification.processName || 'Sin nombre' }}</span>
    </div>

    <!-- Banner de confirmación inline -->
    <div v-if="pendingAction" class="confirm-banner">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span>{{ pendingAction.message }}</span>
      <div class="confirm-banner__actions">
        <button type="button" class="btn btn--ghost btn--sm" @click="cancelPendingAction">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" @click="confirmPendingAction">Confirmar</button>
      </div>
    </div>

    <!-- Tabs de áreas calculadas -->
    <div v-if="false" class="area-tabs">
      <button
        v-for="area in calification.processAreas"
        :key="area"
        type="button"
        class="area-tab"
        :class="{ 'area-tab--active': calification.calificationDisplayArea === area }"
        @click="calification.switchDisplayArea(area)"
      >
        {{ area }}
        <span class="area-tab__count">
          {{ calification.activeProcess?.areas?.[area]?.results?.length ?? 0 }}
        </span>
      </button>
    </div>

    <!-- Panel de estadísticas del área actual -->
    <div v-if="false" class="stats-panel">
      <!-- Fila 1: stats numéricas -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-card__value">{{ calification.calificationSummary.totalCandidates }}</span>
          <span class="stat-card__label">Postulantes</span>
        </div>
        <div class="stat-card stat-card--green" v-if="currentAreaStats">
          <span class="stat-card__value">{{ currentAreaStats.ingresantes }}</span>
          <span class="stat-card__label">Ingresantes</span>
        </div>
        <div class="stat-card stat-card--red" v-if="currentAreaStats">
          <span class="stat-card__value">{{ currentAreaStats.count - currentAreaStats.ingresantes }}</span>
          <span class="stat-card__label">No ingresantes</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.max.toFixed(3) }}</span>
          <span class="stat-card__label">Puntaje máx.</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.avg.toFixed(3) }}</span>
          <span class="stat-card__label">Promedio</span>
        </div>
        <div class="stat-card" v-if="currentAreaStats">
          <span class="stat-card__value mono">{{ currentAreaStats.min.toFixed(3) }}</span>
          <span class="stat-card__label">Puntaje mín.</span>
        </div>
      </div>

      <!-- Fila 2: meta del proceso -->
      <div class="stats-meta">
        <span>
          <strong>Área:</strong> {{ calification.calificationSummary.area }}
        </span>
        <span>
          <strong>Cálculo:</strong> {{ formatTimestamp(calification.calificationSummary.timestamp) }}
        </span>
        <span>
          <strong>Ponderación:</strong>
          {{ calification.calificationSummary.totalWeight.toFixed(3) }} peso ·
          {{ calification.calificationSummary.answersLength }} preguntas
        </span>
        <span v-if="calification.calificationSummary.missingResponses" class="meta-warn">
          Sin respuesta: {{ calification.calificationSummary.missingResponses }}
        </span>
        <span v-if="calification.calificationSummary.missingKeys" class="meta-warn">
          Sin clave: {{ calification.calificationSummary.missingKeys }}
        </span>
        <span v-if="calification.calificationSummary.invalidCandidates" class="meta-warn">
          DNI observado: {{ calification.calificationSummary.invalidCandidates }}
        </span>
        <span v-if="calification.calificationSummary.missingPrograms" class="meta-warn">
          Sin programa: {{ calification.calificationSummary.missingPrograms }}
        </span>
        <span v-if="calification.calificationSummary.invalidResponseTypes" class="meta-warn">
          Tipo inválido: {{ calification.calificationSummary.invalidResponseTypes }}
        </span>
      </div>

      <div v-if="calification.calificationSummary.unlinkedResponses > 0" class="alert alert--warning">
        <strong>Atención:</strong> {{ calification.calificationSummary.unlinkedResponses }} respuestas sin DNI vinculado.
        <small> Carga el Paso 2 (Identificadores) para vincularlas.</small>
      </div>
    </div>

    <!-- Filtros -->
    <div v-if="false" class="filter-bar">
      <div class="filter-bar__left">
        <!-- Filtro programa -->
        <div class="filter-group">
          <label class="filter-label">Programa</label>
          <select v-model="filterPrograma" class="filter-select">
            <option value="">Todos los programas</option>
            <option v-for="prog in programasEnArea" :key="prog" :value="prog">{{ prog }}</option>
          </select>
        </div>

        <!-- Filtro estado -->
        <div v-if="hasIngresanteData" class="filter-group">
          <label class="filter-label">Estado</label>
          <div class="filter-toggle">
            <button type="button" class="filter-toggle__btn" :class="{ active: filterEstado === 'todos' }" @click="filterEstado = 'todos'">Todos</button>
            <button type="button" class="filter-toggle__btn filter-toggle__btn--green" :class="{ active: filterEstado === 'ingresante' }" @click="filterEstado = 'ingresante'">Ingresantes</button>
            <button type="button" class="filter-toggle__btn filter-toggle__btn--red" :class="{ active: filterEstado === 'no-ingresante' }" @click="filterEstado = 'no-ingresante'">No ingresantes</button>
          </div>
        </div>
      </div>

      <div class="filter-bar__right">
        <span class="filter-count">
          <strong>{{ localFilteredResults.length }}</strong> de {{ calification.calificationResults.length }}
        </span>
        <button v-if="hasActiveFilters" type="button" class="btn-clear-filters" @click="clearFilters">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          Limpiar filtros
        </button>
      </div>
    </div>

    <!-- Badge modo real -->
    <div v-if="false" class="mode-badge">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd"/>
      </svg>
      Convocatoria Real — resultados agrupados por carrera
    </div>

    <!-- ── Tabla PLANA (Simulacro) ──────────────────────────────────────────── -->
    <section class="table-wrapper" v-if="calification.calificationHasResults && !isRealMode">
      <table>
        <thead>
          <tr>
            <th class="col-number">#</th>
            <th>DNI</th>
            <th>Ap. Paterno</th>
            <th>Ap. Materno</th>
            <th>Nombres</th>
            <th>Programa</th>
            <th class="col-score">Puntaje</th>
            <th v-if="hasIngresanteData" class="col-status">Estado</th>
            <th class="col-detail"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pagedResults"
            :key="row.id"
            :class="{ 'row--ingresante': row.isIngresante }"
          >
            <td class="col-number">{{ row.position }}</td>
            <td class="mono">{{ row.dni }}</td>
            <td>{{ row.paterno || '—' }}</td>
            <td>{{ row.materno || '—' }}</td>
            <td>{{ row.nombres || '—' }}</td>
            <td class="col-programa">{{ row.programa || '—' }}</td>
            <td class="col-score">
              <span class="score-badge" :class="{ 'score-badge--ingresante': row.isIngresante }">
                {{ row.score.toFixed(3) }}
              </span>
            </td>
            <td v-if="hasIngresanteData" class="col-status">
              <span class="status-chip" :class="row.isIngresante ? 'status-chip--in' : 'status-chip--out'">
                {{ row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE' }}
              </span>
            </td>
            <td class="col-detail">
              <button
                class="btn-detail"
                title="Ver detalle pregunta por pregunta"
                :disabled="!row.answersRaw"
                @click="openDetail(row)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <PaginationBar
      v-if="calification.calificationHasResults && !isRealMode"
      v-model:page="resultsPage"
      v-model:page-size="resultsPageSize"
      :total-items="localFilteredResults.length"
    />

    <!-- ── Tabla AGRUPADA por carrera (Convocatoria Real) ──────────────────── -->
    <template v-if="calification.calificationHasResults && isRealMode">
      <div class="group-view-actions">
        <span>{{ groupedResults.length }} programas</span>
        <button type="button" @click="expandAllCarreras">Expandir todos</button>
        <button type="button" @click="collapseAllCarreras">Colapsar todos</button>
      </div>
      <div
        v-for="group in groupedResults"
        :key="group.programa"
        class="carrera-section"
      >
        <!-- Encabezado de carrera -->
        <div class="carrera-header" @click="toggleCarrera(group.programa)" style="cursor:pointer">
          <div class="carrera-header__left">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
            </svg>
            <span class="carrera-header__name">{{ group.programa }}</span>
          </div>
          <div class="carrera-header__stats">
            <span class="carrera-stat">
              <strong>{{ group.results.length }}</strong> postulantes
            </span>
            <span v-if="group.vacantes > 0" class="carrera-stat carrera-stat--vacantes">
              <strong>{{ group.vacantes }}</strong> vacantes
            </span>
            <span class="carrera-stat carrera-stat--in">
              <strong>{{ group.ingresantes }}</strong> ingresantes
            </span>
            <span class="carrera-stat carrera-stat--out">
              <strong>{{ group.results.length - group.ingresantes }}</strong> no ingresantes
            </span>
            <svg
              class="carrera-caret"
              :class="{ 'carrera-caret--open': !isCollapsed(group.programa) }"
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>

        <!-- Tabla de la carrera (colapsable) -->
        <div v-show="!isCollapsed(group.programa)" class="carrera-table-wrap">
        <table class="carrera-table">
          <thead>
            <tr>
              <th class="col-number">#</th>
              <th>DNI</th>
              <th>Ap. Paterno</th>
              <th>Ap. Materno</th>
              <th>Nombres</th>
              <th class="col-score">Puntaje</th>
              <th class="col-status">Estado</th>
              <th class="col-detail"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pagedGroupResults(group)"
              :key="row.id"
              :class="{ 'row--ingresante': row.isIngresante }"
            >
              <td class="col-number">{{ row.positionInPrograma }}</td>
              <td class="mono">{{ row.dni }}</td>
              <td>{{ row.paterno || '—' }}</td>
              <td>{{ row.materno || '—' }}</td>
              <td>{{ row.nombres || '—' }}</td>
              <td class="col-score">
                <span class="score-badge" :class="{ 'score-badge--ingresante': row.isIngresante }">
                  {{ row.score.toFixed(3) }}
                </span>
              </td>
              <td class="col-status">
                <span class="status-chip" :class="row.isIngresante ? 'status-chip--in' : 'status-chip--out'">
                  {{ row.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE' }}
                </span>
              </td>
              <td class="col-detail">
                <button
                  class="btn-detail"
                  title="Ver detalle pregunta por pregunta"
                  :disabled="!row.answersRaw"
                  @click="openDetail(row)"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <PaginationBar
          v-if="!isCollapsed(group.programa)"
          :page="getGroupPage(group.programa)"
          :page-size="resultsPageSize"
          :total-items="group.results.length"
          @update:page="setGroupPage(group.programa, $event)"
          @update:page-size="resultsPageSize = $event"
        />
      </div>
    </template>

    <EmptyState
      v-if="!calification.calificationHasResults"
      title="Sin resultados de calificación"
      description="Haz clic en 'Calcular Puntajes' para ejecutar la calificación con las ponderaciones configuradas."
      icon="time"
    />

  </section>

  <!-- Modal detalle candidato -->
  <CandidateDetailModal
    v-if="detailCandidate"
    :candidate="detailCandidate"
    :summary="calification.activeProcess?.areas?.[detailCandidate.area]?.summary ?? null"
    :convocatoria-name="convocatoriaName"
    @close="closeDetail"
  />
</template>

<style scoped>
.tab-content {
  display: flex; flex-direction: column; gap: var(--space-6);
  animation: slideUp 0.4s ease-out;
  min-width: 0;
}

/* Compact results workspace */
.results-shell {
  display: flex; flex-direction: column; gap: var(--space-4);
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  min-width: 0; max-width: 100%;
}
.results-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--space-5);
}
.results-header__identity { min-width: 0; }
.results-header__eyebrow {
  display: block; margin-bottom: var(--space-1); color: var(--unap-blue-600);
  font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
}
.results-header h2 {
  margin: 0; color: var(--slate-900); font-size: 1.35rem; line-height: 1.25;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.results-header__context {
  display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2);
  color: var(--slate-500); font-size: 0.8rem;
}
.results-header__actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.btn--icon { min-width: 40px; justify-content: center; letter-spacing: 0.08em; }

.action-menu { position: relative; }
.action-menu summary { list-style: none; cursor: pointer; user-select: none; }
.action-menu summary::-webkit-details-marker { display: none; }
.action-menu__panel {
  position: absolute; z-index: 30; top: calc(100% + 6px); left: 0;
  min-width: 220px; padding: var(--space-2); background: white;
  border: 1px solid var(--slate-200); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}
.action-menu--right .action-menu__panel { left: auto; right: 0; }
.action-menu__panel button {
  display: block; width: 100%; padding: var(--space-2) var(--space-3);
  border: 0; border-radius: var(--radius-md); background: transparent;
  color: var(--slate-700); text-align: left; font-size: 0.85rem; cursor: pointer;
}
.action-menu__panel button:hover { background: var(--slate-100); }
.action-menu__panel .action-menu__danger { color: #dc2626; }
.action-menu__panel .action-menu__danger:hover { background: #fef2f2; }

.save-inline {
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
  padding: var(--space-3); background: var(--unap-blue-50); border-radius: var(--radius-lg);
}
.save-inline label { font-size: 0.8rem; font-weight: 700; color: var(--unap-blue-800); }
.save-inline .save-name-input { flex: 1; min-width: 220px; }

.area-tabs--compact { padding: var(--space-1); border: 0; box-shadow: none; background: var(--slate-50); }
.area-tabs--compact .area-tab { flex: 1; justify-content: center; }

.summary-strip {
  display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr));
  border: 1px solid var(--slate-200); border-radius: var(--radius-lg); overflow: hidden;
}
.summary-item {
  display: flex; flex-direction: column; gap: 2px; padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--slate-200); background: var(--slate-50);
}
.summary-item:last-child { border-right: 0; }
.summary-item strong { color: var(--slate-900); font-size: 1.15rem; }
.summary-item span { color: var(--slate-500); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
.summary-item--success strong { color: #15803d; }
.summary-item--warning { background: #fffbeb; }
.summary-item--warning strong, .summary-item--warning span { color: #b45309; }

.calculation-details { border-top: 1px solid var(--slate-100); padding-top: var(--space-3); }
.calculation-details summary {
  width: fit-content; color: var(--unap-blue-700); font-size: 0.82rem;
  font-weight: 700; cursor: pointer;
}
.calculation-details__grid {
  display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-6);
  margin-top: var(--space-3); padding: var(--space-3); background: var(--slate-50);
  border-radius: var(--radius-lg); color: var(--slate-600); font-size: 0.82rem;
}

.not-qualified-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
  border-radius: var(--radius-lg);
  background: #fef2f2;
}

.not-qualified-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.not-qualified-panel__eyebrow {
  display: block;
  margin-bottom: var(--space-1);
  color: #b91c1c;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.not-qualified-panel h3 {
  margin: 0;
  color: #7f1d1d;
  font-size: 0.98rem;
  line-height: 1.3;
}

.not-qualified-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.not-qualified-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid #fecaca;
  border-radius: var(--radius-full);
  background: white;
  color: #991b1b;
  font-size: 0.78rem;
  font-weight: 600;
}

.not-qualified-chip strong {
  color: #7f1d1d;
  font-family: var(--font-mono);
}

.not-qualified-table-wrap {
  overflow-x: auto;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  background: white;
}

.not-qualified-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.not-qualified-table th {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid #fecaca;
  background: #fff7f7;
  color: #991b1b;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.not-qualified-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--slate-100);
  color: var(--slate-700);
  vertical-align: top;
}

.not-qualified-table tr:last-child td {
  border-bottom: 0;
}

.not-qualified-reason {
  display: inline-flex;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.not-qualified-panel__hint {
  margin: 0;
  color: #991b1b;
  font-size: 0.78rem;
}

.results-filters {
  display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
  padding-top: var(--space-4); border-top: 1px solid var(--slate-200);
}
.results-search {
  display: flex; align-items: center; gap: var(--space-2); flex: 1; min-width: 240px;
  padding: 0 var(--space-3); border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); background: var(--slate-50);
}
.results-search:focus-within { border-color: var(--unap-blue-400); background: white; }
.results-search svg { width: 17px; color: var(--slate-400); }
.results-search input {
  width: 100%; padding: var(--space-2) 0; border: 0; outline: 0;
  background: transparent; color: var(--slate-800); font-size: 0.875rem;
}
.results-filters .filter-select { min-width: 180px; max-width: 240px; }
.results-count { margin-left: auto; color: var(--slate-500); font-size: 0.82rem; white-space: nowrap; }
.results-count strong { color: var(--unap-blue-700); }

.group-view-actions {
  display: flex; justify-content: flex-end; align-items: center; gap: var(--space-3);
  margin-top: calc(var(--space-2) * -1); color: var(--slate-500); font-size: 0.8rem;
}
.group-view-actions button {
  border: 0; background: transparent; color: var(--unap-blue-700);
  font-weight: 700; cursor: pointer;
}
.group-view-actions button:hover { text-decoration: underline; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Nombre del proceso activo */
.process-name-bar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, var(--unap-gold-50) 0%, #fefdf0 100%);
  border: 1px solid var(--unap-gold-200);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
}
.process-name-bar svg { width: 16px; height: 16px; color: var(--unap-gold-600); flex-shrink: 0; }
.process-name-bar__label { font-weight: 600; color: var(--unap-gold-600); }
.process-name-bar__name { color: var(--unap-blue-800); font-weight: 700; }

/* Input nombre al guardar */
.save-name-input {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--unap-blue-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  width: 220px;
  outline: none;
}
.save-name-input:focus { border-color: var(--unap-blue-500); box-shadow: 0 0 0 2px var(--unap-blue-100); }

/* Confirm banner */
.confirm-banner {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: #fff8e1; border: 1px solid #f59e0b;
  border-radius: var(--radius-lg);
  font-size: 0.875rem; color: #92400e; flex-wrap: wrap;
}
.confirm-banner svg { width: 18px; height: 18px; flex-shrink: 0; color: #f59e0b; }
.confirm-banner span { flex: 1; min-width: 200px; }
.confirm-banner__actions { display: flex; gap: var(--space-2); }

/* Area tabs */
.area-tabs {
  display: flex; gap: var(--space-2); flex-wrap: wrap;
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg); padding: var(--space-2);
  box-shadow: var(--shadow-sm);
}
.area-tab {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: var(--slate-50); color: var(--slate-600);
  font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast);
}
.area-tab:hover { background: var(--unap-blue-50); border-color: var(--unap-blue-200); color: var(--unap-blue-700); }
.area-tab--active {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  border-color: var(--unap-blue-600); color: white;
}
.area-tab__count {
  background: rgba(255,255,255,0.25); border-radius: var(--radius-full);
  padding: 0 var(--space-2); font-size: 0.75rem; font-weight: 700;
  min-width: 20px; text-align: center;
}
.area-tab:not(.area-tab--active) .area-tab__count { background: var(--slate-200); color: var(--slate-600); }

/* Stats panel */
.stats-panel {
  display: flex; flex-direction: column; gap: var(--space-3);
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex; flex-direction: column; gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50); border: 1px solid var(--slate-100);
  border-radius: var(--radius-lg); text-align: center;
}
.stat-card--green { background: #f0fdf4; border-color: #bbf7d0; }
.stat-card--green .stat-card__value { color: #15803d; }
.stat-card--red { background: #fef2f2; border-color: #fecaca; }
.stat-card--red .stat-card__value { color: #b91c1c; }

.stat-card__value {
  font-size: 1.5rem; font-weight: 800; color: var(--unap-blue-800);
  line-height: 1;
}
.stat-card__value.mono { font-family: var(--font-mono); font-size: 1.25rem; }
.stat-card__label {
  font-size: 0.7rem; font-weight: 600; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.05em;
}

.stats-meta {
  display: flex; flex-wrap: wrap; gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--slate-100);
  font-size: 0.85rem; color: var(--slate-600);
}
.stats-meta strong { color: var(--unap-blue-700); }
.meta-warn { color: var(--warning-600); font-weight: 600; }

.alert {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md); font-size: 0.875rem;
}
.alert--warning { background: var(--warning-50); color: var(--warning-700); border: 1px solid var(--warning-200); }

/* Filter bar */
.filter-bar {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--space-4); flex-wrap: wrap;
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-sm);
}
.filter-bar__left { display: flex; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; }
.filter-bar__right { display: flex; align-items: center; gap: var(--space-3); }

.filter-group { display: flex; flex-direction: column; gap: var(--space-1); }
.filter-label {
  font-size: 0.7rem; font-weight: 700; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em;
}

.filter-select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.85rem; color: var(--slate-700); background: var(--slate-50);
  cursor: pointer; min-width: 200px; max-width: 280px;
  transition: border-color var(--transition-fast);
}
.filter-select:focus { outline: none; border-color: var(--unap-blue-400); background: white; }

.filter-toggle { display: flex; border: 1px solid var(--slate-200); border-radius: var(--radius-md); overflow: hidden; }
.filter-toggle__btn {
  padding: var(--space-1) var(--space-3); font-size: 0.8rem; font-weight: 600;
  border: none; background: var(--slate-50); color: var(--slate-500);
  cursor: pointer; transition: all var(--transition-fast); white-space: nowrap;
}
.filter-toggle__btn + .filter-toggle__btn { border-left: 1px solid var(--slate-200); }
.filter-toggle__btn.active { background: var(--unap-blue-600); color: white; }
.filter-toggle__btn--green.active { background: #16a34a; }
.filter-toggle__btn--red.active { background: #dc2626; }
.filter-toggle__btn:not(.active):hover { background: var(--slate-100); color: var(--slate-700); }

.filter-count {
  font-size: 0.82rem; color: var(--slate-500);
  padding: var(--space-1) var(--space-2);
  background: var(--slate-100); border-radius: var(--radius-md);
}
.filter-count strong { color: var(--unap-blue-700); }

.btn-clear-filters {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3); font-size: 0.8rem; font-weight: 600;
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: white; color: var(--slate-500); cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-clear-filters svg { width: 12px; height: 12px; }
.btn-clear-filters:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

/* Table */
.table-wrapper {
  background: white; border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl); overflow-x: auto; overflow-y: hidden;
  box-shadow: var(--shadow-md); width: 100%; max-width: 100%; min-width: 0;
  overscroll-behavior-inline: contain; scrollbar-gutter: stable;
}
table { width: 100%; min-width: max-content; border-collapse: collapse; }
thead { background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%); }
th {
  padding: var(--space-4); text-align: left; font-weight: 600; color: white;
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;
}
td { padding: var(--space-3) var(--space-4); }
.col-number { width: 50px; text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--slate-500); }
.col-programa { font-size: 0.82rem; color: var(--slate-500); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-score { width: 100px; text-align: center; }
.col-status { width: 130px; text-align: center; }
.mono { font-family: var(--font-mono); font-size: 0.875rem; }
tbody tr { border-bottom: 1px solid var(--slate-100); transition: background var(--transition-fast); }
tbody tr:nth-child(even) { background: var(--slate-50); }
tbody tr:hover { background: var(--unap-blue-50); }
tbody tr.row--ingresante { background: #f0fdf4; }
tbody tr.row--ingresante:hover { background: #dcfce7; }

.score-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full); font-family: var(--font-mono);
  font-weight: 700; font-size: 0.875rem;
}
.score-badge--ingresante {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
}

.status-chip {
  display: inline-block; padding: 2px 8px;
  border-radius: var(--radius-full); font-size: 0.7rem;
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
.status-chip--in { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.status-chip--out { background: var(--slate-100); color: var(--slate-500); border: 1px solid var(--slate-200); }

/* Botones */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
}
.btn__icon { width: 16px; height: 16px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; box-shadow: var(--shadow-sm);
}
.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-1px); box-shadow: var(--shadow-md);
}
.btn--ghost {
  background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200);
}
.btn--ghost:hover:not(:disabled) { background: var(--slate-50); border-color: var(--slate-300); color: var(--slate-800); }
.btn--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
  color: var(--unap-blue-900);
  box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.btn--gold:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-gold-400) 0%, var(--unap-gold-500) 100%);
  transform: translateY(-1px);
}
.btn--outline-green {
  background: transparent; color: #16a34a;
  border: 1px solid #86efac;
}
.btn--outline-green:hover { background: #f0fdf4; border-color: #4ade80; }

.btn--outline-red {
  background: transparent; color: #dc2626;
  border: 1px solid #fca5a5;
}
.btn--outline-red:hover { background: #fef2f2; border-color: #f87171; }

.btn--danger { background: var(--error-600); color: white; }
.btn--danger:hover { background: var(--error-700); }
.btn--sm { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }

.metric {
  display: flex; align-items: baseline; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--slate-100); border-radius: var(--radius-sm);
}
.metric__value { font-weight: 700; font-family: var(--font-mono); color: var(--slate-800); }
.metric__label { font-size: 0.75rem; color: var(--slate-500); }

@media (max-width: 768px) {
  .results-shell { padding: var(--space-4); }
  .results-header { flex-direction: column; }
  .results-header__actions { width: 100%; }
  .results-header__actions > .btn { flex: 1; }
  .not-qualified-panel__header { flex-direction: column; }
  .summary-strip { grid-template-columns: repeat(2, 1fr); }
  .summary-item:nth-child(2) { border-right: 0; }
  .summary-item:nth-child(-n+2) { border-bottom: 1px solid var(--slate-200); }
  .results-search { flex-basis: 100%; }
  .results-filters .filter-select { flex: 1; max-width: none; }
  .results-count { margin-left: 0; }
  .area-tabs--compact .area-tab { flex: 1 1 140px; }
  table { min-width: 600px; }
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Columna detalle */
.col-detail { width: 36px; padding: 0 6px; }
.btn-detail {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px;
  background: transparent; border: 1px solid var(--slate-200);
  color: var(--slate-400); cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-detail svg { width: 15px; height: 15px; }
.btn-detail:hover:not(:disabled) {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-300);
  color: var(--unap-blue-600);
}
.btn-detail:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Badge modo real ── */
.mode-badge {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(135deg, var(--unap-gold-50) 0%, #fffbeb 100%);
  border: 1px solid var(--unap-gold-300);
  border-radius: var(--radius-lg);
  font-size: 0.82rem; font-weight: 600; color: var(--unap-blue-800);
}
.mode-badge svg { width: 15px; height: 15px; color: var(--unap-gold-600); flex-shrink: 0; }

/* ── Secciones por carrera (modo real) ── */
.carrera-section {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.carrera-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
}

.carrera-header__left {
  display: flex; align-items: center; gap: var(--space-2);
}

.carrera-header__left svg { width: 18px; height: 18px; opacity: 0.8; flex-shrink: 0; }
.carrera-header__name { font-size: 0.95rem; font-weight: 700; }

.carrera-header__stats {
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
}

.carrera-stat {
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 500;
  background: rgba(255,255,255,0.15);
  color: white;
}
.carrera-stat strong { font-weight: 700; }

.carrera-stat--vacantes {
  background: rgba(255, 255, 255, 0.2);
}
.carrera-stat--in {
  background: rgba(34, 197, 94, 0.3);
  color: #bbf7d0;
}
.carrera-stat--out {
  background: rgba(239, 68, 68, 0.25);
  color: #fecaca;
}

.carrera-caret {
  width: 16px; height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
  transform: rotate(-90deg);
  transition: transform 0.2s ease;
}
.carrera-caret--open {
  transform: rotate(0deg);
}

.carrera-table {
  width: 100%; border-collapse: collapse; font-size: 0.9rem;
}
.carrera-table-wrap {
  width: 100%; max-width: 100%; min-width: 0;
  overflow-x: auto; overflow-y: hidden;
  overscroll-behavior-inline: contain; scrollbar-gutter: stable;
}
.carrera-table thead {
  background: var(--slate-100);
}
.carrera-table th {
  padding: var(--space-2) var(--space-4);
  text-align: left; font-size: 0.75rem; font-weight: 700;
  color: var(--slate-600); text-transform: uppercase; letter-spacing: 0.04em;
  white-space: nowrap; border-bottom: 1px solid var(--slate-200);
}
.carrera-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--slate-100);
  vertical-align: middle;
}
.carrera-table tbody tr:last-child td { border-bottom: none; }
.carrera-table tbody tr:nth-child(even) { background: var(--slate-50); }
.carrera-table tbody tr:hover { background: var(--unap-blue-50); }
.carrera-table tbody tr.row--ingresante {
  background: linear-gradient(90deg, #f0fdf4 0%, white 100%);
}
.carrera-table tbody tr.row--ingresante:hover { background: #dcfce7; }
</style>
