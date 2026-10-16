import { describe, expect, it } from 'vitest'
import { scoreAnswerSheet } from '../scoreAnswerSheet'
import { calculatePjResults } from '../calculatePjResults'
import { calculateAreaResults } from '../calculateResults'
import { runPreCalificationSyntheticSuite } from '../syntheticTests'
import { buildCanonicalConfigurationPayload, computeConfigurationSha256 } from '../configHash'
import { buildCalificationPreflight } from '../preflight'
import { validateCalificationResult } from '../validateResults'

const PJ_27_EXAM_CODES = [
  'E01a', 'E01b', 'E02a', 'E02b', 'E02c', 'E03a', 'E03b', 'E03c', 'E03d',
  'E04a', 'E04b', 'E05', 'E06', 'E07', 'E08a', 'E08b', 'E09a', 'E09b',
  'E09c', 'E09d', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16',
]

function make30Plan(weight = 1) {
  return Array.from({ length: 30 }, () => ({ subject: 'Conocimientos', weight }))
}

function makePjPlantilla() {
  return {
    id: 'pj-30',
    name: 'Poder Judicial — 30 Preguntas',
    questionTotal: 30,
    items: [{ subject: 'Conocimientos', questionCount: 30, ponderation: 1 }],
  }
}

describe('scoreAnswerSheet', () => {
  it('califica correctamente aciertos, errores, blancos y marcas múltiples (*)', () => {
    const plan = [
      { subject: 'Derecho', weight: 1 },
      { subject: 'Derecho', weight: 1 },
      { subject: 'Derecho', weight: 1 },
      { subject: 'Derecho', weight: 1 },
    ]
    const res = scoreAnswerSheet({
      answersRaw: 'AC* ',
      correctAnswersRaw: 'ABCD',
      plan,
      correctValue: 1,
      incorrectValue: -0.25,
      blankValue: 0,
    })

    expect(res.score).toBe(0.75)
    expect(res.maxPossibleScore).toBe(4)
    expect(res.correctCount).toBe(1)
    expect(res.incorrectCount).toBe(1)
    expect(res.multipleCount).toBe(1)
    expect(res.blankCount).toBe(1)
    expect(res.questionDetails.map((q) => q.status)).toEqual([
      'correct',
      'incorrect',
      'multiple',
      'blank',
    ])
  })

  it('aplica ANULADA_OTORGAR, ANULADA_EXCLUIR y CLAVE_MULTIPLE', () => {
    const plan = Array.from({ length: 5 }, () => ({ subject: 'Conocimientos', weight: 2 }))
    const res = scoreAnswerSheet({
      answersRaw: ' *DBC',
      correctAnswersRaw: 'AAAAA',
      plan,
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      questionExceptions: [
        { questionNumber: 1, type: 'ANULADA_OTORGAR', reason: 'Enunciado ambiguo' },
        { questionNumber: 2, type: 'ANULADA_EXCLUIR', reason: 'Fuera de temario' },
        { questionNumber: 3, type: 'CLAVE_MULTIPLE', validAnswers: 'BD', reason: 'Doble respuesta' },
        { questionNumber: 4, type: 'CLAVE_MULTIPLE', validAnswers: 'BD', reason: 'Doble respuesta' },
      ],
    })

    // Preg 1: blanco pero ANULADA_OTORGAR -> +2 (correct)
    // Preg 2: * pero ANULADA_EXCLUIR -> 0 (excluded), no suma a maxPossibleScore
    // Preg 3: marcó D, clave múltiple BD -> +2 (correct)
    // Preg 4: marcó B, clave múltiple BD -> +2 (correct)
    // Preg 5: marcó C vs A -> 0 (incorrect)
    expect(res.score).toBe(6)
    expect(res.maxPossibleScore).toBe(8) // 4 preguntas válidas * peso 2
    expect(res.annulledGrantedCount).toBe(1)
    expect(res.annulledExcludedCount).toBe(1)
    expect(res.correctCount).toBe(3)
    expect(res.incorrectCount).toBe(1)
    expect(res.questionDetails[0]).toMatchObject({
      number: 1,
      status: 'correct',
      exceptionApplied: 'ANULADA_OTORGAR',
      score: 2,
    })
    expect(res.questionDetails[1]).toMatchObject({
      number: 2,
      status: 'excluded',
      exceptionApplied: 'ANULADA_EXCLUIR',
      score: 0,
    })
    expect(res.questionDetails[2]).toMatchObject({
      number: 3,
      status: 'correct',
      exceptionApplied: 'CLAVE_MULTIPLE',
      correctAnswer: 'BD',
      score: 2,
    })
  })

  it('lanza error si la clave oficial tiene un caracter inválido sin excepción', () => {
    expect(() =>
      scoreAnswerSheet({
        answersRaw: 'AAA',
        correctAnswersRaw: 'AXA',
        plan: make30Plan().slice(0, 3),
      }),
    ).toThrow('La clave oficial contiene una respuesta inválida en la pregunta 2.')
  })
})

