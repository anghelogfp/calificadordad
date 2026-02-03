<script setup>
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
  }
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
      <h2>{{ title }}</h2>
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
  gap: var(--space-5);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-blue);
  position: relative;
  overflow: hidden;
}

.step-info-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.step-info-icon {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-info-icon :deep(svg) {
  width: 32px;
  height: 32px;
  color: var(--unap-gold-400);
}

.step-info-content {
  flex: 1;
}

.step-info-content h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin: 0 0 var(--space-1);
}

.step-info-content p {
  font-size: 0.9rem;
  color: var(--unap-blue-200);
  margin: 0;
}

.step-info-stats {
  display: flex;
  gap: var(--space-4);
}

.stat-item {
  text-align: center;
  padding: var(--space-3) var(--space-5);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--unap-gold-400);
  font-family: var(--font-mono);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--unap-blue-200);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Variante dorada para paso final */
.step-info-card--gold {
  background: linear-gradient(135deg, var(--unap-gold-500) 0%, var(--unap-gold-600) 100%);
}

.step-info-card--gold::before {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
}

.step-info-card--gold .step-info-icon {
  background: rgba(0, 29, 61, 0.2);
}

.step-info-card--gold .step-info-icon :deep(svg) {
  color: var(--unap-blue-900);
}

.step-info-card--gold .step-info-content h2 {
  color: var(--unap-blue-900);
}

.step-info-card--gold .step-info-content p {
  color: var(--unap-blue-800);
}

.step-info-card--gold .stat-item {
  background: rgba(0, 29, 61, 0.15);
}

.step-info-card--gold .stat-value {
  color: var(--unap-blue-900);
}

.step-info-card--gold .stat-label {
  color: var(--unap-blue-800);
}

@media (max-width: 768px) {
  .step-info-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>
