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
})

const emit = defineEmits(['newProcess', 'openDashboard', 'openPonderations', 'openHistory', 'openConfig', 'openBackup', 'openVerificador'])

// El proceso está activo cuando el tab es uno de los 5 pasos
const PROCESS_TABS = ['archives', 'identifiers', 'responses', 'answer_keys', 'results']
const activeProcess = computed(() => PROCESS_TABS.includes(props.activeTab))

const expanded = useStorage('calificador-sidebar-expanded', true)
</script>

<template>
  <aside class="app-sidebar" :class="{ 'app-sidebar--collapsed': !expanded }">

    <!-- Toggle -->
    <button
      type="button"
      class="sidebar-toggle"
      :title="expanded ? 'Colapsar panel' : 'Expandir panel'"
      @click="expanded = !expanded"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path v-if="expanded" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M13 5l7 7-7 7M6 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Nuevo proceso -->
    <div class="sidebar-new">
      <button
        type="button"
        class="btn-new-process"
        :class="{ 'btn-new-process--active': activeProcess }"
        :title="!expanded ? 'Nuevo proceso' : undefined"
        @click="emit('newProcess')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-if="expanded">Nuevo proceso</span>
      </button>
    </div>

    <nav class="sidebar-nav">

      <!-- Dashboard / Inicio -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeDashboard }"
        :title="!expanded ? 'Inicio' : undefined"
        @click="emit('openDashboard')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded" class="sidebar-item__label">Inicio</span>
      </button>

      <!-- Ponderaciones -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activePonderations }"
        :title="!expanded ? 'Ponderaciones' : undefined"
        @click="emit('openPonderations')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded" class="sidebar-item__label">Ponderaciones</span>
      </button>

      <div class="sidebar-divider" />

      <!-- Historial -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeHistory }"
        :title="!expanded ? 'Historial de procesos' : undefined"
        @click="emit('openHistory')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="historyCount > 0" class="sidebar-badge">{{ historyCount > 99 ? '99+' : historyCount }}</span>
        </span>
        <span v-if="expanded" class="sidebar-item__label">
          Historial
          <span v-if="historyCount > 0" class="sidebar-item__count">{{ historyCount }}</span>
        </span>
      </button>

      <!-- Configuración -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeConfig }"
        :title="!expanded ? 'Configuración' : undefined"
        @click="emit('openConfig')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-1.93 7.07M4.93 4.93A10 10 0 0 0 3 12a10 10 0 0 0 1.93 7.07M12 3v2M12 19v2M3 12H1M23 12h-2" stroke-linecap="round"/>
          </svg>
        </span>
        <span v-if="expanded" class="sidebar-item__label">Configuración</span>
      </button>

      <!-- Verificador -->
      <button
        type="button"
        class="sidebar-item"
        :class="{ 'sidebar-item--active': activeVerificador }"
        :title="!expanded ? 'Verificador de respuestas' : undefined"
        @click="emit('openVerificador')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded" class="sidebar-item__label">Verificador</span>
      </button>

      <!-- Backup -->
      <button
        type="button"
        class="sidebar-item"
        :title="!expanded ? 'Backup de sesión' : undefined"
        @click="emit('openBackup')"
      >
        <span class="sidebar-item__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-if="expanded" class="sidebar-item__label">Backup</span>
      </button>
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

@media (max-width: 768px) {
  .app-sidebar {
    display: none;
  }
}
</style>
