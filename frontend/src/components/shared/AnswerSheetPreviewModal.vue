<script setup>
import { computed, ref } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import AnswerSheetPreview from '@/components/shared/AnswerSheetPreview.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: 'Cartilla visual' },
  subtitle: { type: String, default: '' },
  answers: { type: String, default: '' },
  correctAnswers: { type: String, default: '' },
  totalQuestions: { type: Number, default: 60 },
  mode: { type: String, default: 'answers' },
})

const emit = defineEmits(['close'])

const modalRef = ref(null)
useFocusTrap(modalRef, computed(() => props.show))

function close() {
  emit('close')
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="close">
      <div ref="modalRef" class="modal" role="dialog" aria-modal="true">
        <header class="modal__header">
          <div class="modal__title">
            <h2>{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
          <button type="button" class="modal__close" @click="close" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div class="modal__body">
          <AnswerSheetPreview
            :answers="answers"
            :correct-answers="correctAnswers"
            :total-questions="totalQuestions"
            :mode="mode"
            :title="title"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  padding: var(--space-6);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: var(--z-modal);
}

.modal {
  width: fit-content;
  max-width: min(100%, 860px);
  max-height: calc(100vh - var(--space-12));
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: white;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--slate-200);
  background: white;
}

.modal__title h2 {
  margin: 0;
  color: var(--slate-900);
  font-size: 1rem;
  font-weight: 800;
}

.modal__title p {
  margin: 3px 0 0;
  color: var(--slate-500);
  font-size: 0.8rem;
}

.modal__close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: white;
  color: var(--slate-500);
  cursor: pointer;
}

.modal__close svg {
  width: 16px;
  height: 16px;
}

.modal__body {
  overflow: auto;
  padding: var(--space-5);
  background: white;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-leave-active .modal {
  transition: transform 0.15s ease;
}

.modal-fade-enter-from .modal {
  transform: scale(0.96) translateY(8px);
}

.modal-fade-leave-to .modal {
  transform: scale(0.98);
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-3);
    align-items: flex-start;
  }

  .modal {
    max-height: calc(100vh - var(--space-6));
  }

  .modal__header,
  .modal__body {
    padding: var(--space-4);
  }
}
</style>
