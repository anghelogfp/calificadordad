<script setup>
import { computed, ref, watch } from 'vue'
import PaginationBar from './PaginationBar.vue'

const props = defineProps({
  // { rows, summary } de buildProvisionalPreview
  preview: { type: Object, required: true },
  search: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  actionError: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'undo'])

// Paso de confirmación en pantalla (sin diálogos del navegador)
const pendingKey = ref('')
const keyOf = (litho, dni) => `${litho}|${dni}`

const page = ref(1)
const pageSize = ref(10)

const REASON_LABELS = {
  'not-in-padron': 'DNI no está en el padrón',
  incomplete: 'DNI incompleto',
}

const STATUS_LABELS = {
  'blocked-has-sheet': 'Ese alumno ya tiene su propia hoja',
  'blocked-confirmed': 'Ese alumno ya fue confirmado con otra hoja',
  conflict: 'Otra hoja sugiere al mismo alumno',
  'not-scored': 'No se pudo calcular',
}

function fullName(person) {
  return [person.paterno, person.materno, person.nombres].filter(Boolean).join(' ')
}

const filteredRows = computed(() => {
  const term = props.search.trim().toLowerCase()
  const rows = props.preview?.rows || []
  if (!term) return rows
  return rows.filter((row) => {
    const haystack = [
      row.litho,
      row.dniRead,
      ...row.suggestions.flatMap((s) => [s.dni, fullName(s)]),
    ].join(' ').toLowerCase()
    return haystack.includes(term)
  })
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

watch(() => [props.search, props.preview], () => { page.value = 1 })

function askConfirm(litho, dni) {
  pendingKey.value = keyOf(litho, dni)
}

function doConfirm(litho, dni) {
  pendingKey.value = ''
  emit('confirm', { litho, correctedDni: dni })
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—'
}
</script>

<template>
  <div class="orphan">
    <p class="orphan__lead">
      Estas hojas no se califican porque su DNI no coincide con ningún alumno del padrón.
      Si el DNI sugerido fuera el correcto, el puntaje sería el que se muestra
      <strong>(provisional: no cambia el ranking)</strong>.
    </p>

    <p v-if="preview.summary?.confirmed" class="orphan__confirmed-note">
      {{ preview.summary.confirmed }} confirmada(s). Siguen fuera del ranking oficial.
    </p>
    <p v-if="actionError" class="orphan__error" role="alert">{{ actionError }}</p>

    <p v-if="!filteredRows.length" class="orphan__empty">
      {{ preview.rows.length ? 'Ninguna hoja coincide con la búsqueda.' : 'Todas las hojas cargadas tienen un DNI que está en el padrón.' }}
    </p>

    <div v-else class="orphan__table-wrap">
      <table class="orphan__table">
        <thead>
          <tr>
            <th>Hoja</th>
            <th>DNI marcado</th>
            <th>Alumno sugerido</th>
            <th class="num">Puntaje si es él</th>
            <th class="num">Posición</th>
            <th class="num">Acción</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in pagedRows" :key="row.litho || row.dniRead">
            <tr v-if="!row.suggestions.length">
              <td class="mono">{{ row.litho || '—' }}<span class="sub">Aula {{ row.aula || '—' }}</span></td>
              <td class="mono">{{ row.dniRead || '—' }}<span class="sub">{{ REASON_LABELS[row.reason] }}</span></td>
              <td colspan="4" class="muted">Sin coincidencia parecida en el padrón</td>
            </tr>
            <tr v-for="suggestion in row.suggestions" :key="`${row.litho}-${suggestion.dni}`">
              <td class="mono">{{ row.litho || '—' }}<span class="sub">Aula {{ row.aula || '—' }}</span></td>
              <td class="mono">{{ row.dniRead || '—' }}<span class="sub">{{ REASON_LABELS[row.reason] }}</span></td>
              <td>
                {{ fullName(suggestion) || '—' }}
                <span class="sub mono">{{ suggestion.dni }}</span>
                <span v-if="suggestion.status === 'confirmed'" class="ok-flag">Confirmado · fuera del ranking oficial</span>
                <span v-if="STATUS_LABELS[suggestion.status]" class="flag">
                  {{ STATUS_LABELS[suggestion.status] }}
                  <template v-if="suggestion.conflictWith"> ({{ suggestion.conflictWith.join(', ') }})</template>
                </span>
              </td>
              <td class="num">
                <span v-if="suggestion.status === 'ok' || suggestion.status === 'confirmed'" class="score">
                  {{ formatScore(suggestion.provisionalScore) }}
                  <em>{{ suggestion.status === 'confirmed' ? 'CONFIRMADO' : 'PROVISIONAL' }}</em>
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <span v-if="suggestion.status === 'ok' || suggestion.status === 'confirmed'">{{ suggestion.wouldRank }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <template v-if="suggestion.status === 'ok'">
                  <span v-if="pendingKey === keyOf(row.litho, suggestion.dni)" class="ask">
                    ¿Es este alumno?
                    <button type="button" class="act act--primary" :disabled="busy" @click="doConfirm(row.litho, suggestion.dni)">Sí, confirmar</button>
                    <button type="button" class="act" @click="pendingKey = ''">Cancelar</button>
                  </span>
                  <button v-else type="button" class="act" :disabled="busy" @click="askConfirm(row.litho, suggestion.dni)">Confirmar</button>
                </template>
                <button
                  v-else-if="suggestion.status === 'confirmed'"
                  type="button"
                  class="act"
                  :disabled="busy"
                  @click="emit('undo', { litho: row.litho })"
                >Deshacer</button>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <PaginationBar
      v-model:page="page"
      v-model:page-size="pageSize"
      :total-items="filteredRows.length"
    />

    <p class="orphan__hint">
      Un DNI parecido no confirma quién es el alumno: verifica la hoja física o con el colegio antes de usar estos puntajes.
    </p>
  </div>
</template>

<style scoped>
.orphan { display: flex; flex-direction: column; gap: var(--space-3); }
.orphan__lead, .orphan__hint, .orphan__empty { margin: 0; color: var(--slate-600); font-size: 0.8rem; max-width: 72ch; }
.orphan__table-wrap { overflow-x: auto; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: white; }
.orphan__table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 0.8rem; }
.orphan__table th {
  padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-200);
  background: var(--slate-50); color: var(--slate-600); font-size: 0.72rem; font-weight: 700; text-align: left;
}
.orphan__table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-100); color: var(--slate-700); vertical-align: top; }
.orphan__table tr:last-child td { border-bottom: 0; }
.num { text-align: right; }
.mono { font-family: var(--font-mono, ui-monospace, monospace); }
.muted { color: var(--slate-500); }
.sub { display: block; color: var(--slate-500); font-size: 0.72rem; font-weight: 400; }
.flag { display: block; color: #b45309; font-size: 0.72rem; font-weight: 600; }
.score { display: inline-flex; flex-direction: column; align-items: flex-end; font-weight: 700; }
.orphan__confirmed-note { margin: 0; color: #166534; font-size: 0.8rem; font-weight: 600; }
.orphan__error { margin: 0; color: #991b1b; font-size: 0.8rem; font-weight: 600; }
.ok-flag { display: block; color: #166534; font-size: 0.72rem; font-weight: 700; }
.ask { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--slate-700); }
.act {
  padding: 3px var(--space-2); border: 1px solid var(--slate-300, #cbd5e1); border-radius: var(--radius-md);
  background: white; color: var(--slate-700); font-size: 0.75rem; font-weight: 600; cursor: pointer;
}
.act:hover:not(:disabled) { background: var(--slate-50); }
.act:disabled { opacity: 0.5; cursor: default; }
.act--primary { background: #166534; border-color: #166534; color: white; }
.act--primary:hover:not(:disabled) { background: #14532d; }
.act:focus-visible { outline: 2px solid var(--blue-600, #2563eb); outline-offset: 2px; }
.score em { color: #b45309; font-size: 0.62rem; font-style: normal; letter-spacing: 0.06em; }
</style>
