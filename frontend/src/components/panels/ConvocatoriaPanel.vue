<script setup>
const props = defineProps({
  convocatoria: { type: Object, required: true },
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="convocatoria.showPanel.value" class="panel-overlay" @click.self="emit('close')">
      <div class="panel">
        <header class="panel__header">
          <div>
            <h2>Convocatorias</h2>
            <p>Gestiona las sesiones de examen</p>
          </div>
          <button type="button" class="panel__close" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </header>

        <div class="panel__body">
          <!-- Nueva convocatoria -->
          <div class="create-section">
            <h3>Nueva convocatoria</h3>
            <form class="create-form" @submit.prevent="convocatoria.createConvocatoria">
              <div class="fields-row">
                <div class="field field--grow">
                  <label>Tipo</label>
                  <input
                    v-model="convocatoria.newConvocatoriaForm.value.name"
                    type="text"
                    class="input"
                    placeholder="GENERAL"
                    maxlength="60"
                    required
                  />
                </div>
                <div class="field field--year">
                  <label>Año</label>
                  <input
                    v-model.number="convocatoria.newConvocatoriaForm.value.year"
                    type="number"
                    class="input"
                    min="2000"
                    max="2100"
                    required
                  />
                </div>
                <div class="field field--suffix">
                  <label>Sufijo <span class="optional">(opc.)</span></label>
                  <input
                    v-model="convocatoria.newConvocatoriaForm.value.suffix"
                    type="text"
                    class="input"
                    placeholder="I"
                    maxlength="10"
                  />
                </div>
              </div>
              <div v-if="convocatoria.newConvocatoriaForm.value.name" class="name-preview">
                <span>Vista previa: </span>
                <strong>
                  {{ convocatoria.newConvocatoriaForm.value.name.trim() }}
                  {{ convocatoria.newConvocatoriaForm.value.year }}
                  <template v-if="convocatoria.newConvocatoriaForm.value.suffix?.trim()">
                    - {{ convocatoria.newConvocatoriaForm.value.suffix.trim() }}
                  </template>
                </strong>
              </div>
              <div class="form-footer">
                <button type="submit" class="btn btn--primary btn--full" :disabled="convocatoria.loading.value">
                  {{ convocatoria.loading.value ? 'Creando...' : 'Crear convocatoria' }}
                </button>
              </div>
            </form>
            <div v-if="convocatoria.formError.value" class="alert alert--error">
              {{ convocatoria.formError.value }}
            </div>
          </div>

          <div class="divider" />

          <!-- Lista de convocatorias -->
          <div class="list-section">
            <h3>Convocatorias existentes</h3>
            <div v-if="convocatoria.loading.value && !convocatoria.convocatoriaList.value.length" class="empty-msg">
              Cargando...
            </div>
            <div v-else-if="!convocatoria.convocatoriaList.value.length" class="empty-msg">
              No hay convocatorias. Crea la primera arriba.
            </div>
            <div v-else class="conv-list">
              <div
                v-for="conv in convocatoria.convocatoriaList.value"
                :key="conv.id"
                class="conv-item"
                :class="{
                  'conv-item--active': convocatoria.activeConvocatoria.value?.id === conv.id,
                  'conv-item--closed': conv.status === 'closed'
                }"
                @click="convocatoria.setActiveConvocatoria(conv)"
              >
                <div class="conv-item__info">
                  <span class="conv-item__name">{{ conv.name }}</span>
                  <span class="conv-item__year">{{ conv.year }}</span>
                </div>
                <div class="conv-item__actions">
                  <span class="conv-item__status" :class="conv.status === 'active' ? 'status--active' : 'status--closed'">
                    {{ conv.status === 'active' ? 'Activa' : 'Cerrada' }}
                  </span>
                  <button
                    v-if="conv.status === 'active'"
                    type="button"
                    class="icon-btn"
                    @click.stop="convocatoria.closeConvocatoria(conv.id)"
                    title="Cerrar convocatoria"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                  <button
                    v-else
                    type="button"
                    class="icon-btn"
                    @click.stop="convocatoria.reopenConvocatoria(conv.id)"
                    title="Reabrir convocatoria"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.panel-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 29, 61, 0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 150;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.panel {
  width: min(520px, 100%);
  max-height: 90vh;
  background: white;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  animation: scaleIn 0.2s ease-out;
  overflow: hidden;
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.panel__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--unap-blue-700) 0%, var(--unap-blue-800) 100%);
  color: white;
  flex-shrink: 0;
}

