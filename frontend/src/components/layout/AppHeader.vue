<script setup>
const props = defineProps({
  convocatoria: { type: Object, default: null },
  historyCount: { type: Number, default: 0 },
})

const emit = defineEmits(['openBackup', 'openConvocatoria', 'openHistory', 'openConfig'])
</script>

<template>
  <header class="app-header">
    <div class="header-brand">
      <div class="brand-logo">
        <img
          src="/unap.png"
          alt="Logo"
          width="80"
          height="80"
          style="border-radius: 12px"
        />
      </div>
      <div class="brand-text">
        <h1>Sistema de Calificación</h1>
        <span class="brand-subtitle">Universidad Nacional del Altiplano - Puno</span>
      </div>
    </div>

    <div class="header-meta">
      <!-- Selector de convocatoria -->
      <button
        type="button"
        class="convocatoria-btn"
        :class="{ 'convocatoria-btn--active': convocatoria?.status === 'active' }"
        @click="emit('openConvocatoria')"
        title="Gestionar convocatoria"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
        <span>{{ convocatoria ? convocatoria.name : 'Seleccionar convocatoria' }}</span>
        <span v-if="convocatoria?.status === 'active'" class="status-dot status-dot--active" />
        <span v-else-if="convocatoria" class="status-dot status-dot--closed" />
      </button>

      <!-- Botón Historial -->
      <button
        type="button"
        class="history-btn"
        @click="emit('openHistory')"
        title="Ver historial de procesos"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
        </svg>
        <span>Historial</span>
        <span v-if="historyCount > 0" class="history-badge">{{ historyCount }}</span>
      </button>

      <!-- Botón Configuración -->
      <button
        type="button"
        class="header-icon-btn"
        @click="emit('openConfig')"
        title="Configuración"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
        </svg>
      </button>

      <!-- Botón Backup -->
      <button
        type="button"
        class="header-icon-btn"
        @click="emit('openBackup')"
        title="Backup de sesión"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>
      </button>

      <div class="header-badge">
        Dirección de Admisión {{ new Date().getFullYear() }}
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: linear-gradient(135deg, var(--unap-blue-800) 0%, var(--unap-blue-900) 100%);
  padding: var(--space-5) var(--space-8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 10;
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--unap-gold-500), var(--unap-gold-400), var(--unap-gold-500));
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.brand-text h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  font-size: 0.85rem;
  color: var(--unap-gold-300);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Botón convocatoria */
.convocatoria-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  backdrop-filter: blur(8px);
  max-width: 280px;
}

.convocatoria-btn svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }
.convocatoria-btn span:not(.status-dot) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.convocatoria-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.convocatoria-btn--active {
  border-color: var(--unap-gold-400);
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--active { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.status-dot--closed { background: var(--slate-400); }

/* Botón ícono header */
.header-icon-btn {
  width: 36px; height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.08);
  color: white;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}

.header-icon-btn svg { width: 18px; height: 18px; opacity: 0.8; }
.header-icon-btn:hover { background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.3); }

/* Historial */
.history-btn {
  display: flex; align-items: center; gap: var(--space-2);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  color: white; font-size: 0.85rem; font-weight: 500;
  cursor: pointer; transition: all var(--transition-fast);
  backdrop-filter: blur(8px);
}
.history-btn svg { width: 16px; height: 16px; opacity: 0.8; flex-shrink: 0; }
.history-btn:hover { background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.3); }

.history-badge {
  background: var(--unap-gold-500); color: var(--unap-blue-900);
  border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700;
  min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  padding: 0 var(--space-1);
}

.header-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  backdrop-filter: blur(8px);
}

@media (max-width: 1024px) {
  .app-header {
    padding: var(--space-4) var(--space-5);
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .brand-text h1 { font-size: 1.2rem; }
  .convocatoria-btn { max-width: 200px; }
}
</style>
