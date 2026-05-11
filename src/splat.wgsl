struct Uniforms {
  view:       mat4x4<f32>,
  proj:       mat4x4<f32>,
  screen:     vec2<f32>,
  sh_degree:  u32,
  num_splats: u32,
  camera_pos: vec3<f32>,
  _pad1:      u32,
}

@group(0) @binding(0) var<uniform>       uniforms:       Uniforms;
@group(0) @binding(1) var<storage, read> positions:      array<f32>;
@group(0) @binding(2) var<storage, read> colors:         array<f32>;
@group(0) @binding(3) var<storage, read> sh_coeffs:      array<f32>;
@group(0) @binding(4) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(5) var<storage, read> cov3d:          array<f32>;

const SH_C0: f32 =  0.28209479177387814;
const SH_C1: f32 =  0.4886025119029199;
const SH_C2_0: f32 =  1.0925484305920792;
const SH_C2_1: f32 = -1.0925484305920792;
const SH_C2_2: f32 =  0.31539156525252005;
const SH_C2_3: f32 = -1.0925484305920792;
const SH_C2_4: f32 =  0.5462742152960396;
const SH_C3_0: f32 = -0.5900435899266435;
const SH_C3_1: f32 =  2.890611442640554;
const SH_C3_2: f32 = -0.4570457994644658;
const SH_C3_3: f32 =  0.3731763325901154;
const SH_C3_4: f32 = -0.4570457994644658;
const SH_C3_5: f32 =  1.445305721320277;
const SH_C3_6: f32 = -0.5900435899266435;

fn sh3(offset: u32) -> vec3<f32> {
  return vec3<f32>(sh_coeffs[offset], sh_coeffs[offset+1u], sh_coeffs[offset+2u]);
}

fn evalSH(splatIdx: u32, dir: vec3<f32>, degree: u32) -> vec3<f32> {
  let base = splatIdx * 48u;
  var color = vec3<f32>(SH_C0*sh_coeffs[base], SH_C0*sh_coeffs[base+1u], SH_C0*sh_coeffs[base+2u]) + 0.5;
  let x = dir.x; let y = dir.y; let z = dir.z;
  color += SH_C1 * (-y*sh3(base) + z*sh3(base+3u) - x*sh3(base+6u));
  if degree == 1u { return color; }
  let xx=x*x; let yy=y*y; let zz=z*z; let xy=x*y; let xz=x*z; let yz=y*z;
  color += SH_C2_0*xy*sh3(base+9u) + SH_C2_1*yz*sh3(base+12u) +
           SH_C2_2*(2.*zz-xx-yy)*sh3(base+15u) + SH_C2_3*xz*sh3(base+18u) +
           SH_C2_4*(xx-yy)*sh3(base+21u);
  if degree == 2u { return color; }
  color += SH_C3_0*y*(3.*xx-yy)*sh3(base+24u) + SH_C3_1*xy*z*sh3(base+27u) +
           SH_C3_2*y*(4.*zz-xx-yy)*sh3(base+30u) +
           SH_C3_3*z*(2.*zz-3.*xx-3.*yy)*sh3(base+33u) +
           SH_C3_4*x*(4.*zz-xx-yy)*sh3(base+36u) +
           SH_C3_5*z*(xx-yy)*sh3(base+39u) + SH_C3_6*x*(xx-3.*yy)*sh3(base+42u);
  return color;
}

fn quad_uv(vertex_index: u32) -> vec2<f32> {
  let idx = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0),
    vec2(-1.0, -1.0), vec2( 1.0,  1.0), vec2(-1.0,  1.0),
  );
  return idx[vertex_index];
}

const SIGMA_SCALE:   f32 = 3.0;
const CULL_PX:       f32 = 1.0;
const MAX_RADIUS_PX: f32 = 512.0;

struct VertOut {
  @builtin(position) pos:   vec4<f32>,
  @location(0)       uv:    vec2<f32>,
  @location(1)       color: vec4<f32>,
}

