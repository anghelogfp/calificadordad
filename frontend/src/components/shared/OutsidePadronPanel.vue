<script setup>
import { computed, ref, watch } from 'vue'
import PaginationBar from './PaginationBar.vue'

const props = defineProps({
  // buildOutsidePadronReview(...).items
  items: { type: Array, required: true },
  summary: { type: Object, default: () => ({}) },
  // Qué se está revisando, en plural, para el texto ("fichas" / "hojas de respuestas")
  nounPlural: { type: String, default: 'fichas' },
})

const page = ref(1)
const pageSize = ref(10)

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return props.items.slice(start, start + pageSize.value)
})

watch(() => props.items.length, () => { page.value = 1 })

const REASON = { outside: 'No está en el padrón', incomplete: 'DNI incompleto' }

function fullName(person) {
  return [person.paterno, person.materno, person.nombres].filter(Boolean).join(' ')
}
</script>

<template>
  <section class="osp" aria-label="DNI sin alumno en el padrón">
    <p class="osp__lead">
      Estas {{ nounPlural }} traen un DNI que no coincide con ningún alumno del padrón. La columna
      <strong>Posible alumno</strong> es solo una pista (un dígito de diferencia): no confirma quién es.
      Verifica con la hoja física o con el colegio, y corrige el DNI en la tabla de abajo o, después de calificar,
      confirma la corrección en Resultados &gt; Revisión.
    </p>

    <div class="osp__chips">
      <span class="osp__chip"><strong>{{ summary.outside || 0 }}</strong> fuera del padrón</span>
      <span class="osp__chip"><strong>{{ summary.incomplete || 0 }}</strong> DNI incompleto</span>
      <span class="osp__chip osp__chip--ok"><strong>{{ summary.withViableSuggestion || 0 }}</strong> con alumno posible</span>
      <span class="osp__chip osp__chip--muted"><strong>{{ summary.withoutSuggestion || 0 }}</strong> sin parecido</span>
      <span v-if="summary.confirmed" class="osp__chip osp__chip--done"><strong>{{ summary.confirmed }}</strong> ya confirmadas</span>
    </div>

    <div class="osp__table-wrap">
      <table class="osp__table">
        <thead>
          <tr>
            <th>Hoja</th>
            <th>Aula</th>
            <th>DNI leído</th>
            <th>Posible alumno</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in pagedItems" :key="item.rowId">
            <td class="mono">{{ item.litho || '—' }}</td>
            <td>{{ item.aula || '—' }}</td>
            <td class="mono">
              {{ item.dniRead }}
              <span class="osp__sub">{{ REASON[item.reason] }}</span>
            </td>
            <td>
              <template v-if="item.confirmedDni">
                <span class="osp__done">Corrección confirmada: {{ item.confirmedDni }}</span>
              </template>
              <template v-else-if="item.suggestions.length">
                <div v-for="suggestion in item.suggestions" :key="suggestion.dni" class="osp__suggestion">
                  <span class="mono">{{ suggestion.dni }}</span>
                  {{ fullName(suggestion) }}
                  <span v-if="suggestion.taken" class="osp__taken">ya tiene su propia ficha</span>
                </div>
              </template>
              <span v-else class="osp__none">Sin coincidencia parecida en el padrón</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationBar v-model:page="page" v-model:page-size="pageSize" :total-items="items.length" />
  </section>
</template>

<style scoped>
.osp { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border: 1px solid #fcd34d; border-left: 4px solid #d97706; border-radius: var(--radius-lg); background: #fffbeb; }
.osp__lead { margin: 0; color: var(--slate-700); font-size: 0.8rem; max-width: 80ch; }
.osp__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.osp__chip { padding: 2px var(--space-3); border-radius: var(--radius-full); border: 1px solid #fcd34d; background: white; color: #92400e; font-size: 0.75rem; }
.osp__chip--ok { border-color: #86efac; color: #166534; }
.osp__chip--muted { border-color: var(--slate-200); color: var(--slate-600); }
.osp__chip--done { border-color: #86efac; color: #166534; background: #f0fdf4; }
.osp__table-wrap { overflow-x: auto; border: 1px solid var(--slate-200); border-radius: var(--radius-md); background: white; }
.osp__table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 0.8rem; }
.osp__table th { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-200); background: var(--slate-50); color: var(--slate-600); font-size: 0.72rem; font-weight: 700; text-align: left; }
.osp__table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-100); color: var(--slate-700); vertical-align: top; }
.osp__table tr:last-child td { border-bottom: 0; }
.mono { font-family: var(--font-mono, ui-monospace, monospace); }
.osp__sub { display: block; color: var(--slate-500); font-size: 0.72rem; }
.osp__suggestion + .osp__suggestion { margin-top: 2px; }
.osp__taken { display: block; color: #b45309; font-size: 0.72rem; font-weight: 600; }
.osp__none { color: var(--slate-500); }
.osp__done { color: #166534; font-weight: 700; }
</style>
