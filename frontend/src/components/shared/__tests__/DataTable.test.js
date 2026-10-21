import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from '../DataTable.vue'

describe('DataTable', () => {
  it('muestra contador de respuestas con estado visual', () => {
    const wrapper = shallowMount(DataTable, {
      props: {
        columns: [
          {
            key: 'answerCount',
            label: 'Conteo',
            type: 'answer-count',
          },
        ],
        rows: [
          {
            id: 'row-1',
            answerCount: '60/60',
            answerCountStatus: 'ok',
            answerCountTitle: 'Clave completa',
          },
          {
            id: 'row-2',
            answerCount: '59/60',
            answerCountStatus: 'warn',
            answerCountTitle: 'Clave incompleta',
          },
        ],
        showIndex: false,
        showCheckbox: false,
        showActions: false,
        selection: new Set(),
        editing: new Set(),
      },
    })

    expect(wrapper.find('.answer-count--ok').text()).toBe('60/60')
    expect(wrapper.find('.answer-count--warn').text()).toBe('59/60')
  })

  it('aplica column.formatter en columnas con badge', () => {
    const wrapper = shallowMount(DataTable, {
      props: {
        columns: [
          {
            key: 'observaciones',
            label: 'Observaciones',
            badge: true,
            formatter: (val, row) => (row.fuera ? `⚠️ Fuera de padrón · ${val}` : val),
          },
        ],
        rows: [
          { id: '1', observaciones: 'Sin observaciones', fuera: false },
          { id: '2', observaciones: 'Sin observaciones', fuera: true },
        ],
        showIndex: false,
        showCheckbox: false,
        showActions: false,
        selection: new Set(),
        editing: new Set(),
      },
    })

    const badges = wrapper.findAll('.badge')
    expect(badges[0].text()).toBe('Sin observaciones')
    expect(badges[0].classes()).toContain('badge--ok')
    expect(badges[1].text()).toBe('⚠️ Fuera de padrón · Sin observaciones')
    expect(badges[1].classes()).toContain('badge--warn')
  })
})

