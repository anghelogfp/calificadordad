<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  history:        { type: Object, required: true },
  areas:          { type: Object, required: true },
  currentUser:    { type: String, default: '' },
  lastProcessTab: { type: String, default: '' },
})

const STEP_LABELS = {
  archives: 'Padrón',
  identifiers: 'Identificadores',
  responses: 'Respuestas',
  answer_keys: 'Claves',
  results: 'Resultados',
}

const emit = defineEmits(['loadProcess', 'newProcess', 'openVerificador', 'openHistory', 'continueProcess'])

// ── Datos ──────────────────────────────────────────────────────────────────────
const recentProcesses = computed(() =>
  [...(props.history.historyList.value || [])]
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .slice(0, 5)
)

const areasList = computed(() => props.areas.areas?.value ?? [])

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})

const totalCandidatesAll = computed(() =>
  (props.history.historyList.value || []).reduce((s, p) => s + (p.totalCandidates || 0), 0)
)

const totalProcesses = computed(() => (props.history.historyList.value || []).length)

// ── Count-up animation ────────────────────────────────────────────────────────
const displayProcesses   = ref(0)
const displayCandidates  = ref(0)
const displayAreas       = ref(0)

function countUp(target, displayRef, duration = 900) {
  const start = performance.now()
  const from = displayRef.value
  function step(now) {
    const progress = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    displayRef.value = Math.round(from + (target - from) * ease)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

watch(totalProcesses,  (v) => countUp(v, displayProcesses), { immediate: true })
watch(totalCandidatesAll, (v) => countUp(v, displayCandidates), { immediate: true })
watch(() => areasList.value.length, (v) => countUp(v, displayAreas), { immediate: true })

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function processModeLabel(process) {
  if (process.type === 'real') return 'Convocatoria real'
  return process.simulacroScope === 'general' ? 'Simulacro general' : 'Simulacro por áreas'
}

function processModeClass(process) {
  return process.type === 'real' ? 'type-badge--real' : 'type-badge--sim'
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
      <div class="dash__meta" v-if="areasList.length">
        <span class="dash__conv-badge badge--active">{{ areasList.length }} área(s)</span>
      </div>
    </div>

    <!-- ── Métricas ─────────────────────────────────────────────────────────── -->
    <div class="dash__metrics">
      <div class="metric-card" style="--delay: 0ms">
        <div class="metric-card__icon metric-card__icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="metric-card__body">
          <span class="metric-card__value">{{ displayProcesses.toLocaleString('es-PE') }}</span>
          <span class="metric-card__label">Procesos guardados</span>
        </div>
      </div>
      <div class="metric-card" style="--delay: 80ms">
        <div class="metric-card__icon metric-card__icon--gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="metric-card__body">
          <span class="metric-card__value">{{ displayCandidates.toLocaleString('es-PE') }}</span>
          <span class="metric-card__label">Candidatos totales</span>
        </div>
      </div>
      <div class="metric-card" style="--delay: 160ms">
        <div class="metric-card__icon metric-card__icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="metric-card__body">
          <span class="metric-card__value">{{ displayAreas.toLocaleString('es-PE') }}</span>
          <span class="metric-card__label">Áreas configuradas</span>
        </div>
      </div>
    </div>

    <!-- ── Acciones rápidas ───────────────────────────────────────────────────── -->
    <div class="dash__actions">
      <!-- Continuar proceso — aparece cuando hay un paso guardado -->
      <button
        v-if="lastProcessTab"
        type="button"
        class="quick-btn quick-btn--continue"
        @click="emit('continueProcess')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Continuar: {{ STEP_LABELS[lastProcessTab] || lastProcessTab }}
      </button>

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
                <span class="type-badge" :class="processModeClass(p)">{{ processModeLabel(p) }}</span>
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

      <!-- Áreas configuradas -->
      <div class="dash-card">
        <div class="dash-card__header">
          <h2 class="dash-card__title">Áreas configuradas</h2>
        </div>

        <div v-if="!areasList.length" class="dash-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <p>Sin áreas configuradas</p>
        </div>

        <div v-else class="areas-list">
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

/* ── Métricas ────────────────────────────────────────────────────────────────── */
.dash__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.metric-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  animation: slideUp 0.4s ease-out both;
  animation-delay: var(--delay, 0ms);
}

.metric-card__icon {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
}
.metric-card__icon svg { width: 22px; height: 22px; }

.metric-card__icon--blue { background: var(--unap-blue-50); color: var(--unap-blue-600); }
.metric-card__icon--gold { background: var(--unap-gold-50); color: var(--unap-gold-600); }
.metric-card__icon--green { background: var(--success-50); color: var(--success-600); }

.metric-card__body { display: flex; flex-direction: column; gap: 2px; }

.metric-card__value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--slate-900);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.metric-card__label {
  font-size: 0.75rem;
  color: var(--slate-500);
  font-weight: 500;
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

.quick-btn--continue {
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, white 100%);
  border-color: var(--unap-blue-300);
  color: var(--unap-blue-700);
  order: -1;
}
.quick-btn--continue:hover {
  background: var(--unap-blue-50);
  border-color: var(--unap-blue-500);
}

/* ── Cuerpo ──────────────────────────────────────────────────────────────────── */
.dash__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
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

.type-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.type-badge--real { background: #fff7ed; color: #92400e; border: 1px solid #fed7aa; }
.type-badge--sim  { background: var(--unap-blue-50); color: var(--unap-blue-700); border: 1px solid var(--unap-blue-100); }

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

.areas-list {
  padding: var(--space-2) var(--space-5) var(--space-3);
  display: flex;
  flex-direction: column;
}

.area-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1);
  border-bottom: 1px solid var(--slate-100);
}
.area-row:last-child { border-bottom: none; }

.area-row__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--slate-700);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.area-row__right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.area-row__q {
  font-size: 0.72rem;
  color: var(--slate-400);
  white-space: nowrap;
}

.area-row__vac {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--unap-blue-600);
  background: var(--unap-blue-50);
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

@media (max-width: 960px) {
  .dash__body { grid-template-columns: 1fr; }
  .dash__metrics { grid-template-columns: 1fr; gap: var(--space-3); }
}

@media (min-width: 600px) and (max-width: 960px) {
  .dash__metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
