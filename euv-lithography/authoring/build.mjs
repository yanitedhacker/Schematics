// Builds the EUV litho cell page.
//   node build.mjs                 full build, settled painter's keys
//   node build.mjs --light         light theme
//   node build.mjs --only=source   one or more assemblies (comma separated) plus the stand, for module work
//   node build.mjs --fast          skip A.settle (raw depth keys), for quick looks
//   node build.mjs --envelopes     draw each module's envelope as a faint outline, for layout
//   node build.mjs --audit         run the full audit after writing the page
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeLib, k, G, A } from "./lib.mjs";
import * as PLAN from "./plan.mjs";
import { kitScript, glScript } from "./scripts/inline-kit.mjs";
import { glCamera } from "./kit/gl.mjs";
import { FACTS, SOURCES, POB_TRANSMISSION } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const THEME = flag("light") ? "light" : "dark";
const ONLY = value("only") ? new Set(["stand", ...value("only").split(",")]) : null;
const OUT = value("out") || (THEME === "light" ? "litho-cell-light.html" : "litho-cell.html");

const { W, H, PIECES, STAGGER, SPRING } = PLAN;
const P = PLAN.project();
const L = makeLib(P, PIECES, { order: STAGGER, spring: SPRING });
const back = [];
const shared = {};   // modules publish data for neighbours and the page here (e.g. shared.pobMirrors)
const ctx = { ...PLAN, P, back, theme: THEME, solo: !!ONLY, shared };

const MODULES = ["stand", "laser", "beamline", "utility", "frame", "stages", "pob", "reticle", "illum", "source", "interface", "track", "loadport", "oht"];
const built = [];
for (const name of MODULES) {
  if (ONLY && !ONLY.has(name)) continue;
  const file = join(HERE, "parts", `${name}.mjs`);
  if (!existsSync(file)) continue;
  const mod = await import(pathToFileURL(file).href);
  const before = L.R.items.length;
  const t0 = Date.now();
  mod.build(L, ctx);
  built.push(`${name}:${L.R.items.length - before}`);
  if (Date.now() - t0 > 2000) console.log(`  ${name} took ${Date.now() - t0} ms`);
}

// assemblies that must move on another's spring (threaded parts), still highlighting as themselves
for (const item of L.R.items) {
  const host = PLAN.RIDES && PLAN.RIDES[item.piece];
  if (!host) continue;
  item.ride = host;
  item.move = PIECES[host].move;
  for (const shape of item.shapes || []) { shape.ride = host; shape.move = item.move; }
}
for (const list of [L.R.tubes, L.R.routes, L.R.solids]) for (const entry of list || []) {
  const host = PLAN.RIDES && PLAN.RIDES[entry.piece];
  if (host) { entry.ride = host; entry.move = PIECES[host].move; }
}

if (flag("envelopes"))
  for (const [name, e] of Object.entries(PLAN.ENV)) {
    const plan = { x: e.x, y: e.y, w: e.w, d: e.d, r: 0 };
    back.push(`<g data-env="${name}">${L.Ln(k.planOutline(plan, e.z0, P, 2) + k.planOutline(plan, e.z1, P, 2) + k.corners(plan, 0).map(([x, y]) => k.rise([x, y], e.z0, e.z1, P)).join(""), { tone: "faint", dashed: true })}</g>`);
  }

const t0 = Date.now();
// --quick settles on the uniform and prefix explode states only (iteration); the default replays every spring frame
const LITE_FRAMES = () => [...A.prefixStates(STAGGER), ...A.springStates(STAGGER, { ...SPRING, stride: 6 })];
if (!flag("fast")) A.settle(L.R, P, flag("audit-lite") || flag("lite") ? { states: [...A.uniformStates(10), ...LITE_FRAMES()] } : flag("quick") ? { states: [...A.uniformStates(10), ...A.prefixStates(STAGGER)] } : {});
const items = L.R.items;
items.sort((a, b) => a.key - b.key);
console.log(`built ${built.join(" ")} · ${items.length} items · ${flag("fast") ? "unsettled" : `settled in ${((Date.now() - t0) / 1000).toFixed(1)} s`}`);

