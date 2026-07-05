import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AnswerSheetPreview from '../AnswerSheetPreview.vue'

describe('AnswerSheetPreview', () => {
  it('preserva posiciones cuando hay respuestas en blanco intermedias', () => {
    const wrapper = mount(AnswerSheetPreview, {
      props: {
        answers: 'A C',
        totalQuestions: 3,
        mode: 'inspect-answers',
      },
    })

    const rows = wrapper.findAll('.sheet-row')
    expect(rows[0].find('.bubble--marked').text()).toBe('A')
    expect(rows[1].find('.bubble--marked').exists()).toBe(false)
    expect(rows[2].find('.bubble--marked').text()).toBe('C')
  })

  it('muestra marcas múltiples como estado propio', () => {
    const wrapper = mount(AnswerSheetPreview, {
      props: {
        answers: '*A',
        totalQuestions: 2,
        mode: 'inspect-answers',
      },
    })

    const rows = wrapper.findAll('.sheet-row')
    expect(rows[0].classes()).toContain('sheet-row--multiple')
    expect(rows[0].find('.sheet-row__multiple').text()).toBe('*')
    expect(rows[0].findAll('.bubble--marked')).toHaveLength(0)
    expect(rows[1].find('.bubble--marked').text()).toBe('A')
  })
})
