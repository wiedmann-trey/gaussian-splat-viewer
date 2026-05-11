(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function r(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(n){if(n.ep)return;n.ep=!0;const a=r(n);fetch(n.href,a)}})();function H(s,e){return[s[0]+e[0],s[1]+e[1],s[2]+e[2]]}function F(s,e){return[s[0]*e,s[1]*e,s[2]*e]}function T(s,e){return[s[1]*e[2]-s[2]*e[1],s[2]*e[0]-s[0]*e[2],s[0]*e[1]-s[1]*e[0]]}function q(s){const e=Math.sqrt(s[0]*s[0]+s[1]*s[1]+s[2]*s[2]);return e>0?F(s,1/e):[0,0,0]}function G(s,e){return s[0]*e[0]+s[1]*e[1]+s[2]*e[2]}function Q(s,e,r,o){const n=new Float32Array(16),a=1/Math.tan(s*.5);return n[0]=a/e,n[5]=a,n[10]=o/(r-o),n[11]=-1,n[14]=r*o/(r-o),n}function ee(s,e,r){const o=q([e[0]-s[0],e[1]-s[1],e[2]-s[2]]),n=q(T(o,r)),a=T(n,o),i=new Float32Array(16);return i[0]=n[0],i[4]=n[1],i[8]=n[2],i[12]=-G(n,s),i[1]=a[0],i[5]=a[1],i[9]=a[2],i[13]=-G(a,s),i[2]=-o[0],i[6]=-o[1],i[10]=-o[2],i[14]=G(o,s),i[15]=1,i}const R=Math.PI*2,te=Math.PI/4,ne=.1,j=1e3;class se{constructor(e){this.canvas=e,e.addEventListener("mousedown",this.onMouseDown),e.addEventListener("mousemove",this.onMouseMove),e.addEventListener("mouseup",this.onMouseUp),e.addEventListener("mouseleave",this.onMouseUp),e.addEventListener("wheel",this.onWheel,{passive:!0}),e.addEventListener("contextmenu",r=>r.preventDefault())}theta=1.7;phi=2.3;radius=50;target=[0,0,0];dragging=!1;panning=!1;lastX=0;lastY=0;getEye(){const e=Math.sin(this.phi),r=Math.cos(this.phi),o=Math.sin(this.theta),n=Math.cos(this.theta);return H(this.target,F([e*n,r,e*o],this.radius))}getViewMatrix(){return ee(this.getEye(),this.target,[0,-1,0])}getProjectionMatrix(e,r){return Q(te,e/r,ne,j)}onMouseDown=e=>{e.button===0&&(this.dragging=!0),e.button===2&&(this.panning=!0),this.lastX=e.clientX,this.lastY=e.clientY};onMouseMove=e=>{const r=e.clientX-this.lastX,o=e.clientY-this.lastY;if(this.lastX=e.clientX,this.lastY=e.clientY,this.dragging&&(this.theta=((this.theta-r*.006)%R+R)%R,this.phi=Math.max(.05,Math.min(Math.PI-.05,this.phi+o*.006))),this.panning){const n=this.getEye(),a=q([this.target[0]-n[0],this.target[1]-n[1],this.target[2]-n[2]]),i=q(T(a,[0,1,0])),l=T(i,a),c=this.radius*.001;this.target=H(H(this.target,F(i,-r*c)),F(l,o*c))}};onMouseUp=()=>{this.dragging=!1,this.panning=!1};onWheel=e=>{this.radius=Math.max(.5,Math.min(j*.5,this.radius*(1+e.deltaY*.001)))};dispose(){this.canvas.removeEventListener("mousedown",this.onMouseDown),this.canvas.removeEventListener("mousemove",this.onMouseMove),this.canvas.removeEventListener("mouseup",this.onMouseUp),this.canvas.removeEventListener("mouseleave",this.onMouseUp),this.canvas.removeEventListener("wheel",this.onWheel)}}const oe=`struct Uniforms {
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
`,re=`// Precompute 3D covariances for each Gaussian splat on scene load

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
`,ie={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},ae=256;class ${constructor(e,r,o,n){this.device=e,this.format=r,this.renderPipeline=o,this.cov3dPipeline=n,this.uniformBuf=e.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}positionsBuf=null;colorsBuf=null;shBuf=null;cov3dBuf=null;sortedIndicesBuf=null;uniformBuf;renderPipeline;cov3dPipeline;renderBindGroup=null;depthTexture=null;splatCount=0;shDegree=0;uniformDataCache=new Float32Array(40);static async create(e,r){const o=e.createShaderModule({code:oe}),n=e.createShaderModule({code:re}),[a,i]=await Promise.all([e.createRenderPipelineAsync({layout:"auto",vertex:{module:o,entryPoint:"vs_main"},fragment:{module:o,entryPoint:"fs_main",targets:[{format:r,blend:ie}]},primitive:{topology:"triangle-list"},depthStencil:{format:"depth24plus",depthWriteEnabled:!1,depthCompare:"always"}}),e.createComputePipelineAsync({layout:"auto",compute:{module:n,entryPoint:"compute_cov3d"}})]);return new $(e,r,a,i)}loadSplats(e){const r=Math.min(this.device.limits.maxBufferSize,this.device.limits.maxStorageBufferBindingSize),o=Math.floor(r/24),n=Math.min(e.count,o);n<e.count&&console.warn(`Scene truncated from ${e.count} to ${n} splats (buffer size limit)`),this.splatCount=n,this.shDegree=e.shDegree,this.positionsBuf?.destroy(),this.colorsBuf?.destroy(),this.shBuf?.destroy(),this.cov3dBuf?.destroy(),this.sortedIndicesBuf?.destroy();const a=n<e.count?e.positions.slice(0,n*3):e.positions,i=n<e.count?e.colors.slice(0,n*4):e.colors,l=n<e.count?e.scales.slice(0,n*3):e.scales,c=n<e.count?e.rotations.slice(0,n*4):e.rotations;this.positionsBuf=this.uploadF32(a,GPUBufferUsage.STORAGE),this.colorsBuf=this.uploadF32(i,GPUBufferUsage.STORAGE);const f=e.shCoeffs!==null?e.shCoeffs.byteLength:0;if(e.shCoeffs!==null&&f<=r){const d=n<e.count?e.shCoeffs.slice(0,n*48):e.shCoeffs;this.shBuf=this.uploadF32(d,GPUBufferUsage.STORAGE)}else e.shCoeffs!==null&&console.warn("SH dropped — buffer would exceed device limit"),this.shDegree=0,this.shBuf=this.device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE});this.cov3dBuf=this.device.createBuffer({size:n*6*4,usage:GPUBufferUsage.STORAGE}),this.sortedIndicesBuf=this.device.createBuffer({size:n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});const _=new Uint32Array(n);for(let d=0;d<n;d++)_[d]=d;if(this.device.queue.writeBuffer(this.sortedIndicesBuf,0,_),e.cov3d!==null){const d=n<e.count?e.cov3d.slice(0,n*6):e.cov3d;this.device.queue.writeBuffer(this.cov3dBuf,0,d)}else{const d=this.device.createBindGroup({layout:this.cov3dPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uploadF32(l,GPUBufferUsage.STORAGE)}},{binding:1,resource:{buffer:this.uploadF32(c,GPUBufferUsage.STORAGE)}},{binding:2,resource:{buffer:this.cov3dBuf}}]}),p=this.device.createCommandEncoder(),u=p.beginComputePass();u.setPipeline(this.cov3dPipeline),u.setBindGroup(0,d),u.dispatchWorkgroups(Math.ceil(n/ae)),u.end(),this.device.queue.submit([p.finish()])}this.renderBindGroup=this.device.createBindGroup({layout:this.renderPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuf}},{binding:1,resource:{buffer:this.positionsBuf}},{binding:2,resource:{buffer:this.colorsBuf}},{binding:3,resource:{buffer:this.shBuf}},{binding:4,resource:{buffer:this.sortedIndicesBuf}},{binding:5,resource:{buffer:this.cov3dBuf}}]})}uploadF32(e,r){const o=this.device.createBuffer({size:e.byteLength,usage:GPUBufferUsage.COPY_DST|r});return this.device.queue.writeBuffer(o,0,e),o}uploadSortedIndices(e){this.sortedIndicesBuf&&this.device.queue.writeBuffer(this.sortedIndicesBuf,0,e)}resize(e,r){this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[e,r],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT})}render(e,r,o,n,a,i){if(this.splatCount===0||!this.depthTexture)return;this.updateUniforms(r,o,n,a,i);const l=this.device.createCommandEncoder(),c=l.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.03,g:.03,b:.03,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:this.depthTexture.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"discard",depthReadOnly:!1}});this.renderBindGroup&&(c.setPipeline(this.renderPipeline),c.setBindGroup(0,this.renderBindGroup),c.draw(6,this.splatCount)),c.end(),this.device.queue.submit([l.finish()])}updateUniforms(e,r,o,n,a){const i=this.uniformDataCache,l=new DataView(i.buffer);i.set(e,0),i.set(r,16),i[32]=n,i[33]=a,l.setUint32(34*4,this.shDegree,!0),l.setUint32(35*4,this.splatCount,!0),i[36]=o[0],i[37]=o[1],i[38]=o[2],this.device.queue.writeBuffer(this.uniformBuf,0,i)}dispose(){this.positionsBuf?.destroy(),this.colorsBuf?.destroy(),this.shBuf?.destroy(),this.cov3dBuf?.destroy(),this.sortedIndicesBuf?.destroy(),this.uniformBuf.destroy(),this.depthTexture?.destroy()}}const D=.28209479177387814,ce=15,k=3+ce*3;function ue(s){return 1/(1+Math.exp(-s))}function Y(s){return s<0?0:s>1?1:s}const le={char:1,uchar:1,int8:1,uint8:1,short:2,ushort:2,int16:2,uint16:2,int:4,uint:4,int32:4,uint32:4,float:4,float32:4,double:8,float64:8};async function fe(s){const e=new Uint8Array(s),r=new TextDecoder;let o=-1;const n="end_header";for(let t=0;t<e.length-n.length;t++)if(r.decode(e.slice(t,t+n.length))===n){o=t+n.length,e[o]===13&&o++,e[o]===10&&o++;break}if(o===-1)throw new Error("Invalid PLY: missing end_header");const i=r.decode(e.slice(0,o)).split(`
`).map(t=>t.trim());let l=0,c=!1;const f=[];let _=0;for(const t of i)if(t.startsWith("element vertex"))l=parseInt(t.split(" ")[2]),c=!0;else if(t.startsWith("element ")&&!t.startsWith("element vertex"))c=!1;else if(c&&t.startsWith("property ")){const h=t.split(" "),x=h[1],b=h[2];if(x==="list")continue;const C=le[x]??4;f.push({name:b,byteOffset:_,type:x}),_+=C}if(l===0)throw new Error("PLY has no vertices");if(f.length===0)throw new Error("PLY has no properties");console.log(`[PLY] ${l} vertices, ${_} bytes/row`),console.log("[PLY] properties:",f.map(t=>`${t.name}(${t.type})`).join(", "));const d=new DataView(s,o),p=new Map(f.map(t=>[t.name,t])),u=(t,h)=>{const x=p.get(h);return x?d.getFloat32(t*_+x.byteOffset,!0):0},v=t=>{const h=p.get(t);return h!==void 0&&(h.type==="float"||h.type==="float32")},z=new Float32Array(l*3),B=new Float32Array(l*4),w=new Float32Array(l*3),E=new Float32Array(l*4),g=v("f_dc_0"),m=v("opacity"),y=v("scale_0"),S=v("rot_0"),L=v("cov_0")||v("cov3D_0")||v("cov3d_0"),A=v("cov_0")?"cov_":v("cov3D_0")?"cov3D_":"cov3d_",M=L?new Float32Array(l*6):null;v("x")||console.warn("[PLY] No float x/y/z properties found — positions will be zero"),!y&&!L&&console.warn("[PLY] No scale or covariance properties — Gaussians will be tiny");const V=f.filter(t=>t.name.startsWith("f_rest_")&&(t.type==="float"||t.type==="float32")).length,O=Math.floor(V/3),X=O>=15?3:O>=8?2:O>=3?1:0,U=X>0?new Float32Array(l*k):null;for(let t=0;t<l;t++){if(z[t*3+0]=u(t,"x"),z[t*3+1]=u(t,"y"),z[t*3+2]=u(t,"z"),g){const h=u(t,"f_dc_0"),x=u(t,"f_dc_1"),b=u(t,"f_dc_2");if(B[t*4+0]=Y(.5+D*h),B[t*4+1]=Y(.5+D*x),B[t*4+2]=Y(.5+D*b),U){const C=t*k;U[C]=h,U[C+1]=x,U[C+2]=b;for(let P=0;P<V;P++)U[C+3+P]=u(t,`f_rest_${P}`)}}else{const h=p.get("red"),x=p.get("green"),b=p.get("blue");h&&x&&b&&(B[t*4+0]=d.getUint8(t*_+h.byteOffset)/255,B[t*4+1]=d.getUint8(t*_+x.byteOffset)/255,B[t*4+2]=d.getUint8(t*_+b.byteOffset)/255)}if(B[t*4+3]=m?ue(u(t,"opacity")):1,L){const h=t*6;M[h]=u(t,`${A}0`),M[h+1]=u(t,`${A}1`),M[h+2]=u(t,`${A}2`),M[h+3]=u(t,`${A}3`),M[h+4]=u(t,`${A}4`),M[h+5]=u(t,`${A}5`),w[t*3+0]=w[t*3+1]=w[t*3+2]=1,E[t*4+0]=1}else y?(w[t*3+0]=Math.exp(u(t,"scale_0")),w[t*3+1]=Math.exp(u(t,"scale_1")),w[t*3+2]=Math.exp(u(t,"scale_2"))):w[t*3+0]=w[t*3+1]=w[t*3+2]=.01;if(!L&&S){let h=u(t,"rot_0"),x=u(t,"rot_1"),b=u(t,"rot_2"),C=u(t,"rot_3");const P=Math.sqrt(h*h+x*x+b*b+C*C);P>0&&(h/=P,x/=P,b/=P,C/=P),E[t*4+0]=h,E[t*4+1]=x,E[t*4+2]=b,E[t*4+3]=C}else L||(E[t*4+0]=1)}return console.log(`[PLY] first splat pos: (${z[0].toFixed(3)}, ${z[1].toFixed(3)}, ${z[2].toFixed(3)})`),L&&console.log("[PLY] using pre-computed covariance format"),{count:l,positions:z,colors:B,scales:w,rotations:E,shCoeffs:U,shDegree:X,cov3d:M}}function de(s){const r=Math.floor(s.byteLength/32),o=new DataView(s),n=new Float32Array(r*3),a=new Float32Array(r*4),i=new Float32Array(r*3),l=new Float32Array(r*4);for(let c=0;c<r;c++){const f=c*32;n[c*3+0]=o.getFloat32(f+0,!0),n[c*3+1]=o.getFloat32(f+4,!0),n[c*3+2]=o.getFloat32(f+8,!0),i[c*3+0]=o.getFloat32(f+12,!0),i[c*3+1]=o.getFloat32(f+16,!0),i[c*3+2]=o.getFloat32(f+20,!0),a[c*4+0]=o.getUint8(f+24)/255,a[c*4+1]=o.getUint8(f+25)/255,a[c*4+2]=o.getUint8(f+26)/255,a[c*4+3]=o.getUint8(f+27)/255;let _=(o.getUint8(f+28)-128)/128,d=(o.getUint8(f+29)-128)/128,p=(o.getUint8(f+30)-128)/128,u=(o.getUint8(f+31)-128)/128;const v=Math.sqrt(u*u+_*_+d*d+p*p);v>0&&(u/=v,_/=v,d/=v,p/=v),l[c*4+0]=u,l[c*4+1]=_,l[c*4+2]=d,l[c*4+3]=p}return{count:r,positions:n,colors:a,scales:i,rotations:l,shCoeffs:null,shDegree:0,cov3d:null}}let N=null;function Z(){document.getElementById("loading-overlay").classList.add("visible")}function W(){document.getElementById("loading-overlay").classList.remove("visible")}function I(s){const e=document.getElementById("error-toast");e.textContent=s,e.classList.add("visible"),N&&clearTimeout(N),N=setTimeout(()=>e.classList.remove("visible"),3500)}function J(){document.getElementById("no-webgpu").classList.add("visible"),document.getElementById("ui").style.display="none"}function he(s){document.getElementById("scene-label").textContent=s}function pe(s){const e=document.getElementById("scene-credit");e.textContent=s?`by ${s}`:""}function K(s,e){document.getElementById("stat-fps").textContent=s.toFixed(0),document.getElementById("stat-splats").textContent=ve(e)}function ve(s){return s>=1e6?(s/1e6).toFixed(2)+"M":s>=1e3?(s/1e3).toFixed(1)+"K":String(s)}function ge(s){const e=document.getElementById("load-btn"),r=document.getElementById("file-input");e.addEventListener("click",()=>r.click()),r.addEventListener("change",async()=>{const o=r.files?.[0];if(o){r.value="",Z();try{s(await o.arrayBuffer(),o.name)}catch{W(),I("Failed to read file")}}})}const me="./scenes/clockstatue.ply",ye="clockstatue.ply",_e="@naturalai via superspl.at",xe=.9998;async function we(){if(!navigator.gpu){J();return}const s=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!s){J();return}const e=await s.requestDevice({requiredLimits:{maxStorageBufferBindingSize:s.limits.maxStorageBufferBindingSize,maxBufferSize:s.limits.maxBufferSize}}),r=document.getElementById("canvas"),o=r.getContext("webgpu"),n=navigator.gpu.getPreferredCanvasFormat();o.configure({device:e,format:n,alphaMode:"opaque"});const a=new se(r),i=await $.create(e,n),l=new Worker(new URL("/gaussian-splat-viewer/assets/sort.worker-BEqkhl-i.js",import.meta.url),{type:"module"});let c=!1,f=new Float32Array(3);l.onmessage=g=>{c=!1,i.uploadSortedIndices(g.data.indices)};function _(g,m,y){c||f[0]*g+f[1]*m+f[2]*y>xe||(c=!0,f[0]=g,f[1]=m,f[2]=y,l.postMessage({type:"sort",vx:g,vy:m,vz:y}))}let d=0,p=0;new ResizeObserver(g=>{for(const m of g){const y=window.devicePixelRatio??1;d=Math.round(m.contentRect.width*y),p=Math.round(m.contentRect.height*y),r.width=d,r.height=p,i.resize(d,p)}}).observe(r);async function v(g,m,y=""){try{const S=m.endsWith(".splat")?de(g):await fe(g);i.loadSplats(S),he(m),pe(y),K(0,i.splatCount);const L=S.positions.slice(0,i.splatCount*3);l.postMessage({type:"init",positions:L},[L.buffer]),f.fill(0),c=!1}catch(S){I(S instanceof Error?S.message:"Parse error")}finally{W()}}async function z(g,m,y=""){Z();try{const S=await fetch(g);if(!S.ok)throw new Error(`HTTP ${S.status}`);await v(await S.arrayBuffer(),m,y)}catch(S){W(),I(S instanceof Error?S.message:"Network error")}}ge(async(g,m)=>v(g,m)),await z(me,ye,_e);let B=performance.now(),w=0;function E(){const g=performance.now(),m=g-B;if(w++,m>=500&&(K(w/m*1e3,i.splatCount),w=0,B=g),d>0&&p>0){const y=a.getViewMatrix();_(y[2],y[6],y[10]),i.render(o.getCurrentTexture().createView(),y,a.getProjectionMatrix(d,p),a.getEye(),d,p)}requestAnimationFrame(E)}requestAnimationFrame(E)}we().catch(s=>{console.error(s),I("Initialization failed")});
