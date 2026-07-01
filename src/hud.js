// HUD: stat readouts, cascade banner, glow sparklines, info tooltips.
import { INFO } from "./sim.js";

const CASC_LABELS = ["Stable", "Building", "Critical", "RUNAWAY"];
const CASC_CLASS = ["c0", "c1", "c2", "c3"];

export function createHUD() {
  const el = {
    year: document.getElementById("st-year"),
    rate: document.getElementById("st-rate"),
    sats: document.getElementById("st-sats"),
    debris: document.getElementById("st-debris"),
    cascade: document.getElementById("cascade"),
    spS: document.getElementById("sp-s"),
    spD: document.getElementById("sp-d"),
    spC: document.getElementById("sp-c"),
    tip: document.getElementById("tip"),
    backend: document.getElementById("backend"),
  };

  const last = { year: null, rate: null, sats: null, debris: null, cascade: null, histLen: 0, histC: -1 };

  function drawSpark(canvas, hist, key, color) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (hist.length < 2) return;
    let min = Infinity, max = -Infinity;
    for (const p of hist) { const v = p[key]; if (v < min) min = v; if (v > max) max = v; }
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const pad = 6;
    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const x = (i / (hist.length - 1)) * w;
      const y = h - pad - ((hist[i][key] - min) / (max - min)) * (h - pad * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    // glow pass
    ctx.strokeStyle = color + "55";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function update(stats, hist) {
    if (stats.year !== last.year) { el.year.textContent = stats.year; last.year = stats.year; }
    if (stats.fragRate !== last.rate) { el.rate.textContent = stats.fragRate; last.rate = stats.fragRate; }
    if (stats.sats !== last.sats) { el.sats.textContent = stats.sats.toLocaleString(); last.sats = stats.sats; }
    if (stats.debris !== last.debris) { el.debris.textContent = stats.debris.toLocaleString(); last.debris = stats.debris; }
    if (stats.cascade !== last.cascade) {
      el.cascade.textContent = `Cascade: ${CASC_LABELS[stats.cascade]}`;
      el.cascade.className = CASC_CLASS[stats.cascade];
      last.cascade = stats.cascade;
    }
    const hc = hist.length ? hist[hist.length - 1].c : -1;
    if (hist.length !== last.histLen || hc !== last.histC) {
      last.histLen = hist.length; last.histC = hc;
      drawSpark(el.spS, hist, "s", "#4fd8ff");
      drawSpark(el.spD, hist, "d", "#ffb545");
      drawSpark(el.spC, hist, "c", "#ff6a5e");
    }
  }

  // --- tooltips (hover + tap) for anything with data-info ---
  let tipFor = null;
  function showTip(target) {
    const key = target.dataset.info;
    if (!key || !INFO[key]) return;
    el.tip.textContent = INFO[key].desc;
    el.tip.style.display = "block";
    const r = target.getBoundingClientRect();
    const tw = el.tip.offsetWidth, th = el.tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(x, innerWidth - tw - 8));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    el.tip.style.left = `${x}px`;
    el.tip.style.top = `${y}px`;
    tipFor = target;
  }
  function hideTip() { el.tip.style.display = "none"; tipFor = null; }

  document.addEventListener("pointerover", e => {
    const t = e.target.closest("[data-info]");
    if (t) showTip(t); else if (tipFor) hideTip();
  });
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest("[data-info]");
    if (t && t !== tipFor) showTip(t);
    else if (!t) hideTip();
  }, { capture: true });

  function setBackend(name) { el.backend.textContent = name; }

  return { update, setBackend };
}
