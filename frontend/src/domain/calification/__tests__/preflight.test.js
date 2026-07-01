import { describe, expect, it } from 'vitest'
import { buildCalificationPreflight } from '../preflight'

function makeAnswers(char, length = 60) {
  return char.repeat(length)
}

function byKey(preflight) {
  return Object.fromEntries(preflight.items.map((item) => [item.key, item]))
}

function makeBaseInput(overrides = {}) {
  return {
    area: 'Ingeniería',
    processType: 'simulacro',
    simulacroScope: 'areas',
    archiveRows: [
      { dni: '12345678', area: 'Ingeniería', programa: 'Civil' },
    ],
    responsesRows: [
      { dni: '12345678', tipo: 'P', answers: makeAnswers('A') },
    ],
    answerKeyRows: [
      { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
    ],
    responsesByDni: new Map([
      ['12345678', [{ dni: '12345678', tipo: 'P', answers: makeAnswers('A') }]],
    ]),
    areaList: ['Biomédicas', 'Sociales', 'Ingeniería'],
    ...overrides,
  }
}

describe('buildCalificationPreflight', () => {
  it('devuelve estado limpio cuando hay candidatos, respuestas y claves', () => {
    const preflight = buildCalificationPreflight(makeBaseInput())

    expect(preflight.hasBlockers).toBe(false)
    expect(preflight.hasWarnings).toBe(false)
    expect(byKey(preflight).candidates).toMatchObject({
      value: 1,
      status: 'ok',
    })
    expect(byKey(preflight).answerKeys).toMatchObject({
      value: 'Disponibles',
      status: 'ok',
    })
  })

  it('marca blocker si no hay candidatos o faltan claves', () => {
    const preflight = buildCalificationPreflight(makeBaseInput({
      archiveRows: [],
      responsesRows: [],
      answerKeyRows: [],
      responsesByDni: new Map(),
    }))

    expect(preflight.hasBlockers).toBe(true)
    expect(byKey(preflight).candidates.status).toBe('error')
    expect(byKey(preflight).answerKeys).toMatchObject({
      status: 'error',
      value: 'No encontradas',
    })
  })

  it('advierte DNI inválido, respuesta faltante, duplicada, huérfana y sin DNI', () => {
    const preflight = buildCalificationPreflight(makeBaseInput({
      archiveRows: [
        { dni: '1234', area: 'Ingeniería' },
        { dni: '22222222', area: 'Ingeniería' },
        { dni: '33333333', area: 'Ingeniería' },
      ],
      responsesRows: [
        { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
        { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
        { dni: '99999999', tipo: 'P', answers: makeAnswers('A') },
        { dni: '', tipo: 'P', answers: makeAnswers('A') },
      ],
      responsesByDni: new Map([
        ['33333333', [
          { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
          { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
        ]],
        ['99999999', [{ dni: '99999999', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
    }))

    const items = byKey(preflight)
    expect(preflight.hasWarnings).toBe(true)
    expect(items.invalidDni.value).toBe(1)
    expect(items.withoutResponse.value).toBe(2)
    expect(items.duplicatedResponses.value).toBe(1)
    expect(items.orphan.value).toBe(1)
    expect(items.unlinked.value).toBe(1)
  })

  it('usa candidatos sin área como fallback solo en simulacro por áreas', () => {
    const preflight = buildCalificationPreflight(makeBaseInput({
      archiveRows: [
        { dni: '12345678', area: '', programa: '' },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
    }))

    expect(preflight.hasBlockers).toBe(false)
    expect(byKey(preflight).noArea).toMatchObject({
      value: 1,
      status: 'warn',
    })
  })

  it('en modo real exige claves P/Q/R/S/T y advierte datos incompletos', () => {
    const preflight = buildCalificationPreflight(makeBaseInput({
      processType: 'real',
      archiveRows: [
        { dni: '12345678', area: 'Ingeniería', programa: '' },
        { dni: '87654321', area: '', programa: 'Civil' },
      ],
      responsesRows: [
        { dni: '12345678', tipo: '', answers: makeAnswers('A') },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: '', answers: makeAnswers('A') }]],
      ]),
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
      ],
    }))

    const items = byKey(preflight)
    expect(preflight.hasBlockers).toBe(true)
    expect(items.answerKeys).toMatchObject({
      status: 'error',
      detail: 'Faltan claves para Ingeniería: Q, R, S, T.',
    })
    expect(items.missingArea.value).toBe(1)
    expect(items.missingTipo.value).toBe(1)
    expect(items.sinPrograma.value).toBe(1)
  })

  it('acepta clave general en simulacro general', () => {
    const preflight = buildCalificationPreflight(makeBaseInput({
      area: 'General',
      simulacroScope: 'general',
      archiveRows: [
        { dni: '12345678', area: '' },
      ],
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: '', answers: makeAnswers('A') }]],
      ]),
    }))

    expect(preflight.hasBlockers).toBe(false)
    expect(byKey(preflight).answerKeys.status).toBe('ok')
  })
})
