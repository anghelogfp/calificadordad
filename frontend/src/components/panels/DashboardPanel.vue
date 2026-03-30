<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  dashboard: { type: Object, required: true },
})

const emit = defineEmits(['close'])

// Máximo count en el histograma (para escalar las barras)
const maxBucketCount = computed(() => {
  const dist = props.dashboard.scoreDistribution.value
  if (!dist?.length) return 1
  return Math.max(...dist.map(b => b.count), 1)
})

// Areas en orden para la tabla comparativa
const areaStatsList = computed(() => {
  const map = props.dashboard.statsByArea.value
  if (!map?.size) return []
  return Array.from(map.values())
})

const hasMultipleAreas = computed(() => areaStatsList.value.length > 1)
const hasResults = computed(() => (props.dashboard.globalSummary.value?.total ?? 0) > 0)
const hasIngresantes = computed(() =>
  (props.dashboard.globalSummary.value?.ingresantes ?? 0) > 0
)
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="panel-overlay" @click.self="emit('close')">
      <div class="panel">

        <header class="panel__header">
          <div>
            <h2>Estadísticas</h2>
            <p>Distribución y métricas de los puntajes calculados</p>
          </div>
          <button type="button" class="panel__close" @click="emit('close')" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div v-if="!hasResults" class="panel__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
          </svg>
          <p>Calcula puntajes primero para ver estadísticas.</p>
        </div>

        <div v-else class="panel__body">

          <!-- ── Resumen global ─────────────────────────────────── -->
          <section class="section">
            <h3 class="section__title">Resumen global</h3>
            <div class="summary-grid">
              <div class="summary-card">
                <span class="summary-card__val">{{ dashboard.globalSummary.value.total }}</span>
                <span class="summary-card__lbl">Total calificados</span>
              </div>
              <div class="summary-card summary-card--green" v-if="hasIngresantes">
                <span class="summary-card__val">{{ dashboard.globalSummary.value.ingresantes }}</span>
                <span class="summary-card__lbl">Ingresantes</span>
              </div>
              <div class="summary-card summary-card--red" v-if="hasIngresantes">
                <span class="summary-card__val">{{ dashboard.globalSummary.value.noIngresantes }}</span>
                <span class="summary-card__lbl">No ingresantes</span>
              </div>
              <div class="summary-card">
                <span class="summary-card__val mono">{{ dashboard.globalSummary.value.avg.toFixed(2) }}</span>
                <span class="summary-card__lbl">Promedio</span>
              </div>
              <div class="summary-card">
                <span class="summary-card__val mono">{{ dashboard.globalSummary.value.max.toFixed(2) }}</span>
                <span class="summary-card__lbl">Máximo</span>
              </div>
              <div class="summary-card">
                <span class="summary-card__val mono">{{ dashboard.globalSummary.value.min.toFixed(2) }}</span>
                <span class="summary-card__lbl">Mínimo</span>
              </div>
            </div>
          </section>

          <div class="divider" />

          <!-- ── Por área ──────────────────────────────────────── -->
          <section class="section" v-if="areaStatsList.length">
            <h3 class="section__title">Por área</h3>
            <table class="area-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Total</th>
                  <th v-if="hasIngresantes">Ing.</th>
                  <th>Promedio</th>
                  <th>Máx.</th>
                  <th>Mín.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in areaStatsList" :key="s.area">
                  <td class="area-name">{{ s.area }}</td>
                  <td class="num">{{ s.count }}</td>
                  <td v-if="hasIngresantes" class="num ingresantes">{{ s.ingresantes }}</td>
                  <td class="num mono">{{ s.avg.toFixed(2) }}</td>
                  <td class="num mono">{{ s.max.toFixed(2) }}</td>
                  <td class="num mono">{{ s.min.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div class="divider" />

          <!-- ── Distribución de puntajes ──────────────────────── -->
          <section class="section" v-if="dashboard.scoreDistribution.value.length">
            <h3 class="section__title">Distribución de puntajes</h3>
            <p class="section__sub">Cantidad de postulantes por rango</p>

            <div class="histogram">
              <div
                v-for="bucket in dashboard.scoreDistribution.value"
                :key="bucket.range"
                class="histogram__col"
                :title="`${bucket.range} pts: ${bucket.count} postulante(s)`"
              >
                <span class="histogram__count">{{ bucket.count }}</span>
                <div class="histogram__bar-wrap">
                  <div
                    class="histogram__bar"
                    :style="{ height: `${(bucket.count / maxBucketCount) * 100}%` }"
                  />
                </div>
                <span class="histogram__label">{{ bucket.range }}</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.panel-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 29, 61, 0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: flex-end;
  z-index: 150;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.panel {
  width: min(480px, 100%);
  height: 100vh;
  background: white;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideIn 0.3s ease-out;
  overflow: hidden;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* Header */
.panel__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white; flex-shrink: 0;
}

.panel__header h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.panel__header p { font-size: 0.8rem; color: var(--unap-blue-200); margin: 2px 0 0; }

.panel__close {
  width: 32px; height: 32px; border: none;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background var(--transition-fast); flex-shrink: 0;
}
.panel__close svg { width: 18px; height: 18px; }
.panel__close:hover { background: rgba(255,255,255,0.2); }

/* Empty state */
.panel__empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: var(--space-4); color: var(--slate-400);
  padding: var(--space-8);
}
.panel__empty svg { width: 48px; height: 48px; }
.panel__empty p { font-size: 0.9rem; text-align: center; margin: 0; }

/* Body */
.panel__body {
  flex: 1; overflow-y: auto;
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-5);
}

