<script setup>
defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  badge: { type: String, default: '' },
  variant: { type: String, default: 'simulacro' },
  lockedLabel: { type: String, default: '' },
})
</script>

<template>
  <section class="process-path-card" :class="`process-path-card--${variant}`">
    <div class="process-path-card__body">
      <div class="process-path-card__header">
        <span class="process-path-card__eyebrow">{{ eyebrow }}</span>
        <span v-if="lockedLabel" class="process-path-card__locked">{{ lockedLabel }}</span>
      </div>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <span v-if="badge" class="process-path-card__badge">{{ badge }}</span>
  </section>
</template>

<style scoped>
.process-path-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid #dbe7f5;
  border-left: 4px solid var(--unap-blue-500);
  border-radius: var(--radius-lg);
  background: #f9fbfe;
  box-shadow: var(--shadow-sm);
}

.process-path-card--real {
  border-color: #f3e1b2;
  border-left-color: var(--unap-gold-500);
  background: #fffdf7;
}

.process-path-card__body {
  min-width: 0;
}

.process-path-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 3px;
}

.process-path-card__eyebrow {
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.process-path-card h3 {
  margin: 0;
  color: var(--slate-900);
  font-size: 1rem;
  line-height: 1.35;
}

.process-path-card p {
  margin: 4px 0 0;
  color: var(--slate-500);
  font-size: 0.82rem;
  line-height: 1.45;
}

.process-path-card__badge,
.process-path-card__locked {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.process-path-card__badge {
  min-height: 28px;
  padding: 4px var(--space-3);
  border: 1px solid var(--slate-200);
  background: white;
  color: var(--unap-blue-700);
  font-size: 0.74rem;
  font-weight: 800;
}

.process-path-card--real .process-path-card__badge {
  color: #78350f;
}

.process-path-card__locked {
  min-height: 22px;
  padding: 2px var(--space-2);
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.7);
  color: var(--slate-500);
  font-size: 0.68rem;
  font-weight: 700;
}

@media (max-width: 700px) {
  .process-path-card {
    flex-direction: column;
  }

  .process-path-card__badge,
  .process-path-card__locked {
    white-space: normal;
  }
}
</style>
