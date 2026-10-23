import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OutsidePadronPanel from '../OutsidePadronPanel.vue'

const item = (overrides = {}) => ({
  rowId: 'a', litho: '000910', aula: '101', dniRead: '63735500', reason: 'outside', confirmedDni: '',
  suggestions: [{ dni: '63737500', paterno: 'SUCAPUCA', materno: 'CONDORI', nombres: 'LUIS MANUEL', taken: false }],
  ...overrides,
})
const summary = { outside: 1, incomplete: 0, withViableSuggestion: 1, withoutSuggestion: 0, confirmed: 0 }

const mountPanel = (items, extra = {}) => mount(OutsidePadronPanel, { props: { items, summary, ...extra } })

describe('OutsidePadronPanel', () => {
  it('muestra el DNI leído, el motivo y el alumno posible', () => {
    const text = mountPanel([item()]).text()

    expect(text).toContain('000910')
    expect(text).toContain('63735500')
    expect(text).toContain('No está en el padrón')
    expect(text).toContain('63737500')
    expect(text).toContain('SUCAPUCA CONDORI LUIS MANUEL')
  })

  it('deja claro que es una pista y no una confirmación', () => {
    expect(mountPanel([item()]).text()).toContain('solo una pista')
  })

  it('marca el DNI incompleto', () => {
    expect(mountPanel([item({ dniRead: '8088022', reason: 'incomplete' })]).text()).toContain('DNI incompleto')
  })

  it('avisa cuando el alumno posible ya tiene su propia ficha', () => {
    const taken = item({ suggestions: [{ dni: '63737500', paterno: 'A', materno: 'B', nombres: 'C', taken: true }] })
    expect(mountPanel([taken]).text()).toContain('ya tiene su propia ficha')
  })

  it('dice cuando no hay ningún parecido', () => {
    expect(mountPanel([item({ suggestions: [] })]).text()).toContain('Sin coincidencia parecida')
  })

  it('muestra la corrección ya confirmada en lugar de la sugerencia', () => {
    const text = mountPanel([item({ confirmedDni: '63737500' })], { summary: { ...summary, confirmed: 1 } }).text()
    expect(text).toContain('Corrección confirmada: 63737500')
    expect(text).toContain('1 ya confirmadas')
  })

  it('pagina de 10 en 10', () => {
    const many = Array.from({ length: 23 }, (_, i) => item({ rowId: `r${i}`, litho: String(i).padStart(6, '0') }))
    const wrapper = mountPanel(many)

    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    expect(wrapper.text()).toContain('1–10 de 23')
  })

  it('adapta el texto al tipo de ficha', () => {
    expect(mountPanel([item()]).text()).toContain('Estas fichas traen')
    expect(mountPanel([item()], { nounPlural: 'hojas de respuestas' }).text()).toContain('Estas hojas de respuestas traen')
  })
})
