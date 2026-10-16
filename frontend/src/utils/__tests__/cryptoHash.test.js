import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  computeFileSha256,
  formatHashBlocks,
  sha256Hex,
  sha256HexFromBytes,
} from '../cryptoHash'

describe('cryptoHash', () => {
  it('calcula vectores estándar NIST SHA-256 para cadenas vacías y "abc"', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('calcula correctamente SHA-256 para entradas de múltiples bloques (>64 bytes)', () => {
    const vector = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
    expect(sha256Hex(vector)).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })

  it('soporta Uint8Array, ArrayBuffer y Blob en computeFileSha256', async () => {
    const bytes = new Uint8Array([97, 98, 99]) // "abc"
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

    expect(sha256HexFromBytes(bytes)).toBe(expected)
    expect(await computeFileSha256(bytes)).toBe(expected)
    expect(await computeFileSha256(bytes.buffer)).toBe(expected)

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([bytes])
      expect(await computeFileSha256(blob)).toBe(expected)
    }
  })

  it('formatea el hash en bloques de 8 caracteres en mayúsculas', () => {
    const hash = 'decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92'
    expect(formatHashBlocks(hash)).toBe(
      'DECF8001 72EFCFDB BC15090E B5DBC67B EBACD930 3E3EF93A 45CD4180 DB4DFF92',
    )
    expect(formatHashBlocks('')).toBe('')
  })

  it('verifica el SHA-256 exacto de PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx si está disponible en entorno local', () => {
    const samplePath =
      '/Users/angheloflores/.gemini/antigravity-cli/brain/c7b0359e-78f6-41f8-b96d-9fda2d432d6c/scratch/pj/calificacionPoderJudicial/PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx'
    if (fs.existsSync(samplePath)) {
      const fileBuffer = fs.readFileSync(samplePath)
      const digest = sha256HexFromBytes(new Uint8Array(fileBuffer))
      expect(digest).toBe('decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92')
    }
  })
})
