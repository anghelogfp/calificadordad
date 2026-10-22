<script setup>
import { computed, ref, watch } from 'vue'
import OrphanSheetsTable from './OrphanSheetsTable.vue'
import PaginationBar from './PaginationBar.vue'

const props = defineProps({
  // Alumnos del padrón que no se calificaron (summary.noCalificados)
  noCalificados: { type: Array, default: () => [] },
  // summary.sheetsWithoutCandidate: hojas cuyo DNI no está en el padrón
  orphanSheetCount: { type: Number, default: 0 },
  // Devuelve { rows, summary } (useCalification.previewProvisionalMatches) o null
  buildPreview: { type: Function, default: null },
})

const emit = defineEmits(['export'])

const MISSING_SHEET = 'Sin respuesta .dat'

const open = ref(false)
const activeTab = ref('')
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const preview = ref(null)
const previewError = ref('')

const missingSheetRows = computed(() => props.noCalificados.filter((row) => row.motivo === MISSING_SHEET))
const otherRows = computed(() => props.noCalificados.filter((row) => row.motivo !== MISSING_SHEET))

const tabs = computed(() => [
  { key: 'orphan', label: 'Hojas sin alumno', one: 'hoja sin alumno', count: props.orphanSheetCount, tone: 'action' },
  { key: 'other', label: 'Otras incidencias', one: 'otra incidencia', count: otherRows.value.length, tone: 'action' },
  { key: 'missing', label: 'Alumnos sin hoja', one: 'alumno sin hoja', count: missingSheetRows.value.length, tone: 'info' },
].filter((tab) => tab.count > 0))

function chipLabel(tab) {
  return tab.count === 1 ? tab.one : tab.label.toLowerCase()
}

const totalToReview = computed(() => tabs.value.reduce((sum, tab) => sum + tab.count, 0))
const needsAction = computed(() => tabs.value.some((tab) => tab.tone === 'action'))

const MOTIVE_LABELS = {
  [MISSING_SHEET]: 'Sin hoja de respuestas',
  'DNI no registrado en el padrón': 'DNI no está en el padrón',
}

function motiveLabel(motivo) {
  return MOTIVE_LABELS[motivo] || motivo || 'Sin motivo'
}

function fullName(row) {
  return [row.paterno, row.materno, row.nombres].filter(Boolean).join(' ') || '—'
}

function loadPreview() {
  previewError.value = ''
  try {
    preview.value = props.buildPreview ? props.buildPreview() : null
  } catch (error) {
    preview.value = null
    previewError.value = error?.message || String(error)
  }
}

function toggle() {
  open.value = !open.value
  if (open.value && !activeTab.value) selectTab(tabs.value[0]?.key || '')
}

function selectTab(key) {
  activeTab.value = key
  search.value = ''
  page.value = 1
  if (key === 'orphan') loadPreview()
}

const activeRows = computed(() => (activeTab.value === 'other' ? otherRows.value : missingSheetRows.value))

const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return activeRows.value
  return activeRows.value.filter((row) => `${row.dni} ${fullName(row)} ${row.detalle}`.toLowerCase().includes(term))
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const showProgram = computed(() => activeRows.value.some((row) => row.programa))

watch([search, pageSize], () => { page.value = 1 })

// Si cambian los datos (otra área, recálculo) la pestaña activa puede dejar de existir.
watch(tabs, (list) => {
  if (activeTab.value && !list.some((tab) => tab.key === activeTab.value)) {
    activeTab.value = ''
    if (open.value) selectTab(list[0]?.key || '')
  }
})

function handleExport() {
  if (!preview.value && props.orphanSheetCount > 0) loadPreview()
  emit('export', { orphanRows: preview.value?.rows || [] })
}
</script>

