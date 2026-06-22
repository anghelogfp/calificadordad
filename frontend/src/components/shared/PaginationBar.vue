<script setup>
defineProps({
  page: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  pageSizeOptions: { type: Array, default: () => [10, 25, 50, 100] },
})

const emit = defineEmits(['update:page', 'update:pageSize'])
</script>

<template>
  <div v-if="totalItems > pageSize" class="pagination-bar">
    <span class="pagination-bar__info">
      {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, totalItems) }} de {{ totalItems }}
    </span>
    <label class="pagination-bar__size">
      Filas
      <select :value="pageSize" @change="emit('update:pageSize', Number($event.target.value))">
        <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
    <div class="pagination-bar__controls">
      <button type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">‹</button>
      <span>Página {{ page }} de {{ Math.ceil(totalItems / pageSize) }}</span>
      <button type="button" :disabled="page >= Math.ceil(totalItems / pageSize)" @click="emit('update:page', page + 1)">›</button>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;
  gap: var(--space-3); padding: var(--space-3) var(--space-4);
  border: 1px solid var(--slate-200); border-radius: var(--radius-lg);
  background: white; color: var(--slate-500); font-size: 0.8rem;
}
.pagination-bar__info { margin-right: auto; }
.pagination-bar__size { display: flex; align-items: center; gap: var(--space-2); }
.pagination-bar__size select {
  padding: 4px 8px; border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); background: white; color: var(--slate-700);
}
.pagination-bar__controls { display: flex; align-items: center; gap: var(--space-2); }
.pagination-bar__controls button {
  width: 30px; height: 30px; border: 1px solid var(--slate-200);
  border-radius: var(--radius-md); background: white; color: var(--unap-blue-700);
  cursor: pointer; font-size: 1.1rem;
}
.pagination-bar__controls button:disabled { opacity: 0.35; cursor: default; }
@media (max-width: 560px) {
  .pagination-bar { justify-content: space-between; }
  .pagination-bar__info { width: 100%; margin: 0; }
}
</style>
