// Kessler cascade simulation — ported 1:1 from v1 (kessler-syndrome-sim.tsx).
// All rates, probabilities and semantics are unchanged; only the renderer changed.
// Units: v1 "screen units" (Earth radius = 60). The 3D layer divides by 60.

export const R_EARTH = 6371, LEO_MIN = 400, LEO_MAX = 2000, MEO_ALT = 20200, GEO_ALT = 35786;
export const SIM_YEAR = 12; // real seconds per sim-year at 1× speed
// NOTE: MAX_DOTS is load-bearing for the dynamics, not just a render cap —
// the statistical collision model normalizes density against fixed constants,
// so this ceiling controls collision rates. Keep at v1's 1500.
export const MAX_DOTS = 1500;
export const EARTH_R = 60; // v1 unit space

export function altV(alt) {
  if (alt <= LEO_MAX) return 62 + (alt - LEO_MIN) / (LEO_MAX - LEO_MIN) * 28;
  if (alt <= MEO_ALT) return 90 + (alt - LEO_MAX) / (MEO_ALT - LEO_MAX) * 40;
  return 130 + (alt - MEO_ALT) / (GEO_ALT - MEO_ALT) * 45;
}

export function mk(type, altKm) {
  const alt = altKm || (type === "g" ? GEO_ALT + (Math.random() - .5) * 200 : type === "m" ? MEO_ALT + (Math.random() - .5) * 2000 : LEO_MIN + Math.random() * (LEO_MAX - LEO_MIN));
  const r = altV(alt), incl = type === "g" ? (Math.random() - .5) * .1 : (Math.random() - .5) * Math.PI * .85;
  const spd = (2 * Math.PI / (2 * Math.PI * Math.sqrt(((R_EARTH + alt) * 1000) ** 3 / 3.986e14))) * 4000;
  return { type, r, alt, incl, raan: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2, speed: spd, alive: true, born: 0 };
}

export function p3(o, out) {
  const cp = Math.cos(o.phase), sp = Math.sin(o.phase), cr = Math.cos(o.raan), sr = Math.sin(o.raan), ci = Math.cos(o.incl), si = Math.sin(o.incl);
  out[0] = o.r * (cp * cr - sp * sr * ci);
  out[1] = o.r * (cp * sr + sp * cr * ci);
  out[2] = o.r * sp * si;
  return out;
}

export const INFO = {
  year: { desc: "Current simulation year. At 1× speed, 1 year ≈ 12 real seconds." },
  sats: { desc: "Operational satellites. Retire at ~8%/yr; non-compliant retirees become debris." },
  debris: { desc: "Each dot ≈ 50 real trackable fragments ≥10 cm. Collision probability ∝ density²." },
  collisions: { desc: "Cumulative collisions. Each destroys 2 objects and creates configurable fragments." },
  fragRate: { desc: "Collisions in last 15 sim-years. Above 8 = critical, 20+ = runaway." },
  launches: { desc: "Satellites deployed/year. Multiple can launch per frame at high rates." },
  compliance: { desc: "% of retired sats that safely deorbit. Rest become debris." },
  cleanups: { desc: "Bulk cleanup ops/year. Each removes debris = efficiency setting." },
  efficiency: { desc: "Debris dots removed per cleanup operation." },
  fragments: { desc: "Debris dots per collision (each ≈ 50 real pieces). At 40 dots = ~2000 real fragments (Iridium–Cosmos scale). At 200 = catastrophic hypervelocity event." },
  speed: { desc: "Time multiplier. At 10× one year passes in ~1.2 seconds." },
};

export const DEFAULT_CFG = { launches: 2400, compliance: 80, speed: 0.4, cleanups: 0, efficiency: 0, fragments: 40 };

export const SCENARIOS = [
  { id: "today", label: "Today", cfg: { launches: 2400, compliance: 80, cleanups: 0, efficiency: 0, fragments: 40 } },
  { id: "boom", label: "Mega-constellations", cfg: { launches: 6000, compliance: 60, cleanups: 0, efficiency: 0, fragments: 40 } },
  { id: "cleanup", label: "Active cleanup", cfg: { launches: 3000, compliance: 95, cleanups: 12, efficiency: 30, fragments: 40 } },
];

