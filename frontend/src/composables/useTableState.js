import { ref, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'

/**
 * Composable genérico para manejo de estado de tabla con CRUD
 * @param {Object} options - Opciones de configuración
 * @param {string} options.storageKey - Clave para persistencia en localStorage
 * @param {Function} options.createRow - Función para crear una fila nueva
 * @param {Function} options.filterFn - Función para filtrar filas (row, searchValue) => boolean
 * @param {Array} options.defaultValue - Valor por defecto para las filas
 */
export function useTableState(options = {}) {
  const {
    storageKey,
    createRow = (data) => data,
    filterFn = () => true,
    defaultValue = [],
  } = options

  // Estado principal
  const rows = storageKey
    ? useStorage(storageKey, defaultValue)
    : ref(defaultValue)

  // Inicializar filas existentes con createRow
  if (rows.value && rows.value.length > 0) {
    rows.value = rows.value.map((row) => createRow(row))
  }

  // Estados de UI
  const selection = ref(new Set())
  const editing = ref(new Set())
  const search = ref('')
  const isDragging = ref(false)
  const importError = ref('')
  const selectAllRef = ref(null)

  // Computed
  const hasData = computed(() => rows.value.length > 0)
  const totalRows = computed(() => rows.value.length)
  const totalSelected = computed(() => selection.value.size)

  const filteredRows = computed(() => {
    if (!search.value) return rows.value
    return rows.value.filter((row) => filterFn(row, search.value))
  })

  const visibleIds = computed(() => filteredRows.value.map((row) => row.id))

  const isAllVisibleSelected = computed(
    () =>
      visibleIds.value.length > 0 &&
      visibleIds.value.every((id) => selection.value.has(id))
  )

  const isSomeVisibleSelected = computed(
    () =>
      !isAllVisibleSelected.value &&
      visibleIds.value.some((id) => selection.value.has(id))
  )

  const totalFiltered = computed(() => filteredRows.value.length)

  // Watch para indeterminate checkbox
  watch([isAllVisibleSelected, isSomeVisibleSelected], ([all, some]) => {
    if (selectAllRef.value) {
      selectAllRef.value.indeterminate = some && !all
    }
  })

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
    visibleIds,
    isAllVisibleSelected,
    isSomeVisibleSelected,
    totalFiltered,

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
