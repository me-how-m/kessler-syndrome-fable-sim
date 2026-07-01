// Deep-space backdrop: twinkling starfield + a faint procedural nebula dome.
import * as THREE from "three/webgpu";
import {
  vec3, float, attribute, time, sin, mix, positionLocal, normalize, dot,
  mx_fractal_noise_float,
} from "three/tsl";

export function createStars() {
  const group = new THREE.Group();

  // --- starfield ---
  const N = 9000;
  const pos = new Float32Array(N * 3);
  const base = new Float32Array(N);   // base brightness
  const spd = new Float32Array(N);    // twinkle speed
  const ph = new Float32Array(N);     // twinkle phase
  const col = new Float32Array(N * 3);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    tmp.randomDirection().multiplyScalar(42 + Math.random() * 16);
    pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
    base[i] = 0.35 + Math.random() * 0.65;
    spd[i] = 0.4 + Math.random() * 2.2;
    ph[i] = Math.random() * Math.PI * 2;
    // mostly blue-white, a few warm giants
    const w = Math.random();
    if (w > 0.94) { col[i * 3] = 1.0; col[i * 3 + 1] = 0.75; col[i * 3 + 2] = 0.55; }
    else if (w > 0.85) { col[i * 3] = 0.75; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 1.0; }
    else { col[i * 3] = 0.92; col[i * 3 + 1] = 0.95; col[i * 3 + 2] = 1.0; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aBase", new THREE.BufferAttribute(base, 1));
  geo.setAttribute("aSpd", new THREE.BufferAttribute(spd, 1));
  geo.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
  geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3));

  const starMat = new THREE.PointsNodeMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  const twinkle = sin(time.mul(attribute("aSpd", "float")).add(attribute("aPh", "float"))).mul(0.28).add(0.72);
  const bright = attribute("aBase", "float").mul(twinkle);
  starMat.colorNode = vec3(attribute("aCol", "vec3")).mul(bright).mul(1.4);
  starMat.sizeNode = attribute("aBase", "float").mul(2.4).add(0.6);
  const stars = new THREE.Points(geo, starMat);
  stars.renderOrder = -2;
  group.add(stars);

  // --- nebula dome: two FBM layers + a soft galactic band ---
  const nebMat = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const dir = normalize(positionLocal);
  const n1 = mx_fractal_noise_float(dir.mul(2.2)).mul(0.5).add(0.5);
  const n2 = mx_fractal_noise_float(dir.mul(5.1).add(vec3(7.3, 1.1, 3.7))).mul(0.5).add(0.5);
  const bandAxis = vec3(0.32, 1.0, 0.18).normalize();
  const bd = dot(dir, bandAxis);
  const band = bd.mul(bd).mul(-9.0).exp();
  const deepBlue = vec3(0.10, 0.16, 0.34).mul(n1.pow(2.2));
  const magenta = vec3(0.20, 0.08, 0.26).mul(n2.pow(3.0)).mul(0.7);
  const bandCol = vec3(0.16, 0.22, 0.38).mul(band).mul(n1.mul(0.6).add(0.4));
  nebMat.colorNode = deepBlue.add(magenta).add(bandCol).mul(0.38);
  nebMat.opacityNode = float(1.0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(88, 32, 32), nebMat);
  dome.renderOrder = -3;
  group.add(dome);

  return { group, stars };
}
