import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProcessPathBadge from '../ProcessPathBadge.vue'

describe('ProcessPathBadge', () => {
  it('muestra simulacro general', () => {
    const wrapper = mount(ProcessPathBadge, {
      props: { processType: 'simulacro', simulacroScope: 'general' },
    })

    expect(wrapper.text()).toBe('Simulacro general')
    expect(wrapper.classes()).toContain('process-path-badge--simulacro')
  })

  it('muestra convocatoria real', () => {
    const wrapper = mount(ProcessPathBadge, {
      props: { processType: 'real', simulacroScope: '' },
    })

    expect(wrapper.text()).toBe('Convocatoria real')
    expect(wrapper.classes()).toContain('process-path-badge--real')
  })
})
