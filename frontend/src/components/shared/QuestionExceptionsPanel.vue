<script setup>
import { computed, ref, watch } from 'vue'
import { EXCEPTION_LABELS } from '@/domain/calification/questionExceptions'

const props = defineProps({
  // Excepciones con su estado: applied | outdated | orphan | invalid
  exceptions: { type: Array, default: () => [] },
  // Claves cargadas: [{ id, area, tipo, label, answers, length }]
  keyOptions: { type: Array, default: () => [] },
  // Materia y peso por pregunta, para mostrar a qué pregunta se refiere
  plan: { type: Array, default: () => [] },
  correctValue: { type: Number, default: 0 },
  // (keyOption, questionNumber) => { A..E, blank, multiple, total, key }
  getDistribution: { type: Function, default: null },
  addException: { type: Function, default: null },
  revokeException: { type: Function, default: null },
})

const OPTIONS = [
  { value: 'ANULADA_OTORGAR', label: 'Anular y dar el punto a todos' },
  { value: 'ANULADA_EXCLUIR', label: 'Anular y que no cuente para nadie' },
  { value: 'CLAVE_MULTIPLE', label: 'Aceptar varias respuestas como correctas' },
]
const LETTERS = ['A', 'B', 'C', 'D', 'E']

const open = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const confirming = ref(false)
const confirmingUndo = ref(null)

const form = ref({ keyId: '', questionNumber: '', type: 'ANULADA_OTORGAR', validAnswers: [], reason: '', documentRef: '' })

const applied = computed(() => props.exceptions.filter((item) => item.status === 'applied'))
const withoutEffect = computed(() => props.exceptions.filter((item) => item.status !== 'applied'))

const selectedKey = computed(() => props.keyOptions.find((option) => option.id === form.value.keyId) || null)
const number = computed(() => Number(form.value.questionNumber))
const numberIsValid = computed(() =>
  Number.isInteger(number.value) && number.value >= 1 && number.value <= (selectedKey.value?.length || 0))

const planItem = computed(() => (numberIsValid.value ? props.plan[number.value - 1] || null : null))
const distribution = computed(() =>
  (selectedKey.value && numberIsValid.value && props.getDistribution
    ? props.getDistribution(selectedKey.value, number.value)
    : null))

// Si casi nadie marcó la letra de la clave, conviene revisar si la clave es la correcta.
const keyWarning = computed(() => {
  const d = distribution.value
  if (!d || d.total < 10 || !d.key || !LETTERS.includes(d.key)) return ''
  const share = d[d.key] / d.total
  return share < 0.15
    ? `Solo ${d[d.key]} de ${d.total} marcaron la clave (${d.key}). Revisa si la clave de esta pregunta es correcta antes de anularla.`
    : ''
})

const canSubmit = computed(() =>
  Boolean(selectedKey.value)
  && numberIsValid.value
  && form.value.reason.trim().length > 0
  && (form.value.type !== 'CLAVE_MULTIPLE' || form.value.validAnswers.length > 0))

const effectText = computed(() => {
  const label = `la pregunta ${number.value}`
  if (form.value.type === 'ANULADA_OTORGAR') {
    const points = planItem.value ? ` (${(props.correctValue * planItem.value.weight).toFixed(3)} puntos)` : ''
    return `Todos los postulantes de esta clave recibirán el punto de ${label}${points}, hayan marcado lo que hayan marcado.`
  }
  if (form.value.type === 'ANULADA_EXCLUIR') {
    return `${label[0].toUpperCase()}${label.slice(1)} no contará para nadie y el puntaje máximo posible bajará. Los demás puntos no se reescalan.`
  }
  return `Se aceptarán como correctas: ${[...form.value.validAnswers].sort().join(', ')}. La letra de la clave original solo cuenta si también está marcada.`
})

watch(() => form.value.type, () => { confirming.value = false })

