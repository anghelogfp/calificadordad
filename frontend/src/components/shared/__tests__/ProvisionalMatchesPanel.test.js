import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProvisionalMatchesPanel from '../ProvisionalMatchesPanel.vue'

const preview = {
  rows: [
    {
      litho: '000910', aula: '101', dniRead: '63735500', reason: 'not-in-padron',
      suggestions: [{ dni: '63737500', paterno: 'SUCAPUCA', materno: 'CONDORI', nombres: 'LUIS', status: 'ok', provisionalScore: 543.43, wouldRank: 7 }],
    },
    {
      litho: '000942', aula: '101', dniRead: '61703136', reason: 'not-in-padron',
      suggestions: [{ dni: '61703135', paterno: 'A', materno: 'B', nombres: 'C', status: 'blocked-has-sheet', provisionalScore: null, wouldRank: null }],
    },
    { litho: '000999', aula: '102', dniRead: '99999999', reason: 'not-in-padron', suggestions: [] },
  ],
  summary: { orphanSheets: 3, withViableSuggestion: 1, onlyBlockedSuggestions: 1, withoutSuggestion: 1 },
}

describe('ProvisionalMatchesPanel', () => {
  it('no calcula nada hasta que se pide revisar', () => {
    const buildPreview = vi.fn(() => preview)
    const wrapper = mount(ProvisionalMatchesPanel, { props: { buildPreview } })
    expect(buildPreview).not.toHaveBeenCalled()
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('muestra el puntaje provisional solo para sugerencias viables', async () => {
    const wrapper = mount(ProvisionalMatchesPanel, { props: { buildPreview: () => preview } })
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('543.430')
    expect(wrapper.text()).toContain('PROVISIONAL')
    expect(wrapper.text()).toContain('Ese alumno ya tiene su propia hoja')
    expect(wrapper.text()).toContain('sin coincidencia parecida')
    expect(wrapper.findAll('.provisional-score')).toHaveLength(1)
  })

  it('avisa cuando no hay hojas sin alumno', async () => {
    const empty = { rows: [], summary: { orphanSheets: 0, withViableSuggestion: 0, onlyBlockedSuggestions: 0, withoutSuggestion: 0 } }
    const wrapper = mount(ProvisionalMatchesPanel, { props: { buildPreview: () => empty } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Todas las hojas cargadas tienen un DNI que está en el padrón')
  })

  it('muestra el error si la vista previa falla, sin romper la pantalla', async () => {
    const wrapper = mount(ProvisionalMatchesPanel, {
      props: { buildPreview: () => { throw new Error('plantilla inválida') } },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('plantilla inválida')
  })
})
