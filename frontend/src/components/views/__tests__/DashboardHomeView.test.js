import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DashboardHomeView from '../DashboardHomeView.vue'

function mountDashboardHomeView() {
  return shallowMount(DashboardHomeView, {
    props: {
      history: {
        loading: ref(false),
        fetchHistory: vi.fn(),
        historyList: ref([
          {
            id: 'general',
            name: 'Simulacro general',
            type: 'simulacro',
            simulacroScope: 'general',
            savedAt: '2026-07-01T10:00:00.000Z',
            areaNames: ['General'],
            totalCandidates: 10,
          },
          {
            id: 'areas',
            name: 'Simulacro áreas',
            type: 'simulacro',
            simulacroScope: 'areas',
            savedAt: '2026-07-02T10:00:00.000Z',
            areaNames: ['Ingeniería'],
            totalCandidates: 20,
          },
          {
            id: 'real',
            name: 'Admisión real',
            type: 'real',
            simulacroScope: '',
            savedAt: '2026-07-03T10:00:00.000Z',
            areaNames: ['Biomédicas'],
            totalCandidates: 30,
          },
        ]),
      },
      areas: {
        areas: ref([]),
      },
      currentUser: 'Tester',
    },
  })
}

describe('DashboardHomeView', () => {
  beforeEach(() => {
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      now += 1000
      callback(now)
      return now
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra el modo específico de los procesos recientes', () => {
    const wrapper = mountDashboardHomeView()

    expect(wrapper.text()).toContain('Simulacro general')
    expect(wrapper.text()).toContain('Simulacro por áreas')
    expect(wrapper.text()).toContain('Convocatoria real')
  })
})
