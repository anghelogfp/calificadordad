<script setup>
const props = defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  getStepStatus: { type: Function, required: true },
  getStepLabel: { type: Function, required: true },
  getStepDescription: { type: Function, required: true },
})

const emit = defineEmits(['update:activeTab'])
function selectTab(key) { emit('update:activeTab', key) }
</script>

<template>
  <nav class="step-nav" aria-label="Pasos del proceso">
    <div class="step-nav-scroll">
      <div class="step-nav-track">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.key"
          type="button"
          class="step-item"
          :class="{
            'step-item--active': activeTab === tab.key,
            'step-item--completed': getStepStatus(tab.key) === 'completed',
          }"
          :aria-current="activeTab === tab.key ? 'step' : undefined"
          @click="selectTab(tab.key)"
        >
          <span class="step-number">
            <svg v-if="getStepStatus(tab.key) === 'completed'" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </span>

          <span class="step-content">
            <span class="step-label">{{ getStepLabel(tab.key) }}</span>
            <span v-if="activeTab === tab.key" class="step-desc">{{ getStepDescription(tab.key) }}</span>
          </span>
        </button>
      </div>
    </div>
    <div class="step-nav-hint" aria-hidden="true">Desliza para ver todos los pasos</div>
  </nav>
</template>

<style scoped>
.step-nav {
  flex-shrink: 0; padding: var(--space-2) var(--space-6);
  background: white; border-bottom: 1px solid var(--slate-200);
}
.step-nav-scroll { overflow-x: auto; scrollbar-width: none; }
.step-nav-scroll::-webkit-scrollbar { display: none; }
.step-nav-track {
  display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr));
  align-items: start; width: 100%; min-width: 680px;
}
.step-item {
  position: relative; z-index: 1; display: flex; align-items: center;
  flex-direction: row; justify-content: center; gap: var(--space-2); min-width: 0;
  padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-lg);
  background: transparent; color: var(--slate-500); cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.step-item:hover { background: var(--slate-50); color: var(--slate-700); }
.step-number {
  position: relative; z-index: 2; width: 30px; height: 30px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--slate-300); border-radius: 50%; background: white;
  color: var(--slate-500); font: 700 0.78rem/1 var(--font-mono);
  transition: all var(--transition-base);
}
.step-number svg { width: 16px; height: 16px; }
.step-item--completed .step-number {
  border-color: var(--success-500); background: var(--success-500); color: white;
}
.step-item--active { background: var(--unap-blue-50); }
.step-item--active .step-number {
  border-color: var(--unap-blue-600); background: var(--unap-blue-600); color: white;
  box-shadow: 0 0 0 3px rgba(0, 64, 128, 0.12);
}
.step-content { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; text-align: left; }
.step-label {
  color: var(--slate-600); font-size: 0.82rem; font-weight: 700;
  white-space: nowrap;
}
.step-item--active .step-label { color: var(--unap-blue-700); }
.step-item--completed .step-label { color: var(--success-600); }
.step-desc {
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--slate-500); font-size: 0.68rem; font-weight: 500;
}
.step-nav-hint { display: none; }

@media (max-width: 1024px) {
  .step-nav { padding-inline: var(--space-4); }
  .step-nav-track { grid-template-columns: repeat(5, minmax(115px, 1fr)); min-width: 610px; }
  .step-desc { display: none; }
}
@media (max-width: 700px) {
  .step-nav { position: relative; padding: var(--space-2) var(--space-3) var(--space-1); }
  .step-nav-scroll { scrollbar-width: thin; padding-bottom: 2px; }
  .step-nav-scroll::-webkit-scrollbar { display: block; height: 3px; }
  .step-nav-track { min-width: 560px; grid-template-columns: repeat(5, 112px); }
  .step-item { flex-direction: column; gap: 3px; padding: var(--space-1) var(--space-2); }
  .step-content { align-items: center; text-align: center; }
  .step-label { font-size: 0.72rem; }
  .step-nav-hint {
    display: block; padding-top: 2px; color: var(--slate-400);
    font-size: 0.62rem; text-align: right;
  }
}
</style>
