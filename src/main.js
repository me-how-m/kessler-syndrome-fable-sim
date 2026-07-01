// Kessler Syndrome — cinematic orbital cascade (v2, Fable build).
// three.js WebGPURenderer (automatic WebGL2 fallback; force with ?webgl),
// TSL node materials, afterimage motion trails + bloom + vignette post stack.
import * as THREE from "three/webgpu";
import { pass, uniform, screenUV } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { afterImage } from "three/addons/tsl/display/AfterImageNode.js";

import { createSim, step, doASAT, DEFAULT_CFG } from "./sim.js";
import { createEarth } from "./scene/earth.js";
import { createStars } from "./scene/stars.js";
import { createSwarm } from "./scene/swarm.js";
import { createEffects } from "./scene/effects.js";
import { createShells } from "./scene/shells.js";
import { createCameraRig } from "./camera.js";
import { createHUD } from "./hud.js";
import { createControls } from "./controls.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);

async function init() {
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    forceWebGL: params.has("webgl"),
  });
  await renderer.init();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.classList.add("webgl");
  document.body.appendChild(renderer.domElement);

  const isWebGPU = renderer.backend.isWebGPUBackend === true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);

  // --- world ---
  const earth = createEarth(renderer);
  const stars = createStars();
  const swarm = createSwarm();
  const effects = createEffects();
  const shells = createShells();
  scene.add(stars.group, earth.group, shells.group, swarm.group, effects.group);

  // sun glare: HDR-white disc far away along sunDir; bloom does the rest
  const sunPos = earth.sunDir.value.clone().multiplyScalar(120);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.4, 7.2) })
  );
  sun.position.copy(sunPos);
  scene.add(sun);

  // --- camera ---
  const rig = createCameraRig(renderer, reducedMotion);

  // --- post stack: scene → afterimage trails → bloom → vignette ---
  const post = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, rig.camera);
  const color = scenePass.getTextureNode();
  const dampU = uniform(reducedMotion ? 0.0 : 0.82);
  const trailed = afterImage(color, dampU);
  const bloomPass = bloom(trailed, 0.58, 0.5, 0.85);
  const vign = screenUV.sub(0.5).length().pow(2.0).mul(1.05).oneMinus().clamp(0.5, 1.0);
  post.outputNode = trailed.add(bloomPass).mul(vign);

  // trails mush during manual camera moves — ease them off while dragging
  let dampTarget = dampU.value;
  rig.controls.addEventListener("start", () => { dampTarget = 0.35; });
  rig.controls.addEventListener("end", () => { dampTarget = reducedMotion ? 0.0 : 0.82; });

  // --- sim + UI ---
  const cfg = { ...DEFAULT_CFG };
  let sim = createSim();
  const events = [];
  const hud = createHUD();
  hud.setBackend(isWebGPU ? "WEBGPU" : "WEBGL2");

  const controls = createControls(cfg, {
    onReset: () => { sim = createSim(); effects.reset(); Object.assign(cfg, DEFAULT_CFG); controls.syncSliders(); },
    onASAT: () => { doASAT(sim, cfg, events); },
    onRunToggle: () => {},
  });

  // --- adaptive quality: degrade pixel ratio + trails if fps sags ---
  const tiers = [
    { pr: Math.min(devicePixelRatio, 2), trails: true },
    { pr: 1.5, trails: true },
    { pr: 1.25, trails: true },
    { pr: 1.0, trails: false },
  ];
  let tier = 0, fpsEMA = 60, lowT = 0;
  function degrade(dt) {
    if (tier >= tiers.length - 1) return;
    lowT = fpsEMA < 45 ? lowT + dt : 0;
    if (lowT > 2.5) {
      tier++; lowT = 0;
      const t = tiers[tier];
      renderer.setPixelRatio(t.pr);
      if (!t.trails) dampTarget = 0;
      console.info(`[quality] degraded to tier ${tier} (pixelRatio ${t.pr}${t.trails ? "" : ", trails off"})`);
    }
  }

  // --- resize ---
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize();
  });

  // --- intro / loading choreography ---
  document.getElementById("loading").classList.add("done");
  const intro = document.getElementById("intro");
  let hudShown = false;
  if (reducedMotion) {
    intro.classList.add("done");
    document.body.classList.add("hud-visible");
    hudShown = true;
    setTimeout(() => intro.remove(), 1800);
  }

  // --- frame loop ---
  const timer = new THREE.Timer();

  renderer.setAnimationLoop((ts) => {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.05);

    // sim step
    if (controls.state.running) {
      step(sim, cfg, dt, events);
      while (events.length) {
        const e = events.shift();
        effects.burst(e.pos, e.type === "asat" ? { count: 220, red: true, big: true } : { count: 90 });
      }
    } else {
      events.length = 0;
    }

    // world updates
    earth.update(dt);
    swarm.update(sim);
    effects.update(dt, rig.camera);
    const { introDone, introK } = rig.update(dt, effects.getShake());

    // intro → HUD handoff
    if (!hudShown && (introDone || introK > 0.62)) {
      document.body.classList.add("hud-visible");
      intro.classList.add("done");
      setTimeout(() => intro.remove(), 1800);
      hudShown = true;
    }

    // damp easing
    dampU.value += (dampTarget - dampU.value) * Math.min(dt * 4, 1);

    shells.updateLabels(rig.camera);
    hud.update(sim.stats, sim.hist);

    // fps tracking
    const fps = 1 / Math.max(dt, 1e-4);
    fpsEMA += (fps - fpsEMA) * 0.05;
    degrade(dt);

    post.render();
  });

  // expose for debugging in console
  window.__kessler = { renderer, scene, sim: () => sim, cfg, fps: () => fpsEMA, isWebGPU };
}

init().catch(err => {
  console.error(err);
  const el = document.getElementById("loading");
  el.textContent = "WebGL/WebGPU unavailable — this simulation needs a modern browser.";
  el.classList.remove("done");
});
