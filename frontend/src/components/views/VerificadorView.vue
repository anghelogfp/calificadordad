<script setup>
import { ref, computed, reactive, nextTick } from 'vue'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildQuestionPlan } from '@/utils/helpers'
import { useVerificador } from '@/composables/useVerificador'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  ponderations: { type: Object, required: true },
  currentUser:  { type: String, default: '' },
})

const toast = useToast()
const verificador = useVerificador()

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
const subTab = ref('nueva') // 'nueva' | 'historial'

// ── Estado del formulario ─────────────────────────────────────────────────────
const selectedPlantillaId = ref(null)
const correctValue   = ref(10)
const incorrectValue = ref(0)
const blankValue     = ref(2)

const candidatoProceso  = ref('')
const candidatoDni      = ref('')
const candidatoNombre   = ref('')
const candidatoArea     = ref('')
const candidatoPrograma = ref('')
const candidatoAula     = ref('')
const candidatoPosicion = ref('')
const candidatoTipo     = ref('')

// Arrays de 60 celdas (strings 'A'-'E' o '')
const correctCells = reactive(Array(60).fill(''))
const answerCells  = reactive(Array(60).fill(''))

// Template refs para los inputs
const correctRefs = ref([])
const answerRefs  = ref([])

// ID de sesión activa (para edición)
const editingId = ref(null)

// ── Plantilla seleccionada ────────────────────────────────────────────────────
const plantillasList = computed(() => props.ponderations.plantillas?.value ?? [])

const selectedPlantilla = computed(() =>
  plantillasList.value.find(p => p.id === selectedPlantillaId.value) ?? null
)

const questionPlan = computed(() =>
  selectedPlantilla.value
    ? buildQuestionPlan(selectedPlantilla.value.items || [])
    : Array(60).fill({ subject: '', weight: 0 })
)

const totalQuestions = computed(() => questionPlan.value.length || 60)

// ── Cálculo reactivo pregunta × pregunta ──────────────────────────────────────
const rows = computed(() => {
  const plan = questionPlan.value
  const corrVal   = Number(correctValue.value)   || 0
  const incorrVal = Number(incorrectValue.value) || 0
  const blkVal    = Number(blankValue.value)     || 0

  let acum = 0
  return plan.map((item, i) => {
    const marked  = normalizeCell(answerCells[i])
    const correct = normalizeCell(correctCells[i])
    const weight  = Number(item.weight) || 0

    const isCorrectValid = /^[A-E]$/.test(correct)
    const isMarkedValid  = /^[A-E]$/.test(marked)

    let status, pts
    if (isCorrectValid && isMarkedValid && marked === correct) {
      status = 'correct'
      pts    = Math.round(corrVal * weight * 100) / 100
    } else if (isMarkedValid) {
      status = 'incorrect'
      pts    = Math.round(incorrVal * weight * 100) / 100
    } else {
      status = 'blank'
      pts    = Math.round(blkVal * weight * 100) / 100
    }

    acum = Math.round((acum + pts) * 100) / 100

    // Para display: mostrar tal como lo ingresó (número o letra)
    const rawMarked  = (answerCells[i]  || '').toUpperCase()
    const rawCorrect = (correctCells[i] || '').toUpperCase()

    return {
      n: i + 1,
      subject: item.subject || '',
      marked:  isMarkedValid  ? rawMarked  : '—',
      correct: isCorrectValid ? rawCorrect : '?',
      weight,
      status,
      pts,
      acum,
    }
  })
})

const stats = computed(() => {
  let correctCount = 0, incorrectCount = 0, blankCount = 0
  rows.value.forEach(r => {
    if (r.status === 'correct')        correctCount++
    else if (r.status === 'incorrect') incorrectCount++
    else                               blankCount++
  })
  const score = rows.value.length ? rows.value[rows.value.length - 1].acum : 0
  return { correctCount, incorrectCount, blankCount, score }
})

// Mostrar tabla solo si hay al menos una respuesta ingresada (A-E o 1-5)
const hasAnyAnswer = computed(() =>
  answerCells.some(c => !!KEY_MAP[c?.toUpperCase()]) ||
  correctCells.some(c => !!KEY_MAP[c?.toUpperCase()])
)

// ── Mapa de normalización: 1-5 → A-E, A-E → A-E (solo para cálculo/guardado) ─
const KEY_MAP = { '1':'A','2':'B','3':'C','4':'D','5':'E','A':'A','B':'B','C':'C','D':'D','E':'E' }

function normalizeCell(c) {
  return KEY_MAP[(c || '').toUpperCase()] || ''
}

function setCell(index, gridType, val) {
  // Guarda el carácter tal como lo ingresó el usuario (letra o número)
  if (gridType === 'correct') correctCells[index] = val
  else                        answerCells[index]  = val
}

