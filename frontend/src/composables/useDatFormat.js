import { ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { API_BASE_URL, STORAGE_KEYS, DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'

/**
 * Composable para configuración del formato de archivos .dat
 */
export function useDatFormat(activeConvocatoria) {
  const formatConfig = useStorage(STORAGE_KEYS.DAT_FORMAT, { ...DEFAULT_DAT_FORMAT })
  const loading = ref(false)
  const error = ref('')
  const showPanel = ref(false)
  const apiId = ref(null)

  async function fetchFormatConfig(convocatoriaId) {
    if (!convocatoriaId) return
    try {
      loading.value = true
      error.value = ''
      const res = await apiFetch(`/dat-format-configs/?convocatoria=${convocatoriaId}`)
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      if (data.length > 0) {
        const cfg = data[0]
        apiId.value = cfg.id
        formatConfig.value = {
          headerLength: cfg.header_length,
          answersLength: cfg.answers_length,
          lithoOffset: cfg.litho_offset,
          lithoLength: cfg.litho_length,
          tipoOffset: cfg.tipo_offset,
          tipoLength: cfg.tipo_length,
          dniOffset: cfg.dni_offset,
          dniLength: cfg.dni_length,
          aulaOffset: cfg.aula_offset,
          aulaLength: cfg.aula_length,
          answersOffset: cfg.answers_offset,
        }
      }
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveFormatConfig(convocatoriaId) {
    if (!convocatoriaId) return
    const payload = {
      convocatoria: convocatoriaId,
      header_length: formatConfig.value.headerLength,
      answers_length: formatConfig.value.answersLength,
      litho_offset: formatConfig.value.lithoOffset,
      litho_length: formatConfig.value.lithoLength,
      tipo_offset: formatConfig.value.tipoOffset,
      tipo_length: formatConfig.value.tipoLength,
      dni_offset: formatConfig.value.dniOffset,
      dni_length: formatConfig.value.dniLength,
      aula_offset: formatConfig.value.aulaOffset,
      aula_length: formatConfig.value.aulaLength,
      answers_offset: formatConfig.value.answersOffset,
    }
    try {
      let res
      if (apiId.value) {
        res = await apiFetch(`/dat-format-configs/${apiId.value}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await apiFetch(`/dat-format-configs/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          apiId.value = data.id
        }
      }
    } catch (e) {
      // Ignorar errores de API, ya está guardado en localStorage
    }
  }

  function resetToDefault() {
    formatConfig.value = { ...DEFAULT_DAT_FORMAT }
  }

  if (activeConvocatoria) {
    watch(
      activeConvocatoria,
      (conv) => {
        if (conv?.id) fetchFormatConfig(conv.id)
        else formatConfig.value = { ...DEFAULT_DAT_FORMAT }
      },
      { immediate: true }
    )
  }

  return {
    formatConfig,
    loading,
    error,
    showPanel,
    fetchFormatConfig,
    saveFormatConfig,
    resetToDefault,
  }
}
