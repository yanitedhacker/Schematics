const D = __DATA__;
const root = document.querySelector(".lc");
const stage = root.querySelector(".lc-stage");
const cells = [...stage.querySelectorAll(".lc-cell")];
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live-region]");
const runButton = root.querySelector("[data-run]");
const runLabel = root.querySelector("[data-run-label]");
const partButtons = [...root.querySelectorAll(".lc-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = cells.flatMap((cell) => [...cell.querySelectorAll(".it")].map((el) => ({ el, cell }))).map(({ el, cell }) => ({
  el,
  cell,
  piece: el.dataset.piece,
  ride: el.dataset.ride || el.dataset.piece,
  live: el.dataset.live || null,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
for (const node of nodes) node.lift = dot(node.m, D.V);
let order = nodes.map((_, index) => index);

const IDS = Object.keys(D.pieces);
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const screen = (v) => [D.EX[0] * v[0] + D.EY[0] * v[1] + D.EZ[0] * v[2], D.EX[1] * v[0] + D.EY[1] * v[1] + D.EZ[1] * v[2]];

// live sub-assemblies: world offsets from their rest pose, written by the process model each frame
const groups = { chuckA: [0, 0, 0], chuckB: [0, 0, 0], reticle: [0, 0, 0], wafer: [0, 0, 0], trackRobot: [0, 0, 0], shuttle: [0, 0, 0], hoistFoup: [0, 0, 0], hoistBelts: [0, 0, 0] };
// belts stretch rather than move: a screen-y scale about their drum line
const BELT_STRETCH = { s: 1 };

let clock = 0;
let apart = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = -1;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function announce(text) {
  if (liveRegion && liveRegion.textContent !== text) liveRegion.textContent = text;
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? D.stagger : [...D.stagger].reverse()) {
    if (!piece[id]) continue;
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  run();
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuetext", id ? D.pieces[id].say : apart ? "apart" : "assembled");
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

let lastSort = -1;
function place() {
  for (const node of nodes) {
    const share = piece[node.ride].x;
    const g = node.live ? groups[node.live] || [0, 0, 0] : null;
    const w = [node.m[0] * share + (g ? g[0] : 0), node.m[1] * share + (g ? g[1] : 0), node.m[2] * share + (g ? g[2] : 0)];
    const [tx, ty] = screen(w);
    let text = Math.abs(tx) < 0.005 && Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (node.live === "hoistBelts" && HOIST && Math.abs(BELT_STRETCH.s - 1) > 1e-4) {
      const yt = node.beltTop ?? (node.beltTop = node.el.getBBox().y);   // each belt scales about its own drum line
      text += ` translate(0 ${yt.toFixed(2)}) scale(1 ${BELT_STRETCH.s.toFixed(4)}) translate(0 ${(-yt).toFixed(2)})`;
    }
    if (text !== node.shown) {
      node.shown = text;
      // a CSS transform is a style-only change; the transform attribute would re-lay out the whole SVG every frame
      node.el.style.transform = text ? text.replace(/translate\(([-\d.]+) ([-\d.]+)\)/g, "translate($1px,$2px)").replace(/scale\(1 ([-\d.]+)\)/, "scale(1,$1)") : "";
    }
    node.depth = node.key + node.lift * share + (g ? dot(g, D.V) : 0);
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].depth - nodes[b].depth);
  // re-ordering the SVG costs ~25 ms on a page this size: every frame while assemblies fly apart, but only every 150 ms
  // while the run moves the live sub-assemblies, which drift slowly relative to their neighbours
  const exploding = IDS.some((id) => piece[id].x !== piece[id].target || piece[id].pending || (piece[id].x > 0 && piece[id].x < 1));
  const due = exploding || clock - lastSort >= 0.15;
  if (due && next.some((index, at) => index !== order[at])) {
    lastSort = clock;
    // move only what changed: keep the longest run already in order (LIS), insert the rest before their successor
    for (const cell of cells) {
      const want = next.filter((index) => nodes[index].cell === cell);
      const rank = new Map(want.map((index, r) => [index, r]));
      const have = [...cell.children].map((el) => rank.get(Number(el.dataset.i)));
      const tails = [], prev = new Array(have.length).fill(-1), tailIdx = [];
      have.forEach((r, i) => {
        let lo = 0, hi = tails.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < r) lo = mid + 1; else hi = mid; }
        tails[lo] = r; tailIdx[lo] = i; prev[i] = lo ? tailIdx[lo - 1] : -1;
      });
      const keep = new Set();
      for (let i = tailIdx[tails.length - 1]; i !== undefined && i >= 0; i = prev[i]) keep.add(have[i]);
      for (let r = want.length - 1; r >= 0; r--) {
        if (keep.has(r)) continue;
        const el = nodes[want[r]].el;
        const after = r + 1 < want.length ? nodes[want[r + 1]].el : null;
        cell.insertBefore(el, after);
      }
    }
    order = next;
  }
}

