import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCalification } from '../useCalification'
import { buildAreaTipoKey, normalizeArea, stripDigits } from '@/utils/helpers'
import { DEFAULT_DAT_FORMAT } from '@/constants'
import { apiFetch } from '@/utils/apiFetch'

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

  it('calcular todas prioriza la plantilla específica del área sobre la global', () => {
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', paterno: 'Ing' },
        { dni: '22222222', area: 'Sociales', paterno: 'Soc' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), litho: '200001' },
        { dni: '22222222', tipo: 'P', answers: makeAnswers('A'), litho: '200002' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
        { area: 'Sociales', tipo: 'P', answers: makeAnswers('A') },
      ],
      plantillas: [
        makePlantilla({
          id: 'tpl-global',
          area: '',
          name: 'General',
          items: [{ subject: 'General', questionCount: 60, ponderation: 1, order: 1 }],
          questionTotal: 60,
        }),
        makePlantilla({
          id: 'tpl-ing',
          area: 'Ingeniería',
          name: 'Ingeniería',
          items: [{ subject: 'General', questionCount: 60, ponderation: 2, order: 1 }],
          questionTotal: 60,
        }),
        makePlantilla({
          id: 'tpl-soc',
          area: 'Sociales',
          name: 'Sociales',
          items: [{ subject: 'General', questionCount: 60, ponderation: 3, order: 1 }],
          questionTotal: 60,
        }),
      ],
    })

    calification.startNewProcess({ name: 'Por áreas', type: 'simulacro' })
    calification.calificationPlantillaId.value = 'tpl-global'

    const result = calification.runAllAreas()

    expect(result?.calculated).toEqual(expect.arrayContaining(['INGENIERÍAS', 'SOCIALES']))
    expect(calification.calificationAllResults.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ dni: '11111111', score: 1200 }),
      expect.objectContaining({ dni: '22222222', score: 1800 }),
    ]))
  })

  it('calcular todas usa claves únicas sin tipo por área', () => {
    const { calification } = makeSubject({
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', paterno: 'Ing' },
        { dni: '22222222', area: 'Sociales', paterno: 'Soc' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), litho: '200001' },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('B'), litho: '200002' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: '', answers: makeAnswers('A') },
        { area: 'Sociales', tipo: '', answers: makeAnswers('B') },
      ],
      plantillas: [
        makePlantilla({
          id: 'tpl-ing',
          area: 'Ingeniería',
          name: 'Ingeniería',
          items: [{ subject: 'General', questionCount: 60, ponderation: 2, order: 1 }],
          questionTotal: 60,
        }),
        makePlantilla({
          id: 'tpl-soc',
          area: 'Sociales',
          name: 'Sociales',
          items: [{ subject: 'General', questionCount: 60, ponderation: 3, order: 1 }],
          questionTotal: 60,
        }),
      ],
    })

    calification.startNewProcess({ name: 'CEPRE por áreas', type: 'simulacro', simulacroScope: 'areas' })

    const result = calification.runAllAreas()

    expect(result?.calculated).toEqual(expect.arrayContaining(['INGENIERÍAS', 'SOCIALES']))
    expect(calification.calificationAllResults.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ dni: '11111111', area: 'INGENIERÍAS', score: 1200 }),
      expect.objectContaining({ dni: '22222222', area: 'SOCIALES', score: 1800 }),
    ]))
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
    expect(calification.calificationError.value).toContain('Faltan claves para INGENIERÍAS: T')
  })

  it('bloquea resultados inválidos detectados por la auditoría', () => {
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

    expect(calification.calificationResults.value).toHaveLength(0)
    expect(calification.calificationError.value).toBe('Invariante de prueba')
    expect(validateCalificationResultMock).toHaveBeenCalledWith(expect.objectContaining({
      processType: 'simulacro',
      answersLength: 60,
    }))
    expect(warnSpy).toHaveBeenCalledWith(
      '[calification] Resultado calculado con invariantes inválidas:',
      expect.objectContaining({ valid: false }),
    )
  })

  describe('correcciones de DNI confirmadas', () => {
    const jsonResponse = (ok, body, status = ok ? 200 : 400) => ({ ok, status, json: async () => body })

    it('confirma con la API y recarga la lista', async () => {
      const { calification } = makeSubject()
      apiFetch
        .mockResolvedValueOnce(jsonResponse(true, { id: 7 }, 201))
        .mockResolvedValueOnce(jsonResponse(true, [{ id: 7, litho: '000910', correctedDni: '63737500' }]))

      const result = await calification.confirmDniCorrection('000910', '63737500')

      expect(result).toEqual({ ok: true })
      expect(apiFetch).toHaveBeenNthCalledWith(1, '/correcciones-dni/', {
        method: 'POST',
        body: JSON.stringify({ litho: '000910', correctedDni: '63737500' }),
      })
      expect(calification.dniCorrections.value).toEqual([
        { id: 7, litho: '000910', correctedDni: '63737500' },
      ])
    })

    it('devuelve el mensaje de la API cuando rechaza la confirmación', async () => {
      const { calification } = makeSubject()
      apiFetch.mockResolvedValueOnce(jsonResponse(false, { correctedDni: ['Ese alumno ya tiene su propia hoja.'] }))

      const result = await calification.confirmDniCorrection('000910', '11111111')

      expect(result).toEqual({ ok: false, error: 'Ese alumno ya tiene su propia hoja.' })
      expect(calification.dniCorrections.value).toEqual([])
    })

    it('avisa si no hay conexión en lugar de romper', async () => {
      const { calification } = makeSubject()
      apiFetch.mockRejectedValueOnce(new Error('network'))

      const result = await calification.confirmDniCorrection('000910', '63737500')

      expect(result).toEqual({ ok: false, error: 'No se pudo conectar con el servidor.' })
    })

    it('deshace usando el id de la corrección de esa hoja', async () => {
      const { calification } = makeSubject()
      calification.dniCorrections.value = [{ id: 7, litho: '000910', correctedDni: '63737500' }]
      apiFetch
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce(jsonResponse(true, []))

      const result = await calification.undoDniCorrection('000910')

      expect(result).toEqual({ ok: true })
      expect(apiFetch).toHaveBeenNthCalledWith(1, '/correcciones-dni/7/', { method: 'DELETE' })
      expect(calification.dniCorrections.value).toEqual([])
    })

    it('no intenta deshacer una corrección que no existe', async () => {
      const { calification } = makeSubject()

      const result = await calification.undoDniCorrection('999999')

      expect(result.ok).toBe(false)
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })

  describe('correcciones confirmadas y ranking', () => {
    const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body })

    function calificadoConHojaMalMarcada() {
      const subject = makeSubject({
        archiveRows: [
          { dni: '11111111', paterno: 'A', materno: '', nombres: 'Uno' },
          { dni: '22222222', paterno: 'B', materno: '', nombres: 'Dos' },
        ],
        responsesRows: [
          { dni: '11111111', tipo: 'P', answers: makeAnswers('A'), aula: '001', litho: '100001' },
          { dni: '22222229', tipo: 'P', answers: makeAnswers('A'), aula: '002', litho: '100002' },
        ],
        answerKeyRows: [{ area: '', tipo: '', answers: makeAnswers('A') }],
        plantillas: [makePlantilla({ id: 'tpl-general', area: '', name: 'General' })],
      })
      const { calification } = subject
      calification.startNewProcess({ name: 'Simulacro', type: 'simulacro' })
      calification.calificationPlantillaId.value = 'tpl-general'
      calification.calificationCorrectValue.value = 10
      calification.calificationIncorrectValue.value = 0
      calification.calificationBlankValue.value = 2
      calification.runCalification()
      return calification
    }

    it('antes de confirmar, la hoja mal marcada no entra al ranking', () => {
      const calification = calificadoConHojaMalMarcada()

      expect(calification.calificationResults.value.map((r) => r.dni)).toEqual(['11111111'])
      expect(calification.calificationSummary.value).toMatchObject({ sheetsWithoutCandidate: 1, dniCorrectionsApplied: 0 })
    })

    it('al confirmar, el alumno entra al ranking oficial con la marca de DNI corregido', async () => {
      const calification = calificadoConHojaMalMarcada()
      apiFetch
        .mockResolvedValueOnce(jsonResponse({ id: 1 }))
        .mockResolvedValueOnce(jsonResponse([{ id: 1, litho: '100002', originalDni: '22222229', correctedDni: '22222222' }]))

      const result = await calification.confirmDniCorrection('100002', '22222222')

      expect(result).toEqual({ ok: true })
      expect(calification.calificationResults.value.map((r) => r.dni).sort()).toEqual(['11111111', '22222222'])
      expect(calification.calificationResults.value.find((r) => r.dni === '22222222')).toMatchObject({
        score: 600,
        dniCorregido: true,
        dniOriginal: '22222229',
      })
      expect(calification.calificationSummary.value).toMatchObject({
        sheetsWithoutCandidate: 0,
        dniCorrectionsApplied: 1,
        missingResponses: 0,
      })
    })

    it('al deshacer, el alumno sale del ranking', async () => {
      const calification = calificadoConHojaMalMarcada()
      apiFetch
        .mockResolvedValueOnce(jsonResponse({ id: 1 }))
        .mockResolvedValueOnce(jsonResponse([{ id: 1, litho: '100002', originalDni: '22222229', correctedDni: '22222222' }]))
      await calification.confirmDniCorrection('100002', '22222222')

      apiFetch
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce(jsonResponse([]))
      const result = await calification.undoDniCorrection('100002')

      expect(result).toEqual({ ok: true })
      expect(calification.calificationResults.value.map((r) => r.dni)).toEqual(['11111111'])
      expect(calification.calificationSummary.value.dniCorrectionsApplied).toBe(0)
    })

    it('si el servidor rechaza la confirmación, el ranking no cambia', async () => {
      const calification = calificadoConHojaMalMarcada()
      apiFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ litho: ['La hoja ya tiene un alumno en el padrón.'] }) })

      const result = await calification.confirmDniCorrection('100002', '22222222')

      expect(result.ok).toBe(false)
      expect(calification.calificationResults.value.map((r) => r.dni)).toEqual(['11111111'])
    })

    it('una calificación nueva ya incluye las correcciones confirmadas', async () => {
      const calification = calificadoConHojaMalMarcada()
      apiFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, litho: '100002', originalDni: '22222229', correctedDni: '22222222' }]))
      await calification.loadDniCorrections()

      calification.runCalification()

      expect(calification.calificationResults.value.map((r) => r.dni).sort()).toEqual(['11111111', '22222222'])
    })

    it('una corrección vieja no se aplica a otra hoja con el mismo número en un examen nuevo', async () => {
      const calification = calificadoConHojaMalMarcada()
      apiFetch.mockResolvedValueOnce(jsonResponse([{ id: 1, litho: '100002', originalDni: '77777777', correctedDni: '22222222' }]))
      await calification.loadDniCorrections()

      calification.runCalification()

      expect(calification.calificationResults.value.map((r) => r.dni)).toEqual(['11111111'])
      expect(calification.calificationSummary.value).toMatchObject({ dniCorrectionsApplied: 0, sheetsWithoutCandidate: 1 })
    })
  })
})
