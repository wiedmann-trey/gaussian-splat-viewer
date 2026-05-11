// 16-bit counting sort
// Run on web worker (separate from render loop)

let positions: Float32Array | null = null

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data

  if (type === 'init') {
    positions = e.data.positions as Float32Array

  } else if (type === 'sort') {
    if (!positions) return
    const { vx, vy, vz } = e.data as { vx: number; vy: number; vz: number }
    const indices = countingSort(positions, positions.length / 3, vx, vy, vz)
    self.postMessage({ type: 'sorted', indices }, [indices.buffer] as any)
  }
}

function countingSort(
  positions: Float32Array,
  n:         number,
  vx:        number,
  vy:        number,
  vz:        number,
): Uint32Array {
  const BUCKETS = 65536

  let maxDepth = -Infinity
  let minDepth =  Infinity

  for (let i = 0; i < n; i++) {
    const d = positions[i*3]*vx + positions[i*3+1]*vy + positions[i*3+2]*vz
    if (d > maxDepth) maxDepth = d
    if (d < minDepth) minDepth = d
  }

  const range  = maxDepth - minDepth || 1
  const scale  = (BUCKETS - 1) / range
  const counts = new Uint32Array(BUCKETS)
  const quant  = new Uint32Array(n)

  for (let i = 0; i < n; i++) {
    const q  = ((positions[i*3]*vx + positions[i*3+1]*vy + positions[i*3+2]*vz) - minDepth) * scale | 0
    quant[i] = q
    counts[q]++
  }

  const starts = new Uint32Array(BUCKETS)
  for (let i = 1; i < BUCKETS; i++) starts[i] = starts[i-1] + counts[i-1]

  const result = new Uint32Array(n)
  for (let i = 0; i < n; i++) result[starts[quant[i]]++] = i

  return result
}