describe('calculatePjResults', () => {
  it('califica los 27 códigos de examen y 59 puestos ignorando tipo R del .dat y parseando grupo/aula', () => {
    const answerKeyRows = PJ_27_EXAM_CODES.map((code, idx) => ({
      cod_examen: code,
      area: code,
      answers: 'ABCDE'.repeat(6),
      id: `key-${idx}`,
    }))

    const archiveRows = []
    const responsesRows = []
    for (let i = 0; i < 59; i += 1) {
      const dni = String(40000001 + i)
      const codExamen = PJ_27_EXAM_CODES[i % PJ_27_EXAM_CODES.length]
      const codPuesto = `P-${String(i + 1).padStart(3, '0')}`
      const grupoNum = (i % 2) + 1
      const aulaCode = `A${String((i % 25) + 1).padStart(2, '0')}`
      archiveRows.push({
        dni,
        paterno: `APELLIDO_${i + 1}`,
        materno: 'MATERNO',
        nombres: 'NOMBRE',
        cod_examen: codExamen,
        cod_puesto: codPuesto,
        puesto: `ESPECIALISTA JUDICIAL ${i + 1}`,
        unidad: `MODULO PENAL ${(i % 10) + 1}`,
        observaciones: `grupo ${grupoNum} - aula ${aulaCode}`,
      })
      responsesRows.push({
        dni,
        tipo: 'R', // El .dat trae R, que en PJ no debe bloquear ni exigir P/Q/R/S/T
        aula: '789',
        answers: 'ABCDE'.repeat(6),
        litho: String(243001 + i),
      })
    }

    const result = calculateAreaResults({
      processType: 'poder_judicial',
      plantilla: makePjPlantilla(),
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      answersLength: 30,
      archiveRows,
      responsesRows,
      answerKeyRows,
    })

    expect(result.results).toHaveLength(59)
    expect(result.summary.noCalificados).toHaveLength(0)
    expect(result.results[0]).toMatchObject({
      score: 30,
      maxPossibleScore: 30,
      grupo: 'Grupo 1',
      aula: 'A01',
      aulaDat: '789',
    })

    const validation = validateCalificationResult({
      result,
      processType: 'poder_judicial',
      answersLength: 30,
    })
    expect(validation.valid).toBe(true)
  })

  it('aísla postulantes anulados por comisión y aplica excepciones por COD_EXAMEN', () => {
    const keyE02a = 'A'.repeat(30)
    const keyE05 = 'B'.repeat(30)

    const result = calculatePjResults({
      plantilla: makePjPlantilla(),
      answersLength: 30,
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      archiveRows: [
        {
          dni: '44095837',
          paterno: 'ACERO',
          materno: 'CALIZAYA',
          nombres: 'RONAN',
          cod_examen: 'E02a',
          cod_puesto: '00301',
          puesto: 'ASISTENTE JURISDICCIONAL',
          unidad: 'SALA PENAL',
        },
        {
          dni: '44095838',
          paterno: 'QUISPE',
          materno: 'MAMANI',
          nombres: 'ANA',
          cod_examen: 'E02a',
          cod_puesto: '00301',
          puesto: 'ASISTENTE JURISDICCIONAL',
          unidad: 'SALA PENAL',
        },
        {
          dni: '44095839',
          paterno: 'FLORES',
          materno: 'CONDORI',
          nombres: 'LUIS',
          cod_examen: 'E05',
          cod_puesto: '00501',
          puesto: 'ANALISTA II',
          unidad: 'ADMINISTRACION',
        },
      ],
      responsesRows: [
        { dni: '44095837', tipo: 'R', answers: 'A'.repeat(30) },
        { dni: '44095838', tipo: 'R', answers: ' '.repeat(30) }, // Todo en blanco, pero E02a tiene preg 14 ANULADA_OTORGAR
        { dni: '44095839', tipo: 'R', answers: ' '.repeat(30) }, // En blanco en E05, no recibe preg 14 de E02a
      ],
      answerKeyRows: [
        { cod_examen: 'E02a', answers: keyE02a },
        { cod_examen: 'E05', answers: keyE05 },
      ],
      questionExceptions: [
        {
          codExamen: 'E02a',
          questionNumber: 14,
          type: 'ANULADA_OTORGAR',
          reason: 'Error tipográfico en E02a',
          documentRef: 'Acta 01-PJ',
        },
        {
          codExamen: 'E05',
          questionNumber: 5,
          type: 'ANULADA_EXCLUIR',
          reason: 'Pregunta excluida en E05',
          documentRef: 'Acta 02-PJ',
        },
      ],
      candidateExceptions: [
        {
          dni: '44095837',
          reason: 'Uso de dispositivo prohibido en aula',
          documentRef: 'Acta de Incidencia Aula A18',
        },
      ],
    })

    expect(result.results).toHaveLength(2)
    expect(result.summary.anuladosComision).toHaveLength(1)
    expect(result.summary.anuladosComision[0]).toMatchObject({
      dni: '44095837',
      motivo: 'Participación anulada por comisión',
      detalle: 'Uso de dispositivo prohibido en aula',
      documento: 'Acta de Incidencia Aula A18',
    })

    const ana = result.results.find((r) => r.dni === '44095838')
    const luis = result.results.find((r) => r.dni === '44095839')
    expect(ana.score).toBe(1)
    expect(ana.maxPossibleScore).toBe(30)
    expect(luis.score).toBe(0)
    expect(luis.maxPossibleScore).toBe(29)

    const validation = validateCalificationResult({
      result,
      processType: 'poder_judicial',
      answersLength: 30,
    })
    expect(validation.valid).toBe(true)
  })

  it('detecta empates en corte de vacantes y soporta shared_rank, fewer_incorrect y alphabetical', () => {
    const key = 'A'.repeat(30)
    const archiveRows = [
      { dni: '11111111', paterno: 'ZETA', nombres: 'UNO', cod_examen: 'E01a', cod_puesto: 'P01', puesto: 'JUEZ PAZ' },
      { dni: '22222222', paterno: 'ALFA', nombres: 'DOS', cod_examen: 'E01a', cod_puesto: 'P01', puesto: 'JUEZ PAZ' },
      { dni: '33333333', paterno: 'BETA', nombres: 'TRES', cod_examen: 'E01a', cod_puesto: 'P01', puesto: 'JUEZ PAZ' },
    ]
    // Con incorrectValue = -1, podemos lograr el mismo puntaje con distinto número de aciertos/errores
    // Postulante 1: 20 correctas, 2 incorrectas, 8 blancas -> 20 - 2 = 18
    // Postulante 2: 18 correctas, 0 incorrectas, 12 blancas -> 18 - 0 = 18
    // Postulante 3: 10 correctas, 0 incorrectas, 20 blancas -> 10
    const responsesRows = [
      { dni: '11111111', answers: 'A'.repeat(20) + 'B'.repeat(2) + ' '.repeat(8) },
      { dni: '22222222', answers: 'A'.repeat(18) + ' '.repeat(12) },
      { dni: '33333333', answers: 'A'.repeat(10) + ' '.repeat(20) },
    ]
    const answerKeyRows = [{ cod_examen: 'E01a', answers: key }]

    // 1. Modo shared_rank con cupo = 1 y nota mínima = 15
    const sharedRes = calculatePjResults({
      plantilla: makePjPlantilla(),
      correctValue: 1,
      incorrectValue: -1,
      blankValue: 0,
      answersLength: 30,
      archiveRows,
      responsesRows,
      answerKeyRows,
      vacantesPuesto: { P01: 1 },
      scoringOptions: {
        useMinPassingScore: true,
        minPassingScore: 15,
        requireQuotaForIngreso: true,
        tieBreakerMode: 'shared_rank',
      },
    })

    expect(sharedRes.summary.totalTiedCandidates).toBe(2)
    expect(sharedRes.summary.tiesAtCutoff).toHaveLength(1)
    expect(sharedRes.summary.tiesAtCutoff[0]).toMatchObject({
      codPuesto: 'P01',
      cupo: 1,
      cutoffScore: 18,
      tiedCount: 2,
    })
    expect(sharedRes.results.map((r) => r.positionInPrograma)).toEqual([1, 1, 3])
    expect(sharedRes.results.map((r) => r.condicion)).toEqual([
      'EMPATE EN CORTE',
      'EMPATE EN CORTE',
      'NO APROBADO',
    ])
    expect(
      validateCalificationResult({
        result: sharedRes,
        processType: 'poder_judicial',
        vacantesPuesto: { P01: 1 },
      }).valid,
    ).toBe(true)

    // 2. Modo fewer_incorrect (más aciertos primero: 11111111 tiene 20 aciertos vs 22222222 con 18 aciertos)
    const fewerIncRes = calculatePjResults({
      plantilla: makePjPlantilla(),
      correctValue: 1,
      incorrectValue: -1,
      blankValue: 0,
      answersLength: 30,
      archiveRows,
      responsesRows,
      answerKeyRows,
      vacantesPuesto: { P01: 1 },
      scoringOptions: {
        useMinPassingScore: true,
        minPassingScore: 15,
        requireQuotaForIngreso: true,
        tieBreakerMode: 'fewer_incorrect',
      },
    })
    expect(fewerIncRes.results.map((r) => r.dni)).toEqual(['11111111', '22222222', '33333333'])
    expect(fewerIncRes.results.map((r) => r.positionInPrograma)).toEqual([1, 2, 3])
    expect(fewerIncRes.results.map((r) => r.isIngresante)).toEqual([true, false, false])

    // 3. Modo alphabetical (ALFA antes que ZETA)
    const alphaRes = calculatePjResults({
      plantilla: makePjPlantilla(),
      correctValue: 1,
      incorrectValue: -1,
      blankValue: 0,
      answersLength: 30,
      archiveRows,
      responsesRows,
      answerKeyRows,
      vacantesPuesto: { P01: 1 },
      scoringOptions: {
        useMinPassingScore: false,
        tieBreakerMode: 'alphabetical',
      },
    })
    expect(alphaRes.results.map((r) => r.dni)).toEqual(['22222222', '11111111', '33333333'])
    expect(alphaRes.results.map((r) => r.positionInPrograma)).toEqual([1, 2, 3])
  })
})

