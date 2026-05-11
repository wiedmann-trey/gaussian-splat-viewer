import { Vec3, Mat4, add, scale, normalize, cross, dot, mat4LookAt, mat4Perspective } from './math'

const TWO_PI = Math.PI * 2
const FOV_Y  = Math.PI / 4
const NEAR   = 0.1
const FAR    = 1000.0

export class OrbitCamera {
  private theta  = 0.5
  private phi    = 0.4
  private radius = 5.0
  private target: Vec3 = [0, 0, 0]

  private dragging = false
  private panning  = false
  private lastX    = 0
  private lastY    = 0

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown',  this.onMouseDown)
    canvas.addEventListener('mousemove',  this.onMouseMove)
    canvas.addEventListener('mouseup',    this.onMouseUp)
    canvas.addEventListener('mouseleave', this.onMouseUp)
    canvas.addEventListener('wheel',      this.onWheel, { passive: true })
    canvas.addEventListener('contextmenu', e => e.preventDefault())
  }

  getEye(): Vec3 {
    const sinPhi = Math.sin(this.phi), cosPhi = Math.cos(this.phi)
    const sinTh  = Math.sin(this.theta), cosTh = Math.cos(this.theta)
    return add(this.target, scale([sinPhi * cosTh, cosPhi, sinPhi * sinTh], this.radius))
  }

  getViewMatrix(): Mat4 {
    return mat4LookAt(this.getEye(), this.target, [0, -1, 0])
  }

  getProjectionMatrix(width: number, height: number): Mat4 {
    return mat4Perspective(FOV_Y, width / height, NEAR, FAR)
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.dragging = true
    if (e.button === 2) this.panning  = true
    this.lastX = e.clientX
    this.lastY = e.clientY
  }

  private onMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY

    if (this.dragging) {
      this.theta = ((this.theta - dx * 0.006) % TWO_PI + TWO_PI) % TWO_PI
      this.phi   = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi + dy * 0.006))
    }

    if (this.panning) {
      const eye   = this.getEye()
      const fwd   = normalize([this.target[0]-eye[0], this.target[1]-eye[1], this.target[2]-eye[2]])
      const right = normalize(cross(fwd, [0, 1, 0]))
      const up    = cross(right, fwd)
      const s     = this.radius * 0.001
      this.target = add(add(this.target, scale(right, -dx * s)), scale(up, dy * s))
    }
  }

  private onMouseUp = () => { this.dragging = false; this.panning = false }

  private onWheel = (e: WheelEvent) => {
    this.radius = Math.max(0.5, Math.min(FAR * 0.5, this.radius * (1 + e.deltaY * 0.001)))
  }

  dispose() {
    this.canvas.removeEventListener('mousedown',  this.onMouseDown)
    this.canvas.removeEventListener('mousemove',  this.onMouseMove)
    this.canvas.removeEventListener('mouseup',    this.onMouseUp)
    this.canvas.removeEventListener('mouseleave', this.onMouseUp)
    this.canvas.removeEventListener('wheel',      this.onWheel)
  }
}
