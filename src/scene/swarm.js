// Instanced satellite + debris swarms, driven directly by the sim object list.
// Fresh collision fragments spawn white-hot and cool to ember amber over ~2 sim-seconds.
import * as THREE from "three/webgpu";
import { p3, EARTH_R, MAX_DOTS, SIM_YEAR } from "../sim.js";

const SAT_SCALE = 0.0072, DEB_SCALE = 0.0048;

const SAT_COLS = {
  l: new THREE.Color(0.28, 1.15, 1.75),  // LEO — cyan
  m: new THREE.Color(0.45, 1.05, 1.65),  // MEO — softer blue
  g: new THREE.Color(0.8, 1.1, 1.55),    // GEO — pale
};
const DEB_COL = new THREE.Color(1.55, 0.8, 0.22);   // ember amber (HDR for bloom)
const HOT_COL = new THREE.Color(3.2, 2.7, 2.1);     // white-hot fresh fragment

export function createSwarm() {
  const group = new THREE.Group();

  const satGeo = new THREE.OctahedronGeometry(1, 0);
  const debGeo = new THREE.TetrahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });

  const sats = new THREE.InstancedMesh(satGeo, mat, MAX_DOTS);
  const debris = new THREE.InstancedMesh(debGeo, mat.clone(), MAX_DOTS);
  sats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // allocate instance color buffers up front
  sats.setColorAt(0, SAT_COLS.l);
  debris.setColorAt(0, DEB_COL);
  sats.instanceColor.setUsage(THREE.DynamicDrawUsage);
  debris.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(sats, debris);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const p = [0, 0, 0];
  const cool = new THREE.Color();

  function update(sim) {
    let si = 0, di = 0;
    const objs = sim.objs;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (!o.alive) continue;
      p3(o, p);
      v.set(p[0] / EARTH_R, p[2] / EARTH_R, p[1] / EARTH_R); // sim z-up → scene y-up
      if (o.type === "d") {
        if (di >= MAX_DOTS) continue;
        // fresh fragments: bigger + white-hot, cooling over ~0.18 sim-years
        const age = sim.t - (o.born || 0);
        const hot = o.born ? Math.max(0, 1 - age / (SIM_YEAR * 0.18)) : 0;
        const s = DEB_SCALE * (1 + hot * 1.6);
        sc.set(s, s, s);
        m.compose(v, q, sc);
        debris.setMatrixAt(di, m);
        if (hot > 0) cool.copy(DEB_COL).lerp(HOT_COL, hot * hot);
        else cool.copy(DEB_COL);
        debris.setColorAt(di, cool);
        di++;
      } else {
        if (si >= MAX_DOTS) continue;
        sc.set(SAT_SCALE, SAT_SCALE, SAT_SCALE);
        m.compose(v, q, sc);
        sats.setMatrixAt(si, m);
        sats.setColorAt(si, SAT_COLS[o.type] || SAT_COLS.l);
        si++;
      }
    }
    sats.count = si;
    debris.count = di;
    sats.instanceMatrix.needsUpdate = true;
    debris.instanceMatrix.needsUpdate = true;
    sats.instanceColor.needsUpdate = true;
    debris.instanceColor.needsUpdate = true;
  }

  return { group, update };
}

// convert a sim-space position array to scene space
export function simToScene(pos, out) {
  out.set(pos[0] / EARTH_R, pos[2] / EARTH_R, pos[1] / EARTH_R);
  return out;
}
