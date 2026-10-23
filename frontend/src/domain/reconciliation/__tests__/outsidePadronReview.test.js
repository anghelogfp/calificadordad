import { describe, expect, it } from 'vitest'
import { buildOutsidePadronReview } from '../outsidePadronReview'

const candidate = (dni, paterno = 'X', nombres = 'Z') => ({ dni, paterno, materno: 'Y', nombres })
const row = (id, dni, litho = id, aula = '101') => ({ id, dni, litho, aula })

const padron = [candidate('63737500', 'SUCAPUCA', 'LUIS'), candidate('11111111', 'OFICIAL'), candidate('81088022', 'PINCHI')]

describe('buildOutsidePadronReview', () => {
  it('lista solo las fichas cuyo DNI no coincide con nadie del padrón', () => {
    const { items } = buildOutsidePadronReview({
      rows: [row('a', '11111111'), row('b', '63735500'), row('c', '99999999')],
      candidates: padron,
    })
    expect(items.map((i) => i.rowId)).toEqual(['b', 'c'])
  })

  it('distingue DNI fuera del padrón de DNI incompleto y omite los vacíos', () => {
    const { items, summary } = buildOutsidePadronReview({
      rows: [row('a', '63735500'), row('b', '8088022'), row('c', ''), row('d', '  ')],
      candidates: padron,
    })
    expect(items.map((i) => [i.rowId, i.reason])).toEqual([['a', 'outside'], ['b', 'incomplete']])
    expect(summary).toMatchObject({ total: 2, outside: 1, incomplete: 1 })
  })

  it('sugiere al alumno parecido: un dígito cambiado y un dígito de menos', () => {
    const { items } = buildOutsidePadronReview({ rows: [row('a', '63735500'), row('b', '8088022')], candidates: padron })

    expect(items[0].suggestions).toEqual([expect.objectContaining({ dni: '63737500', paterno: 'SUCAPUCA', nombres: 'LUIS', taken: false })])
    expect(items[1].suggestions).toEqual([expect.objectContaining({ dni: '81088022', paterno: 'PINCHI' })])
  })

  it('marca como "ya tiene ficha" a un sugerido cuyo DNI ya aparece en otra ficha', () => {
    const { items, summary } = buildOutsidePadronReview({
      rows: [row('a', '63735500'), row('b', '63737500')],
      candidates: padron,
    })

    expect(items).toHaveLength(1)
    expect(items[0].suggestions[0]).toMatchObject({ dni: '63737500', taken: true })
    expect(summary).toMatchObject({ withViableSuggestion: 0, withoutSuggestion: 0 })
  })

  it('una ficha sin ningún parecido queda sin sugerencia', () => {
    const { items, summary } = buildOutsidePadronReview({ rows: [row('a', '99999999')], candidates: padron })
    expect(items[0].suggestions).toEqual([])
    expect(summary.withoutSuggestion).toBe(1)
  })

  it('cuenta las sugerencias viables', () => {
    const { summary } = buildOutsidePadronReview({
      rows: [row('a', '63735500'), row('b', '8088022'), row('c', '99999999')],
      candidates: padron,
    })
    expect(summary).toMatchObject({ total: 3, withViableSuggestion: 2, withoutSuggestion: 1, confirmed: 0 })
  })

  describe('con correcciones ya confirmadas', () => {
    it('indica a qué alumno se atribuyó la ficha', () => {
      const { items, summary } = buildOutsidePadronReview({
        rows: [row('a', '63735500', '000910')],
        candidates: padron,
        corrections: [{ litho: '000910', correctedDni: '63737500', originalDni: '63735500' }],
      })
      expect(items[0].confirmedDni).toBe('63737500')
      expect(summary).toMatchObject({ confirmed: 1, withViableSuggestion: 0 })
    })

    it('ignora una corrección guardada para otra ficha con el mismo número de hoja (otro examen)', () => {
      const { items } = buildOutsidePadronReview({
        rows: [row('a', '55555555', '000910')],
        candidates: padron,
        corrections: [{ litho: '000910', correctedDni: '63737500', originalDni: '63735500' }],
      })
      expect(items[0].confirmedDni).toBe('')
    })
  })

  it('ordena por número de hoja y no modifica las entradas', () => {
    const rows = [row('b', '99999999', '000910'), row('a', '88888888', '000002')]
    const before = JSON.stringify({ rows, padron })
    const { items } = buildOutsidePadronReview({ rows, candidates: padron })

    expect(items.map((i) => i.litho)).toEqual(['000002', '000910'])
    expect(JSON.stringify({ rows, padron })).toBe(before)
  })

  it('sin padrón cargado no marca nada: no hay con qué comparar', () => {
    const { items, summary } = buildOutsidePadronReview({ rows: [row('a', '63735500')], candidates: [] })
    expect(items).toEqual([])
    expect(summary.total).toBe(0)
  })
})
