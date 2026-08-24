<script setup>
import { computed } from 'vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import ProcessPathBadge from '@/components/shared/ProcessPathBadge.vue'

const props = defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  getStepStatus: { type: Function, required: true },
  getStepLabel: { type: Function, required: true },
  getStepDescription: { type: Function, required: true },
  getStepAction: { type: Function, default: () => '' },
  processName: { type: String, default: '' },
  processType: { type: String, default: '' },
  simulacroScope: { type: String, default: '' },
  hasResults: { type: Boolean, default: false },
  isSavedToHistory: { type: Boolean, default: false },
  savingToHistory: { type: Boolean, default: false },
  mobileMenuOpen: { type: Boolean, default: false },
  historyCount: { type: Number, default: 0 },
  isStaff: { type: Boolean, default: false },
  lastProcessTab: { type: String, default: '' },
})

const emit = defineEmits([
  'goHome', 'newProcess', 'update:activeTab', 'saveToHistory', 'toggleMobileMenu',
  'openDashboard', 'openPostulantes', 'openCalificacion',
  'openPonderations', 'openHistory', 'openConfig',
  'openBackup', 'openVerificador', 'openUsuarios', 'closeMobile',
])

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

const currentStepIndex = computed(() => {
  const idx = props.tabs.findIndex(t => t.key === props.activeTab)
  return idx >= 0 ? idx + 1 : 0
})

const progressPercent = computed(() => {
  if (!props.tabs.length) return 0
  const completed = props.tabs.filter(t => stepStatus(t.key) === 'completed').length
  return Math.round((completed / props.tabs.length) * 100)
})
</script>

<template>
  <div class="process-layout">
    <AppHeader
      :mobile-menu-open="mobileMenuOpen"
      @go-home="emit('goHome')"
      @toggle-mobile-menu="emit('toggleMobileMenu')"
    />

    <div class="process-body">
      <AppSidebar
        :history-count="historyCount"
        :active-tab="activeTab"
        :active-dashboard="false"
        :active-postulantes="false"
        :active-calificacion="true"
        :active-ponderations="false"
        :active-history="false"
        :active-config="false"
        :active-verificador="false"
        :active-backup="false"
        :active-usuarios="false"
        :is-staff="isStaff"
        :mobile-open="mobileMenuOpen"
        :last-process-tab="lastProcessTab"
        @new-process="emit('newProcess')"
        @continue-process="emit('goHome')"
        @open-dashboard="emit('openDashboard')"
        @open-postulantes="emit('openPostulantes')"
        @open-calificacion="emit('openCalificacion')"
        @open-ponderations="emit('openPonderations')"
        @open-history="emit('openHistory')"
        @open-config="emit('openConfig')"
        @open-backup="emit('openBackup')"
        @open-verificador="emit('openVerificador')"
        @open-usuarios="emit('openUsuarios')"
        @close-mobile="emit('closeMobile')"
      />

      <div class="process-content">
        <!-- Barra de pasos horizontal -->
        <div class="process-topbar">
          <div class="process-topbar__left">
            <div class="process-topbar__info">
              <h2 class="process-topbar__name">{{ processName || 'Proceso sin nombre' }}</h2>
              <ProcessPathBadge
                v-if="processType"
                :process-type="processType"
                :simulacro-scope="simulacroScope"
              />
            </div>
            <div class="process-topbar__progress">
              <div class="process-topbar__progress-track">
                <div class="process-topbar__progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <span class="process-topbar__progress-text">{{ progressPercent }}%</span>
            </div>
          </div>
          <div class="process-topbar__actions">
            <button
              v-if="hasResults"
              type="button"
              class="process-topbar__btn"
              :class="{ 'process-topbar__btn--saved': isSavedToHistory }"
              :disabled="savingToHistory || isSavedToHistory"
              @click="emit('saveToHistory')"
            >
              <svg v-if="isSavedToHistory" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="17 21 17 13 7 13 7 21" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ isSavedToHistory ? 'Guardado' : 'Guardar' }}
            </button>
          </div>
        </div>

        <!-- Steps horizontal -->
        <nav class="process-steps-bar" aria-label="Pasos del proceso">
          <button
            v-for="(tab, index) in tabs"
            :key="tab.key"
            type="button"
            class="step-pill"
            :class="{
              'step-pill--active': activeTab === tab.key,
              'step-pill--completed': stepStatus(tab.key) === 'completed',
              'step-pill--warning': stepStatus(tab.key) === 'warning',
            }"
            @click="selectTab(tab.key)"
          >
            <span class="step-pill__number">
              <svg v-if="stepStatus(tab.key) === 'completed'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="stepStatus(tab.key) === 'warning'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span class="step-pill__label">{{ getStepLabel(tab.key) }}</span>
            <span class="step-pill__state" :class="`step-pill__state--${stepStatus(tab.key)}`">{{ stepStatusLabel(tab.key) }}</span>
          </button>
        </nav>

        <!-- Contenido del paso -->
        <main class="process-main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.process-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.process-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.process-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* ── Barra superior: info del proceso + acciones ──────────────────────────── */
