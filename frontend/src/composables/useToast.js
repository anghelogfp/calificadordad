import { ref } from 'vue'

// Singleton — estado compartido entre todos los componentes
const toasts = ref([])
let nextId = 1

export function useToast() {
  function showToast(message, type = 'success', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, showToast, removeToast }
}
