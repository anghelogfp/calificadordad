<script setup>
const props = defineProps({
  searchValue: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Buscar...' },
  totalRows: { type: Number, default: 0 },
  filteredCount: { type: Number, default: null },
  showSearch: { type: Boolean, default: true },
  selectedCount: { type: Number, default: 0 },
})

const emit = defineEmits(['update:searchValue'])

function updateSearch(event) { emit('update:searchValue', event.target.value) }
function clearSearch() { emit('update:searchValue', '') }
</script>

<template>
  <section class="toolbar">
    <div class="toolbar__actions">
      <slot name="actions"></slot>
    </div>
    <div class="toolbar__search" v-if="showSearch">
      <div class="search-input">
        <svg class="search-input__icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <input
          :value="searchValue"
          type="text"
          class="search-input__field"
          :placeholder="searchPlaceholder"
          aria-label="Buscar"
          @input="updateSearch"
        />
        <button
          v-if="searchValue"
          type="button"
          class="search-input__clear"
          @click="clearSearch"
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
      <div class="toolbar__metrics">
        <span v-if="selectedCount > 0" class="metric metric--selected">
          <span class="metric__value">{{ selectedCount }}</span>
          <span class="metric__label">seleccionados</span>
        </span>
        <span class="metric">
          <span class="metric__value">{{ totalRows }}</span>
          <span class="metric__label">total</span>
        </span>
        <span v-if="searchValue && filteredCount !== null" class="metric metric--highlight">
          <span class="metric__value">{{ filteredCount }}</span>
          <span class="metric__label">encontrados</span>
        </span>
        <slot name="metrics"></slot>
      </div>
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: center;
  justify-content: space-between; background: white;
  border: 1px solid var(--slate-200); border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5); box-shadow: var(--shadow-sm);
}

.toolbar__actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

.toolbar__search {
  display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
}

.search-input {
  position: relative; display: flex; align-items: center;
}

.search-input__icon {
  position: absolute; left: var(--space-3);
  width: 18px; height: 18px; color: var(--slate-400); pointer-events: none;
}

.search-input__field {
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-10);
  border: 1px solid var(--slate-200); border-radius: var(--radius-md);
  font-size: 0.9rem; min-width: 260px;
  transition: all var(--transition-fast); background: var(--slate-50);
}

.search-input__field:focus {
  outline: none; border-color: var(--unap-blue-400); background: white;
  box-shadow: 0 0 0 3px rgba(0, 82, 163, 0.1);
}

.search-input__clear {
  position: absolute; right: var(--space-3);
  width: 20px; height: 20px; border: none; background: none;
  color: var(--slate-400); cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); transition: all var(--transition-fast);
}
.search-input__clear svg { width: 14px; height: 14px; }
.search-input__clear:hover { color: var(--slate-700); background: var(--slate-200); }

.toolbar__metrics {
  display: flex; gap: var(--space-3); font-size: 0.85rem; color: var(--slate-600);
}

.metric {
  display: flex; align-items: baseline; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--slate-100); border-radius: var(--radius-sm);
}
.metric__value { font-weight: 700; font-family: var(--font-mono); color: var(--slate-800); }
.metric__label { font-size: 0.75rem; color: var(--slate-500); }

.metric--highlight { background: var(--unap-gold-100); }
.metric--highlight .metric__value { color: var(--unap-gold-600); }

.metric--selected { background: var(--unap-blue-50); }
.metric--selected .metric__value { color: var(--unap-blue-700); }
.metric--selected .metric__label { color: var(--unap-blue-500); }

@media (max-width: 768px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar__actions { justify-content: center; }
  .toolbar__search { flex-direction: column; align-items: stretch; }
  .search-input__field { min-width: 100%; }
  .toolbar__metrics { justify-content: center; }
}
</style>
