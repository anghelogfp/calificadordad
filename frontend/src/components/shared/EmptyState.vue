<script setup>
defineProps({
  title: {
    type: String,
    default: 'Sin registros cargados'
  },
  description: {
    type: String,
    default: 'Importa un archivo o agrega registros manualmente para comenzar.'
  },
  icon: {
    type: String,
    default: 'add' // 'add', 'time', 'document'
  }
})
</script>

<template>
  <section class="empty-state">
    <div class="empty-state__icon">
      <!-- Icon: Add -->
      <svg v-if="icon === 'add'" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>
        <path d="M20 24h8M24 20v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <!-- Icon: Time -->
      <svg v-else-if="icon === 'time'" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>
        <path d="M24 16v8l6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <!-- Icon: Document -->
      <svg v-else viewBox="0 0 48 48" fill="none">
        <path d="M14 6h14l10 10v26a2 2 0 01-2 2H14a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M28 6v10h10" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    </div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <slot></slot>
  </section>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--slate-50);
  border: 1px dashed var(--slate-200);
  border-radius: var(--radius-md);
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  background: var(--slate-100);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.empty-state__icon svg {
  width: 32px;
  height: 32px;
  color: var(--slate-400);
}

.empty-state h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-700);
  margin: 0 0 var(--space-2);
}

.empty-state p {
  font-size: 0.9rem;
  color: var(--slate-500);
  margin: 0;
  max-width: 300px;
}
</style>
