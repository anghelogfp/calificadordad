import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { mapArchiveRowToSchema, normalizeBirthDate, useArchives } from '../useArchives'

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

  it('mapea las 23 columnas del padrón oficial CEPREUNA', () => {
    const row = mapArchiveRowToSchema({
      'FECHA DE INSCRIPCIÓN': '2026-01-06 12:46:38',
      'COD PROGRAMA': '1',
      'PROGRAMA DE ESTUDIOS': 'ADMINISTRACIÓN',
      AREA: 'SOCIALES',
      'COD MODALIDAD': '9',
      MODALIDAD: 'CEPREUNA',
      'N° DOCUMENTO': '60759049',
      PATERNO: 'ACERO',
      MATERNO: 'MAMANI',
      NOMBRES: 'POSTULANTE PRUEBA',
      SEXO: 'M',
      'FEC NACIMIENTO': '2006-07-12',
      EDAD: '20',
      'UBIGEO RESIDENCIA': '200101',
      'DEPARTAMENTO RESIDENCIA': 'PUNO',
      'PROVINCIA RESIDENCIA': 'PUNO',
      'DISTRITO RESIDENCIA': 'PUNO',
      EGRESO: '2022',
      'COD MODULAR': '0240267',
      'UBIGEO COLEGIO': '200101',
      'DEPARTAMENTO COLEGIO': 'PUNO',
      'PROVINCIA COLEGIO': 'PUNO',
      'DISTRITO COLEGIO': 'PUNO',
    })

    expect(row).toMatchObject({
      dni: '60759049',
      fecha_inscripcion: '2026-01-06T12:46:38',
      codigo_programa: '1',
      programa: 'ADMINISTRACIÓN',
      area: 'SOCIALES',
      codigo_modalidad: '9',
      modalidad: 'CEPREUNA',
      fecha_nacimiento: '2006-07-12',
      edad: '20',
      codigo_modular: '0240267',
      distrito_colegio: 'PUNO',
    })
  })


  it('usa null en fechas y edad opcionales para que la API acepte filas antiguas', () => {
    const row = mapArchiveRowToSchema({
      DNI: '12345678',
      PATERNO: 'QUISPE',
    })

    expect(row).toMatchObject({
      fecha_inscripcion: null,
      fecha_nacimiento: null,
      edad: null,
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

describe('normalizeBirthDate', () => {
  it('convierte DD/MM/YYYY al formato ISO que acepta la API', () => {
    expect(normalizeBirthDate('13/01/2014')).toBe('2014-01-13')
    expect(normalizeBirthDate('1/2/2014')).toBe('2014-02-01')
    expect(normalizeBirthDate('13-01-2014')).toBe('2014-01-13')
  })

  it('conserva fechas ISO y descarta la hora', () => {
    expect(normalizeBirthDate('2014-01-13')).toBe('2014-01-13')
    expect(normalizeBirthDate('2014-01-13 00:00:00')).toBe('2014-01-13')
  })

  it('descarta valores vacíos, imposibles o desconocidos en lugar de romper el guardado', () => {
    expect(normalizeBirthDate('')).toBe('')
    expect(normalizeBirthDate(null)).toBe('')
    expect(normalizeBirthDate('31/02/2014')).toBe('')
    expect(normalizeBirthDate('no es fecha')).toBe('')
  })

  it('el padrón mapeado queda con fecha_nacimiento lista para la API', () => {
    const row = mapArchiveRowToSchema({
      'Número de Documento': '78415016',
      'Apellido Paterno': 'Calsin',
      'Fecha de Nacimiento': '13/01/2014',
    })

    expect(row.fecha_nacimiento).toBe('2014-01-13')
  })

  it('una fecha inválida no impide mapear al postulante', () => {
    const row = mapArchiveRowToSchema({
      'Número de Documento': '78415016',
      'Fecha de Nacimiento': '??',
    })

    expect(row.dni).toBe('78415016')
    expect(row.fecha_nacimiento).toBeNull()
  })
})
