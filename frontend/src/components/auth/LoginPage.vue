<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

const auth = useAuth()
const username = ref('')
const password = ref('')
const usernameInput = ref(null)
const showPassword = ref(false)

onMounted(() => usernameInput.value?.focus())

async function handleSubmit() {
  await auth.login(username.value, password.value)
}
</script>

<template>
  <div class="login-layout">

    <!-- Panel izquierdo — branding institucional -->
    <div class="login-brand">
      <div class="brand-content">
        <img src="/unap.png" alt="Logo UNAP" class="brand-logo" />
        <div class="brand-text">
          <h1>Universidad Nacional<br>del Altiplano</h1>
          <span class="brand-location">Puno — Perú</span>
        </div>
        <div class="brand-divider"></div>
        <p class="brand-desc">
          Sistema de Calificación de Exámenes de Admisión
        </p>
        <div class="brand-year">
          Dirección de Admisión · {{ new Date().getFullYear() }}
        </div>
      </div>

      <!-- Decoración de fondo -->
      <div class="brand-decoration">
        <div class="deco-circle deco-circle--1"></div>
        <div class="deco-circle deco-circle--2"></div>
        <div class="deco-circle deco-circle--3"></div>
      </div>
    </div>

    <!-- Panel derecho — formulario -->
    <div class="login-panel">
      <div class="login-card">

        <div class="card-header">
          <div class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit" novalidate>

          <div class="field">
            <label for="username">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
              </svg>
              Usuario
            </label>
            <input
              id="username"
              ref="usernameInput"
              v-model="username"
              type="text"
              class="input"
              placeholder="Nombre de usuario"
              autocomplete="username"
              required
            />
          </div>

          <div class="field">
            <label for="password">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
              </svg>
              Contraseña
            </label>
            <div class="input-group">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="input"
                placeholder="Contraseña"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="input-toggle"
                :title="showPassword ? 'Ocultar' : 'Mostrar'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                </svg>
                <svg v-else viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                </svg>
              </button>
            </div>
          </div>

          <transition name="slide-error">
            <div v-if="auth.error.value" class="alert-error">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              {{ auth.error.value }}
            </div>
          </transition>

          <button type="submit" class="btn-login" :disabled="auth.loading.value">
            <svg v-if="auth.loading.value" class="spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.3"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <svg v-else viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
              <path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
            </svg>
            {{ auth.loading.value ? 'Verificando...' : 'Ingresar al sistema' }}
          </button>
        </form>

        <div class="card-footer">
          <span>Acceso exclusivo para personal autorizado</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Layout de dos paneles ────────────────────────────────────────────────── */
.login-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ── Panel izquierdo — branding ───────────────────────────────────────────── */
.login-brand {
  background: linear-gradient(160deg, var(--unap-blue-900) 0%, var(--unap-blue-700) 60%, var(--unap-blue-800) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  position: relative;
  overflow: hidden;
}

.brand-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-5);
}

.brand-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.4));
  border-radius: var(--radius-xl);
}

.brand-text h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: white;
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin: 0;
}

.brand-location {
  display: block;
  font-size: 0.85rem;
  color: var(--unap-gold-300);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: var(--space-1);
}

.brand-divider {
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, var(--unap-gold-500), var(--unap-gold-300));
  border-radius: var(--radius-full);
}

.brand-desc {
  font-size: 1rem;
  color: var(--unap-blue-100);
  font-weight: 500;
  max-width: 280px;
  line-height: 1.5;
  margin: 0;
}

.brand-year {
  font-size: 0.8rem;
  color: var(--unap-blue-300);
  font-weight: 500;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-4);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.05);
}

/* Decoración de fondo */
.brand-decoration { position: absolute; inset: 0; }

.deco-circle {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
}

.deco-circle--1 {
  width: 500px; height: 500px;
  top: -150px; right: -150px;
}

.deco-circle--2 {
  width: 350px; height: 350px;
  bottom: -100px; left: -100px;
  border-color: rgba(212,175,55,0.08);
}