.process-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: white;
  border-bottom: 1px solid var(--slate-100);
}

.process-topbar__left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  flex: 1;
}

.process-topbar__info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.process-topbar__name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--slate-900);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.process-topbar__progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.process-topbar__progress-track {
  width: 120px;
  height: 5px;
  background: var(--slate-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.process-topbar__progress-fill {
  height: 100%;
  background: var(--unap-blue-600);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}

.process-topbar__progress-text {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--slate-500);
  font-family: var(--font-mono);
  min-width: 28px;
}

.process-topbar__actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.process-topbar__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--slate-600);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.process-topbar__btn svg { width: 14px; height: 14px; }
.process-topbar__btn:hover:not(:disabled) { background: var(--slate-50); }
.process-topbar__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.process-topbar__btn--saved { background: var(--success-50); color: var(--success-600); border-color: var(--success-100); }

/* ── Pasos horizontales ────────────────────────────────────────────────────── */
.process-steps-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-100);
  overflow-x: auto;
  scrollbar-width: none;
}
.process-steps-bar::-webkit-scrollbar { display: none; }

.step-pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-full);
  background: white;
  color: var(--slate-500);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.step-pill:hover { border-color: var(--slate-300); background: var(--slate-50); }

.step-pill--active {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-400);
  color: var(--unap-blue-700);
}

.step-pill__number {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--slate-200); border-radius: 50%;
  background: white; color: var(--slate-400);
  font: 700 0.68rem/1 var(--font-mono);
  flex-shrink: 0;
}
.step-pill__number svg { width: 12px; height: 12px; }

.step-pill--completed .step-pill__number {
  border-color: var(--success-500); background: var(--success-500); color: white;
}
.step-pill--warning .step-pill__number {
  border-color: var(--warning-500); background: var(--warning-500); color: white;
}
.step-pill--active .step-pill__number {
  border-color: var(--unap-blue-600); background: var(--unap-blue-600); color: white;
}

.step-pill__label {
  font-size: 0.78rem;
  font-weight: 700;
}

.step-pill__state {
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--slate-100);
  color: var(--slate-500);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.step-pill__state--completed { background: var(--success-100); color: var(--success-600); }
.step-pill__state--warning { background: var(--warning-100); color: var(--warning-600); }
.step-pill__state--pending { background: var(--slate-100); color: var(--slate-400); }

/* ── Contenido ─────────────────────────────────────────────────────────────── */
.process-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-5) var(--space-6);
  min-width: 0;
}

.process-main > * { min-width: 0; max-width: 100%; }

@media (max-width: 768px) {
  .process-topbar { padding: var(--space-2) var(--space-3); }
  .process-topbar__name { max-width: 140px; font-size: 0.82rem; }
  .process-topbar__progress-track { width: 60px; }
  .process-steps-bar { padding: var(--space-2) var(--space-3); }
  .step-pill__state { display: none; }
  .process-main { padding: var(--space-4); }
}
</style>
