<script setup>
import { computed, onMounted } from 'vue'

const props = defineProps({
  history:      { type: Object, required: true },
  convocatoria: { type: Object, required: true },
  areas:        { type: Object, required: true },
  currentUser:  { type: String, default: '' },
})

const emit = defineEmits(['loadProcess', 'newProcess', 'openVerificador', 'openHistory'])

// ── Datos ──────────────────────────────────────────────────────────────────────
const recentProcesses = computed(() =>
  [...(props.history.historyList.value || [])]
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .slice(0, 5)
)

const convocatoriaActiva = computed(() => props.convocatoria.activeConvocatoria?.value ?? null)
const areasList          = computed(() => props.areas.areas?.value ?? [])

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})

// Stats rápidas del historial
const totalCandidatesAll = computed(() =>
  (props.history.historyList.value || []).reduce((s, p) => s + (p.totalCandidates || 0), 0)
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => {
  props.history.fetchHistory()
})
</script>

<template>
  <div class="dash">

    <!-- ── Bienvenida ─────────────────────────────────────────────────────────── -->
    <div class="dash__welcome">
      <div class="dash__welcome-text">
        <p class="dash__greeting">{{ greeting }}<span v-if="currentUser">, {{ currentUser }}</span></p>
        <h1 class="dash__title">Dirección de Admisión — UNAP</h1>
      </div>
      <div class="dash__meta" v-if="convocatoriaActiva">
        <span class="dash__conv-badge" :class="convocatoriaActiva.status === 'active' ? 'badge--active' : 'badge--closed'">
          {{ convocatoriaActiva.status === 'active' ? 'Activa' : 'Cerrada' }}
        </span>
        <span class="dash__conv-name">{{ convocatoriaActiva.name }}</span>
      </div>
    </div>

    <!-- ── Acciones rápidas ───────────────────────────────────────────────────── -->
    <div class="dash__actions">
      <button type="button" class="quick-btn quick-btn--primary" @click="emit('newProcess')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Nuevo proceso
      </button>
      <button type="button" class="quick-btn" @click="emit('openVerificador')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Verificador
      </button>
      <button type="button" class="quick-btn" @click="emit('openHistory')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Historial completo
      </button>
    </div>

    <!-- ── Cuerpo principal ───────────────────────────────────────────────────── -->
    <div class="dash__body">

      <!-- Procesos recientes -->
      <div class="dash-card">
        <div class="dash-card__header">
          <h2 class="dash-card__title">Procesos recientes</h2>
          <div class="dash-card__stats">
            <span class="stat-chip">{{ history.historyList.value.length }} guardados</span>
            <span class="stat-chip">{{ totalCandidatesAll.toLocaleString('es-PE') }} candidatos</span>
          </div>
        </div>

        <div v-if="history.loading.value" class="dash-empty">
          <div class="spinner" />
          Cargando...
        </div>

        <div v-else-if="!recentProcesses.length" class="dash-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3" stroke-linecap="round"/>
          </svg>
          <p>No hay procesos guardados aún</p>
          <button type="button" class="quick-btn quick-btn--sm quick-btn--primary" @click="emit('newProcess')">
            Crear primer proceso
          </button>
        </div>

        <div v-else class="process-list">
          <div
            v-for="p in recentProcesses"
            :key="p.id"
            class="process-item"
          >
            <div class="process-item__info">
              <div class="process-item__name">{{ p.name }}</div>
              <div class="process-item__meta">
                <span v-for="area in p.areaNames" :key="area" class="area-tag">{{ area }}</span>
                <span class="meta-sep" v-if="p.areaNames?.length">·</span>
                <span class="meta-text">{{ p.totalCandidates }} candidatos</span>
              </div>
              <div class="process-item__date">{{ formatDate(p.savedAt) }}</div>
            </div>
            <button
              type="button"
              class="quick-btn quick-btn--sm"
              @click="emit('loadProcess', p)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Cargar
            </button>
          </div>

          <button
            v-if="history.historyList.value.length > 5"
            type="button"
            class="ver-mas"
            @click="emit('openHistory')"
          >
            Ver todos los procesos ({{ history.historyList.value.length }})
          </button>
        </div>
      </div>

      <!-- Convocatoria activa -->
      <div class="dash-card">
        <div class="dash-card__header">
          <h2 class="dash-card__title">Convocatoria activa</h2>
        </div>

        <div v-if="!convocatoriaActiva" class="dash-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <p>Sin convocatoria configurada</p>
        </div>

        <div v-else class="conv-detail">
          <div class="conv-detail__name">{{ convocatoriaActiva.name }}</div>
          <div class="conv-detail__status">
            <span :class="convocatoriaActiva.status === 'active' ? 'badge--active' : 'badge--closed'" class="dash__conv-badge">
              {{ convocatoriaActiva.status === 'active' ? 'Activa' : 'Cerrada' }}
            </span>
          </div>

          <div v-if="areasList.length" class="areas-list">
            <div class="areas-list__label">Áreas configuradas</div>
            <div
              v-for="area in areasList"
              :key="area.id ?? area.name"
              class="area-row"
            >
              <span class="area-row__name">{{ area.name }}</span>
              <div class="area-row__right">
                <span class="area-row__q">{{ area.question_count }} pregs.</span>
                <span class="area-row__vac">{{ area.vacantes ?? '—' }} vacantes</span>
              </div>
            </div>
          </div>
          <div v-else class="dash-empty dash-empty--sm">
            Sin áreas configuradas
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ── Bienvenida ──────────────────────────────────────────────────────────────── */
.dash__welcome {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--slate-100);
}

