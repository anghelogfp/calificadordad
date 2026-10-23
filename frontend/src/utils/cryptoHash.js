const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n))
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  if (typeof input === 'string') {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(input)
    }
    const utf8 = unescape(encodeURIComponent(input))
    const bytes = new Uint8Array(utf8.length)
    for (let i = 0; i < utf8.length; i += 1) {
      bytes[i] = utf8.charCodeAt(i)
    }
    return bytes
  }
  if (Array.isArray(input)) {
    return new Uint8Array(input)
  }
  return new Uint8Array(0)
}

/**
 * Pure JS SHA-256 implementation over a byte array.
 * Works synchronously in Browser, Node, and jsdom/Vitest.
 * @param {Uint8Array|ArrayBuffer} bytesInput
 * @returns {string} 64-character lowercase hex digest
 */
export function sha256HexFromBytes(bytesInput) {
  const bytes = toUint8Array(bytesInput)
  const bitLenHi = Math.floor(bytes.length / 0x20000000)
  const bitLenLo = (bytes.length << 3) >>> 0

  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6)
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, bitLenHi, false)
  view.setUint32(paddedLength - 4, bitLenLo, false)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const w = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('')
}

/**
 * Synchronous SHA-256 hex digest from a string, Uint8Array, or ArrayBuffer.
 * @param {string|Uint8Array|ArrayBuffer} input
 * @returns {string} 64-character lowercase hex digest
 */
export function sha256Hex(input) {
  return sha256HexFromBytes(toUint8Array(input))
}

/**
 * SHA-256 de los bytes originales de un archivo (el mismo valor que daría `sha256sum`).
 * Devuelve '' si no se pueden leer los bytes: nunca el hash de un contenido vacío,
 * que parecería un hash válido pero sería falso.
 * @param {File|Blob|ArrayBuffer|Uint8Array|string} fileOrBuffer
 * @returns {Promise<string>} 64-character lowercase hex digest, o '' si no se pudo leer
 */
export async function computeFileSha256(fileOrBuffer) {
  if (fileOrBuffer === undefined || fileOrBuffer === null) return ''

  if (
    typeof fileOrBuffer === 'string'
    || fileOrBuffer instanceof Uint8Array
    || fileOrBuffer instanceof ArrayBuffer
    || ArrayBuffer.isView(fileOrBuffer)
  ) {
    return sha256HexFromBytes(toUint8Array(fileOrBuffer))
  }

  if (typeof fileOrBuffer.arrayBuffer === 'function') {
    try {
      return sha256HexFromBytes(new Uint8Array(await fileOrBuffer.arrayBuffer()))
    } catch {
      return ''
    }
  }

  return ''
}

/**
 * Formats a hex hash into uppercase blocks separated by spaces.
 * Example: "decf800172efcfdb..." -> "DECF8001 72EFCFDB ..."
 * @param {string} hashHex
 * @param {number} [blockSize=8]
 * @returns {string}
 */
export function formatHashBlocks(hashHex, blockSize = 8) {
  const clean = String(hashHex || '').trim().toUpperCase()
  if (!clean) return ''
  const size = Math.max(1, Number(blockSize) || 8)
  const blocks = []
  for (let i = 0; i < clean.length; i += size) {
    blocks.push(clean.slice(i, i + size))
  }
  return blocks.join(' ')
}
