<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  // Función que devuelve { rows, summary } o null (useCalification.previewProvisionalMatches)
  buildPreview: { type: Function, required: true },
})

const preview = ref(null)
const loaded = ref(false)
const errorMessage = ref('')

const rows = computed(() => preview.value?.rows || [])
const summary = computed(() => preview.value?.summary || null)

function load() {
  errorMessage.value = ''
  try {
    preview.value = props.buildPreview()
    loaded.value = true
  } catch (error) {
    preview.value = null
    errorMessage.value = error?.message || String(error)
  }
}

function fullName(row) {
  return [row.paterno, row.materno, row.nombres].filter(Boolean).join(' ') || '—'
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—'
}

const REASON_LABELS = {
  'not-in-padron': 'DNI no está en el padrón',
  incomplete: 'DNI incompleto',
}

const STATUS_LABELS = {
  'blocked-has-sheet': 'Ese alumno ya tiene su propia hoja',
  conflict: 'Otra hoja sugiere al mismo alumno',
  'not-scored': 'No se pudo calcular',
}
</script>

<template>
  <section class="provisional-panel">
    <div class="provisional-panel__header">
      <div>
        <span class="provisional-panel__eyebrow">Vista previa · no oficial</span>
        <h3>Hojas sin alumno en el padrón</h3>
        <p class="provisional-panel__lead">
          Muestra qué puntaje tendría cada hoja si el DNI sugerido fuera el correcto.
          No cambia resultados, ranking ni datos guardados.
        </p>
      </div>
      <button type="button" class="btn btn--ghost" @click="load">
        {{ loaded ? 'Actualizar' : 'Revisar hojas' }}
      </button>
    </div>

    <p v-if="errorMessage" class="provisional-panel__error">{{ errorMessage }}</p>

    <template v-if="loaded && summary">
      <p v-if="!rows.length" class="provisional-panel__empty">
        Todas las hojas cargadas tienen un DNI que está en el padrón.
      </p>

      <template v-else>
        <div class="provisional-panel__chips">
          <span class="provisional-chip"><strong>{{ summary.orphanSheets }}</strong> hojas sin alumno</span>
          <span class="provisional-chip"><strong>{{ summary.withViableSuggestion }}</strong> con alumno posible</span>
          <span class="provisional-chip provisional-chip--muted"><strong>{{ summary.onlyBlockedSuggestions }}</strong> parecidas a alumnos que ya tienen hoja</span>
          <span class="provisional-chip provisional-chip--muted"><strong>{{ summary.withoutSuggestion }}</strong> sin sugerencia</span>
        </div>

        <div class="provisional-panel__table-wrap">
          <table class="provisional-panel__table">
            <thead>
              <tr>
                <th>Hoja</th>
                <th>Aula</th>
                <th>DNI marcado</th>
                <th>DNI sugerido</th>
                <th>Alumno sugerido</th>
                <th class="num">Puntaje si es él</th>
                <th class="num">Posición</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in rows" :key="row.litho || row.dniRead">
                <tr v-if="!row.suggestions.length">
                  <td class="mono">{{ row.litho || '—' }}</td>
                  <td>{{ row.aula || '—' }}</td>
                  <td class="mono">{{ row.dniRead || '—' }}</td>
                  <td colspan="4" class="muted">
                    {{ REASON_LABELS[row.reason] }} · sin coincidencia parecida en el padrón
                  </td>
                </tr>
                <tr v-for="suggestion in row.suggestions" :key="`${row.litho}-${suggestion.dni}`">
                  <td class="mono">{{ row.litho || '—' }}</td>
                  <td>{{ row.aula || '—' }}</td>
                  <td class="mono">{{ row.dniRead || '—' }}</td>
                  <td class="mono">{{ suggestion.dni }}</td>
                  <td>
                    {{ fullName(suggestion) }}
                    <span v-if="STATUS_LABELS[suggestion.status]" class="provisional-flag">
                      {{ STATUS_LABELS[suggestion.status] }}
                      <template v-if="suggestion.conflictWith"> ({{ suggestion.conflictWith.join(', ') }})</template>
                    </span>
                  </td>
                  <td class="num">
                    <span v-if="suggestion.status === 'ok'" class="provisional-score">
                      {{ formatScore(suggestion.provisionalScore) }}
                      <em>PROVISIONAL</em>
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="num">
                    <span v-if="suggestion.status === 'ok'">{{ suggestion.wouldRank }}</span>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="provisional-panel__hint">
          Un DNI parecido no confirma quién es el alumno: verifica la hoja física o con el colegio antes de usar estos puntajes.
        </p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.provisional-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
  border-radius: var(--radius-lg);
  background: #fffbeb;
}

.provisional-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.provisional-panel__header h3 {
  margin: 2px 0;
  color: var(--slate-900);
  font-size: 1rem;
}

.provisional-panel__eyebrow {
  color: #92400e;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.provisional-panel__lead,
.provisional-panel__hint,
.provisional-panel__empty {
  margin: 0;
  color: var(--slate-600);
  font-size: 0.8rem;
}

.provisional-panel__error {
  margin: 0;
  color: #991b1b;
  font-size: 0.8rem;
}

.provisional-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.provisional-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid #fde68a;
  border-radius: var(--radius-full);
  background: white;
  color: #92400e;
  font-size: 0.78rem;
  font-weight: 600;
}

.provisional-chip--muted {
  color: var(--slate-600);
  border-color: var(--slate-200);
}

.provisional-panel__table-wrap {
  overflow-x: auto;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  background: white;
}

.provisional-panel__table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.provisional-panel__table th {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid #fde68a;
  background: #fffdf5;
  color: #92400e;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.provisional-panel__table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--slate-100);
  color: var(--slate-700);
  vertical-align: top;
}

.provisional-panel__table tr:last-child td {
  border-bottom: 0;
}

.num {
  text-align: right;
}

.mono {
  font-family: var(--font-mono, ui-monospace, monospace);
}

.muted {
  color: var(--slate-500);
}

.provisional-flag {
  display: block;
  color: #b45309;
  font-size: 0.72rem;
  font-weight: 600;
}

.provisional-score {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: 700;
}

.provisional-score em {
  color: #b45309;
  font-size: 0.62rem;
  font-style: normal;
  letter-spacing: 0.06em;
}
</style>
