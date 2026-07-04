import { ref } from 'vue'
import { STORAGE_KEYS } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'

const BACKUP_VERSION = 3

const LOCAL_UI_KEYS = [
  STORAGE_KEYS.ACTIVE_TAB,
  STORAGE_KEYS.IDENTIFIER_SUBTAB,
  STORAGE_KEYS.RESPONSES_SUBTAB,
  STORAGE_KEYS.ANSWER_KEY_SUBTAB,
  STORAGE_KEYS.ACTIVE_PROCESS,
]

const LEGACY_BUSINESS_KEYS = [
  STORAGE_KEYS.ARCHIVE,
  STORAGE_KEYS.IDENTIFIER,
  STORAGE_KEYS.RESPONSES,
  STORAGE_KEYS.ANSWER_KEYS,
  STORAGE_KEYS.PONDERATION,
  STORAGE_KEYS.SCORE_RESULTS,
  STORAGE_KEYS.IDENTIFIER_SOURCES,
  STORAGE_KEYS.RESPONSES_SOURCES,
  STORAGE_KEYS.ANSWER_KEY_SOURCES,
  STORAGE_KEYS.DAT_FORMAT,
  STORAGE_KEYS.VACANTES,
  STORAGE_KEYS.VACANTES_PROGRAMA,
  STORAGE_KEYS.HISTORY,
  STORAGE_KEYS.PLANTILLAS,
  STORAGE_KEYS.CALIFICATION_CONFIG,
]

async function readJson(path) {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(`No se pudo leer ${path}.`)
  return await res.json()
}

async function writeJson(path, body, method = 'POST') {
  const res = await apiFetch(path, {
    method,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`No se pudo escribir ${path}.`)
  return res
}

function readLocalUiData() {
  const data = {}
  LOCAL_UI_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) data[key] = JSON.parse(raw)
    } catch {
      const raw = localStorage.getItem(key)
      if (raw !== null) data[key] = raw
    }
  })
  return data
}

async function readProcesosFull() {
  const procesos = await readJson('/procesos/')
  const full = []

  for (const proceso of procesos) {
    const dbId = proceso.dbId || proceso.id
    if (!dbId) continue
    full.push(await readJson(`/procesos/${dbId}/full/`))
  }

  return full
}

async function exportServerData() {
  return {
    candidatos: await readJson('/candidatos/'),
    identifierSources: await readJson('/identifier-sources/'),
    identificadores: await readJson('/identificadores/'),
    responseSources: await readJson('/response-sources/'),
    respuestas: await readJson('/respuestas/'),
    answerKeySources: await readJson('/answer-key-sources/'),
    answerKeys: await readJson('/answer-keys/'),
    programaVacantes: await readJson('/programa-vacantes/'),
    calificationConfigs: await readJson('/calification-configs/'),
    datFormatConfig: await readJson('/dat-format-configs/'),
    plantillas: await readJson('/plantillas/'),
    procesos: await readProcesosFull(),
  }
}

async function restoreServerData(server = {}) {
  await writeJson('/backup/restore/', server)
}

function restoreLocalData(data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignorar valores no serializables.
    }
  })
}

/**
 * Exporta e importa datos de la sesión autenticada.
 */
export function useBackup() {
  const showModal = ref(false)
  const importError = ref('')
  const importSuccess = ref(false)
  const exportError = ref('')
  const exportLoading = ref(false)
  const importLoading = ref(false)

  async function exportSessionBackup() {
    exportError.value = ''
    exportLoading.value = true

    try {
      const { saveAs } = await import('file-saver')
      const backup = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        source: 'api',
        server: await exportServerData(),
        localUi: readLocalUiData(),
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const date = new Date().toISOString().slice(0, 10)
      saveAs(blob, `backup-calificador-${date}.json`)
    } catch (error) {
      exportError.value = `No se pudo exportar desde el servidor: ${error.message}`
    } finally {
      exportLoading.value = false
    }
  }

  async function importSessionBackup(file) {
    importError.value = ''
    importSuccess.value = false
    importLoading.value = true

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      if (!backup.version) {
        importError.value = 'El archivo no es un backup válido del calificador.'
        return
      }

      if (backup.version > BACKUP_VERSION) {
        importError.value = `Este backup fue creado con una versión más nueva (v${backup.version}). Actualiza la aplicación.`
        return
      }

      if (backup.server) {
        await restoreServerData(backup.server)
        restoreLocalData(backup.localUi || {})
      } else if (backup.data) {
        importError.value = 'Este backup antiguo solo contiene localStorage. Ya no se restaura automáticamente porque la base de datos es la fuente oficial.'
        return
      } else {
        importError.value = 'El archivo no contiene datos restaurables.'
        return
      }

      importSuccess.value = true
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (e) {
      importError.value = `Error al restaurar el backup: ${e.message}`
    } finally {
      importLoading.value = false
    }
  }

  function clearAllData() {
    const keysToClear = [...LOCAL_UI_KEYS, ...LEGACY_BUSINESS_KEYS]
    keysToClear.forEach((key) => {
      localStorage.removeItem(key)
    })
    window.location.reload()
  }

  return {
    showModal,
    importError,
    importSuccess,
    exportError,
    exportLoading,
    importLoading,
    exportSessionBackup,
    importSessionBackup,
    clearAllData,
  }
}