// ── Navegación de celdas ──────────────────────────────────────────────────────
// handleCellInput solo cubre paste; la lógica principal va en keydown
function handleCellInput(e, index, gridType) {
  const raw = e.target.value.toUpperCase()
  let stored = ''
  for (const ch of raw) {
    if (KEY_MAP[ch]) { stored = ch; break }
  }
  setCell(index, gridType, stored)
  e.target.value = stored
  if (stored && index < totalQuestions.value - 1) {
    nextTick(() => {
      const refs = gridType === 'correct' ? correctRefs.value : answerRefs.value
      refs[index + 1]?.focus()
    })
  }
}

function handleCellKeydown(e, index, gridType) {
  const refs = gridType === 'correct' ? correctRefs.value : answerRefs.value
  const key  = e.key.toUpperCase()

  // Tecla válida (A-E o 1-5): guarda raw, sobreescribe, avanza
  if (KEY_MAP[key]) {
    e.preventDefault()
    setCell(index, gridType, key)
    e.target.value = key
    if (index < totalQuestions.value - 1) {
      nextTick(() => refs[index + 1]?.focus())
    }
    return
  }

  if (e.key === 'Backspace') {
    e.preventDefault()
    setCell(index, gridType, '')
    e.target.value = ''
    if (index > 0) nextTick(() => refs[index - 1]?.focus())
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    setCell(index, gridType, '')
    e.target.value = ''
    return
  }
  if (e.key === 'ArrowRight' && index < totalQuestions.value - 1) {
    e.preventDefault(); refs[index + 1]?.focus()
  }
  if (e.key === 'ArrowLeft' && index > 0) {
    e.preventDefault(); refs[index - 1]?.focus()
  }
  if (e.key === 'ArrowDown' && index + 10 < totalQuestions.value) {
    e.preventDefault(); refs[index + 10]?.focus()
  }
  if (e.key === 'ArrowUp' && index - 10 >= 0) {
    e.preventDefault(); refs[index - 10]?.focus()
  }
}

// ── Acciones ──────────────────────────────────────────────────────────────────
function limpiar() {
  for (let i = 0; i < 60; i++) {
    correctCells[i] = ''
    answerCells[i]  = ''
  }
  candidatoProceso.value  = ''
  candidatoDni.value      = ''
  candidatoNombre.value   = ''
  candidatoArea.value     = ''
  candidatoPrograma.value = ''
  candidatoAula.value     = ''
  candidatoPosicion.value = ''
  candidatoTipo.value     = ''
  editingId.value = null
}

async function guardar() {
  if (!selectedPlantilla.value) {
    toast.showToast('Selecciona una plantilla antes de guardar', 'warning')
    return
  }

  const payload = {
    plantilla_id:       selectedPlantilla.value.id,
    plantilla_name:     selectedPlantilla.value.name,
    plantilla_snapshot: selectedPlantilla.value.items || [],
    proceso:    candidatoProceso.value.trim(),
    dni:        candidatoDni.value.trim(),
    nombre:     candidatoNombre.value.trim(),
    area:       candidatoArea.value.trim(),
    programa:   candidatoPrograma.value.trim(),
    aula:       candidatoAula.value.trim(),
    posicion:   candidatoPosicion.value.trim(),
    tipo_prueba: candidatoTipo.value.trim(),
    answers:         answerCells.map(normalizeCell).join('').slice(0, 60),
    correct_answers: correctCells.map(normalizeCell).join('').slice(0, 60),
    correct_value:   Number(correctValue.value),
    incorrect_value: Number(incorrectValue.value),
    blank_value:     Number(blankValue.value),
    score: stats.value.score,
  }

  let result
  if (editingId.value) {
    result = await verificador.updateSesion(editingId.value, payload)
  } else {
    result = await verificador.saveSesion(payload)
  }

  if (result) {
    editingId.value = result.id
    toast.showToast('Verificación guardada', 'success')
  } else {
    toast.showToast('Error al guardar', 'error')
  }
}

function cargarSesion(sesion) {
  selectedPlantillaId.value = sesion.plantilla_id

  // Rellenar las celdas desde los strings
  const ans = (sesion.answers || '').padEnd(60, ' ')
  const cor = (sesion.correct_answers || '').padEnd(60, ' ')
  for (let i = 0; i < 60; i++) {
    answerCells[i]  = /^[A-E]$/.test(ans[i]) ? ans[i] : ''
    correctCells[i] = /^[A-E]$/.test(cor[i]) ? cor[i] : ''
  }

  candidatoProceso.value  = sesion.proceso || ''
  candidatoDni.value      = sesion.dni || ''
  candidatoNombre.value   = sesion.nombre || ''
  candidatoArea.value     = sesion.area || ''
  candidatoPrograma.value = sesion.programa || ''
  candidatoAula.value     = sesion.aula || ''
  candidatoPosicion.value = sesion.posicion || ''
  candidatoTipo.value     = sesion.tipo_prueba || ''
  correctValue.value      = Number(sesion.correct_value)
  incorrectValue.value    = Number(sesion.incorrect_value)
  blankValue.value        = Number(sesion.blank_value)
  editingId.value         = sesion.id

  subTab.value = 'nueva'
}