function keyLabel(item) {
  const found = props.keyOptions.find((option) => option.area === (item.area || '') && option.tipo === (item.tipo || ''))
  return found?.label || (item.area ? `${item.area}${item.tipo ? ` · Tipo ${item.tipo}` : ''}` : 'Clave general')
}

function typeLabel(item) {
  const base = EXCEPTION_LABELS[item.type] || item.type
  return item.type === 'CLAVE_MULTIPLE' && item.validAnswers ? `${base}: ${[...item.validAnswers].join(', ')}` : base
}

const STATUS_LABELS = { applied: 'Aplicada', outdated: 'Sin efecto', orphan: 'Sin efecto', invalid: 'Inválida' }

function toggleLetter(letter) {
  const set = new Set(form.value.validAnswers)
  if (set.has(letter)) set.delete(letter)
  else set.add(letter)
  form.value.validAnswers = [...set].sort()
}

async function run(action) {
  if (!action || busy.value) return false
  busy.value = true
  errorMessage.value = ''
  try {
    const result = await action()
    if (result?.ok === false) {
      errorMessage.value = result.error || 'No se pudo completar la acción.'
      return false
    }
    return true
  } finally {
    busy.value = false
  }
}

async function submit() {
  const key = selectedKey.value
  const ok = await run(() => props.addException({
    area: key.area,
    tipo: key.tipo,
    questionNumber: number.value,
    type: form.value.type,
    validAnswers: form.value.type === 'CLAVE_MULTIPLE' ? form.value.validAnswers.join('') : '',
    reason: form.value.reason.trim(),
    documentRef: form.value.documentRef.trim(),
  }))
  confirming.value = false
  if (ok) form.value = { ...form.value, questionNumber: '', validAnswers: [], reason: '', documentRef: '' }
}

async function undo(item) {
  confirmingUndo.value = null
  await run(() => props.revokeException(item.id))
}
</script>