.deco-circle--3 {
  width: 200px; height: 200px;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  border-color: rgba(255,255,255,0.04);
}

/* ── Panel derecho — formulario ───────────────────────────────────────────── */
.login-panel {
  background: var(--slate-100);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.login-card {
  background: white;
  border-radius: var(--radius-xl);
  width: min(440px, 100%);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--slate-300);
  overflow: hidden;
  animation: scaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Encabezado de la card */
.card-header {
  background: linear-gradient(135deg, var(--unap-blue-800) 0%, var(--unap-blue-900) 100%);
  padding: var(--space-8) var(--space-8) var(--space-6);
  text-align: center;
  position: relative;
}

.card-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--unap-gold-600), var(--unap-gold-400), var(--unap-gold-600));
}

.card-icon {
  width: 52px;
  height: 52px;
  background: rgba(255,255,255,0.1);
  border: 1.5px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-4);
  backdrop-filter: blur(8px);
}

.card-icon svg {
  width: 26px;
  height: 26px;
  color: var(--unap-gold-300);
}

.card-header h2 {
  font-size: 1.375rem;
  font-weight: 700;
  color: white;
  margin: 0 0 var(--space-1);
  letter-spacing: -0.01em;
}

.card-header p {
  font-size: 0.85rem;
  color: var(--unap-blue-200);
  margin: 0;
}

/* Formulario */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-8);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--slate-600);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.field label svg {
  width: 13px;
  height: 13px;
  opacity: 0.6;
}

.input-group {
  position: relative;
}

.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1.5px solid var(--slate-300);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-family: var(--font-sans);
  background: var(--slate-50);
  color: var(--slate-900);
  transition: all var(--transition-fast);
}

.input-group .input {
  padding-right: 3rem;
}

.input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 3px rgba(0, 64, 128, 0.1);
}

.input::placeholder {
  color: var(--slate-400);
}

.input-toggle {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  color: var(--slate-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
}

.input-toggle svg { width: 16px; height: 16px; }
.input-toggle:hover { color: var(--unap-blue-500); }

/* Error */
.alert-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--error-50);
  border: 1px solid var(--error-100);
  border-left: 3px solid var(--error-500);
  border-radius: var(--radius-md);
  color: var(--error-600);
  font-size: 0.875rem;
  font-weight: 500;
}

.alert-error svg { width: 16px; height: 16px; flex-shrink: 0; }

/* Botón principal */
.btn-login {
  padding: var(--space-3) var(--space-5);
  background: linear-gradient(135deg, var(--unap-blue-600) 0%, var(--unap-blue-800) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: var(--font-sans);
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  box-shadow: 0 4px 14px rgba(0, 40, 85, 0.3);
}

.btn-login:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--unap-blue-500) 0%, var(--unap-blue-700) 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 40, 85, 0.4);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-icon { width: 16px; height: 16px; }

.spinner {
  width: 18px;
  height: 18px;
  animation: spin 0.75s linear infinite;
}

/* Footer */
.card-footer {
  padding: var(--space-4) var(--space-8);
  background: var(--slate-50);
  border-top: 1px solid var(--slate-200);
  text-align: center;
}

.card-footer span {
  font-size: 0.75rem;
  color: var(--slate-400);
  font-weight: 500;
  letter-spacing: 0.02em;
}

/* Animaciones */
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.slide-error-enter-active,
.slide-error-leave-active {
  transition: all 0.25s ease;
}
.slide-error-enter-from,
.slide-error-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .login-layout {
    grid-template-columns: 1fr;
  }

  .login-brand {
    padding: var(--space-8);
    min-height: 220px;
  }

  .brand-content { flex-direction: row; text-align: left; gap: var(--space-4); }
  .brand-logo { width: 70px; height: 70px; }
  .brand-text h1 { font-size: 1.2rem; }
  .brand-divider { display: none; }
  .brand-desc { display: none; }
  .brand-year { display: none; }
  .deco-circle { display: none; }

  .login-panel { padding: var(--space-5); }
}
</style>
