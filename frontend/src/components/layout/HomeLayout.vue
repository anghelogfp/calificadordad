<script setup>
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

defineProps({
  mobileMenuOpen: { type: Boolean, default: false },
  historyCount: { type: Number, default: 0 },
  activeTab: { type: String, default: '' },
  isStaff: { type: Boolean, default: false },
  lastProcessTab: { type: String, default: '' },
})

const emit = defineEmits([
  'goHome', 'toggleMobileMenu', 'newProcess', 'continueProcess',
  'openDashboard', 'openPostulantes', 'openCalificacion',
  'openPonderations', 'openHistory', 'openConfig',
  'openBackup', 'openVerificador', 'openUsuarios', 'closeMobile',
])
</script>

<template>
  <div class="home-layout">
    <AppHeader
      :mobile-menu-open="mobileMenuOpen"
      @go-home="emit('goHome')"
      @toggle-mobile-menu="emit('toggleMobileMenu')"
    />

    <div class="home-body">
      <AppSidebar
        :history-count="historyCount"
        :active-tab="activeTab"
        :active-dashboard="activeTab === 'dashboard'"
        :active-postulantes="false"
        :active-calificacion="false"
        :active-ponderations="activeTab === 'ponderations'"
        :active-history="false"
        :active-config="false"
        :active-verificador="false"
        :active-backup="false"
        :active-usuarios="false"
        :is-staff="isStaff"
        :mobile-open="mobileMenuOpen"
        :last-process-tab="lastProcessTab"
        @new-process="emit('newProcess')"
        @continue-process="emit('continueProcess')"
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

      <main class="home-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.home-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.home-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.home-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-6) var(--space-8);
  min-width: 0;
}

.home-main > * {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1024px) {
  .home-main { padding: var(--space-4); }
}
</style>
