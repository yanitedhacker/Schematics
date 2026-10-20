import { mountEvidence, showObjectDimensions, updateScaleHUD } from "./evidence-ui.js";
import { SolidView } from "./three-view.js";
import { Process, REFERENCE, FIELDS, JOURNEY, CYCLE, EXPOSURE, SCAN, STEP, SWAP } from "./process.js";
import { Renderer } from "./renderer.js";
const setText = (e, t) => {
  if (e.textContent !== t) e.textContent = t;
};
const $ = (id) => document.getElementById(id);
async function load(url) {
  const inline = document.querySelector(`script[data-asset="${url}"]`);
  if (inline) {
    const s = atob(inline.textContent.trim()),
      a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return new Response(a);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("Cannot load local asset " + url + " (" + response.status + ")");
  return response;
}
const [meta, data] = await Promise.all(
  ["data/mesh-meta.json", "data/reference-data.json"].map((u) => load(u).then((r) => r.json())),
).catch((e) => {
  $("loading").textContent = `Cannot start the model: ${e.message}`;
  throw e;
});
mountEvidence();
const SOURCE = {
  asml: "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3800e",
  light: "https://www.asml.com/en/technology/lithography-principles/light-and-lasers",
  optics:
    "https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html",
};
const INFO = {
  oht: [
    "Overhead hoist",
    "Transfers a closed wafer carrier to the load port. The carrier moves; individual wafers remain enclosed during this transfer.",
    "FOUP capacity: 25 wafers. Hoist geometry: derived.",
    "DERIVED",
    SOURCE.asml,
  ],
  loadport: [
    "FOUP and load port",
    "Docks the sealed carrier. A wafer handler transfers wafers into the track.",
    "300 mm wafer. Port layout: schematic.",
    "SCHEMATIC",
    SOURCE.asml,
  ],
  track: [
    "Coater / developer track",
    "Coats the wafer, bakes and cools the resist, then receives it after exposure for post-exposure bake, cooling and development.",
    "The full route is shown. Station dwell times are illustrative.",
    "SCHEMATIC",
    SOURCE.asml,
  ],
  interface: [
    "Interface and load locks",
    "Transfers wafers between the track and the scanner vacuum environment.",
    "Pump-down and venting are process steps; exact timing is not claimed.",
    "SCHEMATIC",
    SOURCE.asml,
  ],
  utility: [
    "Pumps, gas and power",
    "Supports vacuum, cooling, gas flow and electrical services.",
    "Service arrangement and component dimensions: derived.",
    "DERIVED",
    SOURCE.optics,
  ],
  source: [
    "Tin plasma source",
    "A pre-pulse flattens a tin droplet. A main pulse makes EUV-emitting plasma. The collector directs the light to the intermediate focus.",
    "General source reference: 25 µm droplets, 70 m/s, 50,000/s. These are not a verified 3800E source recipe.",
    "REFERENCE",
    SOURCE.light,
  ],
  illum: [
    "Illuminator",
    "Field and pupil facets shape illumination before the reflective mask. The drawn rays follow the shared mirror centres.",
    "Mirror placement is derived. The ray bundle does not calculate imaging.",
    "DERIVED",
    SOURCE.optics,
  ],
  reticle: [
    "Reticle stage and mask",
    "The reflective mask moves during each scan. For 4× reduction, its scan speed is four times the wafer speed in the opposite direction.",
    "Nominal scan speeds: wafer 0.30 m/s; reticle 1.20 m/s. Acceleration is illustrative.",
    "REFERENCE / ESTIMATE",
    SOURCE.optics,
  ],
  pob: [
    "Projection optics",
    "Six reflective mirrors form a reduced image of the mask on the resist-coated wafer.",
    "13.5 nm · 0.33 NA · 4× reduction. Mirror positions are schematic.",
    "REFERENCE / DERIVED",
    SOURCE.optics,
  ],
  stages: [
    "Twin wafer stages",
    "One stage exposes a wafer while the other measures alignment and level. The stages exchange stations.",
    "96-field illustration · 1.2 s exchange estimate · 220 wph calibrated cycle.",
    "CALIBRATED / ESTIMATE",
    SOURCE.asml,
  ],
  frame: [
    "Scanner frame and skin",
    "Supports the isolated machine structures. The near side is cut away to reveal the process.",
    "Heights retained from the source drawing. Scanner length compressed about 2×.",
    "DERIVED",
    SOURCE.asml,
  ],
  beamline: [
    "Beam transport",
    "Carries the drive laser from the sub-fab toward the source. The red line is false colour.",
    "CO₂ laser wavelength: 10.6 µm. Local route and packaging: schematic.",
    "SCHEMATIC",
    SOURCE.light,
  ],
  laser: [
    "CO₂ drive laser",
    "Supplies the pulses that form the tin plasma. The laser itself does not emit EUV.",
    "Power depends on the machine configuration. No single power is assigned to this schematic.",
    "SCHEMATIC",
    SOURCE.light,
  ],
  stand: [
    "Fab floor and sub-fab",
    "Separates the cleanroom cell from equipment below. The cutaway exposes both levels.",
    "Structural and installation layout: derived.",
    "DERIVED",
    SOURCE.asml,
  ],
};
const order = [
  "oht",
  "loadport",
  "track",
  "interface",
  "utility",
  "source",
  "illum",
  "reticle",
  "pob",
  "stages",
  "frame",
  "beamline",
  "laser",
];
const proc = new Process(),
  still = matchMedia("(prefers-reduced-motion: reduce)");
let solid,
  solidMode = false,
  renderer,
  ready = false,
  visible = true,
  apart = 0,
  apartTarget = 0,
  selected = null,
  dirty = true,
  raf = 0,
  last = 0,
  lastUI = 0,
  speed = 1,
  benchmarking = false,
  forceRender = false,
  benchCancelled = false,
  lastReport = null;
const partButtons = new Map();
for (const [i, id] of order.entries()) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.part = id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span>${INFO[id][0]}`;
  b.addEventListener("click", () => inspectAssembly(id));
  $("parts").append(b);
  partButtons.set(id, b);
}
for (const [i, station] of JOURNEY.entries()) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.station = i;
  b.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span>${station.name}`;
  b.title = "Inspect this illustrated process step";
  b.addEventListener("click", () => {
    proc.stop();
    proc.time = i * 4;
    setApart(false);
    if (renderer) {
      renderer.mode = i < 4 || i >= 8 ? "track" : "optics";
      renderer.zoom = 1;
      renderer.pan = [0, 0];
      renderer.fitView();
    }
    select(i < 4 || i >= 8 ? "track" : "stages");
    refresh();
  });
  $("journey").append(b);
}
async function unpack(name) {
  const response = await load("assets/" + name + ".bin");
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}
function announce(text) {
  $("live").textContent = text;
}
function select(id) {
  selected = id;
  for (const [key, b] of partButtons) b.setAttribute("aria-pressed", String(id === key));
  if (renderer) renderer.selected = id ? meta.pieces.indexOf(id) : -1;
  if (solid) solid.uniforms.selectedPart.value = id ? Object.keys(solid.meta.pieces).indexOf(id) : -1;
  if (solidMode) {
    objectPage = 0;
    fillObjects();
  }
  const info = INFO[id];
  $("part-name").textContent = info ? info[0] : "The complete cell";
  $("part-description").textContent = info
    ? info[1]
    : "Select a component to inspect its function. Use the close views to see the optical path, wafer handling, and laser.";
  $("part-facts").textContent = info ? info[2] : "13.5 nm · 0.33 NA · 300 mm wafer · 26 × 33 mm field";
  $("part-tag").textContent = info ? info[3] : "SCHEMATIC";
  $("part-source").href = info ? info[4] : SOURCE.asml;
  $("clear-selection").hidden = !id;
  announce(info ? info[0] : "Selection cleared");
  refresh();
}
function setApart(on, dismiss = true) {
  if (solid?.referenceMode) return;
  if (dismiss) solid?.returnInspection(true);
  apartTarget = on ? 1 : 0;
  if (still.matches) apart = apartTarget;
  if (on) proc.stop();
  refresh();
}
function setView(view) {
  if (solid?.referenceMode) {
    switchMode(true, false).then(() => setView(view));
    return;
  }
  if (solidMode) {
    const part = { optics: "pob", track: "track", laser: "laser" }[view];
    if (part) {
      select(part);
      const o = solid.meta.objects.filter((o) => o.piece === part).sort((a, b) => b.radius - a.radius)[0];
      if (o) {
        chooseObject(o.id);
      }
    } else {
      solid.returnInspection(true);
      solid.home();
    }
    refresh();
    return;
  }
  if (!renderer) return;
  renderer.mode = view;
  renderer.zoom = 1;
  renderer.pan = [0, 0];
  renderer.fitView();
  if (view === "optics") $("show-optics").checked = true;
  refresh();
}
function zoom(by) {
  if (solidMode) {
    solid.camera.zoom = Math.max(0.15, Math.min(5000, solid.camera.zoom * by));
    solid.camera.updateProjectionMatrix();
    refresh();
    return;
  }
  if (!renderer) return;
  renderer.zoom = Math.max(0.7, Math.min(4, renderer.zoom * by));
  renderer.fitView();
  refresh();
}
function refresh() {
  dirty = true;
  if (ready && !raf && visible && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  updateUI();
}
function updateUI() {
  if (!ready) return;
  const s = proc.state();
  updateScaleHUD(solid);
  if (solid?.referenceMode) {
    setText($("status"), "Nominal size comparison · process motion stopped");
  }
  if (solidMode)
    setText(
      $("measure"),
      `3D · ${solid.canvas.width} × ${solid.canvas.height} px · DPR ${solid.dpr} · full geometry`,
    );
  $("run").classList.toggle("running", proc.running);
  $("run").querySelector("span").textContent = still.matches
    ? "Next field"
    : proc.running
      ? "Stop"
      : proc.time
        ? "Resume"
        : "Run wafers";
  $("assemble").setAttribute("aria-pressed", String(apartTarget === 0));
  $("explode").setAttribute("aria-pressed", String(apartTarget === 1));
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === renderer.mode)));
  if (!solid?.referenceMode)
    setText(
      $("status"),
      proc.time
        ? `${s.phase === "swap" ? "Stage exchange" : `Field ${s.field}/96 · ${s.phase}`} · ${s.wafers} wafers complete · ${speed === 1 ? "real-time scanner cycle" : `${1 / speed}× slower`}${proc.running ? "" : " · stopped"}`
        : `Ready · scanner cycle ${CYCLE.toFixed(3)} s · 220 wph reference`,
    );
  if (!solidMode)
    setText(
      $("measure"),
      `WebGL2 · ${renderer.canvas.width} × ${renderer.canvas.height} px · DPR ${renderer.dpr} · ${Math.round(renderer.zoom * 100)}% · ${renderer.detail === "auto" ? "Auto" : "Full"} detail`,
    );
  setText($("journey-current"), proc.time ? s.journey.name : "FOUP to FOUP");
  if (updateUI.journey !== (proc.time ? s.journey.index : -1)) {
    updateUI.journey = proc.time ? s.journey.index : -1;
    document.querySelectorAll("[data-station]").forEach((b, i) => {
      b.classList.toggle("current", i === updateUI.journey);
      b.setAttribute("aria-current", String(i === updateUI.journey));
    });
  }
  $("optical-labels").hidden =
    solidMode || renderer.mode !== "optics" || apart > 0.01 || !$("show-optics").checked;
  if (!$("optical-labels").hidden) {
    for (const [cls, p] of [
      ["mask-label", data.optic.reticle],
      ["slit-label", data.optic.wafer],
    ]) {
      const xy = renderer.project(p),
        view = renderer.view,
        e = document.querySelector("." + cls);
      e.style.left = `${((xy[0] - view[0]) / view[2]) * 100}%`;
      e.style.top = `${((xy[1] - view[1]) / view[3]) * 100}%`;
    }
  }
}
function frame(now) {
  raf = 0;
  if (!ready || !visible || document.hidden || (solidMode ? solid.lost : renderer.lost)) {
    last = 0;
    return;
  }
  const elapsed = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (proc.running && !still.matches) proc.advance(elapsed * speed);
  if (Math.abs(apart - apartTarget) > 0.0001) {
    apart += (apartTarget - apart) * (1 - Math.exp(-elapsed * 7));
    dirty = true;
  } else apart = apartTarget;
  const active = solidMode ? solid : renderer;
  active.setState(proc.state(), apart);
  if (solidMode) {
    solid.updateInspection(elapsed);
    updateInspectionPanel();
  }
  if (!window.lithoProfile?.skipDraw)
    active.draw({
      running: proc.running || proc.time > 0,
      optics: $("show-optics").checked && !window.lithoProfile?.skipEffects,
      route: $("show-route").checked,
      journey: JOURNEY,
    });
  dirty = false;
  if (now - lastUI > 180 && !window.lithoProfile?.skipUI) {
    updateUI();
    lastUI = now;
  }
  if (
    (proc.running && !still.matches) ||
    Math.abs(apart - apartTarget) > 0.0001 ||
    dirty ||
    forceRender ||
    (solidMode && solid.inspectionMoving)
  )
    raf = requestAnimationFrame(frame);
  else last = 0;
}
function run() {
  if (!ready || solid?.referenceMode) return;
  if (still.matches) {
    proc.start();
    proc.advance(SCAN + STEP);
    proc.stop();
    setApart(false, false);
    announce("Advanced one field");
  } else if (proc.running) {
    proc.stop();
    announce("Scanner stopped");
  } else {
    setApart(false, false);
    proc.start();
    announce("Scanner running");
  }
  refresh();
}
$("run").addEventListener("click", run);
$("reset").addEventListener("click", () => {
  solid?.returnInspection(true);
  proc.reset();
  setApart(false);
  select(null);
  announce("Process reset");
  refresh();
});
$("assemble").addEventListener("click", () => setApart(false));
$("explode").addEventListener("click", () => setApart(true));
$("clear-selection").addEventListener("click", () => {
  solid?.returnInspection();
  select(null);
});
$("detail").addEventListener("change", () => {
  renderer.detail = $("detail").value;
  renderer.fitView();
  refresh();
});
$("speed").addEventListener("change", () => {
  speed = +$("speed").value;
  refresh();
});
$("zoom-in").addEventListener("click", () => zoom(1.2));
$("zoom-out").addEventListener("click", () => zoom(1 / 1.2));
$("fit").addEventListener("click", () => {
  if (solidMode) {
    solid.returnInspection(true);
    solid.home();
    refresh();
    return;
  }
  if (!renderer) return;
  renderer.zoom = 1;
  renderer.pan = [0, 0];
  renderer.fitView();
  refresh();
});
for (const b of document.querySelectorAll("[data-view]"))
  b.addEventListener("click", () => setView(b.dataset.view));
