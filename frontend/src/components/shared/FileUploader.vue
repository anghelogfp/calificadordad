<script setup>
defineProps({
  id: {
    type: String,
    required: true
  },
  accept: {
    type: String,
    default: '.dat,.txt'
  },
  multiple: {
    type: Boolean,
    default: false
  },
  isDragging: {
    type: Boolean,
    default: false
  },
  hasData: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Arrastra tus archivos aquí'
  },
  subtitle: {
    type: String,
    default: 'o haz clic para seleccionar desde tu equipo'
  },
  buttonText: {
    type: String,
    default: 'Seleccionar archivos'
  },
  badges: {
    type: Array,
    default: () => ['.dat']
  },
  hint: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['drop', 'dragover', 'dragleave', 'change'])

function onDrop(event) {
  emit('drop', event)
}

function onDragOver(event) {
  emit('dragover', event)
}

function onDragLeave(event) {
  emit('dragleave', event)
}

function onChange(event) {
  emit('change', event)
}
</script>

<template>
  <section
    class="uploader"
    :class="{ 'uploader--dragging': isDragging, 'uploader--has-data': hasData }"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
  >
    <input
      :id="id"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="uploader__input"
      @change="onChange"
    />
    <label :for="id" class="uploader__label">
      <div class="uploader__icon">
        <slot name="icon">
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M24 16v16M16 24h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </slot>
      </div>
      <div class="uploader__text">
        <strong>{{ title }}</strong>
        <span>{{ subtitle }}</span>
      </div>
      <div class="uploader__action">
        <span class="uploader__button">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
          {{ buttonText }}
        </span>
      </div>
      <div class="uploader__meta">
        <span v-for="badge in badges" :key="badge" class="uploader__badge">{{ badge }}</span>
        <span v-if="hint" class="uploader__hint">{{ hint }}</span>
      </div>
    </label>
  </section>
</template>

<style scoped>
.uploader {
  position: relative;
  border: 2px dashed var(--slate-300);
  border-radius: var(--radius-xl);
  background: white;
  transition: all var(--transition-base);
  overflow: hidden;
}

.uploader::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--unap-blue-50) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-base);
  pointer-events: none;
  z-index: 0;
}

.uploader:hover::before,
.uploader--dragging::before {
  opacity: 1;
}

.uploader--dragging {
  border-color: var(--unap-blue-500);
  border-style: solid;
  box-shadow: 0 0 0 4px rgba(0, 82, 163, 0.15);
}

.uploader--has-data {
  border-style: solid;
  border-color: var(--success-400);
  background: var(--success-50);
}

.uploader__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 3;
}

.uploader__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
  text-align: center;
  position: relative;
  z-index: 2;
}

.uploader__icon {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, var(--unap-blue-100) 0%, var(--unap-blue-50) 100%);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-base);
}

.uploader:hover .uploader__icon {
  transform: scale(1.05);
}

.uploader__icon :deep(svg) {
  width: 36px;
  height: 36px;
  color: var(--unap-blue-500);
}

.uploader__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.uploader__text strong {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--slate-800);
}

.uploader__text span {
  font-size: 0.9rem;
  color: var(--slate-500);
}

.uploader__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.uploader__badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-3);
  background: var(--unap-gold-100);
  color: var(--unap-gold-600);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  text-transform: uppercase;
}

.uploader__hint {
  font-size: 0.8rem;
  color: var(--slate-500);
}

.uploader__action {
  margin-top: var(--space-2);
}

.uploader__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all var(--transition-fast);
  pointer-events: none;
}

.uploader__button svg {
  width: 18px;
  height: 18px;
}

.uploader:hover .uploader__button {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
</style>
