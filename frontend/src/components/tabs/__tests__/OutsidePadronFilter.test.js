import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import IdentifiersTab from '../IdentifiersTab.vue'
import ResponsesTab from '../ResponsesTab.vue'
import OutsidePadronPanel from '@/components/shared/OutsidePadronPanel.vue'
import DataTable from '@/components/shared/DataTable.vue'
import { IDENTIFIER_SUBTABS, RESPONSES_SUBTABS } from '@/constants'

const padron = [
  { dni: '11111111', paterno: 'OFICIAL', materno: 'A', nombres: 'UNO' },
  { dni: '63737500', paterno: 'SUCAPUCA', materno: 'CONDORI', nombres: 'LUIS MANUEL' },
]

// Fichas: una vinculada, una con un dígito mal marcado, una sin parecido.
const makeRows = () => [
  { id: 'r1', dni: '11111111', litho: '000001', aula: '101', observaciones: 'Sin observaciones' },
  { id: 'r2', dni: '63735500', litho: '000910', aula: '101', observaciones: 'Sin observaciones' },
  { id: 'r3', dni: '99999999', litho: '000999', aula: '102', observaciones: 'Sin observaciones' },
]

function makeIdentifiers(rows = makeRows(), overrides = {}) {
  return {
    rows,
    pagedRows: rows.slice(0, 1), // lo que mostraría la paginación normal
    observations: [],
    observationCount: 0,
    observationSummary: [],
    observationByRowId: new Map(),
    identifierHasData: true,
    sources: [],
    totalRows: rows.length,
    totalFiltered: rows.length,
    totalSelected: 0,
    selection: new Set(),
    editing: new Set(),
    isAllVisibleSelected: false,
    isSomeVisibleSelected: false,
    pagination: { page: 1, pageSize: 10 },
    search: '',
    isDragging: false,
    importError: '',
    ...overrides,
  }
}

function makeResponses(rows = makeRows(), overrides = {}) {
  return {
    ...makeIdentifiers(rows),
    filteredRows: rows,
    actionableObservations: [],
    actionableObservationCount: 0,
    responsesHasData: true,
    expectedAnswersLength: 60,
    ...overrides,
  }
}

const stubs = {
  WorkflowIntroCard: true, FileUploader: true, Toolbar: true, SubTabs: true, SourcesPanel: true, EmptyState: true,
  AnswerSheetPreviewModal: true, DataTable: true, StepVerificationPanel: false,
}

function mountIdentifiers(props = {}) {
  return shallowMount(IdentifiersTab, {
    props: {
      identifiers: makeIdentifiers(), subTab: IDENTIFIER_SUBTABS.LIST ?? 'list',
      reconciliation: { padronTotal: 2, identifiersTotal: 3, linkedIdentifierRows: 1, identifiersWithoutCandidate: 2, matchedCandidates: 1, missingIdentifiers: 1 },
      archiveRows: padron, ...props,
    },
    global: { stubs },
  })
}

function mountResponses(props = {}) {
  return shallowMount(ResponsesTab, {
    props: {
      responses: makeResponses(), subTab: RESPONSES_SUBTABS.LIST ?? 'list', identifiersLoaded: true, linkedCount: 1,
      reconciliation: { padronTotal: 2, responsesTotal: 3, linkedResponses: 3, responsesWithoutCandidate: 2, candidatesWithoutResponse: 1 },
      archiveRows: padron, ...props,
    },
    global: { stubs },
  })
}

const tableRows = (wrapper) => wrapper.findComponent(DataTable).props('rows').map((row) => row.id)
const filterButton = (wrapper) => wrapper.findAll('button').find((b) => /DNI sin alumno|Ver todos/.test(b.text()) && !/observados/i.test(b.text()))

