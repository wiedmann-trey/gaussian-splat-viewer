// Precompute 3D covariances for each Gaussian splat on scene load

@group(0) @binding(0) var<storage, read>       scales:    array<f32>;
@group(0) @binding(1) var<storage, read>       rotations: array<f32>;
@group(0) @binding(2) var<storage, read_write> cov3d:     array<f32>;

fn quat_to_mat3(q: vec4<f32>) -> mat3x3<f32> {
  let w = q.x; let x = q.y; let y = q.z; let z = q.w;
  return mat3x3<f32>(
    vec3<f32>(1.0 - 2.0*(y*y + z*z),       2.0*(x*y + w*z),       2.0*(x*z - w*y)),
    vec3<f32>(      2.0*(x*y - w*z), 1.0 - 2.0*(x*x + z*z),       2.0*(y*z + w*x)),
    vec3<f32>(      2.0*(x*z + w*y),       2.0*(y*z - w*x), 1.0 - 2.0*(x*x + y*y)),
  );
}

@compute @workgroup_size(256)
fn compute_cov3d(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = arrayLength(&scales) / 3u;
  if i >= n { return; }

  let ci = i * 3u;
  let qi = i * 4u;

  let R   = quat_to_mat3(vec4<f32>(rotations[qi], rotations[qi+1u], rotations[qi+2u], rotations[qi+3u]));
  let sx  = scales[ci]; let sy = scales[ci+1u]; let sz = scales[ci+2u];
  let M   = mat3x3<f32>(R[0]*sx, R[1]*sy, R[2]*sz);
  let S   = M * transpose(M);

  // Store symmetric upper triangle in column-major order
  let base      = i * 6u;
  cov3d[base + 0u] = S[0][0];
  cov3d[base + 1u] = S[1][0];
  cov3d[base + 2u] = S[2][0];
  cov3d[base + 3u] = S[1][1];
  cov3d[base + 4u] = S[2][1];
  cov3d[base + 5u] = S[2][2];
}