export function createSim() {
  const objs = [];
  for (let i = 0; i < 80; i++) objs.push(mk("l"));
  for (let i = 0; i < 20; i++) objs.push(mk("m"));
  for (let i = 0; i < 15; i++) objs.push(mk("g"));
  for (let i = 0; i < 30; i++) objs.push(mk("d"));
  return {
    objs, t: 0, cols: 0, recentCols: [], lastClean: 0, launchAccum: 0,
    hist: [{ y: 2026, s: 115, d: 30, c: 0 }, { y: 2026, s: 115, d: 30, c: 0 }],
    lastHistT: 0,
    stats: { year: 2026, sats: 115, debris: 30, collisions: 0, fragRate: 0, cascade: 0 },
    statAccum: 0,
  };
}

function aliveCount(s) {
  let n = 0;
  for (let i = 0; i < s.objs.length; i++) if (s.objs[i].alive) n++;
  return n;
}

function collide(s, a, b, cfg, events) {
  a.alive = false; b.alive = false;
  s.cols++; s.recentCols.push(s.t);
  const pos = p3(a, [0, 0, 0]);
  const aliveN = aliveCount(s);
  const nd = Math.min(cfg.fragments + Math.floor(Math.random() * 4), MAX_DOTS - aliveN);
  const baseAlt = a.alt || (LEO_MIN + Math.random() * (LEO_MAX - LEO_MIN));
  for (let k = 0; k < Math.max(0, nd); k++) {
    const dd = mk("d", baseAlt + (Math.random() - .5) * 500);
    dd.phase = a.phase + (Math.random() - .5) * .6; dd.speed *= (.4 + Math.random() * 1.2);
    dd.born = s.t;
    s.objs.push(dd);
  }
  events.push({ type: "collision", pos });
}

export function doASAT(s, cfg, events) {
  const tgts = s.objs.filter(o => o.alive && o.type !== "d");
  if (!tgts.length) return;
  const t = tgts[Math.floor(Math.random() * tgts.length)];
  t.alive = false;
  const pos = p3(t, [0, 0, 0]);
  const aliveN = aliveCount(s);
  const n = Math.min(cfg.fragments + 10, MAX_DOTS - aliveN);
  for (let i = 0; i < Math.max(0, n); i++) {
    const d = mk("d", t.alt + (Math.random() - .5) * 600);
    d.phase = t.phase + (Math.random() - .5) * .8; d.speed *= (.4 + Math.random() * 1.2);
    d.born = s.t;
    s.objs.push(d);
  }
  s.cols++; s.recentCols.push(s.t);
  events.push({ type: "asat", pos });
}