// the shader canvas sits between two depth-sorted layers. The near skin is cut away, so the beam is drawn over the
// machine: only items lying wholly in front of the optical plane (every recorded shape at y > BEAM_FRONT) go above it.
const BEAM_FRONT = 2;
const groupOf = (item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}"${item.ride !== item.piece ? ` data-ride="${item.ride}"` : ""}${item.live ? ` data-live="${item.live}"` : ""} data-name="${item.name}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
};
const inFront = (item) => {
  const shapes = item.shapes || [];
  if (!shapes.length) return (item.pos || [0, 0, 0])[1] > BEAM_FRONT;
  return shapes.every((shape) => A.boundsOf(shape).min[1] > BEAM_FRONT);
};
const screenBox = (item) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const shape of item.shapes || []) {
    const { min, max } = A.boundsOf(shape);
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const [sx, sy] = k.iso([x, y, z], P);
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
};
// The back layer is seeded with the items that overlap the beam's path on screen and are not wholly in front of it,
// then closed downward: anything drawn earlier that overlaps a back item joins it. A set closed that way can sit under the
// canvas without changing what paints over what anywhere, so the SVG reads exactly as one sorted list.
const above = items.map(inFront);
const boxes = items.map(screenBox);
const hit = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const OPT = PLAN.OPTIC;
const pathPts = [OPT.plasma, ...((shared.beam && shared.beam.path) || [OPT.IF, OPT.facetField, OPT.facetPupil, OPT.relay, OPT.reticle]), ...((shared.pobMirrors || [OPT.reticle, OPT.wafer]).slice(1))];
const laserFrom = (shared.beam && shared.beam.laserFrom) || [OPT.plasma[0], OPT.plasma[1], 0];
const beamSegs = [];
for (let i = 1; i < pathPts.length; i++) beamSegs.push([pathPts[i - 1], pathPts[i]]);
beamSegs.push([laserFrom, OPT.plasma]);
const segBoxes = beamSegs.map(([a, b]) => { const p = k.iso(a, P), q = k.iso(b, P), pad = 8; return [Math.min(p[0], q[0]) - pad, Math.min(p[1], q[1]) - pad, Math.max(p[0], q[0]) + pad, Math.max(p[1], q[1]) + pad]; });
const back2 = items.map((item, i) => !inFront(item) && segBoxes.some((b) => hit(boxes[i], b)));
for (let changed = true, round = 0; changed && round < 60; round++) {
  changed = false;
  for (let j = items.length - 1; j >= 0; j--) {
    if (!back2[j]) continue;
    for (let i = 0; i < j; i++) if (!back2[i] && hit(boxes[i], boxes[j])) { back2[i] = true; changed = true; }
  }
}
for (let i = 0; i < items.length; i++) above[i] = !back2[i];
const isBack = above.map((a) => !a);
console.log(`layers: ${isBack.filter(Boolean).length} items under the beam canvas, ${isBack.filter((b) => !b).length} above`);
const backGroups = items.map((item, index) => (isBack[index] ? groupOf(item, index) : "")).join("");
const groups = items.map((item, index) => (isBack[index] ? "" : groupOf(item, index)));

