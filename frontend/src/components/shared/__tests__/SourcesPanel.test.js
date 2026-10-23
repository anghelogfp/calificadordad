import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SourcesPanel from '../SourcesPanel.vue'

const HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

const source = (overrides = {}) => ({
  id: 's1', name: 'resp.dat', timestamp: '2026-10-22T12:00:00.000Z', validRows: 10, errorCount: 0, totalLines: 10, sha256: HASH, ...overrides,
})

describe('SourcesPanel: huella del archivo', () => {
  it('muestra el inicio del SHA-256 y el completo en el tooltip', () => {
    const wrapper = mount(SourcesPanel, { props: { sources: [source()] } })
    const cell = wrapper.find('.sources-hash')

    expect(cell.text()).toBe('ba7816bf8f01…')
    expect(cell.attributes('title')).toBe(`SHA-256 completo: ${HASH}`)
  })

  it('muestra un guion cuando el archivo se cargó sin huella', () => {
    const wrapper = mount(SourcesPanel, { props: { sources: [source({ sha256: '' })] } })
    const cell = wrapper.find('.sources-hash')

    expect(cell.text()).toBe('—')
    expect(cell.attributes('title')).toBeUndefined()
  })

  it('las columnas personalizadas pueden pedir la huella', () => {
    const wrapper = mount(SourcesPanel, {
      props: { sources: [source()], columns: [{ key: 'name', label: 'Archivo' }, { key: 'sha256', label: 'SHA', format: 'hash' }] },
    })

    expect(wrapper.find('thead').text()).toContain('SHA')
    expect(wrapper.find('.sources-hash').text()).toBe('ba7816bf8f01…')
  })
})