async function eliminarSesion(id) {
  await verificador.deleteSesion(id)
  if (editingId.value === id) {
    editingId.value = null
  }
  toast.showToast('Sesión eliminada', 'success')
}

function abrirHistorial() {
  subTab.value = 'historial'
  verificador.fetchSesiones()
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function abbrevCurso(name) {
  if (!name) return '—'
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return words.map(w => w[0].toUpperCase()).join('.')
  return name.slice(0, 3).toUpperCase()
}

async function _loadLogo() {
  try {
    const res = await fetch('/unap.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function exportPdf() {
  if (!hasAnyAnswer.value) {
    toast.showToast('Ingresa respuestas antes de exportar', 'warning')
    return
  }

  const { correctCount, incorrectCount, blankCount, score } = stats.value
  const logoBase64 = await _loadLogo()
  const allRows    = rows.value

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 210
  const pageH = doc.internal.pageSize.getHeight()  // 297

  // ── 1. Encabezado institucional ───────────────────────────────────────────────
  const HDR_H = 28
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageW, HDR_H, 'F')

  if (logoBase64) doc.addImage(logoBase64, 'PNG', 7, 3, 20, 20)
  const txtX = logoBase64 ? pageW / 2 + 5 : pageW / 2

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO DE PUNO', txtX, 8, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text('DIRECCIÓN DE ADMISIÓN', txtX, 14, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(selectedPlantilla.value?.name || 'VERIFICACIÓN DE RESPUESTAS', txtX, 20, { align: 'center' })
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  const hdrSub = candidatoProceso.value.trim()
    ? candidatoProceso.value.trim().toUpperCase()
    : 'VERIFICADOR MANUAL DE RESPUESTAS'
  doc.text(hdrSub, txtX, 25.5, { align: 'center' })

  // ── 2. Card candidato ─────────────────────────────────────────────────────────
  const CAND_Y = HDR_H + 3
  const CAND_H = 38          // compacto: proceso inline, todo en 38mm
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.rect(10, CAND_Y, pageW - 20, CAND_H, 'FD')
  // Franja lateral izquierda
  doc.setFillColor(30, 41, 59)
  doc.rect(10, CAND_Y, 3, CAND_H, 'F')

  // Proceso — línea pequeña encima del nombre
  const procesoStr = candidatoProceso.value.trim()
  if (procesoStr) {
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 58, 138)
    doc.text(procesoStr.toUpperCase(), 17, CAND_Y + 5)
  }

  // Nombre
  const nombre = candidatoNombre.value.trim() || 'Sin nombre'
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(nombre.toUpperCase(), 17, CAND_Y + (procesoStr ? 11 : 8))

  // Sublinea: área · programa
  const subLine = [candidatoArea.value.trim(), candidatoPrograma.value.trim()].filter(Boolean).join(' · ')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(subLine || '—', 17, CAND_Y + (procesoStr ? 17 : 14))

  // Cuadro puntaje — borde ámbar (más compacto)
  const scoreStr  = score.toFixed(3)
  const scoreBoxW = 34
  const scoreBoxH = 22
  const scoreBoxX = pageW - 13 - scoreBoxW
  const scoreBoxY = CAND_Y + 2
  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(0.8)
  doc.roundedRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 2, 2, 'D')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('PUNTAJE', scoreBoxX + scoreBoxW / 2, scoreBoxY + 7, { align: 'center' })
  doc.setFontSize(14)
  doc.setTextColor(120, 53, 15)
  doc.text(scoreStr, scoreBoxX + scoreBoxW / 2, scoreBoxY + 17, { align: 'center' })

  // Separador
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(17, CAND_Y + 22, scoreBoxX - 3, CAND_Y + 22)

  // Campos en fila: DNI · Aula · Posición · Tipo
  const fieldDefs = [
    ['DNI',      candidatoDni.value      || '—'],
    ['Aula',     candidatoAula.value     || '—'],
    ['Posición', candidatoPosicion.value || '—'],
    ['Tipo',     candidatoTipo.value     || '—'],
  ]
  const fieldColW = (scoreBoxX - 3 - 17) / fieldDefs.length
  fieldDefs.forEach(([label, val], i) => {
    const fx = 17 + i * fieldColW
    const fy = CAND_Y + 25
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), fx, fy)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), fx, fy + 5.5)
  })

  // ── 3. Barra de estadísticas (inline) ────────────────────────────────────────
  const STATS_Y = CAND_Y + CAND_H + 2
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.15)
  doc.rect(10, STATS_Y, pageW - 20, 9, 'FD')

  doc.setFontSize(7.5)
  const statPairs = [
    [`Correctas: `,   `${correctCount}`,          [21, 128, 61]],
    [`Incorrectas: `, `${incorrectCount}`,         [220, 38, 38]],
    [`En blanco: `,   `${blankCount}`,             [100, 116, 139]],
    [`C×`,            `${correctValue.value}`,     [30, 41, 59]],
    [`I×`,            `${incorrectValue.value}`,   [30, 41, 59]],
    [`B×`,            `${blankValue.value}`,       [30, 41, 59]],
    [`Plantilla: `,   selectedPlantilla.value?.name || '—', [30, 58, 138]],
  ]
  let sx = 14
  statPairs.forEach(([label, val, rgb]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(label, sx, STATS_Y + 6)
    sx += doc.getTextWidth(label)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...rgb)
    doc.text(val, sx, STATS_Y + 6)
    sx += doc.getTextWidth(val) + 5
  })

  // ── 4. Tablas dos columnas ────────────────────────────────────────────────────
  const TABLE_Y = STATS_Y + 12
  const GAP     = 5
  const halfW   = (pageW - 20 - GAP) / 2   // 92.5 mm por tabla

  // N°(8) Curso(18) Marc(11) Corr(11) Pond(12) Pts(14) Acum(18.5) = 92.5
  const CW = { 0: 8, 1: 18, 2: 11, 3: 11, 4: 12, 5: 14, 6: 18.5 }
  const HEAD = [['N°', 'Curso', 'Marc.', 'Corr.', 'Pond.', 'Pts', 'Acum.']]

  function buildBody(halfRows) {
    return halfRows.map(r => [
      r.n,
      abbrevCurso(r.subject),
      r.status === 'blank' ? '—' : (KEY_MAP[r.marked] || r.marked),
      KEY_MAP[r.correct] || r.correct,
      `×${Number(r.weight).toFixed(3)}`,
      r.status === 'incorrect' ? '0.000' : r.pts.toFixed(3),
      r.acum.toFixed(3),
    ])
  }

  function makeDidParseCell(halfRows, isLastTable) {
    return function(data) {
      if (data.section !== 'body') return
      const row = halfRows[data.row.index]
      if (!row) return
      const col    = data.column.index
      const isLast = data.row.index === halfRows.length - 1

      // Fondo suave por status de fila
      if (row.status === 'correct')   data.cell.styles.fillColor = [240, 253, 244]
      if (row.status === 'incorrect') data.cell.styles.fillColor = [255, 245, 245]

      // Marc. — coloreado según resultado
      if (col === 2) {
        data.cell.styles.fontStyle = 'bold'
        if (row.status === 'correct')   data.cell.styles.textColor = [21, 128, 61]
        if (row.status === 'incorrect') data.cell.styles.textColor = [220, 38, 38]
        if (row.status === 'blank')     data.cell.styles.textColor = [148, 163, 184]
      }
      // Corr. — siempre azul
      if (col === 3) {
        data.cell.styles.textColor = [29, 78, 216]
        data.cell.styles.fontStyle = 'bold'
      }
      // Pts — verde si correcta
      if (col === 5 && row.status === 'correct') {
        data.cell.styles.textColor = [21, 128, 61]
      }
      // Último acumulado — solo en la tabla derecha (pregunta final de todo)
      if (isLastTable && col === 6 && isLast) {
        data.cell.styles.fillColor = [254, 249, 195]
        data.cell.styles.textColor = [146, 64, 14]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  }

  const half      = Math.ceil(allRows.length / 2)
  const leftRows  = allRows.slice(0, half)
  const rightRows = allRows.slice(half)

  const sharedCfg = (halfRows, marginLeft, marginRight, isLastTable) => ({
    startY: TABLE_Y,
    margin: { left: marginLeft, right: marginRight },
    head: HEAD,
    body: buildBody(halfRows),
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      halign: 'center',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: CW[0] },
      1: { cellWidth: CW[1], halign: 'left', fontSize: 7.5, overflow: 'ellipsize' },
      2: { cellWidth: CW[2] },
      3: { cellWidth: CW[3] },
      4: { cellWidth: CW[4], fontSize: 7 },
      5: { cellWidth: CW[5] },
      6: { cellWidth: CW[6], fontStyle: 'bold' },
    },
    headStyles: {
      fillColor: [30, 41, 59], textColor: 255,
      fontStyle: 'bold', fontSize: 7.5, cellPadding: 2,
    },
    didParseCell: makeDidParseCell(halfRows, isLastTable),
  })

  autoTable(doc, sharedCfg(leftRows,  10,              10 + halfW + GAP, false))
  autoTable(doc, sharedCfg(rightRows, 10 + halfW + GAP, 10,              true))

  // ── 5. Footer ─────────────────────────────────────────────────────────────────
  const now   = new Date()
  const fecha = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Generado: ${fecha}  ${hora}` + (props.currentUser ? `   ·   ${props.currentUser}` : ''),
    14, pageH - 5
  )
  doc.text('Pág. 1 / 1', pageW - 12, pageH - 5, { align: 'right' })

  const safe = (candidatoDni.value || 'verificador').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  doc.save(`verificador-${safe}-${fecha.replace(/\//g, '')}.pdf`)
}

// ── Formatear fecha ───────────────────────────────────────────────────────────
function formatFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="verificador">
    <!-- Encabezado -->
    <div class="verificador__header">
      <div class="verificador__title-row">
        <h2 class="verificador__title">Verificador de Respuestas</h2>
        <p class="verificador__subtitle">Verifica respuestas de candidatos puntuales sin necesidad de cargar archivos</p>
      </div>
      <div class="verificador__tabs">
        <button
          type="button"
          class="vtab"
          :class="{ 'vtab--active': subTab === 'nueva' }"
          @click="subTab = 'nueva'"
        >Nueva verificación</button>
        <button
          type="button"
          class="vtab"
          :class="{ 'vtab--active': subTab === 'historial' }"
          @click="abrirHistorial"
        >
          Historial
          <span v-if="verificador.sesiones.value.length" class="vtab__badge">
            {{ verificador.sesiones.value.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- ══ SUB-TAB: NUEVA VERIFICACIÓN ══════════════════════════════════════════ -->
    <div v-if="subTab === 'nueva'" class="verificador__body">

      <!-- Config row -->
      <div class="vcard">
        <div class="vcard__title">Configuración</div>
        <div class="config-row">
          <!-- Plantilla -->
          <div class="config-field config-field--wide">
            <label class="config-label">Plantilla de Ponderaciones</label>
            <select v-model.number="selectedPlantillaId" class="config-select">
              <option :value="null">Sin Plantilla</option>
              <option v-for="p in plantillasList" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.area ? ` : ${p.area}` : '' }}
              </option>
            </select>
          </div>

          <!-- Valores de puntuación -->
          <div class="config-field">
            <label class="config-label">Correcta ×</label>
            <input v-model.number="correctValue" type="number" step="0.1" min="0" class="config-input" />
          </div>
          <div class="config-field">
            <label class="config-label">Incorrecta ×</label>
            <input v-model.number="incorrectValue" type="number" step="0.1" class="config-input" />
          </div>
          <div class="config-field">
            <label class="config-label">Blanco ×</label>
            <input v-model.number="blankValue" type="number" step="0.1" class="config-input" />
          </div>
        </div>

        <!-- Datos candidato -->
        <div class="candidate-fields">
          <!-- Fila 1: Proceso + Tipo de prueba -->
          <div class="candidate-row candidate-row--top">
            <div class="cfield cfield--proceso">
              <label class="cfield__label">Proceso / Convocatoria</label>
              <input v-model="candidatoProceso" type="text" placeholder="Ej: CEPREUNA 2026 - I" class="cfield__input" />
            </div>
            <div class="cfield cfield--tipo">
              <label class="cfield__label">Tipo de prueba</label>
              <input v-model="candidatoTipo" type="text" maxlength="10" placeholder="Ej: P, Q, R, S o T" class="cfield__input cfield__input--center" />
            </div>
          </div>

          <!-- Fila 2: Nombre + DNI + Aula -->
          <div class="candidate-row candidate-row--mid">
            <div class="cfield cfield--nombre">
              <label class="cfield__label">Nombre completo</label>
              <input v-model="candidatoNombre" type="text" placeholder="Apellidos y Nombres" class="cfield__input" />
            </div>
            <div class="cfield cfield--dni">
              <label class="cfield__label">DNI</label>
              <input v-model="candidatoDni" type="text" maxlength="12" placeholder="12345678" class="cfield__input cfield__input--center" />
            </div>
            <div class="cfield cfield--aula">
              <label class="cfield__label">Aula</label>
              <input v-model="candidatoAula" type="text" maxlength="20" placeholder="Ej: 301" class="cfield__input cfield__input--center" />
            </div>
          </div>

          <!-- Fila 3: Área + Programa + Posición -->
          <div class="candidate-row candidate-row--bot">
            <div class="cfield cfield--area">
              <label class="cfield__label">Área</label>
              <input v-model="candidatoArea" type="text" placeholder="Ej: Biomédicas" class="cfield__input" />
            </div>
            <div class="cfield cfield--programa">
              <label class="cfield__label">Programa de estudios</label>
              <input v-model="candidatoPrograma" type="text" placeholder="Ej: Medicina Humana" class="cfield__input" />
            </div>
            <div class="cfield cfield--posicion">
              <label class="cfield__label">Posición</label>
              <input v-model="candidatoPosicion" type="text" maxlength="10" placeholder="Ej: 42" class="cfield__input cfield__input--center" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grids de respuestas -->
      <div class="grids-row">
        <!-- Grid respuestas correctas -->
        <div class="vcard vcard--grid">
          <div class="vcard__title vcard__title--correct">Respuestas Correctas</div>
          <div class="answer-grid">
            <div
              v-for="i in totalQuestions"
              :key="`c-${i}`"
              class="cell-wrapper"
              :class="`cell-wrapper--${rows[i-1]?.status ?? 'blank'}`"
            >
              <span class="cell-num">{{ i }}</span>
              <input
                :ref="el => { if (el) correctRefs[i-1] = el }"
                :value="correctCells[i-1]"
                type="text"
                maxlength="1"
                class="cell-input cell-input--correct"
                autocomplete="off"
                @input="e => handleCellInput(e, i-1, 'correct')"
                @keydown="e => handleCellKeydown(e, i-1, 'correct')"
              />
            </div>
          </div>
        </div>

        <!-- Grid respuestas candidato -->
        <div class="vcard vcard--grid">
          <div class="vcard__title vcard__title--answer">Respuestas del Postulante</div>
          <div class="answer-grid">
            <div
              v-for="i in totalQuestions"
              :key="`a-${i}`"
              class="cell-wrapper"
              :class="`cell-wrapper--${rows[i-1]?.status ?? 'blank'}`"
            >
              <span class="cell-num">{{ i }}</span>
              <input
                :ref="el => { if (el) answerRefs[i-1] = el }"
                :value="answerCells[i-1]"
                type="text"
                maxlength="1"
                class="cell-input"
                :class="`cell-input--${rows[i-1]?.status ?? 'blank'}`"
                autocomplete="off"
                @input="e => handleCellInput(e, i-1, 'answer')"
                @keydown="e => handleCellKeydown(e, i-1, 'answer')"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Resultado -->
      <div v-if="hasAnyAnswer" class="vcard">
        <!-- Stats bar -->
        <div class="stats-bar">
          <div class="stat stat--correct">
            <span class="stat__val">{{ stats.correctCount }}</span>
            <span class="stat__label">Correctas</span>
          </div>
          <div class="stat stat--incorrect">
            <span class="stat__val">{{ stats.incorrectCount }}</span>
            <span class="stat__label">Incorrectas</span>
          </div>
          <div class="stat stat--blank">
            <span class="stat__val">{{ stats.blankCount }}</span>
            <span class="stat__label">En blanco</span>
          </div>
          <div class="stat-divider" />
          <div class="stat">
            <span class="stat__val stat__val--score">{{ stats.score.toFixed(3) }}</span>
            <span class="stat__label">Puntaje total</span>
          </div>
          <div class="stat-multipliers">
            <span>Correcta <strong>×{{ correctValue }}</strong></span>
            <span>Incorrecta <strong>×{{ incorrectValue }}</strong></span>
            <span>Blanco <strong>×{{ blankValue }}</strong></span>
          </div>
        </div>

        <!-- Tabla detalle -->
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Curso</th>
                <th>Marc.</th>
                <th>Corr.</th>
                <th>Pond.</th>
                <th>Pts</th>
                <th>Acum.</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.n"
                :class="['detail-row', `detail-row--${row.status}`, { 'detail-row--last': row.n === rows.length }]"
              >
                <td class="cell-n">{{ row.n }}</td>
                <td class="cell-subject">{{ row.subject || '—' }}</td>
                <td class="cell-marked" :class="`marked--${row.status}`">{{ row.marked }}</td>
                <td class="cell-correct">{{ row.correct }}</td>
                <td class="cell-weight">{{ row.weight.toFixed(3) }}</td>
                <td class="cell-pts">{{ row.pts.toFixed(3) }}</td>
                <td class="cell-acum">{{ row.acum.toFixed(3) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Acciones -->
      <div class="actions-bar">
        <button type="button" class="btn btn--ghost" @click="limpiar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Limpiar
        </button>
        <div class="actions-right">
          <button
            type="button"
            class="btn btn--outline"
            :disabled="!hasAnyAnswer"
            @click="exportPdf"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Exportar PDF
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="verificador.saving.value"
            @click="guardar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {{ editingId ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ SUB-TAB: HISTORIAL ════════════════════════════════════════════════════ -->
    <div v-else class="verificador__body">
      <div v-if="verificador.loading.value" class="empty-state">
        Cargando historial...
      </div>
      <div v-else-if="!verificador.sesiones.value.length" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3" stroke-linecap="round"/></svg>
        <p>No hay verificaciones guardadas</p>
      </div>
      <div v-else class="history-list">
        <div
          v-for="s in verificador.sesiones.value"
          :key="s.id"
          class="history-item"
          :class="{ 'history-item--active': editingId === s.id }"
        >
          <div class="history-item__info">
            <div class="history-item__top">
              <span class="history-item__plantilla">{{ s.plantilla_name || 'Sin plantilla' }}</span>
              <span class="history-item__score">{{ Number(s.score).toFixed(3) }} pts</span>
            </div>
            <div v-if="s.proceso" class="history-item__proceso">{{ s.proceso }}</div>
            <div class="history-item__mid">
              <span v-if="s.nombre" class="history-item__nombre">{{ s.nombre }}</span>
              <span v-if="s.dni" class="history-item__dni">DNI: {{ s.dni }}</span>
            </div>
            <div class="history-item__tags">
              <span v-if="s.area" class="htag htag--area">{{ s.area }}</span>
              <span v-if="s.aula" class="htag">Aula {{ s.aula }}</span>
              <span v-if="s.posicion" class="htag">Pos. {{ s.posicion }}</span>
              <span v-if="s.tipo_prueba" class="htag htag--tipo">Tipo {{ s.tipo_prueba }}</span>
            </div>
            <div class="history-item__date">{{ formatFecha(s.created_at) }}</div>
          </div>
          <div class="history-item__actions">
            <button type="button" class="btn-icon btn-icon--load" title="Cargar" @click="cargarSesion(s)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="btn-icon btn-icon--delete" title="Eliminar" @click="eliminarSesion(s.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verificador {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.verificador__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.verificador__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--slate-900);
  margin: 0 0 var(--space-1);
}

.verificador__subtitle {
  font-size: 0.82rem;
  color: var(--slate-500);
  margin: 0;
}

.verificador__tabs {
  display: flex;
  gap: var(--space-1);
  background: var(--slate-100);
  border-radius: var(--radius-md);
  padding: 3px;
}

.vtab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: none;
  cursor: pointer;
  font-size: 0.83rem;
  font-weight: 500;
  color: var(--slate-600);
  transition: all 0.15s;
  white-space: nowrap;
}
.vtab--active {
  background: white;
  color: var(--unap-blue-700);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.vtab__badge {
  background: var(--unap-gold-500);
  color: var(--unap-blue-900);
  border-radius: var(--radius-full);
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

/* ── Body ───────────────────────────────────────────────────────────────────── */
.verificador__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Cards ──────────────────────────────────────────────────────────────────── */
.vcard {
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.vcard--grid { padding: var(--space-4); }

.vcard__title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--slate-500);
  margin-bottom: var(--space-3);
}
.vcard__title--correct { color: #15803d; }
.vcard__title--answer  { color: var(--unap-blue-700); }

/* ── Config (plantilla + valores) ────────────────────────────────────────────── */
.config-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}

.config-field { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
.config-field--wide { flex: 1; min-width: 160px; }

.config-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.config-select,
.config-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--slate-800);
  background: white;
  transition: border-color 0.15s;
}
.config-select:focus,
.config-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.config-input { width: 80px; }
.config-field--wide .config-input { width: 100%; }

/* ── Datos candidato ──────────────────────────────────────────────────────────── */
.candidate-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--slate-100);
}

