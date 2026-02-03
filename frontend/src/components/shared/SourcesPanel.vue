<script setup>
import { formatTimestamp } from '@/utils/helpers'

defineProps({
  title: {
    type: String,
    default: 'Archivos importados'
  },
  description: {
    type: String,
    default: 'Resumen de cargas realizadas en esta sesión.'
  },
  sources: {
    type: Array,
    required: true
  },
  totalRows: {
    type: Number,
    default: 0
  },
  columns: {
    type: Array,
    default: () => [
      { key: 'name', label: 'Archivo' },
      { key: 'timestamp', label: 'Fecha y hora', format: 'timestamp' },
      { key: 'validRows', label: 'Registros válidos' },
      { key: 'errorCount', label: 'Errores', badge: true },
      { key: 'totalLines', label: 'Líneas leídas' },
    ]
  },
  uploadInputId: {
    type: String,
    default: ''
  },
  uploadHint: {
    type: String,
    default: 'Los nuevos archivos se añadirán a la lista.'
  }
})

const emit = defineEmits(['removeSource'])

function onRemove(sourceId) {
  emit('removeSource', sourceId)
}

function getCellValue(source, column) {
  const value = source[column.key]
  if (column.format === 'timestamp') {
    return formatTimestamp(value)
  }
  return value ?? '-'
}
</script>

<template>
  <section class="sources-panel">
    <header class="sources-header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <div class="sources-counts">
        <span>Total archivos: {{ sources.length }}</span>
        <span>Total registros: {{ totalRows }}</span>
      </div>
    </header>

    <div v-if="sources.length" class="sources-table-wrapper">
      <table class="sources-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="source in sources" :key="source.id">
            <td v-for="col in columns" :key="col.key">
              <span
                v-if="col.badge"
                class="badge"
                :class="{
                  'badge--ok': (source[col.key] || 0) === 0,
                  'badge--warn': (source[col.key] || 0) > 0,
                }"
              >
                {{ source[col.key] || 0 }}
              </span>
              <template v-else>
                {{ getCellValue(source, col) }}
              </template>
            </td>
            <td>
              <button
                type="button"
                class="icon-button icon-button--danger"
                @click="onRemove(source.id)"
                aria-label="Eliminar archivo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="empty">
      <p>Aún no se ha registrado ningún archivo. Carga uno o varios archivos para ver el resumen.</p>
    </div>

    <div v-if="uploadInputId" class="sources-actions">
      <label class="btn" :for="uploadInputId">Cargar más archivos</label>
      <span class="sources-hint">{{ uploadHint }}</span>
    </div>
  </section>
</template>

<style scoped>
.sources-panel {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.sources-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.sources-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
  margin: 0;
}

.sources-header p {
  font-size: 0.85rem;
  color: var(--slate-500);
  margin: var(--space-1) 0 0;
}

.sources-counts {
  display: flex;
  gap: var(--space-4);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--slate-700);
}

.sources-table-wrapper {
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  overflow-x: auto;
  background: white;
}

.sources-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.sources-table th {
  background: var(--slate-50);
  font-size: 0.8rem;
  color: var(--slate-600);
}

.sources-table th,
.sources-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--slate-100);
}

.sources-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-4);
}

.sources-hint {
  color: var(--slate-500);
  font-size: 0.85rem;
}

.empty {
  text-align: center;
  color: var(--slate-500);
  padding: var(--space-8);
  border: 2px dashed var(--slate-200);
  border-radius: var(--radius-xl);
  background: white;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.badge--ok {
  background: var(--success-100);
  color: var(--success-600);
}

.badge--warn {
  background: var(--warning-100);
  color: var(--warning-600);
}

.icon-button {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  border: 1px solid var(--slate-200);
  background: white;
  color: var(--slate-600);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.icon-button--danger {
  border-color: var(--error-100);
  color: var(--error-500);
}

.icon-button--danger:hover {
  background: var(--error-50);
  border-color: var(--error-200);
  color: var(--error-600);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--slate-100);
  color: var(--slate-700);
}

.btn:hover {
  background: var(--slate-200);
}
</style>