.dash__greeting {
  font-size: 0.85rem;
  color: var(--slate-500);
  margin: 0 0 var(--space-1);
}

.dash__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--slate-900);
  margin: 0;
}

.dash__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.dash__conv-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--slate-700);
}

.dash__conv-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
}

.badge--active {
  background: #dcfce7;
  color: #15803d;
}

.badge--closed {
  background: var(--slate-100);
  color: var(--slate-500);
}

/* ── Acciones rápidas ────────────────────────────────────────────────────────── */
.dash__actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.quick-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-200);
  background: white;
  color: var(--slate-700);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.quick-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.quick-btn:hover { background: var(--slate-50); border-color: var(--slate-300); }

.quick-btn--primary {
  background: var(--unap-blue-600);
  color: white;
  border-color: var(--unap-blue-600);
}
.quick-btn--primary:hover { background: var(--unap-blue-700); border-color: var(--unap-blue-700); }

.quick-btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: 0.8rem;
}

/* ── Cuerpo ──────────────────────────────────────────────────────────────────── */
.dash__body {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-5);
  align-items: start;
}

/* ── Cards ───────────────────────────────────────────────────────────────────── */
.dash-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.dash-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--slate-100);
}

.dash-card__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dash-card__stats {
  display: flex;
  gap: var(--space-2);
}

.stat-chip {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--slate-500);
  background: var(--slate-100);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
}

/* ── Empty state ─────────────────────────────────────────────────────────────── */
.dash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-5);
  color: var(--slate-400);
  font-size: 0.85rem;
  text-align: center;
}

.dash-empty svg { width: 40px; height: 40px; }
.dash-empty p   { margin: 0; }
.dash-empty--sm { padding: var(--space-5); font-size: 0.8rem; }

/* ── Spinner ─────────────────────────────────────────────────────────────────── */
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--slate-200);
  border-top-color: var(--unap-blue-500);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Lista de procesos ───────────────────────────────────────────────────────── */
.process-list {
  display: flex;
  flex-direction: column;
}

.process-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--slate-50);
  transition: background 0.12s;
}

.process-item:last-of-type { border-bottom: none; }
.process-item:hover { background: var(--slate-50); }

.process-item__info { flex: 1; min-width: 0; }

.process-item__name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--slate-800);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.process-item__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: 3px;
}

.area-tag {
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

.meta-sep { color: var(--slate-300); font-size: 0.75rem; }

.meta-text {
  font-size: 0.75rem;
  color: var(--slate-500);
}

.process-item__date {
  font-size: 0.72rem;
  color: var(--slate-400);
}

.ver-mas {
  width: 100%;
  padding: var(--space-3);
  border: none;
  border-top: 1px solid var(--slate-100);
  background: var(--slate-50);
  color: var(--unap-blue-600);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}
.ver-mas:hover { background: var(--unap-blue-50); }

/* ── Convocatoria ────────────────────────────────────────────────────────────── */
.conv-detail {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.conv-detail__name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--slate-800);
}

.areas-list__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--slate-400);
  margin-bottom: var(--space-2);
}

.area-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--slate-100);
}
.area-row:last-child { border-bottom: none; }

.area-row__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--slate-700);
}

.area-row__right {
  display: flex;
  gap: var(--space-3);
}

.area-row__q {
  font-size: 0.75rem;
  color: var(--slate-400);
}

.area-row__vac {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--unap-blue-600);
  background: var(--unap-blue-50);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

@media (max-width: 960px) {
  .dash__body { grid-template-columns: 1fr; }
}
</style>
