# Kessler Syndrome — Orbital Cascade (cinematic edition)

A cinematic, interactive 3D simulation of the **Kessler syndrome** — the runaway cascade
where orbital debris collisions create more debris, until entire orbital shells become
unusable. Part of the **#exponentialmath** series.

**Live:** https://kessler-syndrome-fable-sim.vercel.app

This is the "Fable build" (v2) of the original
[Kessler_sim](https://github.com/me-how-m/Kessler_sim) — same simulation model,
completely rebuilt rendering: three.js **WebGPU** with TSL node materials, falling back
to WebGL2 automatically.

## What you're looking at

- **Earth** — NASA Blue Marble day texture blended to night city-lights across a live
  terminator, ocean specular, warm terminator band, rotating cloud layer, and a
  limb-hugging atmospheric scattering halo.
- **Cyan points** — operational satellites (LEO / MEO / GEO), instanced meshes.
- **Amber points** — debris. Each dot ≈ 50 real trackable fragments ≥ 10 cm.
  Fresh collision fragments spawn white-hot and cool to ember over a couple of seconds.
- **Collisions** — HDR flash core, billboarded shockwave ring, and a tangential spark
  burst (fragments fly along-orbit, as they should).
- **Motion trails** — a temporal afterimage pass; bloom and a soft vignette finish the
  film look.

## Controls

| Input | Action |
|---|---|
| Drag / scroll | Orbit / zoom (auto-orbit resumes after 5 s idle) |
| `Space` | Pause / resume |
| `R` | Reset |
| `A` | Simulate an ASAT (anti-satellite weapon) test |
| Scenario chips | Today · Mega-constellations · Active cleanup |
| Sliders | Launch rate, deorbit compliance, fragments per collision, cleanup ops, speed |

`?webgl` in the URL forces the WebGL2 backend (the badge top-right shows which one is live).

## The model (unchanged from v1)

The simulation is deliberately a *toy model tuned for intuition*, not an ephemerides
propagator: satellites launch into LEO/MEO/GEO shells, retire at ~8 %/yr (non-compliant
retirees become debris), and collide via a geometric proximity check plus a statistical
density² model per shell. Each collision spawns a configurable number of fragments —
which is exactly how the cascade compounds. Population is capped at 1,500 objects;
that cap is load-bearing for the collision statistics, so it is identical to v1.

`prefers-reduced-motion` is honored: no intro move, no auto-orbit, no trails.

## Run locally

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # static build in dist/
```

## Tech notes

- three.js r185, `WebGPURenderer` + TSL (`MeshBasicNodeMaterial`, `PointsNodeMaterial`,
  MaterialX fractal noise for the nebula dome).
- Post stack: `RenderPipeline` with `afterImage` (uniform-driven damping — trails ease
  off while you drag) → `bloom` → vignette, ACES filmic tone mapping.
- Instanced rendering throughout; adaptive quality degrades pixel ratio and trails if
  fps sags below 45.
- Earth textures are NASA-derived (public domain), taken from the
  [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets).

---

**Michal Monit, PhD** · #exponentialmath
