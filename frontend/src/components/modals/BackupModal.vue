<script setup>
const props = defineProps({
  show: { type: Boolean, required: true },
  backup: { type: Object, required: true },
})

const emit = defineEmits(['close'])

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (file) props.backup.importSessionBackup(file)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <header class="modal__header">
          <div class="modal__title">
            <h2>Backup de Sesión</h2>
            <p>Exporta o importa todos los datos cargados</p>
          </div>
          <button type="button" class="modal__close" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div class="modal__body">
          <!-- Exportar -->
          <div class="section">
            <div class="section__icon section__icon--blue">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </div>
            <div class="section__content">
              <h3>Exportar sesión</h3>
              <p>Descarga un archivo JSON con todos los datos: padrón, identificadores, respuestas, claves y ponderaciones.</p>
              <button type="button" class="btn btn--primary" @click="backup.exportSessionBackup">
                Exportar backup (.json)
              </button>
            </div>
          </div>

          <div class="divider" />

          <!-- Importar -->
          <div class="section">
            <div class="section__icon section__icon--gold">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" transform="rotate(180 12 12)"/>
              </svg>
            </div>
            <div class="section__content">
              <h3>Importar sesión</h3>
              <p>Restaura una sesión anterior desde un archivo de backup. <strong>Esto reemplazará todos los datos actuales.</strong></p>

              <div v-if="backup.importSuccess" class="alert alert--success">
                ✓ Backup importado. Recargando página...
              </div>
              <div v-if="backup.importError" class="alert alert--error">
                {{ backup.importError }}
              </div>

              <label class="file-btn">
                <input type="file" accept=".json" @change="handleFileChange" />
                Seleccionar backup (.json)
              </label>
            </div>
          </div>

          <div class="divider" />

          <!-- Limpiar todo -->
          <div class="section section--danger">
            <div class="section__icon section__icon--red">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/>
              </svg>
            </div>
            <div class="section__content">
              <h3>Limpiar todos los datos</h3>
              <p>Elimina permanentemente todos los datos del navegador. No se puede deshacer.</p>
              <button type="button" class="btn btn--danger" @click="backup.clearAllData">
                Limpiar todo y recargar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 29, 61, 0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-8); z-index: 200;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: min(540px, 100%);
  box-shadow: var(--shadow-xl);
  animation: scaleIn 0.3s ease-out;
  overflow: hidden;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
}

.modal__title h2 { font-size: 1.2rem; font-weight: 700; margin: 0; }
.modal__title p { font-size: 0.85rem; color: var(--unap-blue-200); margin: var(--space-1) 0 0; }

.modal__close {
  width: 36px; height: 36px; border: none; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.modal__close svg { width: 20px; height: 20px; }
.modal__close:hover { background: rgba(255,255,255,0.2); }

.modal__body {
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
}

.section {
  display: flex; gap: var(--space-4); align-items: flex-start;
}

.section__icon {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;
}

.section__icon svg { width: 22px; height: 22px; }
.section__icon--blue { background: var(--unap-blue-100); color: var(--unap-blue-700); }
.section__icon--gold { background: #fef9c3; color: #854d0e; }
.section__icon--red { background: var(--error-50); color: var(--error-600); }

.section__content { display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
.section__content h3 { font-size: 0.95rem; font-weight: 700; color: var(--slate-800); margin: 0; }
.section__content p { font-size: 0.85rem; color: var(--slate-600); margin: 0; line-height: 1.5; }

.divider { height: 1px; background: var(--slate-100); }

.btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); align-self: flex-start;
}

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
}

.btn--danger {
  background: var(--error-600); color: white;
}
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

.alert {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md); font-size: 0.85rem;
}

.alert--success { background: #d4edda; color: #155724; border: 1px solid #b8dacc; }
.alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
</style>