for (const id of ["show-optics", "show-route"]) $(id).addEventListener("change", refresh);
document.querySelector(".stage-wrap").addEventListener("keydown", (e) => {
  if (["r", "R"].includes(e.key)) {
    e.preventDefault();
    run();
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (solidMode && solid.inspection.current) {
      closeInspection();
      return;
    }
    proc.stop();
    setApart(false);
    select(null);
  } else if (["e", "E"].includes(e.key)) {
    e.preventDefault();
    setApart(!apartTarget);
  } else if (["+", "="].includes(e.key)) {
    e.preventDefault();
    zoom(1.2);
  } else if (e.key === "-") {
    e.preventDefault();
    zoom(1 / 1.2);
  } else if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
    e.preventDefault();
    const i = order.indexOf(selected);
    select(order[(i + (e.key === "ArrowRight" ? 1 : order.length - 1) + order.length) % order.length]);
  }
});
let drag = null;
$("machine").addEventListener("pointerdown", (e) => {
  if (!ready) return;
  drag = { x: e.clientX, y: e.clientY, pan: [...renderer.pan], moved: false };
  if (e.pointerType === "mouse") $("machine").setPointerCapture(e.pointerId);
});
$("machine").addEventListener("pointermove", (e) => {
  if (!drag || e.pointerType !== "mouse") return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) drag.moved = true;
  if (drag.moved) {
    renderer.pan = [
      drag.pan[0] - (dx / renderer.cssWidth) * renderer.view[2],
      drag.pan[1] - (dy / renderer.cssHeight) * renderer.view[3],
    ];
    renderer.fitView();
    refresh();
  }
});
$("machine").addEventListener("pointerup", (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) {
    const p = renderer.pick(e.clientX, e.clientY);
    const part = meta.pieces[p];
    if (part) inspectAssembly(part);
    else select(null);
    refresh();
  }
});
$("machine").addEventListener("pointercancel", () => (drag = null));
new IntersectionObserver(
  (entries) => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (benchmarking) benchCancelled = true;
    } else refresh();
  },
  { rootMargin: "80px" },
).observe(document.querySelector(".stage-wrap"));
// The benchmark controls must not scroll the drawing outside the active viewport.
// When the benchmark starts, scroll the canvas into view first.
function suspend() {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    if (benchmarking) benchCancelled = true;
  } else refresh();
}
document.addEventListener("visibilitychange", suspend);
still.addEventListener("change", () => {
  proc.stop();
  apart = apartTarget;
  if (solid?.inspection.current) solid.inspection.settle();
  refresh();
});
function watchDensity() {
  const media = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
  media.addEventListener(
    "change",
    () => {
      if (renderer) renderer.resize(renderer.cssWidth, renderer.cssHeight);
      refresh();
      watchDensity();
    },
    { once: true },
  );
}
watchDensity();
window.addEventListener("resize", () => {
  if (renderer && renderer.dpr !== (devicePixelRatio || 1))
    renderer.resize(renderer.cssWidth, renderer.cssHeight);
  refresh();
});
window.litho = {
  get ready() {
    return ready;
  },
  get visible() {
    return visible && !document.hidden;
  },
  get report() {
    return lastReport;
  },
  get state() {
    return {
      time: proc.time,
      running: proc.running,
      apart,
      mode: solid?.referenceMode ? "scale" : solidMode ? "3d" : renderer?.mode,
      selected,
      ...proc.state(),
    };
  },
  get renderer() {
    return renderer;
  },
  get solid() {
    return solid;
  },
  get active() {
    return solidMode ? solid : renderer;
  },
  get geometry() {
    return { vertices: meta.uniqueVertices, triangles: meta.indices / 3, groups: meta.groups.length };
  },
};
try {
  const [vertices, indices] = await Promise.all([unpack("machine.vertices"), unpack("machine.indices")]);
  renderer = new Renderer($("machine"), meta, vertices, indices, data);
  renderer.onResize = refresh;
  renderer.onLoss = () => {
    proc.stop();
    benchCancelled = true;
    $("loading").hidden = false;
    $("loading").textContent = "The GPU context was lost. Reload this copy to restore the model.";
    $("run").disabled = true;
  };
  renderer.onRestore = () => location.reload();
  ready = true;
  $("loading").hidden = true;
  $("run").disabled = false;
  refresh();
} catch (e) {
  $("loading").textContent = `Cannot start the model: ${e.message}`;
  $("loading").hidden = false;
  console.error(e);
}

