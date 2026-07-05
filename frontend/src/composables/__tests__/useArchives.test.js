import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { mapArchiveRowToSchema, useArchives } from '../useArchives'

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

  it('infiere área desde idexamen cuando el padrón no trae área', () => {
    const row = mapArchiveRowToSchema({
      dni: '75471201',
      paterno: 'TIPULA',
      materno: 'CHUQUIMAMANI',
      nombres: 'ANGIE DANIELA',
      desprograma: 'PSICOLOGÍA',
      area: '',
      idexamen: '2',
    })

    expect(row).toMatchObject({
      dni: '75471201',
      area: 'SOCIALES',
      programa: 'PSICOLOGÍA',
    })
  })

  it('retorna null si no hay contenido mapeable', () => {
    expect(mapArchiveRowToSchema({ Columna: '' })).toBeNull()
  })

  it('observa filas con áreas no configuradas', () => {
    const archives = useArchives(ref(['Ingeniería', 'Sociales']))
    archives.setRows([
      { dni: '12345678', paterno: 'A', materno: '', nombres: 'Uno', area: 'Ingeniería', programa: '' },
      { dni: '87654321', paterno: 'B', materno: '', nombres: 'Dos', area: 'Salud', programa: '' },
    ])

    expect(archives.archiveIssueCount.value).toBe(1)
    expect(archives.archiveIssues.value[0].row.dni).toBe('87654321')
    expect(archives.archiveIssues.value[0].message).toContain('Área no configurada')
  })
})
