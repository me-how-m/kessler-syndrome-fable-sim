// Orbit shell guides: thin glowing rings + HTML labels projected each frame.
import * as THREE from "three/webgpu";
import { altV, LEO_MIN, LEO_MAX, MEO_ALT, GEO_ALT, EARTH_R } from "../sim.js";

const SHELLS = [
  { alt: LEO_MIN, label: "LEO 400 KM", op: 0.16, az: 0.5 },
  { alt: LEO_MAX, label: "LEO 2000 KM", op: 0.12, az: 1.7 },
  { alt: MEO_ALT, label: "MEO · GPS", op: 0.10, az: 2.6 },
  { alt: GEO_ALT, label: "GEO 35 786 KM", op: 0.12, az: 3.9 },
];

export function createShells() {
  const group = new THREE.Group();
  const labels = [];
  const container = document.body;

  for (const s of SHELLS) {
    const r = altV(s.alt) / EARTH_R;
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x6d9fd8, transparent: true, opacity: s.op, depthWrite: false,
    });
    group.add(new THREE.Line(geo, mat));

    const el = document.createElement("div");
    el.className = "shell-label";
    el.textContent = s.label;
    container.appendChild(el);
    labels.push({ el, anchor: new THREE.Vector3(Math.cos(s.az) * r, 0, Math.sin(s.az) * r) });
  }

  const v = new THREE.Vector3();
  function updateLabels(camera) {
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      v.copy(l.anchor).project(camera);
      const behind = v.z > 1;
      if (behind || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) {
        l.el.style.display = "none";
        continue;
      }
      l.el.style.display = "block";
      l.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      l.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    }
  }

  return { group, updateLabels };
}
