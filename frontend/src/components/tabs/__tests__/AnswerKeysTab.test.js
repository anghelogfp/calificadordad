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
    expectedAnswersLength: 60,
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

function mountAnswerKeysTab(reconciliation, props = {}) {
  return shallowMount(AnswerKeysTab, {
    props: {
      answerKeys: makeAnswerKeys(),
      subTab: ANSWER_KEY_SUBTABS.LIST,
      reconciliation,
      ...props,
    },
    global: {
      stubs: {
        WorkflowIntroCard: true,
        Toolbar: true,
        SubTabs: true,
        DataTable: true,
        SourcesPanel: true,
        EmptyState: true,
        ProcessPathCard: true,
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

  it('acepta clave general para simulacro sin exigir claves por área', () => {
    const wrapper = mountAnswerKeysTab({
      status: 'ok',
      keysTotal: 1,
      coveredPairs: 1,
      missingPairs: [],
      generalKeys: 1,
      duplicatePairs: 0,
      incompleteKeys: 0,
      mode: 'simulacro-general',
      generalKeyCoversSimulacro: true,
    })

    expect(wrapper.find('.step-state-panel--ok').exists()).toBe(true)
    expect(wrapper.text()).toContain('Clave general activa')
    expect(wrapper.text()).toContain('la clave general cubre el ranking completo')
    expect(wrapper.text()).not.toContain('Falta Biomédicas')
    expect(wrapper.text()).not.toContain('Falta Ingeniería')
  })

  it('bloquea clave general cuando el proceso es simulacro por áreas', () => {
    const wrapper = mountAnswerKeysTab({
      status: 'warn',
      keysTotal: 0,
      coveredPairs: 0,
      missingPairs: [],
      generalKeys: 0,
      duplicatePairs: 0,
      incompleteKeys: 0,
      mode: 'simulacro-areas',
      generalKeyCoversSimulacro: false,
    }, {
      processType: 'simulacro',
      simulacroScope: 'areas',
    })

    const buttons = wrapper.findAll('.key-mode-btn')
    expect(buttons[0].attributes('disabled')).toBeDefined()
    expect(buttons[1].attributes('disabled')).toBeUndefined()
    expect(buttons[1].classes()).toContain('key-mode-btn--active')
    expect(wrapper.text()).toContain('Este modo viene del camino definido al crear el proceso.')
  })

  it('bloquea carga por área cuando el proceso es simulacro general', () => {
    const wrapper = mountAnswerKeysTab({
      status: 'ok',
      keysTotal: 1,
      coveredPairs: 1,
      missingPairs: [],
      generalKeys: 1,
      duplicatePairs: 0,
      incompleteKeys: 0,
      mode: 'simulacro-general',
      generalKeyCoversSimulacro: true,
    }, {
      processType: 'simulacro',
      simulacroScope: 'general',
    })

    const buttons = wrapper.findAll('.key-mode-btn')
    expect(buttons[0].attributes('disabled')).toBeUndefined()
    expect(buttons[0].classes()).toContain('key-mode-btn--active')
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })
})