describe('runPreCalificationSyntheticSuite', () => {
  it('ejecuta y aprueba los 5 casos sintéticos obligatorios del protocolo PJ', () => {
    const suite = runPreCalificationSyntheticSuite({
      answerKeyRows: [{ cod_examen: 'E02a', answers: 'ABCDE'.repeat(6) }],
      plantilla: makePjPlantilla(),
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      answersLength: 30,
      sampleExamCode: 'E02a',
    })

    expect(suite.passedAll).toBe(true)
    expect(suite.examCodeTested).toBe('E02a')
    expect(suite.cases).toHaveLength(5)
    expect(suite.cases.map((c) => c.code)).toEqual([
      'ALL_CORRECT',
      'ALL_INCORRECT',
      'ALL_BLANK',
      'WITH_EXCEPTIONS',
      'CANDIDATE_ANNULMENT',
    ])
    expect(suite.cases.every((c) => c.passed)).toBe(true)
  })
})

describe('configHash', () => {
  it('produce exactamente el mismo SHA-256 canónico sin importar el orden de las claves o excepciones', () => {
    const hashA = computeConfigurationSha256({
      answersLength: 30,
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      answerKeyRows: [
        { cod_examen: 'E02a', answers: 'A'.repeat(30) },
        { cod_examen: 'E01a', answers: 'B'.repeat(30) },
      ],
      questionExceptions: [
        { codExamen: 'E02a', questionNumber: 14, type: 'CLAVE_MULTIPLE', validAnswers: 'DB' },
        { codExamen: 'E01a', questionNumber: 3, type: 'ANULADA_OTORGAR' },
      ],
      candidateExceptions: [
        { dni: '44095837', reason: 'Motivo 1' },
        { dni: '12345678', reason: 'Motivo 2' },
      ],
    })

    const hashB = computeConfigurationSha256({
      answersLength: 30,
      correctValue: 1,
      incorrectValue: 0,
      blankValue: 0,
      answerKeyRows: [
        { cod_examen: 'E01a', answers: 'B'.repeat(30) },
        { cod_examen: 'E02a', answers: 'A'.repeat(30) },
      ],
      questionExceptions: [
        { codExamen: 'E01a', questionNumber: 3, type: 'ANULADA_OTORGAR' },
        { codExamen: 'E02a', questionNumber: 14, type: 'CLAVE_MULTIPLE', validAnswers: 'BD' },
      ],
      candidateExceptions: [
        { dni: '12345678', reason: 'Motivo 2' },
        { dni: '44095837', reason: 'Motivo 1' },
      ],
    })

    expect(hashA.sha256).toHaveLength(64)
    expect(hashA.sha256).toBe(hashB.sha256)
    expect(hashA.formatted).toBe(hashB.formatted)
    expect(String(hashA)).toBe(hashA.sha256)

    const payload = buildCanonicalConfigurationPayload({
      answerKeyRows: [{ cod_examen: 'E01a', answers: 'C'.repeat(30) }],
    })
    expect(payload.answerKeys[0].codExamen).toBe('E01a')
  })
})

