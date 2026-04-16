<script setup>
import { ref, reactive, onMounted } from 'vue'
import StepInfoCard from '@/components/shared/StepInfoCard.vue'
import { useToast } from '@/composables/useToast'
import { useUsuarios } from '@/composables/useUsuarios'

const { showToast } = useToast()
const { users, loading, fetchUsuarios, createUsuario, updateUsuario, setPassword, toggleActivo } = useUsuarios()

onMounted(fetchUsuarios)

// ── Modal crear/editar ──────────────────────────────────────────────────────

const MODAL_EMPTY = {
  id: null,
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  is_staff: false,
  is_active: true,
  password: '',
  passwordConfirm: '',
}

const showModal = ref(false)
const modalMode = ref('create') // 'create' | 'edit'
const form = reactive({ ...MODAL_EMPTY })
const saving = ref(false)
const formError = ref('')

function openCreate() {
  Object.assign(form, MODAL_EMPTY)
  formError.value = ''
  modalMode.value = 'create'
  showModal.value = true
}

function openEdit(user) {
  Object.assign(form, {
    ...MODAL_EMPTY,
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    is_staff: user.is_staff,
    is_active: user.is_active,
  })
  formError.value = ''
  modalMode.value = 'edit'
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function submitForm() {
  formError.value = ''
  if (!form.username.trim()) {
    formError.value = 'El nombre de usuario es obligatorio.'
    return
  }
  if (modalMode.value === 'create') {
    if (!form.password) { formError.value = 'La contraseña es obligatoria.'; return }
    if (form.password !== form.passwordConfirm) { formError.value = 'Las contraseñas no coinciden.'; return }
  }

  saving.value = true
  try {
    if (modalMode.value === 'create') {
      await createUsuario({
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        is_staff: form.is_staff,
      })
      showToast('Usuario creado correctamente', 'success')
    } else {
      await updateUsuario(form.id, {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        is_staff: form.is_staff,
      })
      showToast('Usuario actualizado', 'success')
    }
    closeModal()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Modal cambiar contraseña ────────────────────────────────────────────────

const showPasswordModal = ref(false)
const passwordTarget = ref(null)
const newPassword = ref('')
const newPasswordConfirm = ref('')
const passwordError = ref('')
const savingPassword = ref(false)

function openPasswordModal(user) {
  passwordTarget.value = user
  newPassword.value = ''
  newPasswordConfirm.value = ''
  passwordError.value = ''
  showPasswordModal.value = true
}

async function submitPassword() {
  passwordError.value = ''
  if (!newPassword.value) { passwordError.value = 'Ingresa la nueva contraseña.'; return }
  if (newPassword.value !== newPasswordConfirm.value) { passwordError.value = 'Las contraseñas no coinciden.'; return }
  savingPassword.value = true
  try {
    await setPassword(passwordTarget.value.id, newPassword.value)
    showToast('Contraseña actualizada', 'success')
    showPasswordModal.value = false
  } catch (e) {
    passwordError.value = e.message
  } finally {
    savingPassword.value = false
  }
}

// ── Toggle activo ───────────────────────────────────────────────────────────

async function handleToggleActivo(user) {
  try {
    await toggleActivo(user.id, !user.is_active)
    showToast(user.is_active ? 'Usuario desactivado' : 'Usuario activado', 'success')
  } catch (e) {
    showToast(e.message, 'error')
  }
}
</script>

<template>
  <section class="usuarios-view">
    <StepInfoCard
      title="Gestión de usuarios"
      description="Crea y administra los operadores del sistema. Solo los administradores pueden acceder a esta sección."
      variant="blue"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </template>
    </StepInfoCard>

    <div class="usuarios-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Operadores del sistema</h3>
          <p class="card-desc">Lista de todos los usuarios registrados.</p>
        </div>
        <button type="button" class="btn btn--primary" @click="openCreate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Nuevo usuario
        </button>
      </div>

      <div v-if="loading" class="empty-msg">Cargando usuarios…</div>

      <table v-else class="users-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" :class="{ 'row--inactive': !user.is_active }">
            <td class="cell-username">{{ user.username }}</td>
            <td>{{ [user.first_name, user.last_name].filter(Boolean).join(' ') || '—' }}</td>
            <td>{{ user.email || '—' }}</td>
            <td>
              <span class="badge" :class="user.is_staff ? 'badge--admin' : 'badge--operator'">
                {{ user.is_staff ? 'Admin' : 'Operador' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="user.is_active ? 'badge--active' : 'badge--inactive'">
                {{ user.is_active ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button type="button" class="btn-icon" title="Editar" @click="openEdit(user)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                </button>
                <button type="button" class="btn-icon" title="Cambiar contraseña" @click="openPasswordModal(user)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="btn-icon"
                  :title="user.is_active ? 'Desactivar' : 'Activar'"
                  :class="user.is_active ? 'btn-icon--danger' : 'btn-icon--success'"
                  @click="handleToggleActivo(user)"
                >
                  <svg v-if="user.is_active" viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                    <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11A6 6 0 0114.89 13.476zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
                  </svg>
                  <svg v-else viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="6" class="empty-row">No hay usuarios registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Modal crear / editar ─────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
        <div class="modal">
          <div class="modal__header">
            <h3 class="modal__title">{{ modalMode === 'create' ? 'Nuevo usuario' : 'Editar usuario' }}</h3>
            <button type="button" class="modal__close" @click="closeModal">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>

          <form class="modal__body" @submit.prevent="submitForm">
            <div class="form-row">
              <div class="form-field">
                <label class="form-label">Usuario *</label>
                <input v-model="form.username" type="text" class="input" autocomplete="off" />
              </div>
              <div class="form-field">
                <label class="form-label">Email</label>
                <input v-model="form.email" type="email" class="input" autocomplete="off" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label class="form-label">Nombre</label>
                <input v-model="form.first_name" type="text" class="input" />
              </div>
              <div class="form-field">
                <label class="form-label">Apellido</label>
                <input v-model="form.last_name" type="text" class="input" />
              </div>
            </div>

            <template v-if="modalMode === 'create'">
              <div class="form-row">
                <div class="form-field">
                  <label class="form-label">Contraseña *</label>
                  <input v-model="form.password" type="password" class="input" autocomplete="new-password" />
                </div>
                <div class="form-field">
                  <label class="form-label">Confirmar contraseña *</label>
                  <input v-model="form.passwordConfirm" type="password" class="input" autocomplete="new-password" />
                </div>
              </div>
            </template>

            <div class="form-check">
              <label class="check-label">
                <input v-model="form.is_staff" type="checkbox" class="check-input" />
                Administrador (acceso a gestión de usuarios)
              </label>
            </div>

            <div v-if="formError" class="form-error">{{ formError }}</div>

            <div class="modal__footer">
              <button type="button" class="btn btn--ghost" @click="closeModal">Cancelar</button>
              <button type="submit" class="btn btn--primary" :disabled="saving">
                {{ saving ? 'Guardando…' : modalMode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal cambiar contraseña ─────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="modal-backdrop" @click.self="showPasswordModal = false">
        <div class="modal modal--sm">
          <div class="modal__header">
            <h3 class="modal__title">Cambiar contraseña</h3>
            <button type="button" class="modal__close" @click="showPasswordModal = false">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
          <form class="modal__body" @submit.prevent="submitPassword">
            <p class="modal-desc">Cambiando contraseña de <strong>{{ passwordTarget?.username }}</strong></p>
            <div class="form-field">
              <label class="form-label">Nueva contraseña</label>
              <input v-model="newPassword" type="password" class="input" autocomplete="new-password" />
            </div>
            <div class="form-field" style="margin-top: var(--space-3)">
              <label class="form-label">Confirmar contraseña</label>
              <input v-model="newPasswordConfirm" type="password" class="input" autocomplete="new-password" />
            </div>
            <div v-if="passwordError" class="form-error">{{ passwordError }}</div>
            <div class="modal__footer">
              <button type="button" class="btn btn--ghost" @click="showPasswordModal = false">Cancelar</button>
              <button type="submit" class="btn btn--primary" :disabled="savingPassword">
                {{ savingPassword ? 'Guardando…' : 'Cambiar contraseña' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.usuarios-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Card */
.usuarios-card {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}
.card-desc { font-size: 0.82rem; color: var(--slate-500); margin: 4px 0 0; }

/* Table */
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.users-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--slate-100);
}

.users-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--slate-100);
  color: var(--slate-700);
  vertical-align: middle;
}

.users-table tr:last-child td { border-bottom: none; }

.users-table tr:hover td { background: var(--slate-50); }

.row--inactive td { color: var(--slate-400); }

.cell-username { font-weight: 600; color: var(--slate-800); font-family: monospace; font-size: 0.88rem; }

.empty-msg {
  font-size: 0.85rem;
  color: var(--slate-400);
  text-align: center;
  padding: var(--space-5);
}

.empty-row {
  text-align: center;
  color: var(--slate-400);
  padding: var(--space-5) !important;
  font-style: italic;
}

/* Badges */
.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.badge--admin    { background: #ede9fe; color: #6d28d9; }
.badge--operator { background: var(--slate-100); color: var(--slate-600); }
.badge--active   { background: #dcfce7; color: #15803d; }
.badge--inactive { background: var(--slate-100); color: var(--slate-400); }

/* Action buttons */
.actions { display: flex; align-items: center; gap: var(--space-1); }

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: none;
  color: var(--slate-400);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-icon:hover { background: var(--slate-100); color: var(--slate-700); }
.btn-icon--danger:hover  { background: #fee2e2; color: #dc2626; }
.btn-icon--success:hover { background: #dcfce7; color: #16a34a; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-1); border: none; border-radius: var(--radius-md);
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all var(--transition-fast); padding: var(--space-2) var(--space-4);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--primary { background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-700) 100%); color: white; }
.btn--primary:hover:not(:disabled) { background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-600) 100%); }
.btn--ghost { background: transparent; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); border-color: var(--slate-300); }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 560px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}
.modal--sm { max-width: 400px; }

.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--slate-100);
}
.modal__title { font-size: 1rem; font-weight: 700; color: var(--slate-800); margin: 0; }
.modal__close {
  width: 28px; height: 28px; border: none; background: none;
  color: var(--slate-400); cursor: pointer; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.modal__close:hover { background: var(--slate-100); color: var(--slate-700); }

.modal__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

.modal__footer {
  display: flex; justify-content: flex-end; gap: var(--space-2);
  padding-top: var(--space-4); border-top: 1px solid var(--slate-100); margin-top: var(--space-2);
}

.modal-desc { font-size: 0.85rem; color: var(--slate-600); margin: 0; }

/* Form */
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-label { font-size: 0.78rem; font-weight: 600; color: var(--slate-700); }

.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: white;
  transition: border-color var(--transition-fast);
  font-family: inherit;
}
.input:focus { outline: none; border-color: var(--unap-blue-400); box-shadow: 0 0 0 3px rgba(0,82,163,0.08); }

.form-check { display: flex; }
.check-label {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: 0.85rem; color: var(--slate-700); cursor: pointer; user-select: none;
}
.check-input { width: 15px; height: 15px; cursor: pointer; accent-color: var(--unap-blue-600); }

.form-error {
  font-size: 0.82rem; color: #dc2626;
  background: #fee2e2; border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}
</style>
