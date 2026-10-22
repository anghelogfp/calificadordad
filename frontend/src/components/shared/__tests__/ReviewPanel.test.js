import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewPanel from '../ReviewPanel.vue'

const missing = (n) => Array.from({ length: n }, (_, i) => ({
  dni: String(70000000 + i), paterno: `AP${i}`, materno: 'M', nombres: 'N',
  area: 'General', programa: '', motivo: 'Sin respuesta .dat', detalle: 'No se encontró una hoja de respuestas vinculada al DNI.',
}))

const preview = {
  rows: [
    {
      litho: '000910', aula: '101', dniRead: '63735500', reason: 'not-in-padron',
      suggestions: [{ dni: '63737500', paterno: 'SUCAPUCA', materno: 'CONDORI', nombres: 'LUIS', status: 'ok', provisionalScore: 543.43, wouldRank: 7 }],
    },
    {
      litho: '000942', aula: '101', dniRead: '61703136', reason: 'not-in-padron',
      suggestions: [{ dni: '61703135', paterno: 'A', materno: 'B', nombres: 'C', status: 'blocked-has-sheet', provisionalScore: null, wouldRank: null }],
    },
    { litho: '000999', aula: '102', dniRead: '99999999', reason: 'not-in-padron', suggestions: [] },
  ],
  summary: { orphanSheets: 3 },
}

function mountPanel(props = {}) {
  return mount(ReviewPanel, {
    props: { noCalificados: missing(129), orphanSheetCount: 27, buildPreview: () => preview, ...props },
  })
}

describe('ReviewPanel', () => {
  it('no se muestra si no hay nada que revisar', () => {
    const wrapper = mountPanel({ noCalificados: [], orphanSheetCount: 0 })
    expect(wrapper.find('.review').exists()).toBe(false)
  })

  it('arranca colapsado y resume cada cifra una vez', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.review__body').exists()).toBe(false)
    expect(wrapper.find('.review__bar').text()).toContain('27 hojas sin alumno')
    expect(wrapper.find('.review__bar').text()).toContain('129 alumnos sin hoja')
  })

  it('usa el singular cuando hay una sola incidencia', () => {
    const wrapper = mountPanel({ noCalificados: missing(1), orphanSheetCount: 1 })
    expect(wrapper.find('.review__bar').text()).toContain('1 hoja sin alumno')
    expect(wrapper.find('.review__bar').text()).toContain('1 alumno sin hoja')
  })

  it('si solo faltan hojas no habla de errores ni pide acción', () => {
    const wrapper = mountPanel({ orphanSheetCount: 0 })
    expect(wrapper.find('.review--action').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alumnos sin hoja de respuestas')
  })

  it('al abrir muestra primero lo que requiere acción', async () => {
    const wrapper = mountPanel()
    await wrapper.find('.review__bar').trigger('click')
    expect(wrapper.find('.review__tab--active').text()).toContain('Hojas sin alumno')
    expect(wrapper.text()).toContain('543.430')
    expect(wrapper.text()).toContain('PROVISIONAL')
    expect(wrapper.text()).toContain('Ese alumno ya tiene su propia hoja')
  })

  it('pagina la lista de 129 alumnos sin hoja en bloques de 10', async () => {
    const wrapper = mountPanel({ orphanSheetCount: 0 })
    await wrapper.find('.review__bar').trigger('click')

    expect(wrapper.findAll('.review__table tbody tr')).toHaveLength(10)
    expect(wrapper.text()).toContain('1–10 de 129')

    await wrapper.find('.pagination-bar__controls button:last-child').trigger('click')
    expect(wrapper.text()).toContain('11–20 de 129')
  })

  it('busca por DNI o nombre y vuelve a la primera página', async () => {
    const wrapper = mountPanel({ orphanSheetCount: 0 })
    await wrapper.find('.review__bar').trigger('click')
    await wrapper.find('.review__search input').setValue('70000005')

    expect(wrapper.findAll('.review__table tbody tr')).toHaveLength(1)
    expect(wrapper.text()).toContain('70000005')
  })

  it('solo remite a "Hojas sin alumno" si esa pestaña existe', async () => {
    const without = mountPanel({ orphanSheetCount: 0 })
    await without.find('.review__bar').trigger('click')
    expect(without.text()).not.toContain('Hojas sin alumno')

    const withOrphans = mountPanel()
    await withOrphans.find('.review__bar').trigger('click')
    await withOrphans.findAll('.review__tab')[1].trigger('click')
    expect(withOrphans.text()).toContain('revisa “Hojas sin alumno”')
  })

  it('no repite el motivo ni el detalle en 129 filas iguales', async () => {
    const wrapper = mountPanel({ orphanSheetCount: 0 })
    await wrapper.find('.review__bar').trigger('click')
    expect(wrapper.find('.review__table thead').text()).not.toContain('Motivo')
    expect(wrapper.find('.review__table tbody').text()).not.toContain('No se encontró una hoja')
  })

  it('las otras incidencias muestran motivo y qué hacer con lenguaje claro', async () => {
    const other = [{
      dni: '1234567', paterno: 'X', materno: 'Y', nombres: 'Z', area: 'General',
      motivo: 'DNI incompleto (7/8)', detalle: 'Corrige el DNI en el padrón.',
    }]
    const wrapper = mountPanel({ noCalificados: [...missing(2), ...other], orphanSheetCount: 0 })
    await wrapper.find('.review__bar').trigger('click')

    expect(wrapper.find('.review__tab--active').text()).toContain('Otras incidencias')
    expect(wrapper.find('.review__table').text()).toContain('DNI incompleto (7/8)')
    expect(wrapper.find('.review__table').text()).toContain('Corrige el DNI en el padrón.')
  })

  it('descarga la revisión incluyendo las hojas sin alumno desde cualquier pestaña', async () => {
    const buildPreview = vi.fn(() => preview)
    const wrapper = mountPanel({ buildPreview })
    await wrapper.find('.review__bar').trigger('click')
    await wrapper.findAll('.review__tab')[1].trigger('click')
    await wrapper.find('.review__download').trigger('click')

    expect(wrapper.emitted('export')[0][0].orphanRows).toHaveLength(3)
  })

  it('muestra el error si la vista previa falla, sin romper la pantalla', async () => {
    const wrapper = mountPanel({ buildPreview: () => { throw new Error('plantilla inválida') } })
    await wrapper.find('.review__bar').trigger('click')
    expect(wrapper.text()).toContain('plantilla inválida')
  })
})
