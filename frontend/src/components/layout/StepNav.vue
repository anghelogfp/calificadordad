<script setup>
const props = defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  getStepStatus: { type: Function, required: true },
  getStepLabel: { type: Function, required: true },
  getStepDescription: { type: Function, required: true },
  getStepAction: { type: Function, default: () => '' },
})

const emit = defineEmits(['update:activeTab'])
function selectTab(key) { emit('update:activeTab', key) }

function stepStatus(key) {
  return props.getStepStatus(key) || 'pending'
}

function stepStatusLabel(key) {
  const status = stepStatus(key)
  if (status === 'completed') return 'Listo'
  if (status === 'warning') return 'Revisar'
  return 'Pendiente'
}
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
            'step-item--completed': stepStatus(tab.key) === 'completed',
            'step-item--warning': stepStatus(tab.key) === 'warning',
            'step-item--blocked': stepStatus(tab.key) === 'blocked',
          }"
          :aria-current="activeTab === tab.key ? 'step' : undefined"
          @click="selectTab(tab.key)"
        >
          <span class="step-number">
            <svg v-if="stepStatus(tab.key) === 'completed'" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <svg v-else-if="stepStatus(tab.key) === 'warning'" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <svg v-else-if="stepStatus(tab.key) === 'blocked'" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/>
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </span>

          <span class="step-content">
            <span class="step-headline">
              <span class="step-label">{{ getStepLabel(tab.key) }}</span>
              <span class="step-state">{{ stepStatusLabel(tab.key) }}</span>
            </span>
            <span class="step-desc">{{ getStepDescription(tab.key) }}</span>
            <span class="step-action">{{ getStepAction(tab.key) }}</span>
          </span>
        </button>
      </div>
    </div>
    <div class="step-nav-hint" aria-hidden="true">Desliza para ver todos los pasos</div>
  </nav>
</template>

<style scoped>
.step-nav {
  flex-shrink: 0; padding: var(--space-3) var(--space-6);
  background: white; border-bottom: 1px solid var(--slate-200);
}
.step-nav-scroll { overflow-x: auto; scrollbar-width: none; }
.step-nav-scroll::-webkit-scrollbar { display: none; }
.step-nav-track {
  display: grid; grid-template-columns: repeat(5, minmax(158px, 1fr));
  align-items: stretch; width: 100%; min-width: 860px;
  gap: var(--space-2);
}
.step-item {
  position: relative; z-index: 1; display: flex; align-items: flex-start;
  flex-direction: row; justify-content: flex-start; gap: var(--space-2); min-width: 0;
  min-height: 84px;
  padding: var(--space-3); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);
  background: var(--slate-50); color: var(--slate-500); cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.step-item:hover { background: white; color: var(--slate-700); border-color: var(--slate-300); }
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
.step-item--warning .step-number {
  border-color: #f59e0b; background: #f59e0b; color: white;
}
.step-item--blocked .step-number {
  border-color: var(--slate-300); background: white; color: var(--slate-500);
}
.step-item--active {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-200);
  box-shadow: 0 8px 24px rgba(0, 64, 128, 0.08);
}
.step-item--active .step-number {
  border-color: var(--unap-blue-600); background: var(--unap-blue-600); color: white;
  box-shadow: 0 0 0 3px rgba(0, 64, 128, 0.12);
}
.step-content { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; text-align: left; gap: 3px; }
.step-headline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
}
.step-label {
  color: var(--slate-600); font-size: 0.82rem; font-weight: 700;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.step-item--active .step-label { color: var(--unap-blue-700); }
.step-item--completed .step-label { color: var(--success-600); }
.step-item--warning .step-label { color: #b45309; }
.step-item--blocked .step-label { color: var(--slate-600); }
.step-state {
  flex-shrink: 0;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: white;
  color: var(--slate-500);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.step-item--completed .step-state { color: var(--success-600); }
.step-item--warning .step-state { color: #b45309; }
.step-item--blocked .step-state { color: var(--slate-500); }
.step-desc {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--slate-500); font-size: 0.7rem; font-weight: 600;
}
.step-action {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--slate-400); font-size: 0.66rem; font-weight: 600;
}
.step-nav-hint { display: none; }

@media (max-width: 1024px) {
  .step-nav { padding-inline: var(--space-4); }
  .step-nav-track { grid-template-columns: repeat(5, 150px); min-width: 790px; }
}
@media (max-width: 700px) {
  .step-nav { position: relative; padding: var(--space-2) var(--space-3) var(--space-1); }
  .step-nav-scroll { scrollbar-width: thin; padding-bottom: 2px; }
  .step-nav-scroll::-webkit-scrollbar { display: block; height: 3px; }
  .step-nav-track { min-width: 700px; grid-template-columns: repeat(5, 132px); gap: var(--space-1); }
  .step-item { min-height: 78px; flex-direction: column; gap: 4px; padding: var(--space-2); }
  .step-content { align-items: center; text-align: center; }
  .step-headline { flex-direction: column; gap: 2px; }
  .step-label { font-size: 0.72rem; max-width: 112px; }
  .step-state { font-size: 0.56rem; }
  .step-desc { display: none; }
  .step-action { max-width: 112px; font-size: 0.6rem; }
  .step-nav-hint {
    display: block; padding-top: 2px; color: var(--slate-400);
    font-size: 0.62rem; text-align: right;
  }
}
</style>
