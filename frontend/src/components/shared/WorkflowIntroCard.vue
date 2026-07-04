<script setup>
import ProcessPathBadge from './ProcessPathBadge.vue'

defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  count: { type: Number, default: 0 },
  countLabel: { type: String, default: 'registros' },
  ready: { type: Boolean, default: false },
  processType: { type: String, default: '' },
  simulacroScope: { type: String, default: '' },
})
</script>

<template>
  <section class="workflow-card">
    <header class="workflow-card__header">
      <div class="workflow-card__identity">
        <div class="workflow-card__icon"><slot name="icon" /></div>
        <div>
          <span v-if="eyebrow" class="workflow-card__eyebrow">{{ eyebrow }}</span>
          <div class="workflow-card__title-row">
            <h2>{{ title }}</h2>
            <ProcessPathBadge
              v-if="processType"
              :process-type="processType"
              :simulacro-scope="simulacroScope"
            />
          </div>
          <p>{{ description }}</p>
        </div>
      </div>
      <div class="workflow-card__status" :class="{ 'workflow-card__status--ready': ready }">
        <strong>{{ count }}</strong>
        <span>{{ ready ? countLabel : 'sin registros' }}</span>
      </div>
    </header>
    <div v-if="$slots.default" class="workflow-card__body"><slot /></div>
  </section>
</template>

<style scoped>
.workflow-card {
  display: flex; flex-direction: column; gap: var(--space-4);
  padding: var(--space-5); background: white;
  border: 1px solid var(--slate-200); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm); min-width: 0;
}
.workflow-card__header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-5);
}
.workflow-card__identity { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.workflow-card__icon {
  width: 46px; height: 46px; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; border-radius: var(--radius-lg);
  background: var(--unap-blue-50); color: var(--unap-blue-600);
}
.workflow-card__icon :deep(svg) { width: 24px; height: 24px; }
.workflow-card__eyebrow {
  display: block; margin-bottom: 2px; color: var(--unap-blue-600);
  font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
}
.workflow-card h2 { margin: 0; color: var(--slate-900); font-size: 1.2rem; line-height: 1.25; }
.workflow-card__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.workflow-card__identity p { margin: 3px 0 0; color: var(--slate-500); font-size: 0.82rem; }
.workflow-card__status {
  display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0;
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg);
  background: var(--slate-100); color: var(--slate-500);
}
.workflow-card__status strong { color: var(--slate-800); font: 800 1.2rem/1 var(--font-mono); }
.workflow-card__status span { margin-top: 3px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
.workflow-card__status--ready { background: var(--success-50); color: var(--success-600); }
.workflow-card__status--ready strong { color: var(--success-600); }
.workflow-card__body { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.workflow-card__body :deep(.uploader) { box-shadow: none; border-radius: var(--radius-lg); }
.workflow-card__body :deep(.uploader__label) { padding: var(--space-6) var(--space-5); gap: var(--space-3); }
.workflow-card__body :deep(.uploader__icon) { width: 54px; height: 54px; }
@media (max-width: 640px) {
  .workflow-card { padding: var(--space-4); }
  .workflow-card__header, .workflow-card__identity { align-items: flex-start; }
  .workflow-card__status span { display: none; }
}
</style>
