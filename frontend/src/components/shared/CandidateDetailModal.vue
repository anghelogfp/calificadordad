<script setup>
import { computed } from 'vue'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildQuestionPlan } from '@/utils/helpers'

const props = defineProps({
  candidate: { type: Object, required: true },   // resultado con answersRaw, correctAnswersRaw, etc.
  summary:   { type: Object, required: true },   // summary del área (plantillaSnapshot, valores)
  convocatoriaName: { type: String, default: '' },
  currentUser: { type: String, default: '' },
})

const emit = defineEmits(['close'])

// ── Plan de preguntas (materia + peso por índice) ─────────────────────────────
const questionPlan = computed(() =>
  buildQuestionPlan(props.summary.plantillaSnapshot || [])
)

// ── Detalle pregunta × pregunta ───────────────────────────────────────────────
const rows = computed(() => {
  const plan = questionPlan.value
  const candidateAnswers = (props.candidate.answersRaw || '').toUpperCase()
  const correctAnswers   = (props.candidate.correctAnswersRaw || '').toUpperCase()
  const correctVal   = Number(props.summary.correctValue ?? 10)
  const incorrectVal = Number(props.summary.incorrectValue ?? 0)
  const blankVal     = Number(props.summary.blankValue ?? 2)

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

// ── Exportar PDF — una sola hoja, dos columnas ────────────────────────────────
async function exportPdf() {
  const c   = props.candidate
  const s   = props.summary
  const { correctCount, incorrectCount, blankCount } = stats.value
  const logoBase64 = await _loadLogo()

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 210
  const pageH = doc.internal.pageSize.getHeight()  // 297

  // ── 1. Encabezado institucional ────────────────────────────────────────────
  const HDR_H = 28
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageW, HDR_H, 'F')

  // Insignia UNAP
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 7, 3, 20, 20)
  }

  // Textos centrados (desplazados si hay logo)
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
  doc.text(props.convocatoriaName || 'EXAMEN DE ADMISIÓN', txtX, 20, { align: 'center' })
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('DETALLE DE RESPUESTAS POR PREGUNTA', txtX, 25.5, { align: 'center' })

  // ── 2. Sección candidato ───────────────────────────────────────────────────
  const CAND_Y = HDR_H + 3
  const CAND_H = 42
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.rect(10, CAND_Y, pageW - 20, CAND_H, 'FD')

  // Franja superior del card (acento visual)
  doc.setFillColor(30, 41, 59)
  doc.rect(10, CAND_Y, 3, CAND_H, 'F')

  // Nombre completo
  const fullName = [c.paterno, c.materno, c.nombres].filter(Boolean).join(' ')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(fullName.toUpperCase(), 17, CAND_Y + 8)

  // Programa bajo el nombre
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(c.programa || '—', 17, CAND_Y + 14)

  // Badge INGRESANTE / NO INGRESANTE (derecha, arriba)
  const estado = c.isIngresante ? 'INGRESANTE' : 'NO INGRESANTE'
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const badgeW = doc.getTextWidth(estado) + 10
  const badgeX = pageW - 14 - badgeW
  const badgeY = CAND_Y + 2
  doc.setFillColor(...(c.isIngresante ? [21, 128, 61] : [100, 116, 139]))
  doc.roundedRect(badgeX, badgeY, badgeW, 7, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(estado, badgeX + badgeW / 2, badgeY + 5, { align: 'center' })

  // Puntaje final — solo borde dorado, sin fondo (texto en dorado)
  const scoreBoxW = badgeW + 4
  const scoreBoxH = 20
  const scoreBoxX = badgeX - 2
  const scoreBoxY = badgeY + 11
  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(0.8)
  doc.roundedRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 2, 2, 'D')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('PUNTAJE FINAL', scoreBoxX + scoreBoxW / 2, scoreBoxY + 6, { align: 'center' })
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120, 53, 15)
  doc.text(c.score.toFixed(3), scoreBoxX + scoreBoxW / 2, scoreBoxY + 15, { align: 'center' })

  // Separador horizontal
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(17, CAND_Y + 18, badgeX - 4, CAND_Y + 18)

  // Campos en 3 columnas con chips visuales
  const fieldMaxX = badgeX - 4
  const colW = (fieldMaxX - 17) / 3
  const fieldDefs = [
    ['DNI',      c.dni      || '—'],
    ['Litho',    c.litho    || '—'],
    ['Aula',     c.aula     || '—'],
    ['Tipo',     c.tipo     || '—'],
    ['Cor. ID',  c.corId    || '—'],
    ['Área',     c.area     || '—'],
    ['Posición', `#${c.position}`],
    ['Programa', c.programa || '—'],
  ]
  doc.setFontSize(8.5)
  fieldDefs.forEach(([label, val], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const fx  = 17 + col * colW
    const fy  = CAND_Y + 19 + row * 8
    // Label en gris pequeño
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), fx, fy)
    // Valor en negro más grande
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), fx, fy + 5.5)
  })

  // ── 3. Barra de stats ──────────────────────────────────────────────────────
  const STATS_Y = CAND_Y + CAND_H + 2
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(226, 232, 240)
  doc.rect(10, STATS_Y, pageW - 20, 9, 'FD')

  doc.setFontSize(7.5)
  const statItems = [
    [`Correctas: `,   `${correctCount}`,   [21, 128, 61]],
    [`Incorrectas: `, `${incorrectCount}`, [220, 38, 38]],
    [`En blanco: `,   `${blankCount}`,     [100, 116, 139]],
    [`C×`,  `${s.correctValue}`,   [30, 41, 59]],
    [`I×`,  `${s.incorrectValue}`, [30, 41, 59]],
    [`B×`,  `${s.blankValue}`,     [30, 41, 59]],
    [`Plantilla: `, s.plantillaName || '—', [30, 58, 138]],
  ]
  let sx = 14
  statItems.forEach(([label, val, rgb]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
    doc.text(label, sx, STATS_Y + 6)
    sx += doc.getTextWidth(label)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...rgb)
    doc.text(val, sx, STATS_Y + 6)
    sx += doc.getTextWidth(val) + 5
  })

  // ── 4. Tablas dos columnas — split dinámico ────────────────────────────────
  const TABLE_Y = STATS_Y + 12
  const GAP     = 5
  const halfW   = (pageW - 20 - GAP) / 2   // 92.5mm por tabla

  // Anchos de columna × 2 = halfW (92.5mm total)
  // N°(8) Curso(18) Marc(11) Corr(11) Pond(12) Pts(14) Acum(18.5) = 92.5
  const CW = { 0:8, 1:18, 2:11, 3:11, 4:12, 5:14, 6:18.5 }
  const HEAD = [['N°', 'Curso', 'Marc.', 'Corr.', 'Pond.', 'Pts', 'Acum.']]

  function makeDidParseCell(halfRows, isLastTable) {
    return function(data) {
      if (data.section !== 'body') return
      const row = halfRows[data.row.index]
      if (!row) return
      if (row.status === 'correct')   data.cell.styles.fillColor = [240, 253, 244]
      if (row.status === 'incorrect') data.cell.styles.fillColor = [255, 245, 245]
      if (data.column.index === 2) {
        data.cell.styles.fontStyle = 'bold'
        if (row.status === 'correct')   data.cell.styles.textColor = [21, 128, 61]
        if (row.status === 'incorrect') data.cell.styles.textColor = [220, 38, 38]
        if (row.status === 'blank')     data.cell.styles.textColor = [148, 163, 184]
      }
      // Columna Corr. siempre azul
      if (data.column.index === 3) {
        data.cell.styles.textColor = [29, 78, 216]
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.column.index === 5) {
        data.cell.styles.textColor = row.status === 'correct' ? [21, 128, 61] : [148, 163, 184]
      }
      // Fondo verde suave para correctas, rojo para incorrectas
      if (row.status === 'correct')   data.cell.styles.fillColor = [240, 253, 244]
      if (row.status === 'incorrect') data.cell.styles.fillColor = [255, 245, 245]
      // Último acumulado en dorado — solo en la tabla derecha (pregunta final)
      if (isLastTable && data.column.index === 6 && data.row.index === halfRows.length - 1) {
        data.cell.styles.fillColor = [254, 249, 195]
        data.cell.styles.textColor = [146, 64, 14]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  }

  function buildBody(halfRows) {
    return halfRows.map(row => [
      row.n,
      abbrevCurso(row.subject),
      row.status === 'blank' ? '—' : row.marked,
      row.correct,
      `×${Number(row.weight).toFixed(3)}`,
      row.status === 'incorrect' ? '0.000' : row.pts.toFixed(3),
      row.acum.toFixed(3),
    ])
  }

  // Split dinámico: mitad del total de preguntas
  const half      = Math.ceil(rows.value.length / 2)
  const leftRows  = rows.value.slice(0, half)
  const rightRows = rows.value.slice(half)

  const sharedTableCfg = (halfRows, marginLeft, marginRight, isLastTable) => ({
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

  autoTable(doc, sharedTableCfg(leftRows,  10,              10 + halfW + GAP, false))
  autoTable(doc, sharedTableCfg(rightRows, 10 + halfW + GAP, 10,              true))

  // ── 5. Footer ──────────────────────────────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  const yf = pageH - 5
  doc.text(
    `Generado: ${consultaTimestamp.value.fecha}  ${consultaTimestamp.value.hora}` +
    (props.currentUser ? `   ·   ${props.currentUser}` : ''),
    14, yf
  )
  doc.text('Pág. 1 / 1', pageW - 12, yf, { align: 'right' })

  const safeName = (c.paterno || c.dni || 'candidato').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
  doc.save(`detalle-${safeName}-${c.area}-${consultaTimestamp.value.fecha.replace(/\//g, '')}.pdf`)
}
</script>

<template>
  <Teleport to="body">
    <div class="cdm-overlay" @click.self="emit('close')">
      <div class="cdm-modal" role="dialog" aria-modal="true">

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
  position: fixed; inset: 0; z-index: 1000;
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
  grid-template-columns: repeat(5, 1fr);
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
  .cdm-fields { grid-template-columns: repeat(3, 1fr); }
  .cdm-cand-footer { gap: 8px; }
}
</style>