@vertex
fn vs_main(
  @builtin(instance_index) instance: u32,
  @builtin(vertex_index)   vertex:   u32,
) -> VertOut {
  var out: VertOut;

  let splat_idx = sorted_indices[instance];
  let ci        = splat_idx * 3u;
  let ci4       = splat_idx * 4u;
  let ci6       = splat_idx * 6u;

  let pos_world = vec4<f32>(positions[ci], positions[ci+1u], positions[ci+2u], 1.0);
  let pos_view  = uniforms.view * pos_world;
  let pos_clip  = uniforms.proj * pos_view;

  // Reconstruct 3D covariance
  let c0 = cov3d[ci6]; let c1 = cov3d[ci6+1u]; let c2 = cov3d[ci6+2u];
  let c3 = cov3d[ci6+3u]; let c4 = cov3d[ci6+4u]; let c5 = cov3d[ci6+5u];
  let cov3_mat = mat3x3<f32>(
    vec3<f32>(c0, c1, c2),
    vec3<f32>(c1, c3, c4),
    vec3<f32>(c2, c4, c5),
  );

  // Project covariance to screen
  let W  = mat3x3<f32>(uniforms.view[0].xyz, uniforms.view[1].xyz, uniforms.view[2].xyz);
  let t  = pos_view.xyz;
  let fx = uniforms.proj[0][0] * uniforms.screen.x * 0.5;
  let fy = uniforms.proj[1][1] * uniforms.screen.y * 0.5;
  let J  = mat3x2<f32>(
    vec2<f32>( fx / t.z,                0.0              ),
    vec2<f32>( 0.0,                     fy / t.z         ),
    vec2<f32>(-fx * t.x / (t.z * t.z), -fy * t.y / (t.z * t.z)),
  );
  let cov2 = J * W * cov3_mat * transpose(J * W);

  // Eigendecompose
  let a = cov2[0][0]; let b = cov2[0][1]; let c = cov2[1][1];
  let mid  = 0.5 * (a + c);
  let disc = sqrt(max(0.0, mid*mid - (a*c - b*b)));
  let l1   = mid + disc;
  let l2   = mid - disc;
  let r1   = sqrt(max(0.0, l1)) * SIGMA_SCALE;
  let r2   = sqrt(max(0.0, l2)) * SIGMA_SCALE;

  if r1 < CULL_PX {
    out.pos = vec4<f32>(0.0); out.uv = vec2<f32>(0.0); out.color = vec4<f32>(0.0);
    return out;
  }

  var v1: vec2<f32>;
  if abs(b) > 1e-6 { v1 = normalize(vec2<f32>(b, l1 - a)); }
  else { v1 = select(vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), a >= c); }
  let v2 = vec2<f32>(-v1.y, v1.x);

  let r1c = min(r1, MAX_RADIUS_PX);
  let r2c = min(r2, MAX_RADIUS_PX);

  let uv         = quad_uv(vertex % 6u);
  let offset     = v1 * (uv.x * r1c) + v2 * (uv.y * r2c);
  let ndc_offset = offset / uniforms.screen * 2.0;
  out.pos        = vec4<f32>(pos_clip.xy / pos_clip.w + ndc_offset, pos_clip.z / pos_clip.w, 1.0);
  out.uv         = uv * SIGMA_SCALE;

  // Color
  var rgb: vec3<f32>;
  if uniforms.sh_degree > 0u {
    let dir_raw = normalize(pos_world.xyz - uniforms.camera_pos);
    let dir     = vec3<f32>(dir_raw.x, -dir_raw.y, dir_raw.z);
    rgb = clamp(evalSH(splat_idx, dir, uniforms.sh_degree), vec3<f32>(0.0), vec3<f32>(1.0));
  } else {
    rgb = vec3<f32>(colors[ci4], colors[ci4+1u], colors[ci4+2u]);
  }
  out.color = vec4<f32>(rgb, colors[ci4+3u]);

  return out;
}

@fragment
fn fs_main(in: VertOut) -> @location(0) vec4<f32> {
  let alpha = in.color.a * exp(-0.5 * dot(in.uv, in.uv));
  if alpha < 0.004 { discard; }
  return vec4<f32>(in.color.rgb * alpha, alpha);
}