<template>
  <section v-if="totalToReview > 0" class="review" :class="{ 'review--action': needsAction }">
    <button type="button" class="review__bar" :aria-expanded="open" @click="toggle">
      <span class="review__title">
        {{ needsAction ? 'Hay datos por revisar' : 'Alumnos sin hoja de respuestas' }}
      </span>
      <span class="review__chips">
        <span v-for="tab in tabs" :key="tab.key" class="review__chip" :class="`review__chip--${tab.tone}`">
          <strong>{{ tab.count }}</strong> {{ chipLabel(tab) }}
        </span>
      </span>
      <span class="review__toggle">{{ open ? 'Ocultar' : 'Revisar' }}</span>
    </button>

    <div v-if="open" class="review__body">
      <div class="review__tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="review__tab"
          :class="{ 'review__tab--active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }} <span class="review__count">{{ tab.count }}</span>
        </button>
        <button type="button" class="review__download" @click="handleExport">
          Descargar revisión (Excel)
        </button>
      </div>

      <div class="review__search" v-if="activeTab">
        <input v-model="search" type="search" placeholder="Buscar por DNI, hoja o nombre" aria-label="Buscar en la lista" />
      </div>

      <template v-if="activeTab === 'orphan'">
        <p v-if="previewError" class="review__error">{{ previewError }}</p>
        <OrphanSheetsTable v-else-if="preview" :preview="preview" :search="search" />
      </template>

      <template v-else-if="activeTab">
        <p v-if="activeTab === 'missing'" class="review__note">
          Estos alumnos están en el padrón pero no se encontró una hoja con su DNI. En un simulacro suele
          significar que faltaron<template v-if="orphanSheetCount > 0"> o que marcaron mal su DNI (revisa “Hojas sin alumno”)</template>.
        </p>
        <p v-if="!filteredRows.length" class="review__note">Ninguna fila coincide con la búsqueda.</p>
        <div v-else class="review__table-wrap">
          <table class="review__table">
            <thead>
              <tr>
                <th>DNI</th>
                <th>Alumno</th>
                <th v-if="showProgram">Programa</th>
                <th v-if="activeTab === 'other'">Motivo</th>
                <th v-if="activeTab === 'other'">Qué hacer</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedRows" :key="`${row.dni}-${row.motivo}-${row.detalle}`">
                <td class="mono">{{ row.dni || '—' }}</td>
                <td>{{ fullName(row) }}</td>
                <td v-if="showProgram">{{ row.programa || '—' }}</td>
                <td v-if="activeTab === 'other'"><span class="review__reason">{{ motiveLabel(row.motivo) }}</span></td>
                <td v-if="activeTab === 'other'">{{ row.detalle || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <PaginationBar v-model:page="page" v-model:page-size="pageSize" :total-items="filteredRows.length" />
      </template>
    </div>
  </section>
</template>

<style scoped>
.review {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  background: white;
  overflow: hidden;
}
.review--action { border-color: #fcd34d; }

.review__bar {
  display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
  width: 100%; padding: var(--space-3) var(--space-4);
  border: 0; background: var(--slate-50); text-align: left; cursor: pointer;
}
.review--action .review__bar { background: #fffbeb; }
.review__bar:focus-visible { outline: 2px solid var(--blue-600, #2563eb); outline-offset: -2px; }
.review__title { font-size: 0.85rem; font-weight: 700; color: var(--slate-800); }
.review__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: 1; }
.review__chip {
  padding: 2px var(--space-3); border-radius: var(--radius-full);
  font-size: 0.75rem; border: 1px solid var(--slate-200); background: white; color: var(--slate-600);
}
.review__chip--action { border-color: #fcd34d; color: #92400e; }
.review__toggle { font-size: 0.78rem; font-weight: 700; color: var(--slate-600); }

.review__body { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); }
.review__tabs { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.review__tab {
  padding: var(--space-1) var(--space-3); border: 1px solid var(--slate-200); border-radius: var(--radius-full);
  background: white; color: var(--slate-600); font-size: 0.8rem; cursor: pointer;
}
.review__tab--active { background: var(--slate-800, #1e293b); border-color: var(--slate-800, #1e293b); color: white; }
.review__tab:focus-visible { outline: 2px solid var(--blue-600, #2563eb); outline-offset: 2px; }
.review__count { margin-left: 4px; font-weight: 700; }
.review__download {
  margin-left: auto; padding: var(--space-1) var(--space-3);
  border: 1px solid var(--slate-300, #cbd5e1); border-radius: var(--radius-md);
  background: white; color: var(--slate-700); font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.review__download:hover { background: var(--slate-50); }
.review__download:focus-visible { outline: 2px solid var(--blue-600, #2563eb); outline-offset: 2px; }

.review__search input {
  width: 100%; max-width: 360px; padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md); font-size: 0.82rem;
}
.review__note, .review__error { margin: 0; font-size: 0.8rem; color: var(--slate-600); max-width: 72ch; }
.review__error { color: #991b1b; }

.review__table-wrap { overflow-x: auto; border: 1px solid var(--slate-200); border-radius: var(--radius-md); }
.review__table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.8rem; }
.review__table th {
  padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-200);
  background: var(--slate-50); color: var(--slate-600); font-size: 0.72rem; font-weight: 700; text-align: left;
}
.review__table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-100); color: var(--slate-700); vertical-align: top; }
.review__table tr:last-child td { border-bottom: 0; }
.review__reason { display: inline-flex; padding: 1px var(--space-2); border-radius: var(--radius-full); background: #fef3c7; color: #92400e; font-size: 0.72rem; font-weight: 600; }
.mono { font-family: var(--font-mono, ui-monospace, monospace); }

@media (max-width: 768px) {
  .review__download { margin-left: 0; }
}
</style>
