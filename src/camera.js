// Camera rig: cinematic intro pull-back → slow auto-orbit → user takeover.
// Auto-orbit resumes after 5 s idle. Collision shake applied post-update.
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const INTRO_FROM = new THREE.Vector3(0.55, 0.28, 1.62);
const INTRO_TO = new THREE.Vector3(1.15, 1.32, 3.95);
const INTRO_TIME = 4.8;

const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createCameraRig(renderer, reducedMotion) {
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 260);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.45;
  controls.maxDistance = 14;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.autoRotateSpeed = -0.22;

  let introT = reducedMotion ? INTRO_TIME : 0;
  let idle = 0;
  let interacting = false;

  controls.addEventListener("start", () => { interacting = true; idle = 0; controls.autoRotate = false; });
  controls.addEventListener("end", () => { interacting = false; idle = 0; });

  if (reducedMotion) {
    camera.position.copy(INTRO_TO);
    controls.autoRotate = false;
    controls.update();
  } else {
    camera.position.copy(INTRO_FROM);
    controls.enabled = false;
  }

  const shakeOff = new THREE.Vector3();

  function update(dt, shake) {
    if (introT < INTRO_TIME) {
      introT += dt;
      const k = easeInOutCubic(Math.min(introT / INTRO_TIME, 1));
      camera.position.lerpVectors(INTRO_FROM, INTRO_TO, k);
      camera.lookAt(0, 0, 0);
      if (introT >= INTRO_TIME) {
        controls.enabled = true;
        controls.autoRotate = !reducedMotion;
        controls.update();
      }
      return { introDone: introT >= INTRO_TIME, introK: k };
    }

    if (!interacting) {
      idle += dt;
      if (idle > 5 && !reducedMotion) controls.autoRotate = true;
    }
    controls.update();

    if (shake > 0.002 && !reducedMotion) {
      const s = shake * shake * 0.02;
      shakeOff.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      camera.position.add(shakeOff);
    }
    return { introDone: true, introK: 1 };
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, update, resize, isIntroDone: () => introT >= INTRO_TIME };
}
