<script setup>
import { computed, ref } from 'vue'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildQuestionPlan } from '@/utils/helpers'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps({
  candidate: { type: Object, required: true },
  summary:   { type: Object, default: null },
  convocatoriaName: { type: String, default: '' },
  currentUser: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const modalRef = ref(null)
useFocusTrap(modalRef, ref(true))

// ── Plan de preguntas (materia + peso por índice) ─────────────────────────────
const questionPlan = computed(() =>
  buildQuestionPlan(props.summary?.plantillaSnapshot || [])
)

// ── Detalle pregunta × pregunta ───────────────────────────────────────────────
const rows = computed(() => {
  const plan = questionPlan.value
  const candidateAnswers = (props.candidate.answersRaw || '').toUpperCase()
  const correctAnswers   = (props.candidate.correctAnswersRaw || '').toUpperCase()
  const correctVal   = Number(props.summary?.correctValue ?? 10)
  const incorrectVal = Number(props.summary?.incorrectValue ?? 0)
  const blankVal     = Number(props.summary?.blankValue ?? 2)

  let acum = 0
  return plan.map((item, i) => {
    const marked  = candidateAnswers[i] || ' '
    const correct = correctAnswers[i]   || ' '
    const weight  = Number(item.weight) || 0

    const isCorrectKeyValid  = /^[A-E]$/.test(correct)
    const isMarkedValid      = /^[A-E]$/.test(marked)

    let status, pts
    if (isCorrectKeyValid && isMarkedValid && marked === correct) {
      status = 'correct'
      pts    = Math.round(correctVal * weight * 100) / 100
    } else if (isMarkedValid) {
      status = 'incorrect'
      pts    = Math.round(incorrectVal * weight * 100) / 100
    } else {
      status = 'blank'
      pts    = Math.round(blankVal * weight * 100) / 100
    }

    acum = Math.round((acum + pts) * 100) / 100

    return {
      n:       i + 1,
      subject: item.subject || '',
      marked:  isMarkedValid ? marked : '—',
      correct: isCorrectKeyValid ? correct : '?',
      weight,
      status,
      pts,
      acum,
    }
  })
})

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = computed(() => {
  let correctCount = 0, incorrectCount = 0, blankCount = 0
  rows.value.forEach(r => {
    if (r.status === 'correct')   correctCount++
    else if (r.status === 'incorrect') incorrectCount++
    else blankCount++
  })
  return { correctCount, incorrectCount, blankCount }
})

// ── Fecha/hora de consulta ────────────────────────────────────────────────────
const consultaTimestamp = computed(() => {
  const now = new Date()
  const fecha = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return { fecha, hora }
})

// ── Paleta de colores por materia ─────────────────────────────────────────────
const SUBJECT_PALETTE = [
  { bg: '#eff6ff', color: '#1e40af' },
  { bg: '#fdf4ff', color: '#7e22ce' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#f0fdf4', color: '#15803d' },
  { bg: '#fff1f2', color: '#be123c' },
  { bg: '#f0fdfa', color: '#0f766e' },
]
const subjectIndexMap = computed(() => {
  const map = new Map()
  let idx = 0
  rows.value.forEach(r => {
    if (r.subject && !map.has(r.subject)) {
      map.set(r.subject, idx % SUBJECT_PALETTE.length)
      idx++
    }
  })
  return map
})
function subjectStyle(subject) {
  const i = subjectIndexMap.value.get(subject) ?? 0
  return SUBJECT_PALETTE[i]
}

// ── Abreviatura de curso para PDF ────────────────────────────────────────────
function abbrevCurso(name) {
  if (!name) return '—'
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return words.map(w => w[0].toUpperCase()).join('.')
  return name.slice(0, 3).toUpperCase()
}

// ── Helper: barra de sección con acento dorado ───────────────────────────────
function _pdfSectionBar(doc, blue, gold, white, x, y, w, label) {
  doc.setFillColor(...blue)
  doc.roundedRect(x, y, w, 6.5, 1, 1, 'F')
  doc.setFillColor(...gold)
  doc.rect(x + 3.5, y + 1.5, 2.2, 3.5, 'F')
  doc.setTextColor(...white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(label, x + 8.5, y + 4.4)
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

// ── Exportar PDF — Diseño D "Ejecutivo Moderno" ───────────────────────────────
async function exportPdf() {
  const c   = props.candidate
  const s   = props.summary
  const { correctCount, incorrectCount, blankCount } = stats.value
  const logoBase64 = await _loadLogo()

  // ── Paleta "Ejecutivo Moderno" ────────────────────────────────────────────
  const CARBON    = [28,  43,  58]    // header, tabla heads
  const ELECTRIC  = [37,  99,  235]   // acento único: azul eléctrico
  const EL_LIGHT  = [219, 234, 254]   // tint azul muy suave (sky)
  const EL_MUTED  = [147, 197, 253]   // azul apagado (texto secundario en header)
  const WHITE     = [255, 255, 255]
  const BODY_TXT  = [30,  41,  59]
  const MUTED     = [100, 116, 139]
  const DIVIDER   = [226, 232, 240]
  const ZEBRA     = [248, 250, 252]
  const G_OK      = [21,  128, 61]    // verde correcto
  const G_OK_BG   = [240, 253, 244]
  const R_BAD     = [185, 28,  28]    // rojo incorrecto
  const R_BAD_BG  = [254, 242, 242]

  const W = 210, H = 297, M = 14

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const setF = (a) => doc.setFillColor(...a)
  const setD = (a) => doc.setDrawColor(...a)
  const setT = (a) => doc.setTextColor(...a)
  const font = (style, size) => { doc.setFont('helvetica', style); if (size !== undefined) doc.setFontSize(size) }

  // ── 1. Header limpio — blanco, sin fondo de color ────────────────────────
  if (logoBase64) doc.addImage(logoBase64, 'PNG', M, 3, 15, 15)

  font('bold', 9.5); setT(BODY_TXT)
  doc.text('UNIVERSIDAD NACIONAL DEL ALTIPLANO DE PUNO', W / 2, 8, { align: 'center' })
  font('normal', 6.8); setT(MUTED)
  doc.text('Direccion de Admision  -  Sistema de Calificacion', W / 2, 13.5, { align: 'center' })
  font('bold', 7.5); setT(ELECTRIC)
  doc.text('REPORTE DE CALIFICACION INDIVIDUAL', W / 2, 19, { align: 'center' })
  setD(ELECTRIC); doc.setLineWidth(0.8); doc.line(0, 22, W, 22)

  // ── 2. Metadatos ──────────────────────────────────────────────────────────
  let y = 28
  const now     = new Date()
  const fmtDate = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtTime = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

  font('normal', 6.8); setT(MUTED)
  doc.text(`Convocatoria: ${props.convocatoriaName || '-'}`, M, y)
  doc.text(`${fmtDate}  ${fmtTime}  -  ${props.currentUser || ''}`, W - M, y, { align: 'right' })
  y += 3
  setD(DIVIDER); doc.setLineWidth(0.25); doc.line(M, y, W - M, y)
  y += 5.5

  // ── 3. Sección candidato ──────────────────────────────────────────────────
  font('bold', 6.2); setT(ELECTRIC)
  doc.text('DATOS DEL POSTULANTE', M, y)
  y += 1.2
  setD(ELECTRIC); doc.setLineWidth(0.6); doc.line(M, y, M + 55, y)
  y += 4.5

  const INFO_W  = (W - M * 2) * 0.695
  const SCORE_W = (W - M * 2) - INFO_W - 3
  const SCORE_X = M + INFO_W + 3
  const BOX_H   = 36

  // Panel info — borde fino + acento eléctrico izquierdo
  setD(DIVIDER); doc.setLineWidth(0.3)
  doc.rect(M, y, INFO_W, BOX_H, 'D')
  setF(ELECTRIC); doc.rect(M, y, 2.8, BOX_H, 'F')

  // Panel puntaje — sólido eléctrico
  setF(ELECTRIC); doc.rect(SCORE_X, y, SCORE_W, BOX_H, 'F')

  // Nombre completo
  const fullName = [c.paterno, c.materno, c.nombres].filter(Boolean).join(' ')
  font('bold', 9); setT(BODY_TXT)
  doc.text((fullName || c.dni || '-').toUpperCase(), M + 6.5, y + 6.5, { maxWidth: INFO_W - 10 })

  // Separador interno sutil
  setD([235, 240, 250]); doc.setLineWidth(0.2)
  doc.line(M + 6.5, y + 9, M + INFO_W - 3, y + 9)

  // Campos en 2 columnas
  const infoFields = [
    ['DNI',      c.dni      || '-'],
    ['N Litho',  c.litho    || '-'],
    ['Aula',     c.aula     || '-'],
    ['Tipo',     c.tipo     || '-'],
    ['Cor. ID',  c.corId    || '-'],
    ['Area',     c.area     || '-'],
    ['Posicion', c.position ? `#${c.position}` : '-'],
    ['Programa', c.programa || '-'],
  ]
  const COL_W = (INFO_W - 7) / 2
  infoFields.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const fx  = M + 6.5 + col * COL_W
    const fy  = y + 13 + row * 6
    font('normal', 5.5); setT(MUTED)
    doc.text(label.toUpperCase(), fx, fy)
    font('bold', 7); setT(BODY_TXT)
    doc.text(String(value), fx, fy + 3.2, { maxWidth: COL_W - 4 })
  })

  // Puntaje (panel derecho)
  font('bold', 6.8); setT(EL_LIGHT)
  doc.text('PUNTAJE FINAL', SCORE_X + SCORE_W / 2, y + 7, { align: 'center' })
  font('bold', 21); setT(WHITE)
  doc.text(c.score.toFixed(3), SCORE_X + SCORE_W / 2, y + 21, { align: 'center' })

  // Línea divisora interna
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.25)
  doc.line(SCORE_X + 5, y + 25, SCORE_X + SCORE_W - 5, y + 25)

  // Badge estado
  const estado      = c.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE'
  const badgeFill   = c.isIngresante ? [16, 185, 129] : [71, 85, 105]
  font('bold', 6.2)
  const bW = doc.getTextWidth(estado) + 8
  setF(badgeFill)
  doc.roundedRect(SCORE_X + (SCORE_W - bW) / 2, y + 28, bW, 5.5, 1, 1, 'F')
  setT(WHITE); doc.text(estado, SCORE_X + SCORE_W / 2, y + 32.2, { align: 'center' })

  y += BOX_H + 4

  // ── 4. Leyenda de ponderación — solo borde, sin fondo ────────────────────
  setD(DIVIDER); doc.setLineWidth(0.25)
  doc.rect(M, y, W - M * 2, 7, 'D')

  const incStr   = s.incorrectValue <= 0 ? String(s.incorrectValue) : `+${s.incorrectValue}`
  const blankStr = s.blankValue     <= 0 ? String(s.blankValue)     : `+${s.blankValue}`

  let lx = M + 4
  const legItems = [
    ['Correcta: ',   `+${s.correctValue}`,  G_OK],
    ['Incorrecta: ', incStr,                R_BAD],
    ['En blanco: ',  blankStr,              MUTED],
    ['Plantilla: ',  s.plantillaName || '-', BODY_TXT],
  ]
  legItems.forEach(([label, val, valColor]) => {
    font('normal', 6.5); setT(MUTED)
    doc.text(label, lx, y + 4.6)
    lx += doc.getTextWidth(label)
    font('bold', 6.5); setT(valColor)
    doc.text(val, lx, y + 4.6)
    lx += doc.getTextWidth(val) + 7
  })
  font('normal', 6.2); setT(MUTED)
  doc.text(`${correctCount}C  ${incorrectCount}I  ${blankCount}B`, W - M - 3, y + 4.6, { align: 'right' })

  y += 10

  // ── 5. Tabla en dos columnas — split dinámico ─────────────────────────────
  font('bold', 6.2); setT(ELECTRIC)
  doc.text('DETALLE DE RESPUESTAS POR PREGUNTA', M, y)
  y += 1.2
  setD(ELECTRIC); doc.setLineWidth(0.6); doc.line(M, y, M + 74, y)
  y += 4.5

  const GAP   = 5
  const halfW = (W - M * 2 - GAP) / 2
  // N°(8) + Curso(17) + Marc(10) + Corr(10) + Pond(11) + Pts(13) + Acum(19.5) = 88.5mm exacto
  const CW    = { 0: 8, 1: 17, 2: 10, 3: 10, 4: 11, 5: 13, 6: 19.5 }
  const HEAD  = [['N', 'Curso', 'Marc.', 'Corr.', 'Pond.', 'Pts', 'Acum.']]

  // Calcular altura de fila para llenar exactamente el espacio hasta el footer
  const BOTTOM_M   = 11
  const TABLE_FS   = 7.5
  const HEAD_PAD   = 1.7
  const BODY_PAD   = 1.3

  function makeDidParseCell(halfRows, isLastTable) {
    return function (data) {
      if (data.section !== 'body') return
      const row = halfRows[data.row.index]
      if (!row) return

      // Zebra base (filas impares)
      if (data.row.index % 2 === 1) data.cell.styles.fillColor = ZEBRA

      // Colores semánticos (sobrescriben zebra)
      if (row.status === 'correct')   data.cell.styles.fillColor = G_OK_BG
      if (row.status === 'incorrect') data.cell.styles.fillColor = R_BAD_BG

      // Columna Marc.
      if (data.column.index === 2) {
        data.cell.styles.fontStyle = 'bold'
        if (row.status === 'correct')   data.cell.styles.textColor = G_OK
        if (row.status === 'incorrect') data.cell.styles.textColor = R_BAD
        if (row.status === 'blank')     data.cell.styles.textColor = [148, 163, 184]
      }
      // Columna Corr. — eléctrico
      if (data.column.index === 3) {
        data.cell.styles.textColor = ELECTRIC
        data.cell.styles.fontStyle = 'bold'
      }
      // Columna Pts
      if (data.column.index === 5) {
        data.cell.styles.textColor = row.status === 'correct' ? G_OK : [148, 163, 184]
      }
      // Última celda Acum. — tint eléctrico
      if (isLastTable && data.column.index === 6 && data.row.index === halfRows.length - 1) {
        data.cell.styles.fillColor  = EL_LIGHT
        data.cell.styles.textColor  = ELECTRIC
        data.cell.styles.fontStyle  = 'bold'
      }
    }
  }

  function buildBody(halfRows) {
    return halfRows.map(row => [
      row.n,
      abbrevCurso(row.subject),
      row.status === 'blank' ? '-' : row.marked,
      row.correct,
      `x${Number(row.weight).toFixed(3)}`,
      row.status === 'incorrect' ? '0.000' : row.pts.toFixed(3),
      row.acum.toFixed(3),
    ])
  }

  const half      = Math.ceil(rows.value.length / 2)
  const leftRows  = rows.value.slice(0, half)
  const rightRows = rows.value.slice(half)

  // nRowsMax siempre = half (leftRows.length >= rightRows.length)
  const nRowsMax  = leftRows.length
  const availH    = H - BOTTOM_M - y
  const headRowH  = TABLE_FS * 1.15 * 0.3528 + HEAD_PAD * 2
  const bodyRowH  = Math.max((availH - headRowH) / nRowsMax, TABLE_FS * 0.3528 + BODY_PAD * 2)

  const sharedCfg = (halfRows, marginLeft, marginRight, isLastTable) => ({
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    head: HEAD,
    body: buildBody(halfRows),
    styles: {
      fontSize: TABLE_FS, cellPadding: BODY_PAD,
      halign: 'center', lineColor: DIVIDER, lineWidth: 0.15,
      fillColor: WHITE,
    },
    headStyles: {
      fillColor: CARBON, textColor: WHITE,
      fontStyle: 'bold', fontSize: TABLE_FS, cellPadding: HEAD_PAD,
    },
    bodyStyles: { textColor: BODY_TXT, minCellHeight: bodyRowH },
    columnStyles: {
      0: { cellWidth: CW[0] },
      1: { cellWidth: CW[1], halign: 'left', fontSize: 7, overflow: 'ellipsize' },
      2: { cellWidth: CW[2] },
      3: { cellWidth: CW[3] },
      4: { cellWidth: CW[4], fontSize: 6.5 },
      5: { cellWidth: CW[5] },
      6: { cellWidth: CW[6], fontStyle: 'bold' },
    },
    didParseCell: makeDidParseCell(halfRows, isLastTable),
  })

  autoTable(doc, { ...sharedCfg(leftRows,  M,              M + halfW + GAP, false), margin: { left: M,              right: M + halfW + GAP, bottom: BOTTOM_M } })
  autoTable(doc, { ...sharedCfg(rightRows, M + halfW + GAP, M,              true),  margin: { left: M + halfW + GAP, right: M,              bottom: BOTTOM_M } })

  // ── 6. Footer minimalista — solo línea + texto ────────────────────────────
  setD(DIVIDER); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11)
  font('normal', 6); setT(MUTED)
  doc.text('Universidad Nacional del Altiplano de Puno  -  Direccion de Admision', M, H - 7)
  doc.text(`${fmtDate}  ${fmtTime}${props.currentUser ? '  -  ' + props.currentUser : ''}  -  Pag. 1`, W - M, H - 7, { align: 'right' })

  // ── 7. Guardar ────────────────────────────────────────────────────────────
  const safeName = (c.paterno || c.dni || 'candidato').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  doc.save(`reporte-${safeName}-${(c.area || '').replace(/\s+/g, '-')}-${fmtDate.replace(/\//g, '')}.pdf`)
}
</script>

<template>
  <Teleport to="body">
    <div class="cdm-overlay" @click.self="emit('close')">
      <div ref="modalRef" class="cdm-modal" role="dialog" aria-modal="true">

        <!-- ══ HEADER ══ -->
        <div class="cdm-header">
          <div class="cdm-header__strip">
            <div class="cdm-header__titles">
              <div class="cdm-header__title">Detalle de Respuestas por Pregunta</div>
              <div class="cdm-header__sub">
                Área: {{ candidate.area }}
                <template v-if="convocatoriaName"> &nbsp;·&nbsp; {{ convocatoriaName }}</template>
              </div>
            </div>
            <div class="cdm-score-block">
              <span class="cdm-score-block__label">Puntaje Final</span>
              <span class="cdm-score-block__value">{{ candidate.score.toFixed(3) }}</span>
            </div>
            <button class="cdm-btn-close" @click="emit('close')" aria-label="Cerrar">✕</button>
          </div>

          <!-- Tarjeta candidato -->
          <div class="cdm-cand-card">
            <div class="cdm-cand-main">
              <div>
                <div class="cdm-cand-name">
                  {{ [candidate.paterno, candidate.materno, candidate.nombres].filter(Boolean).join(' ') || '—' }}
                </div>
                <div class="cdm-cand-prog">{{ candidate.programa || '—' }}</div>
              </div>
              <span class="cdm-badge-pos">#{{ candidate.position }}</span>
              <span class="cdm-badge-in" v-if="candidate.isIngresante">✓ INGRESANTE</span>
              <span class="cdm-badge-out" v-else>NO INGRESANTE</span>
            </div>

            <!-- Campos técnicos -->
            <div class="cdm-fields">
              <div class="cdm-field">
                <span class="cdm-field__label">DNI</span>
                <span class="cdm-field__value mono">{{ candidate.dni || '—' }}</span>
              </div>
              <div class="cdm-field">
                <span class="cdm-field__label">Litho</span>
                <span class="cdm-field__value mono" :class="{ na: !candidate.litho }">
                  {{ candidate.litho || '—' }}
                </span>
              </div>
              <div class="cdm-field">
                <span class="cdm-field__label">Aula</span>
                <span class="cdm-field__value mono" :class="{ na: !candidate.aula }">
                  {{ candidate.aula || '—' }}
                </span>
              </div>
              <div class="cdm-field">
                <span class="cdm-field__label">Tipo de prueba</span>
                <span class="cdm-field__value mono" :class="{ na: !candidate.tipo }">
                  {{ candidate.tipo || '—' }}
                </span>
              </div>
              <div class="cdm-field">
                <span class="cdm-field__label">Cor. ID</span>
                <span class="cdm-field__value mono" :class="{ na: !candidate.corId }">
                  {{ candidate.corId || '—' }}
                </span>
              </div>
            </div>

            <!-- Pie de tarjeta -->
            <div class="cdm-cand-footer">
              <span class="cdm-cand-footer__item">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
                Consulta: <strong>{{ consultaTimestamp.fecha }}</strong>
              </span>
              <span class="cdm-cand-footer__item">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
                <strong>{{ consultaTimestamp.hora }}</strong>
              </span>
              <span class="cdm-cand-footer__item">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
                Plantilla: <strong>{{ summary.plantillaName || '—' }}</strong>
              </span>
              <span v-if="currentUser" class="cdm-cand-footer__item">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
                <strong>{{ currentUser }}</strong>
              </span>
            </div>
          </div>
        </div>

        <!-- ══ STATS BAR ══ -->
        <div class="cdm-stats">
          <div class="cdm-stat cdm-stat--ok">
            <span class="cdm-stat__dot"></span>
            <span class="cdm-stat__n">{{ stats.correctCount }}</span>
            <span class="cdm-stat__lbl">Correctas</span>
          </div>
          <div class="cdm-stat cdm-stat--bad">
            <span class="cdm-stat__dot"></span>
            <span class="cdm-stat__n">{{ stats.incorrectCount }}</span>
            <span class="cdm-stat__lbl">Incorrectas</span>
          </div>
          <div class="cdm-stat cdm-stat--blk">
            <span class="cdm-stat__dot"></span>
            <span class="cdm-stat__n">{{ stats.blankCount }}</span>
            <span class="cdm-stat__lbl">En blanco</span>
          </div>
          <div class="cdm-stat">
            <span class="cdm-stat__n" style="color:#1e3a8a">{{ candidate.score.toFixed(3) }}</span>
            <span class="cdm-stat__lbl">pts total</span>
          </div>
        </div>

        <!-- ══ GRID VISUAL DE RESPUESTAS ══ -->
        <div class="cdm-answers-grid">
          <span
            v-for="row in rows"
            :key="row.n"
            class="ans-bubble"
            :class="{
              'ans-bubble--ok':  row.status === 'correct',
              'ans-bubble--bad': row.status === 'incorrect',
              'ans-bubble--blk': row.status === 'blank',
            }"
            :title="`#${row.n} · Marc: ${row.marked} · Corr: ${row.correct}`"
          >
            <span class="ans-bubble__n">{{ row.n }}</span>
            <span class="ans-bubble__letter">{{ row.status === 'blank' ? '·' : row.marked }}</span>
          </span>
        </div>

        <!-- ══ TABLA ══ -->
        <div class="cdm-table-scroll">
          <table class="cdm-table">
            <thead>
              <tr>
                <th>N°</th>
                <th class="left">Curso</th>
                <th>Marcado</th>
                <th>Correcto</th>
                <th>Ponderado</th>
                <th>Puntos</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.n"
                :class="{
                  'row-ok':  row.status === 'correct',
                  'row-bad': row.status === 'incorrect',
                  'row-blk': row.status === 'blank',
                }"
              >
                <td class="td-num">{{ row.n }}</td>
                <td class="left">
                  <span
                    class="subj-badge"
                    :style="{ background: subjectStyle(row.subject).bg, color: subjectStyle(row.subject).color }"
                  >{{ row.subject || '—' }}</span>
                </td>
                <td>
                  <span
                    class="ans"
                    :class="{
                      'ans-ok':  row.status === 'correct',
                      'ans-bad': row.status === 'incorrect',
                      'ans-blk': row.status === 'blank',
                    }"
                  >{{ row.marked }}</span>
                </td>
                <td>
                  <span class="ans ans-key">{{ row.correct }}</span>
                </td>
                <td>
                  <span class="pond">×{{ row.weight }}</span>
                </td>
                <td>
                  <span
                    class="pts"
                    :class="{
                      'pts-ok':   row.status === 'correct',
                      'pts-blk':  row.status === 'blank',
                      'pts-zero': row.status === 'incorrect',
                    }"
                  >{{ row.status === 'incorrect' ? '0.000' : '+' + row.pts.toFixed(3) }}</span>
                </td>
                <td>
                  <span class="acum" :class="{ 'acum-final': row.n === rows.length }">
                    {{ row.acum.toFixed(3) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ══ FOOTER ══ -->
        <div class="cdm-footer">
          <div class="cdm-footer__meta">
            Correcto <strong>×{{ summary.correctValue }}</strong> &nbsp;·&nbsp;
            Incorrecto <strong>×{{ summary.incorrectValue }}</strong> &nbsp;·&nbsp;
            Blanco <strong>×{{ summary.blankValue }}</strong> &nbsp;·&nbsp;
            {{ rows.length }} preguntas
          </div>
          <div class="cdm-footer__actions">
            <button class="cdm-btn cdm-btn--pdf" @click="exportPdf">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd"/>
              </svg>
              Exportar PDF
            </button>
            <button class="cdm-btn cdm-btn--ghost" @click="emit('close')">Cerrar</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ── */
.cdm-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  background: rgba(15, 23, 42, 0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: fadeIn 0.18s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

/* ── Modal shell ── */
.cdm-modal {
  background: white;
  border-radius: 14px;
  width: 100%;
  max-width: 880px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 72px rgba(0,0,0,0.22);
  overflow: hidden;
  animation: slideUp 0.2s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) }
  to   { opacity: 1; transform: translateY(0) }
}

/* ══ HEADER ══ */
.cdm-header {
  background: linear-gradient(160deg, #1e293b 0%, #334155 100%);
  color: white;
  padding: 18px 22px 16px;
  flex-shrink: 0;
}

.cdm-header__strip {
  display: flex; align-items: flex-start; gap: 12px;
  margin-bottom: 14px;
}
.cdm-header__titles { flex: 1; }
.cdm-header__title  { font-size: 1rem; font-weight: 700; }
.cdm-header__sub    { font-size: 0.72rem; opacity: 0.6; margin-top: 2px; }

.cdm-score-block {
  display: flex; flex-direction: column; align-items: flex-end;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 10px;
  padding: 6px 14px;
  flex-shrink: 0;
}
.cdm-score-block__label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.6; }
.cdm-score-block__value { font-size: 1.55rem; font-weight: 900; color: #fde68a; font-family: monospace; line-height: 1.1; }

.cdm-btn-close {
  background: rgba(255,255,255,0.1); border: none; color: white;
  width: 30px; height: 30px; border-radius: 8px;
  cursor: pointer; font-size: 0.95rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; align-self: flex-start;
  transition: background 0.15s;
}
.cdm-btn-close:hover { background: rgba(255,255,255,0.22); }

/* Candidate card */
.cdm-cand-card {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.cdm-cand-main {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.cdm-cand-name { font-size: 0.95rem; font-weight: 800; letter-spacing: 0.01em; }
.cdm-cand-prog { font-size: 0.7rem; opacity: 0.65; margin-top: 1px; }

.cdm-badge-pos {
  background: rgba(255,255,255,0.14); color: white;
  font-size: 0.7rem; font-weight: 700;
  padding: 3px 9px; border-radius: 7px; flex-shrink: 0;
}
.cdm-badge-in {
  background: #15803d; color: white;
  font-size: 0.62rem; font-weight: 800;
  padding: 3px 10px; border-radius: 20px; letter-spacing: 0.07em; flex-shrink: 0;
}
.cdm-badge-out {
  background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);
  font-size: 0.62rem; font-weight: 600;
  padding: 3px 10px; border-radius: 20px; letter-spacing: 0.05em; flex-shrink: 0;
}

/* Campos técnicos */
.cdm-fields {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px 10px;
}
.cdm-field { display: flex; flex-direction: column; gap: 1px; }
.cdm-field__label {
  font-size: 0.58rem; opacity: 0.5;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.cdm-field__value { font-size: 0.82rem; font-weight: 700; }
.cdm-field__value.mono { font-family: 'Cascadia Code', Consolas, monospace; }
.cdm-field__value.na   { opacity: 0.3; font-style: italic; font-weight: 400; font-size: 0.75rem; }

/* Pie de tarjeta */
.cdm-cand-footer {
  display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 0.65rem; color: rgba(255,255,255,0.55);
}
.cdm-cand-footer__item { display: flex; align-items: center; gap: 4px; }
.cdm-cand-footer__item svg { width: 11px; height: 11px; flex-shrink: 0; }
.cdm-cand-footer__item strong { color: rgba(255,255,255,0.8); }

/* ══ STATS BAR ══ */
.cdm-stats {
  display: flex; flex-shrink: 0;
  border-bottom: 2px solid #e2e8f0;
  background: #f8fafc;
}
.cdm-stat {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 6px; border-right: 1px solid #e2e8f0;
}
.cdm-stat:last-child { border-right: none; }
.cdm-stat__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cdm-stat--ok  .cdm-stat__dot { background: #16a34a; }
.cdm-stat--ok  .cdm-stat__n   { color: #15803d; }
.cdm-stat--bad .cdm-stat__dot { background: #dc2626; }
.cdm-stat--bad .cdm-stat__n   { color: #dc2626; }
.cdm-stat--blk .cdm-stat__dot { background: #94a3b8; }
.cdm-stat--blk .cdm-stat__n   { color: #64748b; }
.cdm-stat__n   { font-size: 1.08rem; font-weight: 800; }
.cdm-stat__lbl { font-size: 0.7rem; color: #64748b; font-weight: 500; }

/* ══ GRID VISUAL DE RESPUESTAS ══ */
.cdm-answers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 10px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.ans-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: default;
  transition: transform 0.1s;
  position: relative;
}

.ans-bubble:hover { transform: scale(1.2); z-index: 1; }

.ans-bubble__n {
  font-size: 0.48rem;
  font-weight: 700;
  line-height: 1;
  opacity: 0.65;
}

.ans-bubble__letter {
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  font-family: var(--font-mono);
}

.ans-bubble--ok  { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.ans-bubble--bad { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.ans-bubble--blk { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; }

/* ══ TABLE ══ */
.cdm-table-scroll { overflow-y: auto; flex: 1; }

.cdm-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }

.cdm-table thead { position: sticky; top: 0; z-index: 2; background: #f1f5f9; }
.cdm-table thead th {
  padding: 8px 10px;
  font-size: 0.67rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #475569;
  border-bottom: 2px solid #e2e8f0;
  text-align: center; white-space: nowrap;
}
.cdm-table thead th.left { text-align: left; }

.cdm-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.1s; }
.cdm-table tbody tr:last-child { border-bottom: none; }
.cdm-table tbody tr:hover { background: #f8fafc !important; }
.cdm-table tr.row-ok  { background: #f0fdf4; }
.cdm-table tr.row-bad { background: #fff5f5; }
.cdm-table tr.row-blk { background: #fafafa; }

.cdm-table td { padding: 5px 10px; color: #334155; text-align: center; vertical-align: middle; }
.cdm-table td.left  { text-align: left; }
.cdm-table td.td-num { color: #94a3b8; font-size: 0.72rem; font-weight: 600; width: 34px; }

.subj-badge {
  display: inline-block; font-size: 0.68rem; font-weight: 700;
  padding: 2px 8px; border-radius: 12px; white-space: nowrap;
}

.ans {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  font-family: monospace; font-size: 0.88rem; font-weight: 800;
}
.ans-ok  { background: #dcfce7; color: #15803d; }
.ans-bad { background: #fee2e2; color: #dc2626; }
.ans-blk { background: #f1f5f9; color: #94a3b8; font-size: 0.72rem; }
.ans-key { background: #dbeafe; color: #1d4ed8; }

.pond {
  display: inline-block; font-size: 0.72rem; font-weight: 700;
  font-family: monospace; background: #f1f5f9; color: #475569;
  padding: 2px 7px; border-radius: 6px;
}

.pts { font-family: monospace; font-weight: 700; font-size: 0.82rem; }
.pts-ok   { color: #15803d; }
.pts-blk  { color: #64748b; }
.pts-zero { color: #94a3b8; }

.acum {
  display: inline-block; font-family: monospace; font-weight: 800;
  font-size: 0.82rem; color: #1e40af;
  background: #dbeafe; padding: 2px 8px; border-radius: 6px;
  min-width: 64px; text-align: right;
}
.acum-final { background: #fef9c3; color: #92400e; }

/* ══ FOOTER ══ */
.cdm-footer {
  border-top: 1px solid #e2e8f0; background: #f8fafc;
  padding: 11px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-shrink: 0; flex-wrap: wrap;
}
.cdm-footer__meta { font-size: 0.73rem; color: #94a3b8; }
.cdm-footer__meta strong { color: #475569; }
.cdm-footer__actions { display: flex; gap: 8px; }

.cdm-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 8px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; border: none;
  transition: all 0.15s;
}
.cdm-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.cdm-btn--pdf {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  color: white; box-shadow: 0 2px 8px rgba(220,38,38,0.25);
}
.cdm-btn--pdf:hover { opacity: 0.9; transform: translateY(-1px); }
.cdm-btn--ghost { background: white; color: #475569; border: 1px solid #e2e8f0; }
.cdm-btn--ghost:hover { background: #f1f5f9; }

/* Responsive */
@media (max-width: 640px) {
  .cdm-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cdm-cand-footer { gap: 8px; }
}
</style>
