<script setup>
import { computed } from 'vue'

const props = defineProps({
  answers: { type: String, default: '' },
  correctAnswers: { type: String, default: '' },
  totalQuestions: { type: Number, default: 60 },
  mode: { type: String, default: 'answers' },
  title: { type: String, default: 'Hoja de respuestas' },
})

const OPTIONS = ['A', 'B', 'C', 'D', 'E']

function normalizeAt(source, index) {
  const value = String(source || '').toUpperCase()[index] || ''
  return OPTIONS.includes(value) ? value : ''
}

const rows = computed(() => {
  const total = Math.max(0, Number(props.totalQuestions) || 60)
  return Array.from({ length: total }, (_, index) => {
    const marked = normalizeAt(props.answers, index)
    const correct = normalizeAt(props.correctAnswers, index)
    const keyMarked = props.mode === 'inspect-key' ? marked : ''
    const status = !marked && !keyMarked
      ? 'blank'
      : props.mode === 'compare' && correct
        ? (marked === correct ? 'correct' : 'incorrect')
        : 'marked'

    return {
      number: index + 1,
      marked,
      keyMarked,
      correct,
      status,
    }
  })
})

const columns = computed(() => {
  const midpoint = Math.ceil(rows.value.length / 2)
  return [
    rows.value.slice(0, midpoint),
    rows.value.slice(midpoint),
  ].filter(column => column.length)
})

function optionClass(row, option) {
  const classes = []
  const isMarked = row.marked === option
  const isKeyMarked = row.keyMarked === option
  const isCorrect = row.correct === option

  if (props.mode === 'inspect-key' && isKeyMarked) classes.push('bubble--key')
  if (props.mode === 'inspect-answers' && isMarked) classes.push('bubble--marked')
  if (props.mode === 'compare') {
    if (isCorrect) classes.push('bubble--key')
    if (isMarked && row.status === 'correct') classes.push('bubble--correct')
    if (isMarked && row.status === 'incorrect') classes.push('bubble--incorrect')
  }
  if (!isMarked && !isCorrect) classes.push('bubble--empty')
  return classes
}
</script>

<template>
  <section class="sheet-preview" aria-label="Cartilla visual de respuestas">
    <header class="sheet-preview__header">
      <h3>{{ title }}</h3>
      <span>Alternativas</span>
    </header>

    <div class="sheet-preview__grid">
      <div
        v-for="(columnRows, columnIndex) in columns"
        :key="`sheet-col-${columnIndex}`"
        class="sheet-preview__column"
      >
        <div
          v-for="row in columnRows"
          :key="row.number"
          class="sheet-row"
          :class="`sheet-row--${row.status}`"
        >
          <span class="sheet-row__number">{{ row.number }}.</span>
          <span class="sheet-row__options">
            <span
              v-for="option in OPTIONS"
              :key="option"
              class="bubble"
              :class="optionClass(row, option)"
            >
              {{ option }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sheet-preview {
  width: fit-content;
  max-width: 100%;
  padding: var(--space-4);
  border: 1px solid #f43f5e;
  border-radius: var(--radius-md);
  background: white;
  color: #9f1239;
}

.sheet-preview__header {
  margin-bottom: var(--space-3);
  text-align: center;
  text-transform: uppercase;
}

.sheet-preview__header h3 {
  margin: 0;
  color: var(--slate-900);
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: 0;
}

.sheet-preview__header span {
  display: block;
  margin-top: 2px;
  color: var(--slate-700);
  font-size: 0.9rem;
  font-weight: 800;
}

.sheet-preview__grid {
  display: grid;
  grid-template-columns: repeat(2, fit-content(100%));
  gap: var(--space-2);
  justify-content: center;
}

.sheet-preview__column {
  width: fit-content;
  border: 1px solid #fb7185;
  background: white;
}

.sheet-row {
  display: grid;
  grid-template-columns: 38px max-content;
  align-items: center;
  min-height: 28px;
  border-bottom: 1px solid #fecdd3;
  background: white;
}

.sheet-row:last-child {
  border-bottom: none;
}

.sheet-row:nth-child(even) {
  background: #fff7f8;
}

.sheet-row__number {
  padding-right: 4px;
  color: var(--slate-950);
  font-size: 0.86rem;
  font-weight: 900;
  text-align: right;
}

.sheet-row__options {
  display: inline-grid;
  grid-template-columns: repeat(5, 22px);
  gap: 3px;
  padding: 3px 8px 3px 3px;
  justify-content: start;
}

.bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #fb7185;
  border-radius: 50%;
  background: white;
  color: #e11d48;
  font-size: 0.76rem;
  font-weight: 800;
  line-height: 1;
}

.bubble--key {
  border-color: #60a5fa;
  background: #dbeafe;
  color: #1d4ed8;
}

.bubble--marked {
  border-color: #64748b;
  background: #e2e8f0;
  color: var(--slate-700);
}

.bubble--correct {
  border-color: #22c55e;
  background: #dcfce7;
  color: #15803d;
}

.bubble--incorrect {
  border-color: #ef4444;
  background: #fee2e2;
  color: #dc2626;
}

.bubble--empty {
  background: white;
}

@media (max-width: 680px) {
  .sheet-preview__grid {
    grid-template-columns: 1fr;
  }
}
</style>
