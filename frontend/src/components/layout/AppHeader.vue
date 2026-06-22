<script setup>
import { useAuth } from '@/composables/useAuth'

const auth = useAuth()

defineProps({
  mobileMenuOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['goHome', 'toggleMobileMenu'])
</script>

<template>
  <header class="app-header">
    <button
      type="button"
      class="mobile-menu-btn"
      :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'"
      :aria-expanded="mobileMenuOpen"
      @click="emit('toggleMobileMenu')"
    >
      <svg v-if="!mobileMenuOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Marca institucional -->
    <button type="button" class="header-brand" aria-label="Ir al inicio" @click="emit('goHome')">
      <img src="/unap.png" alt="UNAP" class="brand-logo" />
      <div class="brand-text">
        <span class="brand-system">Sistema de Calificación</span>
        <span class="brand-context">Dirección de Admisión <span aria-hidden="true">·</span> UNAP</span>
      </div>
    </button>

    <!-- Acciones de sesión -->
    <div class="header-actions">

      <!-- Usuario + logout -->
      <div class="user-chip">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
        </svg>
        <span class="user-name">{{ auth.user.value?.first_name || auth.user.value?.username }}</span>
        <button type="button" class="logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión" @click="auth.logout()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: linear-gradient(135deg, var(--unap-blue-800) 0%, var(--unap-blue-900) 100%);
  padding: 0 var(--space-6);
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: var(--z-header);
  flex-shrink: 0;
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--unap-gold-400), transparent);
}

.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.08);
  color: white;
  cursor: pointer;
  flex-shrink: 0;
}

.mobile-menu-btn svg {
  width: 20px;
  height: 20px;
}

/* ── Marca ───────────────────────────────────────────────────────────────────── */
.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  cursor: pointer;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  margin: 0 calc(-1 * var(--space-2));
  transition: background 0.15s;
}
.header-brand:hover { background: rgba(255,255,255,0.08); }

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: contain;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.brand-system {
  color: white;
  font-size: 1.08rem;
  font-weight: 750;
  letter-spacing: 0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-context {
  color: rgba(255,255,255,0.62);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.brand-conv {
  color: rgba(255,255,255,0.6);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.brand-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.brand-dot--active { background: #4ade80; box-shadow: 0 0 5px #4ade80; }
.brand-dot--closed { background: var(--slate-500); }

/* ── Acciones ─────────────────────────────────────────────────────────────────── */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.icon-btn svg { width: 15px; height: 15px; }
.icon-btn:hover {
  background: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.9);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
}
.user-chip > svg { width: 13px; height: 13px; opacity: 0.5; flex-shrink: 0; }

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  width: 26px; height: 26px;
  border: none;
  background: rgba(255,255,255,0.1);
  border-radius: var(--radius-full);
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.logout-btn svg { width: 13px; height: 13px; }
.logout-btn:hover { background: rgba(239,68,68,0.45); color: white; }

@media (max-width: 768px) {
  .app-header {
    height: 60px;
    padding: 0 var(--space-4);
    gap: var(--space-3);
  }

  .mobile-menu-btn { display: inline-flex; }
  .brand-university { font-size: 0.82rem; }
  .brand-division   { display: none; }
  .brand-conv       { max-width: 120px; }
  .user-name        { display: none; }

  .brand-logo {
    width: 38px;
    height: 38px;
  }

  .brand-system { font-size: 0.95rem; }
  .brand-context { font-size: 0.7rem; }
}
</style>
