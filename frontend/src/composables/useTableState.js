import { ref, computed, watch } from 'vue'
import { useStorage, watchDebounced } from '@vueuse/core'

/**
 * Lee el valor inicial de localStorage sin suscribirse reactivamente.
 * Devuelve un ref normal y escribe de vuelta con debounce (400 ms).
 * Esto evita serializar 10k filas en cada keystroke.
 */
function makeStoredRef(storageKey, defaultValue) {
  if (!storageKey) return ref(defaultValue)

  let initial = defaultValue
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw !== null) initial = JSON.parse(raw)
  } catch {}

  const state = ref(initial)

  watchDebounced(
    state,
    (val) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(val))
      } catch (e) {
        console.warn('[useTableState] localStorage write failed:', e)
      }
    },
    { debounce: 400, deep: true },
  )

  return state
}

/**
 * Composable genérico para manejo de estado de tabla con CRUD
 * @param {Object} options - Opciones de configuración
 * @param {string} options.storageKey - Clave para persistencia en localStorage
 * @param {Function} options.createRow - Función para crear una fila nueva
 * @param {Function} options.filterFn - Función para filtrar filas (row, searchValue) => boolean
 * @param {Array} options.defaultValue - Valor por defecto para las filas
 * @param {number} options.pageSize - Filas por página (default 100)
 */
export function useTableState(options = {}) {
  const {
    storageKey,
    createRow = (data) => data,
    filterFn = () => true,
    defaultValue = [],
    pageSize: pageSizeOpt = 100,
  } = options

  // Estado principal — ref con escritura debounced a localStorage
  const rows = makeStoredRef(storageKey, defaultValue)

  // Inicializar filas existentes con createRow
  if (rows.value && rows.value.length > 0) {
    rows.value = rows.value.map((row) => createRow(row))
  }

  // Estados de UI — pequeños (solo IDs), se pueden quedar en useStorage
  const selection = (() => {
    const stored = storageKey ? useStorage(`${storageKey}_selection`, []) : ref([])
    return computed({
      get: () => new Set(stored.value),
      set: (newSet) => { stored.value = Array.from(newSet) },
    })
  })()

  const editing = (() => {
    const stored = storageKey ? useStorage(`${storageKey}_editing`, []) : ref([])
    return computed({
      get: () => new Set(stored.value),
      set: (newSet) => { stored.value = Array.from(newSet) },
    })
  })()

  const search = ref('')
  const isDragging = ref(false)
  const importError = ref('')
  const selectAllRef = ref(null)

  // ── Paginación ──────────────────────────────────────────────────────────────
  const pageSize = ref(pageSizeOpt)
  const currentPage = ref(1)

  // Volver a la página 1 cuando cambia el filtro o los datos
  watch(search, () => { currentPage.value = 1 })
  watch(() => rows.value.length, () => { currentPage.value = 1 })

  // ── Computed ────────────────────────────────────────────────────────────────
  const hasData = computed(() => rows.value.length > 0)
  const totalRows = computed(() => rows.value.length)
  const totalSelected = computed(() => selection.value.size)

  const filteredRows = computed(() => {
    if (!search.value) return rows.value
    return rows.value.filter((row) => filterFn(row, search.value))
  })

  const totalFiltered = computed(() => filteredRows.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / pageSize.value)))

  // Solo las filas de la página actual → las que renderiza el DOM
  const pagedRows = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredRows.value.slice(start, start + pageSize.value)
  })

  // Para "seleccionar todo" se opera sobre la página visible
  const visibleIds = computed(() => pagedRows.value.map((row) => row.id))

  const isAllVisibleSelected = computed(
    () =>
      visibleIds.value.length > 0 &&
      visibleIds.value.every((id) => selection.value.has(id)),
  )

  const isSomeVisibleSelected = computed(
    () =>
      !isAllVisibleSelected.value &&
      visibleIds.value.some((id) => selection.value.has(id)),
  )

  // Objeto de paginación listo para pasar como prop a DataTable
  const pagination = computed(() => ({
    current: currentPage.value,
    total: totalPages.value,
    pageSize: pageSize.value,
    totalFiltered: totalFiltered.value,
  }))

  // Watch para indeterminate checkbox
  watch([isAllVisibleSelected, isSomeVisibleSelected], ([all, some]) => {
    if (selectAllRef.value) {
      selectAllRef.value.indeterminate = some && !all
    }
  })

  // ── Navegación de páginas ───────────────────────────────────────────────────
  function goToPage(n) {
    currentPage.value = Math.max(1, Math.min(n, totalPages.value))
  }
  function nextPage() { goToPage(currentPage.value + 1) }
  function prevPage() { goToPage(currentPage.value - 1) }

  // Métodos de selección
  function toggleSelection(id) {
    const next = new Set(selection.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selection.value = next
  }

  function clearSelection() {
    selection.value = new Set()
  }

  function toggleSelectAll(checked) {
    const next = new Set(selection.value)
    const visibleSet = new Set(visibleIds.value)

    if (checked) {
      visibleIds.value.forEach((id) => next.add(id))
    } else {
      visibleSet.forEach((id) => next.delete(id))
    }

    selection.value = next
  }

  // Métodos de edición
  function toggleEdit(id) {
    const next = new Set(editing.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    editing.value = next
  }

  function clearEditing() {
    editing.value = new Set()
  }

  function isEditing(id) {
    return editing.value.has(id)
  }

  // Métodos CRUD
  function addRow(data) {
    const newRow = createRow(data)
    rows.value = [...rows.value, newRow]
    return newRow
  }

  function removeRow(id) {
    rows.value = rows.value.filter((row) => row.id !== id)
    const nextSelection = new Set(selection.value)
    nextSelection.delete(id)
    selection.value = nextSelection

    const nextEditing = new Set(editing.value)
    nextEditing.delete(id)
    editing.value = nextEditing
  }

  function removeSelected() {
    if (!selection.value.size) return

    const toRemove = new Set(selection.value)
    rows.value = rows.value.filter((row) => !toRemove.has(row.id))
    editing.value = new Set(
      Array.from(editing.value).filter((id) => !toRemove.has(id))
    )
    clearSelection()
  }

  function clearAll() {
    rows.value = []
    clearSelection()
    clearEditing()
  }

  function setRows(newRows) {
    rows.value = newRows.map((row) => createRow(row))
    clearSelection()
    clearEditing()
  }

  // Drag & Drop handlers
  function onDragOver(event) {
    event.preventDefault()
    isDragging.value = true
  }

  function onDragLeave(event) {
    event.preventDefault()
    isDragging.value = false
  }

  return {
    // Estado
    rows,
    selection,
    editing,
    search,
    isDragging,
    importError,
    selectAllRef,

    // Computed
    hasData,
    totalRows,
    totalSelected,
    filteredRows,
    pagedRows,
    visibleIds,
    isAllVisibleSelected,
    isSomeVisibleSelected,
    totalFiltered,

    // Paginación
    pageSize,
    currentPage,
    totalPages,
    pagination,
    goToPage,
    nextPage,
    prevPage,

    // Métodos de selección
    toggleSelection,
    clearSelection,
    toggleSelectAll,

    // Métodos de edición
    toggleEdit,
    clearEditing,
    isEditing,

    // Métodos CRUD
    addRow,
    removeRow,
    removeSelected,
    clearAll,
    setRows,

    // Drag & Drop
    onDragOver,
    onDragLeave,
  }
}