let solidReady = null,
  objectPage = 0,
  modeRequest = 0;
async function loadSolid() {
  if (solid) return solid;
  if (solidReady) return solidReady;
  solidReady = (async () => {
    const sm = await load("data/solid-meta.json").then((r) => r.json()),
      names = ["indices", "positions", "normals", "ids", "groups", "edges", "edgeids", "edgegroups"],
      values = await Promise.all(names.map((n) => unpack("solid." + n)));
    solid = new SolidView(
      $("solid-machine"),
      sm,
      Object.fromEntries(names.map((n, i) => [n, values[i]])),
      refresh,
    );
    solid.setEffects(data);
    solid.onPick = (id) => {
      if (solid.referenceMode) {
        if (id) {
          solid.referenceSelected = id;
          announce("Reference " + id);
        }
      } else chooseObject(id);
    };
    solid.onLoss = () => {
      proc.stop();
      $("loading").hidden = false;
      $("loading").textContent = "The 3D GPU context was lost. Reload this copy.";
    };
    return solid;
  })();
  return solidReady;
}
async function switchMode(on, reference = false) {
  const request = ++modeRequest;
  if (on) {
    $("loading").hidden = false;
    $("loading").textContent = "Preparing source solids…";
    await loadSolid();
  }
  if (request !== modeRequest) return;
  if (reference) proc.stop();
  solid?.returnInspection(true);
  solidMode = on;
  $("machine").hidden = on;
  $("solid-machine").hidden = !on;
  $("solid-tools").hidden = !on;
  $("objects-panel").hidden = !on || reference;
  $("reference-info").hidden = !reference;
  $("parts").hidden = reference;
  document.querySelector(".part-info").hidden = reference;
  $("dimensions-control").hidden = !on || reference;
  $("mode-3d").setAttribute("aria-pressed", on && !reference);
  $("mode-drawing").setAttribute("aria-pressed", !on);
  $("mode-scale").setAttribute("aria-pressed", reference);
  for (const id of ["run", "reset", "speed", "assemble", "explode", "show-optics", "show-route", "detail"])
    $(id).disabled = reference;
  document.querySelectorAll("[data-station]").forEach((b) => (b.disabled = reference));
  $("solid-home").textContent = reference ? "Show comparison" : "Show whole cell";
  document.querySelector(".stage-note").firstChild.textContent = reference
    ? "TRUE-SCALE SIZE REFERENCE "
    : "SCHEMATIC CUTAWAY ";
  document.querySelector(".stage-note span").textContent = reference
    ? "NOMINAL DIMENSIONS / SPACING ILLUSTRATIVE"
    : "HEIGHTS RETAINED / LENGTH COMPRESSED";
  if (solid) {
    solid.active = on;
    solid.controls.enabled = on;
    solid.setReference(on && reference);
    if (on) {
      solid.resize();
      if (!reference) fillObjects();
    }
    updateInspectionPanel();
  }
  $("loading").hidden = true;
  refresh();
}
function fillObjects() {
  const q = $("object-search").value.toLowerCase(),
    list = $("object-list"),
    match = solid.meta.objects.filter(
      (o) => (!selected || o.piece === selected) && o.name.toLowerCase().includes(q),
    );
  const pages = Math.max(1, Math.ceil(match.length / 60));
  objectPage = Math.min(objectPage, pages - 1);
  const fragment = document.createDocumentFragment();
  for (const o of match.slice(objectPage * 60, objectPage * 60 + 60)) {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.name;
    opt.selected = o.id === solid.selected;
    fragment.append(opt);
  }
  list.replaceChildren(fragment);
  $("object-search").placeholder = `${match.length} objects${selected ? " in " + selected : ""}`;
  $("object-page").textContent = `${objectPage + 1} / ${pages} · ${match.length} objects`;
  $("objects-prev").disabled = objectPage === 0;
  $("objects-next").disabled = objectPage === pages - 1;
}
function chooseObject(id) {
  if (!solid) return;
  solid.select(id);
  const o = solid.meta.objects[id];
  $("object-name").textContent = o ? o.name : "Select an object";
  showObjectDimensions(o);
  $("object-focus").disabled = !o;
  $("object-isolate").disabled = !o;
  if (o) {
    $("object-list").value = id;
    solid.inspect({ kind: "object", id }, still.matches);
    announce("Inspecting " + o.name);
  } else solid.returnInspection(still.matches);
  refresh();
}
async function inspectAssembly(id) {
  if (!INFO[id]) return;
  select(id);
  if (!solidMode) await switchMode(true);
  if (!solid || !solidMode || solid.referenceMode || selected !== id) return;
  solid.select(-1);
  solid.inspect({ kind: "assembly", id }, still.matches);
  refresh();
}
function describeObject(o) {
  const name = o.name.toLowerCase();
  if (/\.m[1-6](#|$)/.test(name))
    return "A projection mirror in the illustrated six-mirror optical train. Its surface shape and mount position are schematic.";
  if (/wafer/.test(name))
    return "A wafer-related source object. Its exact role is given by its source name; the component geometry is illustrative.";
  if (/actuator/.test(name))
    return "An actuator detail in the source drawing. Its stroke, control system and force are not specified.";
  if (/flexure/.test(name))
    return "A flexure support detail. Its stiffness, material and load limits are not specified.";
  if (/mount|seat|pillar|column|pedestal/.test(name))
    return "A support or mounting detail. The drawing does not specify structural loads or tolerances.";
  if (/wall|cover|skin|plate|panel/.test(name))
    return "An enclosure or plate detail. Cut surfaces show access to the machine interior; wall thickness is schematic.";
  if (/pipe|flange|hose|port/.test(name))
    return "A connection detail. Routing and packaging are illustrative; service ratings are not specified.";
  return (
    "This is a recorded source object in the " +
    INFO[o.piece][0].toLowerCase() +
    ". Its individual design specification is not available."
  );
}
function closeInspection() {
  solid?.returnInspection(still.matches);
  announce("Returning part to machine");
  refresh();
}
let panelSelection = null;
function updateInspectionPanel() {
  const m = solid.inspection,
    panel = $("inspection-panel"),
    s = m.current;
  if (!s || !solidMode || solid.referenceMode) {
    panel.hidden = true;
    panel.classList.remove("is-open");
    panel.inert = true;
    panelSelection = null;
    return;
  }
  if (panelSelection !== s) {
    panelSelection = s;
    const o = s.kind === "object" ? solid.meta.objects[s.id] : null,
      piece = o ? o.piece : s.id,
      info = INFO[piece];
    $("inspection-title").textContent = o
      ? o.name.split(".").slice(1).join(".").replace(/[-_]/g, " ")
      : info[0];
    $("inspection-subtitle").textContent = o
      ? info[0] + " / source object " + o.id
      : "Complete assembly / recorded source solids";
    $("inspection-kind").textContent = info[3];
    $("inspection-description").textContent = o ? describeObject(o) + " " + info[1] : info[1];
    $("inspection-facts").textContent = info[2];
    $("inspection-source").href = info[4];
    announce("Inspecting " + (o ? o.name : info[0]));
  }
  panel.hidden = false;
  const open = m.target === 1 && m.amount > 0.12;
  panel.classList.toggle("is-open", open);
  panel.inert = !open;
}
$("inspection-close").addEventListener("click", closeInspection);
$("inspection-return").addEventListener("click", closeInspection);
$("inspection-panel").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    closeInspection();
    $("solid-machine").focus({ preventScroll: true });
  }
});
$("mode-scale").addEventListener("click", () => switchMode(true, true));
$("show-dimensions").addEventListener("change", () => {
  solid.showDimensions = $("show-dimensions").checked;
  refresh();
});
for (const b of document.querySelectorAll("[data-ref-focus]"))
  b.addEventListener("click", () => solid.focusReference(b.dataset.refFocus));
