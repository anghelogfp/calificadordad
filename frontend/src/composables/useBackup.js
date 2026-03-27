import { ref } from 'vue'
import { saveAs } from 'file-saver'
import { STORAGE_KEYS } from '@/constants'

const BACKUP_VERSION = 2

/**
 * Composable para exportar e importar toda la sesión como JSON
 */
export function useBackup() {
  const showModal = ref(false)
  const importError = ref('')
  const importSuccess = ref(false)

  function exportSessionBackup() {
    const data = {}

    Object.entries(STORAGE_KEYS).forEach(([, key]) => {
      try {
        const raw = localStorage.getItem(key)
        if (raw !== null) {
          data[key] = JSON.parse(raw)
        }
      } catch {
        data[key] = localStorage.getItem(key)
      }
    })

    const backup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const date = new Date().toISOString().slice(0, 10)
    saveAs(blob, `backup-calificador-${date}.json`)
  }

  async function importSessionBackup(file) {
    importError.value = ''
    importSuccess.value = false

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      if (!backup.version || !backup.data) {
        importError.value = 'El archivo no es un backup válido del calificador.'
        return
      }

      if (backup.version > BACKUP_VERSION) {
        importError.value = `Este backup fue creado con una versión más nueva (v${backup.version}). Actualiza la aplicación.`
        return
      }

      // Restaurar todos los keys
      Object.entries(backup.data).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          // Ignorar keys que no se pueden restaurar
        }
      })

      importSuccess.value = true

      // Recargar la página después de 1.5s para re-inicializar composables
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (e) {
      importError.value = `Error al leer el archivo: ${e.message}`
    }
  }

  function clearAllData() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
    window.location.reload()
  }

  return {
    showModal,
    importError,
    importSuccess,
    exportSessionBackup,
    importSessionBackup,
    clearAllData,
  }
}