.panel__header h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.panel__header p { font-size: 0.8rem; color: var(--unap-blue-200); margin: 2px 0 0; }

.panel__close {
  width: 32px; height: 32px; border: none;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.1); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.panel__close svg { width: 18px; height: 18px; }
.panel__close:hover { background: rgba(255,255,255,0.2); }

.panel__body {
  flex: 1; overflow-y: auto;
  padding: var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-6);
}

.create-section, .list-section {
  display: flex; flex-direction: column; gap: var(--space-4);
}

h3 { font-size: 0.95rem; font-weight: 700; color: var(--slate-800); margin: 0; }

.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.fields-row { display: flex; gap: var(--space-3); align-items: flex-end; }
.field { display: flex; flex-direction: column; gap: var(--space-1); }
.field--grow { flex: 1; min-width: 100px; }
.field--year { flex: 0 0 88px; }
.field--suffix { flex: 0 0 72px; }

.form-footer { display: flex; justify-content: flex-end; }
.optional { font-size: 0.68rem; font-weight: 400; color: var(--slate-400); }
.name-preview {
  font-size: 0.8rem; color: var(--slate-600);
  padding: var(--space-2) var(--space-3);
  background: var(--unap-blue-50); border: 1px solid var(--unap-blue-100);
  border-radius: var(--radius-md);
}
.name-preview strong { color: var(--unap-blue-800); }
.field label { font-size: 0.75rem; font-weight: 600; color: var(--slate-600); text-transform: uppercase; }

.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: var(--slate-50);
  width: 100%;
  box-sizing: border-box;
}
.input:focus { outline: none; border-color: var(--unap-blue-400); background: white; }

.divider { height: 1px; background: var(--slate-100); }

.conv-list { display: flex; flex-direction: column; gap: var(--space-3); }

.conv-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  border: 2px solid var(--slate-100);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: white;
}

.conv-item:hover { border-color: var(--unap-blue-200); background: var(--unap-blue-50); }
.conv-item--active { border-color: var(--unap-blue-500); background: var(--unap-blue-50); }
.conv-item--closed { opacity: 0.7; }

.conv-item__info { display: flex; flex-direction: column; gap: 2px; }
.conv-item__name { font-weight: 600; font-size: 0.9rem; color: var(--slate-800); }
.conv-item__year { font-size: 0.8rem; color: var(--slate-500); }

.conv-item__actions { display: flex; align-items: center; gap: var(--space-2); }

.conv-item__status {
  font-size: 0.7rem; font-weight: 700;
  padding: 2px 8px; border-radius: var(--radius-full);
  text-transform: uppercase; letter-spacing: 0.05em;
}

.status--active { background: #d4edda; color: #155724; }
.status--closed { background: var(--slate-100); color: var(--slate-600); }

.empty-msg { font-size: 0.875rem; color: var(--slate-500); text-align: center; padding: var(--space-5); }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2); padding: var(--space-2) var(--space-5);
  border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); white-space: nowrap;
  min-height: 40px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary {
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%);
  color: white;
}
.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%);
}

.btn--full { width: 100%; }

.icon-btn {
  width: 30px; height: 30px;
  border: 1px solid var(--slate-200); border-radius: var(--radius-sm);
  background: white; color: var(--slate-600);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.icon-btn svg { width: 14px; height: 14px; }
.icon-btn:hover { background: var(--slate-50); color: var(--unap-blue-600); }

.alert {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md); font-size: 0.85rem;
}
.alert--error { background: var(--error-50); color: var(--error-700); border: 1px solid var(--error-200); }
</style>
