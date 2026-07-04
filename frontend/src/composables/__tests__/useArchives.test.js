import { describe, expect, it } from 'vitest'
import { mapArchiveRowToSchema } from '../useArchives'

describe('mapArchiveRowToSchema', () => {
  it('mapea columnas de padrón usando alias normalizados', () => {
    const row = mapArchiveRowToSchema({
      'Número de Documento': '01234567',
      ape_pat: 'Quispe',
      ape_mat: 'Mamani',
      'Nombres Completos': 'Ana Maria',
      'Descripción Área': 'Ingeniería',
      Carrera: 'Ingeniería Civil',
      Obs: 'Sin observaciones',
    })

    expect(row).toMatchObject({
      dni: '01234567',
      paterno: 'Quispe',
      materno: 'Mamani',
      nombres: 'Ana Maria',
      area: 'Ingeniería',
      programa: 'Ingeniería Civil',
      observaciones: 'Sin observaciones',
    })
  })

  it('mapea encabezados con guion bajo de padrones externos', () => {
    const row = mapArchiveRowToSchema({
      nro: '1',
      dni: '12345678',
      apellido_paterno: 'Condori',
      apellido_materno: 'Flores',
      nombres: 'Luis Alberto',
      area: 'Sociales',
      sede: 'Puno',
    })

    expect(row).toMatchObject({
      dni: '12345678',
      paterno: 'Condori',
      materno: 'Flores',
      nombres: 'Luis Alberto',
      area: 'Sociales',
      programa: '',
    })
  })

  it('retorna null si no hay contenido mapeable', () => {
    expect(mapArchiveRowToSchema({ Columna: '' })).toBeNull()
  })
})
