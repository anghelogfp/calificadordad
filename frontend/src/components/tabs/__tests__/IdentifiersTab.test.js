import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IdentifiersTab from '../IdentifiersTab.vue'

function makeIdentifiers(overrides = {}) {
  const rowOutside = {
    id: 'id-outside',
    lectura: '001',
    dni: '99999999',
    aula: '101',
    tipo: 'P',
    litho: '123456',
    observaciones: 'Sin observaciones',
  }
  const rowValid = {
    id: 'id-valid',
    lectura: '002',
    dni: '12345678',
    aula: '102',
    tipo: 'P',
    litho: '123457',
    observaciones: 'Sin observaciones',
  }

  return {
    totalRows: 2,
    identifierHasData: true,
    rows: [rowOutside, rowValid],
    pagedRows: [rowOutside, rowValid],
    observations: [],
    observationCount: 0,
    observationSummary: [],
    sources: [],
    selection: new Set(),
    editing: new Set(),
    isAllVisibleSelected: false,
    isSomeVisibleSelected: false,
    totalSelected: 0,
    pagination: { current: 1, total: 1, pageSize: 25, totalFiltered: 2 },
    ...overrides,
  }
}

describe('IdentifiersTab', () => {
  it('permite filtrar los DNI fuera del padrón al presionar el botón de filtro', async () => {
    const identifiers = makeIdentifiers()
    const reconciliation = {
      padronTotal: 1,
      identifiersTotal: 2,
      linkedIdentifierRows: 1,
      matchedCandidates: 1,
      missingIdentifiers: 0,
      identifiersWithoutCandidate: 1,
      verificationRows: [
        {
          dni: '99999999',
          candidate: null,
          identifier: identifiers.rows[0],
          issueCodes: ['IDENTIFIER_OUTSIDE_PADRON'],
        },
      ],
    }

    const wrapper = mount(IdentifiersTab, {
      props: {
        identifiers,
        subTab: 'list',
        reconciliation,
      },
      global: {
        stubs: {
          WorkflowIntroCard: true,
          FileUploader: true,
          Toolbar: true,
          SubTabs: true,
          EmptyState: true,
          SourcesPanel: true,
        },
      },
    })

    // El botón para ver fuera de padrón debe estar visible
    const outsideBtn = wrapper.find('.btn--warn')
    expect(outsideBtn.exists()).toBe(true)
    expect(outsideBtn.text()).toContain('Ver fuera del padrón (1)')

    // Al hacer clic, se activa el filtro
    await outsideBtn.trigger('click')

    // Debe mostrarse el banner informativo del filtro activo
    const banner = wrapper.find('.banner-filtro-activo--warn')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Filtrando DNI fuera del padrón oficial')

    // La tabla debe recibir únicamente la fila fuera del padrón
    const dataTable = wrapper.findComponent({ name: 'DataTable' })
    expect(dataTable.props('rows')).toHaveLength(1)
    expect(dataTable.props('rows')[0].dni).toBe('99999999')
    // Y paginación debe ser null para ver todos los resultados filtrados sin partir
    expect(dataTable.props('pagination')).toBeNull()

    // Al hacer clic en el botón del banner para quitar filtro, vuelve a mostrar todos
    const clearBtn = banner.find('button')
    await clearBtn.trigger('click')

    expect(wrapper.find('.banner-filtro-activo--warn').exists()).toBe(false)
    expect(dataTable.props('rows')).toHaveLength(2)
    expect(dataTable.props('pagination')).not.toBeNull()
  })
})
