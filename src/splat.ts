const SH_C0 = 0.28209479177387814

const SH_REST_PER_CHANNEL = 15  // degree 1–3
const SH_COEFFS_PER_SPLAT = 3 + SH_REST_PER_CHANNEL * 3

export type SHDegree = 0 | 1 | 2 | 3

export interface SplatCloud {
  count:     number
  positions: Float32Array
  colors:    Float32Array
  scales:    Float32Array
  rotations: Float32Array
  shCoeffs:  Float32Array | null
  shDegree:  SHDegree
  // Set when the PLY stores cov_0..cov_5 directly instead of scale+rotation.
  // When non-null, skip the GPU cov3d pass and upload directly.
  cov3d:     Float32Array | null
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

const PLY_TYPE_BYTES: Record<string, number> = {
  char: 1, uchar: 1, int8: 1, uint8: 1,
  short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4,
  double: 8, float64: 8,
}

interface PlyProp {
  name:       string
  byteOffset: number
  type:       string
}

export async function parsePly(buffer: ArrayBuffer): Promise<SplatCloud> {
  const bytes   = new Uint8Array(buffer)
  const decoder = new TextDecoder()

  let headerEnd = -1
  const marker  = 'end_header'
  for (let i = 0; i < bytes.length - marker.length; i++) {
    if (decoder.decode(bytes.slice(i, i + marker.length)) === marker) {
      headerEnd = i + marker.length
      if (bytes[headerEnd] === 13) headerEnd++ // CR
      if (bytes[headerEnd] === 10) headerEnd++ // LF
      break
    }
  }

  if (headerEnd === -1) throw new Error('Invalid PLY: missing end_header')

  const header = decoder.decode(bytes.slice(0, headerEnd))
  const lines  = header.split('\n').map(l => l.trim())

  let vertexCount = 0
  let inVertex    = false
  const props: PlyProp[] = []
  let rowBytes = 0

  for (const line of lines) {
    if (line.startsWith('element vertex')) {
      vertexCount = parseInt(line.split(' ')[2])
      inVertex    = true
    } else if (line.startsWith('element ') && !line.startsWith('element vertex')) {
      inVertex = false
    } else if (inVertex && line.startsWith('property ')) {
      const parts = line.split(' ')
      const type  = parts[1]
      const name  = parts[2]
      if (type === 'list') continue
      const size  = PLY_TYPE_BYTES[type] ?? 4
      props.push({ name, byteOffset: rowBytes, type })
      rowBytes += size
    }
  }

  if (vertexCount === 0) throw new Error('PLY has no vertices')
  if (props.length  === 0) throw new Error('PLY has no properties')

  console.log(`[PLY] ${vertexCount} vertices, ${rowBytes} bytes/row`)
  console.log(`[PLY] properties:`, props.map(p => `${p.name}(${p.type})`).join(', '))

  const dataView = new DataView(buffer, headerEnd)
  const byName   = new Map(props.map(p => [p.name, p]))

  const getF32 = (row: number, name: string): number => {
    const p = byName.get(name)
    if (!p) return 0
    return dataView.getFloat32(row * rowBytes + p.byteOffset, true)
  }

  const hasF32 = (name: string): boolean => {
    const p = byName.get(name)
    return p !== undefined && (p.type === 'float' || p.type === 'float32')
  }

  const positions = new Float32Array(vertexCount * 3)
  const colors    = new Float32Array(vertexCount * 4)
  const scales    = new Float32Array(vertexCount * 3)
  const rotations = new Float32Array(vertexCount * 4)

  const hasDC     = hasF32('f_dc_0')
  const hasOp     = hasF32('opacity')
  const hasSc     = hasF32('scale_0')
  const hasRot    = hasF32('rot_0')
  const hasCov    = hasF32('cov_0') || hasF32('cov3D_0') || hasF32('cov3d_0')
  const covPrefix = hasF32('cov_0') ? 'cov_' : hasF32('cov3D_0') ? 'cov3D_' : 'cov3d_'
  const cov3d     = hasCov ? new Float32Array(vertexCount * 6) : null

  if (!hasF32('x')) console.warn('[PLY] No float x/y/z properties found — positions will be zero')
  if (!hasSc && !hasCov) console.warn('[PLY] No scale or covariance properties — Gaussians will be tiny')

  const restCount = props.filter(p => p.name.startsWith('f_rest_') && (p.type === 'float' || p.type === 'float32')).length
  const restPerCh = Math.floor(restCount / 3)
  const shDegree: SHDegree =
    restPerCh >= 15 ? 3 :
    restPerCh >=  8 ? 2 :
    restPerCh >=  3 ? 1 : 0

  const shCoeffs = shDegree > 0 ? new Float32Array(vertexCount * SH_COEFFS_PER_SPLAT) : null

  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3 + 0] = getF32(i, 'x')
    positions[i * 3 + 1] = getF32(i, 'y')
    positions[i * 3 + 2] = getF32(i, 'z')