describe.each([
  ['Identificadores', mountIdentifiers],
  ['Respuestas', mountResponses],
])('filtro "DNI sin alumno" en %s', (_name, mountTab) => {
  it('ofrece el botón con el número de fichas que no coinciden con nadie', () => {
    const wrapper = mountTab()
    expect(filterButton(wrapper).text()).toBe('Ver DNI sin alumno (2)')
  })

  it('no ofrece el botón si todas las fichas están en el padrón', () => {
    const wrapper = mountTab(_name === 'Identificadores'
      ? { identifiers: makeIdentifiers([makeRows()[0]]) }
      : { responses: makeResponses([makeRows()[0]]) })
    expect(wrapper.text()).not.toContain('DNI sin alumno')
  })

  it('no ofrece el botón si todavía no hay padrón (no habría con qué comparar)', () => {
    expect(mountTab({ archiveRows: [] }).text()).not.toContain('DNI sin alumno')
  })

  it('al activarlo muestra solo esas fichas y el panel con la pista', async () => {
    const wrapper = mountTab()
    expect(tableRows(wrapper)).toEqual(['r1']) // vista normal: la página actual

    await filterButton(wrapper).trigger('click')

    expect(tableRows(wrapper)).toEqual(['r2', 'r3'])
    const panel = wrapper.findComponent(OutsidePadronPanel)
    expect(panel.exists()).toBe(true)
    expect(panel.props('items').map((i) => i.litho)).toEqual(['000910', '000999'])
    expect(panel.props('items')[0].suggestions[0]).toMatchObject({ dni: '63737500', paterno: 'SUCAPUCA' })
  })

  it('al volver a pulsar regresa a la vista normal', async () => {
    const wrapper = mountTab()
    await filterButton(wrapper).trigger('click')
    await filterButton(wrapper).trigger('click')

    expect(wrapper.findComponent(OutsidePadronPanel).exists()).toBe(false)
    expect(tableRows(wrapper)).toEqual(['r1'])
  })

  it('resalta las fichas fuera del padrón en la tabla', () => {
    const wrapper = mountTab()
    const getRowClass = wrapper.findComponent(DataTable).props('rowClass')

    expect(getRowClass({ id: 'r2' })['row--outside-padron']).toBe(true)
    expect(getRowClass({ id: 'r1' })['row--outside-padron']).toBe(false)
  })

  it('muestra una corrección ya confirmada en el panel', async () => {
    const wrapper = mountTab({ dniCorrections: [{ litho: '000910', originalDni: '63735500', correctedDni: '63737500' }] })
    await filterButton(wrapper).trigger('click')

    expect(wrapper.findComponent(OutsidePadronPanel).props('items')[0].confirmedDni).toBe('63737500')
  })

  it('se apaga solo cuando ya no quedan fichas por revisar', async () => {
    const identifiers = makeIdentifiers()
    const responses = makeResponses()
    const wrapper = mountTab(_name === 'Identificadores' ? { identifiers } : { responses })
    await filterButton(wrapper).trigger('click')
    expect(wrapper.findComponent(OutsidePadronPanel).exists()).toBe(true)

    // Se corrige el DNI de las dos fichas: ahora coinciden con el padrón.
    await wrapper.setProps({ archiveRows: [...padron, { dni: '63735500', paterno: 'A', materno: 'B', nombres: 'C' }, { dni: '99999999', paterno: 'D', materno: 'E', nombres: 'F' }] })

    expect(wrapper.findComponent(OutsidePadronPanel).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('DNI sin alumno')
  })
})

describe('Identificadores: el filtro no se pisa con "Ver observados"', () => {
  it('activar uno apaga el otro', async () => {
    const rows = makeRows()
    const identifiers = makeIdentifiers(rows, { observationCount: 1, observations: [rows[0]], observationByRowId: new Map([['r1', 'x']]) })
    const wrapper = mountIdentifiers({ identifiers })
    const observed = () => wrapper.findAll('button').find((b) => /observados/i.test(b.text()) && !/Exportar/.test(b.text()))

    await observed().trigger('click')
    expect(tableRows(wrapper)).toEqual(['r1'])

    await filterButton(wrapper).trigger('click')
    expect(tableRows(wrapper)).toEqual(['r2', 'r3'])
    expect(observed().text()).toBe('Ver observados')
  })
})
