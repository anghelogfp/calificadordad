import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import HistoryView from '../HistoryView.vue'

function mountHistoryView() {
  return shallowMount(HistoryView, {
    props: {
      history: {
        loading: ref(false),
        historyList: ref([
          {
            id: 'general',
            name: 'Simulacro general',
            type: 'simulacro',
            simulacroScope: 'general',
            savedAt: '2026-07-01T10:00:00.000Z',
            areaNames: ['General'],
            totalCandidates: 10,
            areas: {},
          },
          {
            id: 'areas',
            name: 'Simulacro áreas',
            type: 'simulacro',
            simulacroScope: 'areas',
            savedAt: '2026-07-02T10:00:00.000Z',
            areaNames: ['Ingeniería'],
            totalCandidates: 20,
            areas: {},
          },
          {
            id: 'real',
            name: 'Admisión real',
            type: 'real',
            simulacroScope: '',
            savedAt: '2026-07-03T10:00:00.000Z',
            areaNames: ['Biomédicas'],
            totalCandidates: 30,
            areas: {},
          },
        ]),
        deleteProcess: vi.fn(),
      },
    },
    global: {
      stubs: {
        StepInfoCard: true,
        EmptyState: true,
        PaginationBar: true,
      },
    },
  })
}

describe('HistoryView', () => {
  it('distingue simulacro general, simulacro por áreas y convocatoria real', () => {
    const wrapper = mountHistoryView()

    expect(wrapper.text()).toContain('Simulacro general')
    expect(wrapper.text()).toContain('Simulacro por áreas')
    expect(wrapper.text()).toContain('Convocatoria real')
  })
})
