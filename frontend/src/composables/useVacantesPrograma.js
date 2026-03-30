import { useStorage } from '@vueuse/core'
import { STORAGE_KEYS } from '@/constants'

/**
 * Composable para gestionar vacantes por programa de estudios.
 * Almacena un objeto plano { [nombrePrograma]: number } en localStorage.
 */
export function useVacantesPrograma() {
  const vacantesPrograma = useStorage(STORAGE_KEYS.VACANTES_PROGRAMA, {})

  function getVacantes(programa) {
    return Number(vacantesPrograma.value[programa]) || 0
  }

  function setVacantes(programa, n) {
    vacantesPrograma.value = {
      ...vacantesPrograma.value,
      [programa]: Number(n) || 0,
    }
  }

  return {
    vacantesPrograma,
    getVacantes,
    setVacantes,
  }
}