$("mode-3d").addEventListener("click", () => switchMode(true));
$("mode-drawing").addEventListener("click", () => switchMode(false));
$("object-search").addEventListener("input", () => {
  objectPage = 0;
  fillObjects();
});
$("objects-prev").addEventListener("click", () => {
  objectPage--;
  fillObjects();
});
$("objects-next").addEventListener("click", () => {
  objectPage++;
  fillObjects();
});
$("object-list").addEventListener("change", () => chooseObject(+$("object-list").value));
$("object-focus").addEventListener("click", () => chooseObject(solid.selected));
$("object-isolate").addEventListener("click", () => {
  proc.stop();
  apartTarget = apart;
  solid.isolate(solid.selected);
  solid.focus(solid.selected);
});
$("assembly-isolate").addEventListener("click", () => {
  const p = selected || solid.meta.objects[solid.selected]?.piece;
  if (p) solid.isolate(Object.keys(solid.meta.pieces).indexOf(p), true);
});
$("object-all").addEventListener("click", () => {
  solid.isolate(-1);
  chooseObject(-1);
  select(null);
});
$("solid-home").addEventListener("click", () => {
  solid.returnInspection(true);
  if (!solid.referenceMode) solid.isolate(-1);
  solid.home();
  refresh();
});
for (const b of document.querySelectorAll("[data-angle]"))
  b.addEventListener("click", () => solid.preset(b.dataset.angle));
window.lithoProfile = {
  skipDraw: false,
  skipUI: false,
  skipEffects: false,
  continuous(on) {
    forceRender = on;
    refresh();
  },
  switchMode,
  selectObject: chooseObject,
  inspectAssembly,
  returnInspection: closeInspection,
};

if (ready) for (const id of ["mode-drawing", "mode-3d", "mode-scale"]) $(id).disabled = false;
