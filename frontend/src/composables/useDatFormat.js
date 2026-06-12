import { ref, onMounted } from 'vue'
import { useStorage } from '@vueuse/core'
import { STORAGE_KEYS, DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'

export function useDatFormat() {
  const formatConfig = useStorage(STORAGE_KEYS.DAT_FORMAT, { ...DEFAULT_DAT_FORMAT })
  const loading = ref(false)
  const error = ref('')
  const apiId = ref(null)

  async function fetchFormatConfig() {
    try {
      loading.value = true
      error.value = ''
      const res = await apiFetch('/dat-format-configs/')
      if (!res.ok) throw new Error(res.statusText)
      const cfg = await res.json()
      if (cfg?.id) {
        apiId.value = cfg.id
        formatConfig.value = {
          headerLength:  cfg.header_length,
          answersLength: cfg.answers_length,
          lithoOffset:   cfg.litho_offset,
          lithoLength:   cfg.litho_length,
          tipoOffset:    cfg.tipo_offset,
          tipoLength:    cfg.tipo_length,
          dniOffset:     cfg.dni_offset,
          dniLength:     cfg.dni_length,
          aulaOffset:    cfg.aula_offset,
          aulaLength:    cfg.aula_length,
          answersOffset: cfg.answers_offset,
        }
      }
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveFormatConfig() {
    const payload = {
      header_length:  formatConfig.value.headerLength,
      answers_length: formatConfig.value.answersLength,
      litho_offset:   formatConfig.value.lithoOffset,
      litho_length:   formatConfig.value.lithoLength,
      tipo_offset:    formatConfig.value.tipoOffset,
      tipo_length:    formatConfig.value.tipoLength,
      dni_offset:     formatConfig.value.dniOffset,
      dni_length:     formatConfig.value.dniLength,
      aula_offset:    formatConfig.value.aulaOffset,
      aula_length:    formatConfig.value.aulaLength,
      answers_offset: formatConfig.value.answersOffset,
    }
    try {
      const id = apiId.value || 1
      await apiFetch(`/dat-format-configs/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // Ya guardado en localStorage
    }
  }

  function resetToDefault() {
    formatConfig.value = { ...DEFAULT_DAT_FORMAT }
  }

  onMounted(fetchFormatConfig)

  return {
    formatConfig,
    loading,
    error,
    fetchFormatConfig,
    saveFormatConfig,
    resetToDefault,
  }
}
