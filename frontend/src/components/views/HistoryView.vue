<script setup>
import { computed } from 'vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps({
  history: { type: Object, required: true },
})

const emit = defineEmits(['loadProcess'])

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function totalCandidates(process) {
  if (process.totalCandidates) return process.totalCandidates
  return Object.values(process.areas || {}).reduce((sum, a) => sum + (a.results?.length || 0), 0)
}

function handleLoad(process) {
  emit('loadProcess', process)
}

const pendingDelete = defineModel('pendingDelete', { default: null })

function askDelete(id) { pendingDelete.value = id }
function cancelDelete() { pendingDelete.value = null }
function confirmDelete(id) {
  props.history.deleteProcess(id)
  pendingDelete.value = null
}

const sorted = computed(() =>
  [...props.history.historyList.value].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
)
</script>

<template>
  <section class="history-view">
    <StepInfoCard
      title="Historial de procesos"
      description="Procesos de calificación guardados. Carga uno para ver sus resultados en el paso 5."
      variant="blue"
      :stats="[
        { value: sorted.length, label: 'procesos guardados' },
        { value: sorted.reduce((s, p) => s + totalCandidates(p), 0), label: 'candidatos en total' },
      ]"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </template>
    </StepInfoCard>

    <div v-if="history.loading.value" class="loading-state">
      <div class="spinner" />
      <span>Cargando historial…</span>
    </div>

    <EmptyState
      v-else-if="!sorted.length"
      title="Sin procesos guardados"
      description="Cuando calcules puntajes y guardes un proceso, aparecerá aquí."
      icon="clock"
    />

    <div v-else class="process-grid">
      <article
        v-for="process in sorted"
        :key="process.id || process.dbId"
        class="process-card"
      >
        <div class="process-card__header">
          <div class="process-card__title-row">
            <span class="process-card__name">{{ process.name || 'Sin nombre' }}</span>
            <span class="process-card__date">{{ formatDate(process.savedAt) }}</span>
          </div>
          <div v-if="process.createdByUsername" class="process-card__author">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
              <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z"/>
            </svg>
            {{ process.createdByUsername }}
          </div>
        </div>

        <div class="process-card__areas">
          <span
            v-for="area in (process.areaNames?.length ? process.areaNames : Object.keys(process.areas || {}))"
            :key="area"
            class="area-chip"
          >
            {{ area }}
          </span>
        </div>

        <div class="process-card__stats">
          <span class="stat">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14s-1 0-1-1 1-4 7-4 7 3 7 4-1 1-1 1H2z"/>
            </svg>
            {{ totalCandidates(process) }} calificados
          </span>
          <span class="stat">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path d="M3 4a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 5a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/>
            </svg>
            {{ (process.areaNames?.length || Object.keys(process.areas || {}).length) }} área(s)
          </span>
        </div>

        <div class="process-card__actions">
          <button type="button" class="btn btn--primary" @click="handleLoad(process)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Cargar resultados
          </button>

          <template v-if="pendingDelete === (process.id || process.dbId)">
            <span class="delete-confirm-text">¿Eliminar?</span>
            <button type="button" class="btn btn--danger" @click="confirmDelete(process.id || process.dbId)">Sí</button>
            <button type="button" class="btn btn--ghost" @click="cancelDelete">No</button>
          </template>
          <button
            v-else
            type="button"
            class="btn btn--ghost btn--icon"
            title="Eliminar proceso"
            @click="askDelete(process.id || process.dbId)"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--slate-500);
  font-size: 0.9rem;
}

.spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--slate-200);
  border-top-color: var(--unap-blue-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Grid */
.process-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

/* Card */
.process-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
}
.process-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--unap-blue-200);
}

.process-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.process-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.process-card__name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--unap-blue-800);
  line-height: 1.3;
}

.process-card__date {
  font-size: 0.72rem;
  color: var(--slate-400);
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}

.process-card__author {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--slate-400);
}

/* Areas */
.process-card__areas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.area-chip {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  background: var(--unap-blue-50);
  border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--unap-blue-700);
}

/* Stats */
.process-card__stats {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.78rem;
  color: var(--slate-500);
}

/* Actions */
.process-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--slate-100);
}

.delete-confirm-text {
  font-size: 0.8rem;
  color: var(--error-600);
  font-weight: 600;
  margin-left: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
}
.btn--primary:hover { background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%); }

.btn--danger {
  background: var(--error-600);
  color: white;
}
.btn--danger:hover { background: var(--error-700); }

.btn--ghost {
  background: transparent;
  color: var(--slate-500);
  border: 1px solid var(--slate-200);
}
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

.btn--icon {
  margin-left: auto;
  color: var(--error-400);
  border-color: transparent;
}
.btn--icon:hover { background: var(--error-50); border-color: var(--error-200); color: var(--error-600); }
</style>
