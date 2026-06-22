<script setup>
import { computed } from 'vue'
import { useStorage } from '@vueuse/core'

const props = defineProps({
  historyCount: { type: Number, default: 0 },
  activeTab: { type: String, default: '' },
  activeDashboard: { type: Boolean, default: false },
  activePonderations: { type: Boolean, default: false },
  activeHistory: { type: Boolean, default: false },
  activeConfig: { type: Boolean, default: false },
  activeVerificador: { type: Boolean, default: false },
  activeBackup: { type: Boolean, default: false },
  activeUsuarios: { type: Boolean, default: false },
  isStaff: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false },
  lastProcessTab: { type: String, default: '' },
})

const emit = defineEmits(['newProcess', 'continueProcess', 'openDashboard', 'openPonderations', 'openHistory', 'openConfig', 'openBackup', 'openVerificador', 'openUsuarios', 'closeMobile'])

// El proceso está activo cuando el tab es uno de los 5 pasos
const PROCESS_TABS = ['archives', 'identifiers', 'responses', 'answer_keys', 'results']
const activeProcess = computed(() => PROCESS_TABS.includes(props.activeTab))

const STEP_LABELS = {
  archives: 'Padrón',
  identifiers: 'Identificadores',
  responses: 'Respuestas',
  answer_keys: 'Claves',
  results: 'Resultados',
}
const continueLabel = computed(() => STEP_LABELS[props.lastProcessTab] || '')
const showContinue = computed(() => !!props.lastProcessTab && !activeProcess.value)

const expanded = useStorage('calificador-sidebar-expanded', true)

function runAction(eventName) {
  emit(eventName)
  emit('closeMobile')
}
</script>

<template>
  <div
    v-if="mobileOpen"
    class="sidebar-mobile-backdrop"
    aria-hidden="true"
    @click="emit('closeMobile')"
  ></div>

  <aside
    class="app-sidebar"
    :class="{
      'app-sidebar--collapsed': !expanded,
      'app-sidebar--mobile-open': mobileOpen,
    }"
  >

    <!-- Toggle -->
    <button
      type="button"
      class="sidebar-toggle"
      :title="expanded ? 'Colapsar panel' : 'Expandir panel'"
      :aria-label="expanded ? 'Colapsar panel' : 'Expandir panel'"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path v-if="expanded" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M13 5l7 7-7 7M6 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Nuevo proceso / Continuar -->
    <div class="sidebar-new">
      <button
        type="button"
        class="btn-new-process"
        :class="{ 'btn-new-process--active': activeProcess }"
        @click="runAction('newProcess')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-if="expanded || mobileOpen">Nuevo proceso</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Nuevo proceso</span>
      </button>

      <button
        v-if="showContinue"
        type="button"
        class="btn-continue-process"
        @click="runAction('continueProcess')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-if="expanded || mobileOpen">Continuar: {{ continueLabel }}</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Continuar: {{ continueLabel }}</span>
      </button>
    </div>

    <nav class="sidebar-nav">

      <!-- Dashboard / Inicio -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeDashboard }"
        @click="runAction('openDashboard')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">Inicio</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Inicio</span>
      </button>

      <!-- Ponderaciones -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activePonderations }"
        @click="runAction('openPonderations')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">Ponderaciones</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Ponderaciones</span>
      </button>

      <!-- Configuración -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeConfig }"
        @click="runAction('openConfig')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-1.93 7.07M4.93 4.93A10 10 0 0 0 3 12a10 10 0 0 0 1.93 7.07M12 3v2M12 19v2M3 12H1M23 12h-2" stroke-linecap="round"/>
          </svg>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">Configuración</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Configuración</span>
      </button>

      <div class="sidebar-divider" />

      <!-- Historial -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeHistory }"
        @click="runAction('openHistory')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="historyCount > 0" class="sidebar-badge">{{ historyCount > 99 ? '99+' : historyCount }}</span>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">
          Historial
          <span v-if="historyCount > 0" class="sidebar-item__count">{{ historyCount }}</span>
        </span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Historial{{ historyCount > 0 ? ` (${historyCount})` : '' }}</span>
      </button>

      <!-- Verificador -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeVerificador }"
        @click="runAction('openVerificador')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">Verificador</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Verificador</span>
      </button>

      <div class="sidebar-divider" />

      <!-- Backup -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeBackup }"
        @click="runAction('openBackup')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded || mobileOpen" class="sidebar-item__label">Backup</span>
        <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Backup</span>
      </button>

      <!-- Usuarios (solo admin) -->
      <template v-if="isStaff">
        <div class="sidebar-divider" />
        <button
          type="button"
          class="sidebar-item"
          :class="{ 'sidebar-item--active': activeUsuarios }"
          @click="runAction('openUsuarios')"
        >
          <span class="sidebar-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span v-if="expanded || mobileOpen" class="sidebar-item__label">Usuarios</span>
          <span v-if="!expanded && !mobileOpen" class="sidebar-tooltip">Usuarios</span>
        </button>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid var(--slate-200);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s ease;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.app-sidebar--collapsed {
  width: 56px;
}

