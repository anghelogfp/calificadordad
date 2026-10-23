import { describe, expect, it } from 'vitest'
import { applyDniCorrections } from '../dniCorrections'

const sheet = (litho, dni) => ({ litho, dni, answers: 'A' })

describe('applyDniCorrections', () => {
  it('cambia el DNI de la hoja corregida y la marca', () => {
    const { responsesRows, responsesByDni, applied } = applyDniCorrections(
      [sheet('000910', '63735500'), sheet('000001', '11111111')],
      [{ litho: '000910', correctedDni: '63737500' }],
    )

    expect(applied).toBe(1)
    expect(responsesRows[0]).toMatchObject({ dni: '63737500', dniOriginal: '63735500', dniCorregido: true })
    expect(responsesRows[1]).toEqual(sheet('000001', '11111111'))
    expect(responsesByDni.get('63737500')).toHaveLength(1)
    expect(responsesByDni.has('63735500')).toBe(false)
  })

  it('no modifica las filas de entrada', () => {
    const original = [sheet('000910', '63735500')]
    const before = JSON.stringify(original)
    applyDniCorrections(original, [{ litho: '000910', correctedDni: '63737500' }])
    expect(JSON.stringify(original)).toBe(before)
  })

  it('ignora correcciones de hojas que ya no existen', () => {
    const { applied, responsesRows } = applyDniCorrections([sheet('000001', '11111111')], [{ litho: '999', correctedDni: '22222222' }])
    expect(applied).toBe(0)
    expect(responsesRows[0].dniCorregido).toBeUndefined()
  })

  it('sin correcciones agrupa por DNI como el flujo normal, omitiendo hojas sin DNI', () => {
    const { responsesByDni } = applyDniCorrections([sheet('1', '11111111'), sheet('2', ''), sheet('3', '11111111')])
    expect([...responsesByDni.keys()]).toEqual(['11111111'])
    expect(responsesByDni.get('11111111')).toHaveLength(2)
  })

  it('no aplica una corrección a una hoja con el mismo número pero otro DNI (otro examen)', () => {
    const { responsesRows, applied } = applyDniCorrections(
      [sheet('000910', '55555555')],
      [{ litho: '000910', correctedDni: '63737500', originalDni: '63735500' }],
    )

    expect(applied).toBe(0)
    expect(responsesRows[0].dni).toBe('55555555')
    expect(responsesRows[0].dniCorregido).toBeUndefined()
  })

  it('aplica la corrección si la hoja conserva el DNI original', () => {
    const { applied } = applyDniCorrections(
      [sheet('000910', '63735500')],
      [{ litho: '000910', correctedDni: '63737500', originalDni: '63735500' }],
    )
    expect(applied).toBe(1)
  })
})
