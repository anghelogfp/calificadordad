<script setup>
const props = defineProps({
  tabs: {
    type: Array,
    required: true
    // [{ key: 'list', label: 'Registros (10)' }]
  },
  modelValue: {
    type: String,
    required: true
  },
  ariaLabel: {
    type: String,
    default: 'Secciones'
  },
  variant: {
    type: String,
    default: 'default' // 'default', 'modal'
  }
})

const emit = defineEmits(['update:modelValue'])

function selectTab(key) {
  emit('update:modelValue', key)
}
</script>

<template>
  <nav
    class="subtabs"
    :class="{ 'subtabs--modal': variant === 'modal' }"
    :aria-label="ariaLabel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="subtab"
      :class="{ 'subtab--active': modelValue === tab.key }"
      @click="selectTab(tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.subtabs {
  display: inline-flex;
  gap: var(--space-1);
  background: var(--slate-100);
  padding: var(--space-1);
  border-radius: var(--radius-lg);
  align-self: flex-start;
  border: 1px solid var(--slate-200);
}

.subtab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--slate-600);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.subtab:hover {
  color: var(--slate-800);
  background: var(--slate-50);
}

.subtab--active {
  background: white;
  color: var(--unap-blue-700);
  box-shadow: var(--shadow-sm);
}

.subtabs--modal {
  align-self: stretch;
  margin: var(--space-4) var(--space-6);
  background: var(--slate-100);
}
</style>
