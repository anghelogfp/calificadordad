import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCalification } from '../useCalification'
import { buildAreaTipoKey, normalizeArea, stripDigits } from '@/utils/helpers'
import { DEFAULT_DAT_FORMAT } from '@/constants'

const validateCalificationResultMock = vi.hoisted(() => vi.fn())

vi.mock('@/utils/apiFetch', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('@/domain/calification/validateResults', () => ({
  validateCalificationResult: validateCalificationResultMock,
}))

function makeAnswers(char, length = 60) {
  return char.repeat(length)
}

function makePlantilla(overrides = {}) {
  return {
    id: 'tpl-ingenieria',
    name: 'Plantilla Ingeniería',
    area: 'Ingeniería',
    questionTotal: 60,
    items: [
      {
        subject: 'General',
        questionCount: 60,
        ponderation: 1,
        order: 1,
      },
    ],
    ...overrides,
  }
}

function makePonderations(plantillas) {
  return {
    plantillas: ref(plantillas),
    getPlantillaById(id) {
      return this.plantillas.value.find((plantilla) => plantilla.id === id)
    },
    getPlantillasForCalification(area) {
      return this.plantillas.value.filter((plantilla) => {
        if (!plantilla.area) return true
        return normalizeArea(plantilla.area) === normalizeArea(area)
      })
    },
  }
}

function makeSubject({
  archiveRows = [],
  responsesRows = [],
  answerKeyRows = [],
  plantillas = [makePlantilla()],
  areaNames = ['Biomédicas', 'Sociales', 'Ingeniería'],
  vacantesPrograma = {},
  formatConfig = DEFAULT_DAT_FORMAT,
} = {}) {
  const archive = ref(archiveRows)
  const responses = ref(responsesRows)
  const answerKeys = ref(answerKeyRows)
  const areas = ref(areaNames)
  const format = ref(formatConfig)
  const vacantes = ref(vacantesPrograma)

  const responsesByDni = computed(() => {
    const map = new Map()
    responses.value.forEach((row) => {
      const dni = stripDigits(row.dni)
      if (!dni) return
      if (!map.has(dni)) map.set(dni, [])
      map.get(dni).push(row)
    })
    return map
  })

  const answerKeyLookupByAreaTipo = computed(() => {
    const map = new Map()
    answerKeys.value.forEach((row) => {
      const key = buildAreaTipoKey(row.area, row.tipo, areas.value)
      if (key) map.set(key, row)
    })
    return map
  })

  const answerKeyFallbackByArea = computed(() => {
    const map = new Map()
    answerKeys.value.forEach((row) => {
      if (!row.area?.trim()) return
      const area = normalizeArea(row.area, areas.value)
      if (!map.has(area)) map.set(area, row)
    })
    return map
  })

  const calification = useCalification(
    archive,
    responses,
    answerKeys,
    makePonderations(plantillas),
    responsesByDni,
    answerKeyLookupByAreaTipo,
    areas,
    format,
    vacantes,
    answerKeyFallbackByArea,
  )

  return { calification }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  validateCalificationResultMock.mockReturnValue({ valid: true, errors: [], warnings: [] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCalification', () => {
  it('califica simulacro general, calcula puntaje y ordena ranking global', () => {
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', paterno: 'A', materno: '', nombres: 'Uno' },
        { dni: '22222222', paterno: 'B', materno: '', nombres: 'Dos' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), aula: '001', litho: '100001' },
        { dni: '22222222', tipo: 'P', answers: makeAnswers('B'), aula: '002', litho: '100002' },
      ],
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      plantillas: [makePlantilla({ id: 'tpl-general', area: '', name: 'General' })],
    })

    calification.startNewProcess({ name: 'Simulacro', type: 'simulacro' })
    calification.calificationPlantillaId.value = 'tpl-general'
    calification.calificationCorrectValue.value = 10
    calification.calificationIncorrectValue.value = 0
    calification.calificationBlankValue.value = 2

    calification.runCalification()

    expect(calification.calificationError.value).toBe('')
    expect(calification.processAreas.value).toEqual(['General'])
    expect(calification.calificationResults.value).toHaveLength(2)
    expect(calification.calificationResults.value[0]).toMatchObject({
      dni: '11111111',
      score: 600,
      position: 1,
    })
    expect(calification.calificationResults.value[1]).toMatchObject({
      dni: '22222222',
      score: 0,
      position: 2,
    })
    expect(calification.calificationSummary.value).toMatchObject({
      area: 'General',
      totalCandidates: 2,
      missingResponses: 0,
      missingKeys: 0,
      duplicateResponses: 0,
      invalidCandidates: 0,
      totalWeight: 60,
      answersLength: 60,
    })
  })

  it('registra no calificados por DNI inválido, falta de respuesta y respuesta duplicada', () => {
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '1234', area: 'Ingeniería', programa: 'Civil', paterno: 'Invalido' },
        { dni: '33333333', area: 'Ingeniería', programa: 'Civil', paterno: 'SinRespuesta' },
        { dni: '44444444', area: 'Ingeniería', programa: 'Civil', paterno: 'Duplicado' },
        { dni: '55555555', area: 'Ingeniería', programa: 'Civil', paterno: 'Valido' },
      ],
      responsesRows: [
        { dni: '44444444', tipo: 'P', answers: makeAnswers('A'), litho: '100004' },
        { dni: '44444444', tipo: 'P', answers: makeAnswers('A'), litho: '100005' },
        { dni: '55555555', tipo: 'P', answers: makeAnswers('A'), litho: '100006' },
        { dni: '', tipo: 'P', answers: makeAnswers('A'), litho: '100007' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
      ],
    })

    calification.startNewProcess({ name: 'Por áreas', type: 'simulacro' })
    calification.calificationArea.value = 'Ingeniería'
    calification.calificationPlantillaId.value = 'tpl-ingenieria'
    calification.runCalification()

    const summary = calification.calificationSummary.value
    expect(calification.calificationResults.value).toHaveLength(1)
    expect(calification.calificationResults.value[0].dni).toBe('55555555')
    expect(summary).toMatchObject({
      totalCandidates: 4,
      missingResponses: 1,
      duplicateResponses: 1,
      invalidCandidates: 1,
      unlinkedResponses: 1,
    })
    expect(summary.noCalificados.map((row) => row.motivo)).toEqual([
      'DNI incompleto (4/8)',
      'Sin respuesta .dat',
      'Respuesta duplicada',
    ])
    expect(validateCalificationResultMock).toHaveBeenCalled()
  })

  it('bloquea la calificación cuando el preflight no tiene candidatos', () => {
    const { calification } = makeSubject({
      archiveRows: [],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), litho: '100001' },
      ],
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      plantillas: [makePlantilla({ id: 'tpl-general', area: '', name: 'General' })],
    })

    calification.startNewProcess({ name: 'Sin candidatos', type: 'simulacro' })
    calification.calificationPlantillaId.value = 'tpl-general'
    calification.runCalification()

    expect(calification.calificationResults.value).toEqual([])
    expect(calification.calificationError.value).toBe('No hay postulantes para esta área en el padrón.')
    expect(validateCalificationResultMock).not.toHaveBeenCalled()
  })

  it('en modo real exige claves por tipo y marca ingresantes por vacantes de programa', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería',
      tipo,
      answers: makeAnswers('A'),
    }))

    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'Primero' },
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'Segundo' },
        { dni: '33333333', area: 'Ingeniería', programa: 'Civil', paterno: 'TipoMalo' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), litho: '200001' },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('B'), litho: '200002' },
        { dni: '33333333', tipo: 'X', answers: makeAnswers('A'), litho: '200003' },
      ],
      answerKeyRows,
      vacantesPrograma: { Civil: 1 },
    })

    calification.startNewProcess({ name: 'Real', type: 'real' })
    calification.calificationArea.value = 'Ingeniería'
    calification.calificationPlantillaId.value = 'tpl-ingenieria'
    calification.runCalification()

    expect(calification.calificationError.value).toBe('')
    expect(calification.calificationResults.value).toHaveLength(2)
    expect(calification.calificationResults.value[0]).toMatchObject({
      dni: '11111111',
      score: 600,
      position: 1,
      positionInPrograma: 1,
      isIngresante: true,
    })
    expect(calification.calificationResults.value[1]).toMatchObject({
      dni: '22222222',
      score: 0,
      position: 2,
      positionInPrograma: 2,
      isIngresante: false,
    })
    expect(calification.calificationSummary.value).toMatchObject({
      invalidResponseTypes: 1,
      missingPrograms: 0,
    })
    expect(calification.calificationSummary.value.noCalificados[0]).toMatchObject({
      dni: '33333333',
      motivo: 'Tipo de prueba inválido',
    })
  })

  it('bloquea modo real si falta una clave P/Q/R/S/T', () => {
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
      ],
      answerKeyRows: ['P', 'Q', 'R', 'S'].map((tipo) => ({
        area: 'Ingeniería',
        tipo,
        answers: makeAnswers('A'),
      })),
    })

    calification.startNewProcess({ name: 'Real incompleto', type: 'real' })
    calification.calificationArea.value = 'Ingeniería'
    calification.calificationPlantillaId.value = 'tpl-ingenieria'
    calification.runCalification()

    expect(calification.calificationResults.value).toEqual([])
    expect(calification.calificationError.value).toContain('Faltan claves para Ingeniería: T')
  })

  it('audita resultados inválidos sin bloquear la calificación', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validateCalificationResultMock.mockReturnValue({
      valid: false,
      errors: [{ code: 'TEST_INVARIANT', message: 'Invariante de prueba', context: {} }],
      warnings: [],
    })
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', paterno: 'A', materno: '', nombres: 'Uno' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), aula: '001', litho: '100001' },
      ],
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      plantillas: [makePlantilla({ id: 'tpl-general', area: '', name: 'General' })],
    })

    calification.startNewProcess({ name: 'Simulacro', type: 'simulacro' })
    calification.calificationPlantillaId.value = 'tpl-general'
    calification.runCalification()

    expect(calification.calificationResults.value).toHaveLength(1)
    expect(validateCalificationResultMock).toHaveBeenCalledWith(expect.objectContaining({
      processType: 'simulacro',
      answersLength: 60,
    }))
    expect(warnSpy).toHaveBeenCalledWith(
      '[calification] Resultado calculado con invariantes inválidas:',
      expect.objectContaining({ valid: false }),
    )
  })
})
