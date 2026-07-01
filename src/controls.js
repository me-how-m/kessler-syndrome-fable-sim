// Control drawer: scenario chips, parameter sliders (v1 parity), run/reset/ASAT.
import { SCENARIOS } from "./sim.js";

const SLIDERS = [
  { id: "launches", label: "Annual launches", min: 0, max: 6000, step: 50, fmt: v => v.toLocaleString() },
  { id: "compliance", label: "Deorbit compliance", min: 0, max: 100, step: 1, fmt: v => v + "%" },
  { id: "fragments", label: "Fragments / collision", min: 2, max: 200, step: 1, fmt: v => `${v} ≈${(v * 50).toLocaleString()}` },
  { id: "cleanups", label: "Clean-ups / year", min: 0, max: 24, step: 1, fmt: v => v },
  { id: "efficiency", label: "Clean-up efficiency", min: 0, max: 50, step: 1, fmt: v => v + " debris" },
  { id: "speed", label: "Speed", min: 0.1, max: 10, step: 0.1, fmt: v => v.toFixed(1) + "×" },
];

export function createControls(cfg, { onReset, onASAT, onRunToggle }) {
  const state = { running: true };

  // --- sliders ---
  const slidersEl = document.getElementById("sliders");
  const valueEls = {};
  for (const s of SLIDERS) {
    const wrap = document.createElement("div");
    wrap.className = "sl";
    wrap.innerHTML = `
      <div class="row">
        <span class="name">${s.label} <span class="info-i" data-info="${s.id}">i</span></span>
        <span class="val"></span>
      </div>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" aria-label="${s.label}" />`;
    const input = wrap.querySelector("input");
    const val = wrap.querySelector(".val");
    input.value = cfg[s.id];
    val.textContent = s.fmt(cfg[s.id]);
    input.addEventListener("input", () => {
      cfg[s.id] = Number(input.value);
      val.textContent = s.fmt(cfg[s.id]);
      setActiveChip(null);
    });
    valueEls[s.id] = { input, val, fmt: s.fmt };
    slidersEl.appendChild(wrap);
  }

  function syncSliders() {
    for (const s of SLIDERS) {
      valueEls[s.id].input.value = cfg[s.id];
      valueEls[s.id].val.textContent = valueEls[s.id].fmt(cfg[s.id]);
    }
  }

  // --- scenario chips ---
  const chipsEl = document.getElementById("chips");
  const chips = [];
  function setActiveChip(id) {
    for (const c of chips) c.el.classList.toggle("active", c.id === id);
  }
  for (const sc of SCENARIOS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = sc.label;
    b.addEventListener("click", () => {
      Object.assign(cfg, sc.cfg);
      syncSliders();
      setActiveChip(sc.id);
    });
    chipsEl.appendChild(b);
    chips.push({ id: sc.id, el: b });
  }
  setActiveChip("today");

  // --- buttons ---
  const runBtn = document.getElementById("btn-run");
  function setRunning(r) {
    state.running = r;
    runBtn.textContent = r ? "⏸ PAUSE" : "▶ RESUME";
    onRunToggle?.(r);
  }
  runBtn.addEventListener("click", () => setRunning(!state.running));
  document.getElementById("btn-reset").addEventListener("click", () => { onReset(); setActiveChip("today"); });
  document.getElementById("btn-asat").addEventListener("click", onASAT);

  // --- keyboard ---
  addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
    if (e.code === "Space") { e.preventDefault(); setRunning(!state.running); }
    else if (e.key === "r" || e.key === "R") { onReset(); setActiveChip("today"); }
    else if (e.key === "a" || e.key === "A") onASAT();
  });

  // --- drawer collapse ---
  const drawer = document.getElementById("drawer");
  const collapseBtn = document.getElementById("collapse");
  collapseBtn.addEventListener("click", () => {
    drawer.classList.toggle("collapsed");
    collapseBtn.textContent = drawer.classList.contains("collapsed") ? "▴" : "▾";
  });

  // --- fullscreen ---
  document.getElementById("fs-btn").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  return { state, syncSliders };
}
