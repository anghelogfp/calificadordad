<script setup>
import StepInfoCard from '@/components/shared/StepInfoCard.vue'

const props = defineProps({
  backup: { type: Object, required: true },
})

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (file) props.backup.importSessionBackup(file)
  e.target.value = ''
}
</script>

<template>
  <section class="backup-view">
    <StepInfoCard
      title="Backup de sesión"
      description="Exporta o restaura los datos del servidor: padrón, respuestas, claves, ponderaciones, procesos y configuración."
      variant="blue"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </template>
    </StepInfoCard>

    <div class="backup-grid">

      <!-- Exportar -->
      <div class="backup-card">
        <div class="card-icon card-icon--blue">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </div>
        <div class="card-body">
          <h3 class="card-title">Exportar sesión</h3>
          <p class="card-desc">Descarga un JSON con todos los datos guardados en servidor: padrón, identificadores, respuestas, claves, ponderaciones, procesos y configuración.</p>
          <div v-if="backup.exportError" class="alert alert--error">
            {{ backup.exportError }}
          </div>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="backup.exportLoading"
            @click="backup.exportSessionBackup"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="btn__icon">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            {{ backup.exportLoading ? 'Exportando…' : 'Exportar backup (.json)' }}
          </button>
        </div>
      </div>

      <!-- Importar -->
      <div class="backup-card">
        <div class="card-icon card-icon--gold">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" transform="rotate(180 12 12)"/>
          </svg>
        </div>
        <div class="card-body">
          <h3 class="card-title">Importar sesión</h3>
          <p class="card-desc">Restaura una sesión anterior desde un archivo de backup. <strong>Esto reemplazará todos los datos actuales.</strong></p>
          <div v-if="backup.importSuccess" class="alert alert--success">
            ✓ Backup importado correctamente. Recargando página…
          </div>
          <div v-if="backup.importError" class="alert alert--error">
            {{ backup.importError }}
          </div>
          <label class="file-btn" :class="{ 'file-btn--disabled': backup.importLoading }">
            <input type="file" accept=".json" :disabled="backup.importLoading" @change="handleFileChange" />
            <svg viewBox="0 0 20 20" fill="currentColor" class="btn__icon">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" transform="rotate(180 10 10)"/>
            </svg>
            {{ backup.importLoading ? 'Importando…' : 'Seleccionar backup (.json)' }}
          </label>
        </div>
      </div>

      <!-- Limpiar -->
      <div class="backup-card backup-card--danger">
        <div class="card-icon card-icon--red">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/>
          </svg>
        </div>
        <div class="card-body">
          <h3 class="card-title">Limpiar datos del navegador</h3>
          <p class="card-desc">Elimina el caché y las preferencias locales de este navegador. Los datos guardados en el servidor se mantienen intactos.</p>
          <button type="button" class="btn btn--danger" @click="backup.clearAllData">
            <svg viewBox="0 0 20 20" fill="currentColor" class="btn__icon">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            Limpiar navegador y recargar
          </button>
        </div>
      </div>

    </div>
  </section>
</template>

<style scoped>
.backup-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.backup-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 680px;
}

.backup-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  padding: var(--space-5) var(--space-6);
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.backup-card--danger {
  border-color: var(--error-100);
  background: var(--error-50);
}

.card-icon {
  width: 48px; height: 48px; flex-shrink: 0;
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
}
.card-icon svg { width: 24px; height: 24px; }
.card-icon--blue { background: var(--unap-blue-100); color: var(--unap-blue-700); }
.card-icon--gold { background: #fef9c3; color: #854d0e; }
.card-icon--red  { background: var(--error-100); color: var(--error-600); }

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
}

.card-desc {
  font-size: 0.875rem;
  color: var(--slate-600);
  margin: 0;
  line-height: 1.6;
}

.alert {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}
.alert--success { background: #d4edda; color: #155724; border: 1px solid #b8dacc; }
.alert--error   { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }

.btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); align-self: flex-start;
}
.btn__icon { width: 15px; height: 15px; flex-shrink: 0; }
.btn:disabled { opacity: 0.65; cursor: not-allowed; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
}
.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
}

.btn--danger { background: var(--error-600); color: white; }
.btn--danger:hover { background: var(--error-700); }

.file-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--slate-100); color: var(--slate-700);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  align-self: flex-start; transition: all var(--transition-fast);
}
.file-btn input { display: none; }
.file-btn:hover { background: var(--slate-200); }
.file-btn--disabled { opacity: 0.65; cursor: not-allowed; }
</style>
