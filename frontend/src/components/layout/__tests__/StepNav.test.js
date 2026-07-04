import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StepNav from '../StepNav.vue'

const tabs = [
  { key: 'archives', label: 'Paso 1 · Padrón Excel' },
  { key: 'responses', label: 'Paso 3 · Respuestas (.dat)' },
  { key: 'answer_keys', label: 'Paso 4 · Claves de respuestas' },
]

function mountStepNav(statusByKey = {}) {
  return mount(StepNav, {
    props: {
      tabs,
      activeTab: 'responses',
      getStepStatus: (key) => statusByKey[key] || 'pending',
      getStepLabel: (key) => tabs.find((tab) => tab.key === key)?.label.split(' · ')[1] || key,
      getStepDescription: (key) => `${key} detalle`,
      getStepAction: (key) => `${key} acción`,
    },
  })
}

describe('StepNav', () => {
  it('muestra estados y acciones por paso', () => {
    const wrapper = mountStepNav({
      archives: 'completed',
      responses: 'warning',
      answer_keys: 'pending',
    })

    expect(wrapper.text()).toContain('Listo')
    expect(wrapper.text()).toContain('Revisar')
    expect(wrapper.text()).toContain('Pendiente')
    expect(wrapper.text()).toContain('responses acción')
  })

  it('emite el paso seleccionado', async () => {
    const wrapper = mountStepNav()

    await wrapper.findAll('.step-item')[2].trigger('click')

    expect(wrapper.emitted('update:activeTab')?.[0]).toEqual(['answer_keys'])
  })
})