.divider { height: 1px; background: var(--slate-100); flex-shrink: 0; }

/* Section */
.section { display: flex; flex-direction: column; gap: var(--space-3); }
.section__title {
  font-size: 0.8rem; font-weight: 700; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0;
}
.section__sub { font-size: 0.8rem; color: var(--slate-400); margin: -8px 0 0; }

/* Summary grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.summary-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 2px; padding: var(--space-3) var(--space-2);
  background: var(--slate-50); border: 1px solid var(--slate-100);
  border-radius: var(--radius-lg); text-align: center;
}
.summary-card--green { background: #f0fdf4; border-color: #bbf7d0; }
.summary-card--green .summary-card__val { color: #15803d; }
.summary-card--red { background: #fef2f2; border-color: #fecaca; }
.summary-card--red .summary-card__val { color: #b91c1c; }

.summary-card__val {
  font-size: 1.6rem; font-weight: 800;
  color: var(--unap-blue-800); line-height: 1;
}
.summary-card__val.mono { font-family: var(--font-mono); font-size: 1.2rem; }
.summary-card__lbl {
  font-size: 0.65rem; font-weight: 600; color: var(--slate-500);
  text-transform: uppercase; letter-spacing: 0.05em;
}

/* Area table */
.area-table {
  width: 100%; border-collapse: collapse;
  font-size: 0.85rem;
}
.area-table thead th {
  padding: var(--space-2) var(--space-3);
  text-align: left; font-size: 0.72rem; font-weight: 700;
  color: var(--slate-500); text-transform: uppercase;
  letter-spacing: 0.05em; border-bottom: 2px solid var(--slate-100);
}
.area-table tbody td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--slate-50);
  color: var(--slate-700);
}
.area-table tbody tr:last-child td { border-bottom: none; }
.area-table tbody tr:hover td { background: var(--slate-50); }

.area-name { font-weight: 600; color: var(--unap-blue-800); }
.num { text-align: right; }
.mono { font-family: var(--font-mono); }
.ingresantes { color: #15803d; font-weight: 700; }

/* Histogram */
.histogram {
  display: flex;
  align-items: flex-end;
  gap: var(--space-1);
  height: 160px;
  padding-bottom: calc(var(--space-5) + 4px);
  position: relative;
}

.histogram__col {
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; height: 100%; position: relative;
  cursor: default;
}

.histogram__count {
  font-size: 0.65rem; font-weight: 700;
  color: var(--unap-blue-600); line-height: 1;
  min-height: 12px;
}

.histogram__bar-wrap {
  flex: 1; width: 100%;
  display: flex; align-items: flex-end;
  min-height: 0;
}

.histogram__bar {
  width: 100%;
  background: linear-gradient(180deg, var(--unap-blue-400) 0%, var(--unap-blue-700) 100%);
  border-radius: 3px 3px 0 0;
  min-height: 3px;
  transition: height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.histogram__col:hover .histogram__bar {
  background: linear-gradient(180deg, var(--unap-gold-400) 0%, var(--unap-gold-600) 100%);
}

.histogram__label {
  position: absolute; bottom: 0;
  font-size: 0.6rem; color: var(--slate-400); font-weight: 500;
  white-space: nowrap; transform: rotate(-35deg) translateX(-4px);
  transform-origin: top right;
  line-height: 1;
}
</style>
