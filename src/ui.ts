let errorTimer: ReturnType<typeof setTimeout> | null = null

export function showLoading(): void {
  document.getElementById('loading-overlay')!.classList.add('visible')
}

export function hideLoading(): void {
  document.getElementById('loading-overlay')!.classList.remove('visible')
}

export function showError(msg: string): void {
  const toast = document.getElementById('error-toast')!
  toast.textContent = msg
  toast.classList.add('visible')
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => toast.classList.remove('visible'), 3500)
}

export function showNoWebGPU(): void {
  document.getElementById('no-webgpu')!.classList.add('visible')
  document.getElementById('ui')!.style.display = 'none'
}

export function setSceneName(name: string): void {
  document.getElementById('scene-label')!.textContent = name
}

export function setSceneCredit(credit: string): void {
  const el = document.getElementById('scene-credit')!
  el.textContent = credit ? `by ${credit}` : ''
}

export function updateStats(fps: number, total: number): void {
  document.getElementById('stat-fps')!.textContent    = fps.toFixed(0)
  document.getElementById('stat-splats')!.textContent = formatCount(total)
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function setupFileInput(onFile: (buffer: ArrayBuffer, name: string) => void): void {
  const btn   = document.getElementById('load-btn')!
  const input = document.getElementById('file-input') as HTMLInputElement

  btn.addEventListener('click', () => input.click())
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    input.value = ''
    showLoading()
    try {
      onFile(await file.arrayBuffer(), file.name)
    } catch {
      hideLoading()
      showError('Failed to read file')
    }
  })
}
