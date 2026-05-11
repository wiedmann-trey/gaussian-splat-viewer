# Splat Viewer

https://wiedmann-trey.github.io/gaussian-splat-viewer/

WebGPU Gaussian splat renderer

## Setup

```bash
npm install
npm run dev
```

## Implementation

Following antimatter15's example, depth sorting happens on a web worker separate from main render loop. Additionally, 3D covariances are pre-computed on scene load.

## References

- [3DGS paper](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
- [antimatter15 splat viewer](https://github.com/antimatter15/splat)