<template>
  <section class="qe" :class="{ 'qe--attention': withoutEffect.length > 0 }">
    <button type="button" class="qe__bar" :aria-expanded="open" @click="open = !open">
      <span class="qe__title">Excepciones de preguntas</span>
      <span class="qe__chips">
        <span class="qe__chip" :class="{ 'qe__chip--done': applied.length > 0 }">
          <strong>{{ applied.length }}</strong> {{ applied.length === 1 ? 'aplicada' : 'aplicadas' }}
        </span>
        <span v-if="withoutEffect.length" class="qe__chip qe__chip--warn">
          <strong>{{ withoutEffect.length }}</strong> sin efecto
        </span>
      </span>
      <span class="qe__toggle">{{ open ? 'Ocultar' : (exceptions.length ? 'Ver' : 'Registrar') }}</span>
    </button>

    <div v-if="open" class="qe__body">
      <p class="qe__lead">
        Para una pregunta mal formulada o con la clave equivocada. Cada excepción queda ligada a la clave sobre la
        que se decidió: si la clave cambia, deja de aplicarse. Al registrar o deshacer, el ranking se recalcula.
      </p>

      <p v-if="errorMessage" class="qe__error" role="alert">{{ errorMessage }}</p>

      <div v-if="exceptions.length" class="qe__table-wrap">
        <table class="qe__table">
          <thead>
            <tr>
              <th>Clave</th>
              <th>Pregunta</th>
              <th>Excepción</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in exceptions" :key="item.id" :class="{ 'qe__row--off': item.status !== 'applied' }">
              <td>{{ keyLabel(item) }}</td>
              <td class="mono">{{ item.questionNumber }}</td>
              <td>{{ typeLabel(item) }}</td>
              <td>
                {{ item.reason }}
                <span v-if="item.documentRef" class="qe__sub">{{ item.documentRef }}</span>
              </td>
              <td>
                <span class="qe__status" :class="`qe__status--${item.status}`">{{ STATUS_LABELS[item.status] }}</span>
                <span v-if="item.message" class="qe__sub">{{ item.message }}</span>
              </td>
              <td class="num">
                <span v-if="confirmingUndo === item.id" class="qe__ask">
                  ¿Deshacer?
                  <button type="button" class="qe__btn qe__btn--primary" :disabled="busy" @click="undo(item)">Sí</button>
                  <button type="button" class="qe__btn" @click="confirmingUndo = null">No</button>
                </span>
                <button v-else type="button" class="qe__btn" :disabled="busy" @click="confirmingUndo = item.id">Deshacer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <form class="qe__form" @submit.prevent="confirming = true">
        <h4>Registrar una excepción</h4>
        <p v-if="!keyOptions.length" class="qe__lead">Carga una clave de respuestas para poder registrar excepciones.</p>

        <div class="qe__grid">
          <label>
            Clave
            <select v-model="form.keyId" required>
              <option value="" disabled>Elige la clave</option>
              <option v-for="option in keyOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </label>
          <label>
            Pregunta
            <input v-model="form.questionNumber" type="number" min="1" :max="selectedKey?.length || undefined" inputmode="numeric" required />
          </label>
          <label class="qe__wide">
            Qué hacer
            <select v-model="form.type">
              <option v-for="option in OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>

        <fieldset v-if="form.type === 'CLAVE_MULTIPLE'" class="qe__letters">
          <legend>Respuestas válidas</legend>
          <label v-for="letter in LETTERS" :key="letter" class="qe__letter">
            <input type="checkbox" :checked="form.validAnswers.includes(letter)" @change="toggleLetter(letter)" />
            {{ letter }}
          </label>
        </fieldset>

        <div v-if="planItem" class="qe__context">
          Pregunta {{ number }} · {{ planItem.subject || 'Sin materia' }} · peso {{ planItem.weight }}
        </div>
        <div v-if="distribution && distribution.total" class="qe__dist">
          <span>Respondieron ({{ distribution.total }}):</span>
          <span v-for="letter in LETTERS" :key="letter" :class="{ 'qe__dist--key': distribution.key === letter }">
            {{ letter }} {{ distribution[letter] }}
          </span>
          <span>En blanco {{ distribution.blank }}</span>
          <span v-if="distribution.multiple">Múltiple {{ distribution.multiple }}</span>
          <span v-if="distribution.key" class="qe__dist-key">Clave: {{ distribution.key }}</span>
        </div>
        <p v-if="keyWarning" class="qe__warn">{{ keyWarning }}</p>

        <div class="qe__grid">
          <label class="qe__wide">
            Motivo
            <input v-model="form.reason" type="text" maxlength="300" placeholder="Por qué se anula o corrige" required />
          </label>
          <label class="qe__wide">
            Documento de sustento (opcional)
            <input v-model="form.documentRef" type="text" maxlength="200" placeholder="Acta, resolución u oficio" />
          </label>
        </div>

        <div v-if="confirming && canSubmit" class="qe__confirm" role="group" aria-label="Confirmar excepción">
          <p>{{ effectText }}</p>
          <p class="qe__sub">Se recalculará el ranking. Podrás deshacerla después.</p>
          <button type="button" class="qe__btn qe__btn--primary" :disabled="busy" @click="submit">Sí, registrar y recalcular</button>
          <button type="button" class="qe__btn" @click="confirming = false">Cancelar</button>
        </div>
        <button v-else type="submit" class="qe__btn qe__btn--primary" :disabled="!canSubmit || busy">Registrar excepción</button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.qe { border: 1px solid var(--slate-200); border-radius: var(--radius-lg); background: white; overflow: hidden; }