/* ---------- the process model: twin-stage cycle ----------
   One chuck exposes at the lens while the other is measured, then they swap. Times are the real ones
   (D.facts) slowed by SLOW so the eye can follow; the readout says so. */
const F = D.facts;
const SLOW = 2;                                       // shown 2x slower than real
const EXPOSE = D.optic.wafer;
const MEASURE = D.measure;
const ST = (D.shared && D.shared.stages) || { chuckA: MEASURE, chuckB: EXPOSE };
const restOf = { chuckA: ST.chuckA, chuckB: ST.chuckB };
const FIELDS = (() => {
  const list = [];
  const fw = F.field_mm[0] / 10;                       // cross-scan, world y
  const fh = F.field_mm[1] / 10;                       // scan, world x
  const r = 15 - 0.3;
  // offset half a field across the scan and keep every field that touches the wafer: 96, ASML's throughput layout
  for (let j = -7; j <= 7; j++) {
    const row = [];
    for (let i = -6; i <= 6; i++) {
      const cx = i * fh;
      const cy = j * fw + fw / 2;
      const far = Math.hypot(Math.abs(cx) + fh / 2, Math.abs(cy) + fw / 2);
      const near = Math.hypot(Math.max(0, Math.abs(cx) - fh / 2), Math.max(0, Math.abs(cy) - fw / 2));
      if (near < r && far > 0) row.push([cx, cy]);
    }
    if (j % 2) row.reverse();
    list.push(...row);
  }
  return list;
})();
const proc = { on: false, phase: "idle", t: 0, field: 0, fields: 0, wafers: 0, exposing: "A", source: { x: 0, v: 0 }, sourceOn: 0, scanV: 0 };
const SCAN_S = (F.scan_ms_per_field / 1000) * SLOW;    // one field scan
const STEP_S = 0.06 * SLOW;                            // step to the next field (ESTIMATED, not published)
const FIELD_S = SCAN_S + STEP_S;
const SWAP_S = 1.2 * SLOW * 0.5;                       // swap time UNVERIFIED; shown at 2.4 s
const MEASURE_S = FIELDS.length * FIELD_S;             // measure runs in the shadow of the exposure

function chuckPose(id, swapK) {
  // swapK 0: A at measure, B at expose; 1: A at expose, B at measure. They pass offset in y. Offsets are from each rest pose.
  const k = 0.5 - 0.5 * Math.cos(Math.PI * swapK);
  const lane = Math.sin(Math.PI * swapK) * 18;   // chuck bodies are held to |dy| <= 17 (stages module)
  const kk = id === "chuckA" ? k : 1 - k;
  const at = [MEASURE[0] + (EXPOSE[0] - MEASURE[0]) * kk, MEASURE[1] + (EXPOSE[1] - MEASURE[1]) * kk + (id === "chuckA" ? lane : -lane), 0];
  const rest = restOf[id];
  return [at[0] - rest[0], at[1] - rest[1], 0];
}

function startRun() {
  if (proc.on) return;
  setApart(false);
  select(null);
  proc.on = true;
  proc.phase = "arming";
  proc.t = 0;
  runButton && runButton.setAttribute("data-state", "armed");
  announce("arming");
}
function stopRun() {
  proc.on = false;
  proc.phase = "stopping";
  runButton && runButton.removeAttribute("data-state");
}

let swapAt = Math.abs(ST.chuckA[0] - EXPOSE[0]) < 5 ? 1 : 0;  // 1 when chuck A is at the lens

/* ---------- the wafer's journey: FOUP -> track (coat, bake, chill) -> interface -> load lock -> measure chuck ----------
   It runs alongside the exposure, so the next wafer arrives as the stages swap. The moving disc is the loadport's
   "current wafer"; on arrival it hides and the measure chuck's own wafer stands for it. */
