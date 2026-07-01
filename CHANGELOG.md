# Changelog — Kessler Syndrome (cinematic edition)

## 2026-07-01 — v2.0.0 · initial Fable build

### What this is
Cinematic rebuild of [Kessler_sim](https://github.com/me-how-m/Kessler_sim) (v1, recharts +
hand-rolled 2D canvas). The simulation model is ported 1:1 from v1; every visual is new.

### Simulation (ported, not changed)
- `src/sim.js` — v1 model verbatim: launch accumulator, ~8 %/yr retirement with
  compliance, cleanup ops, geometric + statistical (density²) collision models, ASAT,
  cascade status, 0.5-sim-year history.
- Stepping is now refresh-rate independent (real `dt`, clamped) — v1 assumed 60 Hz rAF.
- **`MAX_DOTS` kept at v1's 1500.** Verified during the build that it is load-bearing:
  the statistical collision model normalizes density against fixed constants, so raising
  the cap to 6000 sent the model into instant runaway. Reverted; defaults now reproduce
  v1 behavior.

### Rendering (all new)
- three.js r185 `WebGPURenderer`, automatic WebGL2 fallback (`?webgl` to force; badge in HUD).
- Earth: TSL day/night blend (Blue Marble + city lights), ocean specular, warm
  terminator band, rotating cloud shell (density = r·a of the clouds texture), backside
  atmospheric halo remapped to hug the limb.
- Swarm: instanced octahedra (sats, cyan by shell) + tetrahedra (debris, ember amber);
  fresh fragments spawn white-hot at 2.6× scale and cool over ~0.18 sim-years.
- Collisions: pooled HDR flash cores + billboarded shockwave rings + ≤3000-instance
  spark pool with tangential (along-orbit) velocity bias. ASAT = bigger, red, camera kick.
- Backdrop: 9000-star twinkling Points field + MaterialX-noise nebula dome with a
  galactic band.
- Post: afterimage trails (damp eases 0.82→0.35 while dragging) → bloom
  (0.58/0.5/0.85) → vignette; ACES filmic.
- Camera: 4.8 s intro pull-back → slow auto-orbit → OrbitControls takeover, idle-resume;
  collision shake scaled by cascade intensity.
- HUD: glass panels, live stat cards, cascade banner, canvas sparklines (sats/debris/
  collisions), scenario chips (Today / Mega-constellations / Active cleanup — cfg presets
  within v1 slider ranges), v1's full slider set + tooltips, keyboard shortcuts
  (Space/R/A), fullscreen, collapsible drawer.
- `prefers-reduced-motion`: no intro, no auto-orbit, no trails.
- Adaptive quality: pixel-ratio steps 2→1.5→1.25→1 (+trails off) if fps < 45 for 2.5 s.

### Verification (dev, M-series MacBook Air)
- WebGPU backend: 60 fps at devicePixelRatio 2, 1440×860.
- WebGL2 backend (`?webgl`): 60 fps, zero console errors.
- Production build: 912 kB JS (251 kB gzip) + ~1.7 MB textures.

### Deploy
- GitHub: me-how-m/kessler-syndrome-fable-sim (public)
- Vercel: kessler-syndrome-fable-sim (new project; v1's kessler-syndrome-sim untouched)
