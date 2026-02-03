import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  STORAGE_KEYS,
  DEFAULT_PONDERATIONS,
  ANSWER_KEY_AREAS,
  API_BASE_URL,
} from '@/constants'
import {
  normalize,
  normalizeArea,
  buildPonderationKey,
  buildQuestionPlan,
} from '@/utils/helpers'

/**
 * Crea una fila de ponderación
 */
export function createPonderationRow(data = {}) {
  const area = normalizeArea(data.area)
  const subject = String(data.subject ?? '').trim()
  const questionCount = Math.max(0, Math.round(Number(data.questionCount ?? 0)))
  const ponderation = Number(data.ponderation ?? 0) || 0
  const order = Math.max(0, Math.round(Number(data.order ?? 0)))
  const id = data.id ?? buildPonderationKey(area, subject)

  return {
    id,
    area,
    subject,
    questionCount,
    ponderation,
    order,
  }
}

/**
 * Composable para gestión de ponderaciones
 */
export function usePonderations() {
  // Estado principal
  const ponderationRows = useStorage(STORAGE_KEYS.PONDERATION, [])
  const ponderationEditing = ref(new Set())
  const ponderationModalArea = ref(ANSWER_KEY_AREAS[0])
  const newPonderation = reactive({ subject: '', questionCount: 1, ponderation: 1 })
  const ponderationError = ref('')
  const ponderationApiLoading = ref(false)
  const ponderationApiError = ref('')

  // API functions
  async function fetchPonderacionesFromAPI() {
    try {
      ponderationApiLoading.value = true
      ponderationApiError.value = ''
      const response = await fetch(`${API_BASE_URL}/ponderaciones/`)
      if (!response.ok) {
        throw new Error(`Error al cargar ponderaciones: ${response.statusText}`)
      }
      const data = await response.json()
      return data.map((item) => ({
        id: buildPonderationKey(item.area, item.subject),
        area: item.area,
        subject: item.subject,
        questionCount: item.question_count,
        ponderation: Number(item.ponderation),
        order: item.order,
      }))
    } catch (error) {
      console.error('Error al cargar ponderaciones desde API:', error)
      ponderationApiError.value = error.message
      return null
    } finally {
      ponderationApiLoading.value = false
    }
  }

  async function savePonderationToAPI(row) {
    try {
      const area = normalizeArea(row.area)
      const subject = String(row.subject ?? '').trim()
      const payload = {
        area,
        subject,
        question_count: Math.max(0, Math.round(Number(row.questionCount ?? 0))),
        ponderation: Number(row.ponderation ?? 0) || 0,
        order: Math.max(1, Math.round(Number(row.order ?? 1))),
      }

      const checkResponse = await fetch(
        `${API_BASE_URL}/ponderaciones/?area=${encodeURIComponent(area)}`
      )
      if (checkResponse.ok) {
        const existing = await checkResponse.json()
        const found = existing.find(
          (item) => normalize(item.subject) === normalize(subject)
        )

        let response
        if (found) {
          response = await fetch(`${API_BASE_URL}/ponderaciones/${found.id}/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })
        } else {
          response = await fetch(`${API_BASE_URL}/ponderaciones/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })
        }

        if (!response.ok) {
          throw new Error(`Error al guardar ponderación: ${response.statusText}`)
        }
        return await response.json()
      }
    } catch (error) {
      console.error('Error al guardar ponderación en API:', error)
      ponderationApiError.value = error.message
      throw error
    }
  }

  async function deletePonderationFromAPI(row) {
    try {
      const area = normalizeArea(row.area)
      const subject = String(row.subject ?? '').trim()

      const response = await fetch(
        `${API_BASE_URL}/ponderaciones/?area=${encodeURIComponent(area)}`
      )
      if (!response.ok) {
        throw new Error(`Error al buscar ponderación: ${response.statusText}`)
      }
      const data = await response.json()
      const found = data.find((item) => normalize(item.subject) === normalize(subject))

      if (found) {
        const deleteResponse = await fetch(
          `${API_BASE_URL}/ponderaciones/${found.id}/`,
          {
            method: 'DELETE',
          }
        )
        if (!deleteResponse.ok) {
          throw new Error(`Error al eliminar ponderación: ${deleteResponse.statusText}`)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Error al eliminar ponderación de API:', error)
      ponderationApiError.value = error.message
      throw error
    }
  }

  // Computed
  const ponderationAreaList = computed(() => {
    const areas = new Set(ANSWER_KEY_AREAS)
    ponderationRows.value.forEach((row) => areas.add(normalizeArea(row.area)))
    return Array.from(areas)
  })

  const ponderationEntriesByArea = computed(() => {
    const map = new Map()
    DEFAULT_PONDERATIONS.forEach((row) => {
      const area = normalizeArea(row.area)
      if (!map.has(area)) {
        map.set(area, [])
      }
      const list = map.get(area)
      if (!list.some((item) => normalize(item.subject) === normalize(row.subject))) {
        list.push(createPonderationRow(row))
      }
    })

    ponderationRows.value.forEach((row) => {
      const area = normalizeArea(row.area)
      if (!map.has(area)) {
        map.set(area, [])
      }
      const list = map.get(area)
      const existingIndex = list.findIndex((item) => normalize(item.subject) === normalize(row.subject))
      if (existingIndex >= 0) {
        list[existingIndex] = createPonderationRow({
          ...list[existingIndex],
          ...row,
        })
      } else {
        list.push(createPonderationRow(row))
      }
    })

    map.forEach((list) => {
      list.sort((a, b) => {
        if (a.order === b.order) {
          return normalize(a.subject).localeCompare(normalize(b.subject))
        }
        return a.order - b.order
      })
    })

    return map
  })

  const ponderationCurrentAreaRows = computed(() => {
    return ponderationEntriesByArea.value.get(ponderationModalArea.value) || []
  })

  const ponderationPlanByArea = computed(() => {
    const planMap = new Map()
    ponderationEntriesByArea.value.forEach((rows, area) => {
      planMap.set(area, buildQuestionPlan(rows))
    })
    return planMap
  })

  const ponderationTotalsByArea = computed(() => {
    const totals = new Map()
    ponderationPlanByArea.value.forEach((plan, area) => {
      totals.set(area, {
        questions: plan.length,
        weight: plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0),
      })
    })
    return totals
  })

  const ponderationCurrentTotals = computed(() => {
    const entry = ponderationTotalsByArea.value.get(ponderationModalArea.value)
    return {
      questions: entry?.questions ?? 0,
      weight: entry?.weight ?? 0,
    }
  })

  // Methods
  function resetNewPonderation() {
    newPonderation.subject = ''
    newPonderation.questionCount = 1
    newPonderation.ponderation = 1
  }

  function isPonderationEditing(id) {
    return ponderationEditing.value.has(id)
  }

  async function togglePonderationEditRow(row) {
    const next = new Set(ponderationEditing.value)
    if (next.has(row.id)) {
      next.delete(row.id)
      await upsertPonderationOverride(row)
    } else {
      next.add(row.id)
    }
    ponderationEditing.value = next
  }

  async function removePonderationRow(row) {
    const rowId = row.id || buildPonderationKey(row.area, row.subject)

    try {
      await deletePonderationFromAPI(row)
    } catch (error) {
      console.error('Error al eliminar de API, continuando con eliminación local:', error)
    }

    const index = ponderationRows.value.findIndex((item) => {
      const itemId = item.id || buildPonderationKey(item.area, item.subject)
      return itemId === rowId
    })

    if (index !== -1) {
      ponderationRows.value.splice(index, 1)
    }
  }

  async function addPonderationRow() {
    ponderationError.value = ''
    const subject = String(newPonderation.subject ?? '').trim()
    const questionCount = Math.max(0, Math.round(Number(newPonderation.questionCount ?? 0)))
    const ponderation = Number(newPonderation.ponderation ?? 0)

    if (!subject) {
      ponderationError.value = 'Ingresa la asignatura.'
      return
    }

    if (!Number.isFinite(questionCount) || questionCount <= 0) {
      ponderationError.value = 'La cantidad de preguntas debe ser mayor a cero.'
      return
    }

    if (!Number.isFinite(ponderation) || ponderation <= 0) {
      ponderationError.value = 'La ponderación debe ser un número positivo.'
      return
    }

    const area = ponderationModalArea.value
    const areaRows = ponderationRows.value.filter((r) => normalizeArea(r.area) === normalizeArea(area))
    const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order || 0)) : 0
    const row = createPonderationRow({
      area,
      subject,
      questionCount,
      ponderation,
      order: maxOrder + 1,
    })

    await upsertPonderationOverride(row)
    resetNewPonderation()
  }

  async function upsertPonderationOverride(row) {
    const area = normalizeArea(row.area)
    const subject = String(row.subject ?? '').trim()
    const key = buildPonderationKey(area, subject)
    const questionCount = Math.max(0, Math.round(Number(row.questionCount ?? 0)))
    const ponderation = Number(row.ponderation ?? 0) || 0
    const order = Math.max(1, Math.round(Number(row.order ?? 1)))

    const defaultEntry = DEFAULT_PONDERATIONS.find(
      (entry) => buildPonderationKey(entry.area, entry.subject) === key
    )

    const matchesDefault =
      defaultEntry &&
      Math.round(Number(defaultEntry.questionCount ?? 0)) === questionCount &&
      Number(defaultEntry.ponderation ?? 0) === ponderation

    try {
      await savePonderationToAPI(row)
    } catch (error) {
      console.error('Error al guardar en API, continuando con guardado local:', error)
    }

    const rowId = row.id || key
    const nextRows = ponderationRows.value.filter((item) => {
      const itemId = item.id || buildPonderationKey(item.area, item.subject)
      return itemId !== rowId
    })

    if (!matchesDefault) {
      nextRows.push(
        createPonderationRow({
          id: key,
          area,
          subject,
          questionCount,
          ponderation,
          order,
        })
      )
    }

    ponderationRows.value = nextRows
  }

  function ensureDefaultPonderations() {
    let changed = false
    DEFAULT_PONDERATIONS.forEach((entry) => {
      const area = normalizeArea(entry.area)
      const subjectKey = normalize(entry.subject)
      const exists = ponderationRows.value.some(
        (row) => normalizeArea(row.area) === area && normalize(row.subject) === subjectKey
      )
      if (!exists) {
        ponderationRows.value.push(
          createPonderationRow({
            ...entry,
            area,
          })
        )
        changed = true
      }
    })

    if (changed) {
      ponderationRows.value.forEach((row) => {
        if (!row.order || row.order === 0) {
          const areaRows = ponderationRows.value.filter((r) => r.area === row.area && r.order > 0)
          const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order)) : 0
          row.order = maxOrder + 1
        }
      })
    }
  }

  // Initialize
  async function initializePonderations() {
    const apiData = await fetchPonderacionesFromAPI()
    if (apiData && apiData.length > 0) {
      const uniqueRows = new Map()
      apiData.forEach((row) => {
        const createdRow = createPonderationRow(row)
        const id = createdRow.id
        if (!uniqueRows.has(id)) {
          uniqueRows.set(id, createdRow)
        }
      })
      ponderationRows.value = Array.from(uniqueRows.values())
    } else if (ponderationRows.value.length === 0) {
      ponderationRows.value = DEFAULT_PONDERATIONS.map((row) => createPonderationRow(row))
      try {
        await fetch(`${API_BASE_URL}/ponderaciones/bulk_create/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            ponderationRows.value.map((row) => ({
              area: row.area,
              subject: row.subject,
              question_count: row.questionCount,
              ponderation: row.ponderation,
              order: row.order,
            }))
          ),
        })
      } catch (error) {
        console.error('Error al guardar defaults en API:', error)
      }
    } else {
      const uniqueRows = new Map()
      ponderationRows.value.forEach((row) => {
        const createdRow = createPonderationRow(row)
        const id = createdRow.id
        if (!uniqueRows.has(id)) {
          uniqueRows.set(id, createdRow)
        }
      })
      ponderationRows.value = Array.from(uniqueRows.values())
    }
    ponderationRows.value.forEach((row) => {
      if (!row.order || row.order === 0) {
        const areaRows = ponderationRows.value.filter((r) => r.area === row.area && r.order > 0)
        const maxOrder = areaRows.length > 0 ? Math.max(...areaRows.map((r) => r.order)) : 0
        row.order = maxOrder + 1
      }
    })
    ensureDefaultPonderations()
  }

  // Watch
  watch(
    ponderationRows,
    (rows) => {
      rows.forEach((row) => {
        row.area = normalizeArea(row.area)
        row.subject = String(row.subject ?? '').trim()
        row.questionCount = Math.max(0, Math.round(Number(row.questionCount ?? 0)))
        row.ponderation = Number(row.ponderation ?? 0) || 0
        row.order = Math.max(0, Math.round(Number(row.order ?? 0)))
      })
    },
    { deep: true }
  )

  watch(ponderationModalArea, () => {
    resetNewPonderation()
    ponderationError.value = ''
    ponderationEditing.value = new Set()
  })

  return {
    // Estado
    ponderationRows,
    ponderationEditing,
    ponderationModalArea,
    newPonderation,
    ponderationError,
    ponderationApiLoading,
    ponderationApiError,

    // Computed
    ponderationAreaList,
    ponderationEntriesByArea,
    ponderationCurrentAreaRows,
    ponderationPlanByArea,
    ponderationTotalsByArea,
    ponderationCurrentTotals,

    // Methods
    initializePonderations,
    resetNewPonderation,
    isPonderationEditing,
    togglePonderationEditRow,
    removePonderationRow,
    addPonderationRow,
    upsertPonderationOverride,
    ensureDefaultPonderations,
  }
}