.candidate-row {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

/* Fila 1: Proceso (3fr) + Tipo (1fr) */
.candidate-row--top { grid-template-columns: 3fr 1fr; }

/* Fila 2: Nombre (2fr) + DNI (1fr) + Aula (1fr) */
.candidate-row--mid { grid-template-columns: 2fr 1fr 1fr; }

/* Fila 3: Área (1fr) + Programa (2fr) + Posición (1fr) */
.candidate-row--bot { grid-template-columns: 1fr 2fr 1fr; }

.cfield {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cfield__label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.cfield__input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  color: var(--slate-800);
  background: white;
  transition: border-color 0.15s;
  font-family: inherit;
}
.cfield__input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.cfield__input--center { text-align: center; }

/* Proceso — highlight sutil */
.cfield--proceso .cfield__input {
  border-color: var(--unap-blue-200);
  background: var(--unap-blue-50);
}
.cfield--proceso .cfield__input:focus {
  border-color: var(--unap-blue-400);
  background: white;
}

/* ── Grids ──────────────────────────────────────────────────────────────────── */
.grids-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.answer-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
}

.cell-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cell-num {
  font-size: 0.6rem;
  color: var(--slate-400);
  line-height: 1;
}

.cell-input {
  width: 100%;
  aspect-ratio: 1;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid var(--slate-200);
  border-radius: 4px;
  background: var(--slate-50);
  color: var(--slate-700);
  cursor: text;
  transition: all 0.1s;
  caret-color: transparent;
}
.cell-input:focus {
  outline: none;
  border-color: var(--unap-blue-400);
  background: white;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}

