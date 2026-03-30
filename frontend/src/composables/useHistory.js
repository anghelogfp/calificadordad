import { ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { STORAGE_KEYS } from '@/constants'

export function useHistory() {
  const historyList = useStorage(STORAGE_KEYS.HISTORY, [])
  const showHistoryPanel = ref(false)

  function saveProcess(process) {
    if (!process?.id) return
    const copy = { ...process, savedAt: new Date().toISOString() }
    const idx = historyList.value.findIndex(p => p.id === process.id)
    if (idx >= 0) {
      historyList.value = historyList.value.map((p, i) => i === idx ? copy : p)
    } else {
      historyList.value = [copy, ...historyList.value].slice(0, 20)
    }
  }

  function deleteProcess(id) {
    historyList.value = historyList.value.filter(p => p.id !== id)
  }

  function openHistoryPanel() { showHistoryPanel.value = true }
  function closeHistoryPanel() { showHistoryPanel.value = false }

  return {
    historyList,
    showHistoryPanel,
    saveProcess,
    deleteProcess,
    openHistoryPanel,
    closeHistoryPanel,
  }
}
