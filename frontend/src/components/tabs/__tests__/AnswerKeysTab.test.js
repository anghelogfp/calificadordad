import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AnswerKeysTab from '../AnswerKeysTab.vue'
import { ANSWER_KEY_SUBTABS } from '@/constants'

function makeAnswerKeys(overrides = {}) {
  return {
    totalRows: 1,
    answerKeyHasData: true,
    sources: [],
    sourcesCount: 0,
    answerKeyAreaOptions: ['Biomédicas', 'Ingeniería'],
    observations: [],
    pagedRows: [],
    filteredRows: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0 },
    observationByRowId: new Map(),
    observationCount: 0,
    observationSummary: [],
    search: '',
    selection: new Set(),
    editing: new Set(),
    isAllVisibleSelected: false,
    isSomeVisibleSelected: false,
    selectedRows: new Set(),
    hasSelection: false,
    selectedCount: 0,
    totalSelected: 0,
    answerKeySearch: '',
    selectedSource: '',
    answerKeyArea: 'Ingeniería',
    identificationFile: null,
    responseFile: null,
    identificationInputRef: null,
    responseInputRef: null,
    detectedOffset: null,
    configuredResponseAnswersOffset: 7,
    importAnswerKeyFiles: vi.fn(),
    onAnswerKeyIdentificationChange: vi.fn(),
    onAnswerKeyResponseChange: vi.fn(),
    removeAnswerKeySource: vi.fn(),
    removeSelectedRows: vi.fn(),
    removeRow: vi.fn(),
    toggleSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    toggleEdit: vi.fn(),
    goToPage: vi.fn(),
    setPageSize: vi.fn(),
    clearAnswerKeys: vi.fn(),
    clearAllAnswerKeys: vi.fn(),
    removeSelected: vi.fn(),
    exportAnswerKeysToExcel: vi.fn(),
    exportAnswerKeyObservationsToExcel: vi.fn(),
    exportAnswerKeysObservationsPdf: vi.fn(),
    detectFormat: vi.fn(),
    ...overrides,
  }
}

function mountAnswerKeysTab(reconciliation) {
  return shallowMount(AnswerKeysTab, {
    props: {
      answerKeys: makeAnswerKeys(),
      subTab: ANSWER_KEY_SUBTABS.LIST,
      reconciliation,
    },
    global: {
      stubs: {
        WorkflowIntroCard: true,
        Toolbar: true,
        SubTabs: true,
        DataTable: true,
        SourcesPanel: true,
        EmptyState: true,
      },
    },
  })
}

describe('AnswerKeysTab', () => {
  it('muestra la verificación de claves con pares faltantes', () => {
    const wrapper = mountAnswerKeysTab({
      status: 'warn',
      keysTotal: 2,
      coveredPairs: 1,
      missingPairs: [
        { area: 'Ingeniería', type: 'Q' },
        { area: 'Biomédicas', type: 'P' },
      ],
      generalKeys: 0,
      duplicatePairs: 0,
      incompleteKeys: 1,
    })

    expect(wrapper.find('.step-state-panel--error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Estado de claves')
    expect(wrapper.text()).toContain('Corregir claves faltantes o duplicadas')
    expect(wrapper.text()).toContain('2 pares faltantes')
    expect(wrapper.text()).toContain('Ingeniería Q')
    expect(wrapper.text()).toContain('Biomédicas P')
  })

  it('muestra cobertura de áreas aunque todavía no haya claves cargadas', () => {
    const wrapper = mountAnswerKeysTab({
      status: 'ok',
      keysTotal: 0,
      coveredPairs: 0,
      missingPairs: [],
      generalKeys: 0,
      duplicatePairs: 0,
      incompleteKeys: 0,
    })

    expect(wrapper.find('.step-state-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('0 / 2 áreas con clave')
  })
})
