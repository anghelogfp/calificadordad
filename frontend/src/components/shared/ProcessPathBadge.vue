<script setup>
import { computed } from 'vue'

const props = defineProps({
  processType: { type: String, default: 'simulacro' },
  simulacroScope: { type: String, default: '' },
})

const label = computed(() => {
  if (props.processType === 'real') return 'Convocatoria real'
  return props.simulacroScope === 'general' ? 'Simulacro general' : 'Simulacro por áreas'
})

const variant = computed(() => props.processType === 'real' ? 'real' : 'simulacro')
</script>

<template>
  <span class="process-path-badge" :class="`process-path-badge--${variant}`">
    {{ label }}
  </span>
</template>

<style scoped>
.process-path-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--unap-blue-100);
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.process-path-badge--real {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #92400e;
}
</style>
