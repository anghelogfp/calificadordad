// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { computeFileSha256, formatHashBlocks, sha256Hex, sha256HexFromBytes } from '../cryptoHash'

const reference = (data) => createHash('sha256').update(data).digest('hex')

describe('sha256Hex', () => {
  it('coincide con los vectores de prueba oficiales', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })

  it('coincide con crypto de Node en longitudes alrededor de los límites de bloque', () => {
    // 55, 56 y 63, 64 son los límites donde cambia el relleno del algoritmo.
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 1000, 65536]) {
      const bytes = randomBytes(length)
      expect(sha256HexFromBytes(bytes), `longitud ${length}`).toBe(reference(bytes))
    }
  })

  it('coincide con crypto de Node en 200 contenidos aleatorios', () => {
    for (let i = 0; i < 200; i += 1) {
      const bytes = randomBytes(Math.floor(Math.random() * 600))
      expect(sha256HexFromBytes(bytes)).toBe(reference(bytes))
    }
  })

  it('codifica el texto como UTF-8', () => {
    for (const text of ['ñandú', 'Quispe Ccama, José', '日本語', 'A\u001aB']) {
      expect(sha256Hex(text)).toBe(reference(text))
    }
  })
})

describe('computeFileSha256', () => {
  it('usa los bytes originales del archivo, no su texto decodificado', async () => {
    // Bytes que no son UTF-8 válido (latin1): decodificar a texto los alteraría.
    const bytes = Uint8Array.from([0x41, 0xd1, 0x42, 0xff, 0x1a, 0x43])
    const file = new Blob([bytes])

    expect(await computeFileSha256(file)).toBe(reference(Buffer.from(bytes)))
    expect(await computeFileSha256(file)).not.toBe(reference(await file.text()))
  })

  it('devuelve vacío, no un hash falso, cuando no se pueden leer los bytes', async () => {
    expect(await computeFileSha256({ name: 'x.dat', text: async () => 'hola' })).toBe('')
    expect(await computeFileSha256(null)).toBe('')
    expect(await computeFileSha256(undefined)).toBe('')
    expect(await computeFileSha256({ arrayBuffer: async () => { throw new Error('boom') } })).toBe('')
  })

  it('acepta bytes y texto directamente', async () => {
    expect(await computeFileSha256('abc')).toBe(reference('abc'))
    expect(await computeFileSha256(new Uint8Array([1, 2, 3]))).toBe(reference(Buffer.from([1, 2, 3])))
  })
})

describe('formatHashBlocks', () => {
  it('separa el hash en bloques de 8 en mayúsculas', () => {
    expect(formatHashBlocks('abcdef0123456789abcdef0123456789')).toBe('ABCDEF01 23456789 ABCDEF01 23456789')
    expect(formatHashBlocks('')).toBe('')
  })
})
