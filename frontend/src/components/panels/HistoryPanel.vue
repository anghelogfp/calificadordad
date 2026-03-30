<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  historyList: { type: Array, required: true },
})

const emit = defineEmits(['close', 'loadProcess', 'deleteProcess'])

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function totalCandidates(process) {
  return Object.values(process.areas || {}).reduce((sum, a) => sum + (a.results?.length || 0), 0)
}

function handleDelete(id) {
  if (confirm('¿Eliminar este proceso del historial?')) {
    emit('deleteProcess', id)
  }
}

function handleLoad(process) {
  emit('loadProcess', process)
  emit('close')
}

const sorted = computed(() =>
  [...props.historyList].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
)
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="show" class="panel-overlay" @click.self="emit('close')">
        <aside class="history-panel">
          <header class="panel-header">
            <div>
              <h2>Historial de procesos</h2>
              <p>Últimos {{ historyList.length }} procesos guardados</p>
            </div>
            <button type="button" class="close-btn" @click="emit('close')" aria-label="Cerrar">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </header>

          <div class="panel-body">
            <!-- Empty -->
            <div v-if="!sorted.length" class="empty">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>
                <path d="M24 16v8l6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <p>No hay procesos guardados aún.</p>
              <small>Cuando calcules puntajes y guardes un proceso, aparecerá aquí.</small>
            </div>

            <!-- List -->
            <div v-else class="process-list">
              <article v-for="process in sorted" :key="process.id" class="process-card">
                <div class="process-card__top">
                  <span class="process-card__name">{{ process.name || 'Sin nombre' }}</span>
                  <span class="process-card__date">{{ formatDate(process.savedAt) }}</span>
                </div>

                <div class="process-card__areas">
                  <span
                    v-for="(data, area) in process.areas"
                    :key="area"
                    class="area-chip"
                  >
                    {{ area }}
                    <span class="area-chip__count">{{ data.results?.length || 0 }}</span>
                  </span>
                </div>

                <div class="process-card__meta">
                  <span class="meta-stat">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z"/>
                    </svg>
                    {{ totalCandidates(process) }} calificados en total
                  </span>
                  <span class="meta-stat">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 4a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 5a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/>
                    </svg>
                    {{ Object.keys(process.areas || {}).length }} área(s)
                  </span>
                </div>

                <div class="process-card__actions">
                  <button
                    type="button"
                    class="btn btn--primary btn--sm"
                    @click="handleLoad(process)"
                    title="Cargar estos resultados en el paso 6"
                  >
                    <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                    Cargar
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger-ghost btn--sm"
                    @click="handleDelete(process.id)"
                    title="Eliminar del historial"
                  >
                    <svg class="btn__icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    Eliminar
                  </button>
                </div>
              </article>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.panel-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 29, 61, 0.4);
  backdrop-filter: blur(2px);
  display: flex; justify-content: flex-end;
}

.history-panel {
  width: min(420px, 100%);
  height: 100%;
  background: white;
  display: flex; flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 29, 61, 0.15);
  overflow: hidden;
}

/* Transition */
.panel-enter-active { transition: opacity 0.25s ease; }
.panel-leave-active { transition: opacity 0.2s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; }
.panel-enter-active .history-panel { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-leave-active .history-panel { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-enter-from .history-panel { transform: translateX(100%); }
.panel-leave-to .history-panel { transform: translateX(100%); }

.panel-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
  flex-shrink: 0;
}

.panel-header h2 { font-size: 1.15rem; font-weight: 700; margin: 0; }
.panel-header p { font-size: 0.8rem; color: var(--unap-blue-200); margin: var(--space-1) 0 0; }

.close-btn {
  width: 34px; height: 34px; border: none;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast); flex-shrink: 0;
}
.close-btn svg { width: 18px; height: 18px; }
.close-btn:hover { background: rgba(255,255,255,0.2); }

.panel-body {
  flex: 1; overflow-y: auto; padding: var(--space-5);
}

/* Empty */
.empty {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: var(--space-12) var(--space-4); gap: var(--space-3);
  color: var(--slate-500);
}
.empty svg { width: 48px; height: 48px; opacity: 0.4; }
.empty p { font-size: 0.95rem; font-weight: 600; color: var(--slate-600); margin: 0; }
.empty small { font-size: 0.82rem; color: var(--slate-400); }

/* Process list */
.process-list { display: flex; flex-direction: column; gap: var(--space-4); }

.process-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
  transition: box-shadow var(--transition-fast);
}
.process-card:hover { box-shadow: var(--shadow-md); }

.process-card__top {
  display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2);
}
.process-card__name {
  font-weight: 700; font-size: 0.95rem; color: var(--unap-blue-800);
  line-height: 1.3;
}
.process-card__date {
  font-size: 0.72rem; color: var(--slate-400);
  white-space: nowrap; flex-shrink: 0; margin-top: 2px;
}

.process-card__areas {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
}
.area-chip {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--unap-blue-50);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-full);
  font-size: 0.78rem; font-weight: 600; color: var(--unap-blue-700);
}
.area-chip__count {
  background: var(--unap-blue-700); color: white;
  border-radius: var(--radius-full);
  padding: 0 var(--space-2);
  font-size: 0.7rem; font-weight: 700;
  min-width: 20px; text-align: center;
}

.process-card__meta {
  display: flex; gap: var(--space-4); flex-wrap: wrap;
}
.meta-stat {
  display: flex; align-items: center; gap: var(--space-1);
  font-size: 0.78rem; color: var(--slate-500);
}
.meta-stat svg { width: 13px; height: 13px; flex-shrink: 0; }

.process-card__actions {
  display: flex; gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--slate-100);
}

.btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  border: none; border-radius: var(--radius-md);
  font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
}
.btn__icon { width: 14px; height: 14px; }
.btn--sm { padding: var(--space-2) var(--space-3); font-size: 0.8rem; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white; box-shadow: var(--shadow-sm);
}
.btn--primary:hover { background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%); }

.btn--danger-ghost {
  background: transparent; color: var(--error-500);
  border: 1px solid var(--error-100);
}
.btn--danger-ghost:hover { background: var(--error-50); border-color: var(--error-200); }
</style>
