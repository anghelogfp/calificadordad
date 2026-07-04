import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NuevoProcesoModal from '../NuevoProcesoModal.vue'

function mountModal() {
  return mount(NuevoProcesoModal, {
    props: {
      show: true,
      hasData: false,
      areasCount: 2,
      plantillasCount: 1,
    },
    global: {
      stubs: {
        Teleport: true,
        Transition: false,
      },
    },
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('NuevoProcesoModal', () => {
  it('exige elegir el camino del proceso', async () => {
    const wrapper = mountModal()

    await wrapper.find('#proc-name').setValue('Simulacro marzo')
    await buttonByText(wrapper, 'Iniciar proceso').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.text()).toContain('Selecciona el camino del proceso')
  })

  it('emite simulacro con alcance general', async () => {
    const wrapper = mountModal()

    await wrapper.find('#proc-name').setValue('Simulacro general')
    await buttonByText(wrapper, 'Simulacro general').trigger('click')
    await buttonByText(wrapper, 'Iniciar proceso').trigger('click')

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual({
      name: 'Simulacro general',
      type: 'simulacro',
      simulacroScope: 'general',
    })
  })

  it('no exige alcance para convocatoria real', async () => {
    const wrapper = mountModal()

    await wrapper.find('#proc-name').setValue('Admisión real')
    await buttonByText(wrapper, 'Convocatoria real').trigger('click')
    await buttonByText(wrapper, 'Iniciar proceso').trigger('click')

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual({
      name: 'Admisión real',
      type: 'real',
      simulacroScope: '',
    })
  })
})
