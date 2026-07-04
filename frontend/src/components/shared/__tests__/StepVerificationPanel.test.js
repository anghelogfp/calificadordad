import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StepVerificationPanel from '../StepVerificationPanel.vue'

describe('StepVerificationPanel', () => {
  it('renderiza encabezado, resumen, acciones, chips y ayuda', () => {
    const wrapper = mount(StepVerificationPanel, {
      props: {
        eyebrow: 'Verificación de respuestas',
        title: 'Revisar respuestas antes de calificar',
        summary: '120 respuestas',
      },
      slots: {
        actions: '<button>Ver observados</button>',
        chips: '<span class="verification-chip verification-chip--warn"><strong>3</strong> sin DNI</span>',
        hint: 'Este cruce confirma la vinculación.',
      },
    })

    expect(wrapper.text()).toContain('Verificación de respuestas')
    expect(wrapper.text()).toContain('Revisar respuestas antes de calificar')
    expect(wrapper.text()).toContain('120 respuestas')
    expect(wrapper.text()).toContain('Ver observados')
    expect(wrapper.text()).toContain('3 sin DNI')
    expect(wrapper.text()).toContain('Este cruce confirma la vinculación.')
  })
})
