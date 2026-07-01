// Collision spectacle: HDR flash cores (blown out by bloom), billboarded
// shockwave rings, and a pooled spark burst with tangential velocity bias.
import * as THREE from "three/webgpu";
import { simToScene } from "./swarm.js";

const SPARK_CAP = 3000;

export function createEffects() {
  const group = new THREE.Group();

  // --- flash cores ---
  const flashGeo = new THREE.SphereGeometry(1, 12, 12);
  const flashes = [];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(6, 6, 5.4), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(flashGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    flashes.push({ mesh, t: 1e9, ttl: 0.55 });
  }

  // --- shockwave rings ---
  const ringGeo = new THREE.RingGeometry(0.82, 1.0, 64);
  const rings = [];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 2.2, 3.2), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    rings.push({ mesh, t: 1e9, ttl: 0.9 });
  }

  // --- spark pool ---
  const sparkGeo = new THREE.TetrahedronGeometry(1, 0);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_CAP);
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparks.setColorAt(0, new THREE.Color());
  sparks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(sparks);

  const pool = []; // {pos, vel, age, ttl}
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const sv = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const HOT = new THREE.Color(5.0, 4.5, 3.6), MID = new THREE.Color(3.2, 1.5, 0.4), END = new THREE.Color(1.2, 0.25, 0.08);
  const tang = new THREE.Vector3(), rnd = new THREE.Vector3();

  let shake = 0;

  function firstFree(list) {
    let best = list[0], age = -1;
    for (const e of list) { if (!e.mesh.visible) return e; if (e.t > age) { age = e.t; best = e; } }
    return best;
  }

  function burst(simPos, { count = 90, red = false, big = false } = {}) {
    const origin = simToScene(simPos, new THREE.Vector3());

    const f = firstFree(flashes);
    f.t = 0; f.ttl = big ? 0.8 : 0.55;
    f.mesh.visible = true;
    f.mesh.position.copy(origin);
    f.mesh.material.color.setRGB(red ? 7 : 6, red ? 2.2 : 6, red ? 1.2 : 5.4);

    const r = firstFree(rings);
    r.t = 0; r.ttl = big ? 1.25 : 0.9;
    r.mesh.visible = true;
    r.mesh.position.copy(origin);
    r.mesh.material.color.setRGB(red ? 3.4 : 1.6, red ? 1.1 : 2.2, red ? 0.5 : 3.2);

    // tangential bias: sparks fly along-orbit, not isotropically
    tang.set(-origin.z, 0, origin.x).normalize();
    for (let i = 0; i < count && pool.length < SPARK_CAP - 1; i++) {
      rnd.randomDirection();
      const speed = 0.06 + Math.random() * (big ? 0.42 : 0.3);
      const vel = new THREE.Vector3()
        .copy(tang).multiplyScalar((Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.6))
        .addScaledVector(rnd, 0.75)
        .normalize().multiplyScalar(speed);
      pool.push({ pos: origin.clone(), vel, age: 0, ttl: 0.7 + Math.random() * 0.9 });
    }

    shake = Math.min(shake + (big ? 0.5 : 0.14), 0.8);
  }

  function update(dt, camera) {
    for (const f of flashes) {
      if (!f.mesh.visible) continue;
      f.t += dt;
      const k = f.t / f.ttl;
      if (k >= 1) { f.mesh.visible = false; continue; }
      const s = 0.008 + k * 0.042;
      f.mesh.scale.setScalar(s);
      f.mesh.material.opacity = Math.pow(1 - k, 2.8);
    }
    for (const r of rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.ttl;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const s = 0.015 + Math.pow(k, 0.65) * 0.16;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.pow(1 - k, 1.8) * 0.9;
      r.mesh.lookAt(camera.position);
    }
    // sparks
    let n = 0;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      s.age += dt;
      if (s.age >= s.ttl) continue;
      pool[n++] = s;
      s.pos.addScaledVector(s.vel, dt);
      s.vel.multiplyScalar(1 - 1.4 * dt); // drag
      const k = s.age / s.ttl;
      const size = 0.0035 * (1 - k * 0.7);
      sc.setScalar(size);
      m.compose(s.pos, q, sc);
      sparks.setMatrixAt(n - 1, m);
      if (k < 0.35) c.copy(HOT).lerp(MID, k / 0.35);
      else c.copy(MID).lerp(END, (k - 0.35) / 0.65);
      sparks.setColorAt(n - 1, c);
    }
    pool.length = n;
    sparks.count = n;
    if (n > 0 || sparks.count > 0) {
      sparks.instanceMatrix.needsUpdate = true;
      sparks.instanceColor.needsUpdate = true;
    }
    shake = Math.max(0, shake - dt * 1.6);
  }

  function reset() {
    pool.length = 0;
    sparks.count = 0;
    for (const f of flashes) f.mesh.visible = false;
    for (const r of rings) r.mesh.visible = false;
    shake = 0;
  }

  return { group, burst, update, reset, getShake: () => shake };
}
