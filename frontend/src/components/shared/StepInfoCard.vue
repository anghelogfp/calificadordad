<script setup>
import ProcessPathBadge from './ProcessPathBadge.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'default' // 'default', 'gold'
  },
  stats: {
    type: Array,
    default: () => []
  },
  processType: { type: String, default: '' },
  simulacroScope: { type: String, default: '' },
})
</script>

<template>
  <div class="step-info-card" :class="{ 'step-info-card--gold': variant === 'gold' }">
    <div class="step-info-icon">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
      </slot>
    </div>
    <div class="step-info-content">
      <div class="step-info-title-row">
        <h2>{{ title }}</h2>
        <ProcessPathBadge
          v-if="processType"
          :process-type="processType"
          :simulacro-scope="simulacroScope"
        />
      </div>
      <p>{{ description }}</p>
    </div>
    <div class="step-info-stats" v-if="stats.length > 0">
      <div v-for="stat in stats" :key="stat.label" class="stat-item">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-info-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: white;
  border: 1px solid var(--slate-200);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.step-info-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 3px;
  background: var(--unap-blue-500);
  pointer-events: none;
}

.step-info-icon {
  width: 40px;
  height: 40px;
  background: var(--unap-blue-50);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-info-icon :deep(svg) {
  width: 22px;
  height: 22px;
  color: var(--unap-blue-600);
}

.step-info-content {
  flex: 1;
}

.step-info-content h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--slate-900);
  margin: 0 0 var(--space-1);
}

.step-info-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.step-info-content p {
  font-size: 0.8rem;
  color: var(--slate-500);
  margin: 0;
}

.step-info-stats {
  display: flex;
  gap: var(--space-4);
}

.stat-item {
  text-align: center;
  padding: var(--space-2) var(--space-4);
  background: var(--slate-50);
  border: 1px solid var(--slate-100);
  border-radius: var(--radius-md);
}

.stat-value {
  display: block;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--unap-blue-700);
  font-family: var(--font-mono);
}

.stat-label {
  font-size: 0.72rem;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Variante dorada para paso final */
.step-info-card--gold {
  background: linear-gradient(135deg, var(--unap-gold-50) 0%, white 100%);
  border-color: var(--unap-gold-200);
}

.step-info-card--gold::before {
  background: var(--unap-gold-500);
}

.step-info-card--gold .step-info-icon {
  background: var(--unap-gold-50);
}

.step-info-card--gold .step-info-icon :deep(svg) {
  color: var(--unap-gold-600);
}

.step-info-card--gold .step-info-content h2 {
  color: var(--slate-900);
}

.step-info-card--gold .step-info-content p {
  color: var(--slate-500);
}

.step-info-card--gold .stat-item {
  background: var(--unap-gold-50);
  border-color: var(--unap-gold-100);
}

.step-info-card--gold .stat-value {
  color: var(--unap-gold-600);
}

.step-info-card--gold .stat-label {
  color: var(--slate-500);
}

@media (max-width: 768px) {
  .step-info-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>
