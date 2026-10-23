import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import ScoresTab from '../ScoresTab.vue'
import ReviewPanel from '@/components/shared/ReviewPanel.vue'

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
      sheetsWithoutCandidate: 3,
      configSha256: 'abcdef0123456789'.repeat(4),
      dataSha256: '0123456789abcdef'.repeat(4),
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
        exportReviewListToExcel: vi.fn(),
        exportSimulacroAreasToExcel: vi.fn(),
        exportScoresToPdf: vi.fn(),
        exportSimulacroAreasToPdf: vi.fn(),
        exportIngresantesPdf: vi.fn(),
      },
      convocatoriaName: 'Convocatoria',
      vacantesPrograma: {
        vacantesPrograma: ref({}),
      },
      onSaveToHistory: vi.fn(),
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
  it('entrega al panel de revisión los no calificados y las hojas sin alumno', () => {
    const wrapper = mountScoresTab()
    const review = wrapper.findComponent(ReviewPanel)

    expect(review.exists()).toBe(true)
    expect(review.props('noCalificados')).toHaveLength(1)
    expect(review.props('orphanSheetCount')).toBe(3)
  })

  it('muestra cada cifra una sola vez en la franja de estado', () => {
    const wrapper = mountScoresTab()

    expect(wrapper.find('.summary-strip').text()).toContain('Calificados de 2')
    expect(wrapper.text()).not.toContain('Observaciones')
    expect(wrapper.text()).not.toContain('quedaron fuera del cálculo')
  })

  it('el botón de descarga exporta solo la lista de revisión', async () => {
    const wrapper = mountScoresTab()
    const exporter = wrapper.vm.$props.exporter
    wrapper.findComponent(ReviewPanel).vm.$emit('export', { orphanRows: [{ litho: '1' }] })

    expect(exporter.exportReviewListToExcel).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ dni: '87654321' })]),
      [{ litho: '1' }],
      'Convocatoria',
      { area: 'Ingeniería' },
    )
    expect(exporter.exportScoresToExcel).not.toHaveBeenCalled()
  })

  it('muestra las huellas SHA-256 del cálculo en los detalles técnicos', () => {
    const wrapper = mountScoresTab()
    const details = wrapper.find('.calculation-details').text()

    expect(details).toContain('Huella de configuración (SHA-256)')
    expect(details).toContain('ABCDEF01 23456789')
    expect(details).toContain('Huella de datos (SHA-256)')
    expect(details).toContain('01234567 89ABCDEF')
  })

  it('un resultado anterior a las huellas muestra un guion', () => {
    const calification = makeCalification()
    delete calification.calificationSummary.configSha256
    delete calification.calificationSummary.dataSha256
    const details = mountScoresTab(calification).find('.calculation-details').text()

    expect(details).toMatch(/Huella de configuración \(SHA-256\):\s*—/)
  })

  it('no muestra el empty state si ya existen resultados calculados', () => {
    const wrapper = mountScoresTab()

    expect(wrapper.text()).not.toContain('Sin resultados de calificación')
    expect(wrapper.find('.table-wrapper').exists()).toBe(true)
  })

  it('muestra el estado guardado cuando el proceso ya fue persistido', async () => {
    const wrapper = mountScoresTab()

    expect(wrapper.text()).toContain('Pendiente de guardar')
    expect(wrapper.text()).toContain('Guardar')

    await wrapper.setProps({ isSavedToHistory: true })

    expect(wrapper.text()).toContain('Guardado en historial')
    expect(wrapper.text()).not.toContain('Pendiente de guardar')
  })
})
