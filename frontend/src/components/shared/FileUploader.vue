<script setup>
defineProps({
  id: {
    type: String,
    required: true
  },
  accept: {
    type: String,
    default: '.dat,.txt'
  },
  multiple: {
    type: Boolean,
    default: false
  },
  isDragging: {
    type: Boolean,
    default: false
  },
  hasData: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Arrastra tus archivos aquí'
  },
  subtitle: {
    type: String,
    default: 'o haz clic para seleccionar desde tu equipo'
  },
  buttonText: {
    type: String,
    default: 'Seleccionar archivos'
  },
  badges: {
    type: Array,
    default: () => ['.dat']
  },
  hint: {
    type: String,
    default: ''
  },
  // Preview opcionales — si se pasan muestran mini-tabla al cargar datos
  fileName:       { type: String,  default: '' },
  rowCount:       { type: Number,  default: 0 },
  previewColumns: { type: Array,   default: () => [] },  // [{ key, label }]
  previewRows:    { type: Array,   default: () => [] },  // primeras N filas
})

const emit = defineEmits(['drop', 'dragover', 'dragleave', 'change'])

function onDrop(event) {
  emit('drop', event)
}

function onDragOver(event) {
  emit('dragover', event)
}

function onDragLeave(event) {
  emit('dragleave', event)
}

function onChange(event) {
  emit('change', event)
}
</script>

<template>
  <section
    class="uploader"
    :class="{ 'uploader--dragging': isDragging, 'uploader--has-data': hasData }"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
  >
    <input
      :id="id"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="uploader__input"
      @change="onChange"
    />

    <!-- Estado normal: zona de arrastre -->
    <label v-if="!hasData" :for="id" class="uploader__label">
      <div class="uploader__icon">
        <slot name="icon">
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M24 16v16M16 24h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </slot>
      </div>
      <div class="uploader__text">
        <strong>{{ title }}</strong>
        <span>{{ subtitle }}</span>
      </div>
      <div class="uploader__action">
        <span class="uploader__button">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
          {{ buttonText }}
        </span>
      </div>
      <div class="uploader__meta">
        <span v-for="badge in badges" :key="badge" class="uploader__badge">{{ badge }}</span>
        <span v-if="hint" class="uploader__hint">{{ hint }}</span>
      </div>
    </label>

    <!-- Estado cargado: éxito + preview -->
    <div v-else class="uploader__loaded">
      <div class="uploader__loaded-header">
        <div class="uploader__loaded-icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="uploader__loaded-info">
          <span class="uploader__loaded-name">{{ fileName || 'Archivo cargado' }}</span>
          <span class="uploader__loaded-count" v-if="rowCount">
            {{ rowCount.toLocaleString('es-PE') }} registros importados
          </span>
        </div>
        <label :for="id" class="uploader__reload-btn">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Reemplazar
        </label>
      </div>

      <!-- Mini-tabla preview (opcional) -->
      <div v-if="previewRows.length && previewColumns.length" class="uploader__preview">
        <div class="uploader__preview-label">Vista previa (primeras {{ previewRows.length }} filas)</div>
        <div class="uploader__preview-table-wrap">
          <table class="uploader__preview-table">
            <thead>
              <tr>
                <th v-for="col in previewColumns" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in previewRows" :key="i">
                <td v-for="col in previewColumns" :key="col.key">
                  {{ row[col.key] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.uploader {
  position: relative;
  border: 2px dashed var(--slate-300);
  border-radius: var(--radius-xl);
  background: white;
  transition: all var(--transition-base);
  overflow: hidden;
}

.uploader::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-base);
  pointer-events: none;
  z-index: 0;
}

.uploader:hover::before,
.uploader--dragging::before {
  opacity: 1;
}

.uploader--dragging {
  border-color: var(--unap-blue-500);
  border-style: solid;
  box-shadow: 0 0 0 4px rgba(0, 82, 163, 0.15);
}

.uploader--has-data {
  border-style: solid;
  border-color: var(--success-400);
  background: var(--success-50);
}

.uploader__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 3;
}

.uploader__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
  text-align: center;
  position: relative;
  z-index: 2;
}

.uploader__icon {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, var(--unap-blue-100) 0%, var(--unap-blue-50) 100%);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-base);
}

.uploader:hover .uploader__icon {
  transform: scale(1.05);
}

.uploader__icon :deep(svg) {
  width: 36px;
  height: 36px;
  color: var(--unap-blue-500);
}

.uploader__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.uploader__text strong {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
}

.uploader__text span {
  font-size: 0.9rem;
  color: var(--slate-500);
}

.uploader__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.uploader__badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-3);
  background: var(--unap-gold-100);
  color: var(--unap-gold-600);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  text-transform: uppercase;
}

.uploader__hint {
  font-size: 0.8rem;
  color: var(--slate-500);
}

.uploader__action {
  margin-top: var(--space-2);
}

.uploader__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all var(--transition-fast);
  pointer-events: none;
}

.uploader__button svg {
  width: 18px;
  height: 18px;
}

.uploader:hover .uploader__button {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* ── Estado cargado ──────────────────────────────────────────────────────── */
.uploader__loaded {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  animation: slideUp 0.3s ease-out;
}

.uploader__loaded-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.uploader__loaded-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  background: var(--success-100);
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  color: var(--success-600);
}
.uploader__loaded-icon svg { width: 20px; height: 20px; }

.uploader__loaded-info {
  flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
}

.uploader__loaded-name {
  font-size: 0.88rem; font-weight: 700; color: var(--slate-800);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.uploader__loaded-count {
  font-size: 0.75rem; color: var(--success-600); font-weight: 600;
}

.uploader__reload-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  background: white; color: var(--slate-500); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast); white-space: nowrap;
  flex-shrink: 0;
}
.uploader__reload-btn svg { width: 14px; height: 14px; }
.uploader__reload-btn:hover { background: var(--slate-50); color: var(--unap-blue-600); border-color: var(--unap-blue-300); }

/* Mini-tabla preview */
.uploader__preview-label {
  font-size: 0.72rem; font-weight: 700; color: var(--slate-400);
  text-transform: uppercase; letter-spacing: 0.05em;
}

.uploader__preview-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
}

.uploader__preview-table {
  width: 100%; border-collapse: collapse; font-size: 0.78rem;
}

.uploader__preview-table thead th {
  padding: var(--space-2) var(--space-3);
  background: var(--unap-blue-700); color: white;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; white-space: nowrap; text-align: left;
}

.uploader__preview-table tbody tr { border-bottom: 1px solid var(--slate-100); }
.uploader__preview-table tbody tr:last-child { border-bottom: none; }
.uploader__preview-table tbody tr:nth-child(even) { background: var(--slate-50); }

.uploader__preview-table td {
  padding: var(--space-2) var(--space-3);
  color: var(--slate-700); white-space: nowrap;
  max-width: 140px; overflow: hidden; text-overflow: ellipsis;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
