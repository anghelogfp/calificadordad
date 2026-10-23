import { describe, expect, it } from 'vitest'
import { calculateAreaResults } from '../calculateResults'
import { validateCalificationResult } from '../validateResults'
import { keyFingerprint } from '../questionExceptions'

function makeAnswers(char, length = 60) {
  return char.repeat(length)
}

function makePlantilla(overrides = {}) {
  return {
    id: 'tpl',
    name: 'Plantilla',
    questionTotal: 60,
    items: [
      {
        subject: 'General',
        questionCount: 60,
        ponderation: 1,
      },
    ],
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return {
    area: 'Ingeniería',
    plantilla: makePlantilla(),
    correctValue: 10,
    incorrectValue: 0,
    blankValue: 2,
    processType: 'simulacro',
    simulacroScope: 'areas',
    answersLength: 60,
    archiveRows: [
      { dni: '12345678', area: 'Ingeniería', programa: 'Civil', paterno: 'A' },
    ],
    responsesRows: [
      { dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' },
    ],
    answerKeyRows: [
      { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
    ],
    responsesByDni: new Map([
      ['12345678', [{ dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' }]],
    ]),
    answerKeyLookupByAreaTipo: new Map([
      ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') }],
    ]),
    answerKeyFallbackByArea: new Map(),
    areaList: ['Biomédicas', 'Sociales', 'Ingeniería'],
    vacantesPrograma: {},
    timestamp: '2026-07-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('calculateAreaResults', () => {
  it('calcula resultados puros sin depender de Vue', () => {
    const result = calculateAreaResults(makeInput())

    expect(result.results).toEqual([
      expect.objectContaining({
        dni: '12345678',
        area: 'INGENIERÍAS',
        score: 600,
        position: 1,
        answersRaw: makeAnswers('A'),
        correctAnswersRaw: makeAnswers('A'),
      }),
    ])
    expect(result.summary).toMatchObject({
      area: 'INGENIERÍAS',
      timestamp: '2026-07-01T12:00:00.000Z',
      totalCandidates: 1,
      totalWeight: 60,
      noCalificados: [],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('cuenta las hojas cuyo DNI no pertenece a ningún postulante del padrón', () => {
    const orphan = { dni: '99999999', tipo: 'P', answers: makeAnswers('A'), litho: '100002' }
    const incomplete = { dni: '1234567', tipo: 'P', answers: makeAnswers('A'), litho: '100003' }
    const base = makeInput()
    const result = calculateAreaResults({
      ...base,
      responsesRows: [...base.responsesRows, orphan, incomplete],
    })

    expect(result.summary.sheetsWithoutCandidate).toBe(2)
    expect(result.results).toHaveLength(1)
  })

  describe('con correcciones de DNI confirmadas', () => {
    const wrongSheet = { dni: '99999999', tipo: 'P', answers: makeAnswers('A'), litho: '100009' }

    function inputWithCorrection() {
      const base = makeInput({
        simulacroScope: 'areas',
        archiveRows: [
          { dni: '12345678', area: 'Ingeniería', programa: 'Civil', paterno: 'A' },
          { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'B' },
        ],
        responsesRows: [
          { dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' },
          wrongSheet,
        ],
        responsesByDni: new Map([
          ['12345678', [{ dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' }]],
          ['99999999', [wrongSheet]],
        ]),
      })
      return base
    }

    it('sin la corrección el alumno queda sin hoja y la hoja sin alumno', () => {
      const { results, summary } = calculateAreaResults(inputWithCorrection())

      expect(results.map((r) => r.dni)).toEqual(['12345678'])
      expect(summary.missingResponses).toBe(1)
      expect(summary.sheetsWithoutCandidate).toBe(1)
      expect(summary.dniCorrectionsApplied).toBe(0)
    })

    it('con la corrección el alumno entra al ranking oficial, marcado como corregido', () => {
      const { results, summary } = calculateAreaResults({
        ...inputWithCorrection(),
        dniCorrections: [{ litho: '100009', correctedDni: '22222222' }],
      })

      const corrected = results.find((r) => r.dni === '22222222')
      expect(corrected).toMatchObject({ score: 600, dniCorregido: true, dniOriginal: '99999999', litho: '100009' })
      expect(results.find((r) => r.dni === '12345678').dniCorregido).toBe(false)
      expect(results.map((r) => r.position).sort()).toEqual([1, 2])
      expect(summary).toMatchObject({ missingResponses: 0, sheetsWithoutCandidate: 0, dniCorrectionsApplied: 1 })
      expect(summary.noCalificados).toEqual([])
    })

    it('el resultado corregido pasa la auditoría del cálculo', () => {
      const result = calculateAreaResults({
        ...inputWithCorrection(),
        dniCorrections: [{ litho: '100009', correctedDni: '22222222' }],
      })
      expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
    })

    it('no altera las hojas originales', () => {
      const input = inputWithCorrection()
      calculateAreaResults({ ...input, dniCorrections: [{ litho: '100009', correctedDni: '22222222' }] })
      expect(wrongSheet.dni).toBe('99999999')
      expect(wrongSheet.dniCorregido).toBeUndefined()
    })
  })

  describe('hojas con menos respuestas de las esperadas', () => {
    function inputWithAnswers(answers) {
      const base = makeInput()
      const sheet = { dni: '12345678', tipo: 'P', answers, litho: '100001' }
      return { ...base, responsesRows: [sheet], responsesByDni: new Map([['12345678', [sheet]]]) }
    }

    it('avisa cuántos blancos finales se asumieron en cada hoja y en el resumen', () => {
      const result = calculateAreaResults(inputWithAnswers('A'.repeat(57)))

      expect(result.results[0]).toMatchObject({ answersReadLength: 57, assumedBlankCount: 3, score: 57 * 10 + 3 * 2 })
      expect(result.summary.sheetsWithAssumedBlanks).toBe(1)
    })

    it('una hoja completa no genera aviso', () => {
      const result = calculateAreaResults(inputWithAnswers('A'.repeat(60)))

      expect(result.results[0]).toMatchObject({ answersReadLength: 60, assumedBlankCount: 0 })
      expect(result.summary.sheetsWithAssumedBlanks).toBe(0)
    })

    it('la auditoría deja un aviso (no un error) cuando se asumieron blancos', () => {
      const result = calculateAreaResults(inputWithAnswers('A'.repeat(57)))
      const validation = validateCalificationResult({ result })

      expect(validation.valid).toBe(true)
      expect(validation.warnings.map((w) => w.code)).toContain('ANSWERS_PADDED')
    })

    it('detecta una hoja con más respuestas de las esperadas, que antes se recortaban en silencio', () => {
      const result = calculateAreaResults(inputWithAnswers('A'.repeat(63)))

      expect(result.results[0]).toMatchObject({ answersReadLength: 63, assumedBlankCount: 0 })
      expect(result.summary.sheetsTruncated).toBe(1)
      expect(validateCalificationResult({ result }).warnings.map((w) => w.code)).toContain('ANSWERS_TRUNCATED')
    })
  })

  describe('huella del cálculo', () => {
    const HEX64 = /^[0-9a-f]{64}$/

    it('el resumen trae la huella de configuración y la de datos', () => {
      const { summary } = calculateAreaResults(makeInput())
      expect(summary.configSha256).toMatch(HEX64)
      expect(summary.dataSha256).toMatch(HEX64)
    })

    it('el mismo cálculo repetido da las mismas huellas', () => {
      const a = calculateAreaResults(makeInput()).summary
      const b = calculateAreaResults(makeInput()).summary
      expect([a.configSha256, a.dataSha256]).toEqual([b.configSha256, b.dataSha256])
    })

    it('cambiar una letra de la clave cambia la huella de configuración y no la de datos', () => {
      const base = calculateAreaResults(makeInput()).summary
      const key = 'B' + makeAnswers('A').slice(1)
      const changed = calculateAreaResults(makeInput({
        answerKeyRows: [{ area: 'Ingeniería', tipo: 'P', answers: key }],
        answerKeyLookupByAreaTipo: new Map([['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: key }]]),
      })).summary

      expect(changed.configSha256).not.toBe(base.configSha256)
      expect(changed.dataSha256).toBe(base.dataSha256)
    })

    it('una respuesta distinta cambia la huella de datos y no la de configuración', () => {
      const base = calculateAreaResults(makeInput()).summary
      const sheet = { dni: '12345678', tipo: 'P', answers: 'B' + makeAnswers('A').slice(1), litho: '100001' }
      const changed = calculateAreaResults(makeInput({
        responsesRows: [sheet],
        responsesByDni: new Map([['12345678', [sheet]]]),
      })).summary

      expect(changed.dataSha256).not.toBe(base.dataSha256)
      expect(changed.configSha256).toBe(base.configSha256)
    })

    it('la clave de otra área no altera la huella de esta área', () => {
      const base = calculateAreaResults(makeInput()).summary
      const withOther = calculateAreaResults(makeInput({
        answerKeyRows: [
          { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
          { area: 'Biomédicas', tipo: 'P', answers: makeAnswers('E') },
        ],
      })).summary

      expect(withOther.configSha256).toBe(base.configSha256)
    })

    it('confirmar una corrección de DNI cambia la huella de configuración y no la de datos', () => {
      const input = {
        ...makeInput({
          simulacroScope: 'areas',
          archiveRows: [
            { dni: '12345678', area: 'Ingeniería', programa: 'Civil', paterno: 'A' },
            { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'B' },
          ],
        }),
      }
      const wrong = { dni: '99999999', tipo: 'P', answers: makeAnswers('A'), litho: '100009' }
      const withWrong = { ...input, responsesRows: [wrong], responsesByDni: new Map([['99999999', [wrong]]]) }

      const before = calculateAreaResults(withWrong).summary
      const after = calculateAreaResults({
        ...withWrong,
        dniCorrections: [{ litho: '100009', originalDni: '99999999', correctedDni: '22222222' }],
      }).summary

      expect(after.configSha256).not.toBe(before.configSha256)
      expect(after.dataSha256).toBe(before.dataSha256)
    })
  })

  describe('excepciones de pregunta', () => {
    const KEY = 'ABCDE'.repeat(12)
    const OTHER_KEY = 'EDCBA'.repeat(12)
    const exception = (overrides = {}) => ({
      id: 1, area: '', tipo: 'P', questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '',
      reason: 'Pregunta mal formulada', documentRef: 'Acta 3', keySha256: keyFingerprint(KEY), ...overrides,
    })

    // Simulacro general: una clave sin área, dos postulantes: uno acierta todo, otro deja la 5 en blanco.
    function generalInput(overrides = {}) {
      const sheetA = { dni: '11111111', tipo: 'P', answers: KEY, litho: '000001' }
      const sheetB = { dni: '22222222', tipo: 'P', answers: KEY.slice(0, 4) + ' ' + KEY.slice(5), litho: '000002' }
      return makeInput({
        simulacroScope: 'general',
        archiveRows: [
          { dni: '11111111', paterno: 'A', materno: '', nombres: 'Uno' },
          { dni: '22222222', paterno: 'B', materno: '', nombres: 'Dos' },
        ],
        responsesRows: [sheetA, sheetB],
        responsesByDni: new Map([['11111111', [sheetA]], ['22222222', [sheetB]]]),
        answerKeyRows: [{ area: '', tipo: 'P', answers: KEY }],
        answerKeyLookupByAreaTipo: new Map(),
        ...overrides,
      })
    }
    const byDni = (result, dni) => result.results.find((r) => r.dni === dni)

    it('sin excepciones el resultado es el de siempre y no registra ninguna', () => {
      const result = calculateAreaResults(generalInput())
      expect(byDni(result, '11111111').score).toBe(600)
      expect(byDni(result, '22222222').score).toBe(592)
      expect(byDni(result, '11111111').exceptionsApplied).toEqual([])
      expect(result.summary.questionExceptions).toEqual([])
    })

    it('anular dando el punto a todos iguala a quien dejó la pregunta en blanco', () => {
      const result = calculateAreaResults(generalInput({ questionExceptions: [exception()] }))

      expect(byDni(result, '22222222').score).toBe(600)
      expect(byDni(result, '22222222').exceptionsApplied).toEqual([{ questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '' }])
      expect(result.summary.questionExceptions[0]).toMatchObject({ questionNumber: 5, status: 'applied', reason: 'Pregunta mal formulada' })
    })

    it('anular excluyendo baja el máximo y no cuenta la pregunta para nadie', () => {
      const result = calculateAreaResults(generalInput({ questionExceptions: [exception({ type: 'ANULADA_EXCLUIR' })] }))

      expect(byDni(result, '11111111')).toMatchObject({ score: 590, maxScore: 590 })
      expect(byDni(result, '22222222').score).toBe(590)
    })

    it('varias respuestas válidas acepta la letra nueva', () => {
      const key = KEY // la pregunta 5 es E
      const sheet = { dni: '11111111', tipo: 'P', answers: key.slice(0, 4) + 'B' + key.slice(5), litho: '000001' }
      const input = generalInput({
        responsesRows: [sheet],
        responsesByDni: new Map([['11111111', [sheet]]]),
        questionExceptions: [exception({ type: 'CLAVE_MULTIPLE', validAnswers: 'BE' })],
      })
      expect(byDni(calculateAreaResults(input), '11111111').score).toBe(600)
    })

    it('una excepción cuya clave cambió NO se aplica y queda registrada como desactualizada', () => {
      const result = calculateAreaResults(generalInput({
        questionExceptions: [exception({ keySha256: keyFingerprint(OTHER_KEY) })],
      }))

      expect(byDni(result, '22222222').score).toBe(592)
      expect(byDni(result, '22222222').exceptionsApplied).toEqual([])
      expect(result.summary.questionExceptions[0]).toMatchObject({ status: 'outdated' })
    })

    it('una excepción ambigua o inválida detiene el cálculo', () => {
      expect(() => calculateAreaResults(generalInput({
        questionExceptions: [exception(), exception({ id: 2, type: 'ANULADA_EXCLUIR' })],
      }))).toThrow(/pregunta 5.*más de una excepción/i)
      expect(() => calculateAreaResults(generalInput({ questionExceptions: [exception({ questionNumber: 99 })] }))).toThrow(/99/)
    })

    it('las excepciones de otra área no entran en este cálculo ni en su resumen', () => {
      const result = calculateAreaResults(generalInput({ questionExceptions: [exception({ area: 'Biomédicas' })] }))
      expect(result.summary.questionExceptions).toEqual([])
      expect(byDni(result, '22222222').score).toBe(592)
    })

    it('modo real: cada tipo de prueba usa las excepciones de su propia clave', () => {
      const keyP = KEY
      const keyQ = OTHER_KEY
      const sheetP = { dni: '11111111', tipo: 'P', answers: ' '.repeat(60), litho: '000001' }
      const sheetQ = { dni: '22222222', tipo: 'Q', answers: ' '.repeat(60), litho: '000002' }
      const keys = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({ area: 'Ingeniería', tipo, answers: tipo === 'Q' ? keyQ : keyP }))
      const input = makeInput({
        processType: 'real',
        archiveRows: [
          { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'A' },
          { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'B' },
        ],
        responsesRows: [sheetP, sheetQ],
        responsesByDni: new Map([['11111111', [sheetP]], ['22222222', [sheetQ]]]),
        answerKeyRows: keys,
        answerKeyLookupByAreaTipo: new Map(),
        vacantesPrograma: { Civil: 1 },
        // Solo se anula la pregunta 3 del tipo Q.
        questionExceptions: [exception({ area: 'Ingeniería', tipo: 'Q', questionNumber: 3, keySha256: keyFingerprint(keyQ) })],
      })
      const result = calculateAreaResults(input)

      // Ambas hojas están en blanco (60 × 2); solo la del tipo Q recibe el punto de la pregunta 3 en lugar del blanco.
      expect(byDni(result, '11111111').score).toBe(120)
      expect(byDni(result, '22222222').score).toBe(120 - 2 + 10)
    })

    it('las excepciones entran en la huella de configuración', () => {
      const without = calculateAreaResults(generalInput()).summary.configSha256
      const withException = calculateAreaResults(generalInput({ questionExceptions: [exception()] })).summary.configSha256
      const different = calculateAreaResults(generalInput({ questionExceptions: [exception({ questionNumber: 6 })] })).summary.configSha256

      expect(withException).not.toBe(without)
      expect(different).not.toBe(withException)
    })

    it('una excepción desactualizada no cambia la huella (no se aplicó)', () => {
      const without = calculateAreaResults(generalInput()).summary.configSha256
      const outdated = calculateAreaResults(generalInput({ questionExceptions: [exception({ keySha256: keyFingerprint(OTHER_KEY) })] })).summary.configSha256
      expect(outdated).toBe(without)
    })

    it('el resultado con excepciones pasa la auditoría', () => {
      const result = calculateAreaResults(generalInput({ questionExceptions: [exception(), exception({ id: 2, questionNumber: 9, type: 'ANULADA_EXCLUIR' })] }))
      const validation = validateCalificationResult({ result })
      expect(validation.errors).toEqual([])
      expect(validation.valid).toBe(true)
    })
  })

  it('no asigna áreas desconocidas a la primera área disponible', () => {
    expect(() => calculateAreaResults(makeInput({
      area: 'Biomédicas',
      archiveRows: [
        { dni: '12345678', area: 'Area Desconocida', programa: 'Civil', paterno: 'A' },
      ],
      answerKeyRows: [
        { area: 'Biomédicas', tipo: 'P', answers: makeAnswers('A') },
      ],
      answerKeyLookupByAreaTipo: new Map([
        ['Biomédicas|P', { area: 'Biomédicas', tipo: 'P', answers: makeAnswers('A') }],
      ]),
    }))).toThrow('No hay postulantes registrados')
  })

  it('desempata por orden alfabético y luego DNI', () => {
    const result = calculateAreaResults(makeInput({
      archiveRows: [
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'Zeta', materno: 'B', nombres: 'Ana' },
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: 'C', nombres: 'Luis' },
        { dni: '33333333', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: 'C', nombres: 'Luis' },
      ],
      responsesRows: [
        { dni: '22222222', tipo: 'P', answers: makeAnswers('A') },
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
      ],
      responsesByDni: new Map([
        ['22222222', [{ dni: '22222222', tipo: 'P', answers: makeAnswers('A') }]],
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['33333333', [{ dni: '33333333', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
    }))

    expect(result.results.map(row => row.dni)).toEqual(['11111111', '33333333', '22222222'])
    expect(result.results.map(row => row.position)).toEqual([1, 2, 3])
  })

  it('en simulacro por áreas prioriza la clave única del área sin tipo', () => {
    const result = calculateAreaResults(makeInput({
      area: 'Sociales',
      archiveRows: [
        { dni: '11111111', area: 'Sociales', paterno: 'A' },
        { dni: '22222222', area: 'Sociales', paterno: 'B' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('A') },
      ],
      answerKeyRows: [
        { area: 'Sociales', tipo: '', answers: makeAnswers('A') },
        { area: 'Sociales', tipo: 'P', answers: makeAnswers('B') },
      ],
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['22222222', [{ dni: '22222222', tipo: 'Q', answers: makeAnswers('A') }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['SOCIALES|P', { area: 'Sociales', tipo: 'P', answers: makeAnswers('B') }],
      ]),
      answerKeyFallbackByArea: new Map([
        ['SOCIALES', { area: 'Sociales', tipo: '', answers: makeAnswers('A') }],
      ]),
    }))

    expect(result.results.map(row => row.score)).toEqual([600, 600])
    expect(result.results.every(row => row.correctAnswersRaw === makeAnswers('A'))).toBe(true)
  })

  it('en simulacro por áreas no usa clave general accidentalmente', () => {
    const result = calculateAreaResults(makeInput({
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      answerKeyLookupByAreaTipo: new Map(),
      answerKeyFallbackByArea: new Map(),
    }))

    expect(result.results).toHaveLength(0)
    expect(result.summary.noCalificados[0]).toMatchObject({
      dni: '12345678',
      motivo: 'Sin clave',
    })
  })

  it('exige exactamente una clave general en simulacro general', () => {
    expect(() => calculateAreaResults(makeInput({
      processType: 'simulacro',
      simulacroScope: 'general',
      archiveRows: [{ dni: '12345678', area: '' }],
      answerKeyRows: [{ area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') }],
    }))).toThrow('exactamente una clave general')
  })

  it('rechaza plantillas que no cubren todas las preguntas', () => {
    expect(() => calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        items: [{ subject: 'General', questionCount: 59, ponderation: 1 }],
      }),
    }))).toThrow('cubre 59 preguntas')
  })

  it('rechaza claves oficiales con respuestas inválidas', () => {
    expect(() => calculateAreaResults(makeInput({
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: `${makeAnswers('A', 10)}X${makeAnswers('A', 49)}` },
      ],
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: `${makeAnswers('A', 10)}X${makeAnswers('A', 49)}` }],
      ]),
    }))).toThrow('pregunta 11')
  })

  it('incluye trazabilidad por pregunta y por materia', () => {
    const result = calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        questionTotal: 3,
        items: [
          { subject: 'Matemática', questionCount: 2, ponderation: 2 },
          { subject: 'Verbal', questionCount: 1, ponderation: 1 },
        ],
      }),
      answersLength: 3,
      correctValue: 10,
      incorrectValue: -1,
      blankValue: 2,
      responsesRows: [
        { dni: '12345678', tipo: 'P', answers: 'AB', litho: '100001' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: 'AAC' },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: 'P', answers: 'AB', litho: '100001' }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: 'AAC' }],
      ]),
    }))

    expect(result.results[0]).toMatchObject({
      score: 20,
      answersRaw: 'AB ',
      correctAnswersRaw: 'AAC',
      questionDetails: [
        {
          number: 1,
          subject: 'Matemática',
          weight: 2,
          answer: 'A',
          correctAnswer: 'A',
          status: 'correct',
          score: 20,
        },
        {
          number: 2,
          subject: 'Matemática',
          weight: 2,
          answer: 'B',
          correctAnswer: 'A',
          status: 'incorrect',
          score: -2,
        },
        {
          number: 3,
          subject: 'Verbal',
          weight: 1,
          answer: '',
          blankSource: 'assumed-final',
          correctAnswer: 'C',
          status: 'blank',
          score: 2,
        },
      ],
      subjectBreakdown: [
        {
          subject: 'Matemática',
          questions: 2,
          correct: 1,
          incorrect: 1,
          blank: 0,
          score: 18,
          totalWeight: 4,
        },
        {
          subject: 'Verbal',
          questions: 1,
          correct: 0,
          incorrect: 0,
          blank: 1,
          score: 2,
          totalWeight: 1,
        },
      ],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('califica asterisco como marca múltiple con puntaje cero', () => {
    const result = calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        questionTotal: 3,
        items: [
          { subject: 'General', questionCount: 3, ponderation: 1 },
        ],
      }),
      answersLength: 3,
      correctValue: 10,
      incorrectValue: -1,
      blankValue: 2,
      responsesRows: [
        { dni: '12345678', tipo: 'P', answers: 'A* ', litho: '100001' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: 'ABC' },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: 'P', answers: 'A* ', litho: '100001' }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: 'ABC' }],
      ]),
    }))

    expect(result.results[0]).toMatchObject({
      score: 12,
      questionDetails: [
        expect.objectContaining({ number: 1, status: 'correct', score: 10 }),
        expect.objectContaining({ number: 2, answer: '*', status: 'multiple', score: 0 }),
        expect.objectContaining({ number: 3, status: 'blank', score: 2 }),
      ],
      subjectBreakdown: [
        expect.objectContaining({
          correct: 1,
          incorrect: 0,
          multiple: 1,
          blank: 1,
          score: 12,
        }),
      ],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('marca ingresantes por programa en proceso real', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería',
      tipo,
      answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil' },
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('B') },
      ],
      answerKeyRows,
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['22222222', [{ dni: '22222222', tipo: 'Q', answers: makeAnswers('B') }]],
      ]),
      answerKeyLookupByAreaTipo: new Map(),
      vacantesPrograma: { Civil: 1 },
    }))

    expect(result.results.map((row) => ({
      dni: row.dni,
      position: row.position,
      positionInPrograma: row.positionInPrograma,
      isIngresante: row.isIngresante,
    }))).toEqual([
      { dni: '11111111', position: 1, positionInPrograma: 1, isIngresante: true },
      { dni: '22222222', position: 2, positionInPrograma: 2, isIngresante: false },
    ])
    expect(validateCalificationResult({
      result,
      processType: 'real',
      vacantesPrograma: { Civil: 1 },
    })).toMatchObject({ valid: true })
  })

  it('no marca ingresantes cuando el programa tiene cero vacantes', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería', tipo, answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [{ dni: '11111111', area: 'Ingeniería', programa: 'Civil' }],
      responsesRows: [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }],
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
      answerKeyRows,
      answerKeyLookupByAreaTipo: new Map(),
      vacantesPrograma: { Civil: 0 },
    }))

    expect(result.results[0]).toMatchObject({ positionInPrograma: 1, isIngresante: false })
    expect(validateCalificationResult({
      result,
      processType: 'real',
      vacantesPrograma: { Civil: 0 },
    })).toMatchObject({ valid: true })
  })

  it('desempata alfabéticamente dentro del ranking por programa en proceso real', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería',
      tipo,
      answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'Zeta', materno: '', nombres: 'Ana' },
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: '', nombres: 'Luis' },
      ],
      responsesRows: [
        { dni: '22222222', tipo: 'P', answers: makeAnswers('A') },
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
      ],
      answerKeyRows,
      responsesByDni: new Map([
        ['22222222', [{ dni: '22222222', tipo: 'P', answers: makeAnswers('A') }]],
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
      vacantesPrograma: { Civil: 1 },
    }))

    expect(result.results.map(row => ({ dni: row.dni, positionInPrograma: row.positionInPrograma, isIngresante: row.isIngresante }))).toEqual([
      { dni: '11111111', positionInPrograma: 1, isIngresante: true },
      { dni: '22222222', positionInPrograma: 2, isIngresante: false },
    ])
  })
})