/* Nuevo proceso */
.sidebar-new {
  padding: var(--space-3) var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--slate-100);
  flex-shrink: 0;
}

.btn-new-process {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--unap-blue-600);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
}

.btn-new-process svg { width: 16px; height: 16px; flex-shrink: 0; }
.btn-new-process:hover { background: var(--unap-blue-500); }

.btn-new-process--active {
  background: linear-gradient(135deg, var(--unap-blue-600), var(--unap-blue-700));
  box-shadow: 0 2px 8px rgba(0, 51, 102, 0.35);
}

.app-sidebar--collapsed .btn-new-process {
  padding: var(--space-2);
}

.btn-continue-process {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: none;
  border: 1px solid var(--unap-blue-200);
  border-radius: var(--radius-md);
  color: var(--unap-blue-600);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
}
.btn-continue-process:hover {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-400);
}
.app-sidebar--collapsed .btn-continue-process {
  padding: var(--space-1);
  border-radius: var(--radius-md);
}

/* Toggle */
.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  border: none;
  border-bottom: 1px solid var(--slate-100);
  background: none;
  color: var(--slate-400);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.sidebar-toggle svg { width: 16px; height: 16px; }
.sidebar-toggle:hover { background: var(--slate-50); color: var(--unap-blue-600); }

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) 0;
  gap: 2px;
  flex: 1;
}

.sidebar-divider {
  height: 1px;
  background: var(--slate-100);
  margin: var(--space-2) var(--space-3);
}


/* Items */
.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  margin: 0 var(--space-2);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--slate-600);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
  transition: all 0.15s;
  min-height: 40px;
}

.app-sidebar--collapsed .sidebar-item {
  justify-content: center;
  padding: var(--space-2);
  margin: 0 var(--space-1);
}

.sidebar-item:hover {
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
}

.sidebar-item--active {
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
}

.sidebar-item--active .sidebar-item__icon svg {
  stroke: var(--unap-blue-600);
}

.sidebar-item--active::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-2));
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--unap-blue-600);
  border-radius: 0 2px 2px 0;
}

.sidebar-item__icon {
  position: relative;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-item__icon svg {
  width: 20px;
  height: 20px;
}

.sidebar-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: var(--unap-gold-500);
  color: var(--unap-blue-900);
  border-radius: var(--radius-full);
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.sidebar-item__label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
  flex: 1;
}

/* Flechita derecha en item activo */
.sidebar-item--active .sidebar-item__label::after {
  content: '›';
  margin-left: auto;
  font-size: 1rem;
  line-height: 1;
  color: var(--unap-blue-400);
  opacity: 0.7;
}

.sidebar-item__count {
  background: var(--unap-gold-100);
  color: var(--unap-gold-700);
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-1);
}

.sidebar-mobile-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .sidebar-mobile-backdrop {
    position: fixed;
    inset: 64px 0 0;
    display: block;
    background: rgba(15, 23, 42, 0.42);
    z-index: calc(var(--z-header) - 1);
  }

  .app-sidebar {
    position: fixed;
    top: 64px;
    bottom: 0;
    left: 0;
    width: min(82vw, 300px);
    display: flex;
    z-index: var(--z-header);
    box-shadow: var(--shadow-xl);
    transform: translateX(-105%);
    transition: transform 0.2s ease;
  }

  .app-sidebar--mobile-open {
    transform: translateX(0);
  }

  .app-sidebar--collapsed {
    width: min(82vw, 300px);
  }

  .app-sidebar--collapsed .sidebar-item {
    justify-content: flex-start;
    padding: var(--space-2) var(--space-3);
    margin: 0 var(--space-2);
  }

  .app-sidebar--collapsed .btn-new-process {
    padding: var(--space-2) var(--space-3);
  }

  .app-sidebar--collapsed .sidebar-tooltip {
    display: none;
  }
}

/* ── Tooltips en modo colapsado ─────────────────────────────────────────── */
.sidebar-tooltip {
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  background: var(--slate-900);
  color: white;
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 100;
  box-shadow: var(--shadow-md);
}

.sidebar-tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: var(--slate-900);
}

.app-sidebar--collapsed .sidebar-item:hover .sidebar-tooltip,
.app-sidebar--collapsed .btn-new-process:hover .sidebar-tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}
</style>
