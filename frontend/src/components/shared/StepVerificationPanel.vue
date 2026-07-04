<script setup>
defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
})
</script>

<template>
  <section class="step-verification-panel">
    <div class="step-verification-panel__header">
      <div class="step-verification-panel__main">
        <span class="step-verification-panel__eyebrow">{{ eyebrow }}</span>
        <h3>{{ title }}</h3>
      </div>
      <div v-if="summary || $slots.actions" class="step-verification-panel__side">
        <span v-if="summary" class="step-verification-panel__summary">{{ summary }}</span>
        <div v-if="$slots.actions" class="step-verification-panel__actions">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <div v-if="$slots.chips" class="step-verification-panel__chips">
      <slot name="chips" />
    </div>

    <div v-if="$slots.detail" class="step-verification-panel__detail">
      <slot name="detail" />
    </div>

    <div v-if="$slots.default" class="step-verification-panel__content">
      <slot />
    </div>

    <p v-if="$slots.hint" class="step-verification-panel__hint">
      <slot name="hint" />
    </p>
  </section>
</template>

<style scoped>
.step-verification-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--slate-200);
  border-left: 4px solid var(--slate-300);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: var(--shadow-sm);
}

.step-verification-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.step-verification-panel__main {
  min-width: 0;
}

.step-verification-panel__eyebrow {
  display: block;
  margin-bottom: 2px;
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.step-verification-panel h3 {
  margin: 0;
  color: var(--slate-900);
  font-size: 0.98rem;
  line-height: 1.35;
}

.step-verification-panel__side {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.step-verification-panel__summary {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: white;
  color: var(--slate-600);
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
}

.step-verification-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.step-verification-panel__chips,
.step-verification-panel__detail,
.step-verification-panel__content {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.step-verification-panel__content {
  flex-direction: column;
}

.step-verification-panel__detail {
  padding-top: var(--space-2);
  border-top: 1px solid var(--slate-200);
}

.step-verification-panel__hint {
  margin: 0;
  color: var(--slate-500);
  font-size: 0.8rem;
  line-height: 1.45;
}

:slotted(.verification-chip) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: white;
  color: var(--slate-600);
  font-size: 0.76rem;
  font-weight: 700;
}

:slotted(.verification-chip strong) {
  color: var(--slate-900);
  font-family: var(--font-mono);
}

:slotted(.verification-chip--ok) {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

:slotted(.verification-chip--ok strong) {
  color: #14532d;
}

:slotted(.verification-chip--warn) {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

:slotted(.verification-chip--warn strong) {
  color: #78350f;
}

:slotted(.verification-chip--error) {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

:slotted(.verification-chip--error strong) {
  color: #991b1b;
}

:slotted(.verification-chip--info) {
  border-color: #dbe7f5;
  background: #f8fbff;
  color: var(--unap-blue-700);
}

:slotted(.verification-chip--muted) {
  border-color: var(--slate-200);
  background: var(--slate-50);
  color: var(--slate-500);
}

@media (max-width: 700px) {
  .step-verification-panel {
    padding: var(--space-4);
  }

  .step-verification-panel__header,
  .step-verification-panel__side {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