// dt: real seconds elapsed (already clamped by caller). Refresh-rate independent:
// v1 stepped 0.016 * speed per rAF frame (≈60 fps), so simDt = dt * speed keeps
// identical rates on any display.
export function step(s, cfg, dt, events) {
  const simDt = dt * cfg.speed;
  s.t += simDt;

  for (let i = 0; i < s.objs.length; i++) { if (s.objs[i].alive) s.objs[i].phase += s.objs[i].speed * simDt; }

  // Launches: accumulator handles high rates properly
  const aliveN = aliveCount(s);
  s.launchAccum += (cfg.launches / SIM_YEAR) * simDt;
  const toLaunch = Math.floor(s.launchAccum);
  s.launchAccum -= toLaunch;
  for (let i = 0; i < Math.min(toLaunch, MAX_DOTS - aliveN); i++) {
    const tp = Math.random();
    s.objs.push(mk(tp < .7 ? "l" : tp < .9 ? "m" : "g"));
  }

  // Retirement ~8%/year
  const retireRate = (0.08 / SIM_YEAR) * simDt;
  for (let i = 0; i < s.objs.length; i++) {
    const o = s.objs[i];
    if (!o.alive || o.type === "d") continue;
    if (Math.random() < retireRate) {
      o.alive = false;
      if (Math.random() * 100 > cfg.compliance) {
        const d = mk("d", o.alt + (Math.random() - .5) * 100);
        d.phase = o.phase; d.born = s.t; s.objs.push(d);
      }
    }
  }

  // Cleanups
  const cInt = cfg.cleanups > 0 ? (SIM_YEAR / cfg.cleanups) : Infinity;
  if (s.t - s.lastClean > cInt && cfg.cleanups > 0) {
    s.lastClean = s.t;
    let rem = 0;
    for (let i = s.objs.length - 1; i >= 0 && rem < cfg.efficiency; i--) {
      if (s.objs[i].alive && s.objs[i].type === "d") { s.objs[i].alive = false; rem++; }
    }
  }

  // Collision model
  const alive = [];
  let leoN = 0, meoN = 0;
  for (let i = 0; i < s.objs.length; i++) {
    if (s.objs[i].alive) {
      alive.push(s.objs[i]);
      if (s.objs[i].r < 95) leoN++;
      else if (s.objs[i].r < 135) meoN++;
    }
  }
  const an = alive.length;
  const pa = [0, 0, 0], pb = [0, 0, 0];

  // Geometric proximity
  const geomChecks = Math.min(80, an * (an - 1) / 2);
  for (let ch = 0; ch < geomChecks; ch++) {
    const i = Math.floor(Math.random() * an);
    let j = Math.floor(Math.random() * (an - 1)); if (j >= i) j++;
    const a = alive[i], b = alive[j];
    if (!a.alive || !b.alive || Math.abs(a.r - b.r) > 10) continue;
    p3(a, pa); p3(b, pb);
    if ((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2 < 49) collide(s, a, b, cfg, events);
  }

  // Statistical density² collision model (LEO)
  const leoDensity = leoN / 80;
  const leoColProb = (leoDensity * leoDensity * 0.25 / SIM_YEAR) * simDt;
  if (Math.random() < leoColProb && leoN >= 2) {
    const leoObjs = alive.filter(o => o.alive && o.r < 95);
    if (leoObjs.length >= 2) {
      const i = Math.floor(Math.random() * leoObjs.length);
      let j = Math.floor(Math.random() * (leoObjs.length - 1)); if (j >= i) j++;
      if (leoObjs[i].alive && leoObjs[j].alive) collide(s, leoObjs[i], leoObjs[j], cfg, events);
    }
  }

  // MEO statistical
  const meoDensity = meoN / 80;
  const meoProb = (meoDensity * meoDensity * 0.08 / SIM_YEAR) * simDt;
  if (Math.random() < meoProb && meoN >= 2) {
    const meoObjs = alive.filter(o => o.alive && o.r >= 95 && o.r < 135);
    if (meoObjs.length >= 2) {
      const i = Math.floor(Math.random() * meoObjs.length);
      let j = Math.floor(Math.random() * (meoObjs.length - 1)); if (j >= i) j++;
      if (meoObjs[i].alive && meoObjs[j].alive) collide(s, meoObjs[i], meoObjs[j], cfg, events);
    }
  }

  // Compaction (time-based; v1 did every 90 frames)
  s.compactAccum = (s.compactAccum || 0) + dt;
  if (s.compactAccum > 1.5) { s.compactAccum = 0; s.objs = s.objs.filter(o => o.alive); }
  s.recentCols = s.recentCols.filter(t2 => s.t - t2 < 5 * SIM_YEAR);

  // Stats + history (time-based; v1 did every 8 frames)
  s.statAccum += dt;
  if (s.statAccum >= 0.13) {
    s.statAccum = 0;
    let sats = 0, deb = 0;
    for (let i = 0; i < s.objs.length; i++) { if (!s.objs[i].alive) continue; s.objs[i].type === "d" ? deb++ : sats++; }
    const rate = s.recentCols.length;
    const year = Math.floor(2026 + s.t / SIM_YEAR);

    // Cascade: consider both collision rate AND debris trend
    const h = s.hist;
    const debrisGrowing = h.length >= 3 ? deb > h[h.length - 3].d : deb > 30;
    let cascade = 0;
    if (debrisGrowing && rate > 20) cascade = 3;       // RUNAWAY
    else if (debrisGrowing && rate > 6) cascade = 2;   // Critical
    else if (rate > 3) cascade = 1;                    // Building
    else cascade = 0;                                  // Stable

    s.stats = { year, sats, debris: deb, collisions: s.cols, fragRate: rate, cascade };

    const histInterval = SIM_YEAR * 0.5;
    if (s.t - s.lastHistT >= histInterval) {
      s.lastHistT = s.t;
      s.hist = [...s.hist.slice(-80), { y: year, s: sats, d: deb, c: s.cols }];
    }
  }
}
