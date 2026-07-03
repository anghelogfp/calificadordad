import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import ScoresTab from '../ScoresTab.vue'

function makeCalification(overrides = {}) {
  return {
    calificationHasResults: true,
    calificationResults: [
      {
        id: 'row-1',
        position: 1,
        dni: '12345678',
        paterno: 'Valido',
        materno: '',
        nombres: 'Postulante',
        programa: 'Civil',
        score: 100,
        isIngresante: false,
      },
    ],
    calificationFilteredResults: [
      {
        id: 'row-1',
        position: 1,
        dni: '12345678',
        paterno: 'Valido',
        materno: '',
        nombres: 'Postulante',
        programa: 'Civil',
        score: 100,
        isIngresante: false,
      },
    ],
    calificationSearch: '',
    calificationDisplayArea: 'Ingeniería',
    calificationSummary: {
      area: 'Ingeniería',
      timestamp: '2026-07-02T12:00:00.000Z',
      totalCandidates: 2,
      totalWeight: 60,
      answersLength: 60,
      missingResponses: 1,
      missingKeys: 0,
      duplicateResponses: 0,
      invalidCandidates: 0,
      missingPrograms: 0,
      invalidResponseTypes: 0,
      unlinkedResponses: 0,
      noCalificados: [
        {
          dni: '87654321',
          paterno: 'Sin',
          materno: 'Respuesta',
          nombres: 'Alumno',
          area: 'Ingeniería',
          programa: 'Civil',
          motivo: 'Sin respuesta',
          detalle: 'No se encontró respuesta vinculada al postulante.',
        },
      ],
    },
    processName: 'Proceso de prueba',
    processAreas: ['Ingeniería'],
    activeProcess: {
      type: 'simulacro',
      areas: {
        Ingeniería: {
          results: [],
          summary: null,
        },
      },
    },
    canCalify: true,
    startNewProcess: vi.fn(),
    resetCalificationResults: vi.fn(),
    switchDisplayArea: vi.fn(),
    ...overrides,
  }
}

function mountScoresTab(calification = makeCalification()) {
  return shallowMount(ScoresTab, {
    props: {
      calification,
      ponderations: {
        ponderationCurrentTotals: { questions: 60 },
      },
      dashboard: {
        statsByArea: ref(new Map([
          ['Ingeniería', { count: 1, ingresantes: 0, avg: 100, max: 100, min: 100 }],
        ])),
      },
      exporter: {
        exportScoresToExcel: vi.fn(),
        exportScoresToPdf: vi.fn(),
        exportIngresantesPdf: vi.fn(),
      },
      convocatoriaName: 'Convocatoria',
      vacantesPrograma: {
        vacantesPrograma: ref({}),
      },
    },
    global: {
      stubs: {
        StepInfoCard: true,
        Toolbar: true,
        CandidateDetailModal: true,
        PaginationBar: true,
      },
    },
  })
}

describe('ScoresTab', () => {
  it('muestra el detalle de no calificados cuando el resumen lo incluye', () => {
    const wrapper = mountScoresTab()

    expect(wrapper.find('.not-qualified-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 postulante(s) quedaron fuera del cálculo')
    expect(wrapper.text()).toContain('Sin respuesta')
    expect(wrapper.text()).toContain('87654321')
    expect(wrapper.text()).toContain('No se encontró respuesta vinculada al postulante.')
  })

  it('no muestra el empty state si ya existen resultados calculados', () => {
    const wrapper = mountScoresTab()

    expect(wrapper.text()).not.toContain('Sin resultados de calificación')
    expect(wrapper.find('.table-wrapper').exists()).toBe(true)
  })
})