describe('buildCalificationPreflight en modo poder_judicial', () => {
  it('verifica las 27 claves por código de examen y no reporta missingTipo ni invalidTipo', () => {
    const archiveRows = PJ_27_EXAM_CODES.map((code, i) => ({
      dni: String(10000001 + i),
      cod_examen: code,
      cod_puesto: `P-${i + 1}`,
    }))
    const responsesRows = archiveRows.map((c) => ({
      dni: c.dni,
      tipo: 'R',
      answers: 'A'.repeat(30),
    }))
    const responsesByDni = new Map(responsesRows.map((r) => [r.dni, [r]]))
    const answerKeyRows = PJ_27_EXAM_CODES.map((code) => ({
      cod_examen: code,
      answers: 'A'.repeat(30),
    }))

    const preflightOk = buildCalificationPreflight({
      processType: 'poder_judicial',
      archiveRows,
      responsesRows,
      answerKeyRows,
      responsesByDni,
    })

    expect(preflightOk.hasBlockers).toBe(false)
    expect(preflightOk.hasWarnings).toBe(false)
    const itemsByKey = Object.fromEntries(preflightOk.items.map((i) => [i.key, i]))
    expect(itemsByKey.answerKeys).toMatchObject({
      status: 'ok',
      value: '27 / 27 claves por código de examen',
    })
    expect(itemsByKey.missingTipo).toBeUndefined()
    expect(itemsByKey.invalidTipo).toBeUndefined()

    const preflightMissing = buildCalificationPreflight({
      processType: 'poder_judicial',
      archiveRows,
      responsesRows,
      answerKeyRows: answerKeyRows.slice(0, 25),
      responsesByDni,
    })
    expect(preflightMissing.hasBlockers).toBe(true)
    expect(preflightMissing.examCodesSummary.missingExamCodes).toEqual(['E15', 'E16'])
  })
})