    if (hasDC) {
      const dc0 = getF32(i, 'f_dc_0'), dc1 = getF32(i, 'f_dc_1'), dc2 = getF32(i, 'f_dc_2')
      colors[i * 4 + 0] = clamp01(0.5 + SH_C0 * dc0)
      colors[i * 4 + 1] = clamp01(0.5 + SH_C0 * dc1)
      colors[i * 4 + 2] = clamp01(0.5 + SH_C0 * dc2)
      if (shCoeffs) {
        const b = i * SH_COEFFS_PER_SPLAT
        shCoeffs[b] = dc0; shCoeffs[b + 1] = dc1; shCoeffs[b + 2] = dc2
        for (let r = 0; r < restCount; r++) shCoeffs[b + 3 + r] = getF32(i, `f_rest_${r}`)
      }
    } else {
      const rp = byName.get('red'), gp = byName.get('green'), bp = byName.get('blue')
      if (rp && gp && bp) {
        colors[i * 4 + 0] = dataView.getUint8(i * rowBytes + rp.byteOffset) / 255
        colors[i * 4 + 1] = dataView.getUint8(i * rowBytes + gp.byteOffset) / 255
        colors[i * 4 + 2] = dataView.getUint8(i * rowBytes + bp.byteOffset) / 255
      }
    }

    colors[i * 4 + 3] = hasOp ? sigmoid(getF32(i, 'opacity')) : 1.0

    if (hasCov) {
      const b = i * 6
      cov3d![b]   = getF32(i, `${covPrefix}0`)
      cov3d![b+1] = getF32(i, `${covPrefix}1`)
      cov3d![b+2] = getF32(i, `${covPrefix}2`)
      cov3d![b+3] = getF32(i, `${covPrefix}3`)
      cov3d![b+4] = getF32(i, `${covPrefix}4`)
      cov3d![b+5] = getF32(i, `${covPrefix}5`)
      scales[i * 3 + 0] = scales[i * 3 + 1] = scales[i * 3 + 2] = 1.0
      rotations[i * 4 + 0] = 1.0
    } else if (hasSc) {
      scales[i * 3 + 0] = Math.exp(getF32(i, 'scale_0'))
      scales[i * 3 + 1] = Math.exp(getF32(i, 'scale_1'))
      scales[i * 3 + 2] = Math.exp(getF32(i, 'scale_2'))
    } else {
      scales[i * 3 + 0] = scales[i * 3 + 1] = scales[i * 3 + 2] = 0.01
    }

    if (!hasCov && hasRot) {
      let qw = getF32(i, 'rot_0'), qx = getF32(i, 'rot_1'), qy = getF32(i, 'rot_2'), qz = getF32(i, 'rot_3')
      const qLen = Math.sqrt(qw*qw + qx*qx + qy*qy + qz*qz)
      if (qLen > 0) { qw /= qLen; qx /= qLen; qy /= qLen; qz /= qLen }
      rotations[i * 4 + 0] = qw; rotations[i * 4 + 1] = qx
      rotations[i * 4 + 2] = qy; rotations[i * 4 + 3] = qz
    } else if (!hasCov) {
      rotations[i * 4 + 0] = 1.0  // identity - spherical Gaussian
    }
  }

  console.log(`[PLY] first splat pos: (${positions[0].toFixed(3)}, ${positions[1].toFixed(3)}, ${positions[2].toFixed(3)})`)
  if (hasCov) console.log(`[PLY] using pre-computed covariance format`)

  return { count: vertexCount, positions, colors, scales, rotations, shCoeffs, shDegree, cov3d }
}

// .splat binary format (antimatter15)
export function parseSplat(buffer: ArrayBuffer): SplatCloud {
  const BYTES_PER_SPLAT = 32
  const count     = Math.floor(buffer.byteLength / BYTES_PER_SPLAT)
  const view      = new DataView(buffer)
  const positions = new Float32Array(count * 3)
  const colors    = new Float32Array(count * 4)
  const scales    = new Float32Array(count * 3)
  const rotations = new Float32Array(count * 4)

  for (let i = 0; i < count; i++) {
    const base = i * BYTES_PER_SPLAT

    positions[i * 3 + 0] = view.getFloat32(base +  0, true)
    positions[i * 3 + 1] = view.getFloat32(base +  4, true)
    positions[i * 3 + 2] = view.getFloat32(base +  8, true)

    scales[i * 3 + 0] = view.getFloat32(base + 12, true)
    scales[i * 3 + 1] = view.getFloat32(base + 16, true)
    scales[i * 3 + 2] = view.getFloat32(base + 20, true)

    colors[i * 4 + 0] = view.getUint8(base + 24) / 255
    colors[i * 4 + 1] = view.getUint8(base + 25) / 255
    colors[i * 4 + 2] = view.getUint8(base + 26) / 255
    colors[i * 4 + 3] = view.getUint8(base + 27) / 255

    let qx = (view.getUint8(base + 28) - 128) / 128
    let qy = (view.getUint8(base + 29) - 128) / 128
    let qz = (view.getUint8(base + 30) - 128) / 128
    let qw = (view.getUint8(base + 31) - 128) / 128
    const qLen = Math.sqrt(qw*qw + qx*qx + qy*qy + qz*qz)
    if (qLen > 0) { qw /= qLen; qx /= qLen; qy /= qLen; qz /= qLen }
    rotations[i * 4 + 0] = qw
    rotations[i * 4 + 1] = qx
    rotations[i * 4 + 2] = qy
    rotations[i * 4 + 3] = qz
  }

  return { count, positions, colors, scales, rotations, shCoeffs: null, shDegree: 0, cov3d: null }
}
