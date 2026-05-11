import { OrbitCamera }     from './camera'
import { GaussianRenderer } from './renderer'
import { parsePly, parseSplat } from './splat'
import {
  showLoading, hideLoading, showError, showNoWebGPU,
  setupFileInput, setSceneName, setSceneCredit, updateStats,
} from './ui'

const DEFAULT_SCENE_URL    = 'https://github.com/wiedmann-trey/gaussian-splat-viewer/releases/download/1.0/clockstatue.ply'
const DEFAULT_SCENE_NAME   = 'clockstatue.ply'
const DEFAULT_SCENE_CREDIT = '@naturalai via superspl.at'

const SORT_THRESHOLD = 0.9998

async function main(): Promise<void> {
  if (!navigator.gpu) { showNoWebGPU(); return }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) { showNoWebGPU(); return }

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize:               adapter.limits.maxBufferSize,
    },
  })

  const canvas  = document.getElementById('canvas') as HTMLCanvasElement
  const context = canvas.getContext('webgpu')!
  const format  = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'opaque' })

  const camera   = new OrbitCamera(canvas)
  const renderer = await GaussianRenderer.create(device, format)

  const sortWorker = new Worker(new URL('./sort.worker.ts', import.meta.url), { type: 'module' })
  let sortInFlight = false
  let lastSortDir  = new Float32Array(3)

  sortWorker.onmessage = (e: MessageEvent) => {
    sortInFlight = false
    renderer.uploadSortedIndices(e.data.indices as Uint32Array)
  }

  function requestSort(vx: number, vy: number, vz: number): void {
    if (sortInFlight) return
    if (lastSortDir[0]*vx + lastSortDir[1]*vy + lastSortDir[2]*vz > SORT_THRESHOLD) return
    sortInFlight = true
    lastSortDir[0] = vx; lastSortDir[1] = vy; lastSortDir[2] = vz
    sortWorker.postMessage({ type: 'sort', vx, vy, vz })
  }

  let width = 0, height = 0
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const dpr = window.devicePixelRatio ?? 1
      width  = Math.round(entry.contentRect.width  * dpr)
      height = Math.round(entry.contentRect.height * dpr)
      canvas.width  = width
      canvas.height = height
      renderer.resize(width, height)
    }
  })
  resizeObserver.observe(canvas)

  async function loadFromBuffer(buffer: ArrayBuffer, name: string, credit = ''): Promise<void> {
    try {
      const cloud = name.endsWith('.splat') ? parseSplat(buffer) : await parsePly(buffer)
      renderer.loadSplats(cloud)
      setSceneName(name)
      setSceneCredit(credit)
      updateStats(0, renderer['splatCount'] as number)
      const positionsCopy = cloud.positions.slice(0, (renderer['splatCount'] as number) * 3)
      sortWorker.postMessage({ type: 'init', positions: positionsCopy }, [positionsCopy.buffer])
      lastSortDir.fill(0)
      sortInFlight = false
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Parse error')
    } finally {
      hideLoading()
    }
  }

  async function loadFromUrl(url: string, name: string, credit = ''): Promise<void> {
    showLoading()
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadFromBuffer(await res.arrayBuffer(), name, credit)
    } catch (err) {
      hideLoading()
      showError(err instanceof Error ? err.message : 'Network error')
    }
  }

  setupFileInput(async (buffer, name) => loadFromBuffer(buffer, name))
  await loadFromUrl(DEFAULT_SCENE_URL, DEFAULT_SCENE_NAME, DEFAULT_SCENE_CREDIT)

  let lastTime = performance.now(), frameCount = 0

  function frame(): void {
    const now = performance.now(), delta = now - lastTime
    frameCount++
    if (delta >= 500) {
      updateStats((frameCount / delta) * 1000, renderer['splatCount'] as number)
      frameCount = 0
      lastTime   = now
    }
    if (width > 0 && height > 0) {
      const view = camera.getViewMatrix()
      requestSort(view[2], view[6], view[10])
      renderer.render(context.getCurrentTexture().createView(), view, camera.getProjectionMatrix(width, height), camera.getEye(), width, height)
    }
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

main().catch(err => { console.error(err); showError('Initialization failed') })