const SH = D.shared || {};
const START = SH.waferStart || null;
const ROUTE = START && SH.waferPath ? [START, ...(SH.waferPath.track || []), ...(SH.waferPath.interface || [])] : null;
const routeLen = [];
if (ROUTE) { routeLen.push(0); for (let i = 1; i < ROUTE.length; i++) routeLen.push(routeLen[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1], ROUTE[i][2] - ROUTE[i - 1][2])); }
const ROUTE_TOTAL = ROUTE ? routeLen[routeLen.length - 1] : 1;
function along(d) {
  if (!ROUTE) return [0, 0, 0];
  let i = 1;
  while (i < routeLen.length - 1 && routeLen[i] < d) i++;
  const t = Math.max(0, Math.min(1, (d - routeLen[i - 1]) / Math.max(1e-6, routeLen[i] - routeLen[i - 1])));
  const a = ROUTE[i - 1], b = ROUTE[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const waferEls = nodes.filter((n) => n.live === "wafer").map((n) => n.el);
const beltEls = nodes.filter((n) => n.live === "hoistBelts").map((n) => n.el);
const HOIST = SH.hoist || null;
function stepJourney(k) {
  // k 0..1 over one exposure: the hoist lowers in the first 12%, the wafer travels from 10% to 95%
  const hk = Math.max(0, Math.min(1, k / 0.12));
  const he = 0.5 - 0.5 * Math.cos(Math.PI * hk);
  if (HOIST) {
    const dz = HOIST.seat - HOIST.foupBase;
    groups.hoistFoup = [0, 0, dz * he];
    const rest = HOIST.beltTop - HOIST.beltBottom;
    BELT_STRETCH.s = (rest - dz * he) / rest;
  }
  if (!ROUTE) return;
  const wk = Math.max(0, Math.min(1, (k - 0.1) / 0.85));
  const pos = along(ROUTE_TOTAL * wk);
  groups.wafer = [pos[0] - START[0], pos[1] - START[1], pos[2] - START[2]];
  const hidden = wk >= 1;
  for (const el of waferEls) el.style.visibility = hidden ? "hidden" : "";
  // the transfer robot traverses with the wafer while it is in the carrier block, the coat-layer shuttle in its corridor
  const tr = SH.trackRail || null;
  groups.trackRobot = [Math.max(-70, Math.min(70, pos[0] - (ROUTE[1] ? ROUTE[1][0] : pos[0]))) * (pos[0] < -440 ? 1 : 0), 0, 0];
  groups.shuttle = [pos[2] > 150 && pos[2] < 158 && pos[0] > -260 && pos[0] < -180 ? pos[0] - (-220) : 0, 0, 0];
}
function resetJourney() {
  groups.wafer = [0, 0, 0];
  groups.trackRobot = [0, 0, 0];
  groups.shuttle = [0, 0, 0];
  groups.hoistFoup = [0, 0, 0];
  BELT_STRETCH.s = 1;
  for (const el of waferEls) el.style.visibility = "";
}
function stepProcess(dt, calm) {
  const target = proc.on && proc.phase === "expose" ? 1 : 0;
  const moving = settle(proc.source, target, dt, 0.4, calm);
  proc.sourceOn = proc.source.x;
  if (proc.phase === "idle") return moving;
  if (proc.phase === "arming") {
    const settled = IDS.every((id) => piece[id].x === 0 && !piece[id].pending);
    if (settled) { proc.phase = "expose"; proc.t = 0; proc.field = 0; announce("exposing"); }
    return true;
  }
  if (proc.phase === "stopping") {
    // finish the current field then park
    proc.phase = "idle";
    resetJourney();
    for (const id of ["chuckA", "chuckB"]) groups[id] = chuckPose(id, swapAt);
    groups.reticle = [0, 0, 0];
    announce("idle");
    return true;
  }
  proc.t += dt;
  const atLens = swapAt ? "chuckA" : "chuckB";
  const atSensor = swapAt ? "chuckB" : "chuckA";
  if (proc.phase === "expose") {
    const i = Math.min(FIELDS.length - 1, Math.floor(proc.t / FIELD_S));
    const u = (proc.t - i * FIELD_S) / FIELD_S;
    const scanning = u < SCAN_S / FIELD_S;
    const dir = i % 2 ? 1 : -1;
    const [fx, fy] = FIELDS[i];
    const s = scanning ? (u / (SCAN_S / FIELD_S) - 0.5) * ((F.field_mm[1] + 2) / 10) * dir : 0.5 * ((F.field_mm[1] + 2) / 10) * dir;
    const base = chuckPose(atLens, swapAt);
    groups[atLens] = [base[0] - fx - s, base[1] - fy, 0];
    groups.reticle = [F.reduction * s, 0, 0];
    proc.scanV = scanning ? F.wafer_scan_ms : 0;
    // the other chuck sweeps its wafer under the sensors in the shadow of the exposure
    const m = proc.t / MEASURE_S;
    const sb = chuckPose(atSensor, swapAt);
    groups[atSensor] = [sb[0] + 12 * Math.sin(m * Math.PI * 6), sb[1] + 10 * Math.sin(m * Math.PI * 2), 0];
    proc.field = i + 1;
    stepJourney(proc.t / (FIELDS.length * FIELD_S));
    if (proc.t >= FIELDS.length * FIELD_S) { proc.phase = "swap"; proc.t = 0; proc.fields = FIELDS.length; announce("swapping stages"); }
    return true;
  }
  if (proc.phase === "swap") {
    groups.reticle = [0, 0, 0];
    proc.scanV = 0;
    const k = Math.min(1, proc.t / SWAP_S);
    const sk = swapAt ? 1 - k : k;
    groups.chuckA = chuckPose("chuckA", sk);
    groups.chuckB = chuckPose("chuckB", sk);
    if (k >= 1) {
      resetJourney();
      swapAt = swapAt ? 0 : 1;
      proc.wafers++;
      proc.t = 0;
      if (proc.on) { proc.phase = "expose"; announce("exposing"); }
      else proc.phase = "idle";
    }
    return true;
  }
  return moving;
}

function processText() {
  const speed = `shown ${SLOW}x slower`;
  if (proc.phase === "arming") return "closing up · arming";
  if (proc.phase === "expose") return `field ${proc.field}/${FIELDS.length} · wafer ${proc.scanV.toFixed(2)} m/s, reticle ${(proc.scanV * F.reduction).toFixed(1)} m/s · ${speed}`;
  if (proc.phase === "swap") return `stages swap · wafer ${proc.wafers + 1} done`;
  return null;
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "taking apart" : "closing up";
  return apart ? `apart · ${D.order.length} assemblies` : `${F.wavelength_nm} nm · NA ${F.na} · ${F.wph} wafers/h`;
}

/* ---------- tour ---------- */
const TOUR_STEP = 1.6;
function tourAt(time) {
  const apartFrom = 0.4;
  const listFrom = apartFrom + 1.2;
  const listTo = listFrom + D.order.length * TOUR_STEP;
  if (time < apartFrom) return { apart: false, part: null, run: false };
  if (time < listFrom) return { apart: true, part: null, run: false };
  if (time < listTo) return { apart: true, part: D.order[Math.floor((time - listFrom) / TOUR_STEP)], run: false };
  return { apart: false, part: null, run: true };
}
function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || proc.on) return quietTour();
    touring = !still.matches;
    tourClock = -0.6;
    run();
  }, 3600);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring && !proc.on) {
    tourClock += dt;
    const step = tourAt(tourClock);
    setApart(step.apart);
    select(step.part);
    if (step.run) { touring = false; startRun(); }
  }
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  const working = stepProcess(dt, calm);
  if (window.__lcFrame) window.__lcFrame(proc, groups, clock);
  place();
  say(processText() || idleText());
  frame = visible && (moving || working || touring || proc.on) ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  if (!proc.on) setApart(true);
  select(pieceAt(event));
  run();
});
stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    setApart(false);
  }, 260);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  quietTour();
  const id = pieceAt(event);
  if (!id || id === "stand") { select(null); if (!proc.on) setApart(!apart); }
  else { if (!proc.on) setApart(true); select(id); }
  run();
});
runButton && runButton.addEventListener("click", () => {
  quietTour();
  if (proc.on) stopRun();
  else startRun();
  run();
});
partButtons.forEach((button) => {
  const show = () => { quietTour(); clearTimeout(leaveTimer); if (!proc.on) setApart(true); select(button.dataset.part); run(); };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(false);
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});
stage.addEventListener("keydown", (event) => {
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") { event.preventDefault(); quietTour(); if (proc.on) stopRun(); select(null); setApart(false); run(); return; }
  else if (event.key === "Enter" || event.key === "r" || event.key === "R") { event.preventDefault(); quietTour(); if (proc.on) stopRun(); else startRun(); run(); return; }
  else if (event.key === " ") { event.preventDefault(); quietTour(); if (!proc.on) setApart(!apart); if (!apart) select(null); run(); return; }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  if (!proc.on) setApart(true);
  select(D.order[next]);
  run();
});
stage.addEventListener("focus", () => announce(proc.on ? proc.phase : "idle"));
if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 520px)");
const hintEl = root.querySelector(".lc-hint");
const wording = () => hintEl && (hintEl.textContent = narrow.matches ? "Tap to take apart" : "Hover the cell to take it apart");
wording();
narrow.addEventListener("change", wording);
for (const id of ["chuckA", "chuckB"]) groups[id] = chuckPose(id, swapAt);
place();
say(idleText());