.qe--attention { border-color: #fcd34d; }
.qe__bar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; width: 100%; padding: var(--space-3) var(--space-4); border: 0; background: var(--slate-50); text-align: left; cursor: pointer; }
.qe__bar:focus-visible, .qe__btn:focus-visible { outline: 2px solid var(--blue-600, #2563eb); outline-offset: 2px; }
.qe__title { font-size: 0.85rem; font-weight: 700; color: var(--slate-800); }
.qe__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: 1; }
.qe__chip { padding: 2px var(--space-3); border-radius: var(--radius-full); font-size: 0.75rem; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); }
.qe__chip--done { border-color: #86efac; color: #166534; background: #f0fdf4; }
.qe__chip--warn { border-color: #fcd34d; color: #92400e; }
.qe__toggle { font-size: 0.78rem; font-weight: 700; color: var(--slate-600); }
.qe__body { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); }
.qe__lead { margin: 0; color: var(--slate-600); font-size: 0.8rem; max-width: 72ch; }
.qe__error { margin: 0; color: #991b1b; font-size: 0.8rem; font-weight: 600; }
.qe__warn { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: #fffbeb; color: #92400e; font-size: 0.8rem; font-weight: 600; }
.qe__table-wrap { overflow-x: auto; border: 1px solid var(--slate-200); border-radius: var(--radius-md); }
.qe__table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.8rem; }
.qe__table th { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-200); background: var(--slate-50); color: var(--slate-600); font-size: 0.72rem; font-weight: 700; text-align: left; }
.qe__table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--slate-100); color: var(--slate-700); vertical-align: top; }
.qe__table tr:last-child td { border-bottom: 0; }
.qe__row--off { background: #fffdf5; }
.qe__sub { display: block; color: var(--slate-500); font-size: 0.72rem; font-weight: 400; }
.qe__status { display: inline-flex; padding: 1px var(--space-2); border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }
.qe__status--applied { background: #dcfce7; color: #166534; }
.qe__status--outdated, .qe__status--orphan { background: #fef3c7; color: #92400e; }
.qe__status--invalid { background: #fee2e2; color: #991b1b; }
.num { text-align: right; }
.mono { font-family: var(--font-mono, ui-monospace, monospace); }
.qe__form { display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--slate-100); }
.qe__form h4 { margin: 0; font-size: 0.85rem; color: var(--slate-800); }
.qe__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-3); }
.qe__wide { grid-column: 1 / -1; }
.qe__form label { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; font-weight: 600; color: var(--slate-600); }
.qe__form input[type='text'], .qe__form input[type='number'], .qe__form select { padding: var(--space-2) var(--space-3); border: 1px solid var(--slate-200); border-radius: var(--radius-md); font-size: 0.82rem; font-weight: 400; }
.qe__letters { display: flex; flex-wrap: wrap; gap: var(--space-3); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); }
.qe__letters legend { font-size: 0.72rem; font-weight: 700; color: var(--slate-600); padding: 0 4px; }
.qe__form .qe__letter { flex-direction: row; align-items: center; gap: 4px; }
.qe__context { font-size: 0.8rem; font-weight: 600; color: var(--slate-700); }
.qe__dist { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: 0.78rem; color: var(--slate-600); }
.qe__dist--key { font-weight: 800; color: #166534; }
.qe__dist-key { font-weight: 700; color: var(--slate-700); }
.qe__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: var(--space-3); border: 1px solid #fcd34d; border-radius: var(--radius-md); background: #fffbeb; }
.qe__confirm p { margin: 0; flex-basis: 100%; font-size: 0.82rem; color: var(--slate-800); }
.qe__ask { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; }
.qe__btn { padding: 4px var(--space-3); border: 1px solid var(--slate-300, #cbd5e1); border-radius: var(--radius-md); background: white; color: var(--slate-700); font-size: 0.78rem; font-weight: 600; cursor: pointer; align-self: flex-start; }
.qe__btn:hover:not(:disabled) { background: var(--slate-50); }
.qe__btn:disabled { opacity: 0.5; cursor: default; }
.qe__btn--primary { background: #166534; border-color: #166534; color: white; }
.qe__btn--primary:hover:not(:disabled) { background: #14532d; }
</style>
