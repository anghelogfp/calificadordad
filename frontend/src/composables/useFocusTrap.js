import { watch, onBeforeUnmount } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(containerRef, active) {
  let previouslyFocused = null

  function getFocusable() {
    return Array.from(containerRef.value?.querySelectorAll(FOCUSABLE) ?? [])
  }

  function handleKeydown(e) {
    if (e.key !== 'Tab') return
    const focusable = getFocusable()
    if (!focusable.length) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement
    document.addEventListener('keydown', handleKeydown)
    // Foco al primer elemento interactivo tras el próximo tick
    requestAnimationFrame(() => getFocusable()[0]?.focus())
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeydown)
    previouslyFocused?.focus()
    previouslyFocused = null
  }

  watch(active, (val) => val ? activate() : deactivate(), { flush: 'post' })
  onBeforeUnmount(deactivate)
}
