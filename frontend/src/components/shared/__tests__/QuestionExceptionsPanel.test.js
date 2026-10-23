import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import QuestionExceptionsPanel from '../QuestionExceptionsPanel.vue'

const keyOptions = [
  { id: '|P', area: '', tipo: 'P', label: 'Clave general · Tipo P', answers: 'ABCDE'.repeat(12), length: 60 },
  { id: 'INGENIERÍAS|Q', area: 'INGENIERÍAS', tipo: 'Q', label: 'INGENIERÍAS · Tipo Q', answers: 'EDCBA'.repeat(12), length: 60 },
]
const plan = Array.from({ length: 60 }, (_, i) => ({ subject: i < 30 ? 'Letras' : 'Ciencias', weight: i < 30 ? 1 : 2 }))
const exception = (overrides = {}) => ({
  id: 1, area: '', tipo: 'P', questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '',
  reason: 'Mal formulada', documentRef: 'Acta 3', keySha256: 'a'.repeat(64), status: 'applied', message: '', ...overrides,
})
const distribution = (overrides = {}) => ({ A: 10, B: 5, C: 60, D: 5, E: 70, blank: 4, multiple: 0, total: 154, key: 'E', ...overrides })

function mountPanel(props = {}) {
  return mount(QuestionExceptionsPanel, {
    props: {
      exceptions: [], keyOptions, plan, correctValue: 10,
      getDistribution: vi.fn(() => distribution()),
      addException: vi.fn(async () => ({ ok: true })),
      revokeException: vi.fn(async () => ({ ok: true })),
      ...props,
    },
  })
}

async function open(wrapper) {
  await wrapper.find('.qe__bar').trigger('click')
}

async function fill(wrapper, { key = '|P', question = '5', type, reason = 'Mal formulada', letters = [] } = {}) {
  await wrapper.find('.qe__form select').setValue(key)
  await wrapper.find('.qe__form input[type="number"]').setValue(question)
  if (type) await wrapper.findAll('.qe__form select')[1].setValue(type)
  for (const letter of letters) {
    const box = wrapper.findAll('.qe__letter').find((l) => l.text() === letter)
    await box.find('input').setValue(true)
  }
  if (reason !== null) await wrapper.find('input[placeholder="Por qué se anula o corrige"]').setValue(reason)
}