const LABEL =
  "A cutaway of an EUV lithography cell as installed in a leading-edge fab: an overhead hoist and FOUP on a load port, the coater/developer track, the interface and vacuum load locks, and the EUV scanner with its twin wafer stages, projection optics, reticle stage, illuminator and tin-plasma light source, fed from the sub-fab below by a CO2 drive laser through a beam transport tube.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL, body: back.join("") + `<g class="lc-cell" data-layer="back">${backGroups}</g>`, className: "lc-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg lc-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="lc-cell" data-layer="front">${groups.join("")}</g></svg>`;

const unit = (v) => { const o = k.iso([0, 0, 0], P); const p = k.iso(v, P); return [p[0] - o[0], p[1] - o[1]]; };
const DATA = {
  W, H, V: G.viewOf(P), EX: unit([1, 0, 0]), EY: unit([0, 1, 0]), EZ: unit([0, 0, 1]),
  facts: FACTS, optic: PLAN.OPTIC, measure: PLAN.MEASURE, camera: glCamera(P),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say || piece.name }])),
  stagger: STAGGER, spring: SPRING,
  order: STAGGER.filter((id) => id !== "stand"),
  shared,
};
writeFileSync(join(HERE, "../app/data/reference-data.json"), JSON.stringify({...DATA,...JSON.parse(readFileSync(join(HERE, "../reference-overrides.json"), "utf8"))}) + "\n");
const CSS_FILE = join(HERE, "litho.css");
const LIVE_FILE = join(HERE, "live.js");
const CSS = existsSync(CSS_FILE) ? readFileSync(CSS_FILE, "utf8") : "";
const GL_FILE = join(HERE, "gl.js");
const LIVE = existsSync(LIVE_FILE) ? (readFileSync(LIVE_FILE, "utf8") + (existsSync(GL_FILE) ? "\n" + readFileSync(GL_FILE, "utf8") : "")).replace("__DATA__", JSON.stringify(DATA)) : "";
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">EUV litho cell · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>${FACTS.wavelength_nm} nm</span></div>`;
const stage = `<div class="lc-stage" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="${DATA.order.length}" aria-valuenow="0" aria-valuetext="assembled" aria-label="EUV lithography cell. Hover or use the arrow keys to take it apart assembly by assembly; press R or the Run button to expose wafers, Escape to stop and close it up.">${backSvg}<canvas class="lc-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;
const controls = `<div class="lc-controls"><button type="button" class="lc-run" data-run><span class="lc-lamp" aria-hidden="true"></span><span data-run-label>Run wafers</span></button><span class="lc-hint">Hover the cell to take it apart</span><span class="lc-sr" aria-live="polite" data-live-region></span></div>`;
const PARTS = DATA.order.map((id, index) => `<button type="button" class="lc-part" data-part="${id}"><span class="lc-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const CAPTION = `Air and glass absorb EUV light (${FACTS.wavelength_nm} nm), so the scanner works with mirrors alone, in a vacuum flushed with hydrogen. In the sub-fab a ${FACTS.laser_kw} kW CO2 laser fires up through the floor; in the source vessel it hits ${FACTS.droplet_rate_hz.toLocaleString("en-US")} tin droplets a second, a pre-pulse flattening each one and the main pulse turning it into plasma near ${FACTS.plasma_c.toLocaleString("en-US")} °C. A ${FACTS.collector_reflectivity * 100}% Mo/Si collector focuses the glow to the intermediate focus; facet mirrors shape it and two grazing mirrors bring it to the mask at ${FACTS.chief_ray_deg}°; six mirrors (${(POB_TRANSMISSION * 100).toFixed(0)}% through, together) shrink the pattern ${FACTS.reduction}× onto the wafer, ${FACTS.fields_per_wafer} fields per wafer, while the second stage measures the next wafer. The track coats each wafer before and develops it after. The drawing keeps heights to scale and shortens the scanner to about half its real length; to fit, the last two illuminator mirrors carry about 70% of the illumination cone. Where public sources give no size, the model engineers one from the physics and marks it DERIVED.`;
const body = `<figure class="iso-figure lc"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="lc-parts">${PARTS}</span><span class="iso-caption">${CAPTION}</span><span class="iso-caption lc-sources">Sources: ASML product pages and EUVL Symposium decks, Zeiss SMT, Trumpf, Fomenkov et al. (ASML/Cymer), Heertjes et al. 2020, SEMI E15.1/E57, TEL and ASML patents.</span></figcaption></figure>`;
const page = k.pageHtml({ title: "EUV litho cell", theme: THEME, body: `<style>.lc-stage{position:relative}.lc-stage>svg,.lc-stage>canvas{display:block;width:100%;height:auto}.lc-stage>.lc-front,.lc-stage>.lc-gl{position:absolute;inset:0;height:100%!important;pointer-events:none}${CSS}</style>${body}`, script: LIVE ? kitScript() + glScript() + LIVE : "", width: 1500 });
writeFileSync(join(HERE, OUT), page);
console.log("wrote", OUT, `${(page.length / 1024).toFixed(0)} KB`);

// --audit-lite: rest, apart, every prefix state and every 6th frame of the spring replay (no reversal paths), for a
// cell this size; --audit replays everything
// crowding pairs looked at in 8x close-ups (shots/crowd1-3.png) and judged clear: screen coincidences between parts 38 to
// 600 cm apart in depth, where the nearer part hides the other's end or the other runs well behind it
const CROWD_OK = [
  ["pob.clamp*", "stages.ifm-fibre*"],
  ["stages.ifm-fibre*", "pob.harness*"],
  ["stages.ifm-fibre*", "interface.ped-leg*"],
  ["stages.ifm-fibre*", "interface.arm43-column*"],   // apart pose only, 2.2 m apart in depth (shots/crowd4.png)
  ["pob.clamp*", "stages.live-chuckB.slab-*"],
  ["laser.pa3.water-supply*", "stand.column*"],
  ["laser.harness*", "stand.column*"],
  ["illum.gauge-clamp*", "utility.water-feed*"],
  ["beamline.plenum*", "source.pedestal-brace*"],
];
if (flag("audit")) A.auditOrExit(L.R, P, { argv: ["--audit"], crowd: CROWD_OK });
else if (flag("audit-lite")) A.auditOrExit(L.R, P, { argv: ["--audit"], frames: LITE_FRAMES(), crowd: CROWD_OK });
