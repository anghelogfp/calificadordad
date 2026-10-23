import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CandidateDetailModal from '../CandidateDetailModal.vue'
import { calculateAreaResults } from '@/domain/calification/calculateResults'
import { keyFingerprint } from '@/domain/calification/questionExceptions'

const KEY = 'ABCDE'.repeat(12)
const PLANTILLA = {
  id: 'tpl', name: 'P', questionTotal: 60,
  items: [{ subject: 'Letras', questionCount: 30, ponderation: 1 }, { subject: 'Ciencias', questionCount: 30, ponderation: 2 }],
}

// Resultado real del motor para una hoja: el modal debe mostrar exactamente esto.
function engineRow(answers, questionExceptions = [], values = { correct: 10, incorrect: 0, blank: 2 }) {
  const sheet = { dni: '11111111', tipo: 'P', answers, litho: '000001' }
  const { results, summary } = calculateAreaResults({
    area: 'General', plantilla: PLANTILLA,
    correctValue: values.correct, incorrectValue: values.incorrect, blankValue: values.blank,
    processType: 'simulacro', simulacroScope: 'general', answersLength: 60,
    archiveRows: [{ dni: '11111111', paterno: 'A' }], responsesRows: [sheet],
    answerKeyRows: [{ area: '', tipo: 'P', answers: KEY }],
    responsesByDni: new Map([['11111111', [sheet]]]),
    answerKeyLookupByAreaTipo: new Map(), answerKeyFallbackByArea: new Map(),
    areaList: ['Biomédicas', 'Sociales', 'Ingeniería'], vacantesPrograma: {}, questionExceptions,
  })
  // El resumen que ve el modal es el que se guarda en el historial.
  return { row: results[0], summary: { ...summary, plantillaSnapshot: PLANTILLA.items } }
}

const exception = (overrides = {}) => ({
  id: 1, area: '', tipo: 'P', questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '',
  reason: 'Mal formulada', documentRef: '', keySha256: keyFingerprint(KEY), ...overrides,
})

function mountModal({ row, summary }) {
  const wrapper = mount(CandidateDetailModal, { props: { candidate: row, summary }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

// El modal se teletransporta al <body>: se lee del documento, no del wrapper.
const tableRows = () => [...document.body.querySelectorAll('.cdm-table tbody tr')]
const cells = (tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim().replace(/\s+/g, ' '))
const statsText = () => document.body.querySelector('.cdm-stats').textContent

const mounted = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('CandidateDetailModal', () => {
  it('el último acumulado es exactamente el puntaje del ranking, para hojas de todo tipo', () => {
    const sheets = [
      KEY, ' '.repeat(60), 'E'.repeat(60), '*'.repeat(60),
      KEY.slice(0, 20) + 'E'.repeat(10) + '*' + ' '.repeat(9) + KEY.slice(40),
      KEY.slice(0, 57),
    ]
    for (const answers of sheets) {
      const data = engineRow(answers)
      const wrapper = mountModal(data)
      const last = cells(tableRows().at(-1)).at(-1)
      expect(Number(last), `hoja "${answers.slice(0, 12)}…"`).toBeCloseTo(data.row.score, 3)
    }
  })

  it('también cuando el valor de incorrecta es negativo (antes el detalle mostraba 0.000)', () => {
    const data = engineRow('E'.repeat(60), [], { correct: 10, incorrect: -1, blank: 2 })
    const wrapper = mountModal(data)

    const last = Number(cells(tableRows().at(-1)).at(-1))
    expect(last).toBeCloseTo(data.row.score, 3)
    expect(cells(tableRows()[0])[5]).toBe('-1.000')
  })

  it('muestra la pregunta anulada con punto: marcada, "ANUL." como clave y los puntos que recibió', () => {
    const data = engineRow(KEY.slice(0, 4) + ' ' + KEY.slice(5), [exception()])
    const wrapper = mountModal(data)
    const row = cells(tableRows()[4])

    expect(row[3]).toBe('ANUL.')
    expect(row[5]).toBe('+10.000')
    expect(statsText()).toContain('Anuladas')
    expect(Number(cells(tableRows().at(-1)).at(-1))).toBeCloseTo(data.row.score, 3)
  })

  it('una pregunta excluida aporta 0 y el total sigue coincidiendo con el ranking', () => {
    const data = engineRow(KEY, [exception({ type: 'ANULADA_EXCLUIR' })])
    const wrapper = mountModal(data)

    expect(cells(tableRows()[4])[5]).toBe('0.000')
    expect(Number(cells(tableRows().at(-1)).at(-1))).toBeCloseTo(890, 3)
  })

  it('varias respuestas válidas muestra las letras aceptadas', () => {
    const data = engineRow(KEY.slice(0, 4) + 'B' + KEY.slice(5), [exception({ type: 'CLAVE_MULTIPLE', validAnswers: 'BE' })])
    const wrapper = mountModal(data)

    expect(cells(tableRows()[4])[3]).toBe('B/E')
    expect(cells(tableRows()[4])[5]).toBe('+10.000')
  })

  it('sin excepciones no muestra "Anuladas"', () => {
    const wrapper = mountModal(engineRow(KEY))
    expect(statsText()).not.toContain('Anuladas')
  })

  it('un resultado guardado en el historial (sin questionDetails) muestra lo mismo', () => {
    const data = engineRow(KEY.slice(0, 4) + ' ' + KEY.slice(5), [exception()])
    // El historial solo conserva estos campos de la fila.
    const { questionDetails, subjectBreakdown, ...stored } = data.row
    const wrapper = mountModal({ row: stored, summary: data.summary })

    expect(cells(tableRows()[4])[3]).toBe('ANUL.')
    expect(Number(cells(tableRows().at(-1)).at(-1))).toBeCloseTo(data.row.score, 3)
  })
})