describe('QuestionExceptionsPanel', () => {
  it('arranca colapsado y resume cuántas hay aplicadas y cuántas sin efecto', () => {
    const wrapper = mountPanel({ exceptions: [exception(), exception({ id: 2, questionNumber: 9, status: 'outdated', message: 'La clave cambió' })] })

    expect(wrapper.find('.qe__body').exists()).toBe(false)
    expect(wrapper.find('.qe__bar').text()).toContain('1 aplicada')
    expect(wrapper.find('.qe__bar').text()).toContain('1 sin efecto')
    expect(wrapper.find('.qe--attention').exists()).toBe(true)
  })

  it('lista las excepciones con su clave, motivo, documento y estado', async () => {
    const wrapper = mountPanel({ exceptions: [exception(), exception({ id: 2, questionNumber: 9, type: 'CLAVE_MULTIPLE', validAnswers: 'BD', status: 'outdated', message: 'La clave cambió desde que se registró la excepción; no se aplica.' })] })
    await open(wrapper)
    const table = wrapper.find('.qe__table').text()

    expect(table).toContain('Clave general · Tipo P')
    expect(table).toContain('Mal formulada')
    expect(table).toContain('Acta 3')
    expect(table).toContain('Aplicada')
    expect(table).toContain('Varias respuestas válidas: B, D')
    expect(table).toContain('Sin efecto')
    expect(table).toContain('La clave cambió')
  })

  it('muestra la materia, el peso y cómo respondieron los postulantes a la pregunta elegida', async () => {
    const getDistribution = vi.fn(() => distribution())
    const wrapper = mountPanel({ getDistribution })
    await open(wrapper)
    await fill(wrapper, { question: '40', reason: null })

    expect(wrapper.find('.qe__context').text()).toBe('Pregunta 40 · Ciencias · peso 2')
    expect(wrapper.find('.qe__dist').text()).toContain('C 60')
    expect(wrapper.find('.qe__dist').text()).toContain('Clave: E')
    expect(getDistribution).toHaveBeenLastCalledWith(keyOptions[0], 40)
  })

  it('advierte cuando casi nadie marcó la clave', async () => {
    const wrapper = mountPanel({ getDistribution: vi.fn(() => distribution({ E: 8, total: 154 })) })
    await open(wrapper)
    await fill(wrapper, { reason: null })

    expect(wrapper.find('.qe__warn').text()).toContain('Solo 8 de 154 marcaron la clave (E)')
  })

  it('no advierte cuando la clave es la respuesta más marcada', async () => {
    const wrapper = mountPanel()
    await open(wrapper)
    await fill(wrapper, { reason: null })
    expect(wrapper.find('.qe__warn').exists()).toBe(false)
  })

  describe('registrar', () => {
    it('no deja registrar sin motivo ni con una pregunta fuera de la clave', async () => {
      const wrapper = mountPanel()
      await open(wrapper)
      const submit = () => wrapper.find('button[type="submit"]')

      await fill(wrapper, { reason: '' })
      expect(submit().attributes('disabled')).toBeDefined()

      await fill(wrapper, { reason: 'Motivo', question: '61' })
      expect(submit().attributes('disabled')).toBeDefined()

      await fill(wrapper, { reason: 'Motivo', question: '5' })
      expect(submit().attributes('disabled')).toBeUndefined()
    })

    it('explica el efecto y pide confirmar en pantalla antes de guardar (sin diálogos del navegador)', async () => {
      const addException = vi.fn(async () => ({ ok: true }))
      const confirmSpy = vi.spyOn(window, 'confirm')
      const wrapper = mountPanel({ addException })
      await open(wrapper)
      await fill(wrapper, { question: '40' })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('.qe__confirm').text()).toContain('Todos los postulantes de esta clave recibirán el punto de la pregunta 40 (20.000 puntos)')
      expect(addException).not.toHaveBeenCalled()
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('al confirmar envía la clave, la pregunta, el tipo y el motivo', async () => {
      const addException = vi.fn(async () => ({ ok: true }))
      const wrapper = mountPanel({ addException })
      await open(wrapper)
      await fill(wrapper, { key: 'INGENIERÍAS|Q', question: '12', type: 'ANULADA_EXCLUIR', reason: ' Sin respuesta correcta ' })
      await wrapper.find('form').trigger('submit')

      await wrapper.find('.qe__confirm .qe__btn--primary').trigger('click')
      await flushPromises()

      expect(addException).toHaveBeenCalledWith({
        area: 'INGENIERÍAS', tipo: 'Q', questionNumber: 12, type: 'ANULADA_EXCLUIR', validAnswers: '',
        reason: 'Sin respuesta correcta', documentRef: '',
      })
    })

    it('cancelar no guarda nada', async () => {
      const addException = vi.fn(async () => ({ ok: true }))
      const wrapper = mountPanel({ addException })
      await open(wrapper)
      await fill(wrapper)
      await wrapper.find('form').trigger('submit')

      await wrapper.findAll('.qe__confirm .qe__btn').find((b) => b.text() === 'Cancelar').trigger('click')

      expect(addException).not.toHaveBeenCalled()
      expect(wrapper.find('.qe__confirm').exists()).toBe(false)
    })

    it('varias respuestas válidas exige al menos una letra y las envía juntas', async () => {
      const addException = vi.fn(async () => ({ ok: true }))
      const wrapper = mountPanel({ addException })
      await open(wrapper)
      await fill(wrapper, { type: 'CLAVE_MULTIPLE' })
      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

      await fill(wrapper, { type: 'CLAVE_MULTIPLE', letters: ['D', 'B'] })
      await wrapper.find('form').trigger('submit')
      expect(wrapper.find('.qe__confirm').text()).toContain('Se aceptarán como correctas: B, D')
      await wrapper.find('.qe__confirm .qe__btn--primary').trigger('click')
      await flushPromises()

      expect(addException).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLAVE_MULTIPLE', validAnswers: 'BD' }))
    })

    it('anular excluyendo avisa que no se reescalan los puntos', async () => {
      const wrapper = mountPanel()
      await open(wrapper)
      await fill(wrapper, { type: 'ANULADA_EXCLUIR' })
      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('.qe__confirm').text()).toContain('no se reescalan')
    })

    it('muestra el error del servidor y conserva lo escrito', async () => {
      const wrapper = mountPanel({ addException: vi.fn(async () => ({ ok: false, error: 'La pregunta 5 ya tiene una excepción para esta clave.' })) })
      await open(wrapper)
      await fill(wrapper)
      await wrapper.find('form').trigger('submit')
      await wrapper.find('.qe__confirm .qe__btn--primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').text()).toContain('ya tiene una excepción')
      expect(wrapper.find('input[placeholder="Por qué se anula o corrige"]').element.value).toBe('Mal formulada')
    })

    it('al registrar bien limpia el formulario', async () => {
      const wrapper = mountPanel()
      await open(wrapper)
      await fill(wrapper)
      await wrapper.find('form').trigger('submit')
      await wrapper.find('.qe__confirm .qe__btn--primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('input[placeholder="Por qué se anula o corrige"]').element.value).toBe('')
    })
  })

  describe('deshacer', () => {
    it('pide confirmación y revoca la excepción correcta', async () => {
      const revokeException = vi.fn(async () => ({ ok: true }))
      const wrapper = mountPanel({ exceptions: [exception({ id: 7 })], revokeException })
      await open(wrapper)

      await wrapper.find('.qe__table .qe__btn').trigger('click')
      expect(wrapper.find('.qe__ask').text()).toContain('¿Deshacer?')
      expect(revokeException).not.toHaveBeenCalled()

      await wrapper.find('.qe__ask .qe__btn--primary').trigger('click')
      await flushPromises()
      expect(revokeException).toHaveBeenCalledWith(7)
    })
  })

  it('sin claves cargadas indica qué hacer', async () => {
    const wrapper = mountPanel({ keyOptions: [] })
    await open(wrapper)
    expect(wrapper.text()).toContain('Carga una clave de respuestas')
  })
})
