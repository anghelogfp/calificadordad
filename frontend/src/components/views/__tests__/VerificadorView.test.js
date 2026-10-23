import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import VerificadorView from '../VerificadorView.vue'
import { keyFingerprint } from '@/domain/calification/questionExceptions'

vi.mock('@/utils/apiFetch', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => [] })),
}))

const KEY = 'ABCDE'.repeat(12)
const plantilla = { id: 1, name: 'Plantilla', area: '', items: [{ subject: 'General', questionCount: 60, ponderation: 1 }] }

const exception = (overrides = {}) => ({
  id: 1, area: '', tipo: 'P', questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '',
  reason: 'Mal formulada', keySha256: keyFingerprint(KEY), status: 'applied', ...overrides,
})

async function mountVerificador({ answers, questionExceptions = [] }) {
  const wrapper = mount(VerificadorView, {
    props: { ponderations: { plantillas: ref([plantilla]) }, currentUser: 'admin', questionExceptions },
  })
  await wrapper.find('select.config-select').setValue(1)
  const keyInputs = wrapper.findAll('.cell-input--key')
  const answerInputs = wrapper.findAll('.cell-input:not(.cell-input--key)')
  for (let i = 0; i < 60; i += 1) {
    await keyInputs[i].setValue(KEY[i])
    if (answers[i].trim()) await answerInputs[i].setValue(answers[i])
  }
  return wrapper
}

// Fila de la tabla de detalle de la pregunta n: [N°, curso, marcada, clave, peso, puntos, acumulado]
const detailRow = (wrapper, n) => {
  const row = wrapper.findAll('.detail-row').find((tr) => tr.find('td').text() === String(n))
  return row.findAll('td').map((td) => td.text())
}

describe('VerificadorView', () => {
  it('sin excepciones puntúa como siempre: un blanco vale el valor de blanco', async () => {
    const wrapper = await mountVerificador({ answers: KEY.slice(0, 4) + ' ' + KEY.slice(5) })

    expect(detailRow(wrapper, 5)[5]).toBe('2.000')
    expect(wrapper.find('.verificador-exceptions').exists()).toBe(false)
  })

  it('aplica las excepciones registradas para la clave tecleada, como el resultado oficial', async () => {
    const wrapper = await mountVerificador({ answers: KEY.slice(0, 4) + ' ' + KEY.slice(5), questionExceptions: [exception()] })

    expect(detailRow(wrapper, 5)[3]).toBe('ANUL.')
    expect(detailRow(wrapper, 5)[5]).toBe('10.000')
    expect(wrapper.find('.verificador-exceptions').text()).toContain('preguntas 5')
  })

  it('no aplica excepciones de otra clave aunque tengan el mismo número de pregunta', async () => {
    const other = exception({ keySha256: keyFingerprint('E' + KEY.slice(1)) })
    const wrapper = await mountVerificador({ answers: KEY.slice(0, 4) + ' ' + KEY.slice(5), questionExceptions: [other] })

    expect(detailRow(wrapper, 5)[5]).toBe('2.000')
    expect(wrapper.find('.verificador-exceptions').exists()).toBe(false)
  })

  it('no aplica una excepción inválida', async () => {
    const wrapper = await mountVerificador({ answers: KEY.slice(0, 4) + ' ' + KEY.slice(5), questionExceptions: [exception({ status: 'invalid' })] })
    expect(detailRow(wrapper, 5)[5]).toBe('2.000')
  })
})
