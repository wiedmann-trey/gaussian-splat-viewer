export type Vec3 = readonly [number, number, number]
export type Mat4 = Float32Array

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])
  return len > 0 ? scale(v, 1 / len) : [0, 0, 0]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
}

export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const m = new Float32Array(16)
  const f = 1 / Math.tan(fovY * 0.5)
  m[0]  = f / aspect
  m[5]  = f
  m[10] = far / (near - far)
  m[11] = -1
  m[14] = (near * far) / (near - far)
  return m
}

export function mat4LookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const fwd = normalize([center[0]-eye[0], center[1]-eye[1], center[2]-eye[2]])
  const r   = normalize(cross(fwd, up))
  const u   = cross(r, fwd)
  const m   = new Float32Array(16)
  m[0]  = r[0];   m[4]  = r[1];   m[8]  = r[2];   m[12] = -dot(r, eye)
  m[1]  = u[0];   m[5]  = u[1];   m[9]  = u[2];   m[13] = -dot(u, eye)
  m[2]  = -fwd[0]; m[6] = -fwd[1]; m[10] = -fwd[2]; m[14] = dot(fwd, eye)
  m[15] = 1
  return m
}