/* Colores según status (solo en celdas de respuesta del candidato) */
.cell-input--correct   { background: #dcfce7; border-color: #86efac; color: #15803d; }
.cell-input--incorrect { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
.cell-input--blank     { background: var(--slate-50); }

/* La celda de claves correctas siempre neutral */
.cell-input--correct-grid { background: #eff6ff; border-color: #93c5fd; color: #1e40af; }

/* ── Stats bar ──────────────────────────────────────────────────────────────── */
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--slate-50);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.stat { display: flex; flex-direction: column; align-items: center; }
.stat__val { font-size: 1.1rem; font-weight: 700; color: var(--slate-800); }
.stat__val--score { color: #ca8a04; font-size: 1.3rem; }
.stat__label { font-size: 0.68rem; color: var(--slate-500); }
.stat--correct  .stat__val { color: #15803d; }
.stat--incorrect .stat__val { color: #dc2626; }
.stat--blank    .stat__val { color: var(--slate-500); }
.stat-divider { width: 1px; height: 30px; background: var(--slate-200); }
.stat-multipliers {
  margin-left: auto;
  display: flex;
  gap: var(--space-3);
  font-size: 0.75rem;
  color: var(--slate-500);
}

/* ── Tabla detalle ──────────────────────────────────────────────────────────── */
.detail-table-wrap {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.detail-table thead tr { background: var(--unap-blue-900); }
.detail-table th {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  color: white;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.detail-table td {
  padding: 5px var(--space-3);
  border-bottom: 1px solid var(--slate-100);
  white-space: nowrap;
  font-size: 0.88rem;
}
.detail-row:hover td { background: var(--slate-50); }

/* Última fila — solo el acumulado en dorado */
.detail-row--last .cell-acum {
  background: #fef3c7;
  color: #92400e;
  font-weight: 800;
  font-size: 1rem;
}

.cell-n       { color: var(--slate-400); font-size: 0.75rem; }
.cell-subject { color: var(--slate-600); }
.cell-correct { color: #2563eb; font-weight: 700; }
.cell-weight, .cell-pts, .cell-acum { font-family: monospace; color: var(--slate-700); }

.marked--correct   { color: #15803d; font-weight: 700; }
.marked--incorrect { color: #dc2626; font-weight: 700; }
.marked--blank     { color: var(--slate-400); }

/* ── Acciones ───────────────────────────────────────────────────────────────── */
.actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.actions-right { display: flex; gap: var(--space-2); }

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--ghost   { background: none; color: var(--slate-600); border: 1px solid var(--slate-200); }
.btn--ghost:hover { background: var(--slate-50); }
.btn--outline { background: white; color: var(--unap-blue-700); border: 1px solid var(--unap-blue-300); }
.btn--outline:hover:not(:disabled) { background: var(--unap-blue-50); }
.btn--primary { background: var(--unap-blue-600); color: white; }
.btn--primary:hover:not(:disabled) { background: var(--unap-blue-700); }

/* ── Historial ──────────────────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--slate-400);
  font-size: 0.9rem;
}
.empty-state svg { width: 48px; height: 48px; }

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  transition: all 0.15s;
}
.history-item--active {
  border-color: var(--unap-blue-300);
  background: var(--unap-blue-50);
}
.history-item:hover { border-color: var(--slate-300); }

.history-item__info { flex: 1; min-width: 0; }

.history-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 3px;
}
.history-item__plantilla {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--slate-800);
}
.history-item__score {
  font-size: 0.88rem;
  font-weight: 700;
  color: #ca8a04;
}
.history-item__proceso {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--unap-blue-600);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}
.history-item__mid {
  display: flex;
  gap: var(--space-3);
  font-size: 0.82rem;
  color: var(--slate-700);
  font-weight: 500;
  margin-bottom: 3px;
}
.history-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: 3px;
}
.htag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--slate-100);
  color: var(--slate-600);
}
.htag--area { background: var(--unap-blue-50); color: var(--unap-blue-700); }
.htag--tipo { background: #fef9c3; color: #854d0e; }
.history-item__date { font-size: 0.72rem; color: var(--slate-400); }

.history-item__actions { display: flex; gap: var(--space-2); }

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-icon svg { width: 15px; height: 15px; }
.btn-icon--load { color: var(--unap-blue-600); }
.btn-icon--load:hover { background: var(--unap-blue-50); border-color: var(--unap-blue-300); }
.btn-icon--delete { color: #dc2626; }
.btn-icon--delete:hover { background: #fee2e2; border-color: #fca5a5; }

@media (max-width: 900px) {
  .grids-row { grid-template-columns: 1fr; }
}
</style>
