<script setup>
</script>

<template>
  <header class="app-header">
    <div class="header-brand">
      <div class="brand-logo">
        <img
          src="/public/unap.png"
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
      <div class="header-badge">
        Dirección de Admisión 2026
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
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--unap-gold-500), var(--unap-gold-400), var(--unap-gold-500));
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.brand-logo svg {
  width: 52px;
  height: 52px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
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
  gap: var(--space-4);
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
  .brand-text h1 {
    font-size: 1.2rem;
  }
}
</style>
