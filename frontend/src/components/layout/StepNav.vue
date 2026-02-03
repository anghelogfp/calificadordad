<script setup>
import { TAB_KEYS } from '@/constants'

const props = defineProps({
  tabs: {
    type: Array,
    required: true
  },
  activeTab: {
    type: String,
    required: true
  },
  getStepStatus: {
    type: Function,
    required: true
  },
  getStepLabel: {
    type: Function,
    required: true
  },
  getStepDescription: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['update:activeTab'])

function selectTab(key) {
  emit('update:activeTab', key)
}
</script>

<template>
  <nav class="step-nav" aria-label="Pasos del proceso">
    <div class="step-nav-track">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.key"
        type="button"
        class="step-item"
        :class="{
          'step-item--active': activeTab === tab.key,
          'step-item--completed': getStepStatus(tab.key) === 'completed',
          'step-item--current': activeTab === tab.key
        }"
        @click="selectTab(tab.key)"
      >
        <span class="step-number">
          <span v-if="getStepStatus(tab.key) === 'completed'" class="step-check">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </span>
          <span v-else>{{ index + 1 }}</span>
        </span>
        <span class="step-content">
          <span class="step-label">{{ getStepLabel(tab.key) }}</span>
          <span class="step-desc">{{ getStepDescription(tab.key) }}</span>
        </span>
        <span v-if="index < tabs.length - 1" class="step-connector"></span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.step-nav {
  background: white;
  border-bottom: 1px solid var(--slate-200);
  padding: var(--space-4) var(--space-8);
  overflow-x: auto;
}

.step-nav-track {
  display: flex;
  align-items: stretch;
  gap: 0;
  min-width: max-content;
}

.step-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  flex: 1;
  min-width: 180px;
}

.step-item:hover {
  background: var(--slate-50);
}

.step-item--active {
  background: var(--unap-blue-50);
}

.step-item--completed .step-number {
  background: var(--success-500);
  border-color: var(--success-500);
  color: white;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 2px solid var(--slate-300);
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--slate-500);
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.step-item--active .step-number {
  background: var(--unap-blue-600);
  border-color: var(--unap-blue-600);
  color: white;
  box-shadow: 0 0 0 4px rgba(0, 51, 102, 0.15);
}

.step-check svg {
  width: 18px;
  height: 18px;
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.step-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--slate-700);
  transition: color var(--transition-fast);
}

.step-item--active .step-label {
  color: var(--unap-blue-700);
}

.step-desc {
  font-size: 0.75rem;
  color: var(--slate-500);
}

.step-connector {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 2px;
  background: var(--slate-200);
}

.step-item--completed .step-connector {
  background: var(--success-400);
}

@media (max-width: 1024px) {
  .step-nav {
    padding: var(--space-3) var(--space-4);
  }

  .step-item {
    min-width: 140px;
    padding: var(--space-2) var(--space-3);
  }
}

@media (max-width: 768px) {
  .step-nav-track {
    gap: 0;
  }

  .step-item {
    min-width: 100px;
    flex-direction: column;
    text-align: center;
    gap: var(--space-2);
  }

  .step-content {
    align-items: center;
  }

  .step-connector {
    display: none;
  }
}
</style>
