import { SplatCloud } from './splat'
import { Mat4, Vec3 } from './math'
import SPLAT_WGSL from './splat.wgsl?raw'
import COV3D_WGSL from './cov3d.wgsl?raw'

const ALPHA_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
}

const BLOCK_SIZE = 256

export class GaussianRenderer {
  private positionsBuf:     GPUBuffer | null = null
  private colorsBuf:        GPUBuffer | null = null
  private shBuf:            GPUBuffer | null = null
  private cov3dBuf:         GPUBuffer | null = null
  private sortedIndicesBuf: GPUBuffer | null = null

  private uniformBuf: GPUBuffer

  private renderPipeline: GPURenderPipeline
  private cov3dPipeline:  GPUComputePipeline

  private renderBindGroup: GPUBindGroup | null = null

  private depthTexture:    GPUTexture | null = null
  private splatCount     = 0
  private shDegree       = 0

  // Pre-allocated uniform upload buffer
  private uniformDataCache = new Float32Array(40)

  private constructor(
    private device: GPUDevice,
    private format: GPUTextureFormat,
    renderPipeline: GPURenderPipeline,
    cov3dPipeline:  GPUComputePipeline,
  ) {
    this.renderPipeline = renderPipeline
    this.cov3dPipeline  = cov3dPipeline

    this.uniformBuf = device.createBuffer({
      size:  256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<GaussianRenderer> {
    const renderModule = device.createShaderModule({ code: SPLAT_WGSL })
    const cov3dModule  = device.createShaderModule({ code: COV3D_WGSL })

    const [renderPipeline, cov3dPipeline] = await Promise.all([
      device.createRenderPipelineAsync({
        layout:   'auto',
        vertex:   { module: renderModule, entryPoint: 'vs_main' },
        fragment: { module: renderModule, entryPoint: 'fs_main', targets: [{ format, blend: ALPHA_BLEND }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
      }),
      device.createComputePipelineAsync({
        layout:  'auto',
        compute: { module: cov3dModule, entryPoint: 'compute_cov3d' },
      }),
    ])

    return new GaussianRenderer(device, format, renderPipeline, cov3dPipeline)
  }


  loadSplats(cloud: SplatCloud): void {
    const maxBuf = Math.min(
      this.device.limits.maxBufferSize,
      this.device.limits.maxStorageBufferBindingSize,
    )

    // cov3dBuf at 24 bytes/splat is the largest fixed-size storage buffer
    const maxSplats = Math.floor(maxBuf / 24)
    const count     = Math.min(cloud.count, maxSplats)
    if (count < cloud.count) {
      console.warn(`Scene truncated from ${cloud.count} to ${count} splats (buffer size limit)`)
    }

    this.splatCount = count
    this.shDegree   = cloud.shDegree

    this.positionsBuf?.destroy()
    this.colorsBuf?.destroy()
    this.shBuf?.destroy()
    this.cov3dBuf?.destroy()
    this.sortedIndicesBuf?.destroy()

    const positions  = count < cloud.count ? cloud.positions.slice(0, count * 3)  : cloud.positions
    const colors     = count < cloud.count ? cloud.colors.slice(0, count * 4)     : cloud.colors
    const scales     = count < cloud.count ? cloud.scales.slice(0, count * 3)     : cloud.scales
    const rotations  = count < cloud.count ? cloud.rotations.slice(0, count * 4)  : cloud.rotations

    this.positionsBuf = this.uploadF32(positions, GPUBufferUsage.STORAGE)
    this.colorsBuf    = this.uploadF32(colors,    GPUBufferUsage.STORAGE)

    const shBytes = cloud.shCoeffs !== null ? cloud.shCoeffs.byteLength : 0
    if (cloud.shCoeffs !== null && shBytes <= maxBuf) {
      const shCoeffs = count < cloud.count ? cloud.shCoeffs.slice(0, count * 48) : cloud.shCoeffs
      this.shBuf = this.uploadF32(shCoeffs, GPUBufferUsage.STORAGE)
    } else {
      if (cloud.shCoeffs !== null) console.warn('SH dropped — buffer would exceed device limit')
      this.shDegree = 0
      this.shBuf = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE })
    }

    this.cov3dBuf = this.device.createBuffer({
      size:  count * 6 * 4,
      usage: GPUBufferUsage.STORAGE,
    })

    this.sortedIndicesBuf = this.device.createBuffer({
      size:  count * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    const initIndices = new Uint32Array(count)
    for (let i = 0; i < count; i++) initIndices[i] = i
    this.device.queue.writeBuffer(this.sortedIndicesBuf, 0, initIndices)

    // One-time cov3d pass
    if (cloud.cov3d !== null) {
      const cov3dSliced = count < cloud.count ? cloud.cov3d.slice(0, count * 6) : cloud.cov3d
      this.device.queue.writeBuffer(this.cov3dBuf, 0, cov3dSliced)
    } else {
      const cov3dBindGroup = this.device.createBindGroup({
        layout: this.cov3dPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uploadF32(scales,    GPUBufferUsage.STORAGE) } },
          { binding: 1, resource: { buffer: this.uploadF32(rotations, GPUBufferUsage.STORAGE) } },
          { binding: 2, resource: { buffer: this.cov3dBuf } },
        ],
      })
      const enc = this.device.createCommandEncoder()
      const cov = enc.beginComputePass()
      cov.setPipeline(this.cov3dPipeline)
      cov.setBindGroup(0, cov3dBindGroup)
      cov.dispatchWorkgroups(Math.ceil(count / BLOCK_SIZE))
      cov.end()
      this.device.queue.submit([enc.finish()])
    }

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.positionsBuf! } },
        { binding: 2, resource: { buffer: this.colorsBuf! } },
        { binding: 3, resource: { buffer: this.shBuf! } },
        { binding: 4, resource: { buffer: this.sortedIndicesBuf! } },
        { binding: 5, resource: { buffer: this.cov3dBuf } },
      ],
    })
  }

  private uploadF32(data: Float32Array, extraUsage: GPUFlagsConstant): GPUBuffer {
    const buf = this.device.createBuffer({
      size:  data.byteLength,
      usage: GPUBufferUsage.COPY_DST | extraUsage,
    })
    this.device.queue.writeBuffer(buf, 0, data)
    return buf
  }


  uploadSortedIndices(indices: Uint32Array): void {
    if (!this.sortedIndicesBuf) return
    this.device.queue.writeBuffer(this.sortedIndicesBuf, 0, indices)
  }


  resize(width: number, height: number): void {
    this.depthTexture?.destroy()
    this.depthTexture = this.device.createTexture({
      size:   [width, height],
      format: 'depth24plus',
      usage:  GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }


  render(
    target:     GPUTextureView,
    viewMatrix: Mat4,
    projMatrix: Mat4,
    cameraPos:  Vec3,
    width:      number,
    height:     number,
  ): void {
    if (this.splatCount === 0 || !this.depthTexture) return

    this.updateUniforms(viewMatrix, projMatrix, cameraPos, width, height)

    const encoder = this.device.createCommandEncoder()
    const pass    = encoder.beginRenderPass({
      colorAttachments: [{
        view:       target,
        clearValue: { r: 0.03, g: 0.03, b: 0.03, a: 1 },
        loadOp:     'clear',
        storeOp:    'store',
      }],
      depthStencilAttachment: {
        view:            this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp:     'clear',
        depthStoreOp:    'discard',
        depthReadOnly:   false,
      },
    })

    if (this.renderBindGroup) {
      pass.setPipeline(this.renderPipeline)
      pass.setBindGroup(0, this.renderBindGroup)
      pass.draw(6, this.splatCount)
    }

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }


  private updateUniforms(view: Mat4, proj: Mat4, cameraPos: Vec3, width: number, height: number): void {
    const d  = this.uniformDataCache
    const dv = new DataView(d.buffer)
    d.set(view, 0)
    d.set(proj, 16)
    d[32] = width
    d[33] = height
    dv.setUint32(34 * 4, this.shDegree,   true)
    dv.setUint32(35 * 4, this.splatCount, true)
    d[36] = cameraPos[0]
    d[37] = cameraPos[1]
    d[38] = cameraPos[2]
    this.device.queue.writeBuffer(this.uniformBuf, 0, d)
  }




  dispose(): void {
    this.positionsBuf?.destroy()
    this.colorsBuf?.destroy()
    this.shBuf?.destroy()
    this.cov3dBuf?.destroy()
    this.sortedIndicesBuf?.destroy()
    this.uniformBuf.destroy()
    this.depthTexture?.destroy()
  }
}
