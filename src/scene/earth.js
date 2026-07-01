// Earth: day/night blend with city lights, ocean specular, warm terminator,
// rotating cloud shell, and a two-layer atmosphere (inner rim + outer halo).
// All shading hand-rolled in TSL on MeshBasicNodeMaterial (no scene lights needed).
import * as THREE from "three/webgpu";
import {
  texture, uniform, vec3, float, mix, smoothstep, dot, normalize,
  positionWorld, normalWorld, cameraPosition,
} from "three/tsl";

export function createEarth(renderer) {
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();

  const dayTex = loader.load("/textures/earth_atmos_2048.jpg");
  const nightTex = loader.load("/textures/earth_lights_2048.png");
  const specTex = loader.load("/textures/earth_specular_2048.jpg");
  const cloudTex = loader.load("/textures/earth_clouds_1024.png");
  dayTex.colorSpace = THREE.SRGBColorSpace;
  nightTex.colorSpace = THREE.SRGBColorSpace;
  dayTex.anisotropy = nightTex.anisotropy = 8;

  // Sun direction — shared uniform, also used by main.js to place the sun glare
  const sunDir = uniform(new THREE.Vector3(1, 0.25, 0.45).normalize());

  const viewDir = normalize(cameraPosition.sub(positionWorld));
  const sunDot = dot(normalWorld, sunDir);
  const dayF = smoothstep(-0.08, 0.28, sunDot);
  const fres = viewDir.dot(normalWorld).clamp(0, 1).oneMinus().pow(2.6);

  // --- surface ---
  const day = texture(dayTex);
  const night = texture(nightTex);
  const spec = texture(specTex);

  const dayLit = day.rgb.mul(dayF.mul(1.05).add(0.015));
  const cityLights = night.rgb.mul(vec3(1.0, 0.82, 0.55)).mul(2.8).mul(dayF.oneMinus().pow(1.4));

  const halfV = normalize(sunDir.add(viewDir));
  const specI = normalWorld.dot(halfV).clamp(0, 1).pow(52.0).mul(spec.r).mul(dayF).mul(vec3(0.9, 0.95, 1.0)).mul(0.38);

  const term = smoothstep(-0.22, 0.0, sunDot).mul(smoothstep(0.22, 0.0, sunDot));
  const termGlow = vec3(1.0, 0.42, 0.2).mul(term).mul(0.16);

  const rim = vec3(0.32, 0.58, 1.0).mul(fres).mul(dayF.mul(0.85).add(0.12)).mul(0.5);

  const earthMat = new THREE.MeshBasicNodeMaterial();
  earthMat.colorNode = dayLit.add(cityLights).add(specI).add(termGlow).add(rim);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), earthMat);
  earth.renderOrder = 0;
  group.add(earth);

  // --- clouds ---
  const cloudMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const cl = texture(cloudTex);
  cloudMat.colorNode = vec3(1.0, 1.0, 1.0).mul(dayF.mul(1.0).add(0.05)).add(vec3(0.3, 0.5, 1.0).mul(fres).mul(0.22));
  // clouds texture: density lives in rgb×alpha depending on the asset — r·a covers both
  cloudMat.opacityNode = cl.r.mul(cl.a).mul(dayF.mul(0.85).add(0.10));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008, 96, 96), cloudMat);
  clouds.renderOrder = 1;
  group.add(clouds);

  // --- outer atmosphere halo (BackSide shell; visible band hugs the limb) ---
  const atmoMat = new THREE.MeshBasicNodeMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  // Visible backside fragments run from dot(view,normal)=0 at the outer silhouette
  // to ≈ -0.55 where Earth's disc occludes; remap that to a limb-hugging falloff.
  const nd = dot(viewDir, normalWorld).negate().clamp(0.0, 0.55).div(0.55);
  const litSide = smoothstep(-0.45, 0.35, sunDot).mul(0.8).add(0.2);
  atmoMat.colorNode = vec3(0.30, 0.55, 1.0).mul(nd.pow(2.6)).mul(litSide).mul(1.2);
  atmoMat.opacityNode = float(1.0);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 96, 96), atmoMat);
  atmo.renderOrder = 2;
  group.add(atmo);

  return {
    group, sunDir,
    update(dt) {
      earth.rotation.y += 0.010 * dt;
      clouds.rotation.y += 0.014 * dt;
    },
  };
}
